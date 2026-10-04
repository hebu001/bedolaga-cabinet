// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AdminUserGiftItem } from '@/api/adminUsers';
import { GiftsTab } from './GiftsTab';

vi.mock('react-i18next', async () =>
  (await import('@/components/admin/reachability/testUtils')).i18nMock(),
);
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatWithCurrency: (amount: number) => `${amount} ₽` }),
}));

afterEach(cleanup);

function gift(overrides: Partial<AdminUserGiftItem> = {}): AdminUserGiftItem {
  return {
    id: 1,
    token: 'fixture',
    status: 'delivered',
    tariff_name: 'Стандартный',
    period_days: 30,
    device_limit: 1,
    amount_kopeks: 19900,
    payment_method: 'balance',
    gift_recipient_type: 'code',
    gift_recipient_value: null,
    gift_message: null,
    buyer_user_id: 7,
    buyer_username: null,
    buyer_full_name: 'Отправитель',
    receiver_user_id: 42,
    receiver_username: null,
    receiver_full_name: 'Алексей Иванов',
    created_at: '2026-10-03T10:00:00Z',
    paid_at: '2026-10-03T10:00:00Z',
    delivered_at: '2026-10-03T10:05:00Z',
    ...overrides,
  };
}

function show(item: AdminUserGiftItem, direction: 'sent' | 'received' = 'sent') {
  const navigate = vi.fn();
  render(
    <GiftsTab
      giftsLoading={false}
      giftsData={{
        sent: direction === 'sent' ? [item] : [],
        received: direction === 'received' ? [item] : [],
        sent_total: direction === 'sent' ? 1 : 0,
        received_total: direction === 'received' ? 1 : 0,
      }}
      onNavigateToUser={navigate}
    />,
  );
  return navigate;
}

it('shows the activated code-gift recipient without a username and opens that recipient', () => {
  const navigate = show(gift());
  fireEvent.click(screen.getByRole('button', { name: 'Алексей Иванов' }));
  expect(navigate).toHaveBeenCalledWith(42);
  expect(screen.queryByText('Только код')).toBeNull();
});

it('uses the actual recipient username instead of the original delivery contact', () => {
  const navigate = show(
    gift({ receiver_username: 'actual_recipient', gift_recipient_value: '@old' }),
  );
  fireEvent.click(screen.getByRole('button', { name: '@actual_recipient' }));
  expect(navigate).toHaveBeenCalledWith(42);
  expect(screen.queryByText('@old')).toBeNull();
});

it('identifies an activated recipient by ID when both names are absent', () => {
  const navigate = show(gift({ receiver_full_name: null }));
  fireEvent.click(screen.getByRole('button', { name: 'Пользователь #42' }));
  expect(navigate).toHaveBeenCalledWith(42);
});

it.each(['pending', 'paid', 'pending_activation', 'failed', 'expired'])(
  'shows %s gifts as not activated even when a recipient has been assigned',
  (status) => {
    const navigate = show(gift({ status, delivered_at: null, gift_recipient_value: '@intended' }));
    expect(screen.getByText('Ещё не активирован')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('@intended')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  },
);

it('uses the activation timestamp for a historical gift with a stale status', () => {
  show(gift({ status: 'paid' }));
  expect(screen.getByRole('button', { name: 'Алексей Иванов' })).toBeTruthy();
});

it('does not label an activated gift as unactivated when the recipient record is unavailable', () => {
  show(gift({ receiver_user_id: null, receiver_full_name: null }));
  expect(screen.getByText('Неизвестный')).toBeTruthy();
  expect(screen.queryByText('Ещё не активирован')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

it('keeps the sender and sender navigation for received gifts', () => {
  const navigate = show(gift({ status: 'pending_activation', delivered_at: null }), 'received');
  fireEvent.click(screen.getByRole('button', { name: 'Отправитель' }));
  expect(navigate).toHaveBeenCalledWith(7);
});
