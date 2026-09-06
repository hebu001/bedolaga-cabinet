import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { UseMutationResult } from '@tanstack/react-query';
import type { TrialInfo } from '../../types';
import { useCurrency } from '../../hooks/useCurrency';
import { useHapticFeedback } from '../../platform/hooks/useHaptic';

interface TrialOfferCardProps {
  trialInfo: TrialInfo;
  balanceKopeks?: number;
  balanceRubles?: number;
  balanceLoading?: boolean;
  balanceError?: boolean;
  onRetryBalance?: () => void;
  activateTrialMutation: UseMutationResult<unknown, unknown, void, unknown>;
  trialError: string | null;
}

export default function TrialOfferCard({
  trialInfo,
  balanceKopeks,
  balanceRubles,
  balanceLoading = false,
  balanceError = false,
  onRetryBalance,
  activateTrialMutation,
  trialError,
}: TrialOfferCardProps) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const haptic = useHapticFeedback();
  const isFree = !trialInfo.requires_payment;
  const balanceKnown =
    typeof balanceKopeks === 'number' &&
    Number.isFinite(balanceKopeks) &&
    typeof balanceRubles === 'number' &&
    Number.isFinite(balanceRubles);
  const balanceReady = balanceKnown && !balanceLoading && !balanceError;
  const canAfford = balanceReady && balanceKopeks >= trialInfo.price_kopeks;

  return (
    <div
      className="relative overflow-hidden rounded-3xl text-center"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '32px 28px 28px',
      }}
    >
      {/* Title */}
      <h2
        className="mb-2 text-2xl font-black uppercase text-white"
        style={{ letterSpacing: '0.08em', fontStretch: 'expanded' }}
      >
        {isFree ? t('dashboard.trialOffer.freeTitle') : t('dashboard.trialOffer.paidTitle')}
      </h2>
      <p className="mb-6 text-sm text-white/40">
        {isFree ? t('dashboard.trialOffer.freeDesc') : t('dashboard.trialOffer.paidDesc')}
      </p>

      {/* Price tag for paid trial */}
      {!isFree && trialInfo.price_kopeks > 0 && (
        <div
          className="mb-6 inline-flex items-baseline gap-1 rounded-full px-6 py-2"
          style={{
            background: 'rgba(249, 115, 22, 0.12)',
            border: '1px solid rgba(249, 115, 22, 0.2)',
          }}
        >
          <span
            className="text-[32px] font-extrabold leading-none tracking-tight"
            style={{ color: 'var(--figma-green)' }}
          >
            {formatAmount(trialInfo.price_kopeks / 100)}
          </span>
          <span
            className="text-base font-semibold opacity-70"
            style={{ color: 'var(--figma-green)' }}
          >
            {currencySymbol}
          </span>
        </div>
      )}

      {/* Trial stats */}
      <div className="mb-7 flex justify-center gap-8">
        {[
          { value: String(trialInfo.duration_days), label: t('subscription.trial.days') },
          {
            value: trialInfo.traffic_limit_gb === 0 ? '∞' : String(trialInfo.traffic_limit_gb),
            label: t('common.units.gb'),
          },
          {
            value: trialInfo.device_limit === 0 ? '∞' : String(trialInfo.device_limit),
            label: t('subscription.trial.devices'),
          },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-4xl font-extrabold leading-none tracking-tight text-white">
              {stat.value}
            </div>
            <div className="mt-1 text-xs font-medium text-white/30">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Balance info for paid trial */}
      {!isFree && trialInfo.price_kopeks > 0 && (
        <div
          className={`trial-balance mb-4 space-y-2 rounded-2xl p-4 text-left ${balanceError && onRetryBalance ? 'trial-balance-retryable' : ''}`}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/40">{t('balance.currentBalance')}</span>
            <span
              className={`font-display text-sm font-semibold ${!balanceReady ? 'text-white/70' : canAfford ? 'text-green-400' : 'text-orange-400'}`}
            >
              {balanceKnown ? `${formatAmount(balanceRubles)} ${currencySymbol}` : '—'}
            </span>
          </div>
          {!balanceReady && (
            <div
              className="trial-balance-status flex items-center justify-between gap-2 text-xs text-white/70"
              role={balanceError ? 'alert' : 'status'}
            >
              <span>
                {balanceError
                  ? t(balanceKnown ? 'common.staleData' : 'common.loadError')
                  : t('common.loading')}
              </span>
              {balanceError && onRetryBalance && (
                <button
                  type="button"
                  onClick={onRetryBalance}
                  disabled={balanceLoading}
                  className="trial-balance-retry shrink-0 rounded underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ color: 'inherit' }}
                >
                  {t('common.retry')}
                </button>
              )}
            </div>
          )}
          {balanceReady && !canAfford && (
            <div className="text-xs text-orange-400">
              {t('subscription.trial.insufficientBalance')}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {trialError && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-400">
          {trialError}
        </div>
      )}

      {/* CTA Button */}
      {!isFree && trialInfo.price_kopeks > 0 ? (
        !balanceReady || canAfford ? (
          <button
            onClick={() => {
              haptic.buttonPressMedium();
              if (balanceReady && !activateTrialMutation.isPending) {
                activateTrialMutation.mutate();
              }
            }}
            disabled={!balanceReady || activateTrialMutation.isPending}
            className="h-14 w-full rounded-full text-base font-medium text-black transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ background: 'var(--figma-green)' }}
          >
            {activateTrialMutation.isPending
              ? t('common.loading')
              : t('subscription.trial.payAndActivate')}
          </button>
        ) : (
          <Link
            to="/balance"
            className="flex h-14 w-full items-center justify-center rounded-full text-base font-medium text-black transition-all active:scale-[0.97]"
            style={{ background: 'var(--figma-green)' }}
          >
            {t('subscription.trial.topUpToActivate')}
          </Link>
        )
      ) : (
        <div className="relative">
          {/* Pulsing glow ring */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              animation: 'trialButtonPulse 2s ease-in-out infinite',
              background: 'var(--figma-green)',
              opacity: 0,
            }}
          />
          <button
            onClick={() => {
              haptic.buttonPressMedium();
              if (!activateTrialMutation.isPending) {
                activateTrialMutation.mutate();
              }
            }}
            disabled={activateTrialMutation.isPending}
            className="relative h-14 w-full rounded-full text-base font-medium text-black transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'var(--figma-green)',
              animation: 'trialButtonPulse 2s ease-in-out infinite',
            }}
          >
            {activateTrialMutation.isPending
              ? t('common.loading')
              : t('subscription.trial.activate')}
          </button>
        </div>
      )}
    </div>
  );
}
