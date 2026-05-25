import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useHapticFeedback } from '../platform/hooks/useHaptic';
import { useAuthStore } from '../store/auth';
import { subscriptionApi } from '../api/subscription';
import { referralApi } from '../api/referral';
import { balanceApi } from '../api/balance';
import TrialOfferCard from '../components/dashboard/TrialOfferCard';
import { giftApi } from '../api/gift';
import { promoApi } from '../api/promo';
import PendingGiftCard from '../components/dashboard/PendingGiftCard';
import { API } from '../config/constants';
import { formatTraffic } from '../utils/formatTraffic';

/* ─── Logo (Ultima wordmark) ─── */
const ShieldLogo = ({ className = '' }: { className?: string }) => (
  <img
    src="/logo-main.png"
    alt="Logo"
    className={className}
    // The SVG variant could render as a black square when its embedded
    // pattern failed; hide the image entirely if it ever fails to load.
    onError={(e) => {
      e.currentTarget.style.display = 'none';
    }}
  />
);

/* ─── Icons ─── */
const GlobeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

const UnplugIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m19 5 3-3" />
    <path d="m2 22 3-3" />
    <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
    <path d="M7.5 13.5 10 11" />
    <path d="M10.5 16.5 13 14" />
    <path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z" />
  </svg>
);

const LaptopIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect width="18" height="12" x="3" y="4" rx="2" ry="2" />
    <line x1="2" x2="22" y1="20" y2="20" />
  </svg>
);

export default function Dashboard() {
  const { t } = useTranslation();
  const haptic = useHapticFeedback();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const queryClient = useQueryClient();
  const [trialError, setTrialError] = useState<string | null>(null);
  const [showDevicePanel, setShowDevicePanel] = useState(false);

  // Refresh user data on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Fetch balance from API
  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  const { data: subscriptionResponse, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  const subscription = subscriptionResponse?.subscription ?? null;

  const { data: trialInfo, isLoading: trialLoading } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: !subscription && !subLoading,
  });

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
    enabled: !!subscription,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (hwid: string) => subscriptionApi.deleteDevice(hwid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  // Warm the referral-info cache for other pages.
  useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
  });

  // Fetch purchase options for min price display
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options'],
    queryFn: () => subscriptionApi.getPurchaseOptions(),
    staleTime: 60000,
    retry: false,
  });

  const { data: pendingGifts } = useQuery({
    queryKey: ['pending-gifts'],
    queryFn: giftApi.getPendingGifts,
    staleTime: 30_000,
    retry: false,
  });

  const { data: _promoGroupData } = useQuery({
    queryKey: ['promo-group-discounts'],
    queryFn: promoApi.getGroupDiscounts,
    staleTime: 60_000,
    retry: false,
  });

  const activateTrialMutation = useMutation({
    mutationFn: subscriptionApi.activateTrial,
    onSuccess: () => {
      setTrialError(null);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['trial-info'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      refreshUser();
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      setTrialError(error.response?.data?.detail || t('common.error'));
    },
  });

  // Traffic refresh state and mutation
  const [trafficRefreshCooldown, setTrafficRefreshCooldown] = useState(0);
  const [trafficData, setTrafficData] = useState<{
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null>(null);

  const refreshTrafficMutation = useMutation({
    mutationFn: () => subscriptionApi.refreshTraffic(),
    onSuccess: (data) => {
      setTrafficData({
        traffic_used_gb: data.traffic_used_gb,
        traffic_used_percent: data.traffic_used_percent,
        is_unlimited: data.is_unlimited,
      });
      localStorage.setItem('traffic_refresh_ts', Date.now().toString());
      if (data.rate_limited && data.retry_after_seconds) {
        setTrafficRefreshCooldown(data.retry_after_seconds);
      } else {
        setTrafficRefreshCooldown(30);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
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

  // Cooldown timer
  useEffect(() => {
    if (trafficRefreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setTrafficRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [trafficRefreshCooldown]);

  // Auto-refresh traffic on mount (with 30s caching)
  const hasAutoRefreshed = useRef(false);

  useEffect(() => {
    if (!subscription) return;
    if (hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;

    const lastRefresh = localStorage.getItem('traffic_refresh_ts');
    const now = Date.now();
    const cacheMs = API.TRAFFIC_CACHE_MS;

    if (lastRefresh && now - parseInt(lastRefresh, 10) < cacheMs) {
      const elapsed = now - parseInt(lastRefresh, 10);
      const remaining = Math.ceil((cacheMs - elapsed) / 1000);
      if (remaining > 0) {
        setTrafficRefreshCooldown(remaining);
      }
      return;
    }

    refreshTrafficMutation.mutate();
  }, [subscription, refreshTrafficMutation]);

  const hasNoSubscription = subscriptionResponse?.has_subscription === false && !subLoading;

  // ── Derived display data ──
  const usedGb = trafficData?.traffic_used_gb ?? subscription?.traffic_used_gb ?? 0;

  // Subscription status derivation
  const subscriptionStatus = useMemo(() => {
    if (!subscription) return { label: '', color: 'rgba(255,255,255,0.4)' };
    if (subscription.is_expired) return { label: 'Истекла', color: '#ef4444' };
    if (subscription.is_limited) return { label: 'Лимит', color: 'var(--figma-green)' };
    if (subscription.status === 'disabled') return { label: 'Отключена', color: '#ef4444' };
    if (subscription.is_active) return { label: 'Активна', color: 'var(--figma-green)' };
    return { label: subscription.status, color: 'rgba(255,255,255,0.4)' };
  }, [subscription]);

  const formattedDate = subscription
    ? new Date(subscription.end_date).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const deviceCount = devicesData?.total ?? 0;

  // Compute minimum tariff price for CTA button
  const minPriceLabel = useMemo(() => {
    if (!purchaseOptions) return '';
    let minKopeks = Infinity;
    if (purchaseOptions.sales_mode === 'tariffs') {
      for (const tariff of purchaseOptions.tariffs) {
        for (const period of tariff.periods) {
          if (period.price_kopeks < minKopeks) minKopeks = period.price_kopeks;
        }
      }
    } else if (purchaseOptions.sales_mode === 'classic') {
      for (const period of purchaseOptions.periods) {
        if (period.price_kopeks < minKopeks) minKopeks = period.price_kopeks;
      }
    }
    if (minKopeks === Infinity) return '';
    const rubles = Math.round(minKopeks / 100);
    return `от ${rubles}\u00A0₽`;
  }, [purchaseOptions]);

  // ── Expired / Disabled / Limited ──
  if (
    !subLoading &&
    subscription &&
    (subscription.is_expired || subscription.status === 'disabled' || subscription.is_limited)
  ) {
    const expiredDate = new Date(subscription.end_date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const statusLabel = subscription.is_expired
      ? 'ПОДПИСКА ИСТЕКЛА'
      : subscription.is_limited
        ? 'ЛИМИТ ИСЧЕРПАН'
        : 'ПОДПИСКА ОТКЛЮЧЕНА';

    return (
      <div
        className="fixed inset-0 bottom-[80px] flex flex-col overflow-hidden px-5"
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      >
        {/* Hero area — large status text replaces logo */}
        <div className="relative flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative z-10 px-4 text-center"
          >
            <h1
              className="text-4xl font-black leading-tight text-white sm:text-5xl"
              style={{ letterSpacing: '0.12em', fontStretch: 'expanded' }}
            >
              {statusLabel}
            </h1>
            <p
              className="mt-4 text-2xl font-semibold text-white/60 sm:text-3xl"
              style={{ letterSpacing: '0.08em', fontStretch: 'expanded' }}
            >
              {expiredDate}
            </p>
          </motion.div>
        </div>

        {/* Bottom CTA buttons */}
        <div className="mt-auto space-y-2 pb-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Link
              to="/subscription/purchase?renew=1"
              onClick={() => haptic.buttonPressMedium()}
              className="flex h-14 w-full transform-gpu items-center justify-center gap-2 rounded-full px-[18px] text-base font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97] active:brightness-90"
              style={{ background: 'var(--figma-green)' }}
            >
              <GlobeIcon />
              <span>{t('dashboard.expired.renew')}</span>
              {minPriceLabel && (
                <span className="ml-auto shrink-0 text-right text-white/70">{minPriceLabel}</span>
              )}
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Link
              to="/connection"
              onClick={() => haptic.buttonPressMedium()}
              className="flex h-14 w-full transform-gpu items-center gap-2 rounded-full bg-white px-[18px] text-base font-medium text-black transition-all duration-200 hover:brightness-95 active:scale-[0.97] active:brightness-90"
            >
              <UnplugIcon />
              <span>{t('dashboard.connectDevice')}</span>
              <span className="ml-auto flex text-gray-400">
                <LaptopIcon />
              </span>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bottom-[80px] flex flex-col overflow-hidden px-5"
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      data-onboarding="welcome"
    >
      {/* Pending Gift Activations */}
      {pendingGifts && pendingGifts.length > 0 && <PendingGiftCard gifts={pendingGifts} />}

      {/* ─── Hero Area: Logo ─── */}
      <div className="relative flex flex-1 items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div style={{ transform: 'translateX(-5%)' }}>
            <ShieldLogo className="w-[288px] opacity-90 sm:w-[384px]" />
          </div>
        </motion.div>
      </div>

      {/* ─── Bottom Section ─── */}
      <div className="mt-auto space-y-2 pb-2">
        {/* Subscription Info Row */}
        {subscription && !subLoading && (
          <motion.div
            className="flex items-center justify-between py-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex flex-col text-lg leading-5">
              <span
                className="text-xl font-black"
                style={{
                  letterSpacing: '0.04em',
                  fontStretch: 'expanded',
                  textShadow: '0.5px 0 0 currentColor',
                }}
              >
                {t('dashboard.validUntil', { date: formattedDate })}
              </span>
              <span
                className="mt-1 text-base font-medium"
                style={{ color: subscriptionStatus.color }}
              >
                {subscriptionStatus.label} · {formatTraffic(usedGb)}/
                {subscription.traffic_limit_gb > 0
                  ? formatTraffic(subscription.traffic_limit_gb)
                  : '∞'}
              </span>
            </div>

            {/* Device count pill */}
            <button
              onClick={() => {
                haptic.buttonPressMedium();
                setShowDevicePanel(!showDevicePanel);
              }}
              className="flex h-9 items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              data-onboarding="connect-devices"
            >
              {t('dashboard.devicesLabel', 'Устройства')} {deviceCount}/
              {subscription?.device_limit ?? 0}
            </button>
          </motion.div>
        )}

        {/* ─── Device Panel ─── */}
        <AnimatePresence>
          {showDevicePanel && devicesData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'tween', duration: 0.15, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5 rounded-2xl bg-black/40 p-2 backdrop-blur-2xl">
                {devicesData.devices.length > 0 ? (
                  devicesData.devices.map((device) => {
                    const platform = (device.platform || '').toLowerCase();
                    const isMobile = /(android|ios|iphone|ipad|mobile)/.test(platform);
                    const isDesktop = /(windows|win|mac|linux|desktop)/.test(platform);
                    const displayName =
                      device.local_name?.trim() ||
                      device.device_model?.trim() ||
                      device.platform ||
                      t('subscription.deviceFallback', 'Устройство');
                    const subtitle = device.local_name?.trim()
                      ? device.device_model || device.platform
                      : device.platform;
                    return (
                      <div
                        key={device.hwid}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/5 p-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white/5">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="rgba(255,255,255,0.55)"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              {isDesktop ? (
                                <>
                                  <rect x="2" y="4" width="20" height="13" rx="2" />
                                  <path d="M8 21h8M12 17v4" />
                                </>
                              ) : isMobile ? (
                                <>
                                  <rect x="7" y="2" width="10" height="20" rx="2.5" />
                                  <path d="M11 18h2" />
                                </>
                              ) : (
                                <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                              )}
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-white">
                              {displayName}
                            </div>
                            {subtitle && subtitle !== displayName && (
                              <div className="truncate text-[11px] text-white/40">{subtitle}</div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            haptic.buttonPressMedium();
                            if (confirm(t('subscription.confirmDeleteDevice'))) {
                              deleteDeviceMutation.mutate(device.hwid);
                            }
                          }}
                          disabled={deleteDeviceMutation.isPending}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
                          title={t('subscription.deleteDevice')}
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                    <span className="text-[20px] opacity-30">📱</span>
                    <div className="text-[12px] text-white/40">
                      {t('subscription.noDevicesConnected', {
                        defaultValue: 'Нет подключенных устройств',
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {subLoading && (
          <div className="flex items-center justify-between py-4">
            <div>
              <div className="skeleton mb-2 h-5 w-40" />
              <div className="skeleton h-4 w-24" />
            </div>
            <div className="skeleton h-8 w-28 rounded-full" />
          </div>
        )}

        {/* Trial Activation */}
        {hasNoSubscription && !trialLoading && trialInfo?.is_available && (
          <TrialOfferCard
            trialInfo={trialInfo}
            balanceKopeks={balanceData?.balance_kopeks || 0}
            balanceRubles={balanceData?.balance_rubles || 0}
            activateTrialMutation={activateTrialMutation}
            trialError={trialError}
          />
        )}

        {/* CTA: Renew Subscription */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Link
            to={hasNoSubscription ? '/subscription/purchase' : '/subscription/purchase?renew=1'}
            onClick={() => haptic.buttonPressMedium()}
            className="flex h-14 w-full transform-gpu items-center gap-2 rounded-full px-[18px] text-base font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97] active:brightness-90"
            style={{ background: 'var(--figma-green)' }}
          >
            <GlobeIcon />
            <span>
              {hasNoSubscription
                ? t('dashboard.expired.buy', 'Купить подписку')
                : t('dashboard.expired.renew')}
            </span>
            {minPriceLabel && (
              <span className="ml-auto shrink-0 text-right text-white/70">{minPriceLabel}</span>
            )}
          </Link>
        </motion.div>

        {/* CTA: Setup & Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Link
            to="/connection"
            onClick={() => haptic.buttonPressMedium()}
            className="flex h-14 w-full transform-gpu items-center gap-2 rounded-full bg-white px-[18px] text-base font-medium text-black transition-all duration-200 hover:brightness-95 active:scale-[0.97] active:brightness-90"
          >
            <UnplugIcon />
            <span>{t('dashboard.connectDevice')}</span>
            <span className="ml-auto flex text-gray-400">
              <LaptopIcon />
            </span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
