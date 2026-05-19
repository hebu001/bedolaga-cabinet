import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { campaignsApi, CampaignBonusType } from '../api/campaigns';
import type { AdminCampaignChartData } from '../api/campaigns';
import { AdminBackButton } from '../components/admin';
import { DailyChart, PeriodComparison, StatCard } from '../components/stats';
import { PARTNER_STATS } from '../constants/partner';
import { useCurrency } from '../hooks/useCurrency';
import { copyToClipboard } from '../utils/clipboard';
import { useHaptic } from '../platform';

// Icons
const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
    />
  </svg>
);

const LinkIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
    />
  </svg>
);

const UsersIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
    />
  </svg>
);

const ChartIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
    />
  </svg>
);

// Bonus type config
const bonusTypeConfig: Record<
  CampaignBonusType,
  { labelKey: string; color: string; bgColor: string }
> = {
  balance: {
    labelKey: 'admin.campaigns.bonusType.balance',
    color: 'text-apple-green',
    bgColor: 'bg-apple-green/15',
  },
  subscription: {
    labelKey: 'admin.campaigns.bonusType.subscription',
    color: 'text-[#F97315]',
    bgColor: 'bg-[#F97315]/15',
  },
  tariff: {
    labelKey: 'admin.campaigns.bonusType.tariff',
    color: 'text-apple-blue',
    bgColor: 'bg-apple-blue/15',
  },
  none: {
    labelKey: 'admin.campaigns.bonusType.none',
    color: 'text-apple-mute',
    bgColor: 'bg-apple-elevated',
  },
};

export default function AdminCampaignStats() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : null;
  const isValidId = numericId !== null && !isNaN(numericId);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { formatWithCurrency } = useCurrency();
  const [copiedBot, setCopiedBot] = useState(false);
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const copyBotTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copyWebTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(copyBotTimer.current);
      clearTimeout(copyWebTimer.current);
    };
  }, []);

  // Fetch stats
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => campaignsApi.getCampaignStats(numericId!),
    enabled: isValidId,
    staleTime: PARTNER_STATS.STATS_STALE_TIME,
  });

  // Fetch registrations when users section is open
  const { data: registrationsData, isLoading: usersLoading } = useQuery({
    queryKey: ['campaign-registrations', id],
    queryFn: () => campaignsApi.getCampaignRegistrations(numericId!, 1, 50),
    enabled: isValidId && showUsers,
  });

  // Fetch chart data
  const { data: chartData, isLoading: chartLoading } = useQuery<AdminCampaignChartData>({
    queryKey: ['campaign-chart-data', id],
    queryFn: () => campaignsApi.getChartData(numericId!),
    enabled: isValidId,
    staleTime: PARTNER_STATS.STATS_STALE_TIME,
  });

  const handleCopy = useCallback(
    async (url: string, type: 'bot' | 'web') => {
      try {
        await copyToClipboard(url);
        haptic.notification('success');
        if (type === 'bot') {
          setCopiedBot(true);
          clearTimeout(copyBotTimer.current);
          copyBotTimer.current = setTimeout(
            () => setCopiedBot(false),
            PARTNER_STATS.COPY_FEEDBACK_MS,
          );
        } else {
          setCopiedWeb(true);
          clearTimeout(copyWebTimer.current);
          copyWebTimer.current = setTimeout(
            () => setCopiedWeb(false),
            PARTNER_STATS.COPY_FEEDBACK_MS,
          );
        }
      } catch {
        haptic.notification('error');
      }
    },
    [haptic],
  );

  const formatDate = useCallback(
    (date: string | null): string => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString(i18n.language, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [i18n.language],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <AdminBackButton to="/admin/campaigns" />
          <h1 className="text-xl font-semibold text-apple-ink">
            {t('admin.campaigns.stats.title')}
          </h1>
        </div>
        <div className="rounded-2xl bg-apple-red/10 p-6 text-center">
          <p className="text-apple-red">{t('admin.campaigns.stats.loadError')}</p>
          <button
            onClick={() => navigate('/admin/campaigns')}
            className="mt-4 text-sm text-apple-mute hover:text-apple-ink"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AdminBackButton to="/admin/campaigns" />
          <div className="rounded-lg bg-[#F97315]/15 p-2 text-[#F97315]">
            <ChartIcon />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-apple-ink">{stats.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bonusTypeConfig[stats.bonus_type].bgColor} ${bonusTypeConfig[stats.bonus_type].color}`}
              >
                {t(bonusTypeConfig[stats.bonus_type].labelKey)}
              </span>
              {stats.is_active ? (
                <span className="rounded-full bg-apple-green/15 px-2.5 py-1 text-[11px] font-semibold text-apple-green">
                  {t('admin.campaigns.stats.active')}
                </span>
              ) : (
                <span className="rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                  {t('admin.campaigns.stats.inactive')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Links */}
        {(stats.deep_link || stats.web_link) && (
          <div className="space-y-3">
            {stats.deep_link && (
              <div className="rounded-2xl bg-apple-card p-4">
                <div className="mb-1 text-xs font-medium text-apple-faint">
                  {t('admin.campaigns.stats.botLink')}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <LinkIcon />
                    <span className="truncate text-sm text-apple-mute">{stats.deep_link}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(stats.deep_link!, 'bot')}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-apple-elevated px-3 py-2 text-apple-mute transition-colors hover:opacity-90"
                  >
                    <CopyIcon />
                    <span className="text-sm">
                      {copiedBot
                        ? t('admin.campaigns.stats.copied')
                        : t('admin.campaigns.stats.copy')}
                    </span>
                  </button>
                </div>
              </div>
            )}
            {stats.web_link && (
              <div className="rounded-2xl bg-apple-card p-4">
                <div className="mb-1 text-xs font-medium text-apple-faint">
                  {t('admin.campaigns.stats.webLink')}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <LinkIcon />
                    <span className="truncate text-sm text-apple-mute">{stats.web_link}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(stats.web_link!, 'web')}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-apple-elevated px-3 py-2 text-apple-mute transition-colors hover:opacity-90"
                  >
                    <CopyIcon />
                    <span className="text-sm">
                      {copiedWeb
                        ? t('admin.campaigns.stats.copied')
                        : t('admin.campaigns.stats.copy')}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-apple-card p-4 text-center">
            <div className="text-xl font-bold text-apple-ink sm:text-2xl">
              {stats.registrations}
            </div>
            <div className="text-xs text-apple-faint">
              {t('admin.campaigns.stats.registrations')}
            </div>
          </div>
          <div className="rounded-2xl bg-apple-card p-4 text-center">
            <div className="truncate text-xl font-bold text-apple-green sm:text-2xl">
              {formatWithCurrency(stats.total_revenue_kopeks / PARTNER_STATS.KOPEKS_DIVISOR)}
            </div>
            <div className="text-xs text-apple-faint">{t('admin.campaigns.stats.revenue')}</div>
          </div>
          <div className="rounded-2xl bg-apple-card p-4 text-center">
            <div className="text-xl font-bold text-[#F97315] sm:text-2xl">
              {stats.paid_users_count}
            </div>
            <div className="text-xs text-apple-faint">{t('admin.campaigns.stats.paidUsers')}</div>
          </div>
          <div className="rounded-2xl bg-apple-card p-4 text-center">
            <div className="text-xl font-bold text-[#F97315] sm:text-2xl">
              {stats.conversion_rate}%
            </div>
            <div className="text-xs text-apple-faint">{t('admin.campaigns.stats.conversion')}</div>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
          <h3 className="mb-4 font-medium text-apple-ink">
            {t('admin.campaigns.stats.detailedStats')}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-apple-elevated p-3">
              <div className="mb-1 text-sm text-apple-mute">
                {t('admin.campaigns.stats.bonusesIssued')}
              </div>
              {stats.bonus_type === 'balance' && (
                <div className="text-lg font-medium text-apple-green">
                  {formatWithCurrency(stats.balance_issued_kopeks / PARTNER_STATS.KOPEKS_DIVISOR)}
                </div>
              )}
              {stats.bonus_type === 'subscription' && (
                <div className="text-lg font-medium text-[#F97315]">
                  {t('admin.campaigns.stats.subscriptionsIssued', {
                    count: stats.subscription_issued,
                  })}
                </div>
              )}
              {stats.bonus_type === 'tariff' && (
                <div className="text-lg font-medium text-[#F97315]">
                  {t('admin.campaigns.stats.tariffsIssued', { count: stats.subscription_issued })}
                </div>
              )}
              {stats.bonus_type === 'none' && (
                <div className="text-lg font-medium text-apple-mute">-</div>
              )}
            </div>
            <div className="rounded-lg bg-apple-elevated p-3">
              <div className="mb-1 text-sm text-apple-mute">
                {t('admin.campaigns.stats.avgRevenuePerUser')}
              </div>
              <div className="text-lg font-medium text-apple-ink">
                {formatWithCurrency(
                  stats.avg_revenue_per_user_kopeks / PARTNER_STATS.KOPEKS_DIVISOR,
                )}
              </div>
            </div>
            <div className="rounded-lg bg-apple-elevated p-3">
              <div className="mb-1 text-sm text-apple-mute">
                {t('admin.campaigns.stats.avgFirstPayment')}
              </div>
              <div className="text-lg font-medium text-apple-ink">
                {formatWithCurrency(stats.avg_first_payment_kopeks / PARTNER_STATS.KOPEKS_DIVISOR)}
              </div>
            </div>
            <div className="rounded-lg bg-apple-elevated p-3">
              <div className="mb-1 text-sm text-apple-mute">
                {t('admin.campaigns.stats.trialSubscriptions')}
              </div>
              <div className="text-lg font-medium text-apple-ink">
                {t('admin.campaigns.stats.trialCount', {
                  total: stats.trial_users_count,
                  active: stats.active_trials_count,
                })}
              </div>
            </div>
            <div className="rounded-lg bg-apple-elevated p-3">
              <div className="mb-1 text-sm text-apple-mute">
                {t('admin.campaigns.stats.trialConversion')}
              </div>
              <div className="text-lg font-medium text-apple-ink">
                {stats.trial_conversion_rate}%
              </div>
            </div>
            <div className="rounded-lg bg-apple-elevated p-3">
              <div className="mb-1 text-sm text-apple-mute">
                {t('admin.campaigns.stats.lastRegistration')}
              </div>
              <div className="text-sm font-medium text-apple-ink">
                {formatDate(stats.last_registration)}
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Charts */}
        <div className="space-y-4">
          {chartLoading ? (
            <div className="space-y-3">
              <div className="h-52 animate-pulse rounded-2xl bg-apple-card" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 animate-pulse rounded-2xl bg-apple-card" />
                <div className="h-24 animate-pulse rounded-2xl bg-apple-card" />
              </div>
            </div>
          ) : chartData ? (
            <>
              {/* Deposits vs Spending */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label={t('admin.campaigns.stats.totalDeposits')}
                  value={formatWithCurrency(
                    chartData.total_deposits_kopeks / PARTNER_STATS.KOPEKS_DIVISOR,
                  )}
                  valueClassName="text-apple-green"
                />
                <StatCard
                  label={t('admin.campaigns.stats.totalSpending')}
                  value={formatWithCurrency(
                    chartData.total_spending_kopeks / PARTNER_STATS.KOPEKS_DIVISOR,
                  )}
                  valueClassName="text-[#F97315]"
                />
              </div>
              <DailyChart
                data={chartData.daily_stats}
                chartId={`admin-${id}`}
                title={t('admin.campaigns.stats.dailyChart')}
                earningsLabel={t('admin.campaigns.stats.chartRevenue')}
                countLabel={t('admin.campaigns.stats.chartRegistrations')}
              />
              <PeriodComparison
                data={chartData.period_comparison}
                title={t('admin.campaigns.stats.periodComparison')}
                countLabel={t('admin.campaigns.stats.chartRegistrations')}
                earningsLabel={t('admin.campaigns.stats.chartRevenue')}
                comparisonLabel={t('admin.campaigns.stats.vsLastWeek')}
              />
              {/* Top Registrations */}
              {chartData.top_registrations.length > 0 && (
                <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
                  <h4 className="mb-3 text-sm font-semibold text-apple-ink">
                    {t('admin.campaigns.stats.topRegistrations')}
                  </h4>
                  <div className="space-y-2">
                    {chartData.top_registrations.map((reg) => (
                      <Link
                        key={reg.id}
                        to={`/admin/users/${reg.id}`}
                        className="flex items-center justify-between rounded-xl bg-apple-elevated p-3 transition-colors hover:opacity-90"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 truncate text-sm font-medium text-apple-ink">
                              {reg.full_name}
                            </span>
                            {reg.is_active && (
                              <span className="rounded-full bg-apple-green/15 px-2.5 py-1 text-[11px] font-semibold text-apple-green">
                                {t('admin.campaigns.stats.active')}
                              </span>
                            )}
                            {reg.has_paid && !reg.is_active && (
                              <span className="rounded-full bg-apple-blue/15 px-2.5 py-1 text-[11px] font-semibold text-apple-blue">
                                {t('admin.campaigns.stats.paid')}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-apple-faint">
                            {new Date(reg.created_at).toLocaleDateString(i18n.language)}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-apple-green">
                          {formatWithCurrency(
                            reg.total_earnings_kopeks / PARTNER_STATS.KOPEKS_DIVISOR,
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Users Section */}
        <div className="rounded-2xl bg-apple-card">
          <button
            onClick={() => setShowUsers(!showUsers)}
            className="flex w-full items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <UsersIcon />
              <span className="font-medium text-apple-ink">
                {t('admin.campaigns.stats.users')} ({stats.registrations})
              </span>
            </div>
            <svg
              className={`h-5 w-5 text-apple-mute transition-transform ${showUsers ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUsers && (
            <div className="border-t border-apple-hairline p-4">
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
                </div>
              ) : registrationsData?.registrations.length === 0 ? (
                <div className="py-8 text-center text-apple-faint">
                  {t('admin.campaigns.stats.noUsers')}
                </div>
              ) : (
                <div className="space-y-2">
                  {registrationsData?.registrations.map((reg) => (
                    <Link
                      key={reg.id}
                      to={`/admin/users/${reg.user_id}`}
                      className="flex items-center justify-between rounded-lg bg-apple-elevated p-3 transition-colors hover:opacity-90"
                    >
                      <div>
                        <div className="font-medium text-apple-ink">
                          {reg.first_name ||
                            reg.username ||
                            `${t('admin.campaigns.stats.users')} #${reg.user_id}`}
                        </div>
                        <div className="text-xs text-apple-faint">{reg.telegram_id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {reg.has_paid && (
                          <span className="rounded-full bg-apple-green/15 px-2.5 py-1 text-[11px] font-semibold text-apple-green">
                            {t('admin.campaigns.stats.paid')}
                          </span>
                        )}
                        {reg.has_subscription && (
                          <span className="rounded-full bg-[#F97315]/15 px-2.5 py-1 text-[11px] font-semibold text-[#F97315]">
                            {t('admin.campaigns.stats.hasSub')}
                          </span>
                        )}
                        <span className="text-xs text-apple-faint">
                          {formatDate(reg.created_at)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
