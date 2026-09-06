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
        'fixed z-50 transition-all duration-500 lg:hidden',
        isKeyboardOpen ? 'pointer-events-none translate-y-full opacity-0' : 'opacity-100',
      )}
      style={{
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        left: '20px',
        right: '20px',
        height: '64px',
        borderRadius: '9999px',
        padding: '4px',
        background: 'rgba(28, 28, 30, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex h-full gap-2" style={{ transform: 'translateY(-1px)' }}>
        {coreItems.map((item) => (
          <Link
            key={item.path}
            aria-current={isActive(item.path) ? 'page' : undefined}
            to={item.path}
            onClick={handleNavClick}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full transition-all duration-200',
              isActive(item.path) ? 'text-white' : 'text-[#98989d] hover:text-white',
            )}
            style={{ height: '56px' }}
          >
            {isActive(item.path) && (
              <motion.div
                layoutId="bottom-nav-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: '#F97315' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <item.icon className="relative z-10 h-[18px] w-[18px]" />
            <span className="relative z-10 max-w-full truncate px-1 text-[10px] font-medium leading-none">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
