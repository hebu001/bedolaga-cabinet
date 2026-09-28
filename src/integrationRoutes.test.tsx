// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

const { pendingApi } = vi.hoisted(() => ({
  pendingApi: vi.fn(() => <div>Pending API called</div>),
}));
vi.mock('./store/auth', () => ({
  useAuthStore: (select: (state: object) => unknown) =>
    select({ isAuthenticated: true, isLoading: false, isAdmin: true, sessionGeneration: 1 }),
}));
vi.mock('./store/blocking', () => ({ useBlockingStore: () => null }));
vi.mock('./hooks/useDoneKey', () => ({ useDoneKey: () => {} }));
vi.mock('./hooks/useAnalyticsCounters', () => ({ useAnalyticsCounters: () => {} }));
vi.mock('./hooks/useSiteVerification', () => ({ useSiteVerification: () => {} }));
vi.mock('./utils/token', () => ({ saveReturnUrl: () => {} }));
vi.mock('./components/auth/PermissionRoute', () => ({
  PermissionRoute: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./providers/I18nBootstrap', () => ({
  AdminTranslationsGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./components/layout/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./components/blocking', () => ({
  MaintenanceScreen: () => null,
  ChannelSubscriptionScreen: () => null,
  BlacklistedScreen: () => null,
  AccountDeletedScreen: () => null,
  ServiceUnavailableScreen: () => null,
}));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>Current dashboard</div> }));
vi.mock('./pages/AdminCoupons', () => ({ default: pendingApi }));
vi.mock('./pages/AdminCouponCreate', () => ({ default: pendingApi }));
vi.mock('./pages/AdminCouponDetail', () => ({ default: pendingApi }));
vi.mock('./pages/CouponStatus', () => ({ default: pendingApi }));
vi.mock('./pages/AdminReferralLevels', () => ({ default: pendingApi }));
vi.mock('./pages/AdminLegalPages', () => ({ default: pendingApi }));
vi.mock('./pages/PublicLegal', () => ({ default: pendingApi }));
vi.mock('./pages/AdminReachability', () => ({ default: pendingApi }));
vi.mock('./pages/AdminReachabilityHistory', () => ({ default: pendingApi }));
vi.mock('./pages/AdminReachabilityOther', () => ({ default: pendingApi }));
vi.mock('./pages/AdminReminders', () => ({ default: pendingApi }));
vi.mock('./pages/AdminReminderEdit', () => ({ default: pendingApi }));
vi.mock('./pages/AdminSystemErrors', () => ({ default: pendingApi }));
vi.mock('./pages/AdminGraceAccess', () => ({ default: pendingApi }));

afterEach(() => {
  cleanup();
  pendingApi.mockClear();
});

it.each([
  '/coupon/test-token',
  '/admin/coupons',
  '/admin/coupons/create',
  '/admin/coupons/1',
  '/admin/partners/referral-levels',
  '/admin/legal-pages',
  '/offer',
  '/privacy',
  '/recurrent-payments',
  '/admin/reachability',
  '/admin/reachability/history',
  '/admin/reachability/other',
  '/admin/reminders',
  '/admin/reminders/1',
  '/admin/reminders/1/edit',
  '/admin/system-errors',
  '/admin/grace-access',
])(
  'direct URL %s cannot mount an unverified API consumer even with admin permissions',
  async (url) => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Current dashboard')).toBeTruthy();
    expect(pendingApi).not.toHaveBeenCalled();
  },
);
