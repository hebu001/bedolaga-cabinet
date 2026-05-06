import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth';
import {
  brandingApi,
  getCachedBranding,
  setCachedBranding,
  preloadLogo,
  isLogoPreloaded,
} from '@/api/branding';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
// Icons
import {
  HomeIcon,
  SubscriptionIcon,
  WalletIcon,
  UsersIcon,
  ChatIcon,
  CogIcon,
  UserIcon,
  LogoutIcon,
  GamepadIcon,
  ClipboardIcon,
  InfoIcon,
  WheelIcon,
} from './icons';

const FALLBACK_NAME = import.meta.env.VITE_APP_NAME || 'Cabinet';
const FALLBACK_LOGO = import.meta.env.VITE_APP_LOGO || 'V';

interface DesktopSidebarProps {
  isAdmin?: boolean;
  wheelEnabled?: boolean;
  referralEnabled?: boolean;
  hasContests?: boolean;
  hasPolls?: boolean;
}

export function DesktopSidebar({
  isAdmin,
  wheelEnabled,
  referralEnabled,
  hasContests,
  hasPolls,
}: DesktopSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { haptic } = usePlatform();

  // Branding
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: async () => {
      const data = await brandingApi.getBranding();
      setCachedBranding(data);
      await preloadLogo(data);
      return data;
    },
    initialData: getCachedBranding() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const appName = branding ? branding.name : FALLBACK_NAME;
  const logoLetter = branding?.logo_letter || FALLBACK_LOGO;
  const hasCustomLogo = branding?.has_custom_logo || false;
  const logoUrl = branding ? brandingApi.getLogoUrl(branding) : null;

  const isActive = (path: string) => location.pathname === path;
  const isAdminActive = () => location.pathname.startsWith('/admin');

  const navItems = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscription', label: t('nav.subscription'), icon: SubscriptionIcon },
    { path: '/balance', label: t('nav.balance'), icon: WalletIcon },
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    { path: '/support', label: t('nav.support'), icon: ChatIcon },
    ...(hasContests ? [{ path: '/contests', label: t('nav.contests'), icon: GamepadIcon }] : []),
    ...(hasPolls ? [{ path: '/polls', label: t('nav.polls'), icon: ClipboardIcon }] : []),
    ...(wheelEnabled ? [{ path: '/wheel', label: t('nav.wheel'), icon: WheelIcon }] : []),
    { path: '/info', label: t('nav.info'), icon: InfoIcon },
  ];

  const handleNavClick = () => {
    haptic.impact('light');
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col" style={{ background: 'transparent' }}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-3" onClick={handleNavClick}>
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-linear-lg border border-dark-700/50 bg-dark-800/80">
            <span
              className={cn(
                'absolute text-lg font-bold transition-opacity duration-200',
                hasCustomLogo && isLogoPreloaded() ? 'opacity-0' : 'opacity-100',
              )}
              style={{ color: 'var(--figma-green)' }}
            >
              {logoLetter}
            </span>
            {hasCustomLogo && logoUrl && (
              <img
                src={logoUrl}
                alt={appName || 'Logo'}
                className={cn(
                  'absolute h-full w-full object-contain transition-opacity duration-200',
                  isLogoPreloaded() ? 'opacity-100' : 'opacity-0',
                )}
              />
            )}
          </div>
          {appName && (
            <span className="whitespace-nowrap text-base font-semibold text-white">
              {appName}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold leading-none transition-all duration-200',
              isActive(item.path)
                ? 'text-black'
                : 'text-white hover:bg-white/10',
            )}
          >
            {isActive(item.path) && (
              <motion.div
                layoutId="sidebar-active-pill"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'var(--figma-green)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <item.icon className="relative z-10 h-5 w-5 shrink-0" />
            <span className="relative z-10">{item.label}</span>
          </Link>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="my-3 h-px bg-white/10" />
            <Link
              to="/admin"
              onClick={handleNavClick}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold leading-none transition-all duration-200',
                isAdminActive()
                  ? 'bg-warning-500/10 text-warning-400'
                  : 'text-warning-500/70 hover:bg-warning-500/10 hover:text-warning-400',
              )}
            >
              <CogIcon className="h-5 w-5 shrink-0" />
              <span>{t('admin.nav.title')}</span>
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-3">
        <Link
          to="/profile"
          onClick={handleNavClick}
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
            isActive('/profile') ? 'bg-white/10' : 'hover:bg-white/10',
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <UserIcon className="h-4 w-4 text-white/60" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.first_name || user?.username || `#${user?.telegram_id}`}
            </p>
            <p className="truncate text-xs text-white/40">
              @{user?.username || `ID: ${user?.telegram_id}`}
            </p>
          </div>
        </Link>

        <button
          onClick={() => {
            haptic.impact('light');
            logout();
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/40 transition-all duration-200 hover:bg-error-500/10 hover:text-error-400"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          <span>{t('nav.logout')}</span>
        </button>
      </div>

      {/* Footer */}
      <small className="px-6 pb-6 text-white/25 text-xs">© 2026</small>
    </aside>
  );
}
