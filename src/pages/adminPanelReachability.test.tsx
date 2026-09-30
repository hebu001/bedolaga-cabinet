// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderWithProviders, installMatchMedia } from '../components/admin/reachability/testUtils';
import AdminPanel from './AdminPanel';

const access = vi.hoisted(() => ({ read: true }));
vi.hoisted(() => vi.stubGlobal('__APP_VERSION__', '1.79.0'));
vi.mock('@/store/permissions', () => ({
  usePermissionStore: (select: (state: object) => unknown) =>
    select({
      hasPermission: (permission: string) => permission === 'reachability:read' && access.read,
    }),
}));
vi.mock('@/hooks/useTelegramSDK', () => ({
  isInTelegramWebApp: () => false,
  useTelegramSDK: () => ({
    safeAreaInset: { top: 0, bottom: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0 },
  }),
}));
vi.mock('@/api/admin', () => ({
  statsApi: { getSystemInfo: async () => null, getDashboardStats: async () => null },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
installMatchMedia();
afterEach(cleanup);

it.each([true, false])('BSCHEKER menu respects read permission: %s', (allowed) => {
  access.read = allowed;
  renderWithProviders(<AdminPanel />);
  const link = screen.queryByRole('link', { name: /admin.nav.reachability/ });
  if (allowed) expect(link?.getAttribute('href')).toBe('/admin/reachability');
  else expect(link).toBeNull();
});
