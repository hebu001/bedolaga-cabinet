import { createPortal } from 'react-dom';
import { useModalFocus } from '../hooks/useModalFocus';
import { useEffect, useMemo, useRef, useState } from 'react';
import { integrationCapabilities } from '../config/integrationCapabilities';
import './SubscriptionPurchase.css';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { WebBackButton } from '../components/WebBackButton';
import { getLegacyGlassColors } from '../utils/glassTheme';
import { useTheme } from '../hooks/useTheme';
import type { Tariff, ClassicPurchaseOptions } from '../types';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import { SwitchTariffSheet } from '../components/subscription/sheets/SwitchTariffSheet';
import { TariffPurchaseForm } from '../components/subscription/purchase/TariffPurchaseForm';
import { needsTariff } from '../utils/legacySubscription';
import { TariffPickerGrid } from '../components/subscription/purchase/TariffPickerGrid';
import { TariffPickerLite } from '../components/subscription/purchase/TariffPickerLite';
import { useLiteMode } from '../hooks/useLiteMode';
import { ClassicPurchaseWizard } from '../components/subscription/purchase/ClassicPurchaseWizard';
import { ExclamationIcon, SparklesIcon } from '@/components/icons';

export default function SubscriptionPurchase() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const subscriptionId = searchParams.get('subscriptionId')
    ? parseInt(searchParams.get('subscriptionId')!, 10)
    : undefined;
  const { isDark } = useTheme();
  const g = getLegacyGlassColors(isDark);
  // Витрина тарифов в двух видах. Обработчики и данные общие, различается
  // только подача; что делает нажатие — решает tariffAction() внутри обеих.
  const { lite } = useLiteMode();
  const TariffPicker = lite ? TariffPickerLite : TariffPickerGrid;

  // Subscription query (shares cache with /subscription page)
  const { data: subscriptionResponse, isLoading } = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: () => subscriptionApi.getSubscription(subscriptionId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // Purchase options
  const {
    data: purchaseOptions,
    isLoading: optionsLoading,
    isFetching: optionsFetching,
    isError: optionsError,
    refetch: refetchOptions,
  } = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Sales mode detection
  const isTariffsMode = purchaseOptions?.sales_mode === 'tariffs';
  const classicOptions = !isTariffsMode ? (purchaseOptions as ClassicPurchaseOptions) : null;
  const tariffs = useMemo(
    () =>
      isTariffsMode && purchaseOptions && 'tariffs' in purchaseOptions
        ? purchaseOptions.tariffs
        : [],
    [isTariffsMode, purchaseOptions],
  );

  // Multi-tariff: check via subscriptions list query
  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariff = multiSubData?.multi_tariff_enabled ?? false;

  // (active promo discount + applyPromoDiscount live in usePromoDiscount;
  //  consumed directly by the sub-components, not threaded as props)

  // (classic-mode state moved into <ClassicPurchaseWizard>)

  // Tariffs mode state
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [showTariffPurchase, setShowTariffPurchase] = useState(false);
  // (selectedTariffPeriod / customDays / customTrafficGb / useCustomDays /
  //  useCustomTraffic moved into <TariffPurchaseForm>; form remounts with
  //  fresh state via key=tariff.id when the parent picks a new tariff)

  // (tariffPurchaseRef moved into <TariffPurchaseForm>; switch-modal ref
  //  moved into <SwitchTariffSheet>)

  const [showTariffListModal, setShowTariffListModal] = useState(false);
  const tariffListRef = useRef<HTMLDivElement>(null);
  useModalFocus(showTariffListModal, tariffListRef, () => setShowTariffListModal(false));

  // Tariff switch
  const [switchTariffId, setSwitchTariffId] = useState<number | null>(null);

  const renewIntent = searchParams.get('renew') === '1';
  const didAutoOpenRenew = useRef(false);
  useEffect(() => {
    if (!renewIntent || didAutoOpenRenew.current || !subscription || !tariffs.length) return;
    const current = tariffs.find(
      (tariff) => tariff.id === subscription.tariff_id || tariff.is_current,
    );
    if (!current) return;
    didAutoOpenRenew.current = true;
    setSelectedTariff(current);
    setShowTariffPurchase(true);
  }, [renewIntent, subscription, tariffs]);
  useEffect(() => {
    if (!selectedTariff) return;
    const current = tariffs.find((tariff) => tariff.id === selectedTariff.id);
    if (current && current !== selectedTariff) setSelectedTariff(current);
  }, [tariffs, selectedTariff]);

  // Auto-close all modals on success notification
  const handleCloseAllModals = () => {
    // setShowPurchaseForm moved into <ClassicPurchaseWizard>'s own useCloseOnSuccessNotification
    setShowTariffPurchase(false);
    setShowTariffListModal(false);
    setSwitchTariffId(null);

    setSelectedTariff(null);
    // (selectedTariffPeriod lives inside <TariffPurchaseForm> now; unmount clears it)
  };
  useCloseOnSuccessNotification(handleCloseAllModals);

  // (switch preview query + switchTariffMutation moved into <SwitchTariffSheet>)

  // (tariffPurchaseMutation moved into <TariffPurchaseForm>)
  // (auto-scroll effects: switch-modal into <SwitchTariffSheet>,
  //  tariff-purchase into <TariffPurchaseForm>)

  // (classic-mode helpers moved into <ClassicPurchaseWizard>)

  if (isLoading || optionsLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
      </div>
    );
  }

  if (optionsError || (!purchaseOptions && !optionsLoading)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">{t('subscription.extend')}</h1>
        <div
          className="rounded-3xl p-6 text-center"
          style={{
            background: g.cardBg,
            border: `1px solid ${g.cardBorder}`,
          }}
        >
          <p className="mb-4 text-dark-300">
            {t('subscription.loadError', 'Не удалось загрузить варианты подписки')}
          </p>
          <button
            onClick={() => refetchOptions()}
            className="rounded-xl bg-apple-blue px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-apple-blue/90"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <WebBackButton
          to={subscriptionId ? `/subscriptions/${subscriptionId}` : '/subscriptions'}
        />
        <h1 className="text-2xl font-bold tracking-tight text-apple-ink sm:text-3xl">
          {t('subscription.purchaseTitle', 'Покупка подписки')}
        </h1>
      </div>

      {/* Tariffs Section */}
      {isTariffsMode && tariffs.length > 0 && (
        <div className="space-y-3">
          {/* Trial upgrade prompt — hidden when expired banner is active */}
          {subscription?.is_trial &&
            !(
              isTariffsMode &&
              purchaseOptions &&
              'subscription_is_expired' in purchaseOptions &&
              purchaseOptions.subscription_is_expired
            ) && (
              <div
                className="apple-card-grad rounded-2xl bg-apple-card p-4"
                style={{
                  border: '1px solid rgba(255,159,10,0.15)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                    style={{
                      background: 'rgba(255,159,10,0.12)',
                      color: 'rgb(var(--color-apple-amber))',
                    }}
                  >
                    <SparklesIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: 'rgb(var(--color-apple-amber))' }}
                    >
                      {t('subscription.trialUpgrade.title')}
                    </div>
                    <div className="mt-1 text-[13px] text-apple-mute">
                      {t('subscription.trialUpgrade.description')}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Expired subscription notice */}
          {isTariffsMode &&
            purchaseOptions &&
            'subscription_is_expired' in purchaseOptions &&
            purchaseOptions.subscription_is_expired && (
              <div
                className="apple-card-grad rounded-2xl bg-apple-card p-4"
                style={{
                  border: '1px solid rgba(255,69,58,0.15)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                    style={{
                      background: 'rgba(255,69,58,0.12)',
                      color: 'rgb(var(--color-apple-red))',
                    }}
                  >
                    <ExclamationIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: 'rgb(var(--color-apple-red))' }}
                    >
                      {t('subscription.expiredBanner.title')}
                    </div>
                    <div className="mt-1 text-[13px] text-apple-mute">
                      {t('subscription.expiredBanner.selectTariff')}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Старая подписка (куплена в классике, тарифа нет): тариф надевается на неё же */}
          {needsTariff(subscription) && (
            <div className="mb-6 rounded-xl border border-apple-blue/30 bg-apple-blue/10 p-4">
              <div className="mb-2 font-medium text-apple-ink">
                {t('subscription.legacy.selectTariffTitle')}
              </div>
              <div className="text-sm text-dark-300">
                {t('subscription.legacy.selectTariffDescription')}
              </div>
              <div className="mt-2 text-xs text-dark-500">
                {t('subscription.legacy.currentSubContinues')}
              </div>
            </div>
          )}

          {/* Switch Tariff Preview Modal */}
          <SwitchTariffSheet
            open={switchTariffId !== null}
            tariffId={switchTariffId}
            subscriptionId={subscriptionId}
            tariffs={tariffs}
            onClose={() => setSwitchTariffId(null)}
            onExpiredFallback={(tariff) => {
              setSelectedTariff(tariff);
              setShowTariffPurchase(true);
            }}
          />

          {!showTariffPurchase ? (
            <TariffPicker
              tariffs={tariffs}
              subscription={subscription}
              purchaseOptions={purchaseOptions}
              isTariffsMode={isTariffsMode}
              isMultiTariff={isMultiTariff}
              onSelectTariff={(tariff) => {
                setSelectedTariff(tariff);
                setShowTariffPurchase(true);
              }}
              onSwitchTariff={(tariffId) => setSwitchTariffId(tariffId)}
            />
          ) : (
            selectedTariff && (
              /* Tariff Purchase Form (extracted into its own component) */
              <TariffPurchaseForm
                key={selectedTariff.id}
                tariff={selectedTariff}
                subscriptionId={subscriptionId}
                balanceKopeks={purchaseOptions?.balance_kopeks}
                pricingReady={
                  !optionsFetching &&
                  !optionsError &&
                  tariffs.some((tariff) => tariff.id === selectedTariff.id)
                }
                sbpPurchaseEnabled={
                  integrationCapabilities.recurringPayments &&
                  isTariffsMode &&
                  purchaseOptions !== undefined &&
                  'platega_recurrent_enabled' in purchaseOptions &&
                  purchaseOptions.platega_recurrent_enabled === true
                }
                lavaPurchaseEnabled={
                  integrationCapabilities.recurringPayments &&
                  isTariffsMode &&
                  purchaseOptions !== undefined &&
                  'lava_recurrent_enabled' in purchaseOptions &&
                  purchaseOptions.lava_recurrent_enabled === true
                }
                onBack={() => setShowTariffListModal(true)}
              />
            )
          )}
        </div>
      )}

      {showTariffListModal &&
        createPortal(
          <div
            className="legacy-apple tariff-picker-overlay apple-sheet-backdrop fixed inset-0 z-[100] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setShowTariffListModal(false)}
          >
            <div
              ref={tariffListRef}
              role="dialog"
              aria-modal="true"
              aria-label={t('subscription.purchaseTitle')}
              tabIndex={-1}
              className="tariff-picker-dialog apple-card-grad apple-sheet-panel relative m-2.5 w-full max-w-md rounded-[32px] bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tariff-picker-header">
                <h2 className="min-w-0 text-[22px] font-semibold leading-tight text-white">
                  {t('subscription.purchaseTitle', 'Покупка подписки')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowTariffListModal(false)}
                  aria-label={t('common.close', 'Закрыть')}
                  className="tariff-picker-close flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97315]"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="tariff-picker-body">
                <TariffPicker
                  tariffs={tariffs}
                  subscription={subscription}
                  purchaseOptions={purchaseOptions}
                  isTariffsMode={isTariffsMode}
                  isMultiTariff={isMultiTariff}
                  onSelectTariff={(tariff) => {
                    setSelectedTariff(tariff);
                    setShowTariffPurchase(true);
                    setShowTariffListModal(false);
                  }}
                  onSwitchTariff={(id) => {
                    setSwitchTariffId(id);
                    setShowTariffListModal(false);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Purchase/Extend Section - Classic Mode */}
      {classicOptions && classicOptions.periods.length > 0 && (
        <ClassicPurchaseWizard
          classicOptions={classicOptions}
          subscription={subscription}
          subscriptionId={subscriptionId}
        />
      )}

      {/* No options available fallback */}
      {purchaseOptions &&
        !optionsLoading &&
        !(isTariffsMode && tariffs.length > 0) &&
        !(classicOptions && classicOptions.periods.length > 0) && (
          <div
            className="rounded-3xl p-6 text-center"
            style={{
              background: g.cardBg,
              border: `1px solid ${g.cardBorder}`,
            }}
          >
            <p className="mb-4 text-dark-300">
              {t('subscription.noOptionsAvailable', 'Нет доступных вариантов подписки')}
            </p>
            <button
              onClick={() => refetchOptions()}
              className="rounded-xl bg-apple-blue px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-apple-blue/90"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
    </div>
  );
}
