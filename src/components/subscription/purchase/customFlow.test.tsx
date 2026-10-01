// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TariffPurchaseForm } from './TariffPurchaseForm';
import { customFlowTariff } from './customFlow.fixtures';

const state = vi.hoisted(() => ({
  purchase: vi.fn(),
  topup: null as null | { fixedAmountKopeks: number; onBeforeTopUp: () => Promise<boolean | void> },
  currentSession: true,
  casheraPurchase: vi.fn(),
  casheraCapability: false,
  openPayment: vi.fn(),
}));
vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    purchaseTariff: state.purchase,
    purchaseWithCasheraRecurring: state.casheraPurchase,
  },
}));
vi.mock('@/config/integrationCapabilities', () => ({
  integrationCapabilities: {
    recurringPayments: false,
    get casheraRecurringPayments() {
      return state.casheraCapability;
    },
  },
}));
vi.mock('@/utils/openPaymentUrl', () => ({ openPaymentUrl: state.openPayment }));
vi.mock('@/api/balance', () => ({ balanceApi: { getPaymentMethods: () => Promise.resolve([]) } }));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatAmount: (value: number) => String(value), currencySymbol: '₽' }),
}));
vi.mock('@/hooks/usePromoDiscount', () => ({
  usePromoDiscount: () => ({
    applyPromoDiscount: (price: number) => ({
      price,
      percent: null,
      original: null,
      isPromoGroup: false,
    }),
  }),
}));
vi.mock('@/hooks/useModalFocus', () => ({ useModalFocus: () => {} }));
vi.mock('@/platform', () => ({ usePlatform: () => ({ platform: 'web', openLink: vi.fn() }) }));
vi.mock('@/utils/session', () => ({
  getSessionGeneration: () => 1,
  isCurrentSession: () => state.currentSession,
}));
vi.mock('@/components/balance/TopUpPanel', () => ({
  default: (props: NonNullable<typeof state.topup>) => {
    state.topup = props;
    return <div data-testid="top-up-amount">{props.fixedAmountKopeks}</div>;
  },
}));
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

beforeEach(() => {
  state.purchase.mockReset();
  state.topup = null;
  state.currentSession = true;
  state.casheraCapability = false;
  state.casheraPurchase.mockReset();
  state.openPayment.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function view(options: { ready?: boolean; balance?: number } = {}) {
  const ready = options.ready ?? true;
  const balance = 'balance' in options ? options.balance : 2000;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TariffPurchaseForm
          tariff={customFlowTariff}
          subscriptionId={42}
          balanceKopeks={balance}
          pricingReady={ready}
          sbpPurchaseEnabled
          lavaPurchaseEnabled
          casheraPurchaseEnabled
          onBack={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...rendered, client };
}

async function openLongPeriod() {
  fireEvent.click(screen.getByRole('button', { name: /90 дней/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Оплатить(?:\s|$)/ }));
  await screen.findByTestId('top-up-amount');
}

describe('custom purchase flow after upstream decomposition', () => {
  it('keeps the chosen period and exact subscription target through top-up preflight', async () => {
    state.purchase.mockRejectedValue(
      new AxiosError('balance', undefined, undefined, undefined, {
        status: 402,
        data: { detail: { missing_amount: 1000 } },
      } as never),
    );
    view();
    await openLongPeriod();
    expect(state.topup?.fixedAmountKopeks).toBe(1000);
    expect(state.purchase).not.toHaveBeenCalled();
    await act(async () => {
      await state.topup?.onBeforeTopUp();
    });
    expect(state.purchase).toHaveBeenCalledExactlyOnceWith(7, 90, undefined, 42);
  });

  it('requires another confirmation after a changed quote without changing the purchase selection', async () => {
    state.purchase.mockRejectedValue(
      new AxiosError('balance', undefined, undefined, undefined, {
        status: 402,
        data: { detail: { missing_amount: 1500 } },
      } as never),
    );
    view();
    await openLongPeriod();
    await act(async () => {
      await expect(state.topup?.onBeforeTopUp()).rejects.toThrow('balance.amountChanged');
    });
    await waitFor(() => expect(state.topup?.fixedAmountKopeks).toBe(1500));
    await act(async () => {
      expect(await state.topup?.onBeforeTopUp()).toBeUndefined();
    });
    expect(state.purchase.mock.calls).toEqual([
      [7, 90, undefined, 42],
      [7, 90, undefined, 42],
    ]);
  });

  it('stale pricing cannot purchase or open a provider invoice', () => {
    view({ ready: false });
    const pay = screen.getByRole('button', { name: /^Оплатить(?:\s|$)/ }) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
    fireEvent.click(pay);
    expect(state.purchase).not.toHaveBeenCalled();
    expect(state.topup).toBeNull();
  });

  it('an unknown balance cannot authorize a purchase', () => {
    view({ balance: undefined });
    expect(
      (screen.getByRole('button', { name: /^Оплатить(?:\s|$)/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(state.purchase).not.toHaveBeenCalled();
  });

  it('a changed session cannot submit the saved selection', async () => {
    view();
    await openLongPeriod();
    state.currentSession = false;
    await expect(state.topup?.onBeforeTopUp()).rejects.toThrow('common.loadError');
    expect(state.purchase).not.toHaveBeenCalled();
  });

  it('a changed session cannot purchase directly from an already mounted form', () => {
    view();
    state.currentSession = false;
    fireEvent.click(screen.getByRole('button', { name: /^Оплатить(?:\s|$)/ }));
    expect(state.purchase).not.toHaveBeenCalled();
    expect(state.topup).toBeNull();
  });

  it('late successful purchase from an old session cannot invalidate the new session cache', async () => {
    let finish!: (value: unknown) => void;
    state.purchase.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { client } = view();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    fireEvent.click(screen.getByRole('button', { name: /^Оплатить(?:\s|$)/ }));
    await waitFor(() => expect(state.purchase).toHaveBeenCalledOnce());
    state.currentSession = false;
    await act(async () => {
      finish({});
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('unverified recurring capability stays hidden even if backend options are true', () => {
    view();
    expect(screen.queryByText('subscription.sbpRecurring.purchaseButton')).toBeNull();
    expect(screen.queryByText('subscription.lavaRecurring.purchaseButton')).toBeNull();
    expect(screen.queryByText('subscription.casheraRecurring.purchaseButton')).toBeNull();
  });
  it('Cashera uses a distinct tariff-only purchase and preserves the selected balance purchase period', async () => {
    state.casheraCapability = true;
    state.casheraPurchase.mockResolvedValue({
      subscription_id: 81,
      redirect_url: 'https://pay.cashera.cash/recurring',
    });
    view();
    fireEvent.click(screen.getByRole('button', { name: /90 дней/ }));
    fireEvent.click(screen.getByRole('button', { name: 'subscription.casheraRecurring.purchaseButton' }));
    await waitFor(() => expect(state.casheraPurchase).toHaveBeenCalledExactlyOnceWith(7));
    expect(state.purchase).not.toHaveBeenCalled();
    expect(state.openPayment).toHaveBeenCalled();
  });

  it('stale pricing cannot start Cashera recurring purchase', () => {
    state.casheraCapability = true;
    view({ ready: false });
    const button = screen.getByRole('button', { name: 'subscription.casheraRecurring.purchaseButton' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(state.casheraPurchase).not.toHaveBeenCalled();
  });

  it('a late Cashera completion cannot redirect or invalidate another session', async () => {
    let finish!: (value: unknown) => void;
    state.casheraCapability = true;
    state.casheraPurchase.mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    const { client } = view();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    fireEvent.click(screen.getByRole('button', { name: 'subscription.casheraRecurring.purchaseButton' }));
    await waitFor(() => expect(state.casheraPurchase).toHaveBeenCalledOnce());
    state.currentSession = false;
    await act(async () => {
      finish({ subscription_id: 81, redirect_url: 'https://pay.cashera.cash/recurring' });
    });
    expect(state.openPayment).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

});
