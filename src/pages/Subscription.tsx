import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { WebBackButton } from '../components/WebBackButton';
import { useDestructiveConfirm } from '../platform/hooks/useNativeDialog';
import { usePlatform } from '../platform';
import { useTrafficZone } from '../hooks/useTrafficZone';
import { formatTraffic } from '../utils/formatTraffic';
import { getGlassColors } from '../utils/glassTheme';
import { useTheme } from '../hooks/useTheme';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import { useCurrency } from '../hooks/useCurrency';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import PurchaseCTAButton from '../components/subscription/PurchaseCTAButton';
import { CopyIcon, CheckIcon } from '../components/icons';
import { useHapticFeedback } from '../platform/hooks/useHaptic';
import { resolveConnectionUrlForUi } from '../utils/connectionLink';
import {
  getErrorMessage,
  getInsufficientBalanceError,
  getFlagEmoji,
} from '../utils/subscriptionHelpers';

/** Isolated countdown so 1s interval doesn't re-render the whole page */
const CountdownTimer = memo(function CountdownTimer({
  endDate,
  isActive,
}: {
  endDate: string;
  isActive: boolean;
}) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const endTime = new Date(endDate).getTime();
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      setCountdown({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  const isExpired = !isActive;

  const formattedDate = new Date(endDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const units = [
    { v: countdown.days, l: t('subscription.daysShort', 'дн') },
    { v: countdown.hours, l: t('subscription.hoursShort', 'ч') },
    { v: countdown.minutes, l: t('subscription.minutesShort', 'м') },
    { v: countdown.seconds, l: t('subscription.secondsShort', 'с') },
  ];

  return (
    <div className="rounded-[14px] p-4" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-apple-faint">
        {t('dashboard.remaining')}
      </div>
      {isExpired ? (
        <div className="text-[20px] font-bold tracking-tight" style={{ color: '#ff453a' }}>
          {t('subscription.expired')}
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            {units.map((u) => (
              <div key={u.l} className="flex items-baseline gap-[3px]">
                <span className="text-[26px] font-bold tabular-nums tracking-tight text-apple-ink">
                  {String(u.v).padStart(2, '0')}
                </span>
                <span className="text-[12px] text-apple-faint">{u.l}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[12px] text-apple-mute">
            {t('subscription.expiresAt')}: {formattedDate}
          </div>
        </>
      )}
    </div>
  );
});

export default function Subscription() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { formatAmount, currencySymbol } = useCurrency();
  const navigate = useNavigate();
  const { subscriptionId: subIdParam } = useParams<{ subscriptionId?: string }>();
  const subscriptionId = subIdParam ? parseInt(subIdParam, 10) : undefined;
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const haptic = useHapticFeedback();
  const [copied, setCopied] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { platform } = usePlatform();
  const destructiveConfirm = useDestructiveConfirm();

  // Helper to format price from kopeks
  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100)} ${currencySymbol}`;

  // Device/traffic topup state
  const [showDeviceTopup, setShowDeviceTopup] = useState(false);
  const [devicesToAdd, setDevicesToAdd] = useState(1);
  const [showDeviceReduction, setShowDeviceReduction] = useState(false);
  const [targetDeviceLimit, setTargetDeviceLimit] = useState<number>(1);
  const [showTrafficTopup, setShowTrafficTopup] = useState(false);
  const [selectedTrafficPackage, setSelectedTrafficPackage] = useState<number | null>(null);
  const [showServerManagement, setShowServerManagement] = useState(false);
  const [selectedServersToUpdate, setSelectedServersToUpdate] = useState<string[]>([]);

  // Traffic refresh state
  const [trafficRefreshCooldown, setTrafficRefreshCooldown] = useState(0);

  // Revoke (reissue) cooldown state
  const [revokeCooldown, setRevokeCooldown] = useState(0);
  const [trafficData, setTrafficData] = useState<{
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null>(null);

  // Detect multi-tariff mode from cached subscriptions-list
  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariff = multiSubData?.multi_tariff_enabled ?? false;

  const { data: subscriptionResponse, isLoading } = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: () => subscriptionApi.getSubscription(subscriptionId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: connectionLink, isLoading: isConnectionLinkLoading } = useQuery({
    queryKey: ['connection-link', subscriptionId],
    queryFn: () => subscriptionApi.getConnectionLink(subscriptionId),
    retry: false,
    staleTime: 0,
  });

  // Extract subscription from response (null if no subscription)
  const subscription = subscriptionResponse?.subscription ?? null;
  const displayedConnectionUrl = useMemo(
    () =>
      resolveConnectionUrlForUi({
        mode: connectionLink?.connect_mode,
        happSchemeLink: connectionLink?.happ_scheme_link,
        displayLink: connectionLink?.display_link,
        subscriptionUrl: connectionLink?.subscription_url,
        happCryptLink: connectionLink?.happ_cryptolink,
        happCryptoLink: connectionLink?.happ_crypto_link,
        happLink: connectionLink?.happ_link,
        fallbackUrl: isConnectionLinkLoading ? null : (subscription?.subscription_url ?? null),
      }),
    [
      connectionLink?.connect_mode,
      connectionLink?.display_link,
      connectionLink?.happ_cryptolink,
      connectionLink?.happ_crypto_link,
      connectionLink?.happ_link,
      connectionLink?.happ_scheme_link,
      connectionLink?.subscription_url,
      isConnectionLinkLoading,
      subscription?.subscription_url,
    ],
  );
  const shouldHideConnectionLink =
    subscription?.hide_subscription_link || connectionLink?.hide_link;

  // Traffic zone (theme-aware) — called unconditionally at top level
  const usedPercent = trafficData?.traffic_used_percent ?? subscription?.traffic_used_percent ?? 0;
  const zone = useTrafficZone(usedPercent);

  // Purchase options (needed for balance_kopeks in device/traffic/server management)
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const isTariffsMode = purchaseOptions?.sales_mode === 'tariffs';

  const autopayMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      subscriptionApi.updateAutopay(enabled, undefined, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
    },
  });

  // Devices query
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
    enabled: !!subscription,
  });

  // Delete device mutation
  const deleteDeviceMutation = useMutation({
    mutationFn: (hwid: string) => subscriptionApi.deleteDevice(hwid, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
  });

  // Delete all devices mutation
  const deleteAllDevicesMutation = useMutation({
    mutationFn: () => subscriptionApi.deleteAllDevices(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
  });

  // Pause subscription mutation
  const pauseMutation = useMutation({
    mutationFn: () => subscriptionApi.togglePause(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });

  // Auto-close all modals/forms when success notification appears
  const handleCloseAllModals = useCallback(() => {
    setShowDeviceTopup(false);
    setShowDeviceReduction(false);
    setShowTrafficTopup(false);
    setShowServerManagement(false);
  }, []);
  useCloseOnSuccessNotification(handleCloseAllModals);

  // Device price query
  const { data: devicePriceData } = useQuery({
    queryKey: ['device-price', devicesToAdd, subscriptionId],
    queryFn: () => subscriptionApi.getDevicePrice(devicesToAdd, subscriptionId),
    enabled: showDeviceTopup && !!subscription,
  });

  // Device purchase mutation
  const devicePurchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.purchaseDevices(devicesToAdd, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['device-price'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      setShowDeviceTopup(false);
      setDevicesToAdd(1);
    },
  });

  // Device reduction info query
  const { data: deviceReductionInfo } = useQuery({
    queryKey: ['device-reduction-info', subscriptionId],
    queryFn: () => subscriptionApi.getDeviceReductionInfo(subscriptionId),
    enabled: showDeviceReduction && !!subscription,
  });

  // Initialize target device limit when reduction info loads
  useEffect(() => {
    if (deviceReductionInfo && showDeviceReduction) {
      setTargetDeviceLimit(
        Math.max(
          deviceReductionInfo.min_device_limit,
          deviceReductionInfo.current_device_limit - 1,
        ),
      );
    }
  }, [deviceReductionInfo, showDeviceReduction]);

  // Device reduction mutation
  const deviceReductionMutation = useMutation({
    mutationFn: () => subscriptionApi.reduceDevices(targetDeviceLimit, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['device-reduction-info', subscriptionId] });
      setShowDeviceReduction(false);
    },
  });

  // Traffic packages query
  const { data: trafficPackages } = useQuery({
    queryKey: ['traffic-packages', subscriptionId],
    queryFn: () => subscriptionApi.getTrafficPackages(subscriptionId),
    enabled: showTrafficTopup && !!subscription,
  });

  // Traffic purchase mutation
  const trafficPurchaseMutation = useMutation({
    mutationFn: (gb: number) => subscriptionApi.purchaseTraffic(gb, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['traffic-packages', subscriptionId] });
      setShowTrafficTopup(false);
      setSelectedTrafficPackage(null);
    },
  });

  // Countries/servers query
  const { data: countriesData, isLoading: countriesLoading } = useQuery({
    queryKey: ['countries', subscriptionId],
    queryFn: () => subscriptionApi.getCountries(subscriptionId),
    enabled: showServerManagement && !!subscription && !subscription.is_trial,
  });

  // Initialize selected servers when data loads
  useEffect(() => {
    if (countriesData && showServerManagement) {
      const connected = countriesData.countries.filter((c) => c.is_connected).map((c) => c.uuid);
      setSelectedServersToUpdate(connected);
    }
  }, [countriesData, showServerManagement]);

  // Countries update mutation
  const updateCountriesMutation = useMutation({
    mutationFn: (countries: string[]) => subscriptionApi.updateCountries(countries, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['countries', subscriptionId] });
      setShowServerManagement(false);
    },
  });

  // Traffic refresh mutation
  const refreshTrafficMutation = useMutation({
    mutationFn: () => subscriptionApi.refreshTraffic(subscriptionId),
    onSuccess: (data) => {
      setTrafficData({
        traffic_used_gb: data.traffic_used_gb,
        traffic_used_percent: data.traffic_used_percent,
        is_unlimited: data.is_unlimited,
      });
      localStorage.setItem(
        `traffic_refresh_ts_${subscriptionId ?? 'default'}`,
        Date.now().toString(),
      );
      if (data.rate_limited && data.retry_after_seconds) {
        setTrafficRefreshCooldown(data.retry_after_seconds);
      } else {
        setTrafficRefreshCooldown(30);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
    onError: (error: {
      response?: { status?: number; headers?: { get?: (key: string) => string } };
    }) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers?.get?.('Retry-After');
        setTrafficRefreshCooldown(retryAfter ? parseInt(retryAfter, 10) : 30);
      }
    },
  });

  // Track if we've already triggered auto-refresh this session
  const hasAutoRefreshed = useRef(false);

  // Cooldown timer for traffic refresh
  useEffect(() => {
    if (trafficRefreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setTrafficRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [trafficRefreshCooldown]);

  // Initialize revoke cooldown from localStorage on mount
  useEffect(() => {
    const ts = localStorage.getItem(`revoke_ts_${subscriptionId ?? 'default'}`);
    if (ts) {
      const elapsed = Math.floor((Date.now() - parseInt(ts, 10)) / 1000);
      const remaining = Math.max(0, 900 - elapsed);
      setRevokeCooldown(remaining);
    }
  }, [subscriptionId]);

  // Countdown timer for revoke cooldown
  useEffect(() => {
    if (revokeCooldown <= 0) return;
    const timer = setInterval(() => {
      setRevokeCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [revokeCooldown]);

  // Revoke (reissue) subscription mutation
  const revokeMutation = useMutation({
    mutationFn: () => subscriptionApi.revokeSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['connection-link', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      haptic.notification('success');
      localStorage.setItem(`revoke_ts_${subscriptionId ?? 'default'}`, Date.now().toString());
      setRevokeCooldown(900);
    },
    onError: () => {
      haptic.notification('error');
    },
  });

  // Auto-refresh traffic on mount (with 30s caching)
  useEffect(() => {
    if (!subscription) return;
    if (hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;

    const lastRefresh = localStorage.getItem(`traffic_refresh_ts_${subscriptionId ?? 'default'}`);
    const now = Date.now();
    const cacheMs = 30 * 1000;

    if (lastRefresh && now - parseInt(lastRefresh, 10) < cacheMs) {
      const elapsed = now - parseInt(lastRefresh, 10);
      const remaining = Math.ceil((cacheMs - elapsed) / 1000);
      if (remaining > 0) {
        setTrafficRefreshCooldown(remaining);
      }
      return;
    }

    refreshTrafficMutation.mutate();
  }, [subscription, refreshTrafficMutation, subscriptionId]);

  const copyUrl = () => {
    if (displayedConnectionUrl) {
      navigator.clipboard.writeText(displayedConnectionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = async () => {
    const confirmed = await destructiveConfirm(
      t('subscription.revoke.warning'),
      t('subscription.revoke.confirmBtn'),
      t('subscription.revoke.title'),
    );
    if (!confirmed) return;
    revokeMutation.mutate();
  };

  // In multi-tariff mode without a specific subscription ID, redirect to list
  if (isMultiTariff && !subscriptionId && !isLoading) {
    return <Navigate to="/subscriptions" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
      </div>
    );
  }

  if (!subscription && subscriptionId) {
    return (
      <div className="mx-auto max-w-lg p-4 text-center">
        <div className="mb-4 text-4xl">😕</div>
        <h2 className="mb-2 text-xl font-bold text-apple-ink">
          {t('subscription.notFound', 'Подписка не найдена')}
        </h2>
        <p className="mb-4 text-sm text-apple-ink/60">
          {t('subscription.notFoundDesc', 'Возможно, подписка была удалена или не существует')}
        </p>
        <button
          onClick={() => navigate('/subscriptions')}
          className="rounded-xl bg-apple-blue px-6 py-2.5 text-sm font-medium text-white"
        >
          {t('subscription.backToList', 'Мои подписки')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <WebBackButton to={isMultiTariff ? '/subscriptions' : '/'} />
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          {isMultiTariff && subscription?.tariff_name
            ? subscription.tariff_name
            : t('subscription.title')}
        </h1>
      </div>

      {/* Current Subscription */}
      {subscription ? (
        (() => {
          const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
          const isUnlimited =
            (trafficData?.is_unlimited ?? false) || subscription.traffic_limit_gb === 0;
          const connectedDevices = devicesData?.total ?? 0;
          const isAtDeviceLimit =
            subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;
          const statusHex = subscription.is_active
            ? '#30d158'
            : subscription.is_limited
              ? '#ff9f0a'
              : '#ff453a';
          const renewLink = subscription.is_trial
            ? '/subscription/purchase'
            : isMultiTariff
              ? `/subscriptions/${subscription.id}/renew`
              : '/subscription/purchase';

          return (
            <>
              {/* ─── Hero status card ─── */}
              <div
                className="relative overflow-hidden rounded-3xl bg-apple-card"
                style={{ padding: '22px' }}
              >
                {/* Trial shimmer border */}
                {subscription.is_trial && (
                  <div
                    className="pointer-events-none absolute inset-[-1px] animate-trial-glow rounded-3xl"
                    aria-hidden="true"
                  />
                )}
                {/* Background glow */}
                <div
                  className="pointer-events-none absolute"
                  style={{
                    top: -80,
                    right: -50,
                    width: 230,
                    height: 230,
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle, rgba(10,132,255,0.30) 0%, transparent 70%)',
                  }}
                  aria-hidden="true"
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span
                          className="h-[7px] w-[7px] rounded-full"
                          style={{
                            background: statusHex,
                            boxShadow: `0 0 8px ${statusHex}`,
                          }}
                          aria-hidden="true"
                        />
                        <span
                          className="text-[11px] font-semibold uppercase tracking-widest"
                          style={{ color: statusHex }}
                        >
                          {subscription.is_active
                            ? t('subscription.active')
                            : subscription.is_limited
                              ? t('subscription.trafficLimited')
                              : subscription.status === 'disabled'
                                ? t('subscription.pause.suspended')
                                : t('subscription.expired')}
                        </span>
                      </div>
                      <h2 className="truncate text-[28px] font-bold tracking-tight text-apple-ink">
                        {subscription.tariff_name || t('subscription.currentPlan')}
                      </h2>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{
                        background: subscription.is_trial
                          ? 'rgba(255,159,10,0.14)'
                          : 'rgba(10,132,255,0.14)',
                        border: subscription.is_trial
                          ? '1px solid rgba(255,159,10,0.3)'
                          : '1px solid rgba(10,132,255,0.3)',
                        color: subscription.is_trial ? '#ff9f0a' : '#0a84ff',
                      }}
                    >
                      {subscription.is_trial
                        ? t('subscription.trialStatus')
                        : t('subscription.tariffBadge', 'Тариф')}
                    </span>
                  </div>
                  <div className="mt-4">
                    <CountdownTimer
                      endDate={subscription.end_date}
                      isActive={subscription.is_active || subscription.is_limited}
                    />
                  </div>
                </div>
              </div>

              {/* ─── Primary actions ─── */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptic.buttonPressMedium();
                    navigate(renewLink);
                  }}
                  className="flex flex-1 items-center justify-center rounded-full bg-apple-blue py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  {subscription.is_active
                    ? t('subscription.extend')
                    : t('subscription.getSubscription')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic.buttonPressMedium();
                    navigate(renewLink);
                  }}
                  className="flex flex-1 items-center justify-center rounded-full bg-apple-elevated py-3 text-[15px] font-medium text-apple-blue transition-opacity hover:opacity-80"
                >
                  {t('subscription.switchTariff.title', 'Сменить тариф')}
                </button>
              </div>

              {/* ─── Traffic Limited Banner ─── */}
              {subscription.is_limited && (
                <div
                  className="mb-6 rounded-[14px] p-4"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,184,0,0.03))',
                    border: '1px solid rgba(255,184,0,0.2)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'rgba(255,184,0,0.12)' }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ff9f0a"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: '#ff9f0a' }}>
                        {t('subscription.trafficLimitedTitle')}
                      </p>
                      <p className="mt-1 text-xs text-apple-mute">
                        {t('subscription.trafficLimitedDescription')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Trial Info Banner ─── */}
              {subscription.is_trial && subscription.is_active && (
                <div
                  className="mb-6 rounded-[14px] p-4"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(10, 132, 255, 0.08), rgba(10, 132, 255, 0.03))',
                    border: '1px solid rgba(10, 132, 255, 0.12)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'rgba(10, 132, 255, 0.12)' }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgb(10, 132, 255)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold" style={{ color: 'rgb(10, 132, 255)' }}>
                        {t('subscription.trialInfo.title')}
                      </div>
                      <div className="mt-1 text-[12px] text-apple-ink/40">
                        {t('subscription.trialInfo.description')}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(10, 132, 255)' }}
                          >
                            {subscription.days_left > 0
                              ? t('subscription.days', { count: subscription.days_left })
                              : `${subscription.hours_left}${t('subscription.hours')} ${subscription.minutes_left}${t('subscription.minutes')}`}
                          </span>
                          <span className="text-[11px] text-apple-ink/30">
                            {t('subscription.trialInfo.remaining')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(10, 132, 255)' }}
                          >
                            {subscription.traffic_limit_gb || '∞'} {t('common.units.gb')}
                          </span>
                          <span className="text-[11px] text-apple-ink/30">
                            {t('subscription.traffic')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(10, 132, 255)' }}
                          >
                            {subscription.device_limit === 0 ? '∞' : subscription.device_limit}
                          </span>
                          <span className="text-[11px] text-apple-ink/30">
                            {t('subscription.devices')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Usage (traffic + devices) ─── */}
              <div>
                <div className="mb-2.5 px-1.5 text-[13px] font-semibold text-apple-mute">
                  {t('subscription.usage', 'Использование')}
                </div>
                <div className="overflow-hidden rounded-2xl bg-apple-card">
                  {/* Traffic row */}
                  <div className="p-4">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-[15px] text-apple-ink">
                        {t('subscription.traffic')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] text-apple-mute">
                          {isUnlimited
                            ? formatTraffic(usedGb)
                            : `${formatTraffic(usedGb)} / ${formatTraffic(subscription.traffic_limit_gb)}`}
                        </span>
                        <button
                          onClick={() => {
                            haptic.buttonPressMedium();
                            refreshTrafficMutation.mutate();
                          }}
                          disabled={refreshTrafficMutation.isPending || trafficRefreshCooldown > 0}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-apple-mute transition-colors hover:text-apple-ink disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <svg
                            className={`h-3 w-3 ${refreshTrafficMutation.isPending ? 'animate-spin' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                            />
                          </svg>
                          {trafficRefreshCooldown > 0
                            ? `${trafficRefreshCooldown}s`
                            : t('common.refresh')}
                        </button>
                        {subscription.traffic_limit_gb > 0 &&
                          (subscription.is_active || subscription.is_limited) &&
                          !subscription.is_trial && (
                            <button
                              type="button"
                              onClick={() => {
                                haptic.buttonPressMedium();
                                setShowDeviceReduction(false);
                                setShowDeviceTopup(false);
                                setShowServerManagement(false);
                                setShowTrafficTopup(true);
                              }}
                              className="text-[13px] font-medium text-apple-blue transition-opacity hover:opacity-80"
                            >
                              Докупить
                            </button>
                          )}
                      </div>
                    </div>
                    {subscription.traffic_reset_mode &&
                      subscription.traffic_reset_mode !== 'NO_RESET' && (
                        <div className="mb-2 text-[11px] text-apple-faint">
                          {t(`subscription.trafficReset.${subscription.traffic_reset_mode}`)}
                        </div>
                      )}
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${isUnlimited ? 100 : Math.min(100, Math.max(2, usedPercent))}%`,
                          background: '#0a84ff',
                        }}
                      />
                    </div>
                  </div>
                  {/* Devices row */}
                  <div className="flex items-center justify-between gap-3 border-t border-apple-hairline p-4">
                    <div className="min-w-0">
                      <div className="text-[15px] text-apple-ink">{t('subscription.devices')}</div>
                      <div className="mt-0.5 text-[13px] text-apple-mute">
                        {subscription.device_limit === 0
                          ? t('dashboard.devicesConnectedUnlimited', { used: connectedDevices })
                          : t('dashboard.devicesOfMax', {
                              used: connectedDevices,
                              max: subscription.device_limit,
                            })}
                      </div>
                      {isAtDeviceLimit && (
                        <div className="mt-1 text-[11px] font-medium" style={{ color: '#ff9f0a' }}>
                          {t('dashboard.deviceLimitReached')}
                        </div>
                      )}
                    </div>
                    {(subscription.is_active || subscription.is_limited) &&
                      !subscription.is_trial &&
                      subscription.device_limit !== 0 && (
                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              haptic.buttonPressMedium();
                              setShowDeviceTopup(false);
                              setShowTrafficTopup(false);
                              setShowServerManagement(false);
                              setShowDeviceReduction(true);
                            }}
                            className="text-[13px] font-medium text-apple-mute transition-opacity hover:opacity-80"
                          >
                            Уменьшить
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              haptic.buttonPressMedium();
                              setShowDeviceReduction(false);
                              setShowTrafficTopup(false);
                              setShowServerManagement(false);
                              setShowDeviceTopup(true);
                            }}
                            className="text-[13px] font-medium text-apple-blue transition-opacity hover:opacity-80"
                          >
                            Докупить
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* ─── Подключение ─── */}
              {(subscription.subscription_url ||
                (displayedConnectionUrl && !shouldHideConnectionLink)) && (
                <div>
                  <div className="mb-2.5 px-1.5 text-[13px] font-semibold text-apple-mute">
                    {t('subscription.connectionLabel', 'Подключение')}
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-apple-card">
                    {displayedConnectionUrl && !shouldHideConnectionLink && (
                      <div className="p-4">
                        <div className="flex gap-2">
                          <code
                            className="block min-w-0 flex-1 truncate whitespace-nowrap rounded-[10px] bg-apple-elevated px-3 py-2.5 font-mono text-[12px] text-apple-mute"
                            title={displayedConnectionUrl}
                          >
                            {displayedConnectionUrl}
                          </code>
                          <button
                            onClick={() => {
                              haptic.buttonPressMedium();
                              copyUrl();
                            }}
                            className="flex items-center rounded-[10px] px-3.5 transition-colors"
                            style={{
                              background: copied ? 'rgba(10,132,255,0.15)' : '#2c2c2e',
                              color: copied ? '#0a84ff' : '#98989d',
                            }}
                            title={t('subscription.copyLink')}
                          >
                            {copied ? <CheckIcon /> : <CopyIcon />}
                          </button>
                        </div>
                      </div>
                    )}
                    {subscription.subscription_url && (
                      <button
                        type="button"
                        disabled={isAtDeviceLimit}
                        onClick={() => {
                          haptic.buttonPressMedium();
                          if (isAtDeviceLimit) {
                            haptic.error();
                            return;
                          }
                          navigate(
                            subscriptionId ? `/connection?sub=${subscriptionId}` : '/connection',
                          );
                        }}
                        className={`flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-apple-elevated disabled:cursor-not-allowed disabled:opacity-50 ${
                          displayedConnectionUrl && !shouldHideConnectionLink
                            ? 'border-t border-apple-hairline'
                            : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[15px] text-apple-ink">
                            {t('dashboard.connectDevice')}
                          </div>
                          <div className="mt-0.5 text-[13px] text-apple-faint">
                            {t('connection.openHint', 'Открыть в приложении · QR-код')}
                          </div>
                        </div>
                        <span className="shrink-0 text-[18px] text-apple-faint">›</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Purchased Traffic Packages ─── */}
              {subscription.traffic_purchases && subscription.traffic_purchases.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-apple-ink/35">
                    {t('subscription.purchasedTraffic')}
                  </div>
                  <div className="space-y-2">
                    {subscription.traffic_purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className={`rounded-[12px] p-3 ${isDark ? 'bg-apple-elevated' : ''}`}
                        style={{
                          background: isDark ? 'transparent' : g.innerBg,
                          border: isDark ? 'none' : `1px solid ${g.innerBorder}`,
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                              style={{ background: `${zone.mainHex}12` }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={zone.mainHex}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                            <span className="text-sm font-semibold text-apple-ink">
                              {purchase.traffic_gb} {t('common.units.gb')}
                            </span>
                          </div>
                          <div className="text-right">
                            <div
                              className="text-[11px] font-medium"
                              style={{
                                color: purchase.days_remaining === 0 ? '#ff9f0a' : g.textSecondary,
                              }}
                            >
                              {purchase.days_remaining === 0
                                ? t('subscription.expired')
                                : t('subscription.days', { count: purchase.days_remaining })}
                            </div>
                            <div className="mt-0.5 font-mono text-[9px] text-apple-ink/20">
                              {t('subscription.trafficResetAt')}:{' '}
                              {new Date(purchase.expires_at).toLocaleDateString(undefined, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </div>
                          </div>
                        </div>
                        <div
                          className="relative h-1.5 overflow-hidden rounded-full"
                          style={{ background: g.trackBg }}
                        >
                          <div
                            className="absolute inset-0 rounded-full transition-[width] duration-500"
                            style={{
                              width: `${purchase.progress_percent}%`,
                              background: `linear-gradient(90deg, ${zone.mainHex}, ${zone.mainHex}80)`,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between font-mono text-[9px] text-apple-ink/20">
                          <span>{new Date(purchase.created_at).toLocaleDateString()}</span>
                          <span>{new Date(purchase.expires_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()
      ) : (
        <div
          className={`relative overflow-hidden rounded-3xl py-12 text-center ${isDark ? 'bg-apple-card' : 'bg-white'}`}
          style={{
            background: isDark ? 'transparent' : g.cardBg,
            border: isDark ? 'none' : `1px solid ${g.cardBorder}`,
            boxShadow: isDark ? 'none' : g.shadow,
          }}
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: g.hoverBg }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={g.textFaint}
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          </div>
          <div className="text-sm text-apple-ink/30">{t('subscription.noSubscription')}</div>
        </div>
      )}

      {/* Daily Subscription Pause */}
      {subscription && subscription.is_daily && !subscription.is_trial && (
        <div
          className={`relative overflow-hidden rounded-2xl ${isDark ? 'bg-apple-card' : 'bg-white'}`}
          style={{
            background: isDark ? 'transparent' : g.cardBg,
            border: isDark ? 'none' : `1px solid ${g.cardBorder}`,
            boxShadow: isDark ? 'none' : g.shadow,
            padding: '24px 28px',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-apple-ink">
                {t('subscription.pause.title')}
              </h2>
              <div className="mt-1 text-[12px] text-apple-ink/35">
                {subscription.is_limited
                  ? t('subscription.trafficLimited')
                  : subscription.status === 'disabled'
                    ? t('subscription.pause.suspended')
                    : subscription.is_daily_paused
                      ? t('subscription.pause.paused')
                      : t('subscription.pause.active')}
              </div>
            </div>
            <button
              onClick={() => {
                haptic.buttonPressMedium();
                pauseMutation.mutate();
              }}
              disabled={pauseMutation.isPending}
              className="rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors duration-300"
              style={{
                background:
                  subscription.is_daily_paused || subscription.status === 'disabled'
                    ? 'rgba(10, 132, 255, 0.12)'
                    : 'rgba(255,184,0,0.12)',
                border:
                  subscription.is_daily_paused || subscription.status === 'disabled'
                    ? '1px solid rgba(10, 132, 255, 0.2)'
                    : '1px solid rgba(255,184,0,0.2)',
                color:
                  subscription.is_daily_paused || subscription.status === 'disabled'
                    ? 'rgb(10, 132, 255)'
                    : '#ff9f0a',
              }}
            >
              {pauseMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                </span>
              ) : subscription.is_daily_paused || subscription.status === 'disabled' ? (
                t('subscription.pause.resumeBtn')
              ) : (
                t('subscription.pause.pauseBtn')
              )}
            </button>
          </div>

          {/* Pause mutation error */}
          {pauseMutation.isError &&
            (() => {
              const balanceError = getInsufficientBalanceError(pauseMutation.error);
              if (balanceError) {
                const missingAmount = balanceError.required - balanceError.balance;
                return (
                  <div className="mt-4">
                    <InsufficientBalancePrompt
                      missingAmountKopeks={missingAmount}
                      message={t('subscription.pause.insufficientBalance')}
                      compact
                    />
                  </div>
                );
              }
              return (
                <div
                  className="mt-4 rounded-[10px] p-3 text-center text-sm"
                  style={{
                    background: 'rgba(255,59,92,0.08)',
                    border: '1px solid rgba(255,59,92,0.15)',
                    color: '#ff453a',
                  }}
                >
                  {getErrorMessage(pauseMutation.error)}
                </div>
              );
            })()}

          {/* Paused info or Next charge progress bar */}
          {subscription.is_daily_paused ? (
            <div
              className="mt-4 rounded-[12px] p-4"
              style={{
                background: 'rgba(255,184,0,0.06)',
                border: '1px solid rgba(255,184,0,0.12)',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-lg" style={{ color: '#ff9f0a' }}>
                  ⏸️
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#ff9f0a' }}>
                    {t('subscription.pause.pausedInfo')}
                  </div>
                  <div className="mt-1 text-[12px] text-apple-ink/35">
                    {t('subscription.pause.pausedDescription')}{' '}
                    {new Date(subscription.end_date).toLocaleDateString()} (
                    {t('subscription.pause.days', { count: subscription.days_left })})
                  </div>
                </div>
              </div>
            </div>
          ) : (
            subscription.next_daily_charge_at &&
            (() => {
              const now = new Date();
              const nextChargeStr = subscription.next_daily_charge_at.endsWith('Z')
                ? subscription.next_daily_charge_at
                : subscription.next_daily_charge_at + 'Z';
              const nextCharge = new Date(nextChargeStr);
              const totalMs = 24 * 60 * 60 * 1000;
              const remainingMs = Math.max(0, nextCharge.getTime() - now.getTime());
              const elapsedMs = totalMs - remainingMs;
              const progress = Math.min(100, (elapsedMs / totalMs) * 100);

              const hours = Math.floor(remainingMs / (1000 * 60 * 60));
              const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

              return (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-apple-ink/35">
                      {t('subscription.pause.nextCharge')}
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-apple-ink">
                      {hours > 0
                        ? `${hours}${t('subscription.pause.hours')} ${minutes}${t('subscription.pause.minutes')}`
                        : `${minutes}${t('subscription.pause.minutes')}`}
                    </span>
                  </div>
                  <div
                    className="relative h-2 overflow-hidden rounded-full"
                    style={{ background: g.trackBg }}
                  >
                    <div
                      className="absolute inset-0 rounded-full transition-[width] duration-500"
                      style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, rgb(10, 132, 255), rgb(10, 132, 255))',
                      }}
                    />
                  </div>
                  {subscription.daily_price_kopeks && (
                    <div className="mt-2 text-center text-[11px] text-apple-ink/25">
                      {t('subscription.pause.willBeCharged')}:{' '}
                      {formatPrice(subscription.daily_price_kopeks)}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Purchase CTA — only when there is no subscription (active subs use the
          Продлить / Сменить тариф buttons under the hero) */}
      {!subscription && (
        <PurchaseCTAButton subscription={subscription} isMultiTariff={isMultiTariff} />
      )}

      {/* Delete expired subscription */}
      {isMultiTariff &&
        subscription &&
        !subscription.is_active &&
        !subscription.is_trial &&
        !subscription.is_limited && (
          <div className="space-y-3">
            {!showDeleteSheet ? (
              <button
                onClick={async () => {
                  if (platform === 'telegram') {
                    const confirmed = await destructiveConfirm(
                      t(
                        'subscription.deleteWarning',
                        'Подписка будет удалена безвозвратно. Все данные, устройства и настройки будут потеряны.',
                      ),
                      t('subscription.confirmDelete', 'Да, удалить'),
                      t('subscription.deleteTitle', 'Удалить подписку?'),
                    );
                    if (!confirmed) return;
                    setDeleteLoading(true);
                    try {
                      await subscriptionApi.deleteSubscription(subscription.id);
                      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
                      navigate('/subscriptions', { replace: true });
                    } catch {
                      setDeleteLoading(false);
                    }
                  } else {
                    setShowDeleteSheet(true);
                  }
                }}
                disabled={deleteLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/5 p-3.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {t('subscription.delete', 'Удалить подписку')}
              </button>
            ) : (
              <div
                className="rounded-2xl border border-red-400/20 p-4"
                style={{ background: 'rgba(255,59,92,0.04)' }}
              >
                <div className="mb-3 text-sm font-semibold text-red-400">
                  {t('subscription.deleteTitle', 'Удалить подписку?')}
                </div>
                <div className="mb-4 text-xs" style={{ color: g.textSecondary }}>
                  {t(
                    'subscription.deleteWarning',
                    'Подписка будет удалена безвозвратно. Все данные, устройства и настройки будут потеряны. Это действие нельзя отменить.',
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setDeleteLoading(true);
                      try {
                        await subscriptionApi.deleteSubscription(subscription.id);
                        queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
                        navigate('/subscriptions', { replace: true });
                      } catch {
                        setDeleteLoading(false);
                        setShowDeleteSheet(false);
                      }
                    }}
                    disabled={deleteLoading}
                    className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleteLoading
                      ? t('common.processing', 'Удаление...')
                      : t('subscription.confirmDelete', 'Да, удалить')}
                  </button>
                  <button
                    onClick={() => setShowDeleteSheet(false)}
                    className="flex-1 rounded-xl border border-apple-hairline py-2.5 text-sm font-medium transition-colors hover:bg-apple-elevated"
                    style={{ color: g.textSecondary }}
                  >
                    {t('common.cancel', 'Отмена')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Top-up / management forms — triggered from the Использование & Локации
          actions; render only when one is open */}
      {subscription &&
        (subscription.is_active || subscription.is_limited) &&
        !subscription.is_trial &&
        subscription.device_limit !== 0 &&
        (showDeviceTopup || showDeviceReduction || showTrafficTopup || showServerManagement) &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
            onClick={() => {
              setShowDeviceTopup(false);
              setShowDeviceReduction(false);
              setShowTrafficTopup(false);
              setShowServerManagement(false);
            }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-apple-card sm:max-h-[85vh] sm:rounded-3xl"
            >
              {/* Buy Devices */}
              {showDeviceTopup && (
                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-medium text-apple-ink">{t('subscription.buyDevices')}</h3>
                    <button
                      onClick={() => {
                        haptic.buttonPressMedium();
                        setShowDeviceTopup(false);
                      }}
                      className="text-sm text-apple-mute hover:text-apple-ink"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Check if completely unavailable (no subscription, price not set, etc.) */}
                  {devicePriceData?.available === false ? (
                    <div className="py-4 text-center text-sm text-apple-mute">
                      {devicePriceData.reason ||
                        t('subscription.additionalOptions.devicesUnavailable')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Device selector - show even at max limit */}
                      <div className="flex items-center justify-center gap-6">
                        <button
                          onClick={() => {
                            haptic.buttonPressMedium();
                            setDevicesToAdd(Math.max(1, devicesToAdd - 1));
                          }}
                          disabled={devicesToAdd <= 1}
                          className="btn-secondary flex h-12 w-12 items-center justify-center !p-0 text-2xl"
                        >
                          -
                        </button>
                        <div className="text-center">
                          <div className="text-4xl font-bold text-apple-ink">{devicesToAdd}</div>
                          <div className="text-sm text-apple-mute">
                            {t('subscription.additionalOptions.devicesUnit')}
                          </div>
                        </div>
                        <button
                          onClick={() => setDevicesToAdd(devicesToAdd + 1)}
                          disabled={
                            devicePriceData?.max_device_limit
                              ? (devicePriceData.current_device_limit || 0) + devicesToAdd >=
                                devicePriceData.max_device_limit
                              : false
                          }
                          className="btn-secondary flex h-12 w-12 items-center justify-center !p-0 text-2xl"
                        >
                          +
                        </button>
                      </div>

                      {/* Show limit info when at or near max */}
                      {devicePriceData?.max_device_limit && (
                        <div className="text-center text-sm text-apple-mute">
                          {t('subscription.additionalOptions.currentDeviceLimit', {
                            count:
                              devicePriceData.current_device_limit || subscription.device_limit,
                          })}{' '}
                          /{' '}
                          {t('subscription.additionalOptions.maxDevices', {
                            count: devicePriceData.max_device_limit,
                          })}
                        </div>
                      )}

                      {/* Price info - only when available */}
                      {devicePriceData?.available && devicePriceData.price_per_device_label && (
                        <div className="text-center">
                          <div className="mb-2 text-sm text-apple-mute">
                            {/* Show original price with strikethrough if discount */}
                            {devicePriceData.discount_percent &&
                            devicePriceData.discount_percent > 0 ? (
                              <span>
                                <span className="text-apple-mute line-through">
                                  {formatPrice(
                                    devicePriceData.original_price_per_device_kopeks || 0,
                                  )}
                                </span>
                                <span className="mx-1">
                                  {devicePriceData.price_per_device_label}
                                </span>
                              </span>
                            ) : (
                              devicePriceData.price_per_device_label
                            )}
                            /{t('subscription.perDevice').replace('/ ', '')} (
                            {t('subscription.days', { count: devicePriceData.days_left })})
                          </div>
                          {/* Discount badge */}
                          {devicePriceData.discount_percent &&
                            devicePriceData.discount_percent > 0 && (
                              <div className="mb-2">
                                <span className="inline-block rounded-full bg-apple-green/20 px-2.5 py-0.5 text-sm font-medium text-apple-green">
                                  -{devicePriceData.discount_percent}%
                                </span>
                              </div>
                            )}
                          {/* Total price - show as free if 100% discount or 0 */}
                          {devicePriceData.total_price_kopeks === 0 ? (
                            <div className="text-2xl font-bold text-apple-green">
                              {t('subscription.switchTariff.free')}
                            </div>
                          ) : (
                            <div className="text-2xl font-bold text-apple-blue">
                              {/* Show original total with strikethrough if discount */}
                              {devicePriceData.discount_percent &&
                                devicePriceData.discount_percent > 0 &&
                                devicePriceData.base_total_price_kopeks && (
                                  <span className="mr-2 text-lg text-apple-mute line-through">
                                    {formatPrice(devicePriceData.base_total_price_kopeks)}
                                  </span>
                                )}
                              {devicePriceData.total_price_label}
                            </div>
                          )}
                        </div>
                      )}

                      {devicePriceData?.available &&
                        purchaseOptions &&
                        devicePriceData.total_price_kopeks &&
                        devicePriceData.total_price_kopeks > purchaseOptions.balance_kopeks && (
                          <InsufficientBalancePrompt
                            missingAmountKopeks={
                              devicePriceData.total_price_kopeks - purchaseOptions.balance_kopeks
                            }
                            compact
                            onBeforeTopUp={async () => {
                              await subscriptionApi.saveDevicesCart(devicesToAdd, subscriptionId);
                            }}
                          />
                        )}

                      <button
                        onClick={() => {
                          haptic.buttonPressMedium();
                          devicePurchaseMutation.mutate();
                        }}
                        disabled={
                          devicePurchaseMutation.isPending ||
                          !devicePriceData?.available ||
                          !!(
                            devicePriceData?.total_price_kopeks &&
                            purchaseOptions &&
                            devicePriceData.total_price_kopeks > purchaseOptions.balance_kopeks
                          )
                        }
                        className="btn-primary w-full py-3"
                      >
                        {devicePurchaseMutation.isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          </span>
                        ) : (
                          t('subscription.additionalOptions.buy')
                        )}
                      </button>

                      {devicePurchaseMutation.isError && (
                        <div className="text-center text-sm text-apple-red">
                          {getErrorMessage(devicePurchaseMutation.error)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Reduce Devices */}
              <div>
                {showDeviceReduction && (
                  <div className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-medium text-apple-ink">
                        {t('subscription.additionalOptions.reduceDevicesTitle')}
                      </h3>
                      <button
                        onClick={() => setShowDeviceReduction(false)}
                        className="text-sm text-apple-mute hover:text-apple-ink"
                      >
                        ✕
                      </button>
                    </div>

                    {deviceReductionInfo?.available === false ? (
                      <div className="py-4 text-center text-sm text-apple-mute">
                        {deviceReductionInfo.reason ||
                          t('subscription.additionalOptions.reduceUnavailable')}
                      </div>
                    ) : deviceReductionInfo ? (
                      <div className="space-y-4">
                        {/* Device limit selector */}
                        <div className="flex items-center justify-center gap-6">
                          <button
                            onClick={() =>
                              setTargetDeviceLimit(
                                Math.max(
                                  Math.max(
                                    deviceReductionInfo.min_device_limit,
                                    deviceReductionInfo.connected_devices_count,
                                  ),
                                  targetDeviceLimit - 1,
                                ),
                              )
                            }
                            disabled={
                              targetDeviceLimit <=
                              Math.max(
                                deviceReductionInfo.min_device_limit,
                                deviceReductionInfo.connected_devices_count,
                              )
                            }
                            className="btn-secondary flex h-12 w-12 items-center justify-center !p-0 text-2xl"
                          >
                            -
                          </button>
                          <div className="text-center">
                            <div className="text-4xl font-bold text-apple-ink">
                              {targetDeviceLimit}
                            </div>
                            <div className="text-sm text-apple-mute">
                              {t('subscription.additionalOptions.devicesUnit')}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setTargetDeviceLimit(
                                Math.min(
                                  deviceReductionInfo.current_device_limit - 1,
                                  targetDeviceLimit + 1,
                                ),
                              )
                            }
                            disabled={
                              targetDeviceLimit >= deviceReductionInfo.current_device_limit - 1
                            }
                            className="btn-secondary flex h-12 w-12 items-center justify-center !p-0 text-2xl"
                          >
                            +
                          </button>
                        </div>

                        {/* Info */}
                        <div className="space-y-1 text-center text-sm text-apple-mute">
                          <div>
                            {t('subscription.additionalOptions.currentDeviceLimit', {
                              count: deviceReductionInfo.current_device_limit,
                            })}
                          </div>
                          <div>
                            {t('subscription.additionalOptions.minDeviceLimit', {
                              count: deviceReductionInfo.min_device_limit,
                            })}
                          </div>
                          <div>
                            {t('subscription.additionalOptions.connectedDevices', {
                              count: deviceReductionInfo.connected_devices_count,
                            })}
                          </div>
                        </div>

                        {/* Warning if connected devices block reduction */}
                        {deviceReductionInfo.connected_devices_count >
                          deviceReductionInfo.min_device_limit && (
                          <div className="rounded-lg bg-apple-amber/10 p-3 text-center text-sm text-apple-amber">
                            {t('subscription.additionalOptions.disconnectDevicesFirst', {
                              count: deviceReductionInfo.connected_devices_count,
                            })}
                          </div>
                        )}

                        {/* New limit preview */}
                        <div className="text-center">
                          <div className="text-sm text-apple-mute">
                            {t('subscription.additionalOptions.newDeviceLimit', {
                              count: targetDeviceLimit,
                            })}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            haptic.buttonPressMedium();
                            deviceReductionMutation.mutate();
                          }}
                          disabled={
                            deviceReductionMutation.isPending ||
                            targetDeviceLimit >= deviceReductionInfo.current_device_limit ||
                            targetDeviceLimit < deviceReductionInfo.min_device_limit ||
                            targetDeviceLimit < deviceReductionInfo.connected_devices_count
                          }
                          className="btn-primary w-full py-3"
                        >
                          {deviceReductionMutation.isPending ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              {t('subscription.additionalOptions.reducing')}
                            </span>
                          ) : (
                            t('subscription.additionalOptions.reduce')
                          )}
                        </button>

                        {deviceReductionMutation.isError && (
                          <div className="text-center text-sm text-apple-red">
                            {getErrorMessage(deviceReductionMutation.error)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-apple-blue/30 border-t-apple-blue" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Buy Traffic */}
              {subscription.traffic_limit_gb > 0 && (
                <div>
                  {showTrafficTopup && (
                    <div className="p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-medium text-apple-ink">
                          {t('subscription.additionalOptions.buyTrafficTitle')}
                        </h3>
                        <button
                          onClick={() => {
                            setShowTrafficTopup(false);
                            setSelectedTrafficPackage(null);
                          }}
                          className="text-sm text-apple-mute hover:text-apple-ink"
                        >
                          ✕
                        </button>
                      </div>

                      <div
                        className={`mb-4 rounded-lg p-2 text-xs ${isDark ? 'bg-apple-elevated/30 text-apple-mute' : 'bg-champagne-300/40 text-champagne-600'}`}
                      >
                        ⚠️ {t('subscription.additionalOptions.trafficWarning')}
                      </div>

                      {!trafficPackages || trafficPackages.length === 0 ? (
                        <div className="py-4 text-center text-sm text-apple-mute">
                          {t('subscription.additionalOptions.trafficUnavailable')}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            {trafficPackages.map((pkg) => (
                              <button
                                key={pkg.gb}
                                onClick={() => setSelectedTrafficPackage(pkg.gb)}
                                className={`rounded-xl border p-4 text-center transition-all ${
                                  selectedTrafficPackage === pkg.gb
                                    ? 'border-apple-blue bg-apple-blue/10'
                                    : isDark
                                      ? 'border-apple-hairline/50 bg-apple-card/50 hover:border-apple-hairline'
                                      : 'border-champagne-300/60 bg-champagne-200/40 hover:border-champagne-400'
                                }`}
                              >
                                <div className="text-lg font-semibold text-apple-ink">
                                  {pkg.is_unlimited
                                    ? '♾️ ' + t('subscription.additionalOptions.unlimited')
                                    : `${pkg.gb} ${t('common.units.gb')}`}
                                </div>
                                {/* Discount badge */}
                                {pkg.discount_percent && pkg.discount_percent > 0 && (
                                  <div className="mb-1">
                                    <span className="inline-block rounded-full bg-apple-green/20 px-2 py-0.5 text-xs font-medium text-apple-green">
                                      -{pkg.discount_percent}%
                                    </span>
                                  </div>
                                )}
                                {/* Price with original strikethrough if discount */}
                                <div className="font-medium text-apple-blue">
                                  {pkg.discount_percent &&
                                  pkg.discount_percent > 0 &&
                                  pkg.base_price_kopeks ? (
                                    <>
                                      <span className="mr-1 text-sm text-apple-mute line-through">
                                        {formatPrice(pkg.base_price_kopeks)}
                                      </span>
                                      {formatPrice(pkg.price_kopeks)}
                                    </>
                                  ) : (
                                    formatPrice(pkg.price_kopeks)
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>

                          {selectedTrafficPackage !== null &&
                            (() => {
                              const selectedPkg = trafficPackages.find(
                                (p) => p.gb === selectedTrafficPackage,
                              );
                              const hasEnoughBalance =
                                !selectedPkg ||
                                !purchaseOptions ||
                                selectedPkg.price_kopeks <= purchaseOptions.balance_kopeks;
                              const missingAmount =
                                selectedPkg && purchaseOptions
                                  ? selectedPkg.price_kopeks - purchaseOptions.balance_kopeks
                                  : 0;

                              return (
                                <>
                                  {!hasEnoughBalance && missingAmount > 0 && (
                                    <InsufficientBalancePrompt
                                      missingAmountKopeks={missingAmount}
                                      compact
                                      className="mb-3"
                                      onBeforeTopUp={async () => {
                                        await subscriptionApi.saveTrafficCart(
                                          selectedTrafficPackage,
                                          subscriptionId,
                                        );
                                      }}
                                    />
                                  )}
                                  <button
                                    onClick={() =>
                                      trafficPurchaseMutation.mutate(selectedTrafficPackage)
                                    }
                                    disabled={
                                      trafficPurchaseMutation.isPending || !hasEnoughBalance
                                    }
                                    className="btn-primary w-full py-3"
                                  >
                                    {trafficPurchaseMutation.isPending ? (
                                      <span className="flex items-center justify-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                      </span>
                                    ) : selectedPkg?.is_unlimited ? (
                                      t('subscription.additionalOptions.buyUnlimited')
                                    ) : (
                                      t('subscription.additionalOptions.buyTrafficGb', {
                                        gb: selectedTrafficPackage,
                                      })
                                    )}
                                  </button>
                                </>
                              );
                            })()}

                          {trafficPurchaseMutation.isError && (
                            <div className="text-center text-sm text-apple-red">
                              {getErrorMessage(trafficPurchaseMutation.error)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Server Management - only in classic mode */}
              {!isTariffsMode && (
                <div>
                  {showServerManagement && (
                    <div className="p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-medium text-apple-ink">
                          {t('subscription.additionalOptions.manageServersTitle')}
                        </h3>
                        <button
                          onClick={() => {
                            setShowServerManagement(false);
                            setSelectedServersToUpdate([]);
                          }}
                          className="text-sm text-apple-mute hover:text-apple-ink"
                        >
                          ✕
                        </button>
                      </div>

                      {countriesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
                        </div>
                      ) : countriesData && countriesData.countries.length > 0 ? (
                        <div className="space-y-4">
                          <div
                            className={`rounded-lg p-2 text-xs ${isDark ? 'bg-apple-elevated/30 text-apple-mute' : 'bg-champagne-300/40 text-champagne-600'}`}
                          >
                            {t('subscription.serverManagement.statusLegend')}
                          </div>

                          {countriesData.discount_percent > 0 && (
                            <div className="rounded-lg border border-apple-green/30 bg-apple-green/10 p-2 text-xs text-apple-green">
                              🎁{' '}
                              {t('subscription.serverManagement.discountBanner', {
                                percent: countriesData.discount_percent,
                              })}
                            </div>
                          )}

                          <div className="max-h-64 space-y-2 overflow-y-auto">
                            {countriesData.countries
                              .filter((country) => country.is_available || country.is_connected)
                              .map((country) => {
                                const isCurrentlyConnected = country.is_connected;
                                const isSelected = selectedServersToUpdate.includes(country.uuid);
                                const willBeAdded = !isCurrentlyConnected && isSelected;
                                const willBeRemoved = isCurrentlyConnected && !isSelected;

                                return (
                                  <button
                                    key={country.uuid}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedServersToUpdate((prev) =>
                                          prev.filter((u) => u !== country.uuid),
                                        );
                                      } else {
                                        setSelectedServersToUpdate((prev) => [
                                          ...prev,
                                          country.uuid,
                                        ]);
                                      }
                                    }}
                                    disabled={!country.is_available && !isCurrentlyConnected}
                                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                                      isSelected
                                        ? willBeAdded
                                          ? 'border-apple-green bg-apple-green/10'
                                          : 'border-apple-blue bg-apple-blue/10'
                                        : willBeRemoved
                                          ? 'border-apple-red/50 bg-apple-red/5'
                                          : isDark
                                            ? 'border-apple-hairline/50 bg-apple-card/50 hover:border-apple-hairline'
                                            : 'border-champagne-300/60 bg-champagne-200/40 hover:border-champagne-400'
                                    } ${!country.is_available && !isCurrentlyConnected ? 'cursor-not-allowed opacity-50' : ''}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-lg">
                                        {willBeAdded
                                          ? '➕'
                                          : willBeRemoved
                                            ? '➖'
                                            : isSelected
                                              ? '✅'
                                              : '⚪'}
                                      </span>
                                      <div>
                                        <div className="flex items-center gap-2 font-medium text-apple-ink">
                                          {country.name}
                                          {country.has_discount && !isCurrentlyConnected && (
                                            <span className="rounded bg-apple-green/20 px-1.5 py-0.5 text-xs text-apple-green">
                                              -{country.discount_percent}%
                                            </span>
                                          )}
                                        </div>
                                        {willBeAdded && (
                                          <div className="text-xs text-apple-green">
                                            +{formatPrice(country.price_kopeks)}{' '}
                                            {t('subscription.serverManagement.forDays', {
                                              days: countriesData.days_left,
                                            })}
                                            {country.has_discount && (
                                              <span className="ml-1 text-apple-mute line-through">
                                                {formatPrice(
                                                  Math.round(
                                                    (country.base_price_kopeks *
                                                      countriesData.days_left) /
                                                      30,
                                                  ),
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {!willBeAdded && !isCurrentlyConnected && (
                                          <div className="text-xs text-apple-mute">
                                            {formatPrice(country.price_per_month_kopeks)}
                                            {t('subscription.serverManagement.perMonth')}
                                            {country.has_discount && (
                                              <span className="ml-1 text-apple-faint line-through">
                                                {formatPrice(country.base_price_kopeks)}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {!country.is_available && !isCurrentlyConnected && (
                                          <div className="text-xs text-apple-mute">
                                            {t('subscription.serverManagement.unavailable')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {country.country_code && (
                                      <span className="text-xl">
                                        {getFlagEmoji(country.country_code)}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                          </div>

                          {(() => {
                            const currentConnected = countriesData.countries
                              .filter((c) => c.is_connected)
                              .map((c) => c.uuid);
                            const added = selectedServersToUpdate.filter(
                              (u) => !currentConnected.includes(u),
                            );
                            const removed = currentConnected.filter(
                              (u) => !selectedServersToUpdate.includes(u),
                            );
                            const hasChanges = added.length > 0 || removed.length > 0;

                            // Calculate cost for added servers
                            const addedServers = countriesData.countries.filter((c) =>
                              added.includes(c.uuid),
                            );
                            const totalCost = addedServers.reduce(
                              (sum, s) => sum + s.price_kopeks,
                              0,
                            );
                            const hasEnoughBalance =
                              !purchaseOptions || totalCost <= purchaseOptions.balance_kopeks;
                            const missingAmount = purchaseOptions
                              ? totalCost - purchaseOptions.balance_kopeks
                              : 0;

                            return hasChanges ? (
                              <div
                                className={`space-y-3 border-t pt-3 ${isDark ? 'border-apple-hairline/50' : 'border-champagne-300/60'}`}
                              >
                                {added.length > 0 && (
                                  <div className="text-sm">
                                    <span className="text-apple-green">
                                      {t('subscription.serverManagement.toAdd')}
                                    </span>{' '}
                                    <span className="text-apple-mute">
                                      {addedServers.map((s) => s.name).join(', ')}
                                    </span>
                                  </div>
                                )}
                                {removed.length > 0 && (
                                  <div className="text-sm">
                                    <span className="text-apple-red">
                                      {t('subscription.serverManagement.toDisconnect')}
                                    </span>{' '}
                                    <span className="text-apple-mute">
                                      {countriesData.countries
                                        .filter((c) => removed.includes(c.uuid))
                                        .map((s) => s.name)
                                        .join(', ')}
                                    </span>
                                  </div>
                                )}
                                {totalCost > 0 && (
                                  <div className="text-center">
                                    <div className="text-sm text-apple-mute">
                                      {t('subscription.serverManagement.paymentProrated')}
                                    </div>
                                    <div className="text-xl font-bold text-apple-blue">
                                      {formatPrice(totalCost)}
                                    </div>
                                  </div>
                                )}

                                {totalCost > 0 && !hasEnoughBalance && missingAmount > 0 && (
                                  <InsufficientBalancePrompt
                                    missingAmountKopeks={missingAmount}
                                    compact
                                  />
                                )}

                                <button
                                  onClick={() =>
                                    updateCountriesMutation.mutate(selectedServersToUpdate)
                                  }
                                  disabled={
                                    updateCountriesMutation.isPending ||
                                    selectedServersToUpdate.length === 0 ||
                                    (totalCost > 0 && !hasEnoughBalance)
                                  }
                                  className="btn-primary w-full py-3"
                                >
                                  {updateCountriesMutation.isPending ? (
                                    <span className="flex items-center justify-center gap-2">
                                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    </span>
                                  ) : (
                                    t('subscription.serverManagement.applyChanges')
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="py-2 text-center text-sm text-apple-mute">
                                {t('subscription.serverManagement.selectServersHint')}
                              </div>
                            );
                          })()}

                          {updateCountriesMutation.isError && (
                            <div className="text-center text-sm text-apple-red">
                              {getErrorMessage(updateCountriesMutation.error)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-sm text-apple-mute">
                          {t('subscription.serverManagement.noServersAvailable')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* ─── Управление ─── */}
      {subscription &&
        !subscription.is_trial &&
        (!subscription.is_daily || subscription.is_active || subscription.is_limited) && (
          <div>
            <div className="mb-2.5 px-1.5 text-[13px] font-semibold text-apple-mute">
              {t('subscription.management', 'Управление')}
            </div>
            <div className="overflow-hidden rounded-2xl bg-apple-card">
              {/* Autopay */}
              {!subscription.is_daily && (
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-[15px] text-apple-ink">
                      {t('subscription.autoRenewal')}
                    </div>
                    <div className="mt-0.5 text-[13px] text-apple-mute">
                      {t('subscription.daysBeforeExpiry', {
                        count: subscription.autopay_days_before,
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      haptic.buttonPressMedium();
                      autopayMutation.mutate(!subscription.autopay_enabled);
                    }}
                    disabled={autopayMutation.isPending}
                    className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-300 disabled:opacity-50"
                    style={{
                      background: subscription.autopay_enabled ? '#30d158' : '#39393d',
                    }}
                  >
                    <span
                      className="absolute top-[3px] h-[24px] w-[24px] rounded-full bg-white transition-[left] duration-300"
                      style={{
                        left: subscription.autopay_enabled ? '23px' : '3px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  </button>
                </div>
              )}
              {/* Server management */}
              {!isTariffsMode && (subscription.is_active || subscription.is_limited) && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.buttonPressMedium();
                    setShowDeviceTopup(false);
                    setShowDeviceReduction(false);
                    setShowTrafficTopup(false);
                    setShowServerManagement(true);
                  }}
                  className="flex w-full items-center justify-between gap-3 border-t border-apple-hairline p-4 text-left transition-colors hover:bg-apple-elevated"
                >
                  <div className="min-w-0">
                    <div className="text-[15px] text-apple-ink">
                      {t('subscription.additionalOptions.manageServers', 'Управление серверами')}
                    </div>
                    <div className="mt-0.5 text-[13px] text-apple-mute">
                      {t('subscription.servers', {
                        count: subscription.servers?.length || 0,
                      })}
                    </div>
                  </div>
                  <span className="shrink-0 text-[18px] text-apple-faint">›</span>
                </button>
              )}
              {/* Reissue link */}
              {(subscription.is_active || subscription.is_limited) && (
                <button
                  onClick={handleRevoke}
                  disabled={revokeMutation.isPending || revokeCooldown > 0}
                  className="flex w-full items-center justify-between gap-3 border-t border-apple-hairline p-4 text-left transition-colors hover:bg-apple-elevated disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="text-[15px] text-apple-ink">
                      {t('subscription.revoke.button')}
                    </div>
                    <div className="mt-0.5 text-[13px] text-apple-mute">
                      {revokeCooldown > 0
                        ? t('subscription.revoke.cooldown', {
                            minutes: Math.floor(revokeCooldown / 60),
                            seconds: revokeCooldown % 60,
                          })
                        : t('subscription.revoke.description')}
                    </div>
                  </div>
                  {revokeMutation.isPending ? (
                    <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-apple-mute/30 border-t-apple-mute" />
                  ) : (
                    <span className="shrink-0 text-[18px] text-apple-faint">›</span>
                  )}
                </button>
              )}
            </div>
            {revokeMutation.error && (
              <p className="mt-2 px-1.5 text-[13px] text-apple-red">
                {getErrorMessage(revokeMutation.error)}
              </p>
            )}
          </div>
        )}

      {/* ─── Подключённые устройства ─── */}
      {subscription && (
        <div>
          <div className="mb-2.5 flex items-center justify-between px-1.5">
            <span className="text-[13px] font-semibold text-apple-mute">
              {t('subscription.myDevices')}
              {devicesData && devicesData.devices.length > 0 && (
                <span className="ml-1.5 text-apple-faint">
                  {devicesData.device_limit === 0
                    ? `· ${devicesData.total}`
                    : `· ${devicesData.total}/${devicesData.device_limit}`}
                </span>
              )}
            </span>
            {devicesData && devicesData.devices.length > 0 && (
              <button
                onClick={() => {
                  if (confirm(t('subscription.confirmDeleteAllDevices'))) {
                    deleteAllDevicesMutation.mutate();
                  }
                }}
                disabled={deleteAllDevicesMutation.isPending}
                className="text-[13px] font-medium text-apple-red transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {t('subscription.deleteAllDevices')}
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl bg-apple-card">
            {devicesLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
              </div>
            ) : devicesData && devicesData.devices.length > 0 ? (
              devicesData.devices.map((device, i) => (
                <div
                  key={device.hwid}
                  className={`flex items-center gap-3 p-4 ${
                    i !== devicesData.devices.length - 1 ? 'border-b border-apple-hairline' : ''
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-apple-elevated">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0a84ff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-apple-ink">
                      {device.device_model || device.platform}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-apple-faint">
                      <span>{device.platform}</span>
                      <span className="font-mono">{device.hwid.slice(0, 8).toUpperCase()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(t('subscription.confirmDeleteDevice'))) {
                        deleteDeviceMutation.mutate(device.hwid);
                      }
                    }}
                    disabled={deleteDeviceMutation.isPending}
                    className="shrink-0 text-[13px] font-medium text-apple-red transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {t('subscription.deleteDevice')}
                  </button>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-[13px] text-apple-mute">
                {t('subscription.noDevices')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
