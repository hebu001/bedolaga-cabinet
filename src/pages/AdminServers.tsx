import {
CheckIcon,
EditIcon,
GiftIcon,
SyncIcon,
UsersIcon,
XIcon,
} from '@/components/admin/legacyIcons';
import { BackIcon } from '@/components/admin/legacyPageIcons/AdminServers';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { serversApi,type ServerListItem } from '../api/servers';

import Twemoji from 'react-twemoji';
import { usePlatform } from '../platform/hooks/usePlatform';

// Country flags (simple emoji mapping)
import { Skeleton,SkeletonGroup } from '../components/ui/skeleton';
import { getFlagEmoji as getCountryFlag } from '../utils/subscriptionHelpers';

export default function AdminServers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePlatform();

  // Queries
  const { data: serversData, isLoading } = useQuery({
    queryKey: ['admin-servers'],
    queryFn: () => serversApi.getServers(true),
  });

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: serversApi.toggleServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
    },
  });

  const toggleTrialMutation = useMutation({
    mutationFn: serversApi.toggleTrial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: serversApi.syncServers,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      alert(result.message);
    },
  });

  const servers = serversData?.servers || [];

  return (
    <div className="animate-fade-in font-sans text-apple-ink">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
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
            <h1 className="text-xl font-semibold text-apple-ink">{t('admin.servers.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.servers.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <SyncIcon />
          {syncMutation.isPending ? t('admin.servers.syncing') : t('admin.servers.sync')}
        </button>
      </div>

      {/* Servers List */}
      {isLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : servers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-apple-mute">{t('admin.servers.noServers')}</p>
          <button
            onClick={() => syncMutation.mutate()}
            className="mt-4 transition-opacity hover:opacity-80"
            style={{ color: '#F97315' }}
          >
            {t('admin.servers.syncNow')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server: ServerListItem) => (
            <div
              key={server.id}
              className={`apple-card-grad rounded-2xl bg-apple-card p-4 transition-opacity ${
                server.is_available ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-lg">{getCountryFlag(server.country_code)}</span>
                    <h3 className="min-w-0 font-medium text-apple-ink [overflow-wrap:anywhere]">
                      <Twemoji
                        tag="span"
                        options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}
                      >
                        {server.display_name}
                      </Twemoji>
                    </h3>
                    {server.is_trial_eligible && (
                      <span className="rounded bg-apple-green/15 px-2 py-0.5 text-xs text-apple-green">
                        {t('admin.servers.trial')}
                      </span>
                    )}
                    {!server.is_available && (
                      <span className="rounded bg-apple-elevated px-2 py-0.5 text-xs text-apple-mute">
                        {t('admin.servers.unavailable')}
                      </span>
                    )}
                    {server.is_full && (
                      <span className="rounded bg-apple-amber/15 px-2 py-0.5 text-xs text-apple-amber">
                        {t('admin.servers.full')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-apple-mute">
                    <span className="flex items-center gap-1">
                      <UsersIcon className="h-4 w-4" />
                      {server.current_users}
                      {server.max_users ? ` / ${server.max_users}` : ''}
                    </span>
                    <span>
                      {server.price_rubles}
                      {'\u00A0'}₽
                    </span>
                    <span className="max-w-[200px] truncate font-mono text-xs text-apple-faint">
                      {server.squad_uuid}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-apple-hairline pt-3 sm:border-0 sm:pt-0">
                  {/* Toggle Available */}
                  <button
                    onClick={() => toggleMutation.mutate(server.id)}
                    className={`flex flex-1 justify-center rounded-lg p-2 transition-colors sm:flex-none ${
                      server.is_available
                        ? 'bg-apple-red/15 text-apple-red'
                        : 'bg-apple-green/15 text-apple-green'
                    }`}
                    title={
                      server.is_available ? t('admin.servers.disable') : t('admin.servers.enable')
                    }
                  >
                    {server.is_available ? <XIcon /> : <CheckIcon />}
                  </button>

                  {/* Toggle Trial */}
                  <button
                    onClick={() => toggleTrialMutation.mutate(server.id)}
                    className={`flex flex-1 justify-center rounded-lg p-2 transition-colors sm:flex-none ${
                      server.is_trial_eligible
                        ? 'bg-apple-amber/15 text-apple-amber'
                        : 'bg-apple-elevated text-apple-mute'
                    }`}
                    title={t('admin.servers.toggleTrial')}
                  >
                    <GiftIcon />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => navigate(`/admin/servers/${server.id}/edit`)}
                    className="rounded-lg bg-apple-elevated p-2 text-apple-mute transition-colors hover:text-apple-ink"
                    title={t('admin.servers.edit')}
                  >
                    <EditIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
