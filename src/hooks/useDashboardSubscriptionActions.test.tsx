// @vitest-environment jsdom
import type { PropsWithChildren } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { advanceSession } from '../utils/session';
import { useDashboardSubscriptionActions } from './useDashboardSubscriptionActions';

const api = vi.hoisted(() => ({ refreshTraffic: vi.fn(), deleteDevice: vi.fn() }));
vi.mock('../api/subscription', () => ({ subscriptionApi: api }));
const response = (used: number, cooldown = 30) => ({
  traffic_used_gb: used,
  traffic_used_percent: used,
  is_unlimited: false,
  rate_limited: true,
  retry_after_seconds: cooldown,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function view() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const hook = renderHook(({ id }) => useDashboardSubscriptionActions(id, true), {
    initialProps: { id: 11 },
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { ...hook, client, invalidate };
}
afterEach(cleanup);
beforeEach(() => {
  advanceSession();
  localStorage.clear();
  api.refreshTraffic.mockReset();
  api.deleteDevice.mockReset();
});

it('refreshes A and B independently and ignores late A for B traffic/cooldown/storage', async () => {
  const a = deferred<ReturnType<typeof response>>();
  api.refreshTraffic.mockImplementation((id) =>
    id === 11 ? a.promise : Promise.resolve(response(7, 47)),
  );
  const { result, rerender, invalidate } = view();
  await waitFor(() => expect(api.refreshTraffic).toHaveBeenCalledExactlyOnceWith(11));
  rerender({ id: 22 });
  await waitFor(() => expect(result.current.trafficData?.traffic_used_gb).toBe(7));
  expect(api.refreshTraffic.mock.calls).toEqual([[11], [22]]);
  const bTimestamp = localStorage.getItem('traffic_refresh_ts_22');
  expect(bTimestamp).not.toBeNull();
  invalidate.mockClear();
  await act(async () => {
    a.resolve(response(91, 5));
  });
  await waitFor(() => expect(localStorage.getItem('traffic_refresh_ts_11')).not.toBeNull());
  expect(result.current.trafficData?.traffic_used_gb).toBe(7);
  expect(result.current.trafficRefreshCooldown).toBe(47);
  expect(localStorage.getItem('traffic_refresh_ts_22')).toBe(bTimestamp);
  expect(invalidate).toHaveBeenCalledExactlyOnceWith({
    queryKey: ['subscription', 11],
    exact: true,
  });
});

it('does not apply late A rate-limit errors to the active B cooldown', async () => {
  const a = deferred<ReturnType<typeof response>>();
  api.refreshTraffic.mockImplementation((id) =>
    id === 11 ? a.promise : Promise.resolve(response(7, 47)),
  );
  const { result, rerender } = view();
  await waitFor(() => expect(api.refreshTraffic).toHaveBeenCalledExactlyOnceWith(11));
  rerender({ id: 22 });
  await waitFor(() => expect(result.current.trafficRefreshCooldown).toBe(47));
  await act(async () => {
    a.reject({ response: { status: 429, headers: { get: () => '4' } } });
  });
  expect(result.current.trafficRefreshCooldown).toBe(47);
});

it('invalidates the submitted device target A after selection changes to B', async () => {
  api.refreshTraffic.mockImplementation(() => new Promise(() => {}));
  const deletion = deferred<{ message: string }>();
  api.deleteDevice.mockReturnValue(deletion.promise);
  const { result, rerender, invalidate } = view();
  act(() => result.current.deleteDevice('hwid-a'));
  await waitFor(() => expect(api.deleteDevice).toHaveBeenCalledExactlyOnceWith('hwid-a', 11));
  rerender({ id: 22 });
  expect(result.current.deletingDevice).toBe(false);
  await act(async () => {
    deletion.resolve({ message: 'deleted' });
  });
  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ['devices', 11], exact: true }),
  );
});

it('late success after session change cannot write cache, timestamp or current UI', async () => {
  const traffic = deferred<ReturnType<typeof response>>();
  const deletion = deferred<{ message: string }>();
  api.refreshTraffic.mockReturnValue(traffic.promise);
  api.deleteDevice.mockReturnValue(deletion.promise);
  const { result, rerender, invalidate } = view();
  act(() => result.current.deleteDevice('hwid-a'));
  await waitFor(() => expect(api.deleteDevice).toHaveBeenCalledOnce());
  await waitFor(() => expect(api.refreshTraffic).toHaveBeenCalledOnce());
  act(() => advanceSession());
  await act(async () => {
    traffic.resolve(response(91));
    deletion.resolve({ message: 'deleted' });
  });
  rerender({ id: 22 });
  expect(result.current.trafficData).toBeNull();
  expect(result.current.trafficRefreshCooldown).toBe(0);
  expect(invalidate).not.toHaveBeenCalled();
  expect(localStorage.getItem('traffic_refresh_ts_11')).toBeNull();
  expect(localStorage.getItem('traffic_refresh_ts_22')).toBeNull();
  expect(api.refreshTraffic).toHaveBeenCalledOnce();
});
