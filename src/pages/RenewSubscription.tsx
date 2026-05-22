import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { useCurrency } from '../hooks/useCurrency';
import { useHaptic } from '../platform';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import { WebBackButton } from '../components/WebBackButton';

export default function RenewSubscription() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const subId = subscriptionId ? Number(subscriptionId) : undefined;

  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatAmount, currencySymbol } = useCurrency();
  const { impact } = useHaptic();

  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load subscription detail for tariff name
  const { data: subscriptionResponse } = useQuery({
    queryKey: ['subscription', subId],
    queryFn: () => subscriptionApi.getSubscription(subId),
    enabled: !!subId,
    staleTime: 30_000,
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // Load renewal options
  const { data: options, isLoading } = useQuery({
    queryKey: ['renewal-options', subId],
    queryFn: () => subscriptionApi.getRenewalOptions(subId),
    enabled: !!subId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Load balance
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options', subId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subId),
    staleTime: 0,
  });
  const balanceKopeks = purchaseOptions?.balance_kopeks ?? 0;

  // Pre-select the first period once options arrive.
  useEffect(() => {
    if (selectedPeriod === null && options && options.length > 0) {
      setSelectedPeriod(options[0].period_days);
    }
  }, [options, selectedPeriod]);

  const renewMutation = useMutation({
    mutationFn: (periodDays: number) => subscriptionApi.renewSubscription(periodDays, subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-options', subId] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      navigate(`/subscriptions/${subId}`, { replace: true });
    },
    onError: (err: unknown) => {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ?? null)
          : null;

      if (detail && typeof detail === 'object' && 'code' in (detail as Record<string, unknown>)) {
        const typed = detail as { code: string; missing_amount?: number };
        if (typed.code === 'insufficient_funds' && typed.missing_amount) {
          setError(`insufficient:${typed.missing_amount}`);
          return;
        }
      }
      setError(typeof detail === 'string' ? detail : t('common.error'));
    },
  });

  const handleRenew = (periodDays: number) => {
    impact('medium');
    setError(null);
    renewMutation.mutate(periodDays);
  };

  if (!subId) {
    return <Navigate to="/subscriptions" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
      </div>
    );
  }

  const insufficientMatch = error?.match(/^insufficient:(\d+)$/);
  const missingAmount = insufficientMatch ? Number(insufficientMatch[1]) : null;
  const selectedOption = options?.find((o) => o.period_days === selectedPeriod) ?? null;
  const cantAfford = selectedOption ? balanceKopeks < selectedOption.price_kopeks : false;

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <WebBackButton to={`/subscriptions/${subId}`} />
        <div>
          <h1 className="text-2xl font-bold text-apple-ink">
            {t('subscription.extend', 'Продлить подписку')}
          </h1>
          {subscription?.tariff_name && (
            <p className="mt-0.5 text-[13px] text-apple-mute">{subscription.tariff_name}</p>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between rounded-2xl bg-apple-card px-4 py-3.5">
        <span className="text-[13px] text-apple-mute">{t('common.balance', 'Баланс')}</span>
        <span className="text-[15px] font-semibold text-apple-ink">
          {formatAmount(balanceKopeks / 100)} {currencySymbol}
        </span>
      </div>

      {/* Period options */}
      {!options || options.length === 0 ? (
        <div className="rounded-2xl bg-apple-card p-6 text-center text-[13px] text-apple-mute">
          {t('subscription.noRenewalOptions', 'Нет доступных вариантов продления')}
        </div>
      ) : (
        <div>
          <div className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-apple-mute">
            {t('subscription.selectPeriod', 'Выберите период')}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {options.map((option) => {
              const isSelected = selectedPeriod === option.period_days;
              const months = Math.max(1, Math.round(option.period_days / 30));
              const perMonth = option.price_kopeks / months;
              const isFree = option.price_kopeks === 0;

              return (
                <button
                  key={option.period_days}
                  onClick={() => {
                    impact('light');
                    setSelectedPeriod(option.period_days);
                    setError(null);
                  }}
                  className="relative overflow-hidden rounded-2xl bg-apple-elevated py-3.5 pl-[18px] pr-4 text-left transition-transform active:scale-[0.97]"
                  style={isSelected ? { boxShadow: 'inset 0 0 0 1.5px #F97315' } : undefined}
                >
                  {option.discount_percent > 0 && (
                    <div className="absolute -right-2 -top-2 rounded-full bg-[#F97315] px-2 py-0.5 text-xs font-medium text-white">
                      -{option.discount_percent}%
                    </div>
                  )}
                  <div className="text-[15px] text-apple-ink">
                    {option.period_days} {t('common.units.days', 'дней')}
                  </div>
                  <div className="mt-4 flex flex-col leading-6">
                    <span className="text-2xl font-semibold tracking-tight text-white">
                      {isFree
                        ? t('subscription.free', 'Бесплатно')
                        : `${formatAmount(option.price_kopeks / 100)} ${currencySymbol}`}
                    </span>
                    {option.original_price_kopeks &&
                      option.original_price_kopeks > option.price_kopeks && (
                        <span className="text-sm text-apple-faint line-through">
                          {formatAmount(option.original_price_kopeks / 100)} {currencySymbol}
                        </span>
                      )}
                  </div>
                  <small className="mt-0.5 block text-xs text-apple-faint">
                    {isFree
                      ? ' '
                      : `${formatAmount(perMonth / 100)} ${currencySymbol}/${t('subscription.month', 'мес')}`}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Insufficient balance prompt */}
      {missingAmount && <InsufficientBalancePrompt missingAmountKopeks={missingAmount} compact />}

      {/* Error */}
      {error && !missingAmount && (
        <div className="rounded-2xl bg-apple-red/10 p-3 text-center text-[13px] text-apple-red">
          {error}
        </div>
      )}

      {/* Renew button */}
      {options && options.length > 0 && (
        <button
          onClick={() => selectedPeriod && handleRenew(selectedPeriod)}
          disabled={!selectedPeriod || renewMutation.isPending}
          className="w-full rounded-full bg-[#F97315] py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {renewMutation.isPending
            ? t('common.processing', 'Обработка...')
            : cantAfford
              ? t('subscription.insufficientBalance', 'Недостаточно средств')
              : t('subscription.extend', 'Продлить подписку')}
        </button>
      )}
    </div>
  );
}
