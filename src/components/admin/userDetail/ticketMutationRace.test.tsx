// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminTicketDetail, AdminTicketMessage } from '@/api/admin';
import { TicketsTab } from './TicketsTab';
import AdminTickets from '@/pages/AdminTickets';

const getTicket = vi.fn();
const replyToTicket = vi.fn();
const updateTicketStatus = vi.fn();
vi.mock('@/api/admin', () => ({
  adminApi: {
    getTicket: (...args: unknown[]) => getTicket(...args),
    replyToTicket: (...args: unknown[]) => replyToTicket(...args),
    updateTicketStatus: (...args: unknown[]) => updateTicketStatus(...args),
    getTickets: async () => ({
      items: [
        {
          id: 42,
          title: 'Selected ticket',
          status: 'open',
          updated_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          messages_count: 1,
          user: null,
          last_message: null,
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      pages: 1,
    }),
    getTicketStats: async () => ({ total: 1, open: 1, pending: 0, answered: 0, closed: 0 }),
  },
}));
vi.mock('@/api/tickets', () => ({ ticketsApi: { uploadMedia: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/platform/hooks/usePlatform', () => ({
  usePlatform: () => ({ capabilities: { hasBackButton: false } }),
}));
vi.mock('@/platform/hooks/useNotify', () => ({
  useNotify: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatWithCurrency: (value: number) => String(value) }),
}));

// The image decoding/expiry boundary is substituted with its public renewal
// callback. The shipped consumers, handlers, useAdminAction, query hook and
// QueryClient are real: the test never calls refreshAfterMutation itself.
vi.mock('@/components/tickets/MessageMediaGrid', () => ({
  MessageMediaGrid: ({
    message,
    onRefreshMedia,
  }: {
    message: AdminTicketMessage;
    onRefreshMedia?: () => Promise<unknown>;
  }) => (
    <button
      type="button"
      aria-label="Renew signed attachment"
      data-token={message.media_token}
      onClick={() => {
        void onRefreshMedia?.().catch(() => undefined);
      }}
    >
      Attachment
    </button>
  ),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const snapshot = (
  status = 'open',
  message = 'before mutation',
  token = 'signed-old',
): AdminTicketDetail => ({
  id: 42,
  title: 'Selected ticket',
  status,
  priority: 'normal',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  closed_at: null,
  is_reply_blocked: false,
  user: null,
  messages: [
    {
      id: 7,
      message_text: message,
      media_token: token,
      has_media: true,
      media_type: 'photo',
      media_file_id: 'synthetic-file',
      media_caption: null,
      is_from_admin: false,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
});
let clients: QueryClient[] = [];
beforeEach(() => {
  getTicket.mockReset();
  replyToTicket.mockReset();
  updateTicketStatus.mockReset();
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => {
    client.clear();
  });
  clients = [];
});

async function mount(screenName: 'user-detail' | 'standalone') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/tickets/42']}>
        <Routes>
          <Route
            path="/admin/tickets/:ticketId"
            element={screenName === 'standalone' ? <AdminTickets /> : <TicketsTab userId={5} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  if (screenName === 'user-detail')
    fireEvent.click(await screen.findByRole('button', { name: /Selected ticket/ }));
  await screen.findByText('before mutation');
}

describe.each(['user-detail', 'standalone'] as const)('%s ticket consumer', (screenName) => {
  it.each(['reply', 'status'] as const)(
    'real %s handler refreshes after POST and survives a late media snapshot',
    async (mutation) => {
      const stale = deferred<AdminTicketDetail>();
      const fresh = deferred<AdminTicketDetail>();
      const post = deferred<{ success: boolean }>();
      getTicket
        .mockResolvedValueOnce(snapshot())
        .mockReturnValueOnce(stale.promise)
        .mockReturnValueOnce(fresh.promise);
      replyToTicket.mockReturnValue(post.promise);
      updateTicketStatus.mockReturnValue(post.promise);
      await mount(screenName);
      fireEvent.click(screen.getByRole('button', { name: 'Renew signed attachment' }));
      await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(2));
      const oldSignal = getTicket.mock.calls[1][1] as AbortSignal;

      if (mutation === 'reply') {
        fireEvent.change(screen.getByPlaceholderText('admin.tickets.replyPlaceholder'), {
          target: { value: 'Typed reply' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'admin.tickets.sendReply' }));
        await waitFor(() => expect(replyToTicket).toHaveBeenCalled());
        expect(replyToTicket.mock.calls[0].slice(0, 2)).toEqual([42, 'Typed reply']);
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'admin.tickets.statusClosed' }));
        await waitFor(() => expect(updateTicketStatus).toHaveBeenCalledWith(42, 'closed'));
      }
      expect(getTicket).toHaveBeenCalledTimes(2);
      expect(oldSignal.aborted).toBe(false);
      await act(async () => post.resolve({ success: true }));
      await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(3));
      expect(oldSignal.aborted).toBe(true);
      await act(async () =>
        fresh.resolve(
          snapshot(mutation === 'reply' ? 'answered' : 'closed', 'after mutation', 'signed-new'),
        ),
      );
      await screen.findByText('after mutation');
      expect(
        screen.getByRole('button', { name: 'Renew signed attachment' }).getAttribute('data-token'),
      ).toBe('signed-new');

      await act(async () => stale.resolve(snapshot()));
      expect(screen.queryByText('before mutation')).toBeNull();
      expect(screen.getByText('after mutation')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Renew signed attachment' }).getAttribute('data-token'),
      ).toBe('signed-new');
      if (mutation === 'status')
        expect(screen.queryByPlaceholderText('admin.tickets.replyPlaceholder')).toBeNull();
      else
        expect(
          (screen.getByPlaceholderText('admin.tickets.replyPlaceholder') as HTMLTextAreaElement)
            .value,
        ).toBe('');
    },
  );
});
