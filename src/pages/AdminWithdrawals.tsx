import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { withdrawalApi, AdminWithdrawalItem } from '../api/withdrawals';
import { AdminBackButton } from '../components/admin';
import { useCurrency } from '../hooks/useCurrency';
import { formatDate, getWithdrawalStatusBadge, getRiskColor } from '../utils/withdrawalUtils';

// Status filter tabs
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

const STATUS_FILTERS: StatusFilter[] = [
  'all',
  'pending',
  'approved',
  'rejected',
  'completed',
  'cancelled',
];

export default function AdminWithdrawals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatWithCurrency } = useCurrency();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', statusFilter],
    queryFn: () =>
      withdrawalApi.getAll({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const items = data?.items || [];

  const pendingCount = data?.pending_count ?? 0;
  const pendingTotal = data?.pending_total_kopeks ?? 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AdminBackButton to="/admin" />
          <div>
            <h1 className="text-xl font-semibold text-apple-ink">{t('admin.withdrawals.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.withdrawals.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-amber">{pendingCount}</div>
            <div className="text-sm text-apple-mute">
              {t('admin.withdrawals.overview.pendingCount')}
            </div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-amber">
              {formatWithCurrency(pendingTotal / 100, 0)}
            </div>
            <div className="text-sm text-apple-mute">
              {t('admin.withdrawals.overview.pendingAmount')}
            </div>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-[#F97315] text-white hover:opacity-90'
                : 'bg-apple-elevated text-apple-mute hover:text-apple-ink'
            }`}
          >
            {t(`admin.withdrawals.filter.${filter}`)}
          </button>
        ))}
      </div>

      {/* Withdrawal Cards List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-apple-mute">{t('admin.withdrawals.noData')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: AdminWithdrawalItem) => {
            const badge = getWithdrawalStatusBadge(item.status);
            const riskColor = getRiskColor(item.risk_score);

            return (
              <button
                key={item.id}
                onClick={() => navigate(`/admin/withdrawals/${item.id}`)}
                className="apple-card-grad w-full rounded-2xl bg-apple-card p-4 text-left transition-colors hover:bg-apple-elevated"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* User and amount */}
                    <div className="mb-2 flex items-center gap-2">
                      <span className="truncate font-medium text-apple-ink">
                        {item.username
                          ? `@${item.username}`
                          : item.first_name || `#${item.user_id}`}
                      </span>
                      <span className="font-semibold text-apple-ink">
                        {formatWithCurrency(item.amount_kopeks / 100, 0)}
                      </span>
                    </div>

                    {/* Status badge + Risk score + Date */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${badge.bgColor} ${badge.color}`}
                      >
                        {t(badge.labelKey)}
                      </span>

                      {/* Risk score */}
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${riskColor.bg} ${riskColor.text}`}
                      >
                        {t('admin.withdrawals.risk')} {item.risk_score}
                      </span>

                      {/* Risk level */}
                      <span className="text-xs text-apple-faint">
                        {t(`admin.withdrawals.detail.riskLevel.${item.risk_level}`)}
                      </span>

                      <span className="text-xs text-apple-faint">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Chevron right */}
                  <svg
                    className="mt-1 h-5 w-5 shrink-0 text-apple-faint"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
