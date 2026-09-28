import { useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { openLink as sdkOpenLink } from '@telegram-apps/sdk-react';
import { subscriptionApi } from '../api/subscription';
import { useTelegramSDK } from '../hooks/useTelegramSDK';
import { useHapticFeedback } from '../platform/hooks/useHaptic';
import {
  isHappCryptolinkMode,
  resolveConnectionUrlForUi,
  resolvePlainSubscriptionUrl,
} from '../utils/connectionLink';
import { PhoneIcon, SettingsIcon } from '@/components/icons';
import { resolveTemplate, hasTemplates } from '../utils/templateEngine';
import { openAppScheme } from '../utils/openAppScheme';
import { useAuthStore } from '../store/auth';
import type { AppConfig, RemnawavePlatformData } from '../types';
import InstallationGuide from '../components/connection/InstallationGuide';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

export default function Connection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subId = searchParams.get('sub') ? Number(searchParams.get('sub')) : undefined;
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const { isTelegramWebApp } = useTelegramSDK();
  const haptic = useHapticFeedback();

  const {
    data: appConfig,
    isLoading,
    error,
    refetch: refetchConfig,
  } = useQuery<AppConfig>({
    queryKey: ['appConfig', subId],
    retry: 1,
    queryFn: () => subscriptionApi.getAppConfig(subId),
  });
  const {
    data: connectionLink,
    isLoading: isConnectionLinkLoading,
    isError: connectionLinkError,
    refetch: refetchConnectionLink,
  } = useQuery({
    queryKey: ['connectionLink', subId],
    queryFn: () => subscriptionApi.getConnectionLink(subId),
    enabled: !!appConfig?.hasSubscription,
    retry: false,
    staleTime: 0,
  });

  const qrConnectionUrl = useMemo(
    () =>
      resolveConnectionUrlForUi({
        mode: connectionLink?.connect_mode,
        happSchemeLink: connectionLink?.happ_scheme_link,
        displayLink: connectionLink?.display_link,
        subscriptionUrl: connectionLink?.subscription_url,
        happCryptLink: connectionLink?.happ_cryptolink,
        happCryptoLink: connectionLink?.happ_crypto_link,
        happLink: connectionLink?.happ_link,
        fallbackUrl: appConfig?.subscriptionUrl,
      }),
    [
      appConfig?.subscriptionUrl,
      connectionLink?.connect_mode,
      connectionLink?.display_link,
      connectionLink?.happ_cryptolink,
      connectionLink?.happ_crypto_link,
      connectionLink?.happ_link,
      connectionLink?.happ_scheme_link,
      connectionLink?.subscription_url,
    ],
  );

  const handleGoBack = useCallback(() => {
    haptic.buttonPressMedium();
    navigate(-1);
  }, [navigate, haptic]);

  const displayedConnectionUrl = resolvePlainSubscriptionUrl({
    subscriptionUrl: connectionLink?.subscription_url,
    fallbackUrl: appConfig?.subscriptionUrl,
    displayLink: connectionLink?.display_link,
  });
  const hideLink = !!(connectionLink?.hide_link || appConfig?.hideLink);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleGoBack();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleGoBack]);

  const resolveUrl = useCallback(
    (url: string): string => {
      if (!hasTemplates(url) || !appConfig?.subscriptionUrl) return url;
      return resolveTemplate(url, {
        subscriptionUrl: appConfig.subscriptionUrl,
        username: user?.username ?? undefined,
      });
    },
    [appConfig, user],
  );

  const openDeepLink = useCallback(
    (deepLink: string) => {
      let resolved = deepLink;
      if (hasTemplates(resolved)) {
        resolved = resolveUrl(resolved);
      }
      // In HAPP cryptolink mode keep hiding the plain subscription link: force the
      // happ://crypt... URL only when the button fell back to it or its template
      // could not be resolved. An explicit link from the panel's Subpage config
      // (e.g. happ://add/...) wins — admins expect Subpage edits to apply here.
      if (
        isHappCryptolinkMode(connectionLink?.connect_mode) &&
        qrConnectionUrl &&
        (!resolved || resolved === appConfig?.subscriptionUrl || hasTemplates(resolved))
      ) {
        resolved = qrConnectionUrl;
      }
      const isHttpUrl = /^https?:\/\//i.test(resolved);
      const finalUrlForTelegram = isHttpUrl
        ? resolved
        : `${window.location.origin}/miniapp/redirect.html?url=${encodeURIComponent(resolved)}&lang=${i18n.language || 'en'}`;

      if (isTelegramWebApp) {
        try {
          sdkOpenLink(finalUrlForTelegram, { tryInstantView: false });
          return;
        } catch {
          // SDK not available, fallback
        }
      }

      // In regular browsers open the deeplink directly. openAppScheme uses a contained
      // iframe for custom schemes so an unresolved scheme doesn't paint a full-page
      // net::ERR_UNKNOWN_URL_SCHEME (Android) / silently fail (iOS); http(s) links
      // still navigate normally. (Telegram bug #654272.)
      openAppScheme(resolved);
    },
    [
      isTelegramWebApp,
      i18n.language,
      resolveUrl,
      connectionLink?.connect_mode,
      qrConnectionUrl,
      appConfig?.subscriptionUrl,
    ],
  );

  // Check if any platform has configured apps
  const hasApps = useMemo(() => {
    if (!appConfig?.platforms) return false;
    return Object.values(appConfig.platforms).some(
      (p: RemnawavePlatformData) => p.apps && p.apps.length > 0,
    );
  }, [appConfig?.platforms]);

  if (isLoading || isConnectionLinkLoading) {
    return (
      <SkeletonGroup className="space-y-6 pb-6">
        {/* Повторяет шапку InstallationGuide: кнопка «назад», заголовок, выбор платформы. */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <Skeleton className="h-6 flex-1" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        </div>
        <Skeleton variant="card" count={3} className="h-24" />
      </SkeletonGroup>
    );
  }

  if ((error && !appConfig) || (connectionLinkError && !connectionLink)) {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center p-8 text-center"
      >
        <p>{t(appConfig ? 'common.staleData' : 'common.loadError')}</p>
        <button
          onClick={() => {
            void refetchConfig();
            void refetchConnectionLink();
          }}
          className="mt-4 underline"
        >
          {t('common.retry')}
        </button>
        <button onClick={handleGoBack} className="mt-4 underline">
          {t('common.back')}
        </button>
      </div>
    );
  }

  if (!appConfig || !hasApps) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800">
          <PhoneIcon className="h-8 w-8 text-dark-400" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-dark-100">
          {t('subscription.connection.notConfigured')}
        </h3>
        <p className="mb-6 max-w-sm text-dark-400">
          {isAdmin
            ? t('subscription.connection.notConfiguredAdmin')
            : t('subscription.connection.notConfiguredUser')}
        </p>
        {isAdmin && (
          <Link to="/admin/apps" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5">
            <SettingsIcon className="h-4 w-4" />
            {t('subscription.connection.goToApps')}
          </Link>
        )}
      </div>
    );
  }

  // No subscription
  if (!appConfig.hasSubscription) {
    return (
      <div
        className="fixed-screen flex flex-col overflow-hidden px-5"
        style={{ overscrollBehavior: 'none' }}
      >
        {/* Hero area — large status text */}
        <div className="relative flex flex-1 items-center justify-center">
          <div className="relative z-10 px-4 text-center">
            <h1
              className="text-3xl font-black uppercase leading-tight text-white sm:text-4xl"
              style={{ letterSpacing: '0.1em', fontStretch: 'expanded' }}
            >
              {t(
                'subscription.connection.noSubscription',
                'Для подключения нужна активная подписка',
              )}
            </h1>
          </div>
        </div>

        {/* Bottom button */}
        <div className="mt-auto space-y-2 pb-2">
          <button
            onClick={handleGoBack}
            className="h-14 w-full rounded-full bg-white/15 text-base font-medium text-white transition-all hover:bg-white/10 active:scale-[0.97]"
          >
            {t('common.close', 'Закрыть')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {(error || connectionLinkError) && (
        <div role="alert" className="shrink-0 py-2 text-center text-sm">
          {t('common.staleData')}{' '}
          <button
            onClick={() => {
              void refetchConfig();
              void refetchConnectionLink();
            }}
            className="underline"
          >
            {t('common.retry')}
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <InstallationGuide
          appConfig={appConfig}
          onOpenDeepLink={openDeepLink}
          isTelegramWebApp={isTelegramWebApp}
          onGoBack={handleGoBack}
          displayUrl={displayedConnectionUrl}
          hideLink={hideLink}
          connectionUrl={qrConnectionUrl}
        />
      </div>
    </div>
  );
}
