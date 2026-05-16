import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { DEVICE_ALIAS_MAX_LENGTH } from '../constants/devices';
import { useDestructiveConfirm } from '../platform/hooks/useNativeDialog';
import { usePlatform } from '../platform';
import { formatTraffic } from '../utils/formatTraffic';
import { getGlassColors } from '../utils/glassTheme';
import { useTheme } from '../hooks/useTheme';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import { useCurrency } from '../hooks/useCurrency';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import PurchaseCTAButton from '../components/subscription/PurchaseCTAButton';
import { CopyIcon, CheckIcon } from '../components/icons';
import { useHapticFeedback } from '../platform/hooks/useHaptic';
import { useNotify } from '../platform/hooks/useNotify';
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
        {isExpired ? t('subscription.statusShort', 'Статус') : t('dashboard.remaining')}
      </div>
      {isExpired ? (
        <>
          <div className="text-[20px] font-bold tracking-tight" style={{ color: '#ff453a' }}>
            {t('subscription.expired')}
          </div>
          <div className="mt-1.5 text-[12px] text-apple-mute">
            {t('subscription.endedOn', 'Срок действия истёк')}: {formattedDate}
          </div>
        </>
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

// iOS Settings-style leading icon tile: colored rounded square + white glyph.
const ROW_ICON = {
  link: {
    d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    color: '#0A84FF',
  },
  device: {
    d: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
    color: '#34C759',
  },
  autopay: {
    d: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    color: '#FF9F0A',
  },
  server: {
    d: 'M5 2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM5 14h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM7 6h.01M7 18h.01',
    color: '#5856D6',
  },
  reissue: { d: 'M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10', color: '#AF52DE' },
  traffic: {
    d: 'M7 16a4 4 0 0 1-.88-7.9A5 5 0 0 1 15.9 6 5 5 0 0 1 17 15.9M15 13l-3-3-3 3M12 10v8',
    color: '#5AC8FA',
  },
} as const;

const RowIcon = ({ icon }: { icon: keyof typeof ROW_ICON }) => {
  const { d, color } = ROW_ICON[icon];
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
      style={{ background: color }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    </span>
  );
};

// Pill-style slider — track, filler and thumb share one height (apple-dark)
const SLIDER_H = 28;
const SLIDER_INSET = 14;
const PillSlider = ({
  min,
  max,
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  'aria-label'?: string;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const span = Math.max(1, max - min);
  const clamped = Math.min(Math.max(value, min), max);
  const pct = ((clamped - min) / span) * 100;
  const steps = max - min + 1;
  const showDots = steps > 1;
  // dots / fill edge travel within an inset on each side
  const at = (p: number) => `calc(${SLIDER_INSET}px + (100% - ${2 * SLIDER_INSET}px) * ${p / 100})`;

  // Map a pointer X to the nearest step — thumb follows the finger exactly
  const valueFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return clamped;
    const r = el.getBoundingClientRect();
    const usable = Math.max(1, r.width - 2 * SLIDER_INSET);
    const rel = (clientX - r.left - SLIDER_INSET) / usable;
    return Math.min(max, Math.max(min, Math.round(min + rel * span)));
  };
  const apply = (clientX: number) => {
    const v = valueFromX(clientX);
    if (v !== clamped) onChange(v);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer may already be released */
    }
    setDragging(true);
    apply(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    apply(e.clientX);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (clamped > min) onChange(clamped - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (clamped < max) onChange(clamped + 1);
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={onKeyDown}
      className="relative w-full cursor-pointer touch-none select-none outline-none"
      style={{ height: SLIDER_H }}
    >
      {/* track */}
      <div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        {/* filler — extends a little past the current dot */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `calc(${at(pct)} + 14px)`,
            background: '#F97315',
            transition: dragging ? 'none' : 'width 0.12s ease-out',
          }}
        />
      </div>
      {/* step dots — the current one is enlarged, acts as the handle */}
      {showDots &&
        Array.from({ length: steps }).map((_, i) => {
          const dotPct = (i / (steps - 1)) * 100;
          const inRange = dotPct <= pct + 0.01;
          const isCurrent = i === clamped - min;
          const size = isCurrent ? 20 : 8;
          return (
            <span
              key={i}
              aria-hidden="true"
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: size,
                height: size,
                left: at(dotPct),
                background: isCurrent
                  ? 'rgba(0,0,0,0.6)'
                  : inRange
                    ? 'rgba(0,0,0,0.4)'
                    : 'rgba(255,255,255,0.28)',
              }}
            />
          );
        })}
    </div>
  );
};

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
  const notify = useNotify();
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
  const [showDeviceManage, setShowDeviceManage] = useState(false);
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

  const usedPercent = trafficData?.traffic_used_percent ?? subscription?.traffic_used_percent ?? 0;

  // Purchase options (needed for balance_kopeks in device/traffic/server management)
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const isTariffsMode = purchaseOptions?.sales_mode === 'tariffs';

  // Price of the selected tariff (per-month / daily) — best-effort across modes
  const tariffPriceLabel: string | null = (() => {
    if (!subscription) return null;
    if (subscription.daily_price_kopeks) return formatPrice(subscription.daily_price_kopeks);
    if (purchaseOptions?.sales_mode === 'tariffs') {
      const cur = purchaseOptions.tariffs?.find((tr) => tr.is_current);
      return cur?.periods?.[0]?.price_per_month_label ?? null;
    }
    if (purchaseOptions?.sales_mode === 'classic') {
      const per = purchaseOptions.periods?.find(
        (p) => p.id === purchaseOptions.selection?.period_id,
      );
      return per?.per_month_price_label ?? per?.price_label ?? null;
    }
    return null;
  })();

  // Device limit included in the current tariff — reduction can't go below it
  const currentTariff =
    purchaseOptions?.sales_mode === 'tariffs'
      ? purchaseOptions.tariffs?.find((tr) => tr.is_current)
      : undefined;
  const tariffDeviceLimit = currentTariff?.base_device_limit ?? currentTariff?.device_limit ?? 0;

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
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  // Inline device rename. Only one row is editable at a time —
  // `editingDeviceHwid` doubles as the toggle and the target hwid.
  const [editingDeviceHwid, setEditingDeviceHwid] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');

  const renameDeviceMutation = useMutation({
    mutationFn: ({ hwid, name }: { hwid: string; name: string | null }) =>
      subscriptionApi.renameDevice(hwid, name, subscriptionId),
    onSuccess: () => {
      setEditingDeviceHwid(null);
      setEditingDeviceName('');
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
    // Keep the row in edit mode on failure so the user can retry.
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  // Delete all devices mutation
  const deleteAllDevicesMutation = useMutation({
    mutationFn: () => subscriptionApi.deleteAllDevices(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
    onError: (error) => notify.error(getErrorMessage(error)),
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
    setShowDeviceManage(false);
    setShowTrafficTopup(false);
    setShowServerManagement(false);
  }, []);
  useCloseOnSuccessNotification(handleCloseAllModals);

  // Devices: one slider drives both add (above current limit) and reduce (below)
  const deviceCurrentLimit = subscription?.device_limit ?? 0;
  const deviceAddCount = Math.max(1, targetDeviceLimit - deviceCurrentLimit);

  // Debounce the priced count so dragging the slider doesn't spam the API
  const [debouncedAddCount, setDebouncedAddCount] = useState(deviceAddCount);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedAddCount(deviceAddCount), 220);
    return () => clearTimeout(id);
  }, [deviceAddCount]);

  // Device price query — priced for how many devices we'd add
  const { data: devicePriceData } = useQuery({
    queryKey: ['device-price', debouncedAddCount, subscriptionId],
    queryFn: () => subscriptionApi.getDevicePrice(debouncedAddCount, subscriptionId),
    enabled: showDeviceManage && !!subscription,
    placeholderData: (prev) => prev,
  });

  // Device purchase mutation
  const devicePurchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.purchaseDevices(deviceAddCount, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['device-price'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      setShowDeviceManage(false);
    },
  });

  // Device reduction info query
  const { data: deviceReductionInfo } = useQuery({
    queryKey: ['device-reduction-info', subscriptionId],
    queryFn: () => subscriptionApi.getDeviceReductionInfo(subscriptionId),
    enabled: showDeviceManage && !!subscription,
  });

  // Reset the slider to the current limit each time the panel opens
  useEffect(() => {
    if (showDeviceManage) setTargetDeviceLimit(deviceCurrentLimit);
  }, [showDeviceManage, deviceCurrentLimit]);

  // Lock body scroll + Escape-to-close while a bottom-sheet modal is open
  useEffect(() => {
    if (!showDeviceManage && !showTrafficTopup) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeviceManage(false);
        setShowTrafficTopup(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [showDeviceManage, showTrafficTopup]);

  // Device reduction mutation
  const deviceReductionMutation = useMutation({
    mutationFn: () => subscriptionApi.reduceDevices(targetDeviceLimit, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['device-reduction-info', subscriptionId] });
      setShowDeviceManage(false);
    },
  });

  // Traffic packages query
  const { data: trafficPackages } = useQuery({
    queryKey: ['traffic-packages', subscriptionId],
    queryFn: () => subscriptionApi.getTrafficPackages(subscriptionId),
    enabled: showTrafficTopup && !!subscription,
  });

  // Default the traffic-package slider to the first package once they load
  useEffect(() => {
    if (showTrafficTopup && trafficPackages && trafficPackages.length > 0) {
      setSelectedTrafficPackage((prev) =>
        prev !== null && trafficPackages.some((p) => p.gb === prev) ? prev : trafficPackages[0].gb,
      );
    }
  }, [showTrafficTopup, trafficPackages]);

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
      // RemnaWave resets device HWIDs on revoke — make sure the cabinet
      // re-reads the now-empty device list instead of showing the stale cache.
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
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
              : '/subscription/purchase?renew=1';

          return (
            <>
              {/* ─── Hero status card ─── */}
              <div
                className="apple-card-grad relative overflow-hidden rounded-3xl bg-apple-card"
                style={{ padding: '22px' }}
              >
                {/* Trial shimmer border */}
                {subscription.is_trial && (
                  <div
                    className="pointer-events-none absolute inset-[-1px] animate-trial-glow rounded-3xl"
                    aria-hidden="true"
                  />
                )}
                <div className="relative">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-apple-mute">
                      {subscription.is_trial
                        ? t('subscription.trialStatus')
                        : t('subscription.tariffBadge', 'Тариф')}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        className="h-[7px] w-[7px] rounded-full"
                        style={{ background: statusHex }}
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
                    </span>
                  </div>
                  <h2 className="truncate text-[28px] font-bold tracking-tight text-apple-ink">
                    {subscription.tariff_name || t('subscription.currentPlan')}
                  </h2>
                  {tariffPriceLabel && (
                    <div className="mt-0.5 text-[14px] text-apple-mute">{tariffPriceLabel}</div>
                  )}
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
                    navigate('/subscription/purchase');
                  }}
                  className="flex flex-1 items-center justify-center rounded-full bg-white py-3 text-[15px] font-medium text-black transition-opacity hover:opacity-90"
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

              {/* ─── Usage (traffic + devices) ─── */}
              <div>
                <div className="mb-2.5 px-1.5 text-[13px] font-semibold text-apple-mute">
                  {t('subscription.usage', 'Использование')}
                </div>
                <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
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
                                setShowDeviceManage(false);
                                setShowServerManagement(false);
                                setShowTrafficTopup(true);
                              }}
                              className="rounded-full bg-apple-elevated px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
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
                          background: '#F97315',
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
                    </div>
                    {(subscription.is_active || subscription.is_limited) &&
                      !subscription.is_trial &&
                      subscription.device_limit !== 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            haptic.buttonPressMedium();
                            setShowTrafficTopup(false);
                            setShowServerManagement(false);
                            setShowDeviceManage((v) => !v);
                          }}
                          className="shrink-0 rounded-full bg-apple-elevated px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
                        >
                          Изменить
                        </button>
                      )}
                  </div>
                  {/* Manage devices — bottom-sheet modal */}
                  {showDeviceManage &&
                    createPortal(
                      <div
                        className="apple-sheet-backdrop fixed inset-0 z-[100] flex items-end justify-center"
                        style={{ background: 'rgba(0,0,0,0.5)' }}
                        onClick={() => setShowDeviceManage(false)}
                      >
                        <div
                          className="apple-sheet-panel relative m-2.5 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[32px] bg-black"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Close */}
                          <button
                            type="button"
                            onClick={() => {
                              haptic.buttonPressMedium();
                              setShowDeviceManage(false);
                            }}
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
                          {/* Header */}
                          <div className="px-7 pb-2 pr-16 pt-5 text-[22px] font-semibold leading-[26px] text-white">
                            Управление устройствами
                          </div>
                          {/* Body */}
                          <div className="flex flex-col px-7 pb-7 pt-2">
                            {!deviceReductionInfo && !devicePriceData ? (
                              <div className="flex items-center justify-center py-8">
                                <span className="h-6 w-6 animate-spin rounded-full border-2 border-apple-blue/30 border-t-apple-blue" />
                              </div>
                            ) : (
                              (() => {
                                const reduceOk =
                                  !!deviceReductionInfo && deviceReductionInfo.available !== false;
                                const addOk = devicePriceData?.available !== false;
                                const connected =
                                  deviceReductionInfo?.connected_devices_count ?? connectedDevices;
                                const minLimit = Math.max(
                                  reduceOk
                                    ? deviceReductionInfo!.min_device_limit
                                    : deviceCurrentLimit,
                                  connected,
                                  tariffDeviceLimit,
                                );
                                const maxLimit =
                                  addOk && devicePriceData?.max_device_limit
                                    ? devicePriceData.max_device_limit
                                    : deviceCurrentLimit;
                                if (minLimit >= maxLimit) {
                                  return (
                                    <div className="py-6 text-center text-sm text-apple-mute">
                                      {devicePriceData?.reason ||
                                        deviceReductionInfo?.reason ||
                                        t('subscription.additionalOptions.devicesUnavailable')}
                                    </div>
                                  );
                                }
                                const target = Math.min(
                                  Math.max(targetDeviceLimit, minLimit),
                                  maxLimit,
                                );
                                const delta = target - deviceCurrentLimit;
                                const insufficient = !!(
                                  delta > 0 &&
                                  devicePriceData?.total_price_kopeks &&
                                  purchaseOptions &&
                                  devicePriceData.total_price_kopeks >
                                    purchaseOptions.balance_kopeks
                                );
                                const unit = t('subscription.additionalOptions.devicesUnit');
                                const pending =
                                  devicePurchaseMutation.isPending ||
                                  deviceReductionMutation.isPending;
                                return (
                                  <>
                                    {/* Status banner */}
                                    <div
                                      className="mb-4 mt-1 flex items-center gap-2 rounded-xl p-4 text-sm font-medium"
                                      style={{
                                        background:
                                          delta > 0
                                            ? 'rgba(249,115,21,0.16)'
                                            : delta < 0
                                              ? 'rgba(255,69,58,0.16)'
                                              : 'rgba(255,255,255,0.06)',
                                        color:
                                          delta > 0 ? '#F97315' : delta < 0 ? '#ff6961' : '#98989d',
                                      }}
                                    >
                                      <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="shrink-0"
                                        aria-hidden="true"
                                      >
                                        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                                      </svg>
                                      <span>
                                        {delta > 0
                                          ? `Подписка расширится до ${target} ${unit}`
                                          : delta < 0
                                            ? `Подписка сократится до ${target} ${unit}`
                                            : `Количество устройств: ${target}`}
                                      </span>
                                    </div>

                                    {/* Slider */}
                                    <PillSlider
                                      min={minLimit}
                                      max={maxLimit}
                                      value={target}
                                      aria-label={unit}
                                      onChange={(v) => {
                                        haptic.buttonPressMedium();
                                        setTargetDeviceLimit(v);
                                      }}
                                    />

                                    {/* Insufficient balance */}
                                    {insufficient && (
                                      <div className="mt-4">
                                        <InsufficientBalancePrompt
                                          missingAmountKopeks={
                                            (devicePriceData?.total_price_kopeks || 0) -
                                            (purchaseOptions?.balance_kopeks || 0)
                                          }
                                          compact
                                          onBeforeTopUp={async () => {
                                            await subscriptionApi.saveDevicesCart(
                                              delta,
                                              subscriptionId,
                                            );
                                          }}
                                        />
                                      </div>
                                    )}

                                    {/* CTA */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        haptic.buttonPressMedium();
                                        if (delta > 0) devicePurchaseMutation.mutate();
                                        else if (delta < 0) deviceReductionMutation.mutate();
                                      }}
                                      disabled={
                                        delta === 0 ||
                                        pending ||
                                        (delta > 0 && (!devicePriceData?.available || insufficient))
                                      }
                                      className="mt-5 flex h-14 w-full items-center justify-center rounded-full text-[16px] font-medium transition-opacity disabled:cursor-not-allowed"
                                      style={{
                                        background:
                                          delta > 0
                                            ? '#F97315'
                                            : delta < 0
                                              ? '#ff453a'
                                              : 'rgba(255,255,255,0.08)',
                                        color: delta === 0 ? '#98989d' : '#fff',
                                        opacity: (delta > 0 && insufficient) || pending ? 0.6 : 1,
                                      }}
                                    >
                                      {pending ? (
                                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                      ) : delta > 0 ? (
                                        `Расширить до ${target} ${unit} за ${devicePriceData?.total_price_label ?? ''}`
                                      ) : delta < 0 ? (
                                        `Уменьшить до ${target} ${unit}`
                                      ) : (
                                        'Измените количество устройств'
                                      )}
                                    </button>

                                    {(devicePurchaseMutation.isError ||
                                      deviceReductionMutation.isError) && (
                                      <div className="mt-3 text-center text-sm text-apple-red">
                                        {getErrorMessage(
                                          devicePurchaseMutation.error ||
                                            deviceReductionMutation.error,
                                        )}
                                      </div>
                                    )}
                                  </>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      </div>,
                      document.body,
                    )}

                  {/* Buy traffic — bottom-sheet modal */}
                  {showTrafficTopup &&
                    subscription.traffic_limit_gb > 0 &&
                    createPortal(
                      <div
                        className="apple-sheet-backdrop fixed inset-0 z-[100] flex items-end justify-center"
                        style={{ background: 'rgba(0,0,0,0.5)' }}
                        onClick={() => {
                          setShowTrafficTopup(false);
                          setSelectedTrafficPackage(null);
                        }}
                      >
                        <div
                          className="apple-sheet-panel relative m-2.5 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[32px] bg-black"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Close */}
                          <button
                            type="button"
                            onClick={() => {
                              haptic.buttonPressMedium();
                              setShowTrafficTopup(false);
                              setSelectedTrafficPackage(null);
                            }}
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
                          {/* Header */}
                          <div className="px-7 pb-2 pr-16 pt-5 text-[22px] font-semibold leading-[26px] text-white">
                            {t('subscription.additionalOptions.buyTrafficTitle')}
                          </div>
                          {/* Body */}
                          <div className="flex flex-col px-7 pb-7 pt-2">
                            {!trafficPackages || trafficPackages.length === 0 ? (
                              <div className="py-6 text-center text-sm text-apple-mute">
                                {t('subscription.additionalOptions.trafficUnavailable')}
                              </div>
                            ) : (
                              (() => {
                                const foundIdx = trafficPackages.findIndex(
                                  (p) => p.gb === selectedTrafficPackage,
                                );
                                const idx = foundIdx >= 0 ? foundIdx : 0;
                                const pkg = trafficPackages[idx];
                                const hasDiscount = !!(
                                  pkg.discount_percent && pkg.discount_percent > 0
                                );
                                const hasEnough =
                                  !purchaseOptions ||
                                  pkg.price_kopeks <= purchaseOptions.balance_kopeks;
                                const missing = purchaseOptions
                                  ? pkg.price_kopeks - purchaseOptions.balance_kopeks
                                  : 0;
                                const pending = trafficPurchaseMutation.isPending;
                                return (
                                  <>
                                    {/* Status banner */}
                                    <div
                                      className="mb-2 mt-1 flex items-center gap-2 rounded-xl p-4 text-sm font-medium"
                                      style={{
                                        background: 'rgba(249,115,21,0.16)',
                                        color: '#F97315',
                                      }}
                                    >
                                      <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="shrink-0"
                                        aria-hidden="true"
                                      >
                                        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                                      </svg>
                                      <span>
                                        {pkg.is_unlimited
                                          ? 'Безлимитный трафик'
                                          : `Будет добавлено ${pkg.gb} ${t('common.units.gb')}`}
                                        {hasDiscount ? ` · −${pkg.discount_percent}%` : ''}
                                      </span>
                                    </div>

                                    {/* Info note */}
                                    <div className="mb-4 text-[12px] leading-snug text-apple-faint">
                                      {t('subscription.additionalOptions.trafficWarning')}
                                    </div>

                                    {/* Slider */}
                                    {trafficPackages.length > 1 && (
                                      <PillSlider
                                        min={0}
                                        max={trafficPackages.length - 1}
                                        value={idx}
                                        aria-label={t('common.units.gb')}
                                        onChange={(v) => {
                                          haptic.buttonPressMedium();
                                          setSelectedTrafficPackage(trafficPackages[v].gb);
                                        }}
                                      />
                                    )}

                                    {/* Insufficient balance */}
                                    {!hasEnough && missing > 0 && (
                                      <div className="mt-4">
                                        <InsufficientBalancePrompt
                                          missingAmountKopeks={missing}
                                          compact
                                          onBeforeTopUp={async () => {
                                            await subscriptionApi.saveTrafficCart(
                                              pkg.gb,
                                              subscriptionId,
                                            );
                                          }}
                                        />
                                      </div>
                                    )}

                                    {/* CTA */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        haptic.buttonPressMedium();
                                        trafficPurchaseMutation.mutate(pkg.gb);
                                      }}
                                      disabled={pending || !hasEnough}
                                      className="mt-5 flex h-14 w-full items-center justify-center rounded-full text-[16px] font-medium transition-opacity disabled:cursor-not-allowed"
                                      style={{
                                        background: '#F97315',
                                        color: '#fff',
                                        opacity: pending || !hasEnough ? 0.6 : 1,
                                      }}
                                    >
                                      {pending ? (
                                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                      ) : pkg.is_unlimited ? (
                                        `${t('subscription.additionalOptions.buyUnlimited')} · ${formatPrice(pkg.price_kopeks)}`
                                      ) : (
                                        `Купить ${pkg.gb} ${t('common.units.gb')} за ${formatPrice(pkg.price_kopeks)}`
                                      )}
                                    </button>

                                    {trafficPurchaseMutation.isError && (
                                      <div className="mt-3 text-center text-sm text-apple-red">
                                        {getErrorMessage(trafficPurchaseMutation.error)}
                                      </div>
                                    )}
                                  </>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      </div>,
                      document.body,
                    )}
                </div>
              </div>

              {/* ─── Подключение ─── */}
              {(subscription.subscription_url ||
                (displayedConnectionUrl && !shouldHideConnectionLink)) && (
                <div>
                  <div className="mb-2.5 px-1.5 text-[13px] font-semibold text-apple-mute">
                    {t('subscription.connectionLabel', 'Подключение')}
                  </div>
                  <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
                    {displayedConnectionUrl && !shouldHideConnectionLink && (
                      <div className="flex items-center gap-2.5 p-4">
                        <RowIcon icon="link" />
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
                          className="flex shrink-0 items-center justify-center self-stretch rounded-[10px] px-3.5 transition-colors"
                          style={{
                            background: copied ? 'rgba(249, 115, 21,0.15)' : '#2c2c2e',
                            color: copied ? '#F97315' : '#98989d',
                          }}
                          title={t('subscription.copyLink')}
                        >
                          {copied ? <CheckIcon /> : <CopyIcon />}
                        </button>
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
                        className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-apple-elevated disabled:cursor-not-allowed disabled:opacity-50 ${
                          displayedConnectionUrl && !shouldHideConnectionLink
                            ? 'border-t border-apple-hairline'
                            : ''
                        }`}
                      >
                        <RowIcon icon="device" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] text-apple-ink">
                            {t('dashboard.connectDevice')}
                          </div>
                          <div
                            className={`mt-0.5 text-[13px] ${
                              isAtDeviceLimit ? 'text-apple-red' : 'text-apple-faint'
                            }`}
                          >
                            {isAtDeviceLimit
                              ? t('dashboard.deviceLimitReached')
                              : t('connection.openHint', 'Открыть в приложении · QR-код')}
                          </div>
                        </div>
                        <span className="shrink-0 text-[18px] text-apple-faint">›</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Докупленный трафик ─── */}
              {subscription.traffic_purchases && subscription.traffic_purchases.length > 0 && (
                <div>
                  <div className="mb-2.5 px-1.5 text-[13px] font-semibold text-apple-mute">
                    {t('subscription.purchasedTraffic')}
                  </div>
                  <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
                    {subscription.traffic_purchases.map((purchase, i) => (
                      <div
                        key={purchase.id}
                        className={`p-4 ${i > 0 ? 'border-t border-apple-hairline' : ''}`}
                      >
                        <div className="mb-2.5 flex items-center gap-3">
                          <RowIcon icon="traffic" />
                          <span className="flex-1 text-[15px] font-medium text-apple-ink">
                            {purchase.traffic_gb} {t('common.units.gb')}
                          </span>
                          <span
                            className="text-[13px] font-medium"
                            style={{
                              color: purchase.days_remaining === 0 ? '#ff9f0a' : '#98989d',
                            }}
                          >
                            {purchase.days_remaining === 0
                              ? t('subscription.expired')
                              : t('subscription.days', { count: purchase.days_remaining })}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{
                              width: `${purchase.progress_percent}%`,
                              background: '#F97315',
                            }}
                          />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-apple-faint">
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
          className={`relative overflow-hidden rounded-3xl py-12 text-center ${isDark ? 'apple-card-grad bg-apple-card' : 'bg-white'}`}
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
          className={`relative overflow-hidden rounded-2xl ${isDark ? 'apple-card-grad bg-apple-card' : 'bg-white'}`}
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
                    ? 'rgba(249, 115, 21, 0.12)'
                    : 'rgba(255,184,0,0.12)',
                border:
                  subscription.is_daily_paused || subscription.status === 'disabled'
                    ? '1px solid rgba(249, 115, 21, 0.2)'
                    : '1px solid rgba(255,184,0,0.2)',
                color:
                  subscription.is_daily_paused || subscription.status === 'disabled'
                    ? 'rgb(249, 115, 21)'
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
                        background: 'linear-gradient(90deg, rgb(249, 115, 21), rgb(249, 115, 21))',
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
        showServerManagement && (
          <div className="space-y-3">
            {/* Server Management - only in classic mode */}
            {!isTariffsMode && (
              <div>
                {showServerManagement && (
                  <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
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
                                      setSelectedServersToUpdate((prev) => [...prev, country.uuid]);
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
                                  <div className="text-xl font-bold text-white">
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

          <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
            {devicesLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
              </div>
            ) : devicesData && devicesData.devices.length > 0 ? (
              devicesData.devices.map((device, i) => {
                const isEditing = editingDeviceHwid === device.hwid;
                // Display priority: user alias → device model → platform.
                const deviceName =
                  (device.local_name && device.local_name.trim()) ||
                  device.device_model ||
                  device.platform;
                const submitRename = () =>
                  renameDeviceMutation.mutate({
                    hwid: device.hwid,
                    name: editingDeviceName.trim() || null,
                  });
                const cancelRename = () => {
                  setEditingDeviceHwid(null);
                  setEditingDeviceName('');
                };

                return (
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
                        stroke="#F97315"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingDeviceName}
                          maxLength={DEVICE_ALIAS_MAX_LENGTH}
                          placeholder={device.device_model || device.platform}
                          onChange={(e) => setEditingDeviceName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submitRename();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          className="w-full rounded-lg bg-apple-elevated px-2.5 py-1 text-[15px] text-apple-ink outline-none ring-1 ring-apple-hairline focus:ring-apple-blue"
                        />
                      ) : (
                        <div className="truncate text-[15px] text-apple-ink">{deviceName}</div>
                      )}
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-apple-faint">
                        <span>{device.platform}</span>
                        <span className="font-mono">{device.hwid.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={submitRename}
                          disabled={renameDeviceMutation.isPending}
                          aria-label={t('subscription.renameDeviceSave')}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-apple-blue transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={cancelRename}
                          disabled={renameDeviceMutation.isPending}
                          aria-label={t('subscription.renameDeviceCancel')}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-apple-faint transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingDeviceHwid(device.hwid);
                            setEditingDeviceName(device.local_name || '');
                          }}
                          aria-label={t('subscription.renameDevice')}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-apple-faint transition-opacity hover:opacity-80"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('subscription.confirmDeleteDevice'))) {
                              deleteDeviceMutation.mutate(device.hwid);
                            }
                          }}
                          disabled={deleteDeviceMutation.isPending}
                          aria-label={t('subscription.deleteDevice')}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-apple-red transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-[13px] text-apple-mute">
                {t('subscription.noDevices')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Управление ─── */}
      {subscription &&
        !subscription.is_trial &&
        (!subscription.is_daily || subscription.is_active || subscription.is_limited) && (
          <div>
            <div className="mb-2.5 px-1.5 text-[13px] font-semibold text-apple-mute">
              {t('subscription.management', 'Управление')}
            </div>
            <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
              {/* Autopay */}
              {!subscription.is_daily && (
                <div className="flex items-center gap-3 p-4">
                  <RowIcon icon="autopay" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] text-apple-ink">
                      {t('subscription.autoRenewal')}
                    </div>
                    <div className="mt-0.5 text-[13px] text-apple-mute">
                      {tariffPriceLabel
                        ? t('subscription.autopayChargeHint', {
                            price: tariffPriceLabel,
                            defaultValue: `Списывать ${tariffPriceLabel} с баланса`,
                          })
                        : t('subscription.daysBeforeExpiry', {
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
                    setShowDeviceManage(false);
                    setShowTrafficTopup(false);
                    setShowServerManagement(true);
                  }}
                  className="flex w-full items-center gap-3 border-t border-apple-hairline p-4 text-left transition-colors hover:bg-apple-elevated"
                >
                  <RowIcon icon="server" />
                  <div className="min-w-0 flex-1">
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
                  className="flex w-full items-center gap-3 border-t border-apple-hairline p-4 text-left transition-colors hover:bg-apple-elevated disabled:opacity-50"
                >
                  <RowIcon icon="reissue" />
                  <div className="min-w-0 flex-1">
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
    </div>
  );
}
