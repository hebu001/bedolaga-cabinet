import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { balanceApi } from '../../api/balance';
import { useCurrency } from '../../hooks/useCurrency';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMIT_KEYS } from '../../utils/rateLimit';
import { useCloseOnSuccessNotification } from '../../store/successNotification';
import { useHaptic, usePlatform } from '@/platform';
import type { PaymentMethod, PaymentMethodOption } from '../../types';
import { saveTopUpPendingInfo } from '../../utils/topUpStorage';

/**
 * Inline top-up panel — folds the former /balance/top-up/:methodId page into
 * the Balance screen. All payment logic (stars invoice, gateway top-up, rate
 * limiting, payment-url display) is preserved; only the container changed from
 * a route to an inline panel. Styled in the Apple-dark token set.
 */

const getPreferredOptionId = (options?: PaymentMethod['options']) => {
  if (!options || options.length === 0) return null;
  const sbpOption = options.find((option) => {
    const id = option.id.toLowerCase();
    const name = option.name.toLowerCase();
    return id.includes('sbp') || name.includes('сбп') || name.includes('sbp');
  });
  return sbpOption?.id ?? options[0].id;
};

const sortOptionsWithSbpFirst = (options?: PaymentMethod['options']) => {
  if (!options || options.length <= 1) return options ?? [];
  const isPreferred = (option: PaymentMethodOption) => {
    const id = option.id.toLowerCase();
    const name = option.name.toLowerCase();
    return id.includes('sbp') || name.includes('сбп') || name.includes('sbp');
  };
  return [...options].sort((l, r) => {
    const lp = isPreferred(l);
    const rp = isPreferred(r);
    if (lp === rp) return 0;
    return lp ? -1 : 1;
  });
};

interface TopUpPanelProps {
  method: PaymentMethod;
  onSuccess: () => void;
}

export default function TopUpPanel({ method, onSuccess }: TopUpPanelProps) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol, convertAmount, convertToRub, targetCurrency } =
    useCurrency();
  const { openInvoice, openTelegramLink, openLink } = usePlatform();
  const haptic = useHaptic();
  const inputRef = useRef<HTMLInputElement>(null);

  useCloseOnSuccessNotification(onSuccess);

  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(
    getPreferredOptionId(method.options),
  );
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!method.options || method.options.length === 0) {
      setSelectedOption(null);
      return;
    }
    const exists = method.options.some((o) => o.id === selectedOption);
    if (!exists) setSelectedOption(getPreferredOptionId(method.options));
  }, [method.id, method.options, selectedOption]);

  const starsPaymentMutation = useMutation({
    mutationFn: (amountKopeks: number) => balanceApi.createStarsInvoice(amountKopeks),
    onSuccess: async (data) => {
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
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError?.response?.data?.detail || t('balance.errors.invoiceFailed'));
    },
  });

  const topUpMutation = useMutation<
    {
      payment_id: string;
      payment_url?: string;
      invoice_url?: string;
      amount_kopeks: number;
      amount_rubles: number;
      status: string;
      expires_at: string | null;
    },
    unknown,
    number
  >({
    mutationFn: (amountKopeks: number) =>
      balanceApi.createTopUp(amountKopeks, method.id, selectedOption || undefined),
    onSuccess: (data) => {
      const redirectUrl = data.payment_url || data.invoice_url;
      if (redirectUrl) {
        setPaymentUrl(redirectUrl);
        if (data.payment_id) {
          const methodKey = method.id.toLowerCase().replace(/-/g, '_');
          const displayName =
            t(`balance.paymentMethods.${methodKey}.name`, { defaultValue: '' }) || method.name;
          saveTopUpPendingInfo({
            amount_kopeks: data.amount_kopeks,
            method_id: method.id,
            method_name: displayName,
            payment_id: data.payment_id,
            created_at: Date.now(),
          });
        }
      }
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '';
      setError(
        detail.includes('not yet implemented') ? t('balance.useBot') : detail || t('common.error'),
      );
    },
  });

  const hasOptions = !!method.options && method.options.length > 0;
  const orderedOptions = sortOptionsWithSbpFirst(method.options);
  const minRubles = method.min_amount_kopeks / 100;
  const maxRubles = method.max_amount_kopeks / 100;
  const methodKey = method.id.toLowerCase().replace(/-/g, '_');
  const isStarsMethod = methodKey.includes('stars');

  const handleSubmit = useCallback(() => {
    setError(null);
    setPaymentUrl(null);
    inputRef.current?.blur();

    if (!checkRateLimit(RATE_LIMIT_KEYS.PAYMENT, 3, 30000)) {
      setError(
        t('balance.errors.rateLimit', { seconds: getRateLimitResetTime(RATE_LIMIT_KEYS.PAYMENT) }),
      );
      return;
    }
    if (hasOptions && !selectedOption) {
      setError(t('balance.errors.selectMethod'));
      return;
    }
    const amountCurrency = parseFloat(amount);
    if (isNaN(amountCurrency) || amountCurrency <= 0) {
      setError(t('balance.errors.enterAmount'));
      return;
    }
    const amountRubles = convertToRub(amountCurrency);
    if (amountRubles < minRubles || amountRubles > maxRubles) {
      setError(t('balance.errors.amountRange', { min: minRubles, max: maxRubles }));
      return;
    }
    const amountKopeks = Math.round(amountRubles * 100);
    if (isStarsMethod) {
      starsPaymentMutation.mutate(amountKopeks);
    } else {
      topUpMutation.mutate(amountKopeks);
    }
  }, [
    amount,
    convertToRub,
    hasOptions,
    isStarsMethod,
    maxRubles,
    minRubles,
    selectedOption,
    starsPaymentMutation,
    t,
    topUpMutation,
  ]);

  const quickAmounts = [100, 300, 500, 1000].filter((a) => a >= minRubles && a <= maxRubles);
  const currencyDecimals = targetCurrency === 'IRR' || targetCurrency === 'RUB' ? 0 : 2;
  const getQuickValue = (rub: number) =>
    targetCurrency === 'IRR'
      ? Math.round(convertAmount(rub)).toString()
      : convertAmount(rub).toFixed(currencyDecimals);
  const isPending = topUpMutation.isPending || starsPaymentMutation.isPending;

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
      /* clipboard write failed silently */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="space-y-4 border-t border-apple-hairline px-4 pb-4 pt-4">
        {/* Range hint */}
        <div className="text-[13px] text-apple-mute">
          {t('balance.enterAmount')} ·{' '}
          <span className="tabular-nums">
            {formatAmount(minRubles, 0)} – {formatAmount(maxRubles, 0)} {currencySymbol}
          </span>
        </div>

        {/* Payment options */}
        {hasOptions && orderedOptions.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {orderedOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedOption(opt.id)}
                className={`rounded-xl px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  selectedOption === opt.id
                    ? 'bg-apple-blue/15 text-apple-blue ring-1 ring-apple-blue/50'
                    : 'bg-apple-elevated text-apple-mute hover:text-apple-ink'
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>
        )}

        {/* Amount input + submit */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="0"
              className="h-12 w-full rounded-xl bg-apple-elevated px-4 pr-10 text-[17px] font-semibold text-apple-ink outline-none transition-shadow placeholder:text-apple-faint focus:ring-2 focus:ring-apple-blue/60"
              autoComplete="off"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-medium text-apple-mute">
              {currencySymbol}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !amount || parseFloat(amount) <= 0}
            className="shrink-0 rounded-full bg-apple-blue px-6 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? '…' : t('balance.topUp')}
          </button>
        </div>

        {/* Quick amounts */}
        {quickAmounts.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((a) => {
              const val = getQuickValue(a);
              const isSelected = amount === val;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAmount(val);
                    inputRef.current?.blur();
                  }}
                  className={`rounded-xl py-2.5 text-[15px] font-medium tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-apple-blue/15 text-apple-blue ring-1 ring-apple-blue/50'
                      : 'bg-apple-elevated text-apple-ink hover:opacity-80'
                  }`}
                >
                  {formatAmount(a, 0)}
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-apple-red/30 bg-apple-red/10 p-3 text-[13px] text-apple-red">
            {error}
          </div>
        )}

        {/* Payment link */}
        {paymentUrl && (
          <div className="space-y-3 rounded-xl border border-apple-green/30 bg-apple-green/10 p-3.5">
            <div className="text-[15px] font-semibold text-apple-green">
              {t('balance.paymentReady')}
            </div>
            <p className="text-[13px] text-apple-mute">{t('balance.clickToOpenPayment')}</p>
            <button
              type="button"
              onClick={handleOpenPayment}
              className="h-11 w-full rounded-full bg-apple-green text-[15px] font-medium text-black transition-opacity hover:opacity-90"
            >
              {t('balance.openPaymentPage')}
            </button>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 rounded-lg bg-apple-elevated px-3 py-2">
                <p className="truncate text-xs text-apple-faint">{paymentUrl}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  copied
                    ? 'bg-apple-green/20 text-apple-green'
                    : 'bg-apple-elevated text-apple-mute hover:text-apple-ink'
                }`}
              >
                {copied ? '✓' : t('common.copy')}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
