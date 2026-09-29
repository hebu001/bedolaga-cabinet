// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import { PlatformProvider } from '@/platform/PlatformProvider';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/components/admin', () => ({
  AdminBackButton: () => <a href="/admin/partners">common.back</a>,
}));

const partnerApi = vi.hoisted(() => ({
  getApplications: vi.fn(),
  approveApplication: vi.fn(),
  rejectApplication: vi.fn(),
}));

vi.mock('../api/partners', () => ({ partnerApi }));

const authApi = vi.hoisted(() => ({
  getMergePreview: vi.fn(),
  executeMerge: vi.fn(),
}));

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>();
  return { ...actual, authApi: { ...actual.authApi, ...authApi } };
});

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

afterEach(cleanup);
beforeEach(() => {
  partnerApi.getApplications.mockReset();
  authApi.getMergePreview.mockReset();
});

describe('пограничные состояния из дизайн-аудита', () => {
  it('завершённая заявка партнёра не остаётся на бесконечном спиннере', async () => {
    partnerApi.getApplications.mockResolvedValue({ items: [], total: 0 });
    const AdminApplicationReview = (await import('./AdminApplicationReview')).default;

    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter initialEntries={['/admin/partners/applications/7/review']}>
          <Routes>
            <Route
              path="/admin/partners/applications/:id/review"
              element={<AdminApplicationReview />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Заявка не найдена или уже обработана.');
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('ошибка списка заявок предлагает реальную повторную загрузку', async () => {
    partnerApi.getApplications
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [], total: 0 });
    const AdminApplicationReview = (await import('./AdminApplicationReview')).default;

    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter initialEntries={['/admin/partners/applications/7/review']}>
          <Routes>
            <Route
              path="/admin/partners/applications/:id/review"
              element={<AdminApplicationReview />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'common.retry' }));
    await waitFor(() => expect(partnerApi.getApplications).toHaveBeenCalledTimes(2));
  });

  it('нулевой срок объединения сразу показывает штатное истечение без исключения', async () => {
    authApi.getMergePreview.mockResolvedValue({
      expires_in_seconds: 0,
      primary: {
        id: 1,
        username: 'first',
        first_name: null,
        email: null,
        auth_methods: ['telegram'],
        balance_kopeks: 0,
        subscription: null,
        created_at: null,
      },
      secondary: {
        id: 2,
        username: 'second',
        first_name: null,
        email: null,
        auth_methods: ['email'],
        balance_kopeks: 0,
        subscription: null,
        created_at: null,
      },
    });
    const MergeAccounts = (await import('./MergeAccounts')).default;

    render(
      <QueryClientProvider client={client()}>
        <PlatformProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/merge/audit-token']}>
              <Routes>
                <Route path="/merge/:mergeToken" element={<MergeAccounts />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </PlatformProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('merge.expired')).toBeTruthy();
  });
});
