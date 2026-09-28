// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { integrationCapabilities } from '@/config/integrationCapabilities';
import { useReachabilityAvailable } from './useReachabilityStatus';

const getStatus = vi.fn().mockResolvedValue({ enabled: true, configured: true });
vi.mock('@/api/reachability', () => ({ reachabilityApi: { getStatus: () => getStatus() } }));
afterEach(cleanup);

it('keeps pending reachability shortcuts and API probing off even for a fully enabled mock service', async () => {
  expect(integrationCapabilities.reachability).toBe(false);
  const client = new QueryClient();
  const { result } = renderHook(() => useReachabilityAvailable(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(getStatus).not.toHaveBeenCalled();
  expect(result.current).toBe(false);
  client.clear();
});
