// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { integrationCapabilities } from '@/config/integrationCapabilities';
import { reachabilityStatus } from '@/test/fixtures/reachabilityBotContract';
import { useReachabilityAvailable, useReachabilityStatus } from './useReachabilityStatus';

const getStatus = vi.fn();
vi.mock('@/api/reachability', () => ({ reachabilityApi: { getStatus: () => getStatus() } }));
afterEach(() => {
  cleanup();
  getStatus.mockReset();
});

it.each([
  { enabled: true, configured: true, available: true },
  { enabled: false, configured: true, available: false },
  { enabled: true, configured: false, available: false },
  { enabled: false, configured: false, available: false },
])('uses server status for shortcuts: %j', async ({ enabled, configured, available }) => {
  expect(integrationCapabilities.reachability).toBe(true);
  getStatus.mockResolvedValue({ ...reachabilityStatus, enabled, configured });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useReachabilityAvailable(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(getStatus).toHaveBeenCalledOnce();
  await waitFor(() => expect(result.current).toBe(available));
  client.clear();
});

it('does not request status when the caller disables the query', () => {
  const client = new QueryClient();
  renderHook(() => useReachabilityStatus(false), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  expect(getStatus).not.toHaveBeenCalled();
  client.clear();
});
