import { useEffect, useCallback } from 'react';
import { SessionQueryScope } from './SessionQueryProvider';
import { useQuery } from '@tanstack/react-query';
import { themeColorsQueryOptions } from '../api/themeColors';
import { DEFAULT_THEME_COLORS } from '../types/theme';
import { applyThemeColors } from '../hooks/useThemeColors';
import { usePlatform } from '@/platform';
import { useTheme } from '../hooks/useTheme';

interface ThemeColorsProviderProps {
  children: React.ReactNode;
}

// TanStack observers keep their initial QueryClient. Remount only the effects
// leaf when it changes; authentication pages below must retain one-time intent.
export function ThemeColorsProvider({ children }: ThemeColorsProviderProps) {
  return (
    <>
      <SessionQueryScope>
        <ThemeColorsEffects />
      </SessionQueryScope>
      {children}
    </>
  );
}

function ThemeColorsEffects() {
  const { data: colors } = useQuery(themeColorsQueryOptions());

  const { theme: platformTheme, capabilities } = usePlatform();
  const { isDark } = useTheme();

  // Apply colors on mount and when they change
  useEffect(() => {
    applyThemeColors(colors || DEFAULT_THEME_COLORS);
  }, [colors]);

  // Sync Telegram header and bottom bar colors with theme
  const syncTelegramColors = useCallback(() => {
    if (!capabilities.hasThemeSync) return;

    const themeColors = colors || DEFAULT_THEME_COLORS;
    // Use surface color for header/bottom bar to match app UI
    const headerColor = isDark ? themeColors.darkSurface : themeColors.lightSurface;
    // Фон клиента под страницей — тот же, что у самой страницы. Иначе на
    // Android всё, что WebView не успел отрисовать, просвечивает цветом
    // клиента: чёрные прямоугольники и «прыгающие» цвета на Xiaomi.
    const pageColor = isDark ? themeColors.darkBackground : themeColors.lightBackground;

    platformTheme.setHeaderColor(headerColor);
    platformTheme.setBottomBarColor(headerColor);
    platformTheme.setBackgroundColor(pageColor);
  }, [capabilities.hasThemeSync, colors, isDark, platformTheme]);

  // Apply Telegram colors when theme or colors change
  useEffect(() => {
    syncTelegramColors();
  }, [syncTelegramColors]);

  return null;
}
