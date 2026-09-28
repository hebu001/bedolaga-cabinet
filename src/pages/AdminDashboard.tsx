import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { backTo } from '@/components/admin';
import { useTranslation } from 'react-i18next';
import { METHOD_LABELS } from '../constants/paymentMethods';
import { useQuery } from '@tanstack/react-query';
import { statsApi, type NodeStatus } from '../api/admin';
import { formatUptime, parseCalendarDate } from '../utils/format';

const CABINET_VERSION = __APP_VERSION__;
import { useCurrency } from '../hooks/useCurrency';
import { usePlatform } from '../platform/hooks/usePlatform';

import { StatCard } from '@/components/stats';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import {
  BackIcon,
  BanknotesIcon,
  CalendarBlankIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  ExclamationIcon,
  MegaphoneIcon,
  PowerIcon,
  RefreshIcon,
  RestartIcon,
  ServerIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
  UsersOnlineIcon,
  WalletIcon,
  XCircleIcon,
} from '@/components/icons';

interface NodeCardProps {
  node: NodeStatus;
  onRestart: (uuid: string) => void;
  onToggle: (uuid: string) => void;
  isLoading: boolean;
}

function NodeCard({ node, onRestart, onToggle, isLoading }: NodeCardProps) {
  const { t } = useTranslation();

  const getStatusColor = () => {
    if (node.is_disabled) return 'bg-apple-elevated text-apple-mute';
    if (node.is_connected) return 'bg-apple-green/15 text-apple-green';
    return 'bg-apple-red/15 text-apple-red';
  };

  const getStatusText = () => {
    if (node.is_disabled) return t('adminDashboard.nodes.disabled');
    if (node.is_connected) return t('adminDashboard.nodes.online');
    return t('adminDashboard.nodes.offline');
  };

  const formatTraffic = (bytes?: number) => {
    if (!bytes) return '-';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
  };

  const hasError = node.last_status_message && !node.is_connected;

  return (
    <div
      className={`rounded-xl border bg-apple-card/50 ${node.is_disabled ? 'border-apple-hairline' : node.is_connected ? 'border-success-500/30' : 'border-error-500/30'} p-4 transition-colors hover:border-apple-hairline`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`h-3 w-3 shrink-0 rounded-full ${node.is_disabled ? 'bg-dark-500' : node.is_connected ? 'animate-pulse bg-success-500' : 'bg-error-500'}`}
          />
          <div className="min-w-0">
            <div className="font-medium text-apple-ink [overflow-wrap:anywhere]">{node.name}</div>
            <div className="text-xs text-apple-faint break-all">{node.address}</div>
          </div>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs ${getStatusColor()}`}
        >
          {getStatusText()}
        </span>
      </div>

      {/* Xray Version & Uptime */}
      {(node.versions?.xray || node.xray_uptime > 0) && (
        <div className="mb-3 flex items-center gap-3 text-xs">
          {node.versions?.xray && (
            <span className="rounded bg-apple-elevated px-2 py-1 text-apple-mute">
              Xray {node.versions.xray}
            </span>
          )}
          {node.xray_uptime > 0 && (
            <span className="text-apple-faint">Uptime: {formatUptime(node.xray_uptime)}</span>
          )}
        </div>
      )}

      {/* Error Message */}
      {hasError && (
        <div className="mb-3 rounded-lg bg-apple-red/10 p-2">
          <div className="flex items-start gap-2">
            <ExclamationIcon className="h-4 w-4" />
            <span className="break-all text-xs text-apple-red">{node.last_status_message}</span>
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-apple-elevated p-2.5">
          <div className="mb-0.5 text-xs text-apple-faint">
            {t('adminDashboard.nodes.usersOnline')}
          </div>
          <div className="text-lg font-semibold text-apple-ink">{node.users_online}</div>
        </div>
        <div className="rounded-lg bg-apple-elevated p-2.5">
          <div className="mb-0.5 text-xs text-apple-faint">{t('adminDashboard.nodes.traffic')}</div>
          <div className="text-lg font-semibold text-apple-ink">
            {formatTraffic(node.traffic_used_bytes)}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onToggle(node.uuid)}
          disabled={isLoading}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            node.is_disabled
              ? 'bg-apple-green/15 text-apple-green hover:bg-apple-green/25'
              : 'bg-apple-amber/15 text-apple-amber hover:bg-apple-amber/25'
          } disabled:opacity-50`}
        >
          <PowerIcon className="h-4 w-4" />
          {node.is_disabled ? t('adminDashboard.nodes.enable') : t('adminDashboard.nodes.disable')}
        </button>
        <button
          onClick={() => onRestart(node.uuid)}
          disabled={isLoading || node.is_disabled}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#F97315]/15 px-3 py-2 text-sm font-medium text-[#F97315] transition-colors hover:bg-[#F97315]/25 disabled:opacity-50"
        >
          <RestartIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: { date: string; amount_rubles: number }[] }) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-apple-faint">
        {t('common.noData')}
      </div>
    );
  }

  const last7Days = data.slice(-7);
  const maxValue = Math.max(...last7Days.map((d) => d.amount_rubles), 1);

  return (
    <div className="space-y-3">
      {last7Days.map((item) => {
        const percentage = (item.amount_rubles / maxValue) * 100;
        const date = parseCalendarDate(item.date);
        const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short' });
        const dayNum = date.getDate();

        return (
          <div key={item.date} className="group">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium capitalize text-apple-mute">
                {dayName}, {dayNum}
              </span>
              <span className="text-sm font-semibold text-apple-ink">
                {formatAmount(item.amount_rubles)}
                {'\u00A0'}
                {currencySymbol}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-apple-elevated">
              <div
                className="h-full rounded-full bg-[#F97315] transition-all duration-500 ease-out"
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatAmount, currencySymbol } = useCurrency();
  const { capabilities } = usePlatform();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [referrersTab, setReferrersTab] = useState<'earnings' | 'invited'>('earnings');

  // Data fetching via React Query: caching, dedupe, and auto-refetch every 30s
  // (replaces the manual setInterval + useState + console.error pattern).
  const statsQuery = useQuery({
    queryKey: ['admin-dashboard-stats'] as const,
    queryFn: () => statsApi.getDashboardStats(),
    refetchInterval: 30_000,
  });
  const stats = statsQuery.data ?? null;
  const loading = statsQuery.isLoading;
  const error = statsQuery.isError ? t('adminDashboard.loadError') : null;

  const extendedQuery = useQuery({
    queryKey: ['admin-dashboard-extended'] as const,
    queryFn: async () => {
      const [topReferrers, topCampaigns, recentPayments, sysInfo] = await Promise.all([
        statsApi.getTopReferrers(10),
        statsApi.getTopCampaigns(10),
        statsApi.getRecentPayments(20),
        statsApi.getSystemInfo(),
      ]);
      return { topReferrers, topCampaigns, recentPayments, sysInfo };
    },
    refetchInterval: 30_000,
  });
  const referrers = extendedQuery.data?.topReferrers ?? null;
  const campaigns = extendedQuery.data?.topCampaigns ?? null;
  const payments = extendedQuery.data?.recentPayments ?? null;
  const systemInfo = extendedQuery.data?.sysInfo ?? null;

  const handleRestartNode = async (uuid: string) => {
    try {
      setActionLoading(uuid);
      await statsApi.restartNode(uuid);
      // Refresh stats after action
      setTimeout(() => statsQuery.refetch(), 2000);
    } catch (err) {
      console.error('Failed to restart node:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleNode = async (uuid: string) => {
    try {
      setActionLoading(uuid);
      await statsApi.toggleNode(uuid);
      await statsQuery.refetch();
    } catch (err) {
      console.error('Failed to toggle node:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !stats) {
    return (
      <PageSkeleton variant="admin" leading={1} titleWidth="w-56" className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard loading />
          <StatCard loading />
          <StatCard loading />
          <StatCard loading />
        </div>
        <Skeleton variant="card" count={2} className="h-40" />
      </PageSkeleton>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="text-apple-red">{error}</div>
        <button
          onClick={() => statsQuery.refetch()}
          className="rounded-full bg-[#F97315] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('common.loading')}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-card transition-colors hover:bg-apple-elevated"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-apple-ink">{t('adminDashboard.title')}</h1>
            <p className="text-apple-mute">{t('adminDashboard.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => statsQuery.refetch()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-apple-card px-4 py-2 text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink disabled:opacity-50"
        >
          <RefreshIcon className="h-5 w-5" />
          {t('adminDashboard.refresh')}
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label={t('adminDashboard.stats.usersOnline')}
          value={stats?.nodes.total_users_online || 0}
          icon={<UsersOnlineIcon className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label={t('adminDashboard.stats.activeSubscriptions')}
          value={stats?.subscriptions.active || 0}
          subValue={`${t('adminDashboard.stats.total')}: ${stats?.subscriptions.total || 0}`}
          icon={<SparklesIcon className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label={t('adminDashboard.stats.incomeToday')}
          value={`${formatAmount(stats?.financial.income_today_rubles || 0)}\u00A0${currencySymbol}`}
          icon={<WalletIcon className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label={t('adminDashboard.stats.incomeMonth')}
          value={`${formatAmount(stats?.financial.income_month_rubles || 0)}\u00A0${currencySymbol}`}
          icon={<ChartBarIcon className="h-5 w-5" />}
          tone="accent"
        />
      </div>

      {/* Nodes Section */}
      <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#F97315]/15 p-2.5 text-[#F97315]">
              <ServerIcon />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-apple-ink">
                {t('adminDashboard.nodes.title')}
              </h2>
              <p className="text-sm text-apple-mute">
                {stats?.nodes.online || 0} {t('adminDashboard.nodes.online').toLowerCase()} /{' '}
                {stats?.nodes.total || 0} {t('adminDashboard.stats.total').toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-apple-mute">
              <span className="h-2 w-2 rounded-full bg-apple-green"></span>
              {stats?.nodes.online || 0}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-apple-mute">
              <span className="h-2 w-2 rounded-full bg-apple-red"></span>
              {stats?.nodes.offline || 0}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-apple-mute">
              <span className="h-2 w-2 rounded-full bg-apple-faint"></span>
              {stats?.nodes.disabled || 0}
            </span>
          </div>
        </div>

        {stats?.nodes.nodes && stats.nodes.nodes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(showAllNodes ? stats.nodes.nodes : stats.nodes.nodes.slice(0, 3)).map((node) => (
                <NodeCard
                  key={node.uuid}
                  node={node}
                  onRestart={handleRestartNode}
                  onToggle={handleToggleNode}
                  isLoading={actionLoading === node.uuid}
                />
              ))}
            </div>
            {stats.nodes.nodes.length > 3 && (
              <button
                onClick={() => setShowAllNodes(!showAllNodes)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-apple-elevated px-4 py-3 text-apple-mute transition-colors hover:text-apple-ink"
              >
                <span
                  className={`transform transition-transform ${showAllNodes ? 'rotate-180' : ''}`}
                >
                  <ChevronDownIcon />
                </span>
                {showAllNodes
                  ? t('adminDashboard.nodes.hide', { count: stats.nodes.nodes.length - 3 })
                  : t('adminDashboard.nodes.showMore', { count: stats.nodes.nodes.length - 3 })}
              </button>
            )}
          </>
        ) : (
          <div className="py-8 text-center text-apple-faint">
            {t('adminDashboard.nodes.noNodes')}
          </div>
        )}
      </div>

      {/* Revenue and Subscriptions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-apple-amber/15 p-2.5 text-apple-amber">
              <ChartBarIcon />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-apple-ink">
                {t('adminDashboard.revenue.title')}
              </h2>
              <p className="text-sm text-apple-mute">{t('adminDashboard.revenue.last7Days')}</p>
            </div>
          </div>
          <RevenueChart data={stats?.revenue_chart || []} />
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-apple-hairline pt-4">
            <StatCard
              label={t('adminDashboard.stats.incomeTotal')}
              value={`${formatAmount(stats?.financial.income_total_rubles || 0)}\u00A0${currencySymbol}`}
              icon={<BanknotesIcon className="h-5 w-5" />}
              tone="neutral"
            />
            <StatCard
              label={t('adminDashboard.stats.subscriptionIncome')}
              value={`${formatAmount(stats?.financial.subscription_income_rubles || 0)}\u00A0${currencySymbol}`}
              icon={<SparklesIcon className="h-5 w-5" />}
              tone="accent"
            />
          </div>
        </div>

        {/* Subscription Stats */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-[#F97315]/15 p-2.5 text-[#F97315]">
              <SparklesIcon />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-apple-ink">
                {t('adminDashboard.subscriptions.title')}
              </h2>
              <p className="text-sm text-apple-mute">
                {t('adminDashboard.subscriptions.subtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label={t('adminDashboard.subscriptions.active')}
                value={stats?.subscriptions.active || 0}
                icon={<CheckCircleIcon className="h-5 w-5" />}
                tone="success"
              />
              <StatCard
                label={t('adminDashboard.subscriptions.trial')}
                value={stats?.subscriptions.trial || 0}
                icon={<StarIcon className="h-5 w-5" />}
                tone="warning"
              />
              <StatCard
                label={t('adminDashboard.subscriptions.paid')}
                value={stats?.subscriptions.paid || 0}
                icon={<CreditCardIcon className="h-5 w-5" />}
                tone="accent"
              />
              <StatCard
                label={t('adminDashboard.subscriptions.expired')}
                value={stats?.subscriptions.expired || 0}
                icon={<XCircleIcon className="h-5 w-5" />}
                tone="error"
              />
            </div>

            <div className="border-t border-apple-hairline pt-4">
              <div className="mb-3 text-sm font-medium text-apple-mute">
                {t('adminDashboard.subscriptions.newSubscriptions')}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
                <StatCard
                  label={t('adminDashboard.subscriptions.today')}
                  value={stats?.subscriptions.purchased_today || 0}
                  icon={<ClockIcon className="h-5 w-5" />}
                  tone="neutral"
                />
                <StatCard
                  label={t('adminDashboard.subscriptions.week')}
                  value={stats?.subscriptions.purchased_week || 0}
                  icon={<CalendarBlankIcon className="h-5 w-5" />}
                  tone="neutral"
                />
                <StatCard
                  label={t('adminDashboard.subscriptions.month')}
                  value={stats?.subscriptions.purchased_month || 0}
                  icon={<CalendarIcon className="h-5 w-5" />}
                  tone="neutral"
                />
              </div>
            </div>

            {stats?.subscriptions.trial_to_paid_conversion !== undefined && (
              <div className="rounded-lg bg-[#F97315]/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-apple-mute">
                    {t('adminDashboard.subscriptions.conversion')}
                  </span>
                  <span className="text-lg font-bold" style={{ color: '#F97315' }}>
                    {stats.subscriptions.trial_to_paid_conversion.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tariff Stats */}
      {stats?.tariff_stats && stats.tariff_stats.tariffs.length > 0 && (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-apple-green/15 p-2.5 text-apple-green">
              <TagIcon />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-apple-ink">
                {t('adminDashboard.tariffs.title')}
              </h2>
              <p className="text-sm text-apple-mute">{t('adminDashboard.tariffs.subtitle')}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-apple-hairline">
                  <th className="px-2 py-3 text-left text-xs font-medium text-apple-faint">
                    {t('adminDashboard.tariffs.tariffName')}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-apple-faint">
                    {t('adminDashboard.tariffs.activeSubscriptions')}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-apple-faint">
                    {t('adminDashboard.tariffs.trialSubscriptions')}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-apple-faint">
                    {t('adminDashboard.tariffs.purchasedToday')}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-apple-faint">
                    {t('adminDashboard.tariffs.purchasedWeek')}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-apple-faint">
                    {t('adminDashboard.tariffs.purchasedMonth')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.tariff_stats.tariffs.map((tariff) => (
                  <tr
                    key={tariff.tariff_id}
                    className="border-b border-apple-hairline transition-colors hover:bg-apple-elevated"
                  >
                    <td className="px-2 py-3">
                      <span className="font-medium text-apple-ink">{tariff.tariff_name}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="font-semibold text-apple-green">
                        {tariff.active_subscriptions}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="font-semibold text-apple-amber">
                        {tariff.trial_subscriptions}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-apple-ink">{tariff.purchased_today}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-apple-ink">{tariff.purchased_week}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-apple-ink">{tariff.purchased_month}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Extended Stats Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Referrers */}
        {referrers && (referrers.by_earnings.length > 0 || referrers.by_invited.length > 0) && (
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-[#F97315]/15 p-2 text-[#F97315] sm:p-2.5">
                  <UsersIcon />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-apple-ink sm:text-lg">
                    {t('adminDashboard.topReferrers.title')}
                  </h2>
                  <p className="text-xs text-apple-mute sm:text-sm">
                    {referrers.total_referrers}{' '}
                    {t('adminDashboard.topReferrers.stats', { count: referrers.total_referrals })}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setReferrersTab('earnings')}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  referrersTab === 'earnings'
                    ? 'bg-[#F97315]/15 text-[#F97315]'
                    : 'bg-apple-elevated text-apple-mute hover:text-apple-ink'
                }`}
              >
                {t('adminDashboard.topReferrers.byEarnings')}
              </button>
              <button
                onClick={() => setReferrersTab('invited')}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  referrersTab === 'invited'
                    ? 'bg-[#F97315]/15 text-[#F97315]'
                    : 'bg-apple-elevated text-apple-mute hover:text-apple-ink'
                }`}
              >
                {t('adminDashboard.topReferrers.byInvited')}
              </button>
            </div>

            <div className="space-y-2">
              {(referrersTab === 'earnings' ? referrers.by_earnings : referrers.by_invited)
                .slice(0, 5)
                .map((ref, idx) => (
                  <div
                    key={ref.user_id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-apple-elevated p-2 transition-colors sm:p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-apple-card text-[10px] font-bold text-apple-mute sm:h-6 sm:w-6 sm:text-xs">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-apple-ink sm:text-sm">
                          {ref.display_name}
                        </div>
                        {ref.username && (
                          <div className="truncate text-[10px] text-apple-faint sm:text-xs">
                            @{ref.username}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {referrersTab === 'earnings' ? (
                        <>
                          <div className="text-xs font-semibold text-apple-green sm:text-sm">
                            {formatAmount(ref.earnings_total_kopeks / 100)}
                            {'\u00A0'}
                            {currencySymbol}
                          </div>
                          <div className="text-[10px] text-apple-faint sm:text-xs">
                            {ref.invited_count} {t('adminDashboard.topReferrers.invites')}
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className="text-xs font-semibold sm:text-sm"
                            style={{ color: '#F97315' }}
                          >
                            {ref.invited_count} {t('adminDashboard.topReferrers.people')}
                          </div>
                          <div className="text-[10px] text-apple-faint sm:text-xs">
                            {formatAmount(ref.earnings_total_kopeks / 100)}
                            {'\u00A0'}
                            {currencySymbol}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Period Stats */}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-apple-hairline pt-4 sm:grid-cols-3 sm:gap-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
              <StatCard
                label={t('adminDashboard.period.today')}
                value={`${formatAmount(
                  (referrersTab === 'earnings'
                    ? referrers.by_earnings
                    : referrers.by_invited
                  ).reduce((sum, r) => sum + r.earnings_today_kopeks, 0) / 100,
                )}\u00A0${currencySymbol}`}
                icon={<ClockIcon className="h-5 w-5" />}
                tone="neutral"
              />
              <StatCard
                label={t('adminDashboard.period.week')}
                value={`${formatAmount(
                  (referrersTab === 'earnings'
                    ? referrers.by_earnings
                    : referrers.by_invited
                  ).reduce((sum, r) => sum + r.earnings_week_kopeks, 0) / 100,
                )}\u00A0${currencySymbol}`}
                icon={<CalendarBlankIcon className="h-5 w-5" />}
                tone="neutral"
              />
              <StatCard
                label={t('adminDashboard.period.month')}
                value={`${formatAmount(
                  (referrersTab === 'earnings'
                    ? referrers.by_earnings
                    : referrers.by_invited
                  ).reduce((sum, r) => sum + r.earnings_month_kopeks, 0) / 100,
                )}\u00A0${currencySymbol}`}
                icon={<CalendarIcon className="h-5 w-5" />}
                tone="neutral"
              />
            </div>
          </div>
        )}

        {/* Top Campaigns */}
        {campaigns && campaigns.campaigns.length > 0 && (
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-apple-amber/15 p-2 text-apple-amber sm:p-2.5">
                <MegaphoneIcon />
              </div>
              <div>
                <h2 className="text-base font-semibold text-apple-ink sm:text-lg">
                  {t('adminDashboard.topCampaigns.title')}
                </h2>
                <p className="text-xs text-apple-mute sm:text-sm">
                  {campaigns.total_campaigns}{' '}
                  {t('adminDashboard.topCampaigns.stats', { count: campaigns.total_registrations })}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {campaigns.campaigns.slice(0, 5).map((campaign, idx) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-apple-elevated p-2 transition-colors sm:p-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-apple-card text-[10px] font-bold text-apple-mute sm:h-6 sm:w-6 sm:text-xs">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-apple-ink sm:text-sm">
                        {campaign.name}
                      </div>
                      <div className="truncate text-[10px] text-apple-faint sm:text-xs">
                        ?start={campaign.start_parameter}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs font-semibold text-apple-amber sm:text-sm">
                      {formatAmount(campaign.total_revenue_kopeks / 100)}
                      {'\u00A0'}
                      {currencySymbol}
                    </div>
                    <div className="text-[10px] text-apple-faint sm:text-xs">
                      {campaign.registrations} · {campaign.conversion_rate.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-apple-hairline pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-apple-mute sm:text-sm">
                  {t('adminDashboard.topCampaigns.total')}
                </span>
                <span className="text-sm font-bold text-apple-amber sm:text-base">
                  {formatAmount(campaigns.total_revenue_kopeks / 100)}
                  {'\u00A0'}
                  {currencySymbol}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Payments */}
      {payments && payments.payments.length > 0 && (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-apple-green/15 p-2 text-apple-green sm:p-2.5">
                <BanknotesIcon />
              </div>
              <div>
                <h2 className="text-base font-semibold text-apple-ink sm:text-lg">
                  {t('adminDashboard.recentPayments.title')}
                </h2>
                <p className="text-xs text-apple-mute sm:text-sm">
                  {t('adminDashboard.recentPayments.today', {
                    amount: `${formatAmount(payments.total_today_kopeks / 100)}\u00A0${currencySymbol}`,
                  })}
                  <span className="hidden sm:inline">
                    {' '}
                    ·{' '}
                    {t('adminDashboard.recentPayments.week', {
                      amount: `${formatAmount(payments.total_week_kopeks / 100)}\u00A0${currencySymbol}`,
                    })}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-apple-hairline">
                  <th className="px-2 py-3 text-left text-xs font-medium text-apple-faint">
                    {t('adminDashboard.table.user')}
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-apple-faint">
                    {t('adminDashboard.table.type')}
                  </th>
                  <th className="px-2 py-3 text-right text-xs font-medium text-apple-faint">
                    {t('adminDashboard.table.amount')}
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-apple-faint">
                    {t('adminDashboard.table.method')}
                  </th>
                  <th className="px-2 py-3 text-right text-xs font-medium text-apple-faint">
                    {t('adminDashboard.table.date')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.payments.slice(0, 10).map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-apple-hairline transition-colors hover:bg-apple-elevated"
                  >
                    <td className="px-2 py-3">
                      <button
                        onClick={() =>
                          navigate(`/admin/users/${payment.user_id}`, backTo(location))
                        }
                        className="text-left transition-colors hover:opacity-80"
                      >
                        <div className="text-sm font-medium text-apple-ink underline decoration-apple-faint underline-offset-2 hover:decoration-apple-mute">
                          {payment.display_name}
                        </div>
                        {payment.username && (
                          <div className="text-xs text-apple-faint">@{payment.username}</div>
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          payment.type === 'deposit'
                            ? 'bg-apple-green/15 text-apple-green'
                            : 'bg-[#F97315]/15 text-[#F97315]'
                        }`}
                      >
                        {payment.type_display}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className="font-semibold text-apple-ink">
                        {formatAmount(payment.amount_rubles)}
                        {'\u00A0'}
                        {currencySymbol}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span className="text-xs text-apple-mute">
                        {payment.payment_method
                          ? (METHOD_LABELS[payment.payment_method] ?? payment.payment_method)
                          : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className="text-xs text-apple-mute">
                        {new Date(payment.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 md:hidden">
            {payments.payments.slice(0, 10).map((payment) => (
              <div key={payment.id} className="rounded-lg bg-apple-elevated p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      onClick={() => navigate(`/admin/users/${payment.user_id}`, backTo(location))}
                      className="truncate text-sm font-medium text-apple-ink underline decoration-apple-faint underline-offset-2 transition-colors hover:decoration-apple-mute"
                    >
                      {payment.display_name}
                    </button>
                  </div>
                  <span className="ml-2 whitespace-nowrap text-sm font-semibold text-apple-ink">
                    {formatAmount(payment.amount_rubles)}
                    {'\u00A0'}
                    {currencySymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-apple-faint">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] ${
                        payment.type === 'deposit'
                          ? 'bg-apple-green/15 text-apple-green'
                          : 'bg-[#F97315]/15 text-[#F97315]'
                      }`}
                    >
                      {payment.type_display}
                    </span>
                    <span className="truncate">
                      {payment.payment_method
                        ? (METHOD_LABELS[payment.payment_method] ?? payment.payment_method)
                        : '-'}
                    </span>
                  </span>
                  <span>
                    {new Date(payment.created_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Info */}
      {systemInfo && (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-apple-mute">
            {t('adminDashboard.systemInfo.title')}
          </h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-apple-faint">{t('adminDashboard.systemInfo.cabinet')}: </span>
              <span className="font-medium text-apple-ink">v{CABINET_VERSION}</span>
            </div>
            <div>
              <span className="text-apple-faint">{t('adminDashboard.systemInfo.bot')}: </span>
              <span className="font-medium text-apple-ink">v{systemInfo.bot_version}</span>
            </div>
            <div>
              <span className="text-apple-faint">{t('adminDashboard.systemInfo.python')}: </span>
              <span className="font-medium text-apple-ink">{systemInfo.python_version}</span>
            </div>
            <div>
              <span className="text-apple-faint">{t('adminDashboard.systemInfo.uptime')}: </span>
              <span className="font-medium text-apple-ink">
                {(() => {
                  const s = systemInfo.uptime_seconds;
                  const d = Math.floor(s / 86400);
                  const h = Math.floor((s % 86400) / 3600);
                  const m = Math.floor((s % 3600) / 60);
                  return [d > 0 && `${d}d`, h > 0 && `${h}h`, `${m}m`].filter(Boolean).join(' ');
                })()}
              </span>
            </div>
            <div>
              <span className="text-apple-faint">{t('adminDashboard.systemInfo.users')}: </span>
              <span className="font-medium text-apple-ink">{systemInfo.users_total}</span>
            </div>
            <div>
              <span className="text-apple-faint">
                {t('adminDashboard.systemInfo.activeSubs')}:{' '}
              </span>
              <span className="font-medium text-apple-ink">{systemInfo.subscriptions_active}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
