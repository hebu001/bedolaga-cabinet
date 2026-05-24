/**
 * Global success notification modal.
 * Shows prominent success messages for balance top-ups and subscription purchases.
 */

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSuccessNotification } from '../store/successNotification';
import { useCurrency } from '../hooks/useCurrency';
import { useTelegramSDK } from '../hooks/useTelegramSDK';
import { useHaptic } from '@/platform';

// Icons
const CheckCircleIcon = () => (
  <svg
    className="h-16 w-16"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const WalletIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
    />
  </svg>
);

const RocketIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
    />
  </svg>
);

const DevicesIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
    />
  </svg>
);

const TrafficIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function SuccessNotificationModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOpen = useSuccessNotification((state) => state.isOpen);
  const data = useSuccessNotification((state) => state.data);
  const hide = useSuccessNotification((state) => state.hide);
  const { formatAmount, currencySymbol } = useCurrency();
  const { safeAreaInset, contentSafeAreaInset, isTelegramWebApp } = useTelegramSDK();
  const haptic = useHaptic();

  const safeBottom = isTelegramWebApp
    ? Math.max(safeAreaInset.bottom, contentSafeAreaInset.bottom)
    : 0;

  const handleClose = useCallback(() => {
    hide();
  }, [hide]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (isOpen) {
      haptic.notification('success');
    }
  }, [isOpen, haptic]);

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const isBalanceTopup = data.type === 'balance_topup';
  const isSubscription =
    data.type === 'subscription_activated' ||
    data.type === 'subscription_renewed' ||
    data.type === 'subscription_purchased';
  const isDevicesPurchased = data.type === 'devices_purchased';
  const isTrafficPurchased = data.type === 'traffic_purchased';

  // Format amount — strip trailing ".00" / ",00" so 100.00 ₽ becomes 100 ₽
  // (the symbol is rendered separately in JSX next to the number).
  const formatNoTrailingZeros = (kopeks: number) =>
    formatAmount(kopeks / 100).replace(/[.,]00$/, '');

  const formattedAmount = data.amountKopeks ? formatNoTrailingZeros(data.amountKopeks) : null;

  // Format new balance
  const formattedBalance =
    data.newBalanceKopeks !== undefined
      ? `${formatNoTrailingZeros(data.newBalanceKopeks)} ${currencySymbol}`
      : null;

  // Format expiry date
  const formattedExpiry = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Determine title and message
  let title = data.title;
  const message = data.message;
  let icon = <CheckCircleIcon />;
  let gradientClass = 'from-success-500 to-success-600';

  if (!title) {
    if (isBalanceTopup) {
      title = t('successNotification.balanceTopup.title', 'Balance topped up!');
      icon = <WalletIcon />;
      gradientClass = 'from-success-500 to-success-600';
    } else if (data.type === 'subscription_activated') {
      title = t('successNotification.subscriptionActivated.title', 'Subscription activated!');
      icon = <RocketIcon />;
      gradientClass = 'from-accent-500 to-purple-600';
    } else if (data.type === 'subscription_renewed') {
      title = t('successNotification.subscriptionRenewed.title', 'Subscription renewed!');
      icon = <RocketIcon />;
      gradientClass = 'from-accent-500 to-purple-600';
    } else if (data.type === 'subscription_purchased') {
      title = t('successNotification.subscriptionPurchased.title', 'Subscription purchased!');
      icon = <RocketIcon />;
      gradientClass = 'from-accent-500 to-purple-600';
    } else if (data.type === 'devices_purchased') {
      title = t('successNotification.devicesPurchased.title', 'Devices added!');
      icon = <DevicesIcon />;
      gradientClass = 'from-[#F97315] to-[#FB923C]';
    } else if (data.type === 'traffic_purchased') {
      title = t('successNotification.trafficPurchased.title', 'Traffic added!');
      icon = <TrafficIcon />;
      gradientClass = 'from-[#F97315] to-[#FB923C]';
    }
  }

  const handleGoToSubscription = () => {
    hide();
    navigate('/subscriptions');
  };

  const handleGoToBalance = () => {
    hide();
    navigate('/balance');
  };

  // Visual scheme per type — colored icon circle + action button
  const isOrangeTheme = isDevicesPurchased || isTrafficPurchased;
  const iconCircleBg = isOrangeTheme
    ? 'bg-[#F97315]/15'
    : isBalanceTopup
      ? 'bg-[#30d158]/15'
      : 'bg-accent-500/15';
  const iconColor = isOrangeTheme
    ? 'text-[#F97315]'
    : isBalanceTopup
      ? 'text-[#30d158]'
      : 'text-accent-400';
  // Fallback subtitle (Russian copy used in the design reference)
  const fallbackSubtitle = isBalanceTopup
    ? t(
        'successNotification.balanceTopup.subtitle',
        'Ваш баланс успешно пополнен. Средства уже доступны.',
      )
    : message;

  // Amount-card label
  const amountLabel = isBalanceTopup
    ? t('successNotification.amount', 'Сумма пополнения')
    : t('successNotification.price', 'Стоимость');

  // Action button text
  const actionLabel = isBalanceTopup
    ? t('successNotification.goToBalance', 'Перейти к балансу')
    : t('successNotification.goToSubscription', 'Перейти к подписке');
  const handleAction = isBalanceTopup ? handleGoToBalance : handleGoToSubscription;

  // Hide gradientClass — new design uses a flat dark card
  void gradientClass;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div
        className="relative mx-4 w-full max-w-sm overflow-hidden rounded-3xl bg-apple-card shadow-2xl"
        style={{
          marginBottom: safeBottom ? `${safeBottom}px` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label={t('common.close', 'Close')}
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-apple-mute transition-colors hover:bg-white/5 hover:text-apple-ink"
        >
          <CloseIcon />
        </button>

        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          {/* Icon circle */}
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full ${iconCircleBg} ${iconColor}`}
          >
            {icon}
          </div>

          {/* Title */}
          <h2 className="mt-6 text-[22px] font-bold text-apple-ink">{title}</h2>

          {/* Subtitle */}
          {fallbackSubtitle && (
            <p className="mt-2 text-[14px] leading-snug text-apple-mute">{fallbackSubtitle}</p>
          )}

          {/* Amount card */}
          {formattedAmount && (
            <div className="mt-6 w-fit min-w-[180px] rounded-2xl bg-apple-elevated px-6 py-4">
              <p className="text-[13px] text-apple-mute">{amountLabel}</p>
              <p className="mt-1 text-[26px] font-bold leading-tight text-apple-ink">
                {formattedAmount}
                <span className="ml-1 text-[18px] text-apple-mute">{currencySymbol}</span>
              </p>
            </div>
          )}

          {/* Add-on extras (kept compact under the amount) */}
          {(isDevicesPurchased || isTrafficPurchased) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[13px] text-apple-mute">
              {isDevicesPurchased && data.devicesAdded && (
                <span className="rounded-full bg-apple-elevated px-3 py-1">
                  {t('successNotification.devicesAdded', 'Добавлено устройств')}:{' '}
                  <span className="font-semibold text-apple-ink">+{data.devicesAdded}</span>
                </span>
              )}
              {isDevicesPurchased && data.newDeviceLimit && (
                <span className="rounded-full bg-apple-elevated px-3 py-1">
                  {t('successNotification.totalDevices', 'Всего')}:{' '}
                  <span className="font-semibold text-apple-ink">{data.newDeviceLimit}</span>
                </span>
              )}
              {isTrafficPurchased && data.trafficGbAdded && (
                <span className="rounded-full bg-apple-elevated px-3 py-1">
                  {t('successNotification.trafficAdded', 'Добавлено трафика')}:{' '}
                  <span className="font-semibold text-apple-ink">+{data.trafficGbAdded} GB</span>
                </span>
              )}
              {isTrafficPurchased && data.newTrafficLimitGb && (
                <span className="rounded-full bg-apple-elevated px-3 py-1">
                  {t('successNotification.totalTraffic', 'Всего')}:{' '}
                  <span className="font-semibold text-apple-ink">{data.newTrafficLimitGb} GB</span>
                </span>
              )}
            </div>
          )}

          {/* Tariff + expiry compact row (subscription) */}
          {isSubscription && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[13px] text-apple-mute">
              {data.tariffName && (
                <span className="rounded-full bg-apple-elevated px-3 py-1">
                  <span className="font-semibold text-apple-ink">{data.tariffName}</span>
                </span>
              )}
              {formattedExpiry && (
                <span className="rounded-full bg-apple-elevated px-3 py-1">
                  {t('successNotification.validUntil', 'До')}:{' '}
                  <span className="font-semibold text-apple-ink">{formattedExpiry}</span>
                </span>
              )}
            </div>
          )}

          {isBalanceTopup && formattedBalance && (
            <p className="mt-3 text-[12px] text-apple-faint">
              {t('successNotification.newBalance', 'Новый баланс')}:{' '}
              <span className="font-semibold text-apple-mute">{formattedBalance}</span>
            </p>
          )}

          {/* Action button — single, full-width, rounded */}
          <button
            onClick={handleAction}
            className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-[#F97315] px-6 text-[16px] font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
