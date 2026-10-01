// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  openLink: vi.fn(),
  createTopUp: vi.fn(),
  onSuccess: vi.fn(),
  currentSession: true,
  allowPayment: true,
}));
const { openLink, createTopUp } = state;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => {
      if (key.startsWith('balance.paymentMethods.') && typeof fallback === 'object') return '';
      return typeof fallback === 'string' ? fallback : key;
    },
    i18n: { language: 'ru' },
  }),
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({
    openInvoice: vi.fn(),
    openTelegramLink: vi.fn(),
    openLink,
    platform: 'telegram',
  }),
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn(), selection: vi.fn() }),
}));
vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (v: number) => String(v),
    currencySymbol: '₽',
    convertAmount: (v: number) => v,
    convertToRub: (v: number) => v,
    targetCurrency: 'RUB',
  }),
}));
vi.mock('../api/balance', () => ({
  balanceApi: { createTopUp: (...args: unknown[]) => state.createTopUp(...args) },
}));
vi.mock('../utils/rateLimit', () => ({
  checkRateLimit: () => state.allowPayment,
  getRateLimitResetTime: () => 30,
  RATE_LIMIT_KEYS: { PAYMENT: 'payment' },
}));
vi.mock('../utils/session', () => ({
  getSessionGeneration: () => 1,
  isCurrentSession: () => state.currentSession,
}));
vi.mock('../hooks/useModalFocus', () => ({ useModalFocus: () => {} }));
vi.mock('../store/successNotification', () => ({ useCloseOnSuccessNotification: () => {} }));
vi.mock('../store/auth', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ user: { id: 42 } }),
}));

import TopUpPanel from '../components/balance/TopUpPanel';
import { loadTopUpPendingInfo } from '../utils/topUpStorage';
import type { PaymentMethod } from '../types';

const method: PaymentMethod = {
  id: 'cashera',
  name: 'Cashera',
  description: null,
  min_amount_kopeks: 10000,
  max_amount_kopeks: 10000000,
  is_available: true,
  options: [{ id: 'sbp', name: 'СБП' }],
  quick_amounts: [],
  open_url_direct: true,
};
const qrPayment = {
  payment_id: '5',
  local_payment_id: 71,
  payment_url: 'https://pay.cashera.cash/x',
  amount_kopeks: 50000,
  amount_rubles: 500,
  status: 'pending',
  expires_at: null,
  qr_payload: 'https://qr.nspk.ru/AS1',
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  state.currentSession = true;
  state.allowPayment = true;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(options: {
  methods?: PaymentMethod[];
  onBeforeTopUp?: () => Promise<boolean | void>;
} = {}) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TopUpPanel
        methods={options.methods ?? [method]}
        fixedAmountKopeks={50000}
        returnPath="/subscription/purchase?subscriptionId=7"
        onSuccess={state.onSuccess}
        onBeforeTopUp={options.onBeforeTopUp}
      />
    </QueryClientProvider>,
  );
}

async function submit() {
  const button = await screen.findByRole('button', {
    name: 'balance.topUpPayable',
  });
  fireEvent.click(button);
}

it('shows the QR in the inline panel and preserves owned pending payment before any navigation', async () => {
  createTopUp.mockResolvedValue(qrPayment);
  renderPage();
  await submit();

  expect(await screen.findByTestId('topup-qr')).toBeTruthy();
  expect(createTopUp).toHaveBeenCalledExactlyOnceWith(50000, 'cashera', 'sbp');
  // open_url_direct=true, but a QR stays in the current panel.
  expect(openLink).not.toHaveBeenCalled();
  expect(state.onSuccess).not.toHaveBeenCalled();
  expect(loadTopUpPendingInfo(42)).toMatchObject({
    user_id: 42,
    payment_id: '5',
    local_payment_id: 71,
    amount_kopeks: 50000,
    return_to: '/subscription/purchase?subscriptionId=7',
  });
  expect(loadTopUpPendingInfo(43)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Открыть страницу оплаты' }));
  expect(openLink).toHaveBeenCalledExactlyOnceWith(qrPayment.payment_url);
});

it('without QR the direct provider flow still opens externally in Telegram', async () => {
  createTopUp.mockResolvedValue({ ...qrPayment, qr_payload: null });
  renderPage();
  await submit();

  await waitFor(() => expect(openLink).toHaveBeenCalledExactlyOnceWith(qrPayment.payment_url));
  expect(screen.queryByTestId('topup-qr')).toBeNull();
});

it('does not create a QR invoice when purchase preflight reports completion', async () => {
  renderPage({ onBeforeTopUp: async () => false });
  await submit();
  await waitFor(() => expect(state.onSuccess).toHaveBeenCalledOnce());
  expect(createTopUp).not.toHaveBeenCalled();
  expect(screen.queryByTestId('topup-qr')).toBeNull();
});

it('preflight errors do not create an invoice', async () => {
  renderPage({
    onBeforeTopUp: async () => { throw new Error('quote changed'); },
  });
  await submit();
  await screen.findByRole('alert');
  expect(createTopUp).not.toHaveBeenCalled();
});

it('a delayed QR response from an old session cannot publish payment metadata or change the panel', async () => {
  let finish!: (value: unknown) => void;
  createTopUp.mockImplementation(
    () => new Promise((resolve) => { finish = resolve; }),
  );
  renderPage();
  await submit();
  await waitFor(() => expect(createTopUp).toHaveBeenCalledOnce());
  state.currentSession = false;
  await act(async () => { finish(qrPayment); });
  expect(screen.queryByTestId('topup-qr')).toBeNull();
  expect(loadTopUpPendingInfo(42)).toBeNull();
  expect(openLink).not.toHaveBeenCalled();
});

it('changing the selected method clears the previous QR before a new invoice', async () => {
  createTopUp.mockResolvedValue(qrPayment);
  renderPage({ methods: [method, { ...method, id: 'other', name: 'Other', options: [] }] });
  await submit();
  await screen.findByTestId('topup-qr');
  fireEvent.click(screen.getByRole('button', { name: /СБП Cashera/ }));
  fireEvent.click(screen.getByRole('button', { name: /Other/ }));
  expect(screen.queryByTestId('topup-qr')).toBeNull();
  expect(openLink).not.toHaveBeenCalled();
});

it('rate limiting still blocks a provider invoice', async () => {
  state.allowPayment = false;
  renderPage();
  await submit();
  await screen.findByRole('alert');
  expect(createTopUp).not.toHaveBeenCalled();
});

it('a QR payload without the mandatory provider link cannot publish an unresolvable payment', async () => {
  createTopUp.mockResolvedValue({ ...qrPayment, payment_url: '' });
  renderPage();
  await submit();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByTestId('topup-qr')).toBeNull();
  expect(loadTopUpPendingInfo(42)).toBeNull();
  expect(state.onSuccess).not.toHaveBeenCalled();
});
