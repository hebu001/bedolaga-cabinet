import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { getPageScrollTarget } from '@/utils/pageScroll';

/**
 * Saves and restores scroll position for admin pages.
 * Disables browser's automatic scroll restoration.
 */
export function useScrollRestoration() {
  const location = useLocation();
  const scrollPositions = useRef<Record<string, number>>({});

  // Disable browser's automatic scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Desktop pages scroll inside the frame; mobile pages still scroll the window.
  useEffect(() => {
    const currentPath = location.pathname;

    const isAdmin = currentPath.startsWith('/admin');
    const media = window.matchMedia('(min-width: 1024px)');
    let target = getPageScrollTarget();
    const handleScroll = () => {
      if (isAdmin) {
        scrollPositions.current[currentPath] =
          target === window ? window.scrollY : (target as HTMLElement).scrollTop;
      }
    };
    const handleViewportChange = () => {
      target.removeEventListener('scroll', handleScroll);
      target = getPageScrollTarget();
      target.addEventListener('scroll', handleScroll, { passive: true });
    };
    target.addEventListener('scroll', handleScroll, { passive: true });
    media.addEventListener('change', handleViewportChange);
    if (isAdmin || target !== window) {
      target.scrollTo({
        top: isAdmin ? (scrollPositions.current[currentPath] ?? 0) : 0,
        behavior: 'instant',
      });
    }

    return () => {
      target.removeEventListener('scroll', handleScroll);
      media.removeEventListener('change', handleViewportChange);
    };
  }, [location.pathname]);
}
