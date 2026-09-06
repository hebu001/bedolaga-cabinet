import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/store/auth';
import { useHaptic } from '@/platform';
import { useTelegramSDK } from '@/hooks/useTelegramSDK';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';
import { useBranding } from '@/hooks/useBranding';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { cn } from '@/lib/utils';

import WebSocketNotifications from '@/components/WebSocketNotifications';
import CampaignBonusNotifier from '@/components/CampaignBonusNotifier';
import SuccessNotificationModal from '@/components/SuccessNotificationModal';
import { useDockItems } from './useDockItems';

import { MobileBottomNav } from './MobileBottomNav';
import { AppHeader } from './AppHeader';
import { BackgroundRenderer } from '@/components/backgrounds/BackgroundRenderer';

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
    />
  </svg>
);

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const logout = useAuthStore((state) => state.logout);
  const { isFullscreen, safeAreaInset, contentSafeAreaInset, platform, isMobile } =
    useTelegramSDK();
  const { mobile: headerHeight } = useHeaderHeight();
  const haptic = useHaptic();

  // Extracted hooks
  useBranding();
  const { referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled } = useFeatureFlags();
  useScrollRestoration();

  // Only apply fullscreen UI adjustments on mobile Telegram (iOS/Android)
  const isMobileFullscreen = isFullscreen && isMobile;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Reset keyboard state on route change — prevents bottom nav staying hidden after navigation
  useEffect(() => {
    setIsKeyboardOpen(false);
  }, [location.pathname]);

  // Keyboard detection for hiding bottom nav
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (
        !relatedTarget ||
        (relatedTarget.tagName !== 'INPUT' &&
          relatedTarget.tagName !== 'TEXTAREA' &&
          !relatedTarget.isContentEditable)
      ) {
        setIsKeyboardOpen(false);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const desktopNavItems = useDockItems(wheelEnabled);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    haptic.impact('light');
  };

  // headerHeight comes from useHeaderHeight() — accounts for TG safe area in fullscreen

  const isDashboard = location.pathname === '/';
  const isConnection = location.pathname.startsWith('/connection');
  const isSubscription = location.pathname.startsWith('/subscription');
  const isBalance = location.pathname.startsWith('/balance');
  const isProfile =
    location.pathname.startsWith('/profile') || location.pathname.startsWith('/referral');
  const isSupport = location.pathname.startsWith('/support');
  const isAdminPage = location.pathname.startsWith('/admin');
  const isGift = location.pathname.startsWith('/gift');
  const isHeaderHidden =
    isDashboard ||
    isConnection ||
    isSubscription ||
    isBalance ||
    isProfile ||
    isGift ||
    // Support page keeps the top header only for admins
    (isSupport && !isAdmin);
  const isFullscreenContent = isDashboard || isConnection;

  // Apple-dark pages use a solid black canvas instead of the animated background
  const isAppleDarkPage =
    isBalance || isSubscription || isProfile || isSupport || isAdminPage || isGift;

  return (
    <div className={cn('app-shell min-h-[100dvh]', isAppleDarkPage && 'bg-black')}>
      {/* Animated background renders via portal on document.body at z-index: -1 */}
      {!isAppleDarkPage && <BackgroundRenderer />}

      {/* Global components */}
      <WebSocketNotifications />
      <CampaignBonusNotifier />
      <SuccessNotificationModal />

      {/* Desktop sidebar shares the five mobile dock destinations. */}
      <aside className="desktop-sidebar fixed inset-y-0 left-0 z-50 hidden bg-apple-card lg:flex">
        <div className="flex min-h-0 w-full flex-col">
          <nav
            className="desktop-sidebar-nav my-auto flex flex-col gap-1.5 py-6"
            aria-label={t('nav.dashboard')}
          >
            {desktopNavItems.map((item) => (
              <Link
                key={item.path}
                aria-current={isActive(item.path) ? 'page' : undefined}
                to={item.path}
                onClick={handleNavClick}
                className={cn(
                  'desktop-sidebar-link flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                  isActive(item.path)
                    ? 'bg-[#F97315] text-white'
                    : 'text-[#98989d] hover:bg-white/5 hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Sign out stays at the bottom of the sidebar. */}
          <div className="desktop-sidebar-actions flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={() => {
                haptic.impact('light');
                logout();
              }}
              className="flex w-full items-center gap-3 rounded-xl py-2 text-sm text-[#98989d] transition-colors hover:text-white"
              title={t('nav.logout')}
            >
              <LogoutIcon className="h-5 w-5" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header — hidden on Dashboard, Connection, Subscription */}
      {!isHeaderHidden && (
        <AppHeader
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onCommandPaletteOpen={() => {}}
          headerHeight={headerHeight}
          isFullscreen={isMobileFullscreen}
          safeAreaInset={safeAreaInset}
          contentSafeAreaInset={contentSafeAreaInset}
          telegramPlatform={platform}
          wheelEnabled={wheelEnabled}
          referralEnabled={referralEnabled}
          hasContests={hasContests}
          hasPolls={hasPolls}
          giftEnabled={giftEnabled}
        />
      )}

      {/* Mobile spacer — hidden when header is hidden */}
      {!isHeaderHidden && <div className="lg:hidden" style={{ height: headerHeight }} />}

      {/* Main content */}
      <div className="app-content">
        <main
          className={cn(
            'mx-auto max-w-6xl lg:px-6',
            isFullscreenContent
              ? 'fixed-screen-main overflow-hidden px-5 py-0 pb-0'
              : 'px-4 py-6 pb-28 lg:pb-8',
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav isKeyboardOpen={isKeyboardOpen} wheelEnabled={wheelEnabled} />
    </div>
  );
}
