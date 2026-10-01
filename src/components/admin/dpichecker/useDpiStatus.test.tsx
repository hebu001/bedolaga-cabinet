// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePermissionStore } from '@/store/permissions';
import { DPI_STATUS_KEY, useDpiAvailable, useDpiStatus } from './useDpiStatus';

const fixture = vi.hoisted(() => ({
  gate: false,
  enabled: true,
  configured: true,
  getStatus: vi.fn(),
}));
vi.mock('@/config/integrationCapabilities', () => ({
  integrationCapabilities: {
    get dpichecker() {
      return fixture.gate;
    },
  },
}));
vi.mock('@/api/dpichecker', () => ({ dpicheckerApi: { getStatus: fixture.getStatus } }));

function wrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
beforeEach(() => {
  fixture.gate = true;
  fixture.getStatus
    .mockReset()
    .mockImplementation(async () => ({ enabled: fixture.enabled, configured: fixture.configured }));
  fixture.enabled = true;
  fixture.configured = true;
  usePermissionStore.setState({ permissions: ['dpichecker:*'], isLoaded: true });
});
afterEach(cleanup);

it('release gate prevents probes and cached status cannot expose links', async () => {
  fixture.gate = false;
  const client = new QueryClient();
  client.setQueryData(DPI_STATUS_KEY, { enabled: true, configured: true });
  const { result } = renderHook(() => useDpiAvailable(), { wrapper: wrapper(client) });
  expect(result.current).toBe(false);
  await Promise.resolve();
  expect(fixture.getStatus).not.toHaveBeenCalled();
});

it('without read permission the shared status hook does not probe the backend', async () => {
  usePermissionStore.setState({ permissions: ['remnawave:read'], isLoaded: true });
  const { result } = renderHook(() => useDpiStatus(), { wrapper: wrapper() });
  expect(result.current.fetchStatus).toBe('idle');
  await Promise.resolve();
  expect(fixture.getStatus).not.toHaveBeenCalled();
});

it('configured runtime status exposes shortcuts to an authorized reader', async () => {
  const { result } = renderHook(() => useDpiAvailable(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current).toBe(true));
  expect(fixture.getStatus).toHaveBeenCalledOnce();
});

it('an unconfigured backend keeps shortcuts hidden after status resolves', async () => {
  fixture.configured = false;
  const { result } = renderHook(() => ({ available: useDpiAvailable(), status: useDpiStatus() }), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.status.isSuccess).toBe(true));
  expect(result.current.available).toBe(false);
});
