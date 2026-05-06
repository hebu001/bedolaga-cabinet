import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';

// Icons
import { HomeIcon, WalletIcon, UsersIcon, ChatIcon, WheelIcon } from './icons';

// Globe icon matching Dashboard's renew button
const GlobeNavIcon = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

interface MobileBottomNavProps {
  isKeyboardOpen: boolean;
  referralEnabled?: boolean;
  wheelEnabled?: boolean;
}

export function MobileBottomNav({
  isKeyboardOpen,
  referralEnabled,
  wheelEnabled,
}: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { haptic } = usePlatform();

  const isActive = (path: string) => location.pathname === path;

  const coreItems = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscription', label: t('nav.subscription'), icon: GlobeNavIcon },
    { path: '/balance', label: t('nav.balance'), icon: WalletIcon },
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    ...(wheelEnabled
      ? [{ path: '/wheel', label: t('nav.wheel'), icon: WheelIcon }]
      : [{ path: '/support', label: t('nav.support'), icon: ChatIcon }]),
  ];

  const handleNavClick = () => {
    haptic.impact('light');
  };

  return (
    <nav
      className={cn(
        'fixed z-50 transition-all duration-500 lg:hidden',
        isKeyboardOpen ? 'pointer-events-none opacity-0 translate-y-full' : 'opacity-100',
      )}
      style={{
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        left: '20px',
        right: '20px',
        height: '64px',
        borderRadius: '9999px',
        padding: '4px',
        background: 'rgba(249, 115, 22, 0.08)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex h-full gap-2">
        {coreItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={cn(
              'relative flex flex-1 items-center justify-center rounded-full transition-all duration-200',
              isActive(item.path)
                ? 'text-black'
                : 'text-white border border-white/10 hover:bg-white/10',
            )}
            style={{ height: '56px' }}
          >
            {isActive(item.path) && (
              <motion.div
                layoutId="bottom-nav-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--figma-green)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <item.icon className="relative z-10 h-5 w-5" />
          </Link>
        ))}
      </div>
    </nav>
  );
}
