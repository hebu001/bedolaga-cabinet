import { StatCard } from '@/components/stats';
import { PageSkeleton,Skeleton,SkeletonGroup } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useCallback,useEffect,useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
banSystemApi,
type BanAgentsListResponse,
type BanHealthResponse,
type BanNodesListResponse,
type BanPunishmentsListResponse,
type BanReportResponse,
type BanSettingDefinition,
type BanSettingsResponse,
type BanSystemStats,
type BanSystemStatus,
type BanTrafficResponse,
type BanTrafficViolationsResponse,
type BanUserDetailResponse,
type BanUsersListResponse,
} from '../api/banSystem';
import { AdminBackButton } from '../components/admin/AdminBackButton';
import { useFocusTrap } from '../hooks/useFocusTrap';

import { BackIcon,ClockIcon,XIcon } from '@/components/admin/legacyIcons';
import {
AgentIcon,
BanIcon,
ChartIcon,
HealthIcon,
RefreshIcon,
ReportIcon,
SearchIcon,
ServerIcon,
SettingsIcon,
ShieldIcon,
TrafficIcon,
UsersIcon,
WarningIcon,
} from '@/components/admin/legacyPageIcons/AdminBanSystem';
import { ExclamationIcon,StatusIcon } from '@/components/icons';

type TabType =
  | 'dashboard'
  | 'users'
  | 'punishments'
  | 'nodes'
  | 'agents'
  | 'violations'
  | 'settings'
  | 'traffic'
  | 'reports'
  | 'health';

export default function AdminBanSystem() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [status, setStatus] = useState<BanSystemStatus | null>(null);
  const [stats, setStats] = useState<BanSystemStats | null>(null);
  const [users, setUsers] = useState<BanUsersListResponse | null>(null);
  const [selectedUser, setSelectedUser] = useState<BanUserDetailResponse | null>(null);
  const userDetailRef = useFocusTrap<HTMLDivElement>(selectedUser !== null, {
    onEscape: () => setSelectedUser(null),
  });
  const [punishments, setPunishments] = useState<BanPunishmentsListResponse | null>(null);
  const [nodes, setNodes] = useState<BanNodesListResponse | null>(null);
  const [agents, setAgents] = useState<BanAgentsListResponse | null>(null);
  const [violations, setViolations] = useState<BanTrafficViolationsResponse | null>(null);
  const [settings, setSettings] = useState<BanSettingsResponse | null>(null);
  const [traffic, setTraffic] = useState<BanTrafficResponse | null>(null);
  const [report, setReport] = useState<BanReportResponse | null>(null);
  const [health, setHealth] = useState<BanHealthResponse | null>(null);
  const [reportHours, setReportHours] = useState(24);
  const [settingLoading, setSettingLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Format snake_case to readable label
  const formatSettingKey = useCallback(
    (key: string): string => {
      // Try translation first
      const translated = t(`banSystem.settings.${key}`, { defaultValue: '' });
      if (translated && translated !== `banSystem.settings.${key}`) {
        return translated;
      }
      // Fallback: convert snake_case to Title Case
      return key
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    },
    [t],
  );

  const formatCategory = useCallback(
    (category: string): string => {
      const translated = t(`banSystem.settings.categories.${category}`, { defaultValue: '' });
      if (translated && translated !== `banSystem.settings.categories.${category}`) {
        return translated;
      }
      return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
    },
    [t],
  );
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // React Query: status once at mount; each tab fetches lazily via `enabled`.
  // Caching means switching tabs returns to cached data instantly (with background revalidate).
  const statusQuery = useQuery({
    queryKey: ['ban-status'] as const,
    queryFn: () => banSystemApi.getStatus(),
  });
  const isReady = !!(status?.enabled && status?.configured);

  const dashboardQuery = useQuery({
    queryKey: ['ban-stats'] as const,
    queryFn: () => banSystemApi.getStats(),
    enabled: isReady && activeTab === 'dashboard',
  });
  const usersQuery = useQuery({
    queryKey: ['ban-users'] as const,
    queryFn: () => banSystemApi.getUsers({ limit: 50 }),
    enabled: isReady && activeTab === 'users',
  });
  const punishmentsQuery = useQuery({
    queryKey: ['ban-punishments'] as const,
    queryFn: () => banSystemApi.getPunishments(),
    enabled: isReady && activeTab === 'punishments',
  });
  const nodesQuery = useQuery({
    queryKey: ['ban-nodes'] as const,
    queryFn: () => banSystemApi.getNodes(),
    enabled: isReady && activeTab === 'nodes',
  });
  const agentsQuery = useQuery({
    queryKey: ['ban-agents'] as const,
    queryFn: () => banSystemApi.getAgents(),
    enabled: isReady && activeTab === 'agents',
  });
  const violationsQuery = useQuery({
    queryKey: ['ban-violations'] as const,
    queryFn: () => banSystemApi.getTrafficViolations(),
    enabled: isReady && activeTab === 'violations',
  });
  const settingsQuery = useQuery({
    queryKey: ['ban-settings'] as const,
    queryFn: () => banSystemApi.getSettings(),
    enabled: isReady && activeTab === 'settings',
  });
  const trafficQuery = useQuery({
    queryKey: ['ban-traffic'] as const,
    queryFn: () => banSystemApi.getTraffic(),
    enabled: isReady && activeTab === 'traffic',
  });
  const reportsQuery = useQuery({
    queryKey: ['ban-report', reportHours] as const,
    queryFn: () => banSystemApi.getReport(reportHours),
    enabled: isReady && activeTab === 'reports',
  });
  const healthQuery = useQuery({
    queryKey: ['ban-health'] as const,
    queryFn: () => banSystemApi.getHealth(),
    enabled: isReady && activeTab === 'health',
  });

  // Sync query data into the existing state vars so the JSX + handlers stay unchanged
  // (handleSearch overrides `users` with search results; useEffect re-syncs on next refetch).
  useEffect(() => {
    if (statusQuery.data) {
      setStatus(statusQuery.data);
      if (!statusQuery.data.enabled || !statusQuery.data.configured) {
        setError(t('banSystem.notConfigured'));
      }
    }
    if (statusQuery.isError) setError(t('banSystem.loadError'));
  }, [statusQuery.data, statusQuery.isError, t]);

  useEffect(() => {
    if (dashboardQuery.data) setStats(dashboardQuery.data);
  }, [dashboardQuery.data]);
  useEffect(() => {
    if (usersQuery.data) setUsers(usersQuery.data);
  }, [usersQuery.data]);
  useEffect(() => {
    if (punishmentsQuery.data) setPunishments(punishmentsQuery.data);
  }, [punishmentsQuery.data]);
  useEffect(() => {
    if (nodesQuery.data) setNodes(nodesQuery.data);
  }, [nodesQuery.data]);
  useEffect(() => {
    if (agentsQuery.data) setAgents(agentsQuery.data);
  }, [agentsQuery.data]);
  useEffect(() => {
    if (violationsQuery.data) setViolations(violationsQuery.data);
  }, [violationsQuery.data]);
  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);
  useEffect(() => {
    if (trafficQuery.data) setTraffic(trafficQuery.data);
  }, [trafficQuery.data]);
  useEffect(() => {
    if (reportsQuery.data) setReport(reportsQuery.data);
  }, [reportsQuery.data]);
  useEffect(() => {
    if (healthQuery.data) setHealth(healthQuery.data);
  }, [healthQuery.data]);

  // Map activeTab → its query (used for `loading` derivation and refetchActiveTab below).
  const activeTabQuery =
    activeTab === 'dashboard'
      ? dashboardQuery
      : activeTab === 'users'
        ? usersQuery
        : activeTab === 'punishments'
          ? punishmentsQuery
          : activeTab === 'nodes'
            ? nodesQuery
            : activeTab === 'agents'
              ? agentsQuery
              : activeTab === 'violations'
                ? violationsQuery
                : activeTab === 'settings'
                  ? settingsQuery
                  : activeTab === 'traffic'
                    ? trafficQuery
                    : activeTab === 'reports'
                      ? reportsQuery
                      : healthQuery;

  // Derive `loading` from status + active tab query.
  useEffect(() => {
    setLoading(statusQuery.isLoading || activeTabQuery.isFetching);
    if (activeTabQuery.isError) setError(t('banSystem.loadError'));
  }, [statusQuery.isLoading, activeTabQuery.isFetching, activeTabQuery.isError, t]);

  const refetchActiveTab = useCallback(() => {
    void activeTabQuery.refetch();
  }, [activeTabQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      void usersQuery.refetch();
      return;
    }
    try {
      setLoading(true);
      const data = await banSystemApi.searchUsers(searchQuery);
      setUsers(data);
    } catch {
      setError(t('banSystem.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = async (email: string) => {
    try {
      setActionLoading(email);
      const data = await banSystemApi.getUser(email);
      setSelectedUser(data);
    } catch {
      setError(t('banSystem.loadError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      setActionLoading(userId);
      await banSystemApi.unbanUser(userId);
      void punishmentsQuery.refetch();
    } catch {
      setError(t('banSystem.loadError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSetting = async (key: string) => {
    try {
      setSettingLoading(key);
      await banSystemApi.toggleSetting(key);
      void settingsQuery.refetch();
    } catch {
      setError(t('banSystem.loadError'));
    } finally {
      setSettingLoading(null);
    }
  };

  const handleSetSetting = async (key: string, value: string) => {
    try {
      setSettingLoading(key);
      await banSystemApi.setSetting(key, value);
      void settingsQuery.refetch();
    } catch {
      setError(t('banSystem.loadError'));
    } finally {
      setSettingLoading(null);
    }
  };

  const handleReportPeriodChange = (hours: number) => {
    setReportHours(hours);
  };

  // (reports query auto-refetches when reportHours changes — it's in the queryKey)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number | null) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const tabs = [
    {
      id: 'dashboard' as TabType,
      label: t('banSystem.tabs.dashboard'),
      icon: <ChartIcon className="h-5 w-5" />,
    },
    { id: 'users' as TabType, label: t('banSystem.tabs.users'), icon: <UsersIcon /> },
    { id: 'punishments' as TabType, label: t('banSystem.tabs.punishments'), icon: <BanIcon /> },
    { id: 'nodes' as TabType, label: t('banSystem.tabs.nodes'), icon: <ServerIcon /> },
    { id: 'agents' as TabType, label: t('banSystem.tabs.agents'), icon: <AgentIcon /> },
    { id: 'violations' as TabType, label: t('banSystem.tabs.violations'), icon: <WarningIcon /> },
    { id: 'traffic' as TabType, label: t('banSystem.tabs.traffic'), icon: <TrafficIcon /> },
    { id: 'reports' as TabType, label: t('banSystem.tabs.reports'), icon: <ReportIcon /> },
    { id: 'settings' as TabType, label: t('banSystem.tabs.settings'), icon: <SettingsIcon /> },
    { id: 'health' as TabType, label: t('banSystem.tabs.health'), icon: <HealthIcon /> },
  ];

  if (loading && !status) {
    return (
      <PageSkeleton
        variant="admin"
        leading={['h-10 w-10 rounded-xl', 'h-12 w-12 rounded-xl']}
        titleWidth="w-56"
        className="space-y-6"
      >
        <div className="flex flex-wrap gap-2 border-b border-apple-hairline pb-2">
          <Skeleton count={4} className="h-10 w-28 shrink-0 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard loading />
          <StatCard loading />
          <StatCard loading />
          <StatCard loading />
        </div>
      </PageSkeleton>
    );
  }

  if (error && !status?.enabled) {
    return (
      <div className="flex min-h-[60vh] animate-fade-in items-center justify-center">
        <div className="mx-4 w-full max-w-md">
          {/* Card */}
          <div className="apple-card-grad rounded-2xl bg-apple-card p-8 text-center shadow-2xl">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-apple-red/15 to-apple-amber/15">
                  <ExclamationIcon className="h-10 w-10 text-apple-red" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-apple-elevated">
                  <SettingsIcon className="h-3.5 w-3.5 text-apple-mute" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="mb-2 text-xl font-bold text-apple-ink">{t('banSystem.title')}</h2>

            {/* Error message */}
            <p className="mb-2 font-medium text-apple-red">{error}</p>

            {/* Hint */}
            <p className="mb-8 text-sm text-apple-mute">{t('banSystem.configureHint')}</p>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              {/* Telegram Button */}
              <a
                href="https://t.me/fringg"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0088cc] to-[#0099dd] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:from-[#0077bb] hover:to-[#0088cc] hover:shadow-lg hover:shadow-[#0088cc]/20"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                {t('banSystem.contactTelegram')}
              </a>

              {/* Back Button */}
              <button
                onClick={() => window.history.back()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-apple-elevated px-4 py-2 text-sm font-medium text-apple-ink transition-all duration-200 hover:opacity-90"
              >
                <BackIcon className="h-5 w-5" />
                {t('common.back')}
              </button>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-20 top-1/4 h-40 w-40 rounded-full bg-[#F97315]/5 blur-3xl" />
            <div className="absolute -right-20 bottom-1/4 h-40 w-40 rounded-full bg-apple-red/5 blur-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          <AdminBackButton />
          <div className="rounded-xl bg-apple-red/15 p-3">
            <ShieldIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-apple-ink">{t('banSystem.title')}</h1>
            <p className="text-apple-mute">{t('banSystem.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={refetchActiveTab}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-apple-elevated px-4 py-2 text-apple-mute transition-colors hover:text-apple-ink hover:opacity-90 disabled:opacity-50"
        >
          <RefreshIcon className="h-5 w-5" />
          {t('common.refresh')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-apple-hairline pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#F97315]/15 text-[#F97315]'
                : 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : error ? (
        <div className="py-8 text-center text-apple-red">{error}</div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && stats && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label={t('banSystem.stats.activeUsers')}
                value={stats.active_users}
                subValue={`${t('banSystem.stats.total')}: ${stats.total_users}`}
                icon={<UsersIcon className="h-5 w-5" />}
                tone="success"
              />
              <StatCard
                label={t('banSystem.stats.usersOverLimit')}
                value={stats.users_over_limit}
                icon={<WarningIcon className="h-5 w-5" />}
                tone="warning"
              />
              <StatCard
                label={t('banSystem.stats.activeBans')}
                value={stats.active_punishments}
                subValue={`${t('banSystem.stats.total')}: ${stats.total_punishments}`}
                icon={<BanIcon className="h-5 w-5" />}
                tone="error"
              />
              <StatCard
                label={t('banSystem.stats.nodesOnline')}
                value={`${stats.nodes_online}/${stats.nodes_total}`}
                icon={<ServerIcon className="h-5 w-5" />}
                tone="accent"
              />
              <StatCard
                label={t('banSystem.stats.agentsOnline')}
                value={`${stats.agents_online}/${stats.agents_total}`}
                icon={<AgentIcon className="h-5 w-5" />}
                tone="accent"
              />
              <StatCard
                label={t('banSystem.stats.totalRequests')}
                value={stats.total_requests.toLocaleString()}
                icon={<ChartIcon className="h-5 w-5" />}
                tone="accent"
              />
              <StatCard
                label={t('banSystem.stats.panelStatus')}
                value={
                  stats.panel_connected
                    ? t('banSystem.stats.connected')
                    : t('banSystem.stats.disconnected')
                }
                icon={<StatusIcon className="h-5 w-5" />}
                tone={stats.panel_connected ? 'success' : 'error'}
              />
              <StatCard
                label={t('banSystem.stats.uptime')}
                value={formatUptime(stats.uptime_seconds)}
                icon={<ClockIcon className="h-5 w-5" />}
                tone="accent"
              />
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  {/* Значок стоял над полем, а не внутри: не был прижат к его левому краю. */}
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-apple-faint">
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={t('banSystem.users.searchPlaceholder')}
                    className="w-full rounded-xl bg-apple-elevated py-3 pl-10 pr-4 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="rounded-full bg-[#F97315] px-4 py-2 text-white transition-opacity hover:opacity-90"
                >
                  {t('common.search')}
                </button>
              </div>

              {/* Users Table */}
              <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-apple-hairline">
                      <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                        {t('banSystem.users.email')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.users.ipCount')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.users.limit')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.users.status')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.users.bans')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-apple-faint">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.users.map((user) => (
                      <tr
                        key={user.email}
                        className="border-b border-apple-hairline/60 hover:bg-apple-elevated"
                      >
                        <td className="px-4 py-3 text-apple-ink">{user.email}</td>
                        <td className="px-4 py-3 text-center text-apple-mute">
                          {user.unique_ip_count}
                        </td>
                        <td className="px-4 py-3 text-center text-apple-mute">
                          {user.limit ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              user.is_over_limit
                                ? 'bg-apple-red/15 text-apple-red'
                                : 'bg-apple-green/15 text-apple-green'
                            }`}
                          >
                            {user.is_over_limit
                              ? t('banSystem.users.overLimit')
                              : t('banSystem.users.ok')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-apple-mute">
                          {user.blocked_count}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleViewUser(user.email)}
                            disabled={actionLoading === user.email}
                            className="text-sm text-[#F97315] hover:opacity-80 disabled:opacity-50"
                          >
                            {t('banSystem.users.viewDetails')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!users?.users || users.users.length === 0) && (
                  <div className="py-8 text-center text-apple-faint">{t('common.noData')}</div>
                )}
              </div>
            </div>
          )}

          {/* Punishments Tab */}
          {activeTab === 'punishments' && (
            <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-apple-hairline">
                    <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                      {t('banSystem.punishments.user')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                      {t('banSystem.punishments.reason')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                      {t('banSystem.punishments.ipCount')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                      {t('banSystem.punishments.limit')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                      {t('banSystem.punishments.bannedAt')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                      {t('banSystem.punishments.enableAt')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-apple-faint">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {punishments?.punishments.map((p) => (
                    <tr
                      key={p.user_id}
                      className="border-b border-apple-hairline/60 hover:bg-apple-elevated"
                    >
                      <td className="px-4 py-3">
                        <div className="text-apple-ink">{p.username}</div>
                        <div className="text-xs text-apple-faint">{p.user_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-apple-mute">{p.reason || '-'}</td>
                      <td className="px-4 py-3 text-center text-apple-red">{p.ip_count}</td>
                      <td className="px-4 py-3 text-center text-apple-mute">{p.limit}</td>
                      <td className="px-4 py-3 text-center text-sm text-apple-mute">
                        {formatDate(p.punished_at)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-apple-mute">
                        {formatDate(p.enable_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleUnban(p.user_id)}
                          disabled={actionLoading === p.user_id}
                          className="rounded-full bg-apple-green/15 px-3 py-1 text-sm text-apple-green transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          {t('banSystem.punishments.unban')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!punishments?.punishments || punishments.punishments.length === 0) && (
                <div className="py-8 text-center text-apple-faint">
                  {t('banSystem.punishments.noBans')}
                </div>
              )}
            </div>
          )}

          {/* Nodes Tab */}
          {activeTab === 'nodes' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {nodes?.nodes.map((node) => (
                <div
                  key={node.name}
                  className={`apple-card-grad rounded-2xl bg-apple-card p-4 ${
                    node.is_connected ? 'ring-1 ring-apple-green/40' : ''
                  }`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full ${node.is_connected ? 'animate-pulse bg-apple-green' : 'bg-apple-faint'}`}
                    />
                    <div>
                      <div className="font-medium text-apple-ink">{node.name}</div>
                      <div className="text-xs text-apple-faint">{node.address || '-'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-apple-elevated p-2.5">
                      <div className="text-xs text-apple-faint">{t('banSystem.nodes.status')}</div>
                      <div
                        className={`text-sm font-medium ${node.is_connected ? 'text-apple-green' : 'text-apple-mute'}`}
                      >
                        {node.is_connected
                          ? t('banSystem.nodes.online')
                          : t('banSystem.nodes.offline')}
                      </div>
                    </div>
                    <div className="rounded-lg bg-apple-elevated p-2.5">
                      <div className="text-xs text-apple-faint">{t('banSystem.nodes.users')}</div>
                      <div className="text-sm font-medium text-apple-ink">{node.users_count}</div>
                    </div>
                  </div>
                </div>
              ))}
              {(!nodes?.nodes || nodes.nodes.length === 0) && (
                <div className="col-span-full py-8 text-center text-apple-faint">
                  {t('banSystem.nodes.noNodes')}
                </div>
              )}
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-4">
              {/* Summary */}
              {agents?.summary && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard
                    label={t('banSystem.agents.online')}
                    value={`${agents.summary.online_agents}/${agents.summary.total_agents}`}
                    icon={<AgentIcon className="h-5 w-5" />}
                    tone="success"
                  />
                  <StatCard
                    label={t('banSystem.agents.totalSent')}
                    value={agents.summary.total_sent.toLocaleString()}
                    icon={<ChartIcon className="h-5 w-5" />}
                    tone="accent"
                  />
                  <StatCard
                    label={t('banSystem.agents.totalDropped')}
                    value={agents.summary.total_dropped.toLocaleString()}
                    icon={<WarningIcon className="h-5 w-5" />}
                    tone="warning"
                  />
                  <StatCard
                    label={t('banSystem.agents.healthy')}
                    value={agents.summary.healthy_count}
                    subValue={`${t('banSystem.agents.warning')}: ${agents.summary.warning_count}, ${t('banSystem.agents.critical')}: ${agents.summary.critical_count}`}
                    icon={<AgentIcon className="h-5 w-5" />}
                    tone="accent"
                  />
                </div>
              )}

              {/* Agents List */}
              <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-apple-hairline">
                      <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                        {t('banSystem.agents.node')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.agents.status')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.agents.health')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.agents.sent')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.agents.dropped')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                        {t('banSystem.agents.queue')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents?.agents.map((agent) => (
                      <tr
                        key={agent.node_name}
                        className="border-b border-apple-hairline/60 hover:bg-apple-elevated"
                      >
                        <td className="px-4 py-3 text-apple-ink">{agent.node_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              agent.is_online
                                ? 'bg-apple-green/15 text-apple-green'
                                : 'bg-apple-elevated text-apple-mute'
                            }`}
                          >
                            {agent.is_online
                              ? t('banSystem.agents.online')
                              : t('banSystem.agents.offline')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              agent.health === 'healthy'
                                ? 'bg-apple-green/15 text-apple-green'
                                : agent.health === 'warning'
                                  ? 'bg-apple-amber/15 text-apple-amber'
                                  : agent.health === 'critical'
                                    ? 'bg-apple-red/15 text-apple-red'
                                    : 'bg-apple-elevated text-apple-mute'
                            }`}
                          >
                            {agent.health}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-apple-mute">
                          {agent.sent_total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center text-apple-amber">
                          {agent.dropped_total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center text-apple-mute">
                          {agent.queue_size}/{agent.queue_max}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!agents?.agents || agents.agents.length === 0) && (
                  <div className="py-8 text-center text-apple-faint">
                    {t('banSystem.agents.noAgents')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Violations Tab */}
          {activeTab === 'violations' && (
            <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-apple-hairline">
                    <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                      {t('banSystem.violations.user')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                      {t('banSystem.violations.type')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                      {t('banSystem.violations.description')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                      {t('banSystem.violations.detectedAt')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                      {t('banSystem.violations.status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {violations?.violations.map((v, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-apple-hairline/60 hover:bg-apple-elevated"
                    >
                      <td className="px-4 py-3">
                        <div className="text-apple-ink">{v.username}</div>
                        <div className="text-xs text-apple-faint">{v.email || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-apple-amber">{v.violation_type}</td>
                      <td className="px-4 py-3 text-sm text-apple-mute">{v.description || '-'}</td>
                      <td className="px-4 py-3 text-center text-sm text-apple-mute">
                        {formatDate(v.detected_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            v.resolved
                              ? 'bg-apple-green/15 text-apple-green'
                              : 'bg-apple-amber/15 text-apple-amber'
                          }`}
                        >
                          {v.resolved
                            ? t('banSystem.violations.resolved')
                            : t('banSystem.violations.active')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!violations?.violations || violations.violations.length === 0) && (
                <div className="py-8 text-center text-apple-faint">
                  {t('banSystem.violations.noViolations')}
                </div>
              )}
            </div>
          )}

          {/* Traffic Tab */}
          {activeTab === 'traffic' && traffic && (
            <div className="space-y-4">
              {/* Traffic Stats */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard
                  label={t('banSystem.traffic.enabled')}
                  value={traffic.enabled ? t('common.yes') : t('common.no')}
                  icon={<TrafficIcon className="h-5 w-5" />}
                  tone={traffic.enabled ? 'success' : 'warning'}
                />
              </div>

              {/* Top Users by Traffic */}
              {traffic.top_users && traffic.top_users.length > 0 && (
                <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
                  <div className="border-b border-apple-hairline p-4">
                    <h3 className="text-sm font-medium text-apple-ink">
                      {t('banSystem.traffic.topUsers')}
                    </h3>
                  </div>
                  <table className="w-full min-w-[36rem]">
                    <thead>
                      <tr className="border-b border-apple-hairline">
                        <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                          {t('banSystem.traffic.username')}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                          {t('banSystem.traffic.bytesTotal')}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                          {t('banSystem.traffic.bytesLimit')}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                          {t('banSystem.traffic.status')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.top_users.map((user, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-apple-hairline/60 hover:bg-apple-elevated"
                        >
                          <td className="px-4 py-3 text-apple-ink">{user.username}</td>
                          <td className="px-4 py-3 text-center text-apple-mute">
                            {formatBytes(user.bytes_total)}
                          </td>
                          <td className="px-4 py-3 text-center text-apple-mute">
                            {user.bytes_limit ? formatBytes(user.bytes_limit) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${
                                user.over_limit
                                  ? 'bg-apple-red/15 text-apple-red'
                                  : 'bg-apple-green/15 text-apple-green'
                              }`}
                            >
                              {user.over_limit
                                ? t('banSystem.traffic.overLimit')
                                : t('banSystem.traffic.ok')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent Violations */}
              {traffic.recent_violations && traffic.recent_violations.length > 0 && (
                <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
                  <div className="border-b border-apple-hairline p-4">
                    <h3 className="text-sm font-medium text-apple-ink">
                      {t('banSystem.traffic.recentViolations')}
                    </h3>
                  </div>
                  <table className="w-full min-w-[36rem]">
                    <thead>
                      <tr className="border-b border-apple-hairline">
                        <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                          {t('banSystem.violations.user')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                          {t('banSystem.violations.type')}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                          {t('banSystem.violations.detectedAt')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.recent_violations.map((v, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-apple-hairline/60 hover:bg-apple-elevated"
                        >
                          <td className="px-4 py-3 text-apple-ink">{v.username}</td>
                          <td className="px-4 py-3 text-apple-amber">{v.violation_type}</td>
                          <td className="px-4 py-3 text-center text-sm text-apple-mute">
                            {formatDate(v.detected_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(!traffic.top_users || traffic.top_users.length === 0) &&
                (!traffic.recent_violations || traffic.recent_violations.length === 0) && (
                  <div className="py-8 text-center text-apple-faint">{t('common.noData')}</div>
                )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {/* Period Selector */}
              <div className="flex items-center gap-4">
                <span className="text-apple-mute">{t('banSystem.reports.period')}:</span>
                <div className="flex gap-2">
                  {[6, 12, 24, 48, 72].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => handleReportPeriodChange(hours)}
                      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                        reportHours === hours
                          ? 'bg-[#F97315]/15 text-[#F97315]'
                          : 'bg-apple-elevated text-apple-mute hover:text-apple-ink'
                      }`}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
              </div>

              {report && (
                <>
                  {/* Report Stats */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <StatCard
                      label={t('banSystem.reports.currentUsers')}
                      value={report.current_users}
                      icon={<UsersIcon className="h-5 w-5" />}
                      tone="accent"
                    />
                    <StatCard
                      label={t('banSystem.reports.currentIps')}
                      value={report.current_ips}
                      icon={<ServerIcon className="h-5 w-5" />}
                      tone="accent"
                    />
                  </div>

                  {/* Top Violators */}
                  {report.top_violators && report.top_violators.length > 0 && (
                    <div className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card">
                      <div className="border-b border-apple-hairline p-4">
                        <h3 className="text-sm font-medium text-apple-ink">
                          {t('banSystem.reports.topViolators')}
                        </h3>
                      </div>
                      <table className="w-full min-w-[36rem]">
                        <thead>
                          <tr className="border-b border-apple-hairline">
                            <th className="px-4 py-3 text-left text-xs font-medium text-apple-faint">
                              {t('banSystem.reports.username')}
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-apple-faint">
                              {t('banSystem.reports.count')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.top_violators.map((v, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-apple-hairline/60 hover:bg-apple-elevated"
                            >
                              <td className="px-4 py-3 text-apple-ink">{v.username}</td>
                              <td className="px-4 py-3 text-center text-apple-amber">{v.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && settings && (
            <div className="space-y-4">
              {/* Group settings by category */}
              {(() => {
                const grouped: Record<string, BanSettingDefinition[]> = {};

                // Smart categorization: use API category or infer from key prefix
                const inferCategory = (key: string, apiCategory: string | null): string => {
                  if (apiCategory) return apiCategory;
                  if (key.startsWith('punishment_') || key.startsWith('progressive_ban'))
                    return 'punishment';
                  if (key.startsWith('traffic_')) return 'traffic';
                  if (key.startsWith('network_')) return 'network';
                  if (key.startsWith('rate_limit_')) return 'rate_limit';
                  if (key.startsWith('notify_') || key.startsWith('daily_report'))
                    return 'notifications';
                  return 'general';
                };

                settings.settings.forEach((s) => {
                  const cat = inferCategory(s.key, s.category);
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(s);
                });

                // Sort categories in logical order
                const categoryOrder = [
                  'general',
                  'punishment',
                  'progressive_bans',
                  'traffic',
                  'network',
                  'notifications',
                  'rate_limit',
                ];
                const sortedCategories = Object.keys(grouped).sort((a, b) => {
                  const aIdx = categoryOrder.indexOf(a);
                  const bIdx = categoryOrder.indexOf(b);
                  if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
                  if (aIdx === -1) return 1;
                  if (bIdx === -1) return -1;
                  return aIdx - bIdx;
                });

                return sortedCategories.map((category) => (
                  <div
                    key={category}
                    className="apple-card-grad overflow-hidden rounded-2xl bg-apple-card"
                  >
                    <div className="border-b border-apple-hairline p-4">
                      <h3 className="text-sm font-medium text-apple-ink">
                        {formatCategory(category)}
                      </h3>
                    </div>
                    <div className="divide-y divide-apple-hairline">
                      {grouped[category].map((setting) => (
                        <div
                          key={setting.key}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-apple-ink">
                              {formatSettingKey(setting.key)}
                            </div>
                            {setting.description && (
                              <div className="mt-0.5 text-xs text-apple-faint">
                                {setting.description}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 max-w-full shrink-0">
                            {setting.type === 'bool' ? (
                              <button
                                onClick={() => handleToggleSetting(setting.key)}
                                disabled={!setting.editable || settingLoading === setting.key}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  setting.value ? 'bg-[#F97315]' : 'bg-apple-elevated'
                                } ${!setting.editable ? 'cursor-not-allowed opacity-50' : ''}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    setting.value ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            ) : setting.type === 'int' ? (
                              <input
                                type="number"
                                value={String(setting.value)}
                                onChange={(e) => handleSetSetting(setting.key, e.target.value)}
                                min={setting.min_value ?? undefined}
                                max={setting.max_value ?? undefined}
                                disabled={!setting.editable || settingLoading === setting.key}
                                className="w-24 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                              />
                            ) : setting.type === 'list' ? (
                              <div className="flex max-w-full flex-wrap justify-end gap-1.5 sm:max-w-xs">
                                {Array.isArray(setting.value) && setting.value.length > 0 ? (
                                  setting.value.map((item, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded bg-[#F97315]/15 px-2 py-0.5 text-xs text-[#F97315]"
                                    >
                                      {String(item)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-apple-faint">
                                    {t('common.noData')}
                                  </span>
                                )}
                                {setting.editable && nodes && setting.key.includes('nodes') && (
                                  <select
                                    className="rounded-xl bg-apple-elevated px-4 py-1 text-xs text-apple-ink outline-none focus:ring-2 focus:ring-[#F97315]/50"
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const currentList = Array.isArray(setting.value)
                                          ? setting.value
                                          : [];
                                        if (!currentList.includes(e.target.value)) {
                                          handleSetSetting(
                                            setting.key,
                                            [...currentList, e.target.value].join(','),
                                          );
                                        }
                                        e.target.value = '';
                                      }
                                    }}
                                    disabled={settingLoading === setting.key}
                                  >
                                    <option value="">+ {t('common.add')}</option>
                                    {nodes.nodes
                                      .filter(
                                        (n) =>
                                          !Array.isArray(setting.value) ||
                                          !setting.value.includes(n.name),
                                      )
                                      .map((n) => (
                                        <option key={n.name} value={n.name}>
                                          {n.name}
                                        </option>
                                      ))}
                                  </select>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-apple-mute">{String(setting.value)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Health Tab */}
          {activeTab === 'health' && health && (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full ${
                        health.status === 'healthy'
                          ? 'animate-pulse bg-apple-green'
                          : health.status === 'degraded'
                            ? 'animate-pulse bg-apple-amber'
                            : 'animate-pulse bg-apple-red'
                      }`}
                    />
                    <div>
                      <div className="font-medium text-apple-ink">
                        {t('banSystem.health.systemStatus')}
                      </div>
                      <div
                        className={`text-sm ${
                          health.status === 'healthy'
                            ? 'text-apple-green'
                            : health.status === 'degraded'
                              ? 'text-apple-amber'
                              : 'text-apple-red'
                        }`}
                      >
                        {health.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  {health.uptime !== null && (
                    <div className="text-right">
                      <div className="text-xs text-apple-faint">{t('banSystem.stats.uptime')}</div>
                      <div className="text-apple-ink">{formatUptime(health.uptime)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Components Status */}
              {health.components && health.components.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {health.components.map((comp, idx) => (
                    <div
                      key={idx}
                      className={`apple-card-grad rounded-2xl bg-apple-card p-4 ${
                        comp.status === 'healthy'
                          ? 'ring-1 ring-apple-green/40'
                          : comp.status === 'degraded'
                            ? 'ring-1 ring-apple-amber/40'
                            : 'ring-1 ring-apple-red/40'
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-3">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            comp.status === 'healthy'
                              ? 'bg-apple-green'
                              : comp.status === 'degraded'
                                ? 'bg-apple-amber'
                                : 'bg-apple-red'
                          }`}
                        />
                        <div className="font-medium text-apple-ink">{comp.name}</div>
                      </div>
                      <div
                        className={`text-sm ${
                          comp.status === 'healthy'
                            ? 'text-apple-green'
                            : comp.status === 'degraded'
                              ? 'text-apple-amber'
                              : 'text-apple-red'
                        }`}
                      >
                        {comp.status}
                      </div>
                      {comp.message && (
                        <div className="mt-1 text-xs text-apple-faint">{comp.message}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            ref={userDetailRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ban-user-detail-title"
            tabIndex={-1}
            className="apple-card-grad max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-apple-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-apple-hairline p-4">
              <h3 id="ban-user-detail-title" className="text-lg font-semibold text-apple-ink">
                {t('banSystem.userDetail.title')}
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                aria-label={t('common.close')}
                className="text-apple-mute hover:text-apple-ink"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-apple-faint">{t('banSystem.users.email')}</div>
                  <div className="text-apple-ink">{selectedUser.email}</div>
                </div>
                <div>
                  <div className="text-xs text-apple-faint">{t('banSystem.users.limit')}</div>
                  <div className="text-apple-ink">{selectedUser.limit ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-apple-faint">{t('banSystem.users.ipCount')}</div>
                  <div className="text-apple-ink">{selectedUser.unique_ip_count}</div>
                </div>
                <div>
                  <div className="text-xs text-apple-faint">{t('banSystem.users.networkType')}</div>
                  <div className="text-apple-ink">{selectedUser.network_type || '-'}</div>
                </div>
              </div>

              {/* IP History */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-apple-ink">
                  {t('banSystem.userDetail.ipHistory')}
                </h4>
                <div className="overflow-hidden rounded-lg bg-apple-elevated">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-apple-hairline">
                        <th className="px-3 py-2 text-left text-xs text-apple-faint">
                          {t('banSystem.userDetail.ip')}
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-apple-faint">
                          {t('banSystem.userDetail.country')}
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-apple-faint">
                          {t('banSystem.userDetail.node')}
                        </th>
                        <th className="px-3 py-2 text-center text-xs text-apple-faint">
                          {t('banSystem.userDetail.requests')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUser.ips.map((ip, idx) => (
                        <tr key={idx} className="border-b border-apple-hairline/60">
                          <td className="px-3 py-2 text-apple-ink">{ip.ip}</td>
                          <td className="px-3 py-2 text-apple-mute">
                            {ip.country_name || ip.country_code || '-'}
                          </td>
                          <td className="px-3 py-2 text-apple-mute">{ip.node || '-'}</td>
                          <td className="px-3 py-2 text-center text-apple-mute">
                            {ip.request_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedUser.ips.length === 0 && (
                    <div className="py-4 text-center text-apple-faint">{t('common.noData')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
