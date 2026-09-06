import { useState, useRef, useMemo, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';

import { balanceApi } from '../../api/balance';
import { useAuthStore } from '../../store/auth';
import { useCurrency } from '../../hooks/useCurrency';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMIT_KEYS } from '../../utils/rateLimit';
import { useCloseOnSuccessNotification } from '../../store/successNotification';
import { useHaptic, usePlatform } from '@/platform';
import type { PaymentMethod, PaymentMethodOption } from '../../types';
import { saveTopUpPendingInfo } from '../../utils/topUpStorage';
import { getTopUpQuote, TopUpPreparationError } from '../../utils/topUpFlow';
import { useModalFocus } from '../../hooks/useModalFocus';

/**
 * Top-up modal body — amount input on top, a collapsed payment-method row
 * that opens an "Изменить способ оплаты" picker (id.ultm.in style), and an
 * orange "Пополнить" button below. All payment logic (stars invoice, gateway
 * top-up, rate limiting, payment-url display) is preserved.
 */

const isSbp = (o: PaymentMethodOption) => {
  const id = o.id.toLowerCase();
  const name = o.name.toLowerCase();
  return id.includes('sbp') || name.includes('сбп') || name.includes('sbp');
};

const sortOptionsWithSbpFirst = (options?: PaymentMethod['options']) => {
  if (!options || options.length <= 1) return options ?? [];
  return [...options].sort((l, r) => {
    const lp = isSbp(l);
    const rp = isSbp(r);
    if (lp === rp) return 0;
    return lp ? -1 : 1;
  });
};

interface Selectable {
  key: string;
  method: PaymentMethod;
  option: PaymentMethodOption | null;
}

interface TopUpPanelProps {
  methods: PaymentMethod[];
  onSuccess: () => void;
  onPendingChange?: (pending: boolean) => void;
  /**
   * If provided, hides the amount input and shows the payable amount, including the selected method minimum.
   * Used by SubscriptionPurchase modal where the missing amount is known
   * in advance — the user only needs to pick a payment method.
   */
  fixedAmountKopeks?: number;
  returnPath?: string;
  /**
   * Optional preparation before invoice creation. Return false when the purchase
   * already completed; throw on unexpected errors to avoid an unnecessary invoice.
   */
  onBeforeTopUp?: () => Promise<void | boolean>;
}

export default function TopUpPanel({
  methods,
  onSuccess,
  onPendingChange,
  fixedAmountKopeks,
  returnPath,
  onBeforeTopUp,
}: TopUpPanelProps) {
  const { t } = useTranslation();
  const userId = useAuthStore((state) => state.user?.id);
  const { formatAmount, currencySymbol, convertToRub } = useCurrency();
  const { openInvoice, openTelegramLink, openLink } = usePlatform();
  const haptic = useHaptic();
  const amountId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useCloseOnSuccessNotification(onSuccess);

  const methodLabel = useCallback(
    (m: PaymentMethod) => {
      const key = m.id.toLowerCase().replace(/-/g, '_');
      return t(`balance.paymentMethods.${key}.name`, { defaultValue: '' }) || m.name;
    },
    [t],
  );
  const methodDesc = useCallback(
    (m: PaymentMethod) => {
      const key = m.id.toLowerCase().replace(/-/g, '_');
      return t(`balance.paymentMethods.${key}.description`, { defaultValue: '' }) || m.description;
    },
    [t],
  );

  // Flatten methods + their options into concrete selectable instruments
  const selectables = useMemo<Selectable[]>(() => {
    const list: Selectable[] = [];
    for (const m of methods) {
      if (m.options && m.options.length > 0) {
        for (const opt of sortOptionsWithSbpFirst(m.options)) {
          list.push({ key: `${m.id}:${opt.id}`, method: m, option: opt });
        }
      } else {
        list.push({ key: m.id, method: m, option: null });
      }
    }
    return list;
  }, [methods]);

  const [selectedKey, setSelectedKey] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useModalFocus(showPicker, pickerRef, () => setShowPicker(false));

  // Default to the first available selectable once the list is known
  useEffect(() => {
    if (selectables.some((s) => s.key === selectedKey)) return;
    const first = selectables.find((s) => s.method.is_available) ?? selectables[0];
    setSelectedKey(first?.key ?? '');
  }, [selectables, selectedKey]);

  const current = selectables.find((s) => s.key === selectedKey) ?? selectables[0];
  const method = current?.method;
  const selectedOption = current?.option?.id ?? null;

  const starsPaymentMutation = useMutation({
    mutationFn: async (amountKopeks: number) => {
      if (onBeforeTopUp && (await onBeforeTopUp()) === false) return null;
      return balanceApi.createStarsInvoice(amountKopeks);
    },
    onSuccess: async (data) => {
      if (!data) {
        onSuccess();
        return;
      }
      if (!data.invoice_url) {
        setError(t('balance.errors.noPaymentLink'));
        return;
      }
      try {
        const status = await openInvoice(data.invoice_url);
        if (status === 'paid') {
          haptic.notification('success');
          setError(null);
          onSuccess();
        } else if (status === 'failed') {
          haptic.notification('error');
          setError(t('wheel.starsPaymentFailed'));
        }
      } catch (e) {
        setError(t('balance.errors.generic', { details: String(e) }));
      }
    },
    onError: (err: unknown) => {
      haptic.notification('error');
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      setError(
        err instanceof TopUpPreparationError
          ? err.message
          : typeof detail === 'string'
            ? detail
            : t('balance.errors.invoiceFailed'),
      );
    },
  });

  const topUpMutation = useMutation<
    {
      payment_id: string;
      local_payment_id?: number;
      payment_url?: string;
      invoice_url?: string;
      amount_kopeks: number;
      amount_rubles: number;
      status: string;
      expires_at: string | null;
    } | null,
    unknown,
    number
  >({
    mutationFn: async (amountKopeks: number) => {
      if (onBeforeTopUp && (await onBeforeTopUp()) === false) return null;
      return balanceApi.createTopUp(amountKopeks, method!.id, selectedOption || undefined);
    },
    onSuccess: (data) => {
      if (!data) {
        onSuccess();
        return;
      }
      const redirectUrl = data.payment_url || data.invoice_url;
      if (redirectUrl) {
        // Save pending info BEFORE a possible redirect — code after
        // window.location.href won't run.
        if (data.payment_id && method && userId) {
          saveTopUpPendingInfo({
            user_id: userId,
            amount_kopeks: data.amount_kopeks,
            method_id: method.id,
            method_name: methodLabel(method),
            payment_id: data.payment_id,
            local_payment_id: data.local_payment_id,
            payment_url: redirectUrl,
            created_at: Date.now(),
            return_to: returnPath,
          });
        }

        // open_url_direct: skip the link panel and navigate straight to
        // the provider. Telegram deep links (t.me / tg://) must go through
        // the native handler, so the flag is ignored for them.
        const lowerUrl = redirectUrl.toLowerCase();
        const isTelegramDeepLink =
          lowerUrl.startsWith('https://t.me/') ||
          lowerUrl.startsWith('http://t.me/') ||
          lowerUrl.startsWith('tg://');
        if (method?.open_url_direct && !isTelegramDeepLink) {
          window.location.href = redirectUrl;
          return;
        }

        setPaymentUrl(redirectUrl);
      } else {
        setError(t('balance.errors.noPaymentLink'));
      }
    },
    onError: (err: unknown) => {
      const rawDetail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      const detail = typeof rawDetail === 'string' ? rawDetail : '';
      setError(
        err instanceof TopUpPreparationError
          ? err.message
          : detail.includes('not yet implemented')
            ? t('balance.useBot')
            : detail || t('common.error'),
      );
    },
  });

  const minRubles = (method?.min_amount_kopeks ?? 0) / 100;
  const maxRubles = (method?.max_amount_kopeks ?? 0) / 100;
  const isStarsMethod = (method?.id ?? '').toLowerCase().includes('stars');

  const fixedQuote =
    fixedAmountKopeks != null
      ? getTopUpQuote(fixedAmountKopeks, method?.min_amount_kopeks, method?.max_amount_kopeks)
      : null;

  const handleSubmit = useCallback(() => {
    setError(null);
    setPaymentUrl(null);
    inputRef.current?.blur();

    if (!method?.is_available || topUpMutation.isPending || starsPaymentMutation.isPending) return;
    if (!checkRateLimit(RATE_LIMIT_KEYS.PAYMENT, 3, 30000)) {
      setError(
        t('balance.errors.rateLimit', { seconds: getRateLimitResetTime(RATE_LIMIT_KEYS.PAYMENT) }),
      );
      return;
    }
    let amountKopeks: number;
    if (fixedAmountKopeks != null) {
      if (!fixedQuote?.valid) {
        setError(
          t('balance.errors.methodMaximum', {
            max: formatAmount(maxRubles),
            currency: currencySymbol,
            defaultValue:
              'Максимум этого способа — {{max}} {{currency}}. Выберите другой способ оплаты.',
          }),
        );
        return;
      }
      amountKopeks = fixedQuote.payable;
    } else {
      const amountCurrency = parseFloat(amount);
      if (!Number.isFinite(amountCurrency) || amountCurrency <= 0) {
        setError(t('balance.errors.enterAmount'));
        return;
      }
      const amountRubles = convertToRub(amountCurrency);
      const roundedKopeks = Math.round(amountRubles * 100);
      if (!Number.isSafeInteger(roundedKopeks) || roundedKopeks <= 0) {
        setError(t('balance.errors.enterAmount'));
        return;
      }
      if (
        roundedKopeks < (method.min_amount_kopeks ?? 0) ||
        (maxRubles > 0 && roundedKopeks > method.max_amount_kopeks)
      ) {
        setError(t('balance.errors.amountRange', { min: minRubles, max: maxRubles }));
        return;
      }
      amountKopeks = roundedKopeks;
    }
    if (isStarsMethod) {
      starsPaymentMutation.mutate(amountKopeks);
    } else {
      topUpMutation.mutate(amountKopeks);
    }
  }, [
    amount,
    convertToRub,
    currencySymbol,
    formatAmount,
    fixedAmountKopeks,
    fixedQuote,
    isStarsMethod,
    maxRubles,
    method,
    minRubles,
    starsPaymentMutation,
    t,
    topUpMutation,
  ]);

  const isPending = topUpMutation.isPending || starsPaymentMutation.isPending;
  useEffect(() => {
    onPendingChange?.(isPending);
    return () => onPendingChange?.(false);
  }, [isPending, onPendingChange]);

  const handleOpenPayment = () => {
    if (!paymentUrl) return;
    if (paymentUrl.includes('t.me/')) openTelegramLink(paymentUrl);
    else openLink(paymentUrl);
  };

  const handleCopyUrl = async () => {
    if (!paymentUrl) return;
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        t(
          'balance.errors.copyFailed',
          'Не удалось скопировать ссылку. Откройте страницу оплаты кнопкой ниже.',
        ),
      );
    }
  };

  if (!method || !current) {
    return (
      <div className="py-10 text-center text-sm text-apple-mute">
        {t('balance.noPaymentMethods', 'Способы оплаты сейчас недоступны')}
      </div>
    );
  }

  const currentTitle = current.option ? current.option.name : methodLabel(method);

  return (
    <div className="flex flex-col gap-4 px-7 pb-7 pt-1">
      {/* Amount — input form (free top-up) OR readonly display (fixed amount from caller) */}
      {fixedAmountKopeks != null ? (
        <div>
          <div className="mb-2 text-[13px] text-apple-mute">
            {t('balance.topUpAmount', 'Сумма пополнения')}
          </div>
          <div className="flex h-14 w-full items-center justify-between rounded-2xl bg-apple-elevated px-4">
            <span className="text-[22px] font-semibold tabular-nums text-apple-ink">
              {formatAmount((fixedQuote?.payable ?? fixedAmountKopeks) / 100)}
            </span>
            <span className="text-[17px] font-medium text-apple-mute">{currencySymbol}</span>
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor={amountId} className="mb-2 block text-[13px] text-apple-mute">
            {t('balance.enterAmount')} ·{' '}
            <span className="tabular-nums">
              {formatAmount(minRubles, 0)} – {formatAmount(maxRubles, 0)} {currencySymbol}
            </span>
          </label>
          <div className="relative">
            <input
              id={amountId}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              disabled={isPending}
              ref={inputRef}
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setPaymentUrl(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="0"
              className="h-14 w-full rounded-2xl bg-apple-elevated px-4 pr-11 text-[22px] font-semibold text-apple-ink outline-none transition-shadow placeholder:text-apple-faint focus:ring-2 focus:ring-apple-blue/60"
              autoComplete="off"
              autoFocus
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[17px] font-medium text-apple-mute">
              {currencySymbol}
            </span>
          </div>
        </div>
      )}

      {fixedQuote && fixedQuote.extra > 0 && (
        <p className="text-[13px] text-apple-mute" role="status">
          {t('balance.minimumTopUpNotice', {
            minimum: formatAmount(fixedQuote.payable / 100),
            required: formatAmount((fixedAmountKopeks ?? 0) / 100),
            extra: formatAmount(fixedQuote.extra / 100),
            currency: currencySymbol,
            defaultValue:
              'Минимум этого способа — {{minimum}} {{currency}}. Нужно {{required}} {{currency}}; {{extra}} {{currency}} останется на балансе после покупки.',
          })}
        </p>
      )}
      {fixedQuote?.exceedsMaximum && (
        <p className="text-[13px] text-apple-red" role="alert">
          {t('balance.errors.methodMaximum', {
            max: formatAmount(maxRubles),
            currency: currencySymbol,
            defaultValue:
              'Максимум этого способа — {{max}} {{currency}}. Выберите другой способ оплаты.',
          })}
        </p>
      )}

      {/* Payment method — collapsed row */}
      <button
        type="button"
        onClick={() => selectables.length > 1 && setShowPicker(true)}
        disabled={isPending}
        aria-haspopup="dialog"
        aria-expanded={showPicker}
        className="flex w-full items-center gap-3 rounded-2xl bg-apple-card p-3.5 text-left"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-apple-elevated text-apple-blue">
          ◉
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-apple-ink">{currentTitle}</div>
          <div className="truncate text-[12px] text-apple-mute">{methodLabel(method)}</div>
        </div>
        {selectables.length > 1 && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-apple-elevated text-apple-mute">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </span>
        )}
      </button>

      {/* Payment link — appears after submit, above the button */}
      {paymentUrl && (
        <div
          className="flex items-center gap-2 rounded-2xl bg-apple-card p-2.5"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
        >
          <div className="min-w-0 flex-1 px-2">
            <p className="truncate text-[13px] text-apple-mute">{paymentUrl}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors"
            style={
              copied
                ? { background: 'rgba(48,209,88,0.18)', color: '#30d158' }
                : { background: '#2c2c2e', color: '#98989d' }
            }
          >
            {copied ? '✓' : t('common.copy')}
          </button>
        </div>
      )}

      {/* Pay / open-payment button */}
      <button
        type="button"
        onClick={paymentUrl ? handleOpenPayment : handleSubmit}
        disabled={
          !paymentUrl &&
          (isPending ||
            !method.is_available ||
            (fixedQuote != null && !fixedQuote.valid) ||
            (fixedAmountKopeks == null && (!amount || parseFloat(amount) <= 0)))
        }
        className={`flex h-14 w-full items-center justify-center rounded-full text-[16px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${
          paymentUrl ? 'bg-[#30d158]' : 'bg-[#F97315]'
        }`}
      >
        {isPending ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : paymentUrl ? (
          t('balance.openPaymentPage', 'Открыть страницу оплаты')
        ) : fixedQuote ? (
          t('balance.topUpPayable', {
            amount: formatAmount(fixedQuote.payable / 100),
            currency: currencySymbol,
            defaultValue: 'Пополнить на {{amount}} {{currency}}',
          })
        ) : (
          t('balance.topUp', 'Пополнить')
        )}
      </button>

      {/* Error */}
      {error && (
        <div
          id={errorId}
          role="alert"
          className="rounded-xl border border-apple-red/30 bg-apple-red/10 p-3 text-[13px] text-apple-red"
        >
          {error}
        </div>
      )}

      {/* Method picker modal */}
      {showPicker &&
        createPortal(
          <div
            className="apple-sheet-backdrop fixed inset-0 z-[1100] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowPicker(false)}
          >
            <div
              ref={pickerRef}
              role="dialog"
              aria-modal="true"
              aria-label={t('balance.changePaymentMethod', 'Изменить способ оплаты')}
              tabIndex={-1}
              className="apple-card-grad apple-sheet-panel relative m-2.5 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] bg-black text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                aria-label={t('common.close', 'Закрыть')}
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:text-white"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
              <div className="px-7 pb-3 pr-16 pt-5 text-[22px] font-semibold leading-[26px] text-white">
                {t('balance.changePaymentMethod', 'Изменить способ оплаты')}
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto px-7 pb-7 pt-1">
                {selectables.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    disabled={!s.method.is_available}
                    onClick={() => {
                      setSelectedKey(s.key);
                      setPaymentUrl(null);
                      setCopied(false);
                      setError(null);
                      setShowPicker(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-apple-card p-3.5 text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-apple-elevated text-apple-blue">
                      ◉
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium text-white">
                        {s.option ? s.option.name : methodLabel(s.method)}
                      </div>
                      <div className="truncate text-[12px] text-apple-mute">
                        {s.option ? methodLabel(s.method) : methodDesc(s.method)}
                      </div>
                    </div>
                    {s.key === selectedKey && (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ background: '#F97315' }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
