import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { AxiosError } from 'axios';
import { subscriptionApi } from '../api/subscription';
import { balanceApi } from '../api/balance';
import { promoApi } from '../api/promo';

import type {
  PurchaseSelection,
  PeriodOption,
  Tariff,
  TariffPeriod,
  ClassicPurchaseOptions,
  PaymentMethod,
} from '../types';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import { useCurrency } from '../hooks/useCurrency';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import { useHapticFeedback } from '../platform/hooks/useHaptic';
import { CheckIcon } from '../components/icons';
import {
  getErrorMessage,
  getInsufficientBalanceError,
  type PurchaseStep,
} from '../utils/subscriptionHelpers';
import {
  savePurchaseIntent,
  loadPurchaseIntent,
  clearPurchaseIntent,
} from '../utils/purchaseIntentStorage';
import { saveTopUpPendingInfo } from '../utils/topUpStorage';

export default function SubscriptionPurchase() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { formatAmount, currencySymbol } = useCurrency();
  const haptic = useHapticFeedback();

  const autoMode = searchParams.get('auto') === '1';

  const formatPrice = (kopeks: number) => `${formatAmount(kopeks / 100)} ${currencySymbol}`;

  // Subscription query (shares cache with /subscription page)
  const { data: subscriptionResponse, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionApi.getSubscription,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // Purchase options
  const { data: purchaseOptions, isLoading: optionsLoading } = useQuery({
    queryKey: ['purchase-options'],
    queryFn: subscriptionApi.getPurchaseOptions,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Payment methods for direct payment
  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
    staleTime: 60000,
  });

  // Active promo discount
  const { data: activeDiscount } = useQuery({
    queryKey: ['active-discount'],
    queryFn: promoApi.getActiveDiscount,
    staleTime: 30000,
  });

  // Sales mode detection
  const isTariffsMode = purchaseOptions?.sales_mode === 'tariffs';
  const classicOptions = !isTariffsMode ? (purchaseOptions as ClassicPurchaseOptions) : null;
  const tariffs =
    isTariffsMode && purchaseOptions && 'tariffs' in purchaseOptions ? purchaseOptions.tariffs : [];

  // Helper to apply promo discount
  const applyPromoDiscount = (
    priceKopeks: number,
    existingOriginalPrice?: number | null,
  ): {
    price: number;
    original: number | null;
    percent: number | null;
    isPromoGroup: boolean;
  } => {
    const hasExisting = (existingOriginalPrice ?? 0) > priceKopeks;
    const hasPromo = !!activeDiscount?.is_active && !!activeDiscount.discount_percent;

    if (!hasExisting && !hasPromo) {
      return { price: priceKopeks, original: null, percent: null, isPromoGroup: false };
    }

    let finalPrice = priceKopeks;
    if (hasPromo) {
      finalPrice = Math.round(priceKopeks * (1 - activeDiscount!.discount_percent! / 100));
    }

    if (hasExisting) {
      const combinedPercent = hasPromo
        ? Math.round((1 - finalPrice / existingOriginalPrice!) * 100)
        : Math.round((1 - priceKopeks / existingOriginalPrice!) * 100);
      return {
        price: finalPrice,
        original: existingOriginalPrice!,
        percent: combinedPercent,
        isPromoGroup: true,
      };
    }

    return {
      price: finalPrice,
      original: priceKopeks,
      percent: activeDiscount!.discount_percent!,
      isPromoGroup: false,
    };
  };

  // Classic mode state
  const [currentStep, setCurrentStep] = useState<PurchaseStep>('period');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(null);
  const [selectedTraffic, setSelectedTraffic] = useState<number | null>(null);
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<number>(1);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);

  // Tariffs mode state
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [selectedTariffPeriod, setSelectedTariffPeriod] = useState<TariffPeriod | null>(null);
  const [showTariffPurchase, setShowTariffPurchase] = useState(false);
  const [customDays, setCustomDays] = useState<number>(30);
  const [customTrafficGb, setCustomTrafficGb] = useState<number>(50);
  const [useCustomDays, setUseCustomDays] = useState(false);
  const [useCustomTraffic, setUseCustomTraffic] = useState(false);

  // Direct payment state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<string | null>(null);
  const [isDirectPaying, setIsDirectPaying] = useState(false);
  const [directPayError, setDirectPayError] = useState<string | null>(null);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const autoProcessedRef = useRef(false);
  // Swipe-left to go back (must be before early returns per Rules of Hooks)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0));
    if (dx > 80 && dy < 80) navigate(-1);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Auto-select first payment method
  useEffect(() => {
    if (paymentMethods && paymentMethods.length > 0 && !selectedPaymentMethod) {
      const first = paymentMethods.find((m) => m.is_available);
      if (first) {
        setSelectedPaymentMethod(first.id);
        setSelectedPaymentOption(first.options?.[0]?.id ?? null);
      }
    }
  }, [paymentMethods, selectedPaymentMethod]);

  // Refs for auto-scroll
  const switchModalRef = useRef<HTMLDivElement>(null);
  const tariffPurchaseRef = useRef<HTMLDivElement>(null);

  // Tariff switch
  const [switchTariffId, setSwitchTariffId] = useState<number | null>(null);

  // Auto-close all modals on success notification
  const handleCloseAllModals = () => {
    setShowPurchaseForm(false);
    setShowTariffPurchase(false);
    setSwitchTariffId(null);

    setSelectedTariff(null);
    setSelectedTariffPeriod(null);
  };
  useCloseOnSuccessNotification(handleCloseAllModals);

  // Get available servers
  const getAvailableServers = useCallback(
    (period: PeriodOption | null) => {
      if (!period?.servers.options) return [];
      return period.servers.options.filter((server) => {
        if (!server.is_available) return false;
        if (subscription?.is_trial && server.name.toLowerCase().includes('trial')) return false;
        return true;
      });
    },
    [subscription?.is_trial],
  );

  // Steps for classic mode
  const steps = useMemo<PurchaseStep[]>(() => {
    const result: PurchaseStep[] = ['period'];
    if (selectedPeriod?.traffic.selectable && (selectedPeriod.traffic.options?.length ?? 0) > 0) {
      result.push('traffic');
    }
    const availableServers = getAvailableServers(selectedPeriod);
    if (availableServers.length > 1) {
      result.push('servers');
    }
    if (selectedPeriod && selectedPeriod.devices.max > selectedPeriod.devices.min) {
      result.push('devices');
    }
    result.push('confirm');
    return result;
  }, [selectedPeriod, getAvailableServers]);

  const currentStepIndex = steps.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Initialize classic mode selection
  useEffect(() => {
    if (classicOptions && !selectedPeriod) {
      const defaultPeriod =
        classicOptions.periods.find((p) => p.id === classicOptions.selection.period_id) ||
        classicOptions.periods[0];
      setSelectedPeriod(defaultPeriod);
      setSelectedTraffic(classicOptions.selection.traffic_value);
      const availableServers = getAvailableServers(defaultPeriod);
      const availableServerUuids = new Set(availableServers.map((s) => s.uuid));
      if (availableServers.length === 1) {
        setSelectedServers([availableServers[0].uuid]);
      } else {
        setSelectedServers(
          classicOptions.selection.servers.filter((uuid) => availableServerUuids.has(uuid)),
        );
      }
      setSelectedDevices(classicOptions.selection.devices);
    }
  }, [classicOptions, selectedPeriod, getAvailableServers]);

  // Build classic mode selection
  const currentSelection: PurchaseSelection = useMemo(
    () => ({
      period_id: selectedPeriod?.id,
      period_days: selectedPeriod?.period_days,
      traffic_value: selectedTraffic ?? undefined,
      servers: selectedServers,
      devices: selectedDevices,
    }),
    [selectedPeriod, selectedTraffic, selectedServers, selectedDevices],
  );

  // Preview query (classic)
  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['purchase-preview', currentSelection],
    queryFn: () => subscriptionApi.previewPurchase(currentSelection),
    enabled: !!selectedPeriod && showPurchaseForm && currentStep === 'confirm',
  });

  // Classic purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.submitPurchase(currentSelection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      navigate('/subscription', { replace: true });
    },
  });

  // Switch preview query
  const { data: switchPreview, isLoading: switchPreviewLoading } = useQuery({
    queryKey: ['tariff-switch-preview', switchTariffId],
    queryFn: () => subscriptionApi.previewTariffSwitch(switchTariffId!),
    enabled: !!switchTariffId,
  });

  // Tariff switch mutation
  const switchTariffMutation = useMutation({
    mutationFn: (tariffId: number) => subscriptionApi.switchTariff(tariffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      setSwitchTariffId(null);

      navigate('/subscription', { replace: true });
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        const detail = error.response?.data?.detail;
        if (
          typeof detail === 'object' &&
          detail?.error_code === 'subscription_expired' &&
          detail?.use_purchase_flow === true
        ) {
          const targetTariff = tariffs.find((tariff) => tariff.id === switchTariffId);
          if (targetTariff) {
            setSwitchTariffId(null);

            setSelectedTariff(targetTariff);
            setSelectedTariffPeriod(targetTariff.periods[0] || null);
            setShowTariffPurchase(true);
            queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
          }
        }
      }
    },
  });

  // Tariff purchase mutation
  const tariffPurchaseMutation = useMutation({
    mutationFn: () => {
      if (!selectedTariff) {
        throw new Error('Tariff not selected');
      }
      const isDailyTariff =
        selectedTariff.is_daily ||
        (selectedTariff.daily_price_kopeks && selectedTariff.daily_price_kopeks > 0);
      const days = isDailyTariff
        ? 1
        : useCustomDays
          ? customDays
          : selectedTariffPeriod?.days || 30;
      const trafficGb =
        useCustomTraffic && selectedTariff.custom_traffic_enabled ? customTrafficGb : undefined;
      return subscriptionApi.purchaseTariff(selectedTariff.id, days, trafficGb);
    },
    onSuccess: () => {
      clearPurchaseIntent();
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      navigate('/subscription', { replace: true });
    },
  });

  // Direct payment handler: create top-up for exact missing amount and redirect
  const handleDirectPay = async (missingKopeks: number, tariffId: number, tariffName: string, periodDays: number, totalPriceKopeks: number, trafficGb?: number) => {
    if (!selectedPaymentMethod || isDirectPaying) return;
    setIsDirectPaying(true);
    setDirectPayError(null);

    try {
      // Save purchase intent before redirecting
      savePurchaseIntent({
        tariff_id: tariffId,
        tariff_name: tariffName,
        period_days: periodDays,
        traffic_gb: trafficGb,
        total_price_kopeks: totalPriceKopeks,
        created_at: Date.now(),
      });

      // Create top-up for the missing amount
      const topUpAmount = Math.max(missingKopeks, 100); // Minimum 1 ruble
      const result = await balanceApi.createTopUp(
        topUpAmount,
        selectedPaymentMethod,
        selectedPaymentOption ?? undefined,
      );

      // Save top-up info for TopUpResult polling
      saveTopUpPendingInfo({
        amount_kopeks: result.amount_kopeks,
        method_id: selectedPaymentMethod,
        method_name: selectedPaymentMethod,
        payment_id: result.payment_id,
        created_at: Date.now(),
      });

      // Redirect to payment
      window.location.href = result.payment_url;
    } catch (err) {
      clearPurchaseIntent();
      const msg = err instanceof AxiosError
        ? err.response?.data?.detail?.message || err.response?.data?.detail || t('subscription.directPayError', 'Payment error. Please try again.')
        : t('subscription.directPayError', 'Payment error. Please try again.');
      setDirectPayError(typeof msg === 'string' ? msg : t('subscription.directPayError', 'Payment error. Please try again.'));
      setIsDirectPaying(false);
    }
  };

  // Available payment methods filtered by amount
  const getAvailablePaymentMethods = useCallback((amountKopeks: number): PaymentMethod[] => {
    if (!paymentMethods) return [];
    return paymentMethods.filter(
      (m) => m.is_available && amountKopeks >= m.min_amount_kopeks && amountKopeks <= m.max_amount_kopeks,
    );
  }, [paymentMethods]);

  // Auto-purchase on return from payment (when ?auto=1)
  useEffect(() => {
    if (!autoMode || autoProcessedRef.current || !purchaseOptions) return;
    const intent = loadPurchaseIntent();
    if (!intent) return;

    const balance = purchaseOptions.balance_kopeks;
    if (balance >= intent.total_price_kopeks) {
      autoProcessedRef.current = true;
      clearPurchaseIntent();

      // Find the tariff and set state, then trigger purchase
      if (isTariffsMode && tariffs.length > 0) {
        const tariff = tariffs.find((t) => t.id === intent.tariff_id);
        if (tariff) {
          // Directly call purchaseTariff
          subscriptionApi
            .purchaseTariff(intent.tariff_id, intent.period_days, intent.traffic_gb)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['subscription'] });
              queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
              navigate('/subscription', { replace: true });
            })
            .catch(() => {
              // If auto-purchase fails, navigate normally
              navigate('/subscription/purchase', { replace: true });
            });
        }
      }
    }
  }, [autoMode, purchaseOptions, isTariffsMode, tariffs, queryClient, navigate]);

  // Auto-scroll effects
  useEffect(() => {
    if (switchTariffId && switchModalRef.current) {
      const timer = setTimeout(() => {
        switchModalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [switchTariffId]);

  useEffect(() => {
    if (showTariffPurchase && tariffPurchaseRef.current) {
      const timer = setTimeout(() => {
        tariffPurchaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showTariffPurchase]);

  // Classic mode helpers
  const toggleServer = (uuid: string) => {
    if (selectedServers.includes(uuid)) {
      if (selectedServers.length > 1) {
        setSelectedServers(selectedServers.filter((s) => s !== uuid));
      }
    } else {
      setSelectedServers([...selectedServers, uuid]);
    }
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const resetPurchase = () => {
    setShowPurchaseForm(false);
    setCurrentStep('period');
  };

  const getStepLabel = (step: PurchaseStep) => {
    switch (step) {
      case 'period':
        return t('subscription.stepPeriod');
      case 'traffic':
        return t('subscription.stepTraffic');
      case 'servers':
        return t('subscription.stepServers');
      case 'devices':
        return t('subscription.stepDevices');
      case 'confirm':
        return t('subscription.stepConfirm');
    }
  };

  if (isLoading || optionsLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Tariffs Section */}
      {isTariffsMode && tariffs.length > 0 && (
        <div>

          {/* Switch Tariff Preview Modal */}
          {switchTariffId && (
            <div ref={switchModalRef} className="dark-glass mb-6 space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-dark-100">
                  {t('subscription.switchTariff.title')}
                </h3>
                <button
                  onClick={() => setSwitchTariffId(null)}
                  className="text-sm text-dark-400 hover:text-dark-200"
                >
                  ✕
                </button>
              </div>

              {switchPreviewLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                </div>
              ) : (
                switchPreview &&
                (() => {
                  const targetTariff = tariffs.find((tariff) => tariff.id === switchTariffId);
                  const dailyPrice =
                    targetTariff?.daily_price_kopeks ?? targetTariff?.price_per_day_kopeks ?? 0;
                  const isDailyTariff = dailyPrice > 0;

                  return (
                    <>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-dark-300">
                          <span>{t('subscription.switchTariff.currentTariff')}</span>
                          <span className="font-medium text-dark-100">
                            {switchPreview.current_tariff_name || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between text-dark-300">
                          <span>{t('subscription.switchTariff.newTariff')}</span>
                          <span className="font-medium text-accent-400">
                            {switchPreview.new_tariff_name}
                          </span>
                        </div>
                        <div className="flex justify-between text-dark-300">
                          <span>{t('subscription.switchTariff.remainingDays')}</span>
                          <span>{switchPreview.remaining_days}</span>
                        </div>
                      </div>

                      {isDailyTariff && (
                        <div className="rounded-lg border border-accent-500/30 bg-accent-500/10 p-3 text-center">
                          <div className="text-sm text-dark-300">
                            {t('subscription.switchTariff.dailyPayment')}
                          </div>
                          <div className="text-lg font-bold text-accent-400">
                            {formatPrice(dailyPrice)}
                          </div>
                          <div className="mt-1 text-xs text-dark-400">
                            {t('subscription.switchTariff.dailyChargeDescription')}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-dark-700/50 pt-3">
                        <div>
                          <span className="font-medium text-dark-100">
                            {t('subscription.switchTariff.upgradeCost')}
                          </span>
                          {switchPreview.discount_percent && switchPreview.discount_percent > 0 && (
                            <span className="ml-2 inline-block rounded-full bg-success-500/20 px-2 py-0.5 text-xs font-medium text-success-400">
                              -{switchPreview.discount_percent}%
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          {switchPreview.discount_percent &&
                            switchPreview.discount_percent > 0 &&
                            switchPreview.base_upgrade_cost_kopeks &&
                            switchPreview.base_upgrade_cost_kopeks > 0 && (
                              <span className="mr-2 text-sm text-dark-500 line-through">
                                {formatPrice(switchPreview.base_upgrade_cost_kopeks)}
                              </span>
                            )}
                          <span
                            className={`text-lg font-bold ${switchPreview.upgrade_cost_kopeks === 0 ? 'text-success-400' : 'text-accent-400'}`}
                          >
                            {switchPreview.upgrade_cost_kopeks > 0
                              ? switchPreview.upgrade_cost_label
                              : t('subscription.switchTariff.free')}
                          </span>
                        </div>
                      </div>

                      {!switchPreview.has_enough_balance &&
                        switchPreview.upgrade_cost_kopeks > 0 && (
                          <InsufficientBalancePrompt
                            missingAmountKopeks={switchPreview.missing_amount_kopeks}
                            compact
                          />
                        )}

                      <button
                        onClick={() => switchTariffMutation.mutate(switchTariffId)}
                        disabled={switchTariffMutation.isPending || !switchPreview.can_switch}
                        className="btn-primary w-full py-2.5"
                      >
                        {switchTariffMutation.isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          </span>
                        ) : (
                          t('subscription.switchTariff.switch')
                        )}
                      </button>

                      {switchTariffMutation.isError &&
                        (() => {
                          const detail =
                            switchTariffMutation.error instanceof AxiosError
                              ? switchTariffMutation.error.response?.data?.detail
                              : null;
                          if (
                            typeof detail === 'object' &&
                            detail?.error_code === 'subscription_expired'
                          ) {
                            return null;
                          }
                          return (
                            <div className="mt-3 text-center text-sm text-error-400">
                              {getErrorMessage(switchTariffMutation.error)}
                            </div>
                          );
                        })()}
                    </>
                  );
                })()
              )}
            </div>
          )}

          {!showTariffPurchase ? (
            <>
              {/* Back button */}
              <div className="flex w-full mb-4">
                <button
                  onClick={() => { haptic.buttonPressMedium(); navigate(-1); }}
                  className="dark-glass ml-auto flex items-center gap-2 px-5 py-3 text-sm font-medium text-dark-200 hover:text-white transition-all active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  {t('common.back')}
                </button>
              </div>
              {/* Promo group discount banner */}
              {tariffs.some((tariff) => tariff.promo_group_name) && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-success-500/30 bg-success-500/10 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/20 text-success-400">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-success-400">
                      {t('subscription.promoGroup.yourGroup', {
                        name: tariffs.find((tariff) => tariff.promo_group_name)?.promo_group_name,
                      })}
                    </div>
                    <div className="text-xs text-dark-400">
                      {t('subscription.promoGroup.personalDiscountsApplied')}
                    </div>
                  </div>
                </div>
              )}

              {/* Tariff Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[...tariffs]
                  .filter((tariff) => {
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
                    const isCurrentTariff =
                      tariff.is_current || tariff.id === subscription?.tariff_id;
                    const isSubscriptionExpired =
                      isTariffsMode &&
                      purchaseOptions &&
                      'subscription_is_expired' in purchaseOptions &&
                      purchaseOptions.subscription_is_expired === true;
                    const canSwitch =
                      subscription &&
                      subscription.tariff_id &&
                      !isCurrentTariff &&
                      !subscription.is_trial &&
                      !isSubscriptionExpired &&
                      subscription.is_active;
                    const isLegacySubscription =
                      subscription && !subscription.is_trial && !subscription.tariff_id;

                    return (
                      <div
                        key={tariff.id}
                        className={`dark-glass p-5 text-left ${
                          isCurrentTariff ? 'ring-2 ring-[var(--figma-green)]' : ''
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <div className="text-lg font-semibold text-white">{tariff.name}</div>
                            {tariff.description && (
                              <div className="mt-1 whitespace-pre-line text-sm text-dark-400">
                                {tariff.description}
                              </div>
                            )}
                          </div>
                          {isCurrentTariff && (
                            <span className="badge-success text-xs">
                              {t('subscription.currentTariff')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <svg
                              className="h-4 w-4 text-accent-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                              />
                            </svg>
                            <span className="font-medium text-dark-200">
                              {tariff.traffic_limit_label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg
                              className="h-4 w-4 text-dark-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                              />
                            </svg>
                            <span className="text-dark-300">
                              {tariff.device_limit === 0
                                ? '∞'
                                : t('subscription.devices', { count: tariff.device_limit })}
                            </span>
                          </div>
                          {tariff.traffic_reset_mode &&
                            tariff.traffic_reset_mode !== 'NO_RESET' && (
                              <div className="flex items-center gap-1.5">
                                <svg
                                  className="h-4 w-4 text-dark-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={1.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182"
                                  />
                                </svg>
                                <span className="text-dark-300">
                                  {t(`subscription.trafficReset.${tariff.traffic_reset_mode}`)}
                                </span>
                              </div>
                            )}
                        </div>
                        {/* Price info */}
                        <div className="mt-3 border-t border-white/10 pt-3 text-sm text-white/40">
                          {(() => {
                            const dailyPrice =
                              tariff.daily_price_kopeks ?? tariff.price_per_day_kopeks ?? 0;
                            const originalDailyPrice = tariff.original_daily_price_kopeks || 0;
                            if (dailyPrice > 0) {
                              const promoDaily = applyPromoDiscount(
                                dailyPrice,
                                originalDailyPrice > dailyPrice ? originalDailyPrice : undefined,
                              );
                              return (
                                <span className="flex items-center gap-2">
                                  <span className="font-medium text-accent-400">
                                    {formatPrice(promoDaily.price)}
                                  </span>
                                  {promoDaily.original &&
                                    promoDaily.original > promoDaily.price && (
                                      <span className="text-xs text-dark-500 line-through">
                                        {formatPrice(promoDaily.original)}
                                      </span>
                                    )}
                                  <span>{t('subscription.tariff.perDay')}</span>
                                  {promoDaily.percent && promoDaily.percent > 0 && (
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-xs ${
                                        promoDaily.isPromoGroup
                                          ? 'bg-success-500/20 text-success-400'
                                          : 'bg-orange-500/20 text-orange-400'
                                      }`}
                                    >
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
                                  <span className="font-medium text-accent-400">
                                    {formatPrice(promoPeriod.price)}
                                  </span>
                                  {promoPeriod.original &&
                                    promoPeriod.original > promoPeriod.price && (
                                      <span className="text-xs text-dark-500 line-through">
                                        {formatPrice(promoPeriod.original)}
                                      </span>
                                    )}
                                  {promoPeriod.percent && promoPeriod.percent > 0 && (
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-xs ${
                                        promoPeriod.isPromoGroup
                                          ? 'bg-success-500/20 text-success-400'
                                          : 'bg-orange-500/20 text-orange-400'
                                      }`}
                                    >
                                      -{promoPeriod.percent}%
                                    </span>
                                  )}
                                </span>
                              );
                            }
                            return (
                              <span className="font-medium text-accent-400">
                                {t('subscription.tariff.flexiblePayment')}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex gap-2">
                          {isCurrentTariff ? (
                            subscription?.is_daily ? (
                              <div className="flex-1 py-2 text-center text-sm text-dark-500">
                                {t('subscription.currentTariff')}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  haptic.buttonPressMedium();
                                  setSelectedTariff(tariff);
                                  setSelectedTariffPeriod(tariff.periods[0] || null);
                                  setShowTariffPurchase(true);
                                }}
                                className="w-full rounded-full py-2.5 text-sm font-medium text-white transition-all active:scale-[0.97] hover:opacity-90"
                                style={{ background: 'var(--figma-green)' }}
                              >
                                {t('subscription.extend')}
                              </button>
                            )
                          ) : isLegacySubscription ? (
                            <button
                              onClick={() => {
                                setSelectedTariff(tariff);
                                setSelectedTariffPeriod(tariff.periods[0] || null);
                                setShowTariffPurchase(true);
                              }}
                              className="w-full rounded-full py-2.5 text-sm font-medium text-white transition-all active:scale-[0.97] hover:opacity-90"
                              style={{ background: 'var(--figma-green)' }}
                            >
                              {t('subscription.tariff.selectForRenewal')}
                            </button>
                          ) : canSwitch ? (
                            <button
                              onClick={() => setSwitchTariffId(tariff.id)}
                              className="w-full rounded-full py-2.5 text-sm font-medium text-white/70 ring-1 ring-white/20 transition-all active:scale-[0.97] hover:ring-white/40 hover:text-white"
                            >
                              {t('subscription.switchTariff.switch')}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedTariff(tariff);
                                setSelectedTariffPeriod(tariff.periods[0] || null);
                                setShowTariffPurchase(true);
                              }}
                              className="w-full rounded-full py-2.5 text-sm font-medium text-white transition-all active:scale-[0.97] hover:opacity-90"
                              style={{ background: 'var(--figma-green)' }}
                            >
                              {t('subscription.purchase')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : (
            selectedTariff && (
              /* Tariff Purchase Form */
              <div ref={tariffPurchaseRef} className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-dark-100">{selectedTariff.name}</h3>
                  <button
                    onClick={() => {
                      haptic.buttonPressMedium();
                      setShowTariffPurchase(false);
                      setSelectedTariff(null);
                      setSelectedTariffPeriod(null);
                    }}
                    className="dark-glass ml-auto flex items-center gap-2 px-5 py-3 text-sm font-medium text-dark-200 hover:text-white transition-all active:scale-95"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    {t('common.back')}
                  </button>
                </div>

                {/* Tariff Info */}
                <div className="dark-glass p-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-dark-500">{t('subscription.traffic')}:</span>
                      <span className="ml-2 text-dark-200">
                        {selectedTariff.traffic_limit_label}
                      </span>
                    </div>
                    <div>
                      <span className="text-dark-500">{t('subscription.devices')}:</span>
                      <span className="ml-2 text-dark-200">
                        {selectedTariff.device_limit === 0 ? '∞' : selectedTariff.device_limit}
                        {selectedTariff.extra_devices_count > 0 && (
                          <span className="ml-1 text-xs text-accent-400">
                            (+{selectedTariff.extra_devices_count})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Daily Tariff Purchase */}
                {selectedTariff.is_daily ||
                (selectedTariff.daily_price_kopeks && selectedTariff.daily_price_kopeks > 0) ? (
                  <div className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-5">
                    <div className="mb-4 text-center">
                      <div className="mb-2 text-sm text-dark-400">
                        {t('subscription.dailyPurchase.costPerDay')}
                      </div>
                      <div className="text-3xl font-bold text-accent-400">
                        {formatPrice(selectedTariff.daily_price_kopeks || 0)}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-dark-400">
                      <div className="flex items-start gap-2">
                        <span className="text-accent-400">•</span>
                        <span>{t('subscription.dailyPurchase.chargedDaily')}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-accent-400">•</span>
                        <span>{t('subscription.dailyPurchase.canPause')}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-accent-400">•</span>
                        <span>{t('subscription.dailyPurchase.pausedOnLowBalance')}</span>
                      </div>
                    </div>

                    {(() => {
                      const dailyPrice = selectedTariff.daily_price_kopeks || 0;
                      const hasEnoughBalance =
                        purchaseOptions && dailyPrice <= purchaseOptions.balance_kopeks;
                      const missingAmount = purchaseOptions
                        ? dailyPrice - purchaseOptions.balance_kopeks
                        : dailyPrice;
                      const availableMethods = getAvailablePaymentMethods(missingAmount);

                      return (
                        <div className="mt-6">
                          {/* Balance info */}
                          {purchaseOptions && (
                            <div className={`mb-3 flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                              hasEnoughBalance
                                ? 'bg-success-500/10 border border-success-500/20'
                                : 'bg-dark-800/60 border border-dark-700/40'
                            }`}>
                              <div className="flex w-full justify-between">
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] uppercase tracking-wider text-dark-500">Ваш баланс</span>
                                    <span className={hasEnoughBalance ? 'font-semibold text-success-400' : 'font-semibold text-dark-200'}>
                                      {formatPrice(purchaseOptions.balance_kopeks)}
                                    </span>
                                </div>
                                {!hasEnoughBalance && missingAmount > 0 && (
                                    <div className="flex flex-col items-start">
                                      <span className="text-[10px] uppercase tracking-wider text-dark-500">Не хватает</span>
                                      <span className="font-semibold text-error-400">
                                        {formatPrice(missingAmount)}
                                      </span>
                                    </div>
                                )}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              haptic.buttonPressMedium();
                              if (hasEnoughBalance || !purchaseOptions || availableMethods.length === 0) {
                                tariffPurchaseMutation.mutate();
                              } else {
                                setShowPaymentSheet(true);
                              }
                            }}
                            disabled={tariffPurchaseMutation.isPending || isDirectPaying}
                            className="w-full rounded-full h-14 bg-[var(--figma-green)] text-white font-medium text-base flex items-center justify-center gap-3 transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-50"
                          >
                            {(tariffPurchaseMutation.isPending || isDirectPaying) ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                {t('common.loading')}
                              </span>
                            ) : (
                              <>
                                {t('subscription.paySubscription', 'Оплатить')}
                                {!hasEnoughBalance && missingAmount > 0
                                  ? <span className="text-white/90">{formatPrice(missingAmount)}</span>
                                  : <span className="text-white/90">{formatPrice(dailyPrice)}</span>}
                              </>
                            )}
                          </button>

                          {/* Payment Method Bottom Sheet for Daily */}
                          {showPaymentSheet && !hasEnoughBalance && availableMethods.length > 0 && (
                            <>
                              <div
                                className="fixed inset-0 bg-black/60 z-[999] animate-[backdropFadeIn_0.2s_ease-out]"
                                onClick={() => setShowPaymentSheet(false)}
                              />
                              <div className="fixed bottom-0 left-0 right-0 z-[1000] animate-[sheetSlideUp_0.3s_ease-out]">
                                <div className="bg-black mx-auto max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border-none text-white">
                                  <div className="flex items-center justify-between p-6 pb-0">
                                    <h3 className="text-lg font-medium text-white">
                                      {t('subscription.selectPaymentMethod', 'Способ оплаты')}
                                    </h3>
                                    <button
                                      onClick={() => setShowPaymentSheet(false)}
                                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                                      aria-label="Close"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="p-6 pt-4">
                                  <div className="space-y-2 mb-5">
                                    {availableMethods.map((method) => (
                                      <button
                                        key={method.id}
                                        onClick={() => {
                                          setSelectedPaymentMethod(method.id);
                                          setSelectedPaymentOption(method.options?.[0]?.id ?? null);
                                          setDirectPayError(null);
                                        }}
                                        className={`w-full rounded-2xl p-4 text-left text-sm transition-all bg-white/5 ${
                                          selectedPaymentMethod === method.id
                                            ? 'ring-2 ring-[var(--figma-green)]'
                                            : 'ring-1 ring-white/10 hover:bg-white/[0.07]'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3 font-medium text-white">
                                          <img src="/SBP.svg" alt="" className="h-[30px] w-[24px] flex-shrink-0" />
                                          {method.name}
                                        </div>
                                        {method.description && (
                                          <div className="mt-1 text-xs text-white/40">{method.description}</div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                  {selectedPaymentMethod && (
                                    <button
                                      onClick={() => {
                                        handleDirectPay(
                                          missingAmount,
                                          selectedTariff.id,
                                          selectedTariff.name,
                                          1,
                                          dailyPrice,
                                        );
                                        setShowPaymentSheet(false);
                                      }}
                                      disabled={isDirectPaying}
                                      className="w-full rounded-full h-14 bg-[var(--figma-green)] text-white font-medium text-base flex items-center justify-center transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-50"
                                    >
                                      {isDirectPaying ? (
                                        <span className="flex items-center justify-center gap-2">
                                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                          {t('common.loading')}
                                        </span>
                                      ) : (
                                        t('subscription.payAndActivate', 'Оплатить и активировать')
                                      )}
                                    </button>
                                  )}
                                   {directPayError && (
                                    <div className="mt-3 text-center text-sm text-error-400">{directPayError}</div>
                                  )}
                                  </div>{/* close p-6 pt-4 */}
                                </div>
                              </div>
                            </>
                          )}

                          {purchaseOptions && !hasEnoughBalance && availableMethods.length === 0 && (
                            <InsufficientBalancePrompt
                              missingAmountKopeks={missingAmount}
                              compact
                              className="mt-4"
                            />
                          )}

                          {tariffPurchaseMutation.isError &&
                            !getInsufficientBalanceError(tariffPurchaseMutation.error) && (
                              <div className="mt-3 text-center text-sm text-error-400">
                                {getErrorMessage(tariffPurchaseMutation.error)}
                              </div>
                            )}
                          {tariffPurchaseMutation.isError &&
                            getInsufficientBalanceError(tariffPurchaseMutation.error) && (
                              <div className="mt-3 text-center text-sm text-error-400">
                                {t('subscription.directPayError', 'Payment error. Please try again.')}
                              </div>
                            )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    {/* Period Selection for non-daily tariffs */}
                    <div>
                      <div className="mb-3 text-sm text-dark-400">
                        {t('subscription.selectPeriod')}
                      </div>

                      {selectedTariff.periods.length > 0 && !useCustomDays && (
                        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {selectedTariff.periods.map((period) => {
                            const promoPeriod = applyPromoDiscount(
                              period.price_kopeks,
                              period.original_price_kopeks,
                            );
                            const displayDiscount = promoPeriod.percent;
                            const displayOriginal = promoPeriod.original;
                            const displayPrice = promoPeriod.price;
                            const displayPerMonth =
                              displayPrice !== period.price_kopeks
                                ? Math.round(displayPrice / Math.max(1, period.days / 30))
                                : period.price_per_month_kopeks;

                            return (
                              <button
                                key={period.days}
                                  onClick={(e) => {
                                    haptic.buttonPressMedium();
                                    setSelectedTariffPeriod(period);
                                    setUseCustomDays(false);
                                    // Ripple effect
                                    const btn = e.currentTarget;
                                    const ripple = document.createElement('span');
                                    const rect = btn.getBoundingClientRect();
                                    const size = Math.max(rect.width, rect.height) * 2;
                                    ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.15);width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;transform:scale(0);animation:ripple-wave 0.5s ease-out forwards;pointer-events:none;z-index:0;`;
                                    btn.appendChild(ripple);
                                    setTimeout(() => ripple.remove(), 600);
                                  }}
                                className={`dark-glass-subtle p-4 text-left active:scale-[0.97] ${
                                  selectedTariffPeriod?.days === period.days && !useCustomDays
                                    ? 'ring-2 ring-[var(--figma-green)]'
                                    : ''
                                }`}
                                style={
                                  selectedTariffPeriod?.days === period.days && !useCustomDays
                                    ? { background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)' }
                                    : undefined
                                }
                              >
                                {displayDiscount && displayDiscount > 0 && (
                                  <div
                                    className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                                      promoPeriod.isPromoGroup ? 'bg-success-500' : 'bg-orange-500'
                                    }`}
                                  >
                                    -{displayDiscount}%
                                  </div>
                                )}
                                <div className="flex w-full justify-between items-center text-white text-base mb-auto">
                                  {period.label}
                                </div>
                                <div className="flex flex-col text-2xl font-medium leading-6 tracking-tight text-white">
                                  <span className="font-medium text-accent-400">
                                    {formatPrice(displayPrice)}
                                  </span>
                                  {displayOriginal && displayOriginal > displayPrice && (
                                    <span className="text-sm text-dark-500 line-through">
                                      {formatPrice(displayOriginal)}
                                    </span>
                                  )}
                                </div>
                                <small className="text-xs text-white/40 tracking-normal font-normal">
                                  {formatPrice(displayPerMonth)}/{t('subscription.month')}
                                </small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* No periods available fallback */}
                      {selectedTariff.periods.length === 0 &&
                        !useCustomDays &&
                        !(
                          selectedTariff.custom_days_enabled &&
                          (selectedTariff.price_per_day_kopeks ?? 0) > 0
                        ) && (
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                            <div className="mb-2 text-sm font-medium text-amber-400">
                              {t('subscription.noPeriodsAvailable')}
                            </div>
                            <div className="text-xs text-dark-400">
                              {t('subscription.noPeriodsAvailableHint')}
                            </div>
                            <button
                              onClick={() => {
                                setShowTariffPurchase(false);
                                setSelectedTariff(null);
                                setSelectedTariffPeriod(null);
                              }}
                              className="btn-secondary mt-3 px-4 py-2 text-sm"
                            >
                              {t('subscription.chooseDifferentTariff')}
                            </button>
                          </div>
                        )}

                      {/* Custom days option */}
                      {selectedTariff.custom_days_enabled &&
                        (selectedTariff.price_per_day_kopeks ?? 0) > 0 && (
                          <div className="dark-glass p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="font-medium text-dark-200">
                                {t('subscription.customDays.title')}
                              </span>
                              <button
                                type="button"
                                onClick={() => setUseCustomDays(!useCustomDays)}
                                className={`relative h-6 w-10 rounded-full transition-colors ${
                                  useCustomDays ? 'bg-accent-500' : 'bg-dark-600'
                                }`}
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
                                    min={selectedTariff.min_days ?? 1}
                                    max={selectedTariff.max_days ?? 365}
                                    value={customDays}
                                    onChange={(e) => setCustomDays(parseInt(e.target.value))}
                                    className="flex-1 accent-accent-500"
                                  />
                                  <input
                                    type="number"
                                    value={customDays}
                                    min={selectedTariff.min_days ?? 1}
                                    max={selectedTariff.max_days ?? 365}
                                    onChange={(e) =>
                                      setCustomDays(
                                        Math.max(
                                          selectedTariff.min_days ?? 1,
                                          Math.min(
                                            selectedTariff.max_days ?? 365,
                                            parseInt(e.target.value) ||
                                              (selectedTariff.min_days ?? 1),
                                          ),
                                        ),
                                      )
                                    }
                                    className="w-20 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-center text-dark-100"
                                  />
                                </div>
                                {(() => {
                                  const basePrice =
                                    customDays * (selectedTariff.price_per_day_kopeks ?? 0);
                                  const existingOriginal =
                                    selectedTariff.original_price_per_day_kopeks &&
                                    selectedTariff.original_price_per_day_kopeks >
                                      (selectedTariff.price_per_day_kopeks ?? 0)
                                      ? customDays * selectedTariff.original_price_per_day_kopeks
                                      : undefined;
                                  const promoCustom = applyPromoDiscount(
                                    basePrice,
                                    existingOriginal,
                                  );
                                  return (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-dark-400">
                                        {t('subscription.days', { count: customDays })} ×{' '}
                                        {formatPrice(selectedTariff.price_per_day_kopeks ?? 0)}/
                                        {t('subscription.customDays.perDay')}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-accent-400">
                                          {formatPrice(promoCustom.price)}
                                        </span>
                                        {promoCustom.original &&
                                          promoCustom.original > promoCustom.price && (
                                            <>
                                              <span className="text-xs text-dark-500 line-through">
                                                {formatPrice(promoCustom.original)}
                                              </span>
                                              <span
                                                className={`rounded px-1.5 py-0.5 text-xs ${
                                                  promoCustom.isPromoGroup
                                                    ? 'bg-success-500/20 text-success-400'
                                                    : 'bg-orange-500/20 text-orange-400'
                                                }`}
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
                    {selectedTariff.custom_traffic_enabled &&
                      (selectedTariff.traffic_price_per_gb_kopeks ?? 0) > 0 && (
                        <div>
                          <div className="mb-3 text-sm text-dark-400">
                            {t('subscription.customTraffic.label')}
                          </div>
                          <div className="dark-glass p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="font-medium text-dark-200">
                                {t('subscription.customTraffic.selectVolume')}
                              </span>
                              <button
                                type="button"
                                onClick={() => setUseCustomTraffic(!useCustomTraffic)}
                                className={`relative h-6 w-10 rounded-full transition-colors ${
                                  useCustomTraffic ? 'bg-accent-500' : 'bg-dark-600'
                                }`}
                              >
                                <span
                                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                                    useCustomTraffic ? 'left-5' : 'left-1'
                                  }`}
                                />
                              </button>
                            </div>
                            {!useCustomTraffic && (
                              <div className="text-sm text-dark-400">
                                {t('subscription.customTraffic.default', {
                                  label: selectedTariff.traffic_limit_label,
                                })}
                              </div>
                            )}
                            {useCustomTraffic && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-4">
                                  <input
                                    type="range"
                                    min={selectedTariff.min_traffic_gb ?? 1}
                                    max={selectedTariff.max_traffic_gb ?? 1000}
                                    value={customTrafficGb}
                                    onChange={(e) => setCustomTrafficGb(parseInt(e.target.value))}
                                    className="flex-1 accent-accent-500"
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      value={customTrafficGb}
                                      min={selectedTariff.min_traffic_gb ?? 1}
                                      max={selectedTariff.max_traffic_gb ?? 1000}
                                      onChange={(e) =>
                                        setCustomTrafficGb(
                                          Math.max(
                                            selectedTariff.min_traffic_gb ?? 1,
                                            Math.min(
                                              selectedTariff.max_traffic_gb ?? 1000,
                                              parseInt(e.target.value) ||
                                                (selectedTariff.min_traffic_gb ?? 1),
                                            ),
                                          ),
                                        )
                                      }
                                      className="w-20 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-center text-dark-100"
                                    />
                                    <span className="text-dark-400">{t('common.units.gb')}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-dark-400">
                                    {customTrafficGb} {t('common.units.gb')} ×{' '}
                                    {formatPrice(selectedTariff.traffic_price_per_gb_kopeks ?? 0)}/
                                    {t('common.units.gb')}
                                  </span>
                                  <span className="font-medium text-accent-400">
                                    +
                                    {formatPrice(
                                      customTrafficGb *
                                        (selectedTariff.traffic_price_per_gb_kopeks ?? 0),
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Summary & Purchase */}
                    {(selectedTariffPeriod || useCustomDays) && (
                      <div className="dark-glass p-5">
                        {(() => {
                          const basePeriodPrice = useCustomDays
                            ? customDays * (selectedTariff.price_per_day_kopeks ?? 0)
                            : selectedTariffPeriod?.price_kopeks || 0;
                          const existingPeriodOriginal = useCustomDays
                            ? selectedTariff.original_price_per_day_kopeks &&
                              selectedTariff.original_price_per_day_kopeks >
                                (selectedTariff.price_per_day_kopeks ?? 0)
                              ? customDays * selectedTariff.original_price_per_day_kopeks
                              : undefined
                            : selectedTariffPeriod?.original_price_kopeks &&
                                selectedTariffPeriod.original_price_kopeks >
                                  selectedTariffPeriod.price_kopeks
                              ? selectedTariffPeriod.original_price_kopeks
                              : undefined;
                          const promoPeriod = applyPromoDiscount(
                            basePeriodPrice,
                            existingPeriodOriginal,
                          );

                          const trafficPrice =
                            useCustomTraffic && selectedTariff.custom_traffic_enabled
                              ? customTrafficGb * (selectedTariff.traffic_price_per_gb_kopeks ?? 0)
                              : 0;

                          const totalPrice = promoPeriod.price + trafficPrice;
                          const originalTotal = promoPeriod.original
                            ? promoPeriod.original + trafficPrice
                            : null;

                          return (
                            <>
                              <div className="mb-4 space-y-2">
                                {useCustomDays ? (
                                  null
                                ) : (
                                  selectedTariffPeriod && (
                                    <>
                                      {(selectedTariffPeriod.extra_devices_count ?? 0) > 0 &&
                                      selectedTariffPeriod.base_tariff_price_kopeks ? (
                                        <>
                                          <div className="flex justify-between text-sm text-dark-300">
                                            <span>
                                              {t('subscription.baseTariff')}:{' '}
                                              {selectedTariffPeriod.label}
                                            </span>
                                            <span>
                                              {formatPrice(
                                                selectedTariffPeriod.base_tariff_price_kopeks,
                                              )}
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-sm text-dark-300">
                                            <span>
                                              {t('subscription.extraDevices')} (
                                              {selectedTariffPeriod.extra_devices_count})
                                            </span>
                                            <span>
                                              +
                                              {formatPrice(
                                                selectedTariffPeriod.extra_devices_cost_kopeks ?? 0,
                                              )}
                                            </span>
                                          </div>
                                        </>
                                      ) : null}
                                    </>
                                  )
                                )}
                                {useCustomTraffic && selectedTariff.custom_traffic_enabled && (
                                  <div className="flex justify-between text-sm text-dark-300">
                                    <span>
                                      {t('subscription.summary.traffic', { gb: customTrafficGb })}
                                    </span>
                                    <span>+{formatPrice(trafficPrice)}</span>
                                  </div>
                                )}
                              </div>

                              {promoPeriod.percent && (
                                <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2">
                                  <span className="text-sm font-medium text-orange-400">
                                    {t('promo.discountApplied')} -{promoPeriod.percent}%
                                  </span>
                                </div>
                              )}

                              <div className="mb-4 flex items-center justify-between border-t border-dark-700/50 pt-2">
                                <span className="font-medium text-dark-100">
                                  {t('subscription.total')}
                                </span>
                                <div className="text-right">
                                  <span className="text-2xl font-bold text-accent-400">
                                    {formatPrice(totalPrice)}
                                  </span>
                                  {originalTotal && (
                                    <div className="text-sm text-dark-500 line-through">
                                      {formatPrice(originalTotal)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Payment CTA Button */}
                              {(() => {
                                const hasEnoughBalance = purchaseOptions && totalPrice <= purchaseOptions.balance_kopeks;
                                const missingAmount = purchaseOptions
                                  ? totalPrice - purchaseOptions.balance_kopeks
                                  : totalPrice;
                                const methods = getAvailablePaymentMethods(missingAmount);

                                return (
                                  <>
                                    {/* Balance info */}
                                    {purchaseOptions && (
                                      <div className={`mb-3 flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                                        hasEnoughBalance
                                          ? 'bg-success-500/10 border border-success-500/20'
                                          : 'bg-dark-800/60 border border-dark-700/40'
                                      }`}>
                                        <div className="flex w-full justify-between">
                                          <div className="flex flex-col items-start">
                                              <span className="text-[10px] uppercase tracking-wider text-dark-500">Ваш баланс</span>
                                              <span className={hasEnoughBalance ? 'font-semibold text-success-400' : 'font-semibold text-dark-200'}>
                                                {formatPrice(purchaseOptions.balance_kopeks)}
                                              </span>
                                          </div>
                                          {!hasEnoughBalance && missingAmount > 0 && (
                                              <div className="flex flex-col items-start">
                                                <span className="text-[10px] uppercase tracking-wider text-dark-500">Не хватает</span>
                                                <span className="font-semibold text-error-400">
                                                  {formatPrice(missingAmount)}
                                                </span>
                                              </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => {
                                        haptic.buttonPressMedium();
                                        if (hasEnoughBalance || !purchaseOptions || methods.length === 0) {
                                          tariffPurchaseMutation.mutate();
                                        } else {
                                          setShowPaymentSheet(true);
                                        }
                                      }}
                                      disabled={tariffPurchaseMutation.isPending || isDirectPaying}
                                      className="w-full rounded-full h-14 bg-[var(--figma-green)] text-white font-medium text-base flex items-center justify-center gap-3 transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-50"
                                    >
                                      {(tariffPurchaseMutation.isPending || isDirectPaying) ? (
                                        <span className="flex items-center justify-center gap-2">
                                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                          {t('common.loading')}
                                        </span>
                                      ) : (
                                        <>
                                          {t('subscription.paySubscription', 'Оплатить')}
                                          <span className="text-white/90">
                                            {hasEnoughBalance
                                              ? formatPrice(totalPrice)
                                              : formatPrice(missingAmount)}
                                          </span>
                                        </>
                                      )}
                                    </button>

                                    {/* Payment Method Bottom Sheet */}
                                    {showPaymentSheet && !hasEnoughBalance && methods.length > 0 && (
                                      <>
                                        {/* Backdrop */}
                                        <div
                                          className="fixed inset-0 bg-black/60 z-[999] animate-[backdropFadeIn_0.2s_ease-out]"
                                          onClick={() => setShowPaymentSheet(false)}
                                        />
                                        {/* Sheet */}
                                        <div className="fixed bottom-0 left-0 right-0 z-[1000] animate-[sheetSlideUp_0.3s_ease-out]">
                                          <div className="bg-black mx-auto max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border-none text-white">
                                            <div className="flex items-center justify-between p-6 pb-0">
                                              <h3 className="text-lg font-medium text-white">
                                                {t('subscription.selectPaymentMethod', 'Способ оплаты')}
                                              </h3>
                                              <button
                                                onClick={() => setShowPaymentSheet(false)}
                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                                                aria-label="Close"
                                              >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M18 6L6 18M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                            <div className="p-6 pt-4">
                                              <div className="space-y-2 mb-5">
                                               {methods.map((method) => (
                                                 <button
                                                   key={method.id}
                                                   onClick={() => {
                                                     setSelectedPaymentMethod(method.id);
                                                     setSelectedPaymentOption(method.options?.[0]?.id ?? null);
                                                     setDirectPayError(null);
                                                   }}
                                                   className={`w-full rounded-2xl p-4 text-left text-sm transition-all bg-white/5 ${
                                                     selectedPaymentMethod === method.id
                                                       ? 'ring-2 ring-[var(--figma-green)]'
                                                       : 'ring-1 ring-white/10 hover:bg-white/[0.07]'
                                                   }`}
                                                 >
                                                   <div className="flex items-center gap-3 font-medium text-white">
                                                     <img src="/SBP.svg" alt="" className="h-[30px] w-[24px] flex-shrink-0" />
                                                     {method.name}
                                                   </div>
                                                   {method.description && (
                                                     <div className="mt-1 text-xs text-white/40">{method.description}</div>
                                                   )}
                                                 </button>
                                               ))}
                                              </div>
                                              {selectedPaymentMethod && (
                                                <button
                                                  onClick={() => {
                                                    handleDirectPay(
                                                      missingAmount,
                                                      selectedTariff.id,
                                                      selectedTariff.name,
                                                      useCustomDays ? customDays : selectedTariffPeriod?.days || 30,
                                                      totalPrice,
                                                      useCustomTraffic && selectedTariff.custom_traffic_enabled ? customTrafficGb : undefined,
                                                    );
                                                    setShowPaymentSheet(false);
                                                  }}
                                                  disabled={isDirectPaying}
                                                  className="w-full rounded-full h-14 bg-[var(--figma-green)] text-white font-medium text-base flex items-center justify-center transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-50"
                                                >
                                                  {isDirectPaying ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                                      {t('common.loading')}
                                                    </span>
                                                  ) : (
                                                    t('subscription.payAndActivate', 'Оплатить и активировать')
                                                  )}
                                                </button>
                                              )}
                                              {directPayError && (
                                                <div className="mt-3 text-center text-sm text-error-400">{directPayError}</div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          );
                        })()}

                        {tariffPurchaseMutation.isError &&
                          !getInsufficientBalanceError(tariffPurchaseMutation.error) && (
                            <div className="mt-3 text-center text-sm text-error-400">
                              {getErrorMessage(tariffPurchaseMutation.error)}
                            </div>
                          )}
                        {tariffPurchaseMutation.isError &&
                          getInsufficientBalanceError(tariffPurchaseMutation.error) && (
                            <div className="mt-3 text-center text-sm text-error-400">
                              {t('subscription.directPayError', 'Payment error. Please try again.')}
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* Purchase/Extend Section - Classic Mode */}
      {classicOptions && classicOptions.periods.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight text-dark-50">
              {subscription && !subscription.is_trial
                ? t('subscription.extend')
                : t('subscription.getSubscription')}
            </h2>
            {!showPurchaseForm && (
              <button onClick={() => setShowPurchaseForm(true)} className="btn-primary">
                {subscription && !subscription.is_trial
                  ? t('subscription.extend')
                  : t('subscription.getSubscription')}
              </button>
            )}
          </div>

          {showPurchaseForm && (
            <div className="space-y-6">
              {/* Step Indicator */}
              <div className="mb-6 flex items-center justify-between">
                <div className="text-sm text-dark-400">
                  {t('subscription.step', { current: currentStepIndex + 1, total: steps.length })}
                </div>
                <div className="flex gap-2">
                  {steps.map((step, idx) => (
                    <div
                      key={step}
                      className={`h-1 w-8 rounded-full transition-colors ${
                        idx <= currentStepIndex ? 'bg-accent-500' : 'bg-dark-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-4 text-lg font-medium text-dark-100">
                {getStepLabel(currentStep)}
              </div>

              {/* Step: Period Selection */}
              {currentStep === 'period' && classicOptions && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {classicOptions.periods.map((period) => {
                    const promoPeriod = applyPromoDiscount(
                      period.price_kopeks,
                      period.original_price_kopeks,
                    );

                    return (
                      <button
                        key={period.id}
                        onClick={() => {
                          setSelectedPeriod(period);
                          if (period.traffic.current !== undefined) {
                            setSelectedTraffic(period.traffic.current);
                          }
                          const availableServers = getAvailableServers(period);
                          if (availableServers.length === 1) {
                            setSelectedServers([availableServers[0].uuid]);
                          } else if (period.servers.selected) {
                            const availUuids = new Set(availableServers.map((s) => s.uuid));
                            setSelectedServers(
                              period.servers.selected.filter((uuid) => availUuids.has(uuid)),
                            );
                          }
                          if (period.devices.current) {
                            setSelectedDevices(period.devices.current);
                          }
                        }}
                        className={`bento-card-hover relative p-4 text-left transition-all ${
                          selectedPeriod?.id === period.id
                            ? 'bento-card-glow border-accent-500'
                            : ''
                        }`}
                      >
                        {promoPeriod.percent && promoPeriod.percent > 0 && (
                          <div
                            className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm ${
                              promoPeriod.isPromoGroup ? 'bg-success-500' : 'bg-orange-500'
                            }`}
                          >
                            -{promoPeriod.percent}%
                          </div>
                        )}
                        <div className="text-lg font-semibold text-dark-100">{period.label}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-accent-400">
                            {formatPrice(promoPeriod.price)}
                          </span>
                          {promoPeriod.original && promoPeriod.original > promoPeriod.price && (
                            <span className="text-sm text-dark-500 line-through">
                              {formatPrice(promoPeriod.original)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step: Traffic Selection */}
              {currentStep === 'traffic' && selectedPeriod?.traffic.options && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {selectedPeriod.traffic.options.map((option) => {
                    const promoTraffic = applyPromoDiscount(
                      option.price_kopeks,
                      option.original_price_kopeks,
                    );

                    return (
                      <button
                        key={option.value}
                        onClick={() => { haptic.buttonPressMedium(); setSelectedTraffic(option.value); }}
                        disabled={!option.is_available}
                        className={`bento-card-hover relative p-4 text-center transition-all ${
                          selectedTraffic === option.value
                            ? 'bento-card-glow border-accent-500'
                            : ''
                        } ${!option.is_available ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {promoTraffic.percent && promoTraffic.percent > 0 && (
                          <div
                            className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm ${
                              promoTraffic.isPromoGroup ? 'bg-success-500' : 'bg-orange-500'
                            }`}
                          >
                            -{promoTraffic.percent}%
                          </div>
                        )}
                        <div className="text-lg font-semibold text-dark-100">{option.label}</div>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                          <span className="text-accent-400">{formatPrice(promoTraffic.price)}</span>
                          {promoTraffic.original && promoTraffic.original > promoTraffic.price && (
                            <span className="text-xs text-dark-500 line-through">
                              {formatPrice(promoTraffic.original)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step: Server Selection */}
              {currentStep === 'servers' && selectedPeriod?.servers.options && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {selectedPeriod.servers.options
                    .filter((server) => {
                      if (!server.is_available) return false;
                      if (subscription?.is_trial && server.name.toLowerCase().includes('trial')) {
                        return false;
                      }
                      return true;
                    })
                    .map((server) => {
                      const promoServer = applyPromoDiscount(
                        server.price_kopeks,
                        server.original_price_kopeks,
                      );

                      return (
                        <button
                          key={server.uuid}
                          onClick={() => toggleServer(server.uuid)}
                          disabled={!server.is_available}
                          className={`relative rounded-xl border p-4 text-left transition-all ${
                            selectedServers.includes(server.uuid)
                              ? 'border-accent-500 bg-accent-500/10'
                              : server.is_available
                                ? 'border-dark-700/50 bg-dark-800 hover:border-dark-600'
                                : 'cursor-not-allowed border-dark-800/30 bg-dark-900/30 opacity-50'
                          }`}
                        >
                          {promoServer.percent && promoServer.percent > 0 ? (
                            <div
                              className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm ${
                                promoServer.isPromoGroup ? 'bg-success-500' : 'bg-orange-500'
                              }`}
                            >
                              -{promoServer.percent}%
                            </div>
                          ) : null}
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
                                selectedServers.includes(server.uuid)
                                  ? 'border-accent-500 bg-accent-500'
                                  : 'border-dark-600'
                              }`}
                            >
                              {selectedServers.includes(server.uuid) && <CheckIcon />}
                            </div>
                            <div>
                              <div className="font-medium text-dark-100">{server.name}</div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-sm text-accent-400">
                                  {formatPrice(promoServer.price)}
                                  {t('subscription.perMonth')}
                                </span>
                                {promoServer.original &&
                                promoServer.original > promoServer.price ? (
                                  <span className="text-xs text-dark-500 line-through">
                                    {formatPrice(promoServer.original)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Step: Device Selection */}
              {currentStep === 'devices' && selectedPeriod && (
                <div className="flex flex-col items-center py-8">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() =>
                        setSelectedDevices(
                          Math.max(selectedPeriod.devices.min, selectedDevices - 1),
                        )
                      }
                      disabled={selectedDevices <= selectedPeriod.devices.min}
                      className="btn-secondary flex h-14 w-14 items-center justify-center !p-0 text-2xl"
                    >
                      -
                    </button>
                    <div className="text-center">
                      <div className="text-5xl font-bold text-dark-100">{selectedDevices}</div>
                      <div className="mt-2 text-dark-500">{t('subscription.devices')}</div>
                    </div>
                    <button
                      onClick={() =>
                        setSelectedDevices(
                          Math.min(selectedPeriod.devices.max, selectedDevices + 1),
                        )
                      }
                      disabled={selectedDevices >= selectedPeriod.devices.max}
                      className="btn-secondary flex h-14 w-14 items-center justify-center !p-0 text-2xl"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-4 space-y-1 text-center text-sm text-dark-500">
                    <div className="text-accent-400">
                      {t('subscription.devicesFree', { count: selectedPeriod.devices.min })}
                    </div>
                    {selectedPeriod.devices.max > selectedPeriod.devices.min && (
                      <div>
                        {formatPrice(selectedPeriod.devices.price_per_device_kopeks)}{' '}
                        {t('subscription.perExtraDevice')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step: Confirm */}
              {currentStep === 'confirm' && (
                <div>
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                    </div>
                  ) : preview ? (
                    <div className="dark-glass space-y-4 p-5">
                      {activeDiscount?.is_active && activeDiscount.discount_percent && (
                        <div className="flex items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
                          <svg
                            className="h-4 w-4 text-orange-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                            />
                          </svg>
                          <span className="text-sm font-medium text-orange-400">
                            {t('promo.discountApplied')} -{activeDiscount.discount_percent}%
                          </span>
                        </div>
                      )}

                      {preview.breakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-dark-300">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                      ))}

                      {(() => {
                        const promoTotal = applyPromoDiscount(
                          preview.total_price_kopeks,
                          preview.original_price_kopeks,
                        );

                        return (
                          <div className="flex items-center justify-between border-t border-dark-700/50 pt-4">
                            <span className="text-lg font-semibold text-dark-100">
                              {t('subscription.total')}
                            </span>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-accent-400">
                                {formatPrice(promoTotal.price)}
                              </div>
                              {promoTotal.original && promoTotal.original > promoTotal.price && (
                                <div className="text-sm text-dark-500 line-through">
                                  {formatPrice(promoTotal.original)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {preview.discount_label && (
                        <div className="text-center text-sm text-success-400">
                          {preview.discount_label}
                        </div>
                      )}

                      {/* Balance info - always show above payment section */}
                      {purchaseOptions && preview && (
                        <div className={`mb-3 flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                          preview.can_purchase
                            ? 'bg-success-500/10 border border-success-500/20'
                            : 'bg-dark-800/60 border border-dark-700/40'
                        }`}>
                          <div className="flex w-full justify-between">
                            <div className="flex flex-col items-start">
                              <span className="text-[10px] uppercase tracking-wider text-dark-500">Ваш баланс</span>
                              <span className={preview.can_purchase ? 'font-semibold text-success-400' : 'font-semibold text-dark-200'}>
                                {formatPrice(purchaseOptions.balance_kopeks)}
                              </span>
                            </div>
                            {!preview.can_purchase && preview.missing_amount_kopeks > 0 && (
                              <div className="flex flex-col items-start">
                                <span className="text-[10px] uppercase tracking-wider text-dark-500">Не хватает</span>
                                <span className="font-semibold text-error-400">
                                  {formatPrice(preview.missing_amount_kopeks)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!preview.can_purchase &&
                        (preview.missing_amount_kopeks > 0 ? (
                          (() => {
                            const methods = getAvailablePaymentMethods(preview.missing_amount_kopeks);
                            if (methods.length > 0) {
                              return (
                                <div className="space-y-3">

                                  <div className="space-y-2">
                                    {methods.map((method) => (
                                      <button
                                        key={method.id}
                                        onClick={() => {
                                          setSelectedPaymentMethod(method.id);
                                          setSelectedPaymentOption(method.options?.[0]?.id ?? null);
                                          setDirectPayError(null);
                                        }}
                                        className={`w-full rounded-xl border p-3 text-left text-sm transition-all ${
                                          selectedPaymentMethod === method.id
                                            ? 'border-accent-500 bg-accent-500/10 text-dark-100'
                                            : 'border-dark-700/50 bg-dark-800 text-dark-300 hover:border-dark-600'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 font-medium">
                                          <img src="/SBP.svg" alt="" className="h-[30px] w-[24px] flex-shrink-0" />
                                          {method.name}
                                        </div>
                                        {method.description && (
                                          <div className="mt-0.5 text-xs text-dark-500">{method.description}</div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                  {directPayError && (
                                    <div className="text-center text-sm text-error-400">{directPayError}</div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <InsufficientBalancePrompt
                                missingAmountKopeks={preview.missing_amount_kopeks}
                                compact
                              />
                            );
                          })()
                        ) : preview.status_message ? (
                          <div className="rounded-lg bg-error-500/10 px-4 py-3 text-center text-sm text-error-400">
                            {preview.status_message}
                          </div>
                        ) : null)}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 border-t border-dark-800/50 pt-4">
                {!isFirstStep && (
                  <button onClick={() => { haptic.buttonPressMedium(); goToPrevStep(); }} className="dark-glass ml-auto flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-dark-200 hover:text-white transition-all active:scale-95">
                    {t('common.back')}
                  </button>
                )}

                {isFirstStep && (
                  <button onClick={() => { haptic.buttonPressMedium(); resetPurchase(); }} className="dark-glass ml-auto flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-dark-200 hover:text-white transition-all active:scale-95">
                    {t('common.cancel')}
                  </button>
                )}

                {!isLastStep ? (
                  <button
                    onClick={goToNextStep}
                    disabled={!selectedPeriod}
                    className="btn-primary flex-1"
                  >
                    {t('common.next')}
                  </button>
                ) : (
                  <button
                    onClick={() => purchaseMutation.mutate()}
                    disabled={
                      purchaseMutation.isPending || previewLoading || !preview?.can_purchase
                    }
                    className="btn-primary flex-1"
                  >
                    {purchaseMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {t('common.loading')}
                      </span>
                    ) : (
                      t('subscription.purchase')
                    )}
                  </button>
                )}
              </div>

              {purchaseMutation.isError && (
                <div className="text-center text-sm text-error-400">
                  {getErrorMessage(purchaseMutation.error)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
