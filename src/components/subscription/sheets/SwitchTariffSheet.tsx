import { getSessionGeneration, isCurrentSession } from '../../../utils/session';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { subscriptionApi } from '../../../api/subscription';
import { getErrorMessage } from '../../../utils/subscriptionHelpers';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { dailyPriceQuote } from '../purchase/dailyPrice';
import InsufficientBalancePrompt from '../../InsufficientBalancePrompt';
import type { Tariff } from '../../../types';
import { Skeleton, SkeletonGroup } from '../../ui/skeleton';

// ──────────────────────────────────────────────────────────────────
// SwitchTariffSheet
//
// Inline preview + confirm of a tariff switch on an existing
// subscription. Self-owns:
//   - the previewTariffSwitch query
//   - the switchTariff mutation
//   - the auto-scroll-into-view effect
//
// The parent keeps the `switchTariffId` selection state because the
// trigger lives on a tariff card inside TariffPickerGrid. When the
// backend reports `subscription_expired` (the user's subscription
// lapsed while the modal was open), the sheet hands off to the
// parent via `onExpiredFallback(tariff)`, which opens the regular
// TariffPurchaseForm instead of attempting another switch.
// ──────────────────────────────────────────────────────────────────

// The backend rejects a switch that must instead go through the purchase flow:
// the subscription lapsed (`subscription_expired`), it is a trial that has no
// paid value to prorate and would otherwise be handed a full target period
// (`trial_cannot_switch`, bug #629889), or it sits on a free 0₽ tariff whose
// spammed/gifted remainder must reset rather than be prorated and carried
// (`free_tariff_cannot_switch`, TARIFF_SWITCH_RESET_FREE_DAYS). All arrive as
// detail.code + use_purchase_flow=true; some payloads use the legacy
// `error_code` key, so we accept either.
function shouldUsePurchaseFlow(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  const detail = error.response?.data?.detail as
    | { code?: string; error_code?: string; use_purchase_flow?: boolean }
    | undefined;
  if (!detail || typeof detail !== 'object') return false;
  const code = detail.code ?? detail.error_code;
  return (
    (code === 'subscription_expired' ||
      code === 'trial_cannot_switch' ||
      code === 'free_tariff_cannot_switch') &&
    detail.use_purchase_flow === true
  );
}

export interface SwitchTariffSheetProps {
  open: boolean;
  tariffId: number | null;
  subscriptionId: number | undefined;
  tariffs: Tariff[];
  onClose: () => void;
  onExpiredFallback: (tariff: Tariff) => void;
}

export function SwitchTariffSheet({
  open,
  tariffId,
  subscriptionId,
  tariffs,
  onClose,
  onExpiredFallback,
}: SwitchTariffSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionGeneration = useRef(getSessionGeneration()).current;
  const { formatAmount, currencySymbol } = useCurrency();
  const { applyPromoDiscount } = usePromoDiscount();
  const ref = useRef<HTMLDivElement>(null);

  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100).replace(/[.,]00$/, '')} ${currencySymbol}`;

  const {
    data: switchPreview,
    isFetching: switchPreviewLoading,
    isError: switchPreviewError,
  } = useQuery({
    queryKey: ['tariff-switch-preview', subscriptionId, tariffId],
    queryFn: () => subscriptionApi.previewTariffSwitch(tariffId!, subscriptionId),
    enabled: !!tariffId,
  });

  const switchMutation = useMutation({
    mutationFn: (id: number) => {
      if (!isCurrentSession(sessionGeneration)) throw new Error(t('common.error'));
      if (switchPreviewLoading || switchPreviewError || !switchPreview?.can_switch)
        throw new Error(t('common.error'));
      return subscriptionApi.switchTariff(id, subscriptionId);
    },
    onSuccess: () => {
      if (!isCurrentSession(sessionGeneration)) return;
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options', subscriptionId] });
      onClose();
      navigate('/subscriptions', { replace: true });
    },
    onError: (error: unknown) => {
      if (!isCurrentSession(sessionGeneration)) return;
      // Backend signal: this subscription can't be switched (it lapsed, or it's
      // a trial). Hand the selected tariff back to the parent so it opens the
      // regular purchase form instead.
      if (shouldUsePurchaseFlow(error)) {
        const targetTariff = tariffs.find((tariff) => tariff.id === tariffId);
        if (targetTariff) {
          onClose();
          onExpiredFallback(targetTariff);
          queryClient.invalidateQueries({ queryKey: ['purchase-options', subscriptionId] });
        }
      }
    },
  });

  // Smoothly scroll the panel into view when opened.
  useEffect(() => {
    if (open && ref.current) {
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open || !tariffId) return null;

  return (
    <div ref={ref} className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-apple-ink">{t('subscription.switchTariff.title')}</h3>
        <button
          onClick={onClose}
          className="text-sm text-apple-mute hover:text-apple-ink"
          aria-label={t('common.close', 'Close')}
        >
          ✕
        </button>
      </div>

      {switchPreviewError && (
        <p role="alert" className="text-sm text-apple-red">
          {t('common.error')}
        </p>
      )}
      {switchPreviewLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : (
        switchPreview &&
        (() => {
          const targetTariff = tariffs.find((tariff) => tariff.id === tariffId);
          // Та же котировка, что на карточке и экране активации: промокод один раз.
          const dailyQuote = targetTariff
            ? dailyPriceQuote(targetTariff, applyPromoDiscount)
            : null;
          const dailyPrice = dailyQuote?.price ?? 0;
          const isDailyTariff = dailyPrice > 0;

          return (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2 text-apple-mute">
                  <span className="shrink-0">{t('subscription.switchTariff.currentTariff')}</span>
                  <span className="min-w-0 truncate font-semibold text-apple-ink">
                    {switchPreview.current_tariff_name || '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-apple-mute">
                  <span className="shrink-0">{t('subscription.switchTariff.newTariff')}</span>
                  <span className="min-w-0 truncate font-medium text-apple-ink">
                    {switchPreview.new_tariff_name}
                  </span>
                </div>
                <div className="flex justify-between text-apple-mute">
                  <span>{t('subscription.switchTariff.remainingDays')}</span>
                  <span>{switchPreview.remaining_days}</span>
                </div>
              </div>

              {isDailyTariff && (
                <div className="rounded-lg border border-apple-blue/30 bg-apple-blue/10 p-3 text-center">
                  <div className="text-sm text-apple-mute">
                    {t('subscription.switchTariff.dailyPayment')}
                  </div>
                  <div className="text-lg font-bold text-apple-ink">{formatPrice(dailyPrice)}</div>
                  <div className="mt-1 text-xs text-apple-mute">
                    {t('subscription.switchTariff.dailyChargeDescription')}
                  </div>
                </div>
              )}

              {/* Цены — столбиком справа и целиком, без отрыва «₽»; подпись и
                  скидка — слева в остатке строки. */}
              <div className="flex items-start justify-between gap-3 border-t border-apple-hairline pt-3">
                <div className="min-w-0">
                  <span className="font-semibold text-apple-ink">
                    {t('subscription.switchTariff.upgradeCost')}
                  </span>
                  {switchPreview.discount_percent != null && switchPreview.discount_percent > 0 && (
                    <span className="ml-2 inline-block rounded-full bg-apple-green/10 px-2 py-0.5 text-xs font-medium text-apple-green">
                      -{switchPreview.discount_percent}%
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  {switchPreview.discount_percent != null &&
                    switchPreview.discount_percent > 0 &&
                    switchPreview.base_upgrade_cost_kopeks &&
                    switchPreview.base_upgrade_cost_kopeks > 0 && (
                      <span className="whitespace-nowrap text-sm text-apple-faint line-through">
                        {formatPrice(switchPreview.base_upgrade_cost_kopeks)}
                      </span>
                    )}
                  <span
                    className={`whitespace-nowrap text-lg font-bold ${switchPreview.upgrade_cost_kopeks === 0 ? 'text-apple-green' : 'text-apple-ink'}`}
                  >
                    {/* Свой формат, как у зачёркнутой цены рядом: подпись бота
                        приходит как «1234567.89 ₽». */}
                    {switchPreview.upgrade_cost_kopeks > 0
                      ? formatPrice(switchPreview.upgrade_cost_kopeks)
                      : t('subscription.switchTariff.free')}
                  </span>
                </div>
              </div>

              {!switchPreview.has_enough_balance && switchPreview.upgrade_cost_kopeks > 0 && (
                <InsufficientBalancePrompt
                  missingAmountKopeks={switchPreview.missing_amount_kopeks}
                  compact
                />
              )}

              <button
                onClick={() => switchMutation.mutate(tariffId)}
                disabled={switchMutation.isPending || !switchPreview.can_switch}
                className="w-full rounded-full bg-[#F97315] py-3 font-medium text-white transition-opacity disabled:opacity-50"
              >
                {switchMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  </span>
                ) : (
                  t('subscription.switchTariff.switch')
                )}
              </button>

              {switchMutation.isError &&
                (() => {
                  // Suppress the toast when the purchase-flow fallback already
                  // triggered (expired / trial): the parent is now showing the
                  // regular purchase form, so the raw axios message would mislead.
                  if (shouldUsePurchaseFlow(switchMutation.error)) {
                    return null;
                  }
                  return (
                    <div className="mt-3 text-center text-sm text-apple-red">
                      {getErrorMessage(switchMutation.error)}
                    </div>
                  );
                })()}
            </>
          );
        })()
      )}
    </div>
  );
}
