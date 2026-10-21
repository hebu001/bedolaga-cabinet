// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrafficUsageResponse, UserTrafficItem } from '@/api/adminTraffic';
import { adminTrafficApi } from '@/api/adminTraffic';
import AdminTrafficUsage from './AdminTrafficUsage';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/api/client', () => ({ default: { get, post } }));
vi.mock('@/platform/hooks/usePlatform', () => ({
  usePlatform: () => ({ capabilities: { hasBackButton: false } }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
  initReactI18next: { type: '3rdParty', init() {} },
}));

const user = (id: number): UserTrafficItem => ({
  user_id: id,
  telegram_id: id,
  username: `traffic-user-${id}`,
  email: null,
  full_name: `Traffic User ${id}`,
  tariff_name: 'Standard',
  subscription_status: 'active',
  traffic_limit_gb: 100,
  device_limit: 3,
  node_traffic: {},
  total_bytes: 100,
});

function page(ids = [2, 1], period = 30): TrafficUsageResponse {
  return {
    items: ids.map(user),
    nodes: [],
    total: ids.length,
    offset: 0,
    limit: 50,
    period_days: period,
    available_tariffs: ['Standard'],
    available_statuses: ['active'],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const clients: QueryClient[] = [];
function renderPage() {
  // Aggressive global defaults must not turn an overloaded admin endpoint
  // into retries. The page overrides these for both traffic queries.
  const client = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 10 } } });
  clients.push(client);
  const rendered = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/traffic-usage']}>
        <Link to="/gone">Leave traffic</Link>
        <Routes>
          <Route path="/admin/traffic-usage" element={<AdminTrafficUsage />} />
          <Route path="/gone" element={<div>Another page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...rendered, client };
}

const trafficCalls = () => get.mock.calls.filter(([url]) => url === '/cabinet/admin/traffic');
const enrichmentCalls = () => get.mock.calls.filter(([url]) => url.endsWith('/enrichment'));
const settle = (ms = 80) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((url, config) =>
    Promise.resolve({
      data: url.endsWith('/enrichment') ? { data: {} } : page([2, 1], config.params.period),
    }),
  );
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('traffic request lifecycle', () => {
  it('cold opening loads one period and details only for visible users', async () => {
    renderPage();
    await screen.findByText('Traffic User 1');
    await waitFor(() => expect(enrichmentCalls()).toHaveLength(1));
    // Cross the former 500ms background-prefetch timer.
    await settle(650);
    expect(trafficCalls()).toHaveLength(1);
    expect(trafficCalls()[0][1]).toMatchObject({ params: { period: 30, limit: 50, offset: 0 } });
    expect(enrichmentCalls()[0][1]).toMatchObject({ params: { user_ids: '1,2' } });
    expect(trafficCalls()[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(enrichmentCalls()[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('only a selected period is requested and returning to fresh data uses the query cache', async () => {
    renderPage();
    await screen.findByText('Traffic User 1');
    fireEvent.click(screen.getByRole('button', { name: '7admin.trafficUsage.days' }));
    await waitFor(() => expect(trafficCalls()).toHaveLength(2));
    await screen.findByText('Traffic User 1');
    fireEvent.click(screen.getByRole('button', { name: '30admin.trafficUsage.days' }));
    await settle();
    expect(trafficCalls().map(([, config]) => config.params.period)).toEqual([30, 7]);
    expect(enrichmentCalls()).toHaveLength(1);
  });

  it('a failed calculation surfaces an error without retries, focus or reconnect requests', async () => {
    get.mockRejectedValue(new Error('503 overloaded'));
    renderPage();
    expect((await screen.findByRole('alert')).textContent).toContain('common.loadError');
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    await settle();
    expect(trafficCalls()).toHaveLength(1);
    expect(enrichmentCalls()).toHaveLength(0);
    expect(screen.queryByText('admin.trafficUsage.noData')).toBeNull();
    expect(screen.getByRole('button', { name: 'common.refresh' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('refresh fetches each active query exactly once and leaves other periods idle', async () => {
    renderPage();
    await screen.findByText('Traffic User 1');
    await waitFor(() => expect(enrichmentCalls()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: '7admin.trafficUsage.days' }));
    await waitFor(() => expect(trafficCalls()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'common.refresh' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));
    await waitFor(() => expect(trafficCalls()).toHaveLength(3));
    await waitFor(() => expect(enrichmentCalls()).toHaveLength(2));
    await settle();
    expect(trafficCalls().map(([, config]) => config.params.period)).toEqual([30, 7, 7]);
    expect(enrichmentCalls()).toHaveLength(2);
  });

  it('switching period aborts the old request and ignores a late response', async () => {
    const old = deferred<{ data: TrafficUsageResponse }>();
    get.mockImplementation((url, config) => {
      if (url.endsWith('/enrichment')) return Promise.resolve({ data: { data: {} } });
      return config.params.period === 30 ? old.promise : Promise.resolve({ data: page([7], 7) });
    });
    renderPage();
    await waitFor(() => expect(trafficCalls()).toHaveLength(1));
    const firstSignal = trafficCalls()[0][1].signal as AbortSignal;
    fireEvent.click(screen.getByRole('button', { name: '7admin.trafficUsage.days' }));
    await screen.findByText('Traffic User 7');
    expect(firstSignal.aborted).toBe(true);
    await act(async () => {
      old.resolve({ data: page([30]) });
    });
    expect(screen.queryByText('Traffic User 30')).toBeNull();
    expect(enrichmentCalls().map(([, config]) => config.params.user_ids)).toEqual(['7']);
  });

  it('leaving the page aborts the pending HTTP request', async () => {
    get.mockImplementation(() => new Promise(() => {}));
    renderPage();
    await waitFor(() => expect(trafficCalls()).toHaveLength(1));
    const signal = trafficCalls()[0][1].signal as AbortSignal;
    fireEvent.click(screen.getByRole('link', { name: 'Leave traffic' }));
    await screen.findByText('Another page');
    expect(signal.aborted).toBe(true);
    expect(enrichmentCalls()).toHaveLength(0);
  });

  it('changing users aborts old enrichment and never displays its late result', async () => {
    const old = deferred<{ data: { data: Record<number, unknown> } }>();
    get.mockImplementation((url, config) => {
      if (url.endsWith('/enrichment')) {
        return config.params.user_ids === '1'
          ? old.promise
          : Promise.resolve({ data: { data: {} } });
      }
      return Promise.resolve({
        data: page([config.params.period === 30 ? 1 : 7], config.params.period),
      });
    });
    renderPage();
    await waitFor(() => expect(enrichmentCalls()).toHaveLength(1));
    const signal = enrichmentCalls()[0][1].signal as AbortSignal;
    fireEvent.click(screen.getByRole('button', { name: '7admin.trafficUsage.days' }));
    await screen.findByText('Traffic User 7');
    await waitFor(() => expect(enrichmentCalls()).toHaveLength(2));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      old.resolve({ data: { data: { 1: { last_node_name: 'Stale node' } } } });
    });
    expect(screen.queryByText('Stale node')).toBeNull();
  });

  it('an enrichment error leaves the table available and does not retry', async () => {
    get.mockImplementation((url) =>
      url.endsWith('/enrichment')
        ? Promise.reject(new Error('503 panel unavailable'))
        : Promise.resolve({ data: page() }),
    );
    renderPage();
    await screen.findByText('Traffic User 1');
    await screen.findByRole('alert');
    await settle();
    expect(enrichmentCalls()).toHaveLength(1);
  });

  it('never requests legacy full enrichment for an empty user set', async () => {
    expect(await adminTrafficApi.getEnrichment([])).toEqual({ data: {} });
    expect(get).not.toHaveBeenCalled();
    get.mockResolvedValue({ data: page([]) });
    renderPage();
    await screen.findByText('admin.trafficUsage.noData');
    expect(enrichmentCalls()).toHaveLength(0);
  });

  it('pagination scopes details to the new page and enrichment sorting remains global', async () => {
    get.mockImplementation((url, config) =>
      Promise.resolve({
        data: url.endsWith('/enrichment')
          ? { data: {} }
          : {
              ...page([config.params.offset + 1]),
              total: 100,
              offset: config.params.offset,
            },
      }),
    );
    renderPage();
    await screen.findByText('Traffic User 1');
    await waitFor(() => expect(enrichmentCalls()).toHaveLength(1));
    const next = screen.getByText('1 / 2').parentElement?.querySelector('button:last-child');
    if (!next) throw new Error('Next-page button is missing');
    fireEvent.click(next);
    await screen.findByText('Traffic User 51');
    await waitFor(() => expect(enrichmentCalls()).toHaveLength(2));
    expect(enrichmentCalls().map(([, config]) => config.params.user_ids)).toEqual(['1', '51']);
    fireEvent.click(screen.getByRole('columnheader', { name: 'admin.trafficUsage.connected' }));
    await waitFor(() => expect(trafficCalls()).toHaveLength(3));
    expect(trafficCalls()[2][1].params).toMatchObject({ sort_by: 'connected', offset: 0 });
    await screen.findByText('Traffic User 1');
    const search = screen.getByPlaceholderText('admin.trafficUsage.search');
    fireEvent.change(search, { target: { value: 'needle' } });
    const form = search.closest('form');
    if (!form) throw new Error('Search form is missing');
    fireEvent.submit(form);
    await waitFor(() => expect(trafficCalls()).toHaveLength(4));
    expect(trafficCalls()[3][1].params).toMatchObject({ search: 'needle', offset: 0 });
  });

  it('CSV export remains an explicit action using the selected period', async () => {
    post.mockResolvedValue({ data: { success: true, message: 'sent' } });
    renderPage();
    await screen.findByText('Traffic User 1');
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '7admin.trafficUsage.days' }));
    await waitFor(() => expect(trafficCalls()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'admin.trafficUsage.exportCsv' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledExactlyOnceWith('/cabinet/admin/traffic/export-csv', {
        period: 7,
      }),
    );
    await screen.findByText('admin.trafficUsage.exportSuccess');
  });
});
