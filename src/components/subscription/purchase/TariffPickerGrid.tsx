import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { dailyPriceQuote } from './dailyPrice';
import type { Tariff, Subscription, PurchaseOptions } from '../../../types';
import { tariffAction, type TariffActionKind } from './tariffAction';

/** Подпись кнопки для действий, которые ведут в один и тот же сценарий выбора. */
const TARIFF_ACTION_LABEL: Record<Exclude<TariffActionKind, 'current-daily' | 'switch'>, string> = {
  extend: 'subscription.extend',
  moveToTariff: 'subscription.cta.moveToTariff',
  purchase: 'subscription.purchase',
};

// ──────────────────────────────────────────────────────────────────
// TariffPickerGrid
//
// The tariff selection surface inside SubscriptionPurchase. Renders:
//   - an optional promo-group banner when any tariff carries a
//     promo_group_name
//   - the "all tariffs purchased" empty state (multi-tariff mode)
//   - the grid itself (1 col mobile, 2 cols sm+) with promo prices,
//     per-tariff CTAs differentiated by user state (extend / switch /
//     purchase / legacy renewal)
//
// Owns nothing — pure presentation that calls back into the parent
// for selection (`onSelectTariff`) and switch (`onSwitchTariff`).
// ──────────────────────────────────────────────────────────────────

export interface TariffPickerGridProps {
  tariffs: Tariff[];
  subscription: Subscription | null;
  purchaseOptions: PurchaseOptions | undefined;
  isTariffsMode: boolean;
  isMultiTariff: boolean;
  onSelectTariff: (tariff: Tariff) => void;
  onSwitchTariff: (tariffId: number) => void;
}

export function TariffPickerGrid({
  tariffs,
  subscription,
  purchaseOptions,
  isTariffsMode,
  isMultiTariff,
  onSelectTariff,
  onSwitchTariff,
}: TariffPickerGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatAmount, currencySymbol } = useCurrency();
  const { applyPromoDiscount } = usePromoDiscount();

  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100).replace(/[.,]00$/, '')} ${currencySymbol}`;

  return (
    <>
      {/* All tariffs purchased */}
      {isMultiTariff &&
        purchaseOptions &&
        'all_tariffs_purchased' in purchaseOptions &&
        purchaseOptions.all_tariffs_purchased && (
          <div className="apple-card-grad rounded-2xl bg-apple-card p-6 text-center">
            <div className="mb-2 text-3xl">✅</div>
            <h3 className="mb-1 text-lg font-semibold text-apple-ink">
              {t('subscription.allTariffsPurchased', 'Все тарифы подключены')}
            </h3>
            <p className="mb-4 text-sm text-apple-mute">
              {t(
                'subscription.allTariffsPurchasedDesc',
                'Вы уже приобрели все доступные тарифы. Продлить подписку можно на странице тарифа.',
              )}
            </p>
            <button
              onClick={() => navigate('/subscriptions')}
              className="rounded-full bg-[#F97315] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('subscription.backToList', 'Мои подписки')}
            </button>
          </div>
        )}

      {/* Tariff Grid */}
      <div className="tariff-picker-grid">
        {[...tariffs]
          .filter((tariff) => {
            if (isMultiTariff && tariff.is_purchased) return false;
            if (subscription?.is_trial && tariff.name.toLowerCase().includes('trial')) {
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            const aIsCurrent = a.is_current || a.id === subscription?.tariff_id;
            const bIsCurrent = b.is_current || b.id === subscription?.tariff_id;
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            return 0;
          })
          .map((tariff) => {
            const isCurrentTariff = tariff.is_current || tariff.id === subscription?.tariff_id;
            const action = tariffAction({
              tariff,
              subscription,
              purchaseOptions,
              isTariffsMode,
              isMultiTariff,
            });
            const openTariff = () => onSelectTariff(tariff);

            return (
              <div
                key={tariff.id}
                className="tariff-picker-card apple-card-grad flex min-w-0 flex-col rounded-2xl bg-apple-card p-5 text-left"
              >
                <div className="tariff-picker-heading">
                  <h3 className="tariff-picker-name text-[17px] font-semibold text-apple-ink">
                    {tariff.name}
                  </h3>
                  {tariff.is_highlighted && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-apple-mute">
                      ★ {t('subscription.bestValue')}
                    </span>
                  )}
                  {isCurrentTariff && (
                    <div className="tariff-picker-current flex items-center gap-1.5 text-apple-green">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-apple-green"
                        aria-hidden="true"
                      />
                      <span>{t('subscription.currentTariff')}</span>
                    </div>
                  )}
                </div>
                {tariff.description && (
                  <div className="tariff-picker-description whitespace-pre-line text-[13px] text-apple-mute">
                    {tariff.description}
                  </div>
                )}
                <div className="tariff-picker-features text-[13px]">
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="#F97315"
                      strokeWidth={1.7}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                    <span className="font-medium text-apple-ink">{tariff.traffic_limit_label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-apple-mute">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.7}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                      />
                    </svg>
                    <span>
                      {tariff.device_limit === 0
                        ? '∞'
                        : t('subscription.devices', { count: tariff.device_limit })}
                    </span>
                  </div>
                  {tariff.traffic_reset_mode && tariff.traffic_reset_mode !== 'NO_RESET' && (
                    <div className="flex items-center gap-1.5 text-apple-mute">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182"
                        />
                      </svg>
                      <span>{t(`subscription.trafficReset.${tariff.traffic_reset_mode}`)}</span>
                    </div>
                  )}
                </div>
                {/* Price info */}
                <div className="tariff-picker-footer">
                  <div className="border-t border-apple-hairline pt-3 text-[13px] text-apple-mute">
                    {(() => {
                      const promoDaily = dailyPriceQuote(tariff, applyPromoDiscount);
                      if (promoDaily) {
                        return (
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className="tariff-picker-price-value text-[15px] font-semibold"
                              style={{ color: '#F97315' }}
                            >
                              {formatPrice(promoDaily.price)}
                            </span>
                            {promoDaily.original && promoDaily.original > promoDaily.price && (
                              <span className="text-xs text-apple-faint line-through">
                                {formatPrice(promoDaily.original)}
                              </span>
                            )}
                            <span>{t('subscription.tariff.perDay')}</span>
                            {promoDaily.percent && promoDaily.percent > 0 && (
                              <span className="rounded-md bg-apple-green/15 px-1.5 py-0.5 text-xs font-medium text-apple-green">
                                -{promoDaily.percent}%
                              </span>
                            )}
                          </span>
                        );
                      }
                      if (tariff.periods.length > 0) {
                        const firstPeriod = tariff.periods[0];
                        const promoPeriod = applyPromoDiscount(
                          firstPeriod?.price_kopeks || 0,
                          firstPeriod?.original_price_kopeks,
                        );
                        return (
                          <span className="flex flex-wrap items-center gap-2">
                            <span>{t('subscription.from')}</span>
                            <span
                              className="tariff-picker-price-value text-[15px] font-semibold"
                              style={{ color: '#F97315' }}
                            >
                              {formatPrice(promoPeriod.price)}
                            </span>
                            {promoPeriod.original && promoPeriod.original > promoPeriod.price && (
                              <span className="text-xs text-apple-faint line-through">
                                {formatPrice(promoPeriod.original)}
                              </span>
                            )}
                            {promoPeriod.percent && promoPeriod.percent > 0 && (
                              <span className="rounded-md bg-apple-green/15 px-1.5 py-0.5 text-xs font-medium text-apple-green">
                                -{promoPeriod.percent}%
                              </span>
                            )}
                          </span>
                        );
                      }
                      return (
                        <span
                          className="tariff-picker-price-value text-[15px] font-semibold"
                          style={{ color: '#F97315' }}
                        >
                          {t('subscription.tariff.flexiblePayment')}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Action Button */}
                  <div className="tariff-picker-actions mt-4">
                    {action === 'current-daily' ? (
                      <div className="py-2 text-center text-sm text-apple-faint">
                        {t('subscription.currentTariff')}
                      </div>
                    ) : action === 'switch' ? (
                      <button
                        onClick={() => onSwitchTariff(tariff.id)}
                        className="w-full rounded-full bg-white py-3 text-[15px] font-medium text-black transition-opacity hover:opacity-90"
                      >
                        {t('subscription.switchTariff.switch')}
                      </button>
                    ) : (
                      <button
                        onClick={openTariff}
                        className="w-full rounded-full bg-[#F97315] py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
                      >
                        {t(TARIFF_ACTION_LABEL[action])}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
