// @vitest-environment jsdom
import type { ComponentType } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import { PlatformProvider } from '@/platform/PlatformProvider';

/**
 * User pages keep the approved silent waiting state; admin pages retain their
 * compact accessible indicators. For silent pages we also resolve the data and
 * verify real content appears, so removing an indicator cannot hide a dead page.
 */

const queryState = vi.hoisted(() => ({ ready: false }));
const readyData: Record<string, unknown> = {
  contests: [],
  polls: [],
  'subscriptions-list': { subscriptions: [], multi_tariff_enabled: true },
  'trial-info': { is_available: false },
  balance: { balance_kopeks: 125000, balance_rubles: 1250 },
  subscription: { subscription: null },
  'purchase-options': { sales_mode: 'tariffs', tariffs: [], periods: [] },
  'saved-cards': { cards: [] },
  appConfig: { platforms: {} },
  connectionLink: { subscription_url: null },
  'wheel-config': { is_enabled: false },
  'wheel-history': { items: [] },
  'pending-gifts': [],
  devices: { devices: [] },
  'merge-preview': {
    primary: { id: 1, auth_methods: [], balance_kopeks: 0, subscription: null },
    secondary: { id: 2, auth_methods: [], balance_kopeks: 0, subscription: null },
    expires_in_seconds: 300,
  },
  news: { title: 'Loaded news fixture', content: '<p>Loaded article body</p>', category_color: null },
  'info-pages': {
    title: { ru: 'Loaded information fixture' },
    content: { ru: '<p>Loaded document body</p>' },
    page_type: 'html',
  },
};
const silentContent: Record<string, string> = {
  Contests: 'contests.title',
  Polls: 'polls.title',
  Subscriptions: 'Нет подписок',
  SavedCards: 'balance.savedCards.empty',
  Dashboard: 'Купить подписку',
  Connection: 'subscription.connection.notConfigured',
  SubscriptionPurchase: 'Нет доступных вариантов подписки',
  Wheel: 'wheel.disabled',
  MergeAccounts: 'merge.title',
  NewsArticle: 'Loaded news fixture',
  InfoPageView: 'Loaded information fixture',
};
beforeEach(() => { queryState.ready = false; });

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  const pending = {
    data: undefined,
    isLoading: true,
    isPending: true,
    isFetching: true,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: string[] }) => queryState.ready ? {
      ...pending,
      data: readyData[queryKey[0]],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isSuccess: true,
    } : pending,
    useInfiniteQuery: () => ({ ...pending, fetchNextPage: () => {}, hasNextPage: false }),
    useMutation: () => ({
      mutate: () => {},
      mutateAsync: () => Promise.resolve(),
      isPending: false,
    }),
    useQueryClient: () => ({
      invalidateQueries: () => {},
      setQueryData: () => {},
      getQueryData: () => undefined,
    }),
  };
});

// jsdom не реализует matchMedia, а тема и фоны его спрашивают.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Значение подставляет vite через define; в тестах его нет.
(globalThis as Record<string, unknown>).__APP_VERSION__ ??= '0.0.0-test';

afterEach(cleanup);

type PageCase = {
  name: string;
  load: () => Promise<{ default: ComponentType }>;
  /** Шаблон маршрута и адрес — страницы с ранним выходом по параметру. */
  path?: string;
  entry?: string;
};

/**
 * AdminTrafficUsage сюда не входит намеренно: его заглушки — ячейки таблицы,
 * которые появляются только когда строки уже пришли, а обогащение ещё грузится.
 * Пустой мок такого состояния не даёт. Ячейки не обёрнуты в SkeletonGroup
 * специально: role="status" в каждой заставил бы скринридер зачитать
 * «загрузка» по разу на ячейку.
 */
const PAGES: PageCase[] = [
  { name: 'Referral', load: () => import('./Referral') },
  { name: 'Contests', load: () => import('./Contests') },
  { name: 'Polls', load: () => import('./Polls') },
  { name: 'AdminPartnerSettings', load: () => import('./AdminPartnerSettings') },
  { name: 'AdminReferralLevels', load: () => import('./AdminReferralLevels') },
  { name: 'AdminTicketSettings', load: () => import('./AdminTicketSettings') },
  {
    name: 'AdminBroadcastDetail',
    load: () => import('./AdminBroadcastDetail'),
    path: '/b/:id',
    entry: '/b/1',
  },
  {
    name: 'AdminCouponDetail',
    load: () => import('./AdminCouponDetail'),
    path: '/c/:id',
    entry: '/c/1',
  },
  {
    name: 'AdminWithdrawalDetail',
    load: () => import('./AdminWithdrawalDetail'),
    path: '/w/:id',
    entry: '/w/1',
  },
  {
    name: 'AdminPromocodeStats',
    load: () => import('./AdminPromocodeStats'),
    path: '/p/:id',
    entry: '/p/1',
  },
  {
    name: 'AdminLandingStats',
    load: () => import('./AdminLandingStats'),
    path: '/l/:id',
    entry: '/l/1',
  },
  {
    name: 'AdminPartnerDetail',
    load: () => import('./AdminPartnerDetail'),
    path: '/pt/:userId',
    entry: '/pt/1',
  },
  {
    name: 'AdminRemnawaveSquadDetail',
    load: () => import('./AdminRemnawaveSquadDetail'),
    path: '/s/:uuid',
    entry: '/s/abc',
  },
  { name: 'Subscriptions', load: () => import('./Subscriptions') },
  { name: 'SavedCards', load: () => import('./SavedCards') },
  { name: 'ConnectedAccounts', load: () => import('./ConnectedAccounts') },
  { name: 'Dashboard', load: () => import('./Dashboard') },
  { name: 'Connection', load: () => import('./Connection') },
  { name: 'SubscriptionPurchase', load: () => import('./SubscriptionPurchase') },
  { name: 'Wheel', load: () => import('./Wheel') },
  { name: 'CouponStatus', load: () => import('./CouponStatus') },
  { name: 'AdminNews', load: () => import('./AdminNews') },
  { name: 'AdminInfoPages', load: () => import('./AdminInfoPages') },
  { name: 'AdminEmailTemplates', load: () => import('./AdminEmailTemplates') },
  { name: 'AdminUpdates', load: () => import('./AdminUpdates') },
  { name: 'AdminDashboard', load: () => import('./AdminDashboard') },
  { name: 'AdminBanSystem', load: () => import('./AdminBanSystem') },
  { name: 'AdminChannelSubscriptions', load: () => import('./AdminChannelSubscriptions') },
  { name: 'AdminWheel', load: () => import('./AdminWheel') },
  { name: 'AdminLegalPages', load: () => import('./AdminLegalPages') },
  {
    name: 'AdminPromoGroupCreate',
    load: () => import('./AdminPromoGroupCreate'),
    path: '/pg/:id',
    entry: '/pg/1',
  },
  {
    name: 'AdminPromocodeCreate',
    load: () => import('./AdminPromocodeCreate'),
    path: '/pc/:id',
    entry: '/pc/1',
  },
  {
    name: 'AdminTariffCreate',
    load: () => import('./AdminTariffCreate'),
    path: '/tc/:id',
    entry: '/tc/1',
  },
  {
    name: 'AdminNewsCreate',
    load: () => import('./AdminNewsCreate'),
    path: '/n/:id',
    entry: '/n/1',
  },
  {
    name: 'AdminInfoPageEditor',
    load: () => import('./AdminInfoPageEditor'),
    path: '/i/:id',
    entry: '/i/1',
  },
  {
    name: 'AdminCampaignEdit',
    load: () => import('./AdminCampaignEdit'),
    path: '/ce/:id',
    entry: '/ce/1',
  },
  {
    name: 'AdminCampaignStats',
    load: () => import('./AdminCampaignStats'),
    path: '/cs/:id',
    entry: '/cs/1',
  },
  {
    name: 'AdminPolicyEdit',
    load: () => import('./AdminPolicyEdit'),
    path: '/pe/:id',
    entry: '/pe/1',
  },
  { name: 'AdminRoleEdit', load: () => import('./AdminRoleEdit'), path: '/re/:id', entry: '/re/1' },
  {
    name: 'AdminServerEdit',
    load: () => import('./AdminServerEdit'),
    path: '/se/:id',
    entry: '/se/1',
  },
  {
    name: 'AdminPaymentMethodEdit',
    load: () => import('./AdminPaymentMethodEdit'),
    path: '/pm/:id',
    entry: '/pm/1',
  },
  { name: 'AdminPromoOfferSend', load: () => import('./AdminPromoOfferSend') },
  {
    name: 'AdminPromoOfferTemplateEdit',
    load: () => import('./AdminPromoOfferTemplateEdit'),
    path: '/pt/:id',
    entry: '/pt/1',
  },
  {
    name: 'AdminUserDetail',
    load: () => import('./AdminUserDetail'),
    path: '/u/:id',
    entry: '/u/1',
  },
  {
    name: 'MergeAccounts',
    load: () => import('./MergeAccounts'),
    path: '/m/:mergeToken',
    entry: '/m/tok',
  },
  { name: 'NewsArticle', load: () => import('./NewsArticle'), path: '/na/:slug', entry: '/na/x' },
  { name: 'InfoPageView', load: () => import('./InfoPageView'), path: '/ip/:slug', entry: '/ip/x' },
  { name: 'GiftClaim', load: () => import('./GiftClaim'), path: '/g/:code', entry: '/g/x' },
];

describe('состояния загрузки страниц', () => {
  for (const { name, load, path, entry } of PAGES) {
    it(`${name}: ${silentContent[name] ? 'silent waiting resolves into content' : 'accessible compact loading'}`, async () => {
      const { default: Page } = await load();
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const renderTree = () => (
        <QueryClientProvider client={queryClient}>
          <PlatformProvider>
            <ToastProvider>
              <MemoryRouter initialEntries={[entry ?? '/']}>
                {path ? (
                  <Routes>
                    <Route path={path} element={<Page />} />
                  </Routes>
                ) : (
                  <Page />
                )}
              </MemoryRouter>
            </ToastProvider>
          </PlatformProvider>
        </QueryClientProvider>
      );
      const view = render(renderTree());
      if (silentContent[name]) {
        expect(screen.queryByRole('status')).toBeNull();
        expect(view.container.querySelector('.animate-spin')).toBeNull();
        // The loaded content must stay guarded while query data is pending.
        expect(screen.queryByText(silentContent[name])).toBeNull();
        queryState.ready = true;
        view.rerender(renderTree());
        expect(await screen.findByText(silentContent[name])).toBeTruthy();
        expect(screen.queryByRole('status')).toBeNull();
        return;
      }

      const groups = screen.getAllByRole('status');
      expect(groups.length).toBeGreaterThanOrEqual(1);
      expect(groups[0].getAttribute('aria-busy')).toBe('true');

      // Плейсхолдеры примитива, а не инлайновая разметка. Заливку иногда
      // перекрывает вызывающая сторона (стеклянные карточки Subscriptions),
      // поэтому проверяем сам факт плейсхолдеров.
      expect(groups[0].querySelectorAll('span').length).toBeGreaterThan(0);

      // One compact loading state; large mock cards must not be mounted.
      expect(groups[0].querySelectorAll('.animate-spin').length).toBeLessThanOrEqual(1);
      expect(groups[0].querySelector('.h-96, .h-64, .h-40')).toBeNull();
    });
  }
});
