import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminBroadcastsApi } from '../api/adminBroadcasts';
import { usePlatform } from '../platform/hooks/usePlatform';
import {
  BackIcon,
  BroadcastIcon,
  DocumentIcon,
  PhotoIcon,
  PlusIcon,
  RefreshIcon,
  VideoIcon,
} from '@/components/icons';

// Status badge component
const statusConfig: Record<string, { bg: string; text: string; labelKey: string }> = {
  queued: {
    bg: 'bg-apple-amber/15',
    text: 'text-apple-amber',
    labelKey: 'admin.broadcasts.status.queued',
  },
  in_progress: {
    bg: 'bg-apple-blue/15',
    text: 'text-apple-blue',
    labelKey: 'admin.broadcasts.status.inProgress',
  },
  completed: {
    bg: 'bg-apple-green/15',
    text: 'text-apple-green',
    labelKey: 'admin.broadcasts.status.completed',
  },
  partial: {
    bg: 'bg-apple-amber/15',
    text: 'text-apple-amber',
    labelKey: 'admin.broadcasts.status.partial',
  },
  failed: {
    bg: 'bg-apple-red/15',
    text: 'text-apple-red',
    labelKey: 'admin.broadcasts.status.failed',
  },
  cancelled: {
    bg: 'bg-apple-elevated',
    text: 'text-apple-mute',
    labelKey: 'admin.broadcasts.status.cancelled',
  },
  cancelling: {
    bg: 'bg-apple-amber/15',
    text: 'text-apple-amber',
    labelKey: 'admin.broadcasts.status.cancelling',
  },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config = statusConfig[status] || statusConfig.queued;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.bg} ${config.text}`}
    >
      {t(config.labelKey)}
    </span>
  );
}

// Main component
export default function AdminBroadcasts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { capabilities } = usePlatform();

  const [page, setPage] = useState(0);
  const limit = 20;

  // Fetch broadcasts
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'broadcasts', 'list', page],
    queryFn: () => adminBroadcastsApi.list(limit, page * limit),
    refetchInterval: (query) => {
      const items = query.state.data?.items;
      const hasActive = items?.some((b: { status: string }) =>
        ['queued', 'in_progress', 'cancelling'].includes(b.status),
      );
      return hasActive ? 5000 : false;
    },
  });

  // Аудитория хранится ключом фильтра (active_zero, custom_inactive_month) — людям
  // показываем подпись из того же справочника, что у формы создания.
  const { data: tgFilters } = useQuery({
    queryKey: ['admin', 'broadcasts', 'filters'],
    queryFn: adminBroadcastsApi.getFilters,
    staleTime: 5 * 60 * 1000,
  });
  const { data: emailFilters } = useQuery({
    queryKey: ['admin', 'broadcasts', 'email-filters'],
    queryFn: adminBroadcastsApi.getEmailFilters,
    staleTime: 5 * 60 * 1000,
  });
  const audienceLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const filter of [
      ...(emailFilters?.filters ?? []),
      ...(emailFilters?.promo_group_filters ?? []),
      ...(tgFilters?.filters ?? []),
      ...(tgFilters?.tariff_filters ?? []),
      ...(tgFilters?.custom_filters ?? []),
    ]) {
      labels.set(filter.key, filter.label);
    }
    return labels;
  }, [tgFilters, emailFilters]);

  const broadcasts = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-card transition-opacity hover:opacity-90"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-apple-ink">{t('admin.broadcasts.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.broadcasts.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-apple-card p-2 text-apple-mute transition-colors hover:text-apple-ink"
          >
            <RefreshIcon />
          </button>
          <button
            onClick={() => navigate('/admin/broadcasts/create')}
            className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-white transition-opacity hover:opacity-90"
          >
            <PlusIcon />
            <span className="hidden sm:inline">{t('admin.broadcasts.create')}</span>
          </button>
        </div>
      </div>

      {/* Broadcasts list */}
      {isLoading ? (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-8 text-center text-apple-mute">
          <RefreshIcon />
          <p className="mt-2">{t('common.loading')}</p>
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-8 text-center text-apple-mute">
          <BroadcastIcon className="h-6 w-6" />
          <p className="mt-2">{t('admin.broadcasts.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((broadcast) => (
            <button
              key={broadcast.id}
              onClick={() => navigate(`/admin/broadcasts/${broadcast.id}`)}
              className="apple-card-grad w-full rounded-2xl bg-apple-card p-4 text-left transition-opacity hover:opacity-90"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <StatusBadge status={broadcast.status} />
                    <span className="text-xs text-apple-mute">#{broadcast.id}</span>
                    {broadcast.has_media && (
                      <span className="text-apple-mute">
                        {broadcast.media_type === 'photo' && <PhotoIcon />}
                        {broadcast.media_type === 'video' && <VideoIcon />}
                        {broadcast.media_type === 'document' && <DocumentIcon />}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-apple-ink">{broadcast.message_text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-apple-mute">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {audienceLabels.get(broadcast.target_type) ??
                        (/^user_\d+$/.test(broadcast.target_type)
                          ? t('admin.broadcasts.singleUser', {
                              name: `#${broadcast.target_type.slice('user_'.length)}`,
                            })
                          : broadcast.target_type)}
                    </span>
                    <span>
                      {broadcast.sent_count}/{broadcast.total_count}
                      {broadcast.blocked_count > 0 && (
                        <span className="text-apple-amber">
                          {' '}
                          ({broadcast.blocked_count} {t('admin.broadcasts.blockedShort')})
                        </span>
                      )}
                    </span>
                    <span>{new Date(broadcast.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {['queued', 'in_progress'].includes(broadcast.status) && (
                  <div className="w-16">
                    <div className="h-1.5 overflow-hidden rounded-full bg-apple-elevated">
                      <div
                        className="h-full bg-[#F97315]"
                        style={{ width: `${broadcast.progress_percent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-center text-xs text-apple-mute">
                      {broadcast.progress_percent.toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="apple-card-grad flex items-center justify-center gap-2 rounded-2xl bg-apple-card p-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg bg-apple-elevated px-3 py-1 text-apple-mute transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('admin.broadcasts.prev')}
          </button>
          <span className="text-apple-mute">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-lg bg-apple-elevated px-3 py-1 text-apple-mute transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('admin.broadcasts.next')}
          </button>
        </div>
      )}
    </div>
  );
}
