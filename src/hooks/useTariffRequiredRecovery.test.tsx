// @vitest-environment jsdom
import type { PropsWithChildren } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { advanceSession } from '../utils/session';
import { useTariffRequiredRecovery } from './useTariffRequiredRecovery';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', () => ({ useNavigate: () => navigate }));
const tariffError = { response: { status: 400, data: { detail: { code: 'tariff_required' } } } };

function view(queryId: number | undefined = 11) {
  let reject!: (error: unknown) => void;
  const request = vi.fn(
    () =>
      new Promise<never>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const close = vi.fn();
  const invoice = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const hook = renderHook(
    ({ id }) => {
      const recovery = useTariffRequiredRecovery(id, queryId, close);
      return useMutation({
        mutationFn: request,
        onMutate: recovery.capture,
        onError: (error: unknown, _variables, target) => {
          if (!recovery.isActive(target) || recovery.recover(error, target)) return;
          if ((error as typeof tariffError).response.status === 402) invoice();
        },
      });
    },
    {
      initialProps: { id: 11 },
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  return {
    ...hook,
    request,
    close,
    invoice,
    invalidate,
    reject: (error: unknown) => reject(error),
  };
}

beforeEach(() => {
  advanceSession();
  navigate.mockReset();
});
afterEach(cleanup);

it('recovers late tariff_required for the exact submitted subscription without creating an invoice', async () => {
  const v = view();
  act(() => v.result.current.mutate());
  await waitFor(() => expect(v.request).toHaveBeenCalledOnce());
  await act(async () => v.reject(tariffError));
  await waitFor(() => expect(v.close).toHaveBeenCalledOnce());
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/subscription/purchase?subscriptionId=11');
  expect(v.invalidate.mock.calls.map(([filter]) => filter)).toEqual([
    { queryKey: ['subscription', 11], exact: true },
    { queryKey: ['purchase-options', 11], exact: true },
    { queryKey: ['renewal-options', 11], exact: true },
    { queryKey: ['subscriptions-list'], exact: true },
  ]);
  expect(v.invoice).not.toHaveBeenCalled();
});

it('refreshes the default query alias and redirects using the concrete subscription ID', async () => {
  // Passing undefined deliberately requires a separate default-route harness value.
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const close = vi.fn();
  const v = renderHook(() => useTariffRequiredRecovery(42, undefined, close), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  act(() => {
    v.result.current.recover(tariffError, v.result.current.capture());
  });
  expect(navigate).toHaveBeenCalledWith('/subscription/purchase?subscriptionId=42');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['subscription', undefined], exact: true });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['subscription', 42], exact: true });
});

it.each(['route', 'session', 'unmount'])(
  'ignores deferred errors after changing %s',
  async (change) => {
    const v = view();
    act(() => v.result.current.mutate());
    await waitFor(() => expect(v.request).toHaveBeenCalledOnce());
    if (change === 'route') v.rerender({ id: 22 });
    if (change === 'session') advanceSession();
    if (change === 'unmount') v.unmount();
    await act(async () => v.reject(tariffError));
    expect(v.close).not.toHaveBeenCalled();
    expect(v.invalidate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(v.invoice).not.toHaveBeenCalled();
  },
);

it.each([402, 500])('does not misclassify HTTP %s as a tariff guard', async (status) => {
  const v = view();
  act(() => v.result.current.mutate());
  await waitFor(() => expect(v.request).toHaveBeenCalledOnce());
  await act(async () => v.reject({ response: { ...tariffError.response, status } }));
  await waitFor(() => expect(v.result.current.isError).toBe(true));
  expect(v.close).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(v.invoice).toHaveBeenCalledTimes(status === 402 ? 1 : 0);
});
