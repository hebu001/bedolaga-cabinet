import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import ProgressRing from './ProgressRing';
import { useHapticFeedback } from '../../platform/hooks/useHaptic';
import type { AppConfig, RemnawavePlatformData } from '@/types';

/* ─── Platform detection ─── */
const platformOrder = ['ios', 'android', 'macos', 'windows', 'linux', 'androidTV', 'appleTV'];

function detectPlatform(): string | null {
  if (typeof window === 'undefined' || !navigator?.userAgent) return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return /tv|television/.test(ua) ? 'androidTV' : 'android';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/windows/.test(ua)) return 'windows';
  if (/linux/.test(ua)) return 'linux';
  return null;
}

const platformLabels: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  androidTV: 'Android TV',
  appleTV: 'Apple TV',
};

/* ─── Icons ─── */
const UnplugIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="84"
    height="84"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m19 5 3-3" />
    <path d="m2 22 3-3" />
    <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
    <path d="M7.5 13.5 10 11" />
    <path d="M10.5 16.5 13 14" />
    <path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z" />
  </svg>
);

const CloudDownloadIcon = ({ size = 84 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={size > 24 ? 1.25 : 2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 13v8l-4-4" />
    <path d="m12 21 4-4" />
    <path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" />
  </svg>
);

const CircleFadingPlusIcon = ({ size = 84 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={size > 24 ? 1.25 : 2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a10 10 0 0 1 7.38 16.75" />
    <path d="M12 8v8" />
    <path d="M16 12H8" />
    <path d="M2.5 8.875a10 10 0 0 0-.5 3" />
    <path d="M2.83 16a10 10 0 0 0 2.43 3.4" />
    <path d="M4.636 5.235a10 10 0 0 1 .891-.857" />
    <path d="M8.644 21.42a10 10 0 0 0 7.631-.38" />
  </svg>
);

const ArrowRightIcon = () => (
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
    className="-mr-4"
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const CopyIcon = () => (
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
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = () => (
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
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/* ─── Animation ─── */
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
};

const pageTransition = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 0.6,
};

/* ─── Main Component ─── */
interface SetupWizardProps {
  appConfig: AppConfig;
  onOpenDeepLink: (url: string) => void;
  isTelegramWebApp: boolean;
  onGoBack: () => void;
  onOpenQR?: () => void;
  // Pre-resolved connection URL from Connection.tsx (handles HAPP cryptolink
  // via @kastov/cryptohapp). Falls back to subscription URL in other modes.
  connectionUrl?: string | null;
}

export default function SetupWizard({
  appConfig,
  onOpenDeepLink,
  isTelegramWebApp: _isTelegramWebApp,
  onGoBack,
  connectionUrl,
}: SetupWizardProps) {
  const { t } = useTranslation();
  const haptic = useHapticFeedback();
  // Steps: 0 = intro (auto-detected platform), 1 = download app, 2 = add subscription, 3 = QR (other device)
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const detectedPlatform = useMemo(() => detectPlatform(), []);

  const availablePlatforms = useMemo(() => {
    if (!appConfig.platforms) return [];
    const available = platformOrder.filter((key) => {
      const data = appConfig.platforms[key] as RemnawavePlatformData | undefined;
      return data && data.apps && data.apps.length > 0;
    });
    if (detectedPlatform && available.includes(detectedPlatform)) {
      return [detectedPlatform, ...available.filter((p) => p !== detectedPlatform)];
    }
    return available;
  }, [appConfig.platforms, detectedPlatform]);

  const currentPlatform = availablePlatforms[0] || 'ios';
  const currentPlatformLabel = platformLabels[currentPlatform] || currentPlatform;

  // Get the selected platform's first (or featured) app
  const selectedApp = useMemo(() => {
    const data = appConfig.platforms[currentPlatform] as RemnawavePlatformData | undefined;
    if (!data?.apps?.length) return null;
    return data.apps.find((a) => a.featured) || data.apps[0];
  }, [appConfig.platforms, currentPlatform]);

  // Extract download URL from blocks (first external button)
  const downloadUrl = useMemo(() => {
    if (!selectedApp?.blocks) return null;
    for (const block of selectedApp.blocks) {
      if (!block.buttons) continue;
      for (const btn of block.buttons) {
        if (btn.type === 'external' || (!btn.type && (btn.url || btn.link))) {
          const url = btn.url || btn.link;
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            return url;
          }
        }
      }
    }
    return null;
  }, [selectedApp]);

  const handleCopyUrl = useCallback(() => {
    haptic.buttonPressMedium();
    if (!appConfig.subscriptionUrl) return;
    navigator.clipboard.writeText(appConfig.subscriptionUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [appConfig.subscriptionUrl, haptic]);

  const handleInstallApp = useCallback(() => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }, [downloadUrl]);

  // Backend pre-resolves the happ://crypt... URL into the `subscriptionLink`
  // button inside one of the app's blocks (same source the legacy
  // BlockButtons used). This is the only place the cryptolink lives for
  // most setups — connection-link endpoint doesn't always expose it.
  const subscriptionLinkUrl = useMemo(() => {
    if (!selectedApp?.blocks) return null;
    for (const block of selectedApp.blocks) {
      if (!block.buttons) continue;
      for (const btn of block.buttons) {
        if (btn.type !== 'subscriptionLink') continue;
        const url = btn.resolvedUrl || btn.url || btn.link;
        if (url) return url;
      }
    }
    return null;
  }, [selectedApp]);

  // Priority: subscriptionLink (resolved by backend, holds happ://crypt) →
  // pre-resolved connectionUrl from Connection.tsx → app's own deepLink →
  // raw subscriptionUrl as last resort.
  const addSubscriptionUrl =
    subscriptionLinkUrl ||
    connectionUrl ||
    selectedApp?.deepLink ||
    appConfig.subscriptionUrl ||
    null;

  const handleAddSubscription = useCallback(() => {
    if (addSubscriptionUrl) {
      onOpenDeepLink(addSubscriptionUrl);
    }
  }, [addSubscriptionUrl, onOpenDeepLink]);

  const progressPercents = [0, 33, 66];
  const currentProgress = step <= 2 ? progressPercents[step] || 0 : 0;

  /* ─── Step 0 — Intro (auto-detected platform) ─── */
  const renderIntro = () => (
    <motion.div
      key="step-intro"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="z-10 flex w-full grow flex-col items-center"
    >
      {/* Ring + icon area */}
      <div className="flex flex-1 items-center justify-center">
        <div className="relative">
          <ProgressRing percent={currentProgress} size={160} />
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <UnplugIcon />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col gap-3 px-4 text-center">
        <p className="text-4xl font-medium leading-10">
          {t('subscription.connection.setupOn', 'Настройка на')} {currentPlatformLabel}
        </p>
        <p className="mx-auto max-w-[280px] text-base text-white/80">
          {t(
            'subscription.connection.stepsInfo',
            'Настройка приложения происходит в 3 шага и занимает пару минут',
          )}
        </p>
      </div>

      {/* Buttons — pinned to bottom area */}
      <style>{`
        @keyframes radiate-rings {
          0% {
            box-shadow: 0 0 0 0 rgba(0, 168, 120, 0.7), 0 0 0 0 rgba(0, 168, 120, 0.4);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(0, 168, 120, 0), 0 0 0 0 rgba(0, 168, 120, 0.4);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(0, 168, 120, 0), 0 0 0 20px rgba(0, 168, 120, 0);
          }
        }
        .radiate-button {
          animation: radiate-rings 2.5s infinite;
        }
      `}</style>
      <div className="mt-auto flex w-full flex-col gap-2.5 pb-10 pt-6">
        <button
          onClick={() => {
            haptic.buttonPressMedium();
            setStep(1);
          }}
          className="radiate-button h-14 w-full rounded-full bg-[var(--figma-green)] text-base font-medium text-white transition-all will-change-[box-shadow] active:scale-[0.97]"
        >
          {t('subscription.connection.startSetup', 'Начать настройку на этом устройстве')}
        </button>
        <button
          onClick={() => {
            haptic.buttonPressMedium();
            setStep(3);
          }}
          className="h-14 w-full rounded-full bg-white text-base font-medium text-black transition-all hover:brightness-95 active:scale-[0.97]"
        >
          {t('subscription.connection.setupOther', 'Установить на другом устройстве')}
        </button>
      </div>
    </motion.div>
  );

  /* ─── Step 1 — Download App ─── */
  const renderDownloadApp = () => (
    <motion.div
      key="step-download"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="z-10 flex w-full grow flex-col items-center"
    >
      {/* Ring + icon */}
      <div className="flex flex-1 items-center justify-center">
        <div className="relative">
          <ProgressRing percent={currentProgress} size={160} />
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <CloudDownloadIcon />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col gap-3 px-4 text-center">
        <p className="text-4xl font-medium leading-10">
          {t('subscription.connection.appTitle', 'Приложение')}
        </p>
        <p className="mx-auto max-w-[280px] text-base text-white/80">
          {t(
            'subscription.connection.installAppDesc',
            'Установите приложение и вернитесь к этому экрану',
          )}
        </p>
      </div>

      {/* Buttons */}
      <div className="mt-auto flex w-full flex-col gap-2.5 pb-10 pt-6">
        <button
          onClick={() => {
            haptic.buttonPressMedium();
            handleInstallApp();
          }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--figma-green)] text-base font-medium text-white transition-all active:scale-[0.97]"
        >
          <CloudDownloadIcon size={20} />
          {t('subscription.connection.installApp', 'Установить приложение')}
        </button>
        <button
          onClick={() => {
            haptic.buttonPressMedium();
            setStep(2);
          }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-medium text-black transition-all hover:brightness-95 active:scale-[0.97]"
        >
          {t('subscription.connection.nextStep', 'Следующий шаг')}
          <ArrowRightIcon />
        </button>
      </div>
    </motion.div>
  );

  /* ─── Step 2 — Add Subscription ─── */
  const renderAddSubscription = () => (
    <motion.div
      key="step-sub"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="z-10 flex w-full grow flex-col items-center"
    >
      {/* Ring + icon */}
      <div className="flex flex-1 items-center justify-center">
        <div className="relative">
          <ProgressRing percent={currentProgress} size={160} />
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <CircleFadingPlusIcon />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col gap-3 px-4 text-center">
        <p className="text-4xl font-medium leading-10">
          {t('subscription.connection.subscriptionTitle', 'Подписка')}
        </p>
        <p className="mx-auto max-w-[280px] text-base text-white/80">
          {t(
            'subscription.connection.addSubDesc',
            'Добавьте подписку в приложение с помощью кнопки ниже',
          )}
        </p>
      </div>

      {/* Buttons */}
      <div className="mt-auto flex w-full flex-col gap-2.5 pb-10 pt-6">
        <button
          onClick={() => {
            haptic.buttonPressMedium();
            handleAddSubscription();
          }}
          disabled={!addSubscriptionUrl}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--figma-green)] text-base font-medium text-white transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
        >
          <CircleFadingPlusIcon size={20} />
          {t('subscription.connection.addSub', 'Добавить подписку')}
        </button>
        <button
          onClick={() => {
            haptic.buttonPressMedium();
            onGoBack();
          }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-medium text-black transition-all hover:brightness-95 active:scale-[0.97]"
        >
          {t('subscription.connection.done', 'Готово')}
        </button>
      </div>
    </motion.div>
  );

  /* ─── Step 3 — QR Code (other device) ─── */
  const renderQR = () => (
    <motion.div
      key="step-qr"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="z-10 flex w-full grow flex-col items-center"
    >
      {/* QR */}
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="flex w-full flex-col items-center gap-4 text-center">
          <p className="text-base text-white/80">
            {t('subscription.connection.qrScanHint', 'Отсканируйте QR-код на другом устройстве')}
          </p>
          <div className="mx-auto rounded-3xl bg-white p-6">
            <QRCodeSVG
              value={appConfig.subscriptionUrl || ''}
              size={220}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>
      </div>

      {/* Subscription URL bar + Back */}
      <div className="mt-auto flex w-full flex-col gap-2.5 pb-10 pt-6">
        {appConfig.subscriptionUrl && (
          <button
            onClick={handleCopyUrl}
            className="relative flex h-14 w-full items-center rounded-2xl bg-white px-4 text-black transition-all active:scale-[0.97]"
          >
            <div className="flex-1 overflow-hidden text-left">
              <div className="truncate pr-2 text-sm">{appConfig.subscriptionUrl}</div>
              <small className="text-xs text-gray-500">
                {t('subscription.connection.yourLink', 'Ваша ссылка на подписку')}
              </small>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </div>
          </button>
        )}
        <button
          onClick={() => {
            haptic.buttonPressMedium();
            setStep(0);
          }}
          className="h-14 w-full rounded-full bg-white/15 text-base font-medium text-white transition-all hover:bg-white/10 active:scale-[0.97]"
        >
          {t('common.back', 'Назад')}
        </button>
      </div>
    </motion.div>
  );

  /* ─── Main render ─── */
  const renderStep = () => {
    switch (step) {
      case 0:
        return renderIntro();
      case 1:
        return renderDownloadApp();
      case 2:
        return renderAddSubscription();
      case 3:
        return renderQR();
      default:
        return renderIntro();
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col items-center pb-4"
      style={{
        touchAction: 'none',
        overscrollBehavior: 'none',
      }}
    >
      <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
    </div>
  );
}
