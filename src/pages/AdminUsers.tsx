import { useState, useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../hooks/useCurrency';
import { adminUsersApi, type UserListItem } from '../api/adminUsers';
import { adminUsersQueryOptions } from '../utils/adminUsersQuery';
import { usePlatform } from '../platform/hooks/usePlatform';

const BackIcon = () => (
  <svg
    className="h-5 w-5 text-apple-mute"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
    />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const RefreshIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

const TelegramIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colors = {
    blue: 'text-apple-blue',
    green: 'text-apple-green',
    yellow: 'text-apple-amber',
    red: 'text-apple-red',
    purple: 'text-[#F97315]',
  };

  return (
    <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
      <div className={`mb-1 text-2xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-sm text-apple-mute">{title}</div>
      {subtitle && <div className="mt-1 text-xs text-apple-faint">{subtitle}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    active: 'bg-apple-green/15 text-apple-green',
    blocked: 'bg-apple-red/15 text-apple-red',
    deleted: 'bg-apple-elevated text-apple-mute',
    trial: 'bg-[#F97315]/15 text-[#F97315]',
    expired: 'bg-apple-amber/15 text-apple-amber',
    disabled: 'bg-apple-elevated text-apple-mute',
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status] || styles.active}`}
    >
      {t(`admin.users.status.${status}`, { defaultValue: status })}
    </span>
  );
}

interface UserRowProps {
  user: UserListItem;
  formatAmount: (rubAmount: number) => string;
}

function UserRow({ user, formatAmount }: UserRowProps) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/admin/users/${user.id}`}
      className="flex cursor-pointer items-start gap-3 rounded-2xl bg-apple-card p-3 transition-all hover:bg-apple-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F97315] sm:items-center sm:gap-4 sm:p-4"
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white sm:text-base"
        style={{ background: 'linear-gradient(to bottom right, #F97315, #C2570A)' }}
      >
        {user.first_name?.[0] || user.username?.[0] || '?'}
      </div>

      {/* Info - flex column on mobile, row on desktop */}
      <div className="min-w-0 flex-1">
        {/* Name and username */}
        <div className="mb-1 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <span className="truncate font-medium text-apple-ink">{user.full_name}</span>
          {user.username && (
            <span className="truncate text-xs text-apple-faint sm:text-xs">@{user.username}</span>
          )}
        </div>

        {/* Telegram ID - full width on mobile */}
        <div className="mb-1 flex items-center gap-1 text-xs text-apple-mute sm:mb-0">
          <TelegramIcon />
          <span className="truncate">{user.telegram_id}</span>
        </div>

        {/* Status badges - wrap on mobile */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {user.status !== 'active' && <StatusBadge status={user.status} />}
          {user.has_subscription && user.subscription_status && (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                user.subscription_status === 'active'
                  ? 'bg-apple-green/15 text-apple-green'
                  : user.subscription_status === 'trial'
                    ? 'bg-[#F97315]/15 text-[#F97315]'
                    : user.subscription_status === 'limited'
                      ? 'bg-apple-amber/15 text-apple-amber'
                      : 'bg-apple-amber/15 text-apple-amber'
              }`}
            >
              {user.subscription_status === 'active'
                ? t('admin.users.status.subscription')
                : user.subscription_status === 'trial'
                  ? t('admin.users.status.trial')
                  : user.subscription_status === 'limited'
                    ? t('subscription.trafficLimited')
                    : t('admin.users.status.expired')}
            </span>
          )}
        </div>
      </div>

      {/* Balance - smaller on mobile, show inline */}
      <div className="shrink-0 text-right">
        <div className="text-sm font-medium text-apple-ink sm:text-base">
          {formatAmount(user.balance_rubles)}
        </div>
        <div className="hidden text-xs text-apple-faint sm:block">
          {user.purchase_count > 0
            ? t('admin.users.purchaseCount', { count: user.purchase_count })
            : t('admin.users.noPurchases')}
        </div>
      </div>

      <ChevronRightIcon />
    </Link>
  );
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const { formatWithCurrency } = useCurrency();
  const navigate = useNavigate();
  const { capabilities } = usePlatform();

  const [search, setSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [settledSearch, setSettledSearch] = useState({ search: '', email: '' });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [offset, setOffset] = useState(0);

  const limit = 20;
  const isDebouncing = search !== settledSearch.search || emailSearch !== settledSearch.email;
  useEffect(() => {
    if (!isDebouncing) return;
    const timeout = window.setTimeout(() => {
      // Commit both fields and the first page together, avoiding a request with old filters.
      setSettledSearch({ search, email: emailSearch });
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search, emailSearch, isDebouncing]);

  const usersQuery = useQuery({
    ...adminUsersQueryOptions({
      offset,
      limit,
      sort_by: sortBy as 'created_at' | 'balance' | 'last_activity' | 'total_spent',
      search: settledSearch.search || undefined,
      email: settledSearch.email || undefined,
      status: (statusFilter || undefined) as 'active' | 'blocked' | 'deleted' | undefined,
    }),
    enabled: !isDebouncing,
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({
    queryKey: ['admin-users-stats'],
    queryFn: ({ signal }) => adminUsersApi.getStats(signal),
  });
  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const stats = statsQuery.data;
  const loading = usersQuery.isPending;
  const busy = isDebouncing || usersQuery.isFetching;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              aria-label={t('common.back')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-card transition-colors hover:bg-apple-elevated"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-apple-ink">{t('admin.users.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.users.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => {
            void usersQuery.refetch();
            void statsQuery.refetch();
          }}
          disabled={isDebouncing || usersQuery.isFetching || statsQuery.isFetching}
          aria-label={t('common.refresh')}
          className="rounded-lg p-2 transition-colors hover:bg-apple-elevated disabled:opacity-50"
        >
          <RefreshIcon
            className={usersQuery.isFetching || statsQuery.isFetching ? 'animate-spin' : ''}
          />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard title={t('admin.users.stats.total')} value={stats.total_users} color="blue" />
          <StatCard
            title={t('admin.users.stats.active')}
            value={stats.active_users}
            color="green"
          />
          <StatCard
            title={t('admin.users.stats.withSubscription')}
            value={stats.users_with_active_subscription}
            color="purple"
          />
          <StatCard
            title={t('admin.users.stats.newToday')}
            value={stats.new_today}
            color="yellow"
          />
          <StatCard
            title={t('admin.users.stats.blocked')}
            value={stats.blocked_users}
            color="red"
          />
        </div>
      )}

      {statsQuery.isError && (
        <div role="alert" className="mb-4 rounded-xl bg-apple-card p-3 text-sm text-apple-mute">
          {t('admin.users.statsLoadError')}{' '}
          <button
            onClick={() => void statsQuery.refetch()}
            className="underline"
            disabled={statsQuery.isFetching}
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3">
        {/* Search fields row */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                aria-label={t('admin.users.search')}
                placeholder={t('admin.users.search')}
                className="w-full rounded-xl bg-apple-elevated py-3 pl-10 pr-4 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-faint">
                <SearchIcon />
              </div>
            </div>
          </form>
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="email"
                value={emailSearch}
                onChange={(e) => {
                  setEmailSearch(e.target.value);
                }}
                aria-label={t('admin.users.searchEmail')}
                placeholder={t('admin.users.searchEmail')}
                className="w-full rounded-xl bg-apple-elevated py-3 pl-10 pr-4 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-faint">
                <SearchIcon />
              </div>
            </div>
          </form>
        </div>
        {/* Filters row */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            aria-label={t('admin.users.filters.allStatuses')}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none focus:ring-2 focus:ring-[#F97315]/50"
          >
            <option value="">{t('admin.users.filters.allStatuses')}</option>
            <option value="active">{t('admin.users.status.active')}</option>
            <option value="blocked">{t('admin.users.status.blocked')}</option>
            <option value="deleted">{t('admin.users.status.deleted')}</option>
          </select>
          <select
            aria-label={t('admin.users.sortLabel')}
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setOffset(0);
            }}
            className="rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none focus:ring-2 focus:ring-[#F97315]/50"
          >
            <option value="created_at">{t('admin.users.filters.byDate')}</option>
            <option value="balance">{t('admin.users.filters.byBalance')}</option>
            <option value="last_activity">{t('admin.users.filters.byActivity')}</option>
            <option value="total_spent">{t('admin.users.filters.bySpent')}</option>
          </select>
        </div>
      </div>

      {/* Users list */}
      <div className="mb-4 space-y-2" aria-busy={loading || busy}>
        {usersQuery.isError && !isDebouncing && (
          <div role="alert" className="rounded-xl bg-apple-card p-4 text-sm text-apple-mute">
            {t('admin.users.loadError')}{' '}
            <button
              onClick={() => void usersQuery.refetch()}
              className="underline"
              disabled={usersQuery.isFetching}
            >
              {t('common.retry')}
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
          </div>
        ) : users.length === 0 && !usersQuery.isError && !busy ? (
          <div className="py-12 text-center text-apple-mute">{t('admin.users.noData')}</div>
        ) : (
          users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              formatAmount={(amount) => formatWithCurrency(amount)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && !usersQuery.isPlaceholderData && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-apple-mute">
            {t('admin.users.pagination.showing', {
              from: offset + 1,
              to: Math.min(offset + limit, total),
              total,
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              aria-label={t('admin.users.pagination.previous')}
              disabled={offset === 0 || busy}
              className="rounded-lg bg-apple-card p-2 transition-colors hover:bg-apple-elevated disabled:opacity-50"
            >
              <ChevronLeftIcon />
            </button>
            <span className="px-3 py-2 text-apple-mute">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              aria-label={t('admin.users.pagination.next')}
              disabled={offset + limit >= total || busy}
              className="rounded-lg bg-apple-card p-2 transition-colors hover:bg-apple-elevated disabled:opacity-50"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
