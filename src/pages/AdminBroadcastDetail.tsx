import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminBroadcastsApi, type BroadcastChannel } from '../api/adminBroadcasts';
import { AdminBackButton } from '../components/admin';
import {
  BroadcastDeliveryStats,
  BroadcastStatusBadge,
} from '../components/broadcasts/BroadcastDeliveryStats';
import { broadcastPollInterval, isBroadcastInFlight } from '../utils/broadcastStatus';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import {
  DocumentIcon,
  EmailIcon,
  PhotoIcon,
  RefreshIcon,
  StopIcon,
  TelegramIcon,
  VideoIcon,
} from '@/components/icons';

// Channel badge component
function ChannelBadge({ channel }: { channel?: BroadcastChannel }) {
  if (!channel || channel === 'telegram') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-apple-blue/15 px-2 py-0.5 text-xs text-apple-blue">
        <TelegramIcon />
        <span className="hidden sm:inline">Telegram</span>
      </span>
    );
  }

  if (channel === 'email') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-apple-elevated px-2 py-0.5 text-xs text-apple-mute">
        <EmailIcon />
        <span className="hidden sm:inline">Email</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-full bg-apple-green/15 px-2 py-0.5 text-xs text-apple-green">
      <TelegramIcon />
      <span className="mx-0.5">+</span>
      <EmailIcon />
    </span>
  );
}

export default function AdminBroadcastDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const broadcastId = id ? parseInt(id, 10) : null;

  // Fetch broadcast details
  const {
    data: broadcast,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'broadcasts', 'detail', broadcastId],
    queryFn: async () => {
      if (!broadcastId) throw new Error('Invalid broadcast ID');
      return adminBroadcastsApi.get(broadcastId);
    },
    enabled: !!broadcastId && !isNaN(broadcastId),
    refetchInterval: (query) => broadcastPollInterval(query.state.data?.status),
  });

  // Stop mutation
  const stopMutation = useMutation({
    mutationFn: adminBroadcastsApi.stop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });
      refetch();
    },
  });

  const isRunning = broadcast && isBroadcastInFlight(broadcast.status);

  if (!broadcastId || isNaN(broadcastId)) {
    navigate('/admin/broadcasts');
    return null;
  }

  if (isLoading) {
    return (
      <PageSkeleton variant="admin" leading={1} titleWidth="w-56" className="space-y-6">
        <Skeleton variant="card" count={2} className="h-40" />
      </PageSkeleton>
    );
  }

  if (!broadcast) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-apple-mute">{t('admin.broadcasts.notFound')}</p>
        <button
          onClick={() => navigate('/admin/broadcasts')}
          className="rounded-full bg-[#F97315] px-4 py-2 text-white transition-opacity hover:opacity-90"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          <AdminBackButton to="/admin/broadcasts" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-bold text-apple-ink">
                {t('admin.broadcasts.detail')} #{broadcast.id}
              </h1>
              <BroadcastStatusBadge status={broadcast.status} />
              <ChannelBadge channel={broadcast.channel} />
            </div>
            <p className="text-sm text-apple-mute">
              {new Date(broadcast.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-lg p-2 transition-colors hover:bg-apple-elevated"
        >
          <RefreshIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Progress + stats */}
      <BroadcastDeliveryStats
        status={broadcast.status}
        progressPercent={broadcast.progress_percent}
        totalCount={broadcast.total_count}
        sentCount={broadcast.sent_count}
        blockedCount={broadcast.blocked_count}
        failedCount={broadcast.failed_count}
      />

      {/* Target */}
      <div className="rounded-2xl bg-apple-card p-4">
        <p className="mb-1 text-sm text-apple-mute">{t('admin.broadcasts.filter')}</p>
        <p className="font-medium text-apple-ink">{broadcast.target_type}</p>
      </div>

      {/* Telegram Message */}
      {broadcast.message_text && (
        <div className="rounded-2xl bg-apple-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm text-apple-mute">
            <TelegramIcon />
            {t('admin.broadcasts.message')}
          </p>
          <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg bg-apple-elevated p-4 text-apple-ink">
            {broadcast.message_text}
          </div>
        </div>
      )}

      {/* Email Subject */}
      {broadcast.email_subject && (
        <div className="rounded-2xl bg-apple-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm text-apple-mute">
            <EmailIcon />
            {t('admin.broadcasts.emailSubject')}
          </p>
          <div className="rounded-lg bg-apple-elevated p-4 text-apple-ink">
            {broadcast.email_subject}
          </div>
        </div>
      )}

      {/* Email Content */}
      {broadcast.email_html_content && (
        <div className="rounded-2xl bg-apple-card p-4">
          <p className="mb-2 text-sm text-apple-mute">{t('admin.broadcasts.emailContent')}</p>
          <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg bg-apple-elevated p-4 font-mono text-xs text-apple-ink">
            {broadcast.email_html_content}
          </div>
        </div>
      )}

      {/* Media */}
      {broadcast.has_media && (
        <div className="rounded-2xl bg-apple-card p-4">
          <p className="mb-2 text-sm text-apple-mute">{t('admin.broadcasts.media')}</p>
          <div className="flex items-center gap-3 text-apple-ink">
            {broadcast.media_type === 'photo' && <PhotoIcon />}
            {broadcast.media_type === 'video' && <VideoIcon />}
            {broadcast.media_type === 'document' && <DocumentIcon />}
            <span className="capitalize">{broadcast.media_type}</span>
          </div>
        </div>
      )}

      {/* Admin info */}
      <div className="flex justify-between rounded-2xl bg-apple-card p-4 text-sm">
        <span className="text-apple-mute">
          {t('admin.broadcasts.createdBy')}:{' '}
          <span className="text-apple-ink">
            {broadcast.admin_name || t('admin.broadcasts.unknownAdmin')}
          </span>
        </span>
        <span className="whitespace-nowrap text-apple-mute">
          {new Date(broadcast.created_at).toLocaleString()}
        </span>
      </div>

      {/* Stop button */}
      {isRunning && broadcast.status !== 'cancelling' && (
        <button
          onClick={() => stopMutation.mutate(broadcast.id)}
          disabled={stopMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-apple-red/15 px-4 py-2 text-sm text-apple-red transition-colors hover:bg-apple-red/25 disabled:opacity-50"
        >
          <StopIcon />
          {stopMutation.isPending ? t('admin.broadcasts.stopping') : t('admin.broadcasts.stop')}
        </button>
      )}
    </div>
  );
}
