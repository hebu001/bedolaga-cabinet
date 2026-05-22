import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { AxiosError } from 'axios';
import { subscriptionApi } from '../api/subscription';
import { balanceApi } from '../api/balance';
import { promoApi } from '../api/promo';
import { WebBackButton } from '../components/WebBackButton';
import { getGlassColors } from '../utils/glassTheme';
import { useTheme } from '../hooks/useTheme';
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
import Twemoji from 'react-twemoji';
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

/**
 * True when an axios request was aborted by its own timeout (no HTTP
 * response received). The purchase endpoints can outlive the 30s client
 * timeout while the backend finishes a slow panel sync — by then the
 * balance charge and subscription change are already committed.
 */
function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof AxiosError &&
    (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || /timeout/i.test(error.message))
  );
}

export default function SubscriptionPurchase() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subscriptionId = searchParams.get('subscriptionId')
    ? parseInt(searchParams.get('subscriptionId')!, 10)
    : undefined;
  const { formatAmount, currencySymbol } = useCurrency();
  const haptic = useHapticFeedback();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  const autoMode = searchParams.get('auto') === '1';
  // ?renew=1 — auto-open the current tariff's payment modal (skip the list)
  const renewIntent = searchParams.get('renew') === '1';

  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100).replace(/[.,]00$/, '')} ${currencySymbol}`;

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
    isError: optionsError,
    refetch: refetchOptions,
  } = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
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
  const [showTariffListModal, setShowTariffListModal] = useState(false);
  const [customDays, setCustomDays] = useState<number>(30);
  const [customTrafficGb, setCustomTrafficGb] = useState<number>(50);
  const [useCustomDays, setUseCustomDays] = useState(false);
  const [useCustomTraffic, setUseCustomTraffic] = useState(false);

  // Direct payment state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<string | null>(null);
  const [showPaymentMethodPicker, setShowPaymentMethodPicker] = useState(false);
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
  const didAutoOpenRenewRef = useRef(false);

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
    queryFn: () => subscriptionApi.previewPurchase(currentSelection, subscriptionId),
    enabled: !!selectedPeriod && showPurchaseForm && currentStep === 'confirm',
  });

  // Classic purchase mutation
  const finishPurchaseNavigation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    queryClient.invalidateQueries({ queryKey: ['purchase-options', subscriptionId] });
    queryClient.invalidateQueries({ queryKey: ['balance'] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
    navigate('/subscriptions', { replace: true });
  }, [queryClient, subscriptionId, navigate]);

  const purchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.submitPurchase(currentSelection, subscriptionId),
    onSuccess: finishPurchaseNavigation,
    // A timeout almost always means the purchase committed but the backend
    // response was slow — show the updated list instead of a false error.
    onError: (error) => {
      if (isTimeoutError(error)) finishPurchaseNavigation();
    },
  });

  // Switch preview query
  const { data: switchPreview, isLoading: switchPreviewLoading } = useQuery({
    queryKey: ['tariff-switch-preview', switchTariffId],
    queryFn: () => subscriptionApi.previewTariffSwitch(switchTariffId!, subscriptionId),
    enabled: !!switchTariffId,
  });

  // Tariff switch mutation
  const switchTariffMutation = useMutation({
    mutationFn: (tariffId: number) => subscriptionApi.switchTariff(tariffId, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options', subscriptionId] });
      setSwitchTariffId(null);

      navigate('/subscriptions', { replace: true });
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
            queryClient.invalidateQueries({ queryKey: ['purchase-options', subscriptionId] });
          }
        }
      }
    },
  });

  // Tariff purchase mutation
  const finishTariffPurchase = useCallback(() => {
    clearPurchaseIntent();
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
    navigate('/subscriptions', { replace: true });
  }, [queryClient, navigate]);

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
    onSuccess: finishTariffPurchase,
    // purchase-tariff can outlive the 30s axios timeout while the backend
    // finishes a slow panel sync — the charge is already committed. Treat a
    // timeout as done and show the updated list; real validation failures
    // return fast with an error body and still surface inline.
    onError: (error) => {
      if (isTimeoutError(error)) finishTariffPurchase();
    },
  });

  // Direct payment handler: create top-up for exact missing amount and redirect
  const handleDirectPay = async (
    missingKopeks: number,
    tariffId: number,
    tariffName: string,
    periodDays: number,
    totalPriceKopeks: number,
    trafficGb?: number,
  ) => {
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
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.detail?.message ||
            err.response?.data?.detail ||
            t('subscription.directPayError', 'Payment error. Please try again.')
          : t('subscription.directPayError', 'Payment error. Please try again.');
      setDirectPayError(
        typeof msg === 'string'
          ? msg
          : t('subscription.directPayError', 'Payment error. Please try again.'),
      );
      setIsDirectPaying(false);
    }
  };

  // Available payment methods filtered by amount
  const getAvailablePaymentMethods = useCallback(
    (amountKopeks: number): PaymentMethod[] => {
      if (!paymentMethods) return [];
      return paymentMethods.filter(
        (m) =>
          m.is_available &&
          amountKopeks >= m.min_amount_kopeks &&
          amountKopeks <= m.max_amount_kopeks,
      );
    },
    [paymentMethods],
  );

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

  // Lock body scroll + Escape-to-close while the tariff-list modal is open
  useEffect(() => {
    if (!showTariffListModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTariffListModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [showTariffListModal]);

  // ?renew=1 — jump straight into the current tariff's payment modal.
  // If there is no current tariff, fall through to the tariff list.
  useEffect(() => {
    if (!renewIntent || didAutoOpenRenewRef.current) return;
    if (!isTariffsMode || tariffs.length === 0) return;
    const current = tariffs.find(
      (tariff) => tariff.is_current || tariff.id === subscription?.tariff_id,
    );
    if (!current) return;
    didAutoOpenRenewRef.current = true;
    setSelectedTariff(current);
    setSelectedTariffPeriod(current.periods[0] || null);
    setShowTariffPurchase(true);
  }, [renewIntent, isTariffsMode, tariffs, subscription]);

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
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
      </div>
    );
  }

  if (optionsError || (!purchaseOptions && !optionsLoading)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-apple-ink sm:text-3xl">
          {t('subscription.extend')}
        </h1>
        <div className="apple-card-grad rounded-2xl bg-apple-card p-6 text-center">
          <p className="mb-4 text-apple-mute">
            {t('subscription.loadError', 'Не удалось загрузить варианты подписки')}
          </p>
          <button
            onClick={() => refetchOptions()}
            className="rounded-full bg-[#F97315] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const tariffListBody = (
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            const isSubscriptionExpired =
              isTariffsMode &&
              purchaseOptions &&
              'subscription_is_expired' in purchaseOptions &&
              purchaseOptions.subscription_is_expired === true;
            const canSwitch =
              !isMultiTariff &&
              subscription &&
              subscription.tariff_id &&
              !isCurrentTariff &&
              !subscription.is_trial &&
              !isSubscriptionExpired &&
              (subscription.is_active || subscription.is_limited);
            const isLegacySubscription =
              subscription && !subscription.is_trial && !subscription.tariff_id;
            const openTariff = () => {
              haptic.buttonPressMedium();
              setSelectedTariff(tariff);
              setSelectedTariffPeriod(tariff.periods[0] || null);
              setShowTariffPurchase(true);
              setShowTariffListModal(false);
            };

            return (
              <div
                key={tariff.id}
                className="apple-card-grad flex flex-col rounded-2xl bg-apple-card p-5 text-left"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[17px] font-semibold text-apple-ink">{tariff.name}</div>
                    {tariff.description && (
                      <div className="mt-1 whitespace-pre-line text-[13px] text-apple-mute">
                        {tariff.description}
                      </div>
                    )}
                  </div>
                  {isCurrentTariff && (
                    <div className="flex shrink-0 items-center gap-1.5 pt-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: '#30d158' }}
                        aria-hidden="true"
                      />
                      <span
                        className="text-[13px] font-semibold uppercase tracking-widest"
                        style={{ color: '#30d158' }}
                      >
                        {t('subscription.currentTariff')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
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
                <div className="mt-3 border-t border-apple-hairline pt-3 text-[13px] text-apple-mute">
                  {(() => {
                    const dailyPrice =
                      tariff.daily_price_kopeks ?? tariff.price_per_day_kopeks ?? 0;
                    const originalDailyPrice = tariff.original_daily_price_kopeks || 0;
                    if (dailyPrice > 0 || originalDailyPrice > 0) {
                      const promoDaily = applyPromoDiscount(
                        dailyPrice,
                        originalDailyPrice > dailyPrice ? originalDailyPrice : undefined,
                      );
                      return (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold" style={{ color: '#F97315' }}>
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
                          <span className="text-[15px] font-semibold" style={{ color: '#F97315' }}>
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
                      <span className="text-[15px] font-semibold" style={{ color: '#F97315' }}>
                        {t('subscription.tariff.flexiblePayment')}
                      </span>
                    );
                  })()}
                </div>

                {/* Action Button */}
                <div className="mt-4">
                  {isCurrentTariff ? (
                    subscription?.is_daily ? (
                      <div className="py-2 text-center text-sm text-apple-faint">
                        {t('subscription.currentTariff')}
                      </div>
                    ) : (
                      <button
                        onClick={openTariff}
                        className="w-full rounded-full bg-[#F97315] py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
                      >
                        {t('subscription.extend')}
                      </button>
                    )
                  ) : isLegacySubscription ? (
                    <button
                      onClick={openTariff}
                      className="w-full rounded-full bg-[#F97315] py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
                    >
                      {t('subscription.tariff.selectForRenewal')}
                    </button>
                  ) : canSwitch ? (
                    <button
                      onClick={() => {
                        setSwitchTariffId(tariff.id);
                        setShowTariffListModal(false);
                      }}
                      className="w-full rounded-full bg-white py-3 text-[15px] font-medium text-black transition-opacity hover:opacity-90"
                    >
                      {t('subscription.switchTariff.switch')}
                    </button>
                  ) : (
                    <button
                      onClick={openTariff}
                      className="w-full rounded-full bg-[#F97315] py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
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
  );

  return (
    <div className="space-y-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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
          {/* Expired subscription notice */}
          {isTariffsMode &&
            purchaseOptions &&
            'subscription_is_expired' in purchaseOptions &&
            purchaseOptions.subscription_is_expired && (
              <div
                className="flex items-start gap-3 rounded-2xl p-4"
                style={{ background: 'rgba(255,69,58,0.12)' }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: 'rgba(255,69,58,0.16)' }}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ff453a"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold" style={{ color: '#ff453a' }}>
                    {t('subscription.expiredBanner.title')}
                  </div>
                  <div className="mt-0.5 text-[12px] text-apple-mute">
                    {t('subscription.expiredBanner.selectTariff')}
                  </div>
                </div>
              </div>
            )}

          {/* Switch Tariff Preview Modal */}
          {switchTariffId && (
            <div
              ref={switchModalRef}
              className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-apple-ink">
                  {t('subscription.switchTariff.title')}
                </h3>
                <button
                  onClick={() => setSwitchTariffId(null)}
                  className="text-sm text-apple-mute hover:text-apple-ink"
                >
                  ✕
                </button>
              </div>

              {switchPreviewLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
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
                        <div className="flex justify-between text-apple-mute">
                          <span>{t('subscription.switchTariff.currentTariff')}</span>
                          <span className="font-medium text-apple-ink">
                            {switchPreview.current_tariff_name || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between text-apple-mute">
                          <span>{t('subscription.switchTariff.newTariff')}</span>
                          <span className="font-medium" style={{ color: '#F97315' }}>
                            {switchPreview.new_tariff_name}
                          </span>
                        </div>
                        <div className="flex justify-between text-apple-mute">
                          <span>{t('subscription.switchTariff.remainingDays')}</span>
                          <span className="text-apple-ink">{switchPreview.remaining_days}</span>
                        </div>
                      </div>

                      {isDailyTariff && (
                        <div className="rounded-xl bg-apple-elevated p-3 text-center">
                          <div className="text-sm text-apple-mute">
                            {t('subscription.switchTariff.dailyPayment')}
                          </div>
                          <div className="text-lg font-bold" style={{ color: '#F97315' }}>
                            {formatPrice(dailyPrice)}
                          </div>
                          <div className="mt-1 text-xs text-apple-faint">
                            {t('subscription.switchTariff.dailyChargeDescription')}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-apple-hairline pt-3">
                        <div>
                          <span className="font-medium text-apple-ink">
                            {t('subscription.switchTariff.upgradeCost')}
                          </span>
                          {switchPreview.discount_percent && switchPreview.discount_percent > 0 && (
                            <span className="ml-2 inline-block rounded-full bg-apple-green/20 px-2 py-0.5 text-xs font-medium text-apple-green">
                              -{switchPreview.discount_percent}%
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          {switchPreview.discount_percent &&
                            switchPreview.discount_percent > 0 &&
                            switchPreview.base_upgrade_cost_kopeks &&
                            switchPreview.base_upgrade_cost_kopeks > 0 && (
                              <span className="mr-2 text-sm text-apple-faint line-through">
                                {formatPrice(switchPreview.base_upgrade_cost_kopeks)}
                              </span>
                            )}
                          <span
                            className="text-lg font-bold"
                            style={{
                              color:
                                switchPreview.upgrade_cost_kopeks === 0 ? '#30d158' : '#F97315',
                            }}
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
                        className="flex w-full items-center justify-center rounded-full bg-[#F97315] py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {switchTariffMutation.isPending ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
                            <div className="mt-1 text-center text-sm text-apple-red">
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

          {showTariffPurchase && selectedTariff ? (
            <>
              {/* Current tariff — name, summary, change button */}
              <div className="apple-card-grad flex items-center justify-between gap-3 rounded-2xl bg-apple-card p-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-apple-ink">
                    Тариф {selectedTariff.name}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-apple-mute">
                    {selectedTariff.description?.split('\n')[0] ||
                      `${selectedTariff.traffic_limit_label} · ${
                        selectedTariff.device_limit === 0
                          ? '∞'
                          : t('subscription.devices', { count: selectedTariff.device_limit })
                      }`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptic.buttonPressMedium();
                    setShowTariffListModal(true);
                  }}
                  className="shrink-0 rounded-full bg-apple-elevated px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
                  style={{ color: '#ffffff' }}
                >
                  {t('subscription.changeTariff', 'Изменить')}
                </button>
              </div>

              <div className="space-y-5">
                {/* Daily Tariff Purchase */}
                {selectedTariff.is_daily ||
                (selectedTariff.daily_price_kopeks && selectedTariff.daily_price_kopeks > 0) ? (
                  <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
                    <div className="mb-4 text-center">
                      <div className="mb-2 text-sm text-apple-mute">
                        {t('subscription.dailyPurchase.costPerDay')}
                      </div>
                      <div className="text-3xl font-bold" style={{ color: '#ffffff' }}>
                        {formatPrice(selectedTariff.daily_price_kopeks || 0)}
                      </div>
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
                                    Ваш баланс
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
                                      Не хватает
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
                              haptic.buttonPressMedium();
                              if (
                                hasEnoughBalance ||
                                !purchaseOptions ||
                                availableMethods.length === 0
                              ) {
                                tariffPurchaseMutation.mutate();
                              } else {
                                setSelectedPaymentMethod(availableMethods[0]?.id ?? null);
                                setSelectedPaymentOption(
                                  availableMethods[0]?.options?.[0]?.id ?? null,
                                );
                                setShowPaymentMethodPicker(false);
                                setShowPaymentSheet(true);
                              }
                            }}
                            disabled={tariffPurchaseMutation.isPending || isDirectPaying}
                            className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#F97315] text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {tariffPurchaseMutation.isPending || isDirectPaying ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                {t('common.loading')}
                              </span>
                            ) : (
                              <>
                                {t('subscription.paySubscription', 'Оплатить')}
                                {!hasEnoughBalance && missingAmount > 0 ? (
                                  <span className="text-white/90">
                                    {formatPrice(missingAmount)}
                                  </span>
                                ) : (
                                  <span className="text-white/90">{formatPrice(dailyPrice)}</span>
                                )}
                              </>
                            )}
                          </button>

                          {/* Payment Method Bottom Sheet for Daily */}
                          {showPaymentSheet &&
                            !hasEnoughBalance &&
                            availableMethods.length > 0 &&
                            createPortal(
                              <>
                                <div
                                  className="apple-sheet-backdrop fixed inset-0 z-[1000] flex items-end justify-center"
                                  style={{ background: 'rgba(0,0,0,0.6)' }}
                                  onClick={() => setShowPaymentSheet(false)}
                                >
                                  <div
                                    className="apple-card-grad apple-sheet-panel relative m-2.5 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] bg-black text-white"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex shrink-0 items-center justify-between px-7 pb-3 pt-5">
                                      <h3 className="text-[22px] font-semibold text-white">
                                        {t('subscription.paymentConfirm', 'Подтверждение оплаты')}
                                      </h3>
                                      <button
                                        type="button"
                                        onClick={() => setShowPaymentSheet(false)}
                                        aria-label="Close"
                                        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:text-white"
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
                                    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-7 pb-2">
                                      <div className="apple-card-grad rounded-xl bg-apple-card p-4">
                                        <p className="text-[14px] text-apple-ink">
                                          Подписка · ежедневная оплата
                                        </p>
                                        <hr className="my-2.5 border-apple-hairline" />
                                        <p className="text-[14px] text-apple-ink">{`Количество устройств: ${selectedTariff.device_limit === 0 ? '∞' : selectedTariff.device_limit}`}</p>
                                      </div>
                                      {(() => {
                                        const activeMethod =
                                          availableMethods.find(
                                            (m) => m.id === selectedPaymentMethod,
                                          ) ?? availableMethods[0];
                                        if (!activeMethod) return null;
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (availableMethods.length > 1)
                                                setShowPaymentMethodPicker(true);
                                            }}
                                            className="flex w-full items-center gap-3 rounded-2xl bg-apple-card p-3 text-left"
                                            style={{
                                              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                                            }}
                                          >
                                            <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10">
                                              <img src="/SBP.svg" alt="" className="h-6" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <div className="truncate text-sm font-medium text-white">
                                                {activeMethod.name}
                                              </div>
                                              {activeMethod.description && (
                                                <div className="mt-0.5 truncate text-xs text-apple-mute">
                                                  {activeMethod.description}
                                                </div>
                                              )}
                                            </div>
                                            {availableMethods.length > 1 && (
                                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-apple-elevated text-apple-mute">
                                                <svg
                                                  width="16"
                                                  height="16"
                                                  viewBox="0 0 24 24"
                                                  fill="currentColor"
                                                  aria-hidden="true"
                                                >
                                                  <circle cx="5" cy="12" r="2" />
                                                  <circle cx="12" cy="12" r="2" />
                                                  <circle cx="19" cy="12" r="2" />
                                                </svg>
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })()}
                                    </div>
                                    <div className="shrink-0 px-7 pb-7 pt-3">
                                      {selectedPaymentMethod && (
                                        <button
                                          type="button"
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
                                          className="flex h-14 w-full items-center justify-center rounded-full bg-[#F97315] text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                        >
                                          {isDirectPaying ? (
                                            <span className="flex items-center justify-center gap-2">
                                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                              {t('common.loading')}
                                            </span>
                                          ) : (
                                            t(
                                              'subscription.payAndActivate',
                                              'Оплатить и активировать',
                                            )
                                          )}
                                        </button>
                                      )}
                                      {directPayError && (
                                        <div className="mt-3 text-center text-sm text-apple-red">
                                          {directPayError}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {showPaymentMethodPicker && (
                                  <div
                                    className="apple-sheet-backdrop fixed inset-0 z-[1001] flex items-end justify-center"
                                    style={{ background: 'rgba(0,0,0,0.6)' }}
                                    onClick={() => setShowPaymentMethodPicker(false)}
                                  >
                                    <div
                                      className="apple-card-grad apple-sheet-panel relative m-2.5 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] bg-black text-white"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex shrink-0 items-center justify-between px-7 pb-3 pt-5">
                                        <h3 className="text-[22px] font-semibold text-white">
                                          {t(
                                            'subscription.changePaymentMethod',
                                            'Изменить способ оплаты',
                                          )}
                                        </h3>
                                        <button
                                          type="button"
                                          onClick={() => setShowPaymentMethodPicker(false)}
                                          aria-label="Close"
                                          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:text-white"
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
                                      <div className="flex flex-col gap-2 overflow-y-auto px-7 pb-7 pt-1">
                                        {availableMethods.map((method) => (
                                          <button
                                            key={method.id}
                                            type="button"
                                            onClick={() => {
                                              setSelectedPaymentMethod(method.id);
                                              setSelectedPaymentOption(
                                                method.options?.[0]?.id ?? null,
                                              );
                                              setDirectPayError(null);
                                              setShowPaymentMethodPicker(false);
                                            }}
                                            className="flex w-full items-center gap-3 rounded-2xl bg-apple-card p-3 text-left"
                                            style={{
                                              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                                            }}
                                          >
                                            <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10">
                                              <img src="/SBP.svg" alt="" className="h-6" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <div className="truncate text-sm font-medium text-white">
                                                {method.name}
                                              </div>
                                              {method.description && (
                                                <div className="mt-0.5 truncate text-xs text-apple-mute">
                                                  {method.description}
                                                </div>
                                              )}
                                            </div>
                                            {selectedPaymentMethod === method.id && (
                                              <span
                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                                style={{ background: '#F97315' }}
                                              >
                                                <svg
                                                  width="14"
                                                  height="14"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="#fff"
                                                  strokeWidth="3"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                >
                                                  <path d="M5 13l4 4L19 7" />
                                                </svg>
                                              </span>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>,
                              document.body,
                            )}

                          {purchaseOptions &&
                            !hasEnoughBalance &&
                            availableMethods.length === 0 && (
                              <InsufficientBalancePrompt
                                missingAmountKopeks={missingAmount}
                                compact
                                className="mt-4"
                              />
                            )}

                          {tariffPurchaseMutation.isError &&
                            !getInsufficientBalanceError(tariffPurchaseMutation.error) && (
                              <div className="mt-3 text-center text-sm text-apple-red">
                                {getErrorMessage(tariffPurchaseMutation.error)}
                              </div>
                            )}
                          {tariffPurchaseMutation.isError &&
                            getInsufficientBalanceError(tariffPurchaseMutation.error) && (
                              <div className="mt-3 text-center text-sm text-apple-red">
                                {t(
                                  'subscription.directPayError',
                                  'Payment error. Please try again.',
                                )}
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
                      <div className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-apple-mute">
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
                            const isSelected =
                              selectedTariffPeriod?.days === period.days && !useCustomDays;

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
                                  ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.12);width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;transform:scale(0);animation:ripple-wave 6s cubic-bezier(0.22,0.61,0.36,1) forwards;pointer-events:none;z-index:0;`;
                                  btn.appendChild(ripple);
                                  setTimeout(() => ripple.remove(), 6100);
                                }}
                                className="apple-card-grad relative overflow-hidden rounded-2xl bg-apple-elevated py-3.5 pl-[22px] pr-4 text-left transition-transform active:scale-[0.97]"
                                style={
                                  isSelected
                                    ? { boxShadow: 'inset 0 0 0 1.5px #F97315' }
                                    : undefined
                                }
                              >
                                {displayDiscount && displayDiscount > 0 && (
                                  <div
                                    className="absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-xs font-medium text-white"
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
                              onClick={() => {
                                setShowTariffPurchase(false);
                                setSelectedTariff(null);
                                setSelectedTariffPeriod(null);
                              }}
                              className="mt-3 rounded-full bg-apple-elevated px-4 py-2 text-sm font-medium text-apple-ink transition-opacity hover:opacity-80"
                            >
                              {t('subscription.chooseDifferentTariff')}
                            </button>
                          </div>
                        )}

                      {/* Custom days option */}
                      {selectedTariff.custom_days_enabled &&
                        (selectedTariff.price_per_day_kopeks ?? 0) > 0 && (
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
                                    min={selectedTariff.min_days ?? 1}
                                    max={selectedTariff.max_days ?? 365}
                                    value={customDays}
                                    onChange={(e) => setCustomDays(parseInt(e.target.value))}
                                    className="flex-1 accent-[#F97315]"
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
                                    className="w-20 rounded-lg bg-apple-elevated px-3 py-2 text-center text-apple-ink outline-none"
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
                                      <span className="text-apple-mute">
                                        {t('subscription.days', { count: customDays })} ×{' '}
                                        {formatPrice(selectedTariff.price_per_day_kopeks ?? 0)}/
                                        {t('subscription.customDays.perDay')}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="font-semibold"
                                          style={{ color: '#ffffff' }}
                                        >
                                          {formatPrice(promoCustom.price)}
                                        </span>
                                        {promoCustom.original &&
                                          promoCustom.original > promoCustom.price && (
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
                                                  color: promoCustom.isPromoGroup
                                                    ? '#30d158'
                                                    : '#F97315',
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
                    {selectedTariff.custom_traffic_enabled &&
                      (selectedTariff.traffic_price_per_gb_kopeks ?? 0) > 0 && (
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
                                    className="flex-1 accent-[#F97315]"
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
                                      className="w-20 rounded-lg bg-apple-elevated px-3 py-2 text-center text-apple-ink outline-none"
                                    />
                                    <span className="text-apple-mute">{t('common.units.gb')}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-apple-mute">
                                    {customTrafficGb} {t('common.units.gb')} ×{' '}
                                    {formatPrice(selectedTariff.traffic_price_per_gb_kopeks ?? 0)}/
                                    {t('common.units.gb')}
                                  </span>
                                  <span className="font-semibold" style={{ color: '#ffffff' }}>
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
                      <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
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
                          const hasBreakdown =
                            (!useCustomDays &&
                              !!selectedTariffPeriod &&
                              (selectedTariffPeriod.extra_devices_count ?? 0) > 0 &&
                              !!selectedTariffPeriod.base_tariff_price_kopeks) ||
                            (useCustomTraffic && !!selectedTariff.custom_traffic_enabled);

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
                                              <div className="flex justify-between text-sm text-apple-mute">
                                                <span>
                                                  {t('subscription.extraDevices')} (
                                                  {selectedTariffPeriod.extra_devices_count})
                                                </span>
                                                <span className="text-apple-ink">
                                                  +
                                                  {formatPrice(
                                                    selectedTariffPeriod.extra_devices_cost_kopeks ??
                                                      0,
                                                  )}
                                                </span>
                                              </div>
                                            </>
                                          ) : null}
                                        </>
                                      )}
                                  {useCustomTraffic && selectedTariff.custom_traffic_enabled && (
                                    <div className="flex justify-between text-sm text-apple-mute">
                                      <span>
                                        {t('subscription.summary.traffic', {
                                          gb: customTrafficGb,
                                        })}
                                      </span>
                                      <span className="text-apple-ink">
                                        +{formatPrice(trafficPrice)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {promoPeriod.percent && (
                                <div
                                  className="mb-4 flex items-center justify-center gap-2 rounded-xl p-2"
                                  style={{ background: 'rgba(249,115,21,0.12)' }}
                                >
                                  <span
                                    className="text-sm font-medium"
                                    style={{ color: '#ffffff' }}
                                  >
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
                                const methods = getAvailablePaymentMethods(missingAmount);

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
                                              Ваш баланс
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
                                                Не хватает
                                              </span>
                                              <span
                                                className="font-semibold"
                                                style={{ color: '#ff453a' }}
                                              >
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
                                        if (
                                          hasEnoughBalance ||
                                          !purchaseOptions ||
                                          methods.length === 0
                                        ) {
                                          tariffPurchaseMutation.mutate();
                                        } else {
                                          setSelectedPaymentMethod(methods[0]?.id ?? null);
                                          setSelectedPaymentOption(
                                            methods[0]?.options?.[0]?.id ?? null,
                                          );
                                          setShowPaymentMethodPicker(false);
                                          setShowPaymentSheet(true);
                                        }
                                      }}
                                      disabled={tariffPurchaseMutation.isPending || isDirectPaying}
                                      className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#F97315] text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                    >
                                      {tariffPurchaseMutation.isPending || isDirectPaying ? (
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
                                    {showPaymentSheet &&
                                      !hasEnoughBalance &&
                                      methods.length > 0 &&
                                      createPortal(
                                        <>
                                          <div
                                            className="apple-sheet-backdrop fixed inset-0 z-[1000] flex items-end justify-center"
                                            style={{ background: 'rgba(0,0,0,0.6)' }}
                                            onClick={() => setShowPaymentSheet(false)}
                                          >
                                            <div
                                              className="apple-card-grad apple-sheet-panel relative m-2.5 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] bg-black text-white"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <div className="flex shrink-0 items-center justify-between px-7 pb-3 pt-5">
                                                <h3 className="text-[22px] font-semibold text-white">
                                                  {t(
                                                    'subscription.paymentConfirm',
                                                    'Подтверждение оплаты',
                                                  )}
                                                </h3>
                                                <button
                                                  type="button"
                                                  onClick={() => setShowPaymentSheet(false)}
                                                  aria-label="Close"
                                                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:text-white"
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
                                              <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-7 pb-2">
                                                <div className="apple-card-grad rounded-xl bg-apple-card p-4">
                                                  <p className="text-[14px] text-apple-ink">
                                                    Подписка ·{' '}
                                                    {useCustomDays
                                                      ? `${customDays} дн.`
                                                      : selectedTariffPeriod?.label}
                                                  </p>
                                                  <hr className="my-2.5 border-apple-hairline" />
                                                  <p className="text-[14px] text-apple-ink">{`Количество устройств: ${selectedTariff.device_limit === 0 ? '∞' : selectedTariff.device_limit}`}</p>
                                                </div>
                                                {(() => {
                                                  const activeMethod =
                                                    methods.find(
                                                      (m) => m.id === selectedPaymentMethod,
                                                    ) ?? methods[0];
                                                  if (!activeMethod) return null;
                                                  return (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        if (methods.length > 1)
                                                          setShowPaymentMethodPicker(true);
                                                      }}
                                                      className="flex w-full items-center gap-3 rounded-2xl bg-apple-card p-3 text-left"
                                                      style={{
                                                        boxShadow:
                                                          'inset 0 0 0 1px rgba(255,255,255,0.08)',
                                                      }}
                                                    >
                                                      <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10">
                                                        <img
                                                          src="/SBP.svg"
                                                          alt=""
                                                          className="h-6"
                                                        />
                                                      </span>
                                                      <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium text-white">
                                                          {activeMethod.name}
                                                        </div>
                                                        {activeMethod.description && (
                                                          <div className="mt-0.5 truncate text-xs text-apple-mute">
                                                            {activeMethod.description}
                                                          </div>
                                                        )}
                                                      </div>
                                                      {methods.length > 1 && (
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-apple-elevated text-apple-mute">
                                                          <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="currentColor"
                                                            aria-hidden="true"
                                                          >
                                                            <circle cx="5" cy="12" r="2" />
                                                            <circle cx="12" cy="12" r="2" />
                                                            <circle cx="19" cy="12" r="2" />
                                                          </svg>
                                                        </span>
                                                      )}
                                                    </button>
                                                  );
                                                })()}
                                              </div>
                                              <div className="shrink-0 px-7 pb-7 pt-3">
                                                {selectedPaymentMethod && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      handleDirectPay(
                                                        missingAmount,
                                                        selectedTariff.id,
                                                        selectedTariff.name,
                                                        useCustomDays
                                                          ? customDays
                                                          : selectedTariffPeriod?.days || 30,
                                                        totalPrice,
                                                        useCustomTraffic &&
                                                          selectedTariff.custom_traffic_enabled
                                                          ? customTrafficGb
                                                          : undefined,
                                                      );
                                                      setShowPaymentSheet(false);
                                                    }}
                                                    disabled={isDirectPaying}
                                                    className="flex h-14 w-full items-center justify-center rounded-full bg-[#F97315] text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                                  >
                                                    {isDirectPaying ? (
                                                      <span className="flex items-center justify-center gap-2">
                                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                                        {t('common.loading')}
                                                      </span>
                                                    ) : (
                                                      t(
                                                        'subscription.payAndActivate',
                                                        'Оплатить и активировать',
                                                      )
                                                    )}
                                                  </button>
                                                )}
                                                {directPayError && (
                                                  <div className="mt-3 text-center text-sm text-apple-red">
                                                    {directPayError}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          {showPaymentMethodPicker && (
                                            <div
                                              className="apple-sheet-backdrop fixed inset-0 z-[1001] flex items-end justify-center"
                                              style={{ background: 'rgba(0,0,0,0.6)' }}
                                              onClick={() => setShowPaymentMethodPicker(false)}
                                            >
                                              <div
                                                className="apple-card-grad apple-sheet-panel relative m-2.5 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] bg-black text-white"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <div className="flex shrink-0 items-center justify-between px-7 pb-3 pt-5">
                                                  <h3 className="text-[22px] font-semibold text-white">
                                                    {t(
                                                      'subscription.changePaymentMethod',
                                                      'Изменить способ оплаты',
                                                    )}
                                                  </h3>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setShowPaymentMethodPicker(false)
                                                    }
                                                    aria-label="Close"
                                                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:text-white"
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
                                                <div className="flex flex-col gap-2 overflow-y-auto px-7 pb-7 pt-1">
                                                  {methods.map((method) => (
                                                    <button
                                                      key={method.id}
                                                      type="button"
                                                      onClick={() => {
                                                        setSelectedPaymentMethod(method.id);
                                                        setSelectedPaymentOption(
                                                          method.options?.[0]?.id ?? null,
                                                        );
                                                        setDirectPayError(null);
                                                        setShowPaymentMethodPicker(false);
                                                      }}
                                                      className="flex w-full items-center gap-3 rounded-2xl bg-apple-card p-3 text-left"
                                                      style={{
                                                        boxShadow:
                                                          'inset 0 0 0 1px rgba(255,255,255,0.08)',
                                                      }}
                                                    >
                                                      <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10">
                                                        <img
                                                          src="/SBP.svg"
                                                          alt=""
                                                          className="h-6"
                                                        />
                                                      </span>
                                                      <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium text-white">
                                                          {method.name}
                                                        </div>
                                                        {method.description && (
                                                          <div className="mt-0.5 truncate text-xs text-apple-mute">
                                                            {method.description}
                                                          </div>
                                                        )}
                                                      </div>
                                                      {selectedPaymentMethod === method.id && (
                                                        <span
                                                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                                          style={{ background: '#F97315' }}
                                                        >
                                                          <svg
                                                            width="14"
                                                            height="14"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="#fff"
                                                            strokeWidth="3"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                          >
                                                            <path d="M5 13l4 4L19 7" />
                                                          </svg>
                                                        </span>
                                                      )}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </>,
                                        document.body,
                                      )}
                                  </>
                                );
                              })()}
                            </>
                          );
                        })()}

                        {tariffPurchaseMutation.isError &&
                          !getInsufficientBalanceError(tariffPurchaseMutation.error) && (
                            <div className="mt-3 text-center text-sm text-apple-red">
                              {getErrorMessage(tariffPurchaseMutation.error)}
                            </div>
                          )}
                        {tariffPurchaseMutation.isError &&
                          getInsufficientBalanceError(tariffPurchaseMutation.error) && (
                            <div className="mt-3 text-center text-sm text-apple-red">
                              {t('subscription.directPayError', 'Payment error. Please try again.')}
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            tariffListBody
          )}
          {showTariffListModal &&
            createPortal(
              <div
                className="apple-sheet-backdrop fixed inset-0 z-[100] flex items-end justify-center"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setShowTariffListModal(false)}
              >
                <div
                  className="apple-card-grad apple-sheet-panel relative m-2.5 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[32px] bg-black"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setShowTariffListModal(false)}
                    aria-label={t('common.close', 'Закрыть')}
                    className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:text-white"
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
                  <div className="px-7 pb-2 pr-16 pt-5 text-[22px] font-semibold leading-[26px] text-white">
                    {t('subscription.purchaseTitle', 'Покупка подписки')}
                  </div>
                  <div className="px-7 pb-7 pt-2">{tariffListBody}</div>
                </div>
              </div>,
              document.body,
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
                        onClick={() => {
                          haptic.buttonPressMedium();
                          setSelectedTraffic(option.value);
                        }}
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
                              <div className="font-medium text-dark-100">
                                <Twemoji
                                  options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}
                                >
                                  {server.name}
                                </Twemoji>
                              </div>
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
                        <div
                          className={`mb-3 flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                            preview.can_purchase
                              ? 'border border-success-500/20 bg-success-500/10'
                              : 'border border-dark-700/40 bg-dark-800/60'
                          }`}
                        >
                          <div className="flex w-full justify-between">
                            <div className="flex flex-col items-start">
                              <span className="text-[10px] uppercase tracking-wider text-dark-500">
                                Ваш баланс
                              </span>
                              <span
                                className={
                                  preview.can_purchase
                                    ? 'font-semibold text-success-400'
                                    : 'font-semibold text-dark-200'
                                }
                              >
                                {purchaseOptions.balance_kopeks === 0
                                  ? t('subscription.noFunds', 'Нет средств')
                                  : formatPrice(purchaseOptions.balance_kopeks)}
                              </span>
                            </div>
                            {!preview.can_purchase && preview.missing_amount_kopeks > 0 && (
                              <div className="flex flex-col items-start">
                                <span className="text-[10px] uppercase tracking-wider text-dark-500">
                                  Не хватает
                                </span>
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
                            const methods = getAvailablePaymentMethods(
                              preview.missing_amount_kopeks,
                            );
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
                                          <img
                                            src="/SBP.svg"
                                            alt=""
                                            className="h-[30px] w-[24px] flex-shrink-0"
                                          />
                                          {method.name}
                                        </div>
                                        {method.description && (
                                          <div className="mt-0.5 text-xs text-dark-500">
                                            {method.description}
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                  {directPayError && (
                                    <div className="text-center text-sm text-error-400">
                                      {directPayError}
                                    </div>
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
                  <button
                    onClick={() => {
                      haptic.buttonPressMedium();
                      goToPrevStep();
                    }}
                    className="dark-glass ml-auto flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-dark-200 transition-all hover:text-white active:scale-95"
                  >
                    {t('common.back')}
                  </button>
                )}

                {isFirstStep && (
                  <button
                    onClick={() => {
                      haptic.buttonPressMedium();
                      resetPurchase();
                    }}
                    className="dark-glass ml-auto flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-dark-200 transition-all hover:text-white active:scale-95"
                  >
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
              className="rounded-xl bg-accent-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
    </div>
  );
}
