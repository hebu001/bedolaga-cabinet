// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrafficTopItem, TrafficTopParams, TrafficTopResponse } from '@/api/adminTraffic';
import { utcPeriodRange } from '@/components/admin/trafficUsage/trafficTopHelpers';
import AdminTrafficUsage from './AdminTrafficUsage';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/api/client', () => ({ default: { get, post } }));
vi.mock('@/platform/hooks/usePlatform', () => ({
  usePlatform: () => ({ capabilities: { hasBackButton: false } }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'ru' },
  }),
  initReactI18next: { type: '3rdParty', init() {} },
}));
vi.mock('@/components/DateField', () => ({
  DateField: ({
    value,
    onChange,
    min,
  }: {
    value: string;
    onChange: (value: string) => void;
    min?: string;
  }) => (
    <input
      aria-label={min ? 'End date' : 'Start date'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const catalog = {
  nodes: [
    { uuid: A, name: 'Node Alpha', country_code: 'US' },
    { uuid: B, name: 'Node Beta', country_code: 'GB' },
  ],
};
const account = (id: number, rank = id): TrafficTopItem => ({
  rank,
  panel_user_id: id,
  panel_username: `panel-account-${id}`,
  total_bytes: 1000 - rank,
  mapping_status: 'unmapped',
  local_user: null,
});
function report(
  params: TrafficTopParams = { period: 7, node_uuids: null },
  items = [account(1), account(2)],
): TrafficTopResponse {
  const uuids = params.node_uuids ?? [A, B];
  const dates = params.period !== undefined ? utcPeriodRange(params.period, '2026-10-21') : params;
  const firstDay = Date.parse(`${dates.start_date}T00:00:00Z`);
  const days = (Date.parse(`${dates.end_date}T00:00:00Z`) - firstDay) / 86_400_000 + 1;
  const topSum = items.reduce((sum, item) => sum + item.total_bytes, 0);
  const allTraffic = Math.max(20_000, topSum + 1000);
  const daily = Array.from({ length: days }, (_, index) => ({
    date: new Date(firstDay + index * 86_400_000).toISOString().slice(0, 10),
    total_bytes:
      days === 1 ? allTraffic : index === 0 ? allTraffic - 12_000 : index === days - 1 ? 12_000 : 0,
  }));
  return {
    scope: {
      kind: params.node_uuids === null ? 'all' : 'selected',
      node_uuids: uuids,
      node_count: uuids.length,
    },
    range: { start_date: dates.start_date, end_date: dates.end_date, days, timezone: 'UTC' },
    top_limit: 100,
    returned_count: items.length,
    all_recorded_total_bytes: allTraffic,
    top_sum_bytes: topSum,
    daily,
    items,
    generated_at: '2026-10-21T12:00:00Z',
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
function renderPage(
  client = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 10 } } }),
) {
  clients.push(client);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/admin/traffic-usage']}>
          <Link to="/gone">Leave traffic</Link>
          <Routes>
            <Route path="/admin/traffic-usage" element={<AdminTrafficUsage />} />
            <Route path="/gone" element={<div>Another page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}
const settle = (ms = 60) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
const ready = () => screen.findByText('panel-account-1');
const chooseNode = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: /^admin.trafficUsage.nodes/ }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
  fireEvent.mouseDown(document.body);
  await settle(10);
};
beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockResolvedValue({ data: catalog });
  post.mockImplementation((_url, params) => Promise.resolve({ data: report(params) }));
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('bounded top-100 traffic report', () => {
  it('waits for the cached node catalog and cold-opens exactly one seven-day aggregate', async () => {
    const nodes = deferred<{ data: typeof catalog }>();
    get.mockReturnValue(nodes.promise);
    renderPage();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(post).not.toHaveBeenCalled();
    await act(async () => {
      nodes.resolve({ data: catalog });
    });
    await ready();
    await settle(650);
    expect(get).toHaveBeenCalledWith('/cabinet/admin/traffic/nodes', {
      signal: expect.any(AbortSignal),
    });
    expect(post).toHaveBeenCalledExactlyOnceWith(
      '/cabinet/admin/traffic/top',
      { period: 7, node_uuids: null },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('requests only the selected period and reuses a fresh completed scope', async () => {
    renderPage();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '1admin.trafficUsage.days' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '7admin.trafficUsage.days' }));
    await settle();
    expect(post.mock.calls.map(([, params]) => params.period)).toEqual([7, 1]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('sends a selected node set in a single aggregate request with canonical ordering', async () => {
    renderPage();
    await ready();
    await chooseNode('Node Beta');
    expect(post.mock.calls[post.mock.calls.length - 1][1]).toEqual({ period: 7, node_uuids: [B] });
    await chooseNode('Node Alpha');
    expect(post.mock.calls[post.mock.calls.length - 1][1]).toEqual({
      period: 7,
      node_uuids: [A, B],
    });
    expect(post).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('traffic-scope').textContent).toContain('selectedNodes');
  });

  it('never treats an empty country/node intersection as all nodes', async () => {
    renderPage();
    await ready();
    await chooseNode('Node Alpha');
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'admin.trafficUsage.top100.countries' }));
    fireEvent.click(screen.getByRole('button', { name: /GB/ }));
    await settle();
    expect(screen.getByRole('status').textContent).toBe('admin.trafficUsage.top100.emptySelection');
    expect(post).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('traffic-scope')).toBeNull();
    expect(screen.queryByText('panel-account-1')).toBeNull();
  });

  it('search, sorting and pagination remain inside 100 accounts without network requests', async () => {
    post.mockImplementation((_url, params) =>
      Promise.resolve({
        data: report(
          params,
          Array.from({ length: 100 }, (_, index) => account(index + 1)),
        ),
      }),
    );
    renderPage();
    await ready();
    expect(screen.getAllByRole('row')).toHaveLength(51);
    fireEvent.click(screen.getByRole('button', { name: 'admin.trafficUsage.top100.nextPage' }));
    expect(screen.getByText('panel-account-100')).toBeTruthy();
    expect(screen.queryByText('panel-account-1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'admin.trafficUsage.top100.account' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'panel-account-100' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    const row = screen.getByText('panel-account-100').closest('tr');
    expect(row?.getAttribute('data-panel-id')).toBe('100');
    expect(row?.firstElementChild?.textContent).toBe('100');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not-in-this-top' } });
    expect(screen.getByText('admin.trafficUsage.top100.noMatches')).toBeTruthy();
    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('preserves unmapped, ambiguous and multiple panel accounts for the same local owner', async () => {
    const items = [
      account(1),
      { ...account(2), mapping_status: 'ambiguous' as const },
      ...[3, 4].map((id) => ({
        ...account(id),
        mapping_status: 'matched' as const,
        local_user: { id: 99, display_name: 'Same owner' },
      })),
    ];
    post.mockResolvedValue({ data: report(undefined, items) });
    renderPage();
    await ready();
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(screen.getAllByRole('link', { name: 'Same owner' })).toHaveLength(2);
    for (const id of [1, 2]) {
      const row = screen.getByText(`panel-account-${id}`).closest('tr');
      if (!row) throw new Error('Account row missing');
      expect(within(row).queryByRole('link')).toBeNull();
    }
    expect(
      screen.getAllByRole('link', { name: 'Same owner' }).map((link) => link.getAttribute('href')),
    ).toEqual(['/admin/users/99', '/admin/users/99']);
  });

  it('keeps total-node traffic, Top-100 sum and daily metadata distinct', async () => {
    post.mockResolvedValue({ data: report(undefined, [{ ...account(1), total_bytes: 12000 }]) });
    renderPage();
    await ready();
    expect(screen.getByTestId('traffic-allTraffic').textContent).toContain('19.53 KB');
    expect(screen.getByTestId('traffic-topTraffic').textContent).toContain('11.72 KB');
    expect(screen.getByTestId('traffic-averageDaily').textContent).toContain('2.79 KB');
    expect(screen.getByTestId('traffic-peakDaily').textContent).toContain('2026-10-21 UTC');
    expect(screen.getByTestId('traffic-scope').textContent).toContain(
      '2026-10-15 — 2026-10-21 · UTC',
    );
    expect(screen.getByRole('img', { name: 'admin.trafficUsage.top100.daily' })).toBeTruthy();
  });

  it.each([502, 503])(
    'shows HTTP %s as an error without retries, fallbacks or invented zeros',
    async (status) => {
      post.mockRejectedValue(new Error(`HTTP ${status}`));
      renderPage();
      expect((await screen.findByRole('alert')).textContent).toBe('common.loadError');
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      });
      await settle();
      expect(post).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('traffic-allTraffic')).toBeNull();
      expect(screen.queryByText('admin.trafficUsage.top100.noAccounts')).toBeNull();
    },
  );

  it('refresh requests the active aggregate once without refetching nodes or other periods', async () => {
    renderPage();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '1admin.trafficUsage.days' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    await ready();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'common.refresh' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    await settle();
    expect(post.mock.calls.map(([, params]) => params.period)).toEqual([7, 1, 1]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('aborts obsolete work and ignores late responses while clearing old scope metadata and rows', async () => {
    const obsolete = deferred<{ data: TrafficTopResponse }>();
    post.mockImplementation((_url, params) =>
      params.period === 1
        ? obsolete.promise
        : Promise.resolve({ data: report(params, [account(params.period)]) }),
    );
    renderPage();
    await screen.findByText('panel-account-7');
    fireEvent.click(screen.getByRole('button', { name: '1admin.trafficUsage.days' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('panel-account-7')).toBeNull();
    expect(screen.queryByTestId('traffic-scope')).toBeNull();
    const signal = post.mock.calls[1][2].signal as AbortSignal;
    fireEvent.click(screen.getByRole('button', { name: '3admin.trafficUsage.days' }));
    await screen.findByText('panel-account-3');
    expect(signal.aborted).toBe(true);
    await act(async () => {
      obsolete.resolve({ data: report({ period: 1, node_uuids: null }, [account(999)]) });
    });
    expect(screen.queryByText('panel-account-999')).toBeNull();
    expect(screen.getByText('panel-account-3')).toBeTruthy();
  });

  it('aborts the pending POST when leaving the page', async () => {
    post.mockImplementation(() => new Promise(() => {}));
    renderPage();
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const signal = post.mock.calls[0][2].signal as AbortSignal;
    fireEvent.click(screen.getByRole('link', { name: 'Leave traffic' }));
    await screen.findByText('Another page');
    expect(signal.aborted).toBe(true);
  });

  it('stages dates, rejects 32 inclusive days, and sends only applied valid dates', async () => {
    renderPage();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'admin.trafficUsage.customDates' }));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-02-01' } });
    expect(
      screen
        .getByRole('button', { name: 'admin.trafficUsage.top100.applyDates' })
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-31' } });
    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'admin.trafficUsage.top100.applyDates' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1]).toEqual({
      start_date: '2026-01-01',
      end_date: '2026-01-31',
      node_uuids: null,
    });
  });

  it('an unavailable catalog blocks ranking and explicit refresh retries the catalog once', async () => {
    get.mockRejectedValueOnce(new Error('503 unavailable'));
    renderPage();
    await screen.findByRole('alert');
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));
    await ready();
    expect(get).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('clearing the session query cache removes all private report data', async () => {
    const first = renderPage();
    await ready();
    first.unmount();
    first.client.clear();
    post.mockImplementation((_url, params) =>
      Promise.resolve({ data: report(params, [account(55)]) }),
    );
    renderPage(first.client);
    await screen.findByText('panel-account-55');
    expect(screen.queryByText('panel-account-1')).toBeNull();
    expect(post).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
