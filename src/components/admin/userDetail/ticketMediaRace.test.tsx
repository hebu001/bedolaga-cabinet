// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { useAdminTicketDetail } from './useAdminTicketDetail';

const getTicket = vi.fn();
vi.mock('@/api/admin', () => ({
  adminApi: { getTicket: (...args: unknown[]) => getTicket(...args) },
}));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const snapshot = (id: number, status = 'open', text = 'before', token = 'signed-old') => ({
  id,
  status,
  messages: [{ id: 1, message_text: text, media_token: token }],
});
let clients: QueryClient[] = [];
function mount(id = 42) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return renderHook(({ id }) => useAdminTicketDetail(id), {
    initialProps: { id },
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
beforeEach(() => getTicket.mockReset());
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients = [];
});

describe('shipped admin ticket query and signed media lifecycle', () => {
  it.each(['reply', 'status'])(
    'fresh %s snapshot survives late pre-mutation media GET',
    async (mutation) => {
      const old = deferred<ReturnType<typeof snapshot>>();
      getTicket
        .mockResolvedValueOnce(snapshot(42))
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(snapshot(42, 'closed', 'new reply', 'signed-new'));
      const { result } = mount();
      await waitFor(() => expect(result.current.data).toBeDefined());
      let renewal!: ReturnType<typeof result.current.refreshMedia>;
      act(() => {
        renewal = result.current.refreshMedia();
        void renewal.catch(() => undefined);
      });
      await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(2));
      const oldSignal = getTicket.mock.calls[1][1] as AbortSignal;
      const post = vi.fn().mockResolvedValue({ success: true, action: mutation });
      await act(async () => {
        await post();
        await result.current.refreshAfterMutation();
      });
      expect(oldSignal.aborted).toBe(true);
      await waitFor(() => expect(result.current.data?.messages[0].media_token).toBe('signed-new'));
      await act(async () => {
        old.resolve(snapshot(42));
        await renewal.catch(() => undefined);
      });
      expect(result.current.data?.messages[0].message_text).toBe('new reply');
      expect(result.current.data?.status).toBe('closed');
    },
  );

  it('shares media refreshes and isolates a different selected ticket', async () => {
    const old = deferred<ReturnType<typeof snapshot>>();
    getTicket
      .mockResolvedValueOnce(snapshot(42))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(snapshot(43, 'answered', 'different ticket', 'signed-next'));
    const { result, rerender } = mount();
    await waitFor(() => expect(result.current.data).toBeDefined());
    let first!: ReturnType<typeof result.current.refreshMedia>;
    let shared!: ReturnType<typeof result.current.refreshMedia>;
    act(() => {
      first = result.current.refreshMedia();
      shared = result.current.refreshMedia();
      void first.catch(() => undefined);
      void shared.catch(() => undefined);
    });
    expect(getTicket).toHaveBeenCalledTimes(2);
    rerender({ id: 43 });
    await waitFor(() => expect(result.current.data?.id).toBe(43));
    await act(async () => {
      old.resolve(snapshot(42));
      await Promise.allSettled([first, shared]);
    });
    expect(result.current.data?.id).toBe(43);
    expect(result.current.data?.messages[0].media_token).toBe('signed-next');
  });
});
