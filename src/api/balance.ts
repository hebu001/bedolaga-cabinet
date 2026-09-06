import apiClient from './client';
import i18n from '../i18n';
import {
  matchesCreatedPayment,
  parsePaymentId,
  type CreatedPaymentReference,
} from '../utils/topUpFlow';
import type {
  Balance,
  Transaction,
  PaymentMethod,
  PaginatedResponse,
  PendingPayment,
  ManualCheckResponse,
  SavedCardsResponse,
} from '../types';

export const balanceApi = {
  // Get current balance
  getBalance: async (): Promise<Balance> => {
    const response = await apiClient.get<Balance>('/cabinet/balance');
    return response.data;
  },

  // Get transaction history
  getTransactions: async (params?: {
    page?: number;
    per_page?: number;
    type?: string;
  }): Promise<PaginatedResponse<Transaction>> => {
    const response = await apiClient.get<PaginatedResponse<Transaction>>(
      '/cabinet/balance/transactions',
      {
        params,
      },
    );
    return response.data;
  },

  // Get available payment methods
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const response = await apiClient.get<PaymentMethod[]>('/cabinet/balance/payment-methods');
    return response.data;
  },

  // Create top-up payment
  createTopUp: async (
    amountKopeks: number,
    paymentMethod: string,
    paymentOption?: string,
  ): Promise<{
    payment_id: string;
    local_payment_id?: number;
    payment_url: string;
    amount_kopeks: number;
    amount_rubles: number;
    status: string;
    expires_at: string | null;
  }> => {
    const payload: {
      amount_kopeks: number;
      payment_method: string;
      payment_option?: string;
      language?: string;
    } = {
      amount_kopeks: amountKopeks,
      payment_method: paymentMethod,
    };
    if (paymentOption) {
      payload.payment_option = paymentOption;
    }
    payload.language = i18n.language || 'ru';
    const response = await apiClient.post('/cabinet/balance/topup', payload);
    const data = response.data;
    // Backend payment_id is provider-specific (e.g. CryptoBot invoice_id),
    // while pending-payment details require a local database ID. Resolve before
    // opening the provider, because some paid records leave the pending list.
    let localPaymentId: number | undefined;
    const paymentUrl = data.payment_url || data.invoice_url;
    if (data.payment_id && paymentUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const payment = await balanceApi.resolveCreatedPayment(
          {
            method: paymentMethod,
            reference: String(data.payment_id),
            paymentUrl,
            amountKopeks: data.amount_kopeks,
          },
          controller.signal,
        );
        localPaymentId = payment.id;
      } catch {
        // The invoice remains usable. Return screen may retry exact resolution;
        // failure to resolve must never turn a provider reference into a local ID.
      } finally {
        clearTimeout(timeout);
      }
    }
    return { ...data, payment_id: String(data.payment_id), local_payment_id: localPaymentId };
  },

  // Activate promo code
  activatePromocode: async (
    code: string,
    subscriptionId?: number,
  ): Promise<{
    success: boolean;
    message?: string;
    balance_before?: number;
    balance_after?: number;
    bonus_description?: string | null;
    error?: string;
    eligible_subscriptions?: Array<{ id: number; tariff_name: string; days_left: number }>;
    code?: string;
  }> => {
    const response = await apiClient.post('/cabinet/promocode/activate', {
      code,
      ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
    });
    return response.data;
  },

  // Create Telegram Stars invoice for Mini App balance top-up
  createStarsInvoice: async (
    amountKopeks: number,
  ): Promise<{
    invoice_url: string;
    stars_amount?: number;
    amount_kopeks?: number;
  }> => {
    const response = await apiClient.post('/cabinet/balance/stars-invoice', {
      amount_kopeks: amountKopeks,
    });
    return response.data;
  },

  // Get pending payments for manual verification
  getPendingPayments: async (
    params?: {
      page?: number;
      per_page?: number;
    },
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<PendingPayment>> => {
    const response = await apiClient.get<PaginatedResponse<PendingPayment>>(
      '/cabinet/balance/pending-payments',
      {
        params,
        signal,
      },
    );
    return response.data;
  },

  // Get specific pending payment details
  getPendingPayment: async (
    method: string,
    paymentId: number,
    signal?: AbortSignal,
  ): Promise<PendingPayment> => {
    const response = await apiClient.get<PendingPayment>(
      `/cabinet/balance/pending-payments/${encodeURIComponent(method)}/${encodeURIComponent(paymentId)}`,
      { signal },
    );
    return response.data;
  },

  // Resolve an invoice reference only against the exact returned URL and amount.
  resolveCreatedPayment: async (
    created: CreatedPaymentReference,
    signal?: AbortSignal,
  ): Promise<PendingPayment> => {
    if (signal?.aborted) throw new Error('Payment lookup timed out');
    if (created.method === 'tribute') throw new Error('Exact payment identity unavailable');
    const candidateId = parsePaymentId(created.reference);
    if (candidateId && !['cryptobot', 'platega', 'tribute'].includes(created.method)) {
      try {
        const payment = await balanceApi.getPendingPayment(created.method, candidateId, signal);
        if (matchesCreatedPayment(payment, created)) return payment;
      } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
      }
    }
    // New invoices should be near the front. Bound recovery to 150 records.
    for (let page = 1; page <= 3; page++) {
      if (signal?.aborted) throw new Error('Payment lookup timed out');
      const pending = await balanceApi.getPendingPayments({ page, per_page: 50 }, signal);
      const matches = pending.items.filter((payment) => matchesCreatedPayment(payment, created));
      if (matches.length > 1) throw new Error('Ambiguous payment identity');
      if (matches.length === 1) return matches[0];
      if (page >= pending.pages) break;
    }
    throw new Error('Exact payment identity unavailable');
  },

  // Get latest pending payment by method (fallback when sessionStorage unavailable)
  getLatestPayment: async (method: string): Promise<PendingPayment> => {
    const response = await apiClient.get<PendingPayment>(
      `/cabinet/balance/pending-payments/${encodeURIComponent(method)}/latest`,
    );
    return response.data;
  },

  // Manually check payment status
  checkPaymentStatus: async (method: string, paymentId: number): Promise<ManualCheckResponse> => {
    const response = await apiClient.post<ManualCheckResponse>(
      `/cabinet/balance/pending-payments/${encodeURIComponent(method)}/${encodeURIComponent(paymentId)}/check`,
    );
    return response.data;
  },

  // Get saved payment methods (cards) for recurrent payments
  getSavedCards: async (): Promise<SavedCardsResponse> => {
    const response = await apiClient.get<SavedCardsResponse>('/cabinet/balance/saved-cards');
    return response.data;
  },

  // Unlink (delete) a saved payment method
  deleteSavedCard: async (id: number): Promise<void> => {
    await apiClient.delete(`/cabinet/balance/saved-cards/${id}`);
  },
};
