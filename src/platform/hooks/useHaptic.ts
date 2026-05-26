import { useCallback, useMemo } from 'react';
import { usePlatform } from '@/platform/hooks/usePlatform';
import type { HapticImpactStyle, HapticNotificationType } from '@/platform/types';

interface HapticMethods {
  /**
   * Trigger impact feedback (for button presses, collisions)
   */
  impact: (style?: HapticImpactStyle) => void;

  /**
   * Trigger notification feedback (for success/warning/error events)
   */
  notification: (type: HapticNotificationType) => void;

  /**
   * Trigger selection feedback (for selection changes)
   */
  selection: () => void;

  /**
   * Whether haptic feedback is available
   */
  isAvailable: boolean;
}

/**
 * Hook to access haptic feedback
 * Works in Telegram Mini Apps and falls back to Web Vibration API
 *
 * @example
 * ```tsx
 * function MyButton() {
 *   const haptic = useHaptic();
 *
 *   const handleClick = () => {
 *     haptic.impact('medium');
 *     doSomething();
 *   };
 * }
 * ```
 */
export function useHaptic(): HapticMethods {
  const { haptic, capabilities } = usePlatform();

  const impact = useCallback(
    (style: HapticImpactStyle = 'medium') => {
      haptic.impact(style);
    },
    [haptic],
  );

  const notification = useCallback(
    (type: HapticNotificationType) => {
      haptic.notification(type);
    },
    [haptic],
  );

  const selection = useCallback(() => {
    haptic.selection();
  }, [haptic]);

  return useMemo(
    () => ({
      impact,
      notification,
      selection,
      isAvailable: capabilities.hasHapticFeedback,
    }),
    [impact, notification, selection, capabilities.hasHapticFeedback],
  );
}

/**
 * Hook that returns a click handler with haptic feedback
 * Useful for buttons that need haptic on press
 *
 * @param onClick - Original click handler
 * @param style - Haptic impact style
 *
 * @example
 * ```tsx
 * function MyButton({ onClick }) {
 *   const handleClick = useHapticClick(onClick, 'light');
 *   return <button onClick={handleClick}>Press me</button>;
 * }
 * ```
 */
export function useHapticClick(
  onClick: (() => void) | undefined,
  style: HapticImpactStyle = 'light',
): (() => void) | undefined {
  const haptic = useHaptic();

  return useCallback(() => {
    haptic.impact(style);
    onClick?.();
  }, [haptic, onClick, style]);
}

/**
 * Returns individual haptic trigger functions
 * Useful when you need specific feedback types
 */
export function useHapticFeedback() {
  const haptic = useHaptic();

  return useMemo(
    () => ({
      // Common actions
      buttonPress: () => haptic.impact('light'),
      buttonPressMedium: () => haptic.impact('medium'),
      buttonPressHeavy: () => haptic.impact('heavy'),
      toggle: () => haptic.impact('rigid'),

      // Notifications
      success: () => haptic.notification('success'),
      warning: () => haptic.notification('warning'),
      error: () => haptic.notification('error'),

      // Selection
      selectionChanged: () => haptic.selection(),

      // Raw access
      impact: haptic.impact,
      notification: haptic.notification,
      selection: haptic.selection,
    }),
    [haptic],
  );
}
