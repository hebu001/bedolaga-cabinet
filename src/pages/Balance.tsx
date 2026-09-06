import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuthStore } from '../store/auth';
import { balanceApi } from '../api/balance';
import { useCurrency } from '../hooks/useCurrency';
import { API } from '../config/constants';
import type { PaginatedResponse, Transaction } from '../types';

import { ChevronDownIcon, ChevronRightIcon } from '@/components/icons';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import { safeTopUpReturnPath } from '../utils/topUpFlow';
import { useModalFocus } from '../hooks/useModalFocus';
import TopUpPanel from '@/components/balance/TopUpPanel';

const WalletIcon = ({ className = 'h-8 w-8' }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
    />
  </svg>
);

// Apple-dark surface helpers
const cardCls = 'apple-card-grad rounded-2xl bg-apple-card';

export default function Balance() {
  const { t, i18n } = useTranslation();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const queryClient = useQueryClient();
  const { formatAmount, currencySymbol } = useCurrency();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentHandledRef = useRef(false);

  // Fetch balance from API
  const {
    data: balanceData,
    refetch: refetchBalance,
    isError: balanceError,
    isPending: balanceLoading,
  } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  // Refresh user data on mount to sync balance in store
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Handle payment return from payment gateway
  useEffect(() => {
    if (paymentHandledRef.current) return;

    if (
      searchParams.has('payment') ||
      searchParams.has('status') ||
      searchParams.has('success') ||
      searchParams.has('payment_id')
    ) {
      paymentHandledRef.current = true;
      navigate(`/balance/top-up/result?${searchParams}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const [promocode, setPromocode] = useState('');
  const [promocodeLoading, setPromocodeLoading] = useState(false);
  const [promocodeError, setPromocodeError] = useState<string | null>(null);
  const [promocodeSuccess, setPromocodeSuccess] = useState<{
    message: string;
    amount: number;
  } | null>(null);
  const [promoSelectSubs, setPromoSelectSubs] = useState<Array<{
    id: number;
    tariff_name: string;
    days_left: number;
  }> | null>(null);
  const [promoSelectCode, setPromoSelectCode] = useState<string | null>(null);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const rawAmountKopeks = searchParams.has('amountKopeks')
    ? Number(searchParams.get('amountKopeks'))
    : Math.round(Number(searchParams.get('amount')) * 100);
  const intendedAmount =
    Number.isSafeInteger(rawAmountKopeks) && rawAmountKopeks > 0 ? rawAmountKopeks : undefined;
  const returnPath = safeTopUpReturnPath(searchParams.get('returnTo'));
  const [showTopUp, setShowTopUp] = useState(
    () => searchParams.get('topup') === '1' || intendedAmount != null,
  );
  const [showPromo, setShowPromo] = useState(false);
  const [topUpPending, setTopUpPending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(showTopUp || showPromo, dialogRef, () => {
    if (topUpPending) return;
    setShowTopUp(false);
    setShowPromo(false);
  });

  const handleTopUpSuccess = async () => {
    setShowTopUp(false);
    await refetchBalance();
    await refreshUser();
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    if (returnPath) navigate(returnPath);
  };

  const {
    data: transactions,
    isLoading,
    isError: transactionsError,
    isFetching: transactionsFetching,
    refetch: refetchTransactions,
  } = useQuery<PaginatedResponse<Transaction>>({
    queryKey: ['transactions', transactionsPage],
    queryFn: () => balanceApi.getTransactions({ per_page: 20, page: transactionsPage }),
    placeholderData: (previousData) => previousData,
  });

  const {
    data: paymentMethods,
    isPending: methodsLoading,
    isError: methodsError,
    refetch: refetchMethods,
  } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
  });

  // Deferred: only fetch saved cards after payment methods loaded to avoid extra request on first render.
  // The recurrent_enabled flag is cached for 5 min to prevent refetching on every Balance visit.
  const { data: savedCardsData } = useQuery({
    queryKey: ['saved-cards'],
    queryFn: balanceApi.getSavedCards,
    enabled: !!paymentMethods,
    staleTime: 5 * 60 * 1000,
  });

  const normalizeType = (type: string) => type?.toUpperCase?.() ?? type;

  // Badge palette per transaction type — { fg: text/dot color, bg: tinted fill }
  const getTypeColor = (type: string): { fg: string; bg: string } => {
    switch (normalizeType(type)) {
      case 'DEPOSIT':
        return { fg: '#30d158', bg: 'rgba(48,209,88,0.15)' };
      case 'SUBSCRIPTION_PAYMENT':
        return { fg: '#FF484D', bg: 'rgba(255,72,77,0.15)' };
      case 'REFERRAL_REWARD':
        return { fg: '#ff9f0a', bg: 'rgba(255,159,10,0.15)' };
      case 'WITHDRAWAL':
        return { fg: '#ff453a', bg: 'rgba(255,69,58,0.15)' };
      default:
        return { fg: '#98989d', bg: 'rgba(255,255,255,0.06)' };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (normalizeType(type)) {
      case 'DEPOSIT':
        return t('balance.deposit');
      case 'SUBSCRIPTION_PAYMENT':
        return t('balance.subscriptionPayment');
      case 'REFERRAL_REWARD':
        return t('balance.referralReward');
      case 'WITHDRAWAL':
        return t('balance.withdrawal');
      default:
        return type;
    }
  };

  const handlePromocodeActivate = async (subscriptionId?: number) => {
    const code = subscriptionId ? promoSelectCode || '' : promocode.trim();
    if (!code) return;

    setPromocodeLoading(true);
    setPromocodeError(null);
    setPromocodeSuccess(null);

    try {
      const result = await balanceApi.activatePromocode(code, subscriptionId);

      if (result.error === 'select_subscription' && result.eligible_subscriptions) {
        setPromoSelectSubs(result.eligible_subscriptions);
        setPromoSelectCode(result.code || code);
        return;
      }

      if (result.success) {
        const bonusAmount = (result.balance_after || 0) - (result.balance_before || 0);
        setPromocodeSuccess({
          message: result.bonus_description || t('balance.promocode.success'),
          amount: bonusAmount,
        });
        setTransactionsPage(1);
        setPromocode('');
        setPromoSelectSubs(null);
        setPromoSelectCode(null);
        setShowPromo(false);
        await refetchBalance();
        await refreshUser();
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
        queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      const errorDetail = axiosError.response?.data?.detail || 'server_error';
      const detail = errorDetail.toLowerCase();
      const errorKey = detail.includes('not found')
        ? 'not_found'
        : detail.includes('deactivated')
          ? 'inactive'
          : detail.includes('not yet active')
            ? 'not_yet_valid'
            : detail.includes('expired')
              ? 'expired'
              : detail.includes('fully used')
                ? 'used'
                : detail.includes('already used')
                  ? 'already_used_by_user'
                  : 'server_error';
      setPromocodeError(t(`balance.promocode.errors.${errorKey}`));
      setPromoSelectSubs(null);
      setPromoSelectCode(null);
    } finally {
      setPromocodeLoading(false);
    }
  };

  return (
    <motion.div
      className="space-y-5 font-sans text-apple-ink"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <h1 className="px-1 text-[28px] font-bold tracking-tight text-apple-ink">
          {t('balance.title')}
        </h1>
      </motion.div>

      {/* Balance Card */}
      <motion.div variants={staggerItem}>
        <div className={`${cardCls} p-6 text-center`}>
          <div className="text-[15px] text-apple-mute">{t('balance.available', 'Доступно')}</div>
          <div
            aria-busy={balanceLoading}
            aria-label={balanceLoading ? t('common.loading') : undefined}
            className="mt-1.5 text-[46px] font-bold leading-none tracking-tight text-apple-ink"
          >
            {balanceData ? `${currencySymbol} ${formatAmount(balanceData.balance_rubles)}` : '—'}
          </div>
          {balanceError && (
            <div role="alert" className="mt-3 text-[13px] text-apple-mute">
              {t(
                'balance.loadError',
                'Не удалось обновить баланс. Показаны последние полученные данные, если они доступны.',
              )}
              <button
                type="button"
                onClick={() => void refetchBalance()}
                className="ml-2 underline"
              >
                {t('common.retry')}
              </button>
            </div>
          )}
          <div className="mt-6 flex gap-2.5">
            <button
              type="button"
              onClick={() => setShowTopUp(true)}
              className="flex-1 rounded-full bg-apple-blue py-3.5 text-[15px] font-semibold text-black transition-opacity hover:opacity-90"
            >
              {t('balance.topUp', 'Пополнить')}
            </button>
            <button
              type="button"
              onClick={() => setShowPromo(true)}
              className="flex-1 rounded-full bg-white py-3.5 text-[15px] font-semibold text-black transition-opacity hover:opacity-90"
            >
              {t('balance.promocode.title', 'Промокод')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Transaction History */}
      <motion.div variants={staggerItem}>
        <div className={`${cardCls} overflow-hidden p-5`}>
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-[17px] font-semibold text-apple-ink">
              {t('balance.transactionHistory')}
            </h2>
            <ChevronDownIcon
              className={`h-5 w-5 text-apple-mute transition-transform duration-200 ${isHistoryOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {isHistoryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4">
                  {transactionsError && (
                    <div role="alert" className="mb-3 text-[13px] text-apple-mute">
                      {t('balance.historyLoadError', 'Не удалось обновить историю операций.')}
                      <button
                        type="button"
                        onClick={() => void refetchTransactions()}
                        className="ml-2 underline"
                      >
                        {t('common.retry')}
                      </button>
                    </div>
                  )}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
                    </div>
                  ) : transactions?.items && transactions.items.length > 0 ? (
                    <motion.div
                      className="space-y-2"
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {transactions.items.map((tx) => {
                        const isZero = tx.amount_rubles === 0;
                        const typeStyle = getTypeColor(tx.type);
                        const isPositive = tx.amount_rubles > 0;
                        const displayAmount = Math.abs(tx.amount_rubles);
                        const sign = isZero ? '' : isPositive ? '+' : '-';
                        const colorClass = isZero
                          ? 'text-apple-mute'
                          : isPositive
                            ? 'text-apple-green'
                            : 'text-[#FF484D]';

                        return (
                          <motion.div
                            key={tx.id}
                            variants={staggerItem}
                            className="flex items-center justify-between rounded-xl bg-apple-elevated p-3.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2.5">
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                                  style={{ color: typeStyle.fg, background: typeStyle.bg }}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full bg-current"
                                    aria-hidden="true"
                                  />
                                  {getTypeLabel(tx.type)}
                                </span>
                                <span className="text-xs font-bold text-apple-ink">
                                  {new Date(tx.created_at).toLocaleString(
                                    i18n.resolvedLanguage ?? i18n.language,
                                    {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hourCycle: 'h23',
                                      timeZone: 'Europe/Moscow',
                                    },
                                  )}
                                </span>
                              </div>
                              {tx.description && (
                                <div className="text-sm text-apple-ink">{tx.description}</div>
                              )}
                            </div>
                            <div className={`text-[17px] font-semibold tabular-nums ${colorClass}`}>
                              {sign}
                              {formatAmount(displayAmount)} {currencySymbol}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ) : transactionsError ? null : (
                    <div className="py-12 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-apple-elevated">
                        <WalletIcon className="h-8 w-8 text-apple-faint" />
                      </div>
                      <div className="text-apple-mute">{t('balance.noTransactions')}</div>
                    </div>
                  )}

                  {transactions && transactions.pages > 1 && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-apple-mute">
                      <button
                        type="button"
                        onClick={() => setTransactionsPage((prev) => Math.max(1, prev - 1))}
                        disabled={transactionsFetching || transactions.page <= 1}
                        className="min-w-[120px] flex-1 rounded-full bg-apple-elevated px-4 py-2.5 text-[15px] font-medium text-apple-ink transition-opacity hover:opacity-80 disabled:opacity-40 sm:flex-none"
                      >
                        {t('common.back')}
                      </button>
                      <div className="flex-1 text-center">
                        {t('balance.page', {
                          current: transactions.page,
                          total: transactions.pages,
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setTransactionsPage((prev) =>
                            transactions.pages ? Math.min(transactions.pages, prev + 1) : prev + 1,
                          )
                        }
                        disabled={transactionsFetching || transactions.page >= transactions.pages}
                        className="min-w-[120px] flex-1 rounded-full bg-apple-elevated px-4 py-2.5 text-[15px] font-medium text-apple-ink transition-opacity hover:opacity-80 disabled:opacity-40 sm:flex-none"
                      >
                        {t('common.next')}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Saved Cards Navigation */}
      {savedCardsData?.recurrent_enabled && (
        <motion.div variants={staggerItem}>
          <button
            type="button"
            onClick={() => navigate('/balance/saved-cards')}
            className={`${cardCls} flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-apple-elevated`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💳</span>
              <span className="font-medium text-apple-ink">{t('balance.savedCards.title')}</span>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-apple-mute" />
          </button>
        </motion.div>
      )}

      {/* Top-up modal */}
      {showTopUp &&
        createPortal(
          <div
            className="apple-sheet-backdrop fixed inset-0 z-[100] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => !topUpPending && setShowTopUp(false)}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={showTopUp ? t('balance.topUpBalance') : t('balance.promocode.title')}
              tabIndex={-1}
              className="apple-card-grad apple-sheet-panel relative m-2.5 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => !topUpPending && setShowTopUp(false)}
                disabled={topUpPending}
                aria-label={t('common.close', 'Закрыть')}
                className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:text-white"
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
                {t('balance.topUpBalance', 'Пополнение баланса')}
              </div>
              <div className="flex-1 overflow-y-auto">
                {methodsLoading ? (
                  <div role="status" className="p-7 text-apple-mute">
                    {t('common.loading')}
                  </div>
                ) : methodsError ? (
                  <div role="alert" className="p-7 text-apple-mute">
                    {t('balance.methodsLoadError', 'Не удалось загрузить способы оплаты.')}
                    <button
                      type="button"
                      onClick={() => void refetchMethods()}
                      className="ml-2 underline"
                    >
                      {t('common.retry')}
                    </button>
                  </div>
                ) : (
                  <TopUpPanel
                    methods={paymentMethods ?? []}
                    onPendingChange={setTopUpPending}
                    onSuccess={handleTopUpSuccess}
                    fixedAmountKopeks={intendedAmount}
                    returnPath={returnPath}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Promocode modal */}
      {showPromo &&
        createPortal(
          <div
            className="apple-sheet-backdrop fixed inset-0 z-[100] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setShowPromo(false)}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={showTopUp ? t('balance.topUpBalance') : t('balance.promocode.title')}
              tabIndex={-1}
              className="apple-card-grad apple-sheet-panel relative m-2.5 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowPromo(false)}
                aria-label={t('common.close', 'Закрыть')}
                className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-apple-mute transition-colors hover:text-white"
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
                {t('balance.promocode.title', 'Промокод')}
              </div>
              <div className="flex flex-col overflow-y-auto px-7 pb-7 pt-1">
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    aria-label={t('balance.promocode.title')}
                    aria-invalid={!!promocodeError}
                    aria-describedby={promocodeError ? 'promocode-error' : undefined}
                    value={promocode}
                    onChange={(e) => setPromocode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePromocodeActivate()}
                    placeholder={t('balance.promocode.placeholder')}
                    className="flex-1 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none transition-shadow placeholder:text-apple-faint focus:ring-2 focus:ring-apple-blue/60 disabled:opacity-50"
                    disabled={promocodeLoading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handlePromocodeActivate()}
                    disabled={!promocode.trim() || promocodeLoading}
                    className="shrink-0 rounded-full bg-apple-blue px-5 py-3 text-[15px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {promocodeLoading ? '…' : t('balance.promocode.activate')}
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {promocodeError && (
                    <motion.div
                      id="promocode-error"
                      role="alert"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-3 rounded-xl border border-apple-red/30 bg-apple-red/10 p-3 text-sm text-apple-red"
                    >
                      {promocodeError}
                    </motion.div>
                  )}
                  {promocodeSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-3 rounded-xl border border-apple-green/30 bg-apple-green/10 p-3 text-sm text-apple-green"
                    >
                      <div className="font-medium">{promocodeSuccess.message}</div>
                      {promocodeSuccess.amount > 0 && (
                        <div className="mt-1">
                          {t('balance.promocode.balanceAdded', {
                            amount: promocodeSuccess.amount.toFixed(2),
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {promoSelectSubs && promoSelectSubs.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 space-y-2 rounded-xl border border-apple-blue/30 bg-apple-blue/10 p-3"
                  >
                    <div className="text-sm font-medium text-apple-ink">
                      {t(
                        'balance.promocode.selectSubscription',
                        'К какой подписке применить промокод?',
                      )}
                    </div>
                    {promoSelectSubs.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handlePromocodeActivate(sub.id)}
                        disabled={promocodeLoading}
                        className="flex w-full items-center justify-between rounded-xl bg-apple-elevated px-3 py-2.5 text-sm text-apple-ink transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        <span>{sub.tariff_name}</span>
                        <span className="text-apple-mute">
                          {t('balance.promocode.daysLeft', '{{count}} дн.', {
                            count: sub.days_left,
                          })}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setPromoSelectSubs(null);
                        setPromoSelectCode(null);
                      }}
                      className="text-xs text-apple-mute transition-colors hover:text-apple-ink"
                    >
                      {t('common.cancel', 'Отмена')}
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </motion.div>
  );
}
