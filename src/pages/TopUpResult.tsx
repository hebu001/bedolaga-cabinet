import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { balanceApi } from '../api/balance';
import { useAuthStore } from '../store/auth';
import { useCurrency } from '../hooks/useCurrency';
import { useHaptic } from '@/platform';
import { Spinner } from '@/components/ui/Spinner';
import { AnimatedCheckmark } from '@/components/ui/AnimatedCheckmark';
import { AnimatedCrossmark } from '@/components/ui/AnimatedCrossmark';
import { loadTopUpPendingInfo, clearTopUpPendingInfo } from '../utils/topUpStorage';
import { isPaidStatus, isFailedStatus } from '../utils/paymentStatus';
import { getTopUpIdentity, paymentPollInterval, safeTopUpReturnPath } from '../utils/topUpFlow';

// ── Constants ────────────────────────────────────────────────
const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes

// ── Sub-components ───────────────────────────────────────────

function AmountDisplay({ amountKopeks, label }: { amountKopeks: number; label: string }) {
  const { formatAmount, currencySymbol } = useCurrency();
  const amountRubles = amountKopeks / 100;

  return (
    <div className="mt-4 rounded-xl bg-apple-elevated px-6 py-4">
      <p className="text-xs text-apple-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold text-apple-ink">
        {formatAmount(amountRubles)}{' '}
        <span className="text-lg text-apple-mute">{currencySymbol}</span>
      </p>
    </div>
  );
}

function PendingState({ amountKopeks }: { amountKopeks: number | null }) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <Spinner className="h-16 w-16 border-[3px]" />
      <div>
        <h1 className="text-xl font-bold text-apple-ink">
          {t('balance.topUpResult.awaitingPayment')}
        </h1>
        <p className="mt-2 text-sm text-apple-mute">
          {t('balance.topUpResult.awaitingPaymentDesc')}
        </p>
      </div>
      {amountKopeks != null && amountKopeks > 0 && (
        <AmountDisplay amountKopeks={amountKopeks} label={t('balance.topUpResult.topUpAmount')} />
      )}
    </motion.div>
  );
}

function SuccessState({
  amountKopeks,
  returnPath,
}: {
  amountKopeks: number | null;
  returnPath?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoToBalance = useCallback(() => {
    navigate(returnPath || '/balance', { replace: true });
  }, [navigate, returnPath]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <AnimatedCheckmark />

      <div>
        <h1 className="text-xl font-bold text-apple-ink">{t('balance.topUpResult.success')}</h1>
        <p className="mt-2 text-sm text-apple-mute">{t('balance.topUpResult.successDesc')}</p>
      </div>

      {amountKopeks != null && amountKopeks > 0 && (
        <AmountDisplay amountKopeks={amountKopeks} label={t('balance.topUpResult.topUpAmount')} />
      )}

      <button
        type="button"
        onClick={handleGoToBalance}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-apple-blue px-6 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
      >
        {returnPath
          ? t('balance.topUpResult.continuePurchase', 'Продолжить покупку')
          : t('balance.topUpResult.goToBalance')}
      </button>
    </motion.div>
  );
}

function FailedState({ amountKopeks }: { amountKopeks: number | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleTryAgain = useCallback(() => {
    navigate('/balance', { replace: true });
  }, [navigate]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <AnimatedCrossmark />

      <div>
        <h1 className="text-xl font-bold text-apple-ink">{t('balance.topUpResult.failed')}</h1>
        <p className="mt-2 text-sm text-apple-mute">{t('balance.topUpResult.failedDesc')}</p>
      </div>

      {amountKopeks != null && amountKopeks > 0 && (
        <AmountDisplay amountKopeks={amountKopeks} label={t('balance.topUpResult.topUpAmount')} />
      )}

      <button
        type="button"
        onClick={handleTryAgain}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-apple-elevated px-6 py-3 text-sm font-medium text-apple-ink transition-colors hover:bg-apple-elevated"
      >
        {t('balance.topUpResult.goToBalance')}
      </button>
    </motion.div>
  );
}

function TimeoutState({
  onRetry,
  onGoBack,
  unknown = false,
}: {
  onRetry?: () => void;
  onGoBack: () => void;
  unknown?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-apple-elevated">
        <svg
          className="h-10 w-10 text-apple-mute"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-bold text-apple-ink">
          {unknown
            ? t('balance.topUpResult.unverified', 'Не удалось проверить платёж')
            : t('balance.topUpResult.timeout')}
        </h1>
        <p className="mt-2 text-sm text-apple-mute">
          {unknown
            ? t(
                'balance.topUpResult.unverifiedDesc',
                'Статус оплаты пока неизвестен. Проверьте историю операций или повторите проверку позже.',
              )
            : t('balance.topUpResult.timeoutDesc')}
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-xl bg-apple-blue px-6 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            {t('common.retry')}
          </button>
        )}
        <button
          type="button"
          onClick={onGoBack}
          className="w-full rounded-xl bg-apple-elevated px-6 py-3 text-sm font-medium text-apple-ink transition-colors hover:bg-apple-elevated"
        >
          {t('balance.topUpResult.goToBalance')}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function TopUpResult() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const userId = useAuthStore((state) => state.user?.id);
  const haptic = useHaptic();
  const [pollStartedAt, setPollStartedAt] = useState(Date.now);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const hapticFiredRef = useRef(false);
  const cleanedUpRef = useRef(false);
  // Token-only sign-in can mount this route before /auth/me supplies the user.
  // Re-read the user-bound identity when it arrives, while retaining the current
  // payment snapshot after terminal cleanup removes its storage entry.
  const pendingInfo = useMemo(() => loadTopUpPendingInfo(userId), [userId]);
  const identity = useMemo(
    () => getTopUpIdentity(searchParams, pendingInfo),
    [searchParams, pendingInfo],
  );
  const matchingSavedPayment =
    !!identity &&
    pendingInfo?.method_id === identity.method &&
    (identity.reference
      ? pendingInfo.payment_id === identity.reference
      : pendingInfo.local_payment_id === identity.id);
  const returnPath = matchingSavedPayment ? safeTopUpReturnPath(pendingInfo?.return_to) : undefined;

  const resolvedIdRef = useRef<{ reference: string; id: number } | null>(null);

  // Redirect query parameters are hints only. No /latest fallback: an older paid
  // order cannot establish the outcome of the payment the user just attempted.
  const {
    data: effectivePayment,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['topup-status', identity?.method, identity?.id, identity?.reference ?? null],
    queryFn: async ({ signal }) => {
      if (!identity) throw new Error('Missing payment identity');
      const reference = identity.reference ?? '';
      const localId =
        identity.id ??
        (resolvedIdRef.current && resolvedIdRef.current.reference === reference
          ? resolvedIdRef.current.id
          : null);
      const payment = localId
        ? await balanceApi.getPendingPayment(identity.method, localId, signal)
        : await balanceApi.resolveCreatedPayment(
            {
              method: identity.method,
              reference,
              paymentUrl: identity.paymentUrl ?? '',
              amountKopeks: identity.amountKopeks ?? 0,
            },
            signal,
          );
      if (
        (localId && payment.id !== localId) ||
        payment.method !== identity.method ||
        (identity.paymentUrl && payment.payment_url !== identity.paymentUrl)
      ) {
        throw new Error('Payment identity mismatch');
      }
      resolvedIdRef.current = { reference, id: payment.id };
      return payment;
    },
    enabled: !!identity && !pollTimedOut,
    refetchInterval: (query) =>
      paymentPollInterval(
        pollStartedAt,
        Date.now(),
        !!query.state.data &&
          (query.state.data.is_paid ||
            isPaidStatus(query.state.data.status) ||
            isFailedStatus(query.state.data.status)),
      ),
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const resolvedPaid =
    !!effectivePayment && (effectivePayment.is_paid || isPaidStatus(effectivePayment.status));
  const resolvedFailed =
    !resolvedPaid && !!effectivePayment && isFailedStatus(effectivePayment.status);

  // An independent wall-clock deadline also stops polling when every request fails,
  // the browser is offline, or there has never been a successful response.
  useEffect(() => {
    if (!identity || resolvedPaid || resolvedFailed || pollTimedOut) return;
    const timer = window.setTimeout(
      () => setPollTimedOut(true),
      Math.max(0, pollStartedAt + MAX_POLL_MS - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [identity, resolvedPaid, resolvedFailed, pollTimedOut, pollStartedAt]);

  const handleRetryPoll = useCallback(() => {
    setPollStartedAt(Date.now());
    setPollTimedOut(false);
    if (identity) void refetch();
  }, [identity, refetch]);

  const handleGoBack = useCallback(() => {
    // Keep unresolved identity so a later return can check the same payment.
    navigate('/balance', { replace: true });
  }, [navigate]);

  const amountKopeks =
    effectivePayment?.amount_kopeks ??
    (matchingSavedPayment ? (pendingInfo?.amount_kopeks ?? null) : null);

  // Clean up sessionStorage and invalidate queries when payment resolves
  useEffect(() => {
    if (cleanedUpRef.current) return;
    if (resolvedPaid) {
      cleanedUpRef.current = true;
      if (matchingSavedPayment) clearTopUpPendingInfo();
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'subscription',
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      refreshUser();
    } else if (resolvedFailed) {
      cleanedUpRef.current = true;
      if (matchingSavedPayment) clearTopUpPendingInfo();
    }
  }, [resolvedPaid, resolvedFailed, queryClient, refreshUser, matchingSavedPayment]);

  // Haptic feedback on status resolution (fire once)
  useEffect(() => {
    if (hapticFiredRef.current) return;
    if (resolvedPaid) {
      hapticFiredRef.current = true;
      haptic.notification('success');
    } else if (resolvedFailed) {
      hapticFiredRef.current = true;
      haptic.notification('error');
    }
  }, [resolvedPaid, resolvedFailed, haptic]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-apple-bg px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-apple-hairline bg-apple-card p-8"
        aria-live="polite"
        aria-atomic="true"
      >
        {resolvedPaid ? (
          <SuccessState amountKopeks={amountKopeks} returnPath={returnPath} />
        ) : resolvedFailed ? (
          <FailedState amountKopeks={amountKopeks} />
        ) : !identity || isError ? (
          <TimeoutState
            unknown
            onRetry={identity ? handleRetryPoll : undefined}
            onGoBack={handleGoBack}
          />
        ) : pollTimedOut ? (
          <TimeoutState onRetry={handleRetryPoll} onGoBack={handleGoBack} />
        ) : (
          <PendingState amountKopeks={amountKopeks} />
        )}
      </div>
    </div>
  );
}
