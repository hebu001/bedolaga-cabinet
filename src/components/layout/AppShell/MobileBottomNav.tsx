import { Link, useLocation } from 'react-router';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { useDockItems } from './useDockItems';

interface MobileBottomNavProps {
  isKeyboardOpen: boolean;
  wheelEnabled?: boolean;
}

export function MobileBottomNav({ isKeyboardOpen, wheelEnabled }: MobileBottomNavProps) {
  const location = useLocation();
  const { haptic } = usePlatform();
  const coreItems = useDockItems(wheelEnabled);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleNavClick = () => {
    haptic.impact('light');
  };

  return (
    <nav
      className={cn(
        'fixed z-50 border border-apple-hairline bg-apple-card/90 transition-[transform,opacity] duration-200 ease-out lg:hidden',
        isKeyboardOpen ? 'pointer-events-none translate-y-full opacity-0' : 'opacity-100',
      )}
      style={{
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        left: '20px',
        right: '20px',
        height: '64px',
        borderRadius: '9999px',
        padding: '4px',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex h-full gap-1" style={{ transform: 'translateY(-1px)' }}>
        {coreItems.map((item) => (
          <Link
            key={item.path}
            aria-current={isActive(item.path) ? 'page' : undefined}
            to={item.path}
            onClick={handleNavClick}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full transition-colors duration-150',
              isActive(item.path) ? 'text-white' : 'text-apple-mute hover:text-apple-ink',
            )}
            style={{ height: '56px' }}
          >
            {isActive(item.path) && (
              <motion.div
                layoutId="bottom-nav-pill"
                className="absolute inset-0 rounded-full bg-apple-blue"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <item.icon className="relative z-10 h-[18px] w-[18px]" />
            <span className="relative z-10 max-w-full px-0.5 text-[11px] font-medium leading-none">
              {item.shortLabel ?? item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
