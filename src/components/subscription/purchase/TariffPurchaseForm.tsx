import { getSessionGeneration, isCurrentSession } from '../../../utils/session';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../../../api/subscription';
import { getErrorMessage, getInsufficientBalanceError } from '../../../utils/subscriptionHelpers';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { dailyPriceQuote } from './dailyPrice';
import { usePlatform } from '../../../platform';
import { openPaymentUrl } from '../../../utils/openPaymentUrl';
import { getMonthlyPriceKopeks } from '../../../utils/pricing';
import { pickBestValue } from '../../../utils/bestValue';
import InsufficientBalancePrompt from '../../InsufficientBalancePrompt';
import type { Tariff, TariffPeriod } from '../../../types';
import { PurchaseTopUpSheet } from './PurchaseTopUpSheet';
import { integrationCapabilities } from '../../../config/integrationCapabilities';

// ──────────────────────────────────────────────────────────────────
// TariffPurchaseForm
//
// The full per-tariff purchase form: period picker (or daily-tariff
// activate), custom-days toggle + slider, custom-traffic toggle +
// slider, summary, and the confirm CTA. Self-owns:
//   - the purchaseTariff mutation
//   - the auto-scroll-into-view ref + effect on mount
//   - selectedTariffPeriod / customDays / customTrafficGb /
//     useCustomDays / useCustomTraffic (form-internal state, reset
//     by re-mount when the parent passes a new `tariff` via key=)
//
// The parent (SubscriptionPurchase) supplies the chosen tariff,
// the current balance (for inline insufficient-balance prompts),
// the subscription id (for the renew-this-subscription flow), and
// onBack to open the tariff picker.
// ──────────────────────────────────────────────────────────────────

export interface TariffPurchaseFormProps {
  tariff: Tariff;
  subscriptionId: number | undefined;
  balanceKopeks: number | undefined;
  pricingReady?: boolean;
  /** СБП-оформление (Platega recurrent) доступно — показать вторую CTA. */
  sbpPurchaseEnabled?: boolean;
  /** Оформление привязкой Lava доступно — показать вторую CTA. */
  lavaPurchaseEnabled?: boolean;
  /** Cashera recurring purchase is independent of Platega/Lava capability. */
  casheraPurchaseEnabled?: boolean;
  onBack: () => void;
}

export function TariffPurchaseForm({
  tariff,
  subscriptionId,
  balanceKopeks,
  pricingReady = true,
  sbpPurchaseEnabled = false,
  lavaPurchaseEnabled = false,
  casheraPurchaseEnabled = false,
  onBack,
}: TariffPurchaseFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionGeneration = useRef(getSessionGeneration()).current;
  const { formatAmount, currencySymbol } = useCurrency();
  const { applyPromoDiscount } = usePromoDiscount();
  // Та же котировка, что на карточке тарифа: серверная цена + промокод один раз.
  const dailyQuote = dailyPriceQuote(tariff, applyPromoDiscount);
  const { openLink, platform, haptic } = usePlatform();
  const ref = useRef<HTMLDivElement>(null);

  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100).replace(/[.,]00$/, '')}\u00A0${currencySymbol}`;

  // Form-internal state — seeded from the tariff prop. Resets via
  // `key={tariff.id}` on the parent's render.
  // Отмеченный оператором период выбран сразу: рамка «Выгодно» и итог внизу
  // должны говорить об одном и том же периоде.
  const [selectedTariffPeriod, setSelectedTariffPeriod] = useState<TariffPeriod | null>(
    pickBestValue(tariff.periods) || tariff.periods[0] || null,
  );
  const [customDays, setCustomDays] = useState<number>(30);
  const [customTrafficGb, setCustomTrafficGb] = useState<number>(50);
  const [useCustomDays, setUseCustomDays] = useState(false);
  const [useCustomTraffic, setUseCustomTraffic] = useState(false);

  const [topUp, setTopUp] = useState<{
    days: number;
    trafficGb?: number;
    missingKopeks: number;
  } | null>(null);
  // Cached options can refresh while the form remains open. Preserve days, but
  // never price from the old period object after receiving a new tariff quote.
  useEffect(() => {
    setSelectedTariffPeriod(
      (previous) =>
        tariff.periods.find((period) => period.days === previous?.days) ??
        pickBestValue(tariff.periods) ??
        tariff.periods[0] ??
        null,
    );
  }, [tariff]);
  const selection = () => ({
    days:
      tariff.is_daily || (tariff.daily_price_kopeks ?? 0) > 0
        ? 1
        : useCustomDays
          ? customDays
          : (selectedTariffPeriod?.days ?? 30),
    trafficGb: useCustomTraffic && tariff.custom_traffic_enabled ? customTrafficGb : undefined,
  });
  const handlePurchase = (price: number) => {
    if (!isCurrentSession(sessionGeneration)) return;
    if (!pricingReady || typeof balanceKopeks !== 'number' || !Number.isFinite(balanceKopeks))
      return;
    if (price > balanceKopeks) setTopUp({ ...selection(), missingKopeks: price - balanceKopeks });
    else purchaseMutation.mutate();
  };
  const extraDevicesReductionMutation = useMutation({
    mutationFn: () => {
      if (!isCurrentSession(sessionGeneration)) throw new Error(t('common.error'));
      return subscriptionApi.reduceDevices(
        tariff.base_device_limit ??
          Math.max(1, tariff.device_limit - (tariff.extra_devices_count ?? 0)),
        subscriptionId,
      );
    },
    onSuccess: async () => {
      if (!isCurrentSession(sessionGeneration)) return;
      await Promise.all(
        ['subscription', 'purchase-options', 'renewal-options'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key], refetchType: 'all' }),
        ),
      );
      if (!isCurrentSession(sessionGeneration)) return;
      void queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['device-reduction-info'] });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: () => {
      if (!isCurrentSession(sessionGeneration)) throw new Error(t('common.error'));
      if (!pricingReady || extraDevicesReductionMutation.isPending)
        throw new Error(t('common.loadError'));
      const isDailyTariff =
        tariff.is_daily || (tariff.daily_price_kopeks && tariff.daily_price_kopeks > 0);
      const days = isDailyTariff
        ? 1
        : useCustomDays
          ? customDays
          : selectedTariffPeriod?.days || 30;
      const trafficGb =
        useCustomTraffic && tariff.custom_traffic_enabled ? customTrafficGb : undefined;
      // Forward the subscription_id when the user landed here via the
      // "Renew this subscription" flow (?subscriptionId=N). The backend
      // uses it to resolve the exact target row by ID, avoiding the
      // race with concurrent panel webhooks that would otherwise hit
      // the partial UNIQUE on uq_subscriptions_user_tariff_active.
      return subscriptionApi.purchaseTariff(
        tariff.id,
        days,
        trafficGb,
        subscriptionId ?? undefined,
      );
    },
    onSuccess: () => {
      if (!isCurrentSession(sessionGeneration)) return;
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      navigate('/subscriptions', { replace: true });
    },
  });

  // СБП-оформление: первое списание = подтверждение привязки в банке; период
  // на форме не участвует — списания идут по каденс-правилу тарифа.
  const sbpPurchaseMutation = useMutation({
    mutationFn: () => {
      if (!integrationCapabilities.recurringPayments || !isCurrentSession(sessionGeneration))
        throw new Error(t('common.error'));
      return subscriptionApi.purchaseWithSbpRecurring(tariff.id);
    },
    onSuccess: (data) => {
      if (!isCurrentSession(sessionGeneration)) return;
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['sbp-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  const lavaPurchaseMutation = useMutation({
    mutationFn: () => {
      if (!integrationCapabilities.recurringPayments || !isCurrentSession(sessionGeneration))
        throw new Error(t('common.error'));
      return subscriptionApi.purchaseWithLavaRecurring(tariff.id);
    },
    onSuccess: (data) => {
      if (!isCurrentSession(sessionGeneration)) return;
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['lava-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  // This API accepts only tariff_id: the recurring schedule and first charge
  // come from the backend tariff, independently of the period/traffic selection.
  const casheraPurchaseMutation = useMutation({
    mutationFn: () => {
      if (
        !integrationCapabilities.casheraRecurringPayments ||
        !casheraPurchaseEnabled ||
        !isCurrentSession(sessionGeneration)
      )
        throw new Error(t('common.error'));
      if (!pricingReady || extraDevicesReductionMutation.isPending)
        throw new Error(t('common.loadError'));
      return subscriptionApi.purchaseWithCasheraRecurring(tariff.id);
    },
    onSuccess: (data) => {
      if (!isCurrentSession(sessionGeneration)) return;
      if (data.redirect_url) openPaymentUrl(data.redirect_url, platform, openLink);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['cashera-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  const sbpPurchaseButton = integrationCapabilities.recurringPayments && sbpPurchaseEnabled && (
    <>
      <button
        onClick={() => sbpPurchaseMutation.mutate()}
        disabled={
          !pricingReady ||
          extraDevicesReductionMutation.isPending ||
          sbpPurchaseMutation.isPending ||
          lavaPurchaseMutation.isPending ||
          casheraPurchaseMutation.isPending ||
          purchaseMutation.isPending
        }
        className="mt-2 w-full rounded-full bg-white py-3 text-[15px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {sbpPurchaseMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t('common.loading')}
          </span>
        ) : (
          t('subscription.sbpRecurring.purchaseButton')
        )}
      </button>
      <div className="mt-1.5 text-center text-[11px] text-apple-faint">
        {t('subscription.sbpRecurring.purchaseHint')}
      </div>
      {sbpPurchaseMutation.isError && (
        <div className="mt-2 text-center text-sm text-apple-red">
          {getErrorMessage(sbpPurchaseMutation.error)}
        </div>
      )}
    </>
  );

  const lavaPurchaseButton = integrationCapabilities.recurringPayments && lavaPurchaseEnabled && (
    <>
      <button
        onClick={() => lavaPurchaseMutation.mutate()}
        disabled={
          !pricingReady ||
          extraDevicesReductionMutation.isPending ||
          sbpPurchaseMutation.isPending ||
          lavaPurchaseMutation.isPending ||
          casheraPurchaseMutation.isPending ||
          purchaseMutation.isPending
        }
        className="mt-2 w-full rounded-xl border border-apple-blue/40 bg-apple-blue/10 py-3 text-sm font-medium text-apple-ink transition-colors hover:bg-apple-blue/20 disabled:opacity-50"
      >
        {lavaPurchaseMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t('common.loading')}
          </span>
        ) : (
          t('subscription.lavaRecurring.purchaseButton')
        )}
      </button>
      <div className="mt-1.5 text-center text-[11px] text-apple-faint">
        {t('subscription.lavaRecurring.purchaseHint')}
      </div>
      {lavaPurchaseMutation.isError && (
        <div className="mt-2 text-center text-sm text-apple-red">
          {getErrorMessage(lavaPurchaseMutation.error)}
        </div>
      )}
    </>
  );

  const casheraPurchaseButton =
    integrationCapabilities.casheraRecurringPayments && casheraPurchaseEnabled && (
      <>
        <button
          type="button"
          onClick={() => casheraPurchaseMutation.mutate()}
          disabled={
            !pricingReady ||
            extraDevicesReductionMutation.isPending ||
            casheraPurchaseMutation.isPending ||
            sbpPurchaseMutation.isPending ||
            lavaPurchaseMutation.isPending ||
            purchaseMutation.isPending
          }
          className="mt-2 w-full rounded-full border border-apple-blue/40 bg-apple-blue/10 py-3 text-[15px] font-medium text-apple-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {casheraPurchaseMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t('common.loading')}
            </span>
          ) : (
            t('subscription.casheraRecurring.purchaseButton')
          )}
        </button>
        <div className="mt-1.5 text-center text-[11px] text-apple-faint">
          {t('subscription.casheraRecurring.purchaseHint')}
        </div>
        <div className="mt-1 text-center text-[11px] text-apple-mute">
          {t(
            'subscription.casheraRecurring.purchaseSelectionHint',
            'Период и сумма автосписаний задаются тарифом. Выбранные выше срок и трафик используются только при оплате с баланса.',
          )}
        </div>
        {casheraPurchaseMutation.isError && (
          <div className="mt-2 text-center text-sm text-apple-red">
            {getErrorMessage(casheraPurchaseMutation.error)}
          </div>
        )}
      </>
    );

  const purchaseOptions =
    typeof balanceKopeks === 'number' && Number.isFinite(balanceKopeks)
      ? { balance_kopeks: balanceKopeks }
      : undefined;
  return (
    <div ref={ref} className="space-y-3">
      {/* Current tariff — name, summary, change button */}
      <div className="apple-card-grad flex items-center justify-between gap-3 rounded-2xl bg-apple-card p-4">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-apple-ink">
            {t('subscription.baseTariff')} {tariff.name}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-apple-mute">
            {tariff.description?.split('\n')[0] ||
              `${tariff.traffic_limit_label} · ${
                tariff.device_limit === 0
                  ? '∞'
                  : t('subscription.devices', { count: tariff.device_limit })
              }`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic?.impact('medium');
            onBack();
          }}
          className="shrink-0 rounded-full bg-apple-elevated px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
          style={{ color: '#ffffff' }}
        >
          {t('subscription.changeTariff', 'Изменить')}
        </button>
      </div>

      <div className="space-y-5">
        {/* Daily Tariff Purchase */}
        {tariff.is_daily || (tariff.daily_price_kopeks && tariff.daily_price_kopeks > 0) ? (
          <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
            <div className="mb-4 text-center">
              <div className="mb-2 text-sm text-apple-mute">
                {t('subscription.dailyPurchase.costPerDay')}
              </div>
              <div className="text-3xl font-bold" style={{ color: '#ffffff' }}>
                {formatPrice(dailyQuote?.price ?? 0)}
              </div>
              {dailyQuote?.original != null && dailyQuote.original > dailyQuote.price && (
                <div className="mt-1 text-sm text-apple-faint line-through">
                  {formatPrice(dailyQuote.original)}
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm text-apple-mute">
              <div className="flex items-start gap-2">
                <span style={{ color: '#ffffff' }}>•</span>
                <span>{t('subscription.dailyPurchase.chargedDaily')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span style={{ color: '#ffffff' }}>•</span>
                <span>{t('subscription.dailyPurchase.canPause')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span style={{ color: '#ffffff' }}>•</span>
                <span>{t('subscription.dailyPurchase.pausedOnLowBalance')}</span>
              </div>
            </div>

            {(() => {
              const dailyPrice = dailyQuote?.price ?? 0;
              const hasEnoughBalance =
                purchaseOptions && dailyPrice <= purchaseOptions.balance_kopeks;
              const missingAmount = purchaseOptions
                ? dailyPrice - purchaseOptions.balance_kopeks
                : dailyPrice;

              return (
                <div className="mt-6">
                  {/* Balance info */}
                  {purchaseOptions && (
                    <div
                      className="mb-3 flex items-center justify-between rounded-xl px-4 py-3 text-sm"
                      style={{
                        background: hasEnoughBalance
                          ? 'rgba(48,209,88,0.1)'
                          : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      <div className="flex w-full justify-between">
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] uppercase tracking-wider text-apple-faint">
                            {t('balance.currentBalance')}
                          </span>
                          <span
                            className="font-semibold"
                            style={{ color: hasEnoughBalance ? '#30d158' : '#f5f5f7' }}
                          >
                            {purchaseOptions.balance_kopeks === 0
                              ? t('subscription.noFunds', 'Нет средств')
                              : formatPrice(purchaseOptions.balance_kopeks)}
                          </span>
                        </div>
                        {!hasEnoughBalance && missingAmount > 0 && (
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] uppercase tracking-wider text-apple-faint">
                              {t('balance.missing')}
                            </span>
                            <span className="font-semibold" style={{ color: '#ff453a' }}>
                              {formatPrice(missingAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      haptic?.impact('medium');
                      handlePurchase(dailyPrice);
                    }}
                    disabled={
                      purchaseMutation.isPending ||
                      sbpPurchaseMutation.isPending ||
                      lavaPurchaseMutation.isPending ||
                      casheraPurchaseMutation.isPending ||
                      extraDevicesReductionMutation.isPending ||
                      !pricingReady ||
                      purchaseOptions === undefined
                    }
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#F97315] text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {purchaseMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {t('common.loading')}
                      </span>
                    ) : (
                      <>
                        {t('subscription.paySubscription', 'Оплатить')}{' '}
                        <span className="text-white/90">
                          {hasEnoughBalance ? formatPrice(dailyPrice) : formatPrice(missingAmount)}
                        </span>
                      </>
                    )}
                  </button>

                  {sbpPurchaseButton}
                  {lavaPurchaseButton}
                  {casheraPurchaseButton}
                  {/* Fallback prompt — used only when the top-up sheet
                              cannot be opened (e.g. payment methods config error). */}

                  {purchaseMutation.isError &&
                    !getInsufficientBalanceError(purchaseMutation.error) && (
                      <div className="mt-3 text-center text-sm text-apple-red">
                        {getErrorMessage(purchaseMutation.error)}
                      </div>
                    )}
                  {purchaseMutation.isError &&
                    getInsufficientBalanceError(purchaseMutation.error) && (
                      <InsufficientBalancePrompt
                        missingAmountKopeks={
                          getInsufficientBalanceError(purchaseMutation.error)?.missingAmount ?? 0
                        }
                        compact
                        className="mt-3"
                      />
                    )}
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Period Selection for non-daily tariffs */}
            <div>
              <div className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-apple-mute">
                {t('subscription.selectPeriod')}
              </div>

              {tariff.periods.length > 0 && !useCustomDays && (
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {tariff.periods.map((period) => {
                    const promoPeriod = applyPromoDiscount(
                      period.price_kopeks,
                      period.original_price_kopeks,
                    );
                    const displayDiscount = promoPeriod.percent;
                    const displayOriginal = promoPeriod.original;
                    const displayPrice = promoPeriod.price;
                    const displayPerMonth =
                      displayPrice !== period.price_kopeks
                        ? getMonthlyPriceKopeks(displayPrice, period.days)
                        : period.price_per_month_kopeks;
                    const isSelected = selectedTariffPeriod?.days === period.days && !useCustomDays;

                    return (
                      <button
                        key={period.days}
                        aria-pressed={isSelected}
                        onClick={(e) => {
                          haptic?.impact('medium');
                          setSelectedTariffPeriod(period);
                          setUseCustomDays(false);
                          // Ripple effect
                          const btn = e.currentTarget;
                          const ripple = document.createElement('span');
                          const rect = btn.getBoundingClientRect();
                          const size = Math.max(rect.width, rect.height) * 2;
                          ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.12);width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;transform:scale(0);animation:ripple-wave 6s cubic-bezier(0.22,0.61,0.36,1) forwards;pointer-events:none;z-index:0;`;
                          btn.appendChild(ripple);
                          setTimeout(() => ripple.remove(), 6100);
                        }}
                        className="apple-card-grad relative overflow-hidden rounded-2xl bg-apple-elevated py-3.5 pl-[22px] pr-4 text-left transition-transform active:scale-[0.97]"
                        style={isSelected ? { boxShadow: 'inset 0 0 0 1.5px #F97315' } : undefined}
                      >
                        {period.is_highlighted && (
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-apple-mute">
                            ★ {t('subscription.bestValue')}
                          </div>
                        )}
                        {displayDiscount && displayDiscount > 0 && (
                          <div
                            className="absolute right-2 top-2 z-[1] rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{
                              background: promoPeriod.isPromoGroup ? '#30d158' : '#F97315',
                            }}
                          >
                            -{displayDiscount}%
                          </div>
                        )}
                        <div className="mb-auto flex w-full items-center justify-between text-base text-apple-ink">
                          {period.label}
                        </div>
                        <div className="mt-5 flex flex-col text-2xl font-medium leading-6 tracking-tight">
                          <span className="font-semibold" style={{ color: '#ffffff' }}>
                            {formatPrice(displayPrice)}
                          </span>
                          {displayOriginal && displayOriginal > displayPrice && (
                            <span className="text-sm text-apple-faint line-through">
                              {formatPrice(displayOriginal)}
                            </span>
                          )}
                        </div>
                        <small className="text-xs font-normal tracking-normal text-apple-faint">
                          {formatPrice(displayPerMonth ?? 0)}/{t('subscription.month')}
                        </small>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* No periods available fallback */}
              {tariff.periods.length === 0 &&
                !useCustomDays &&
                !(tariff.custom_days_enabled && (tariff.price_per_day_kopeks ?? 0) > 0) && (
                  <div
                    className="rounded-2xl p-4 text-center"
                    style={{ background: 'rgba(255,159,10,0.12)' }}
                  >
                    <div className="mb-2 text-sm font-medium" style={{ color: '#ff9f0a' }}>
                      {t('subscription.noPeriodsAvailable')}
                    </div>
                    <div className="text-xs text-apple-mute">
                      {t('subscription.noPeriodsAvailableHint')}
                    </div>
                    <button
                      onClick={onBack}
                      className="mt-3 rounded-full bg-apple-elevated px-4 py-2 text-sm font-medium text-apple-ink transition-opacity hover:opacity-80"
                    >
                      {t('subscription.chooseDifferentTariff')}
                    </button>
                  </div>
                )}

              {/* Custom days option */}
              {tariff.custom_days_enabled && (tariff.price_per_day_kopeks ?? 0) > 0 && (
                <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-apple-ink">
                      {t('subscription.customDays.title')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseCustomDays(!useCustomDays)}
                      className="relative h-6 w-10 rounded-full transition-colors"
                      style={{
                        background: useCustomDays ? '#F97315' : '#39393d',
                      }}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                          useCustomDays ? 'left-5' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  {useCustomDays && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={tariff.min_days ?? 1}
                          max={tariff.max_days ?? 365}
                          value={customDays}
                          onChange={(e) => setCustomDays(parseInt(e.target.value))}
                          className="flex-1 accent-[#F97315]"
                        />
                        <input
                          type="number"
                          value={customDays}
                          min={tariff.min_days ?? 1}
                          max={tariff.max_days ?? 365}
                          onChange={(e) =>
                            setCustomDays(
                              Math.max(
                                tariff.min_days ?? 1,
                                Math.min(
                                  tariff.max_days ?? 365,
                                  parseInt(e.target.value) || (tariff.min_days ?? 1),
                                ),
                              ),
                            )
                          }
                          className="w-20 rounded-lg bg-apple-elevated px-3 py-2 text-center text-apple-ink outline-none"
                        />
                      </div>
                      {(() => {
                        const basePrice = customDays * (tariff.price_per_day_kopeks ?? 0);
                        const existingOriginal =
                          tariff.original_price_per_day_kopeks &&
                          tariff.original_price_per_day_kopeks > (tariff.price_per_day_kopeks ?? 0)
                            ? customDays * tariff.original_price_per_day_kopeks
                            : undefined;
                        const promoCustom = applyPromoDiscount(basePrice, existingOriginal);
                        return (
                          <div className="flex justify-between text-sm">
                            <span className="text-apple-mute">
                              {t('subscription.days', { count: customDays })} ×{' '}
                              {formatPrice(tariff.price_per_day_kopeks ?? 0)}/
                              {t('subscription.customDays.perDay')}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold" style={{ color: '#ffffff' }}>
                                {formatPrice(promoCustom.price)}
                              </span>
                              {promoCustom.original && promoCustom.original > promoCustom.price && (
                                <>
                                  <span className="text-xs text-apple-faint line-through">
                                    {formatPrice(promoCustom.original)}
                                  </span>
                                  <span
                                    className="rounded px-1.5 py-0.5 text-xs"
                                    style={{
                                      background: promoCustom.isPromoGroup
                                        ? 'rgba(48,209,88,0.18)'
                                        : 'rgba(249,115,21,0.18)',
                                      color: promoCustom.isPromoGroup ? '#30d158' : '#F97315',
                                    }}
                                  >
                                    -{promoCustom.percent}%
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom traffic option */}
            {tariff.custom_traffic_enabled && (tariff.traffic_price_per_gb_kopeks ?? 0) > 0 && (
              <div>
                <div className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-apple-mute">
                  {t('subscription.customTraffic.label')}
                </div>
                <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-apple-ink">
                      {t('subscription.customTraffic.selectVolume')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseCustomTraffic(!useCustomTraffic)}
                      className="relative h-6 w-10 rounded-full transition-colors"
                      style={{
                        background: useCustomTraffic ? '#F97315' : '#39393d',
                      }}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                          useCustomTraffic ? 'left-5' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  {!useCustomTraffic && (
                    <div className="text-sm text-apple-mute">
                      {t('subscription.customTraffic.default', {
                        label: tariff.traffic_limit_label,
                      })}
                    </div>
                  )}
                  {useCustomTraffic && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={tariff.min_traffic_gb ?? 1}
                          max={tariff.max_traffic_gb ?? 1000}
                          value={customTrafficGb}
                          onChange={(e) => setCustomTrafficGb(parseInt(e.target.value))}
                          className="flex-1 accent-[#F97315]"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={customTrafficGb}
                            min={tariff.min_traffic_gb ?? 1}
                            max={tariff.max_traffic_gb ?? 1000}
                            onChange={(e) =>
                              setCustomTrafficGb(
                                Math.max(
                                  tariff.min_traffic_gb ?? 1,
                                  Math.min(
                                    tariff.max_traffic_gb ?? 1000,
                                    parseInt(e.target.value) || (tariff.min_traffic_gb ?? 1),
                                  ),
                                ),
                              )
                            }
                            className="w-20 rounded-lg bg-apple-elevated px-3 py-2 text-center text-apple-ink outline-none"
                          />
                          <span className="text-apple-mute">{t('common.units.gb')}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-apple-mute">
                          {customTrafficGb} {t('common.units.gb')} ×{' '}
                          {formatPrice(tariff.traffic_price_per_gb_kopeks ?? 0)}/
                          {t('common.units.gb')}
                        </span>
                        <span className="font-semibold" style={{ color: '#ffffff' }}>
                          +
                          {formatPrice(customTrafficGb * (tariff.traffic_price_per_gb_kopeks ?? 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary & Purchase */}
            {(selectedTariffPeriod || useCustomDays) && (
              <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
                {(() => {
                  const basePeriodPrice = useCustomDays
                    ? customDays * (tariff.price_per_day_kopeks ?? 0)
                    : selectedTariffPeriod?.price_kopeks || 0;
                  const existingPeriodOriginal = useCustomDays
                    ? tariff.original_price_per_day_kopeks &&
                      tariff.original_price_per_day_kopeks > (tariff.price_per_day_kopeks ?? 0)
                      ? customDays * tariff.original_price_per_day_kopeks
                      : undefined
                    : selectedTariffPeriod?.original_price_kopeks &&
                        selectedTariffPeriod.original_price_kopeks >
                          selectedTariffPeriod.price_kopeks
                      ? selectedTariffPeriod.original_price_kopeks
                      : undefined;
                  const promoPeriod = applyPromoDiscount(basePeriodPrice, existingPeriodOriginal);

                  const trafficPrice =
                    useCustomTraffic && tariff.custom_traffic_enabled
                      ? customTrafficGb * (tariff.traffic_price_per_gb_kopeks ?? 0)
                      : 0;

                  const totalPrice = promoPeriod.price + trafficPrice;
                  const originalTotal = promoPeriod.original
                    ? promoPeriod.original + trafficPrice
                    : null;
                  const hasBreakdown =
                    (!useCustomDays &&
                      !!selectedTariffPeriod &&
                      (selectedTariffPeriod.extra_devices_count ?? 0) > 0 &&
                      !!selectedTariffPeriod.base_tariff_price_kopeks) ||
                    (useCustomTraffic && !!tariff.custom_traffic_enabled);

                  return (
                    <>
                      {hasBreakdown && (
                        <div className="mb-4 space-y-2">
                          {useCustomDays
                            ? null
                            : selectedTariffPeriod && (
                                <>
                                  {(selectedTariffPeriod.extra_devices_count ?? 0) > 0 &&
                                  selectedTariffPeriod.base_tariff_price_kopeks ? (
                                    <>
                                      <div className="flex justify-between text-sm text-apple-mute">
                                        <span>
                                          {t('subscription.baseTariff')}:{' '}
                                          {selectedTariffPeriod.label}
                                        </span>
                                        <span className="text-apple-ink">
                                          {formatPrice(
                                            selectedTariffPeriod.base_tariff_price_kopeks,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-3 text-sm text-apple-mute">
                                        <span className="flex min-w-0 items-center gap-2">
                                          <span>
                                            {t('subscription.extraDevices')} (
                                            {selectedTariffPeriod.extra_devices_count})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => extraDevicesReductionMutation.mutate()}
                                            disabled={extraDevicesReductionMutation.isPending}
                                            aria-label={t(
                                              'subscription.removeExtraDevices',
                                              'Убрать доп. устройства',
                                            )}
                                            className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60"
                                            style={{
                                              color: '#F97315',
                                              background: 'rgba(249,115,21,0.14)',
                                            }}
                                          >
                                            {extraDevicesReductionMutation.isPending
                                              ? '…'
                                              : t('subscription.removeExtraDevicesShort', 'Убрать')}
                                          </button>
                                        </span>
                                        <span className="text-apple-ink">
                                          +
                                          {formatPrice(
                                            selectedTariffPeriod.extra_devices_cost_kopeks ?? 0,
                                          )}
                                        </span>
                                      </div>
                                      {extraDevicesReductionMutation.isError && (
                                        <div className="text-[11px] text-apple-red">
                                          {getErrorMessage(extraDevicesReductionMutation.error)}
                                        </div>
                                      )}
                                    </>
                                  ) : null}
                                </>
                              )}
                          {useCustomTraffic && tariff.custom_traffic_enabled && (
                            <div className="flex justify-between text-sm text-apple-mute">
                              <span>
                                {t('subscription.summary.traffic', {
                                  gb: customTrafficGb,
                                })}
                              </span>
                              <span className="text-apple-ink">+{formatPrice(trafficPrice)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {promoPeriod.percent && (
                        <div
                          className="mb-4 flex items-center justify-center gap-2 rounded-xl p-2"
                          style={{ background: 'rgba(249,115,21,0.12)' }}
                        >
                          <span className="text-sm font-medium" style={{ color: '#ffffff' }}>
                            {t('promo.discountApplied')} -{promoPeriod.percent}%
                          </span>
                        </div>
                      )}

                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-semibold text-apple-ink">
                          {t('subscription.total')}
                        </span>
                        <div className="text-right">
                          <span className="text-2xl font-bold" style={{ color: '#ffffff' }}>
                            {formatPrice(totalPrice)}
                          </span>
                          {originalTotal && (
                            <div className="text-sm text-apple-faint line-through">
                              {formatPrice(originalTotal)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Payment CTA Button */}
                      {(() => {
                        const hasEnoughBalance =
                          purchaseOptions && totalPrice <= purchaseOptions.balance_kopeks;
                        const missingAmount = purchaseOptions
                          ? totalPrice - purchaseOptions.balance_kopeks
                          : totalPrice;

                        return (
                          <>
                            {/* Balance info */}
                            {purchaseOptions && (
                              <div
                                className="mb-3 flex items-center justify-between rounded-xl px-4 py-3 text-sm"
                                style={{
                                  background: hasEnoughBalance
                                    ? 'rgba(48,209,88,0.1)'
                                    : 'rgba(255,255,255,0.05)',
                                }}
                              >
                                <div className="flex w-full justify-between">
                                  <div className="flex flex-col items-start">
                                    <span className="text-[10px] uppercase tracking-wider text-apple-faint">
                                      {t('balance.currentBalance')}
                                    </span>
                                    <span
                                      className="font-semibold"
                                      style={{
                                        color: hasEnoughBalance ? '#30d158' : '#f5f5f7',
                                      }}
                                    >
                                      {purchaseOptions.balance_kopeks === 0
                                        ? t('subscription.noFunds', 'Нет средств')
                                        : formatPrice(purchaseOptions.balance_kopeks)}
                                    </span>
                                  </div>
                                  {!hasEnoughBalance && missingAmount > 0 && (
                                    <div className="flex flex-col items-start">
                                      <span className="text-[10px] uppercase tracking-wider text-apple-faint">
                                        {t('balance.missing')}
                                      </span>
                                      <span className="font-semibold" style={{ color: '#ff453a' }}>
                                        {formatPrice(missingAmount)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            <button
                              onClick={() => {
                                haptic?.impact('medium');
                                handlePurchase(totalPrice);
                              }}
                              disabled={
                                purchaseMutation.isPending ||
                                sbpPurchaseMutation.isPending ||
                                lavaPurchaseMutation.isPending ||
                                casheraPurchaseMutation.isPending ||
                                extraDevicesReductionMutation.isPending ||
                                !pricingReady ||
                                purchaseOptions === undefined
                              }
                              className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#F97315] text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                              {purchaseMutation.isPending ? (
                                <span className="flex items-center justify-center gap-2">
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                  {t('common.loading')}
                                </span>
                              ) : (
                                <>
                                  {t('subscription.paySubscription', 'Оплатить')}{' '}
                                  <span className="text-white/90">
                                    {hasEnoughBalance
                                      ? formatPrice(totalPrice)
                                      : formatPrice(missingAmount)}
                                  </span>
                                </>
                              )}
                            </button>

                            {sbpPurchaseButton}
                            {lavaPurchaseButton}
                            {casheraPurchaseButton}
                            {/* Fallback prompt — used only when the top-up sheet
                                        cannot be opened (e.g. payment methods config error). */}
                          </>
                        );
                      })()}
                    </>
                  );
                })()}

                {purchaseMutation.isError &&
                  !getInsufficientBalanceError(purchaseMutation.error) && (
                    <div className="mt-3 text-center text-sm text-apple-red">
                      {getErrorMessage(purchaseMutation.error)}
                    </div>
                  )}
                {purchaseMutation.isError &&
                  getInsufficientBalanceError(purchaseMutation.error) && (
                    <InsufficientBalancePrompt
                      missingAmountKopeks={
                        getInsufficientBalanceError(purchaseMutation.error)?.missingAmount ?? 0
                      }
                      compact
                      className="mt-3"
                    />
                  )}
              </div>
            )}
          </>
        )}
      </div>

      {extraDevicesReductionMutation.isError && (
        <p role="alert" className="text-sm text-apple-red">
          {getErrorMessage(extraDevicesReductionMutation.error)}
        </p>
      )}
      {topUp && (
        <PurchaseTopUpSheet
          missingKopeks={topUp.missingKopeks}
          preparePurchase={() =>
            subscriptionApi.purchaseTariff(tariff.id, topUp.days, topUp.trafficGb, subscriptionId)
          }
          onClose={() => setTopUp(null)}
        />
      )}
    </div>
  );
}
