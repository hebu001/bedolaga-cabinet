// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CasheraRecurringInfo, Subscription } from '@/types';
import { RecurringPanels } from './RecurringPanels';

const state = vi.hoisted(() => ({
  verified: true,
  currentSession: true,
  flag: false as boolean | undefined,
  getStatus: vi.fn(),
  enable: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock('@/config/integrationCapabilities', () => ({
  integrationCapabilities: {
    recurringPayments: false,
    get casheraRecurringPayments() {
      return state.verified;
    },
  },
}));
vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getPurchaseOptions: async () => ({
      sales_mode: 'tariffs',
      ...(state.flag !== undefined ? { cashera_recurrent_enabled: state.flag } : {}),
    }),
    getCasheraRecurring: state.getStatus,
    enableCasheraRecurring: state.enable,
    cancelCasheraRecurring: state.cancel,
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/platform', () => ({ usePlatform: () => ({ openLink: vi.fn(), platform: 'web' }) }));
vi.mock('@/platform/hooks/useNativeDialog', () => ({ useDestructiveConfirm: () => state.confirm }));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/hooks/useCurrency', () => ({ useCurrency: () => ({ formatAmount: String }) }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));
vi.mock('@/utils/session', () => ({
  getSessionGeneration: () => 1,
  isCurrentSession: () => state.currentSession,
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.verified = true;
  state.currentSession = true;
  state.flag = false;
  state.getStatus.mockResolvedValue({
    status: 'ACTIVE',
    amount_kopeks: 10000,
    interval: 'monthly',
  });
  state.cancel.mockResolvedValue({ status: 'cancelled' });
  state.confirm.mockResolvedValue(true);
});
afterEach(cleanup);

function view(binding?: CasheraRecurringInfo) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (binding) client.setQueryData(['cashera-recurring', 42], binding);
  render(
    <QueryClientProvider client={client}>
      <RecurringPanels subscription={{ is_trial: false } as Subscription} subscriptionId={42} />
    </QueryClientProvider>,
  );
  return client;
}

it('an active cached binding remains cancellable after the provider flag changes from true to false', async () => {
  state.flag = true;
  const client = view();
  await screen.findByRole('button', { name: 'subscription.casheraRecurring.cancel' });
  expect(state.getStatus).toHaveBeenCalledExactlyOnceWith(42);

  state.flag = false;
  await act(async () => {
    client.setQueryData(['purchase-options', 42], {
      sales_mode: 'tariffs',
      cashera_recurrent_enabled: false,
    });
  });
  expect(await screen.findByText('subscription.casheraRecurring.disabledCancelHint')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'subscription.casheraRecurring.connect' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'subscription.casheraRecurring.cancel' }));
  await waitFor(() => expect(state.cancel).toHaveBeenCalledExactlyOnceWith(42));
  expect(state.getStatus).toHaveBeenCalledOnce();
  expect(state.enable).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(client.getQueryData(['cashera-recurring', 42])).toEqual({ status: 'none' }),
  );
});

it('a cold disabled provider offers cancellation without status or enable probing', async () => {
  view();
  const cancel = await screen.findByRole('button', {
    name: 'subscription.casheraRecurring.cancel',
  });
  expect(state.getStatus).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'subscription.casheraRecurring.connect' }),
  ).toBeNull();
  fireEvent.click(cancel);
  await waitFor(() => expect(state.cancel).toHaveBeenCalledExactlyOnceWith(42));
  expect(state.enable).not.toHaveBeenCalled();
  expect(state.getStatus).not.toHaveBeenCalled();
});

it.each(['PENDING', 'PAST_DUE'])(
  'disabled provider preserves cancellation of cached %s bindings without confirmation links',
  async (status) => {
    view({ status, redirect_url: 'https://pay.cashera.cash/confirmation' });
    const cancel = await screen.findByRole('button', {
      name: 'subscription.casheraRecurring.cancel',
    });
    expect(
      screen.queryByRole('button', { name: 'subscription.casheraRecurring.confirm' }),
    ).toBeNull();
    fireEvent.click(cancel);
    await waitFor(() => expect(state.cancel).toHaveBeenCalledExactlyOnceWith(42));
    expect(state.getStatus).not.toHaveBeenCalled();
    expect(state.enable).not.toHaveBeenCalled();
  },
);

it('old backends without the flag remain hidden even when a status is cached', async () => {
  state.flag = undefined;
  view({ status: 'ACTIVE' });
  await act(async () => {});
  expect(screen.queryByRole('button', { name: 'subscription.casheraRecurring.cancel' })).toBeNull();
  expect(state.getStatus).not.toHaveBeenCalled();
  expect(state.enable).not.toHaveBeenCalled();
  expect(state.cancel).not.toHaveBeenCalled();
});

it('unverified contract and changed sessions cannot cancel a binding', async () => {
  state.verified = false;
  view({ status: 'ACTIVE' });
  await act(async () => {});
  expect(screen.queryByRole('button', { name: 'subscription.casheraRecurring.cancel' })).toBeNull();
  expect(state.getStatus).not.toHaveBeenCalled();
  cleanup();

  state.verified = true;
  view();
  const cancel = await screen.findByRole('button', {
    name: 'subscription.casheraRecurring.cancel',
  });
  state.currentSession = false;
  fireEvent.click(cancel);
  await waitFor(() => expect(state.confirm).toHaveBeenCalledOnce());
  await act(async () => {});
  expect(state.cancel).not.toHaveBeenCalled();
});
