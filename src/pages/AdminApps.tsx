import { BackIcon } from '@/components/admin/legacyIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { adminAppsApi } from '../api/adminApps';
import { usePlatform } from '../platform/hooks/usePlatform';

import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

export default function AdminApps() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePlatform();

  // Remnawave status
  const { data: status } = useQuery({
    queryKey: ['remnawave-status'],
    queryFn: adminAppsApi.getRemnaWaveStatus,
    staleTime: 60000,
  });

  // Available configs
  const { data: configs, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['remnawave-configs-list'],
    queryFn: adminAppsApi.listRemnaWaveConfigs,
    staleTime: 30000,
  });

  // Set UUID mutation
  const setUuidMutation = useMutation({
    mutationFn: adminAppsApi.setRemnaWaveUuid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remnawave-status'] });
      queryClient.invalidateQueries({ queryKey: ['remnawave-config'] });
      queryClient.invalidateQueries({ queryKey: ['appConfig'] });
    },
  });

  const currentUuid = status?.config_uuid || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {!capabilities.hasBackButton && (
          <button
            onClick={() => navigate('/admin')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-apple-hairline bg-apple-card transition-colors hover:border-apple-hairline"
          >
            <BackIcon className="h-5 w-5 text-apple-mute" />
          </button>
        )}
        <h1 className="text-2xl font-bold text-apple-ink sm:text-3xl">{t('admin.apps.title')}</h1>
      </div>

      {/* Status card */}
      <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${status?.enabled ? 'bg-apple-green' : 'bg-apple-faint'}`}
          />
          <span className="text-sm font-medium text-apple-ink">
            {status?.enabled
              ? t('admin.apps.remnaWaveConnected', 'Remnawave connected')
              : t('admin.apps.remnaWaveDisconnected', 'Remnawave not connected')}
          </span>
        </div>
        {status?.config_uuid && (
          <div className="mt-2 truncate font-mono text-xs text-apple-faint">
            UUID: {status.config_uuid}
          </div>
        )}
      </div>

      {/* Available configs */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-apple-mute">
          {t('admin.apps.availableConfigs', 'Available configs')}
        </h2>
        {isLoadingConfigs ? (
          <SkeletonGroup className="space-y-3">
            <Skeleton variant="card" count={3} className="h-16" />
          </SkeletonGroup>
        ) : configs && configs.length > 0 ? (
          <div className="space-y-2">
            {configs.map((config) => (
              <button
                key={config.uuid}
                onClick={() => {
                  if (config.uuid !== currentUuid) {
                    setUuidMutation.mutate(config.uuid);
                  }
                }}
                className={`w-full rounded-xl p-4 text-left transition-opacity hover:opacity-90 ${
                  currentUuid === config.uuid
                    ? 'bg-[#F97315]/10 ring-1 ring-inset ring-[#F97315]'
                    : 'bg-apple-elevated'
                }`}
              >
                <div className="font-medium text-apple-ink">{config.name}</div>
                <div className="mt-1 font-mono text-xs text-apple-faint">{config.uuid}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="apple-card-grad rounded-2xl bg-apple-card py-8 text-center text-sm text-apple-faint">
            {t('admin.apps.noConfigs', 'No configs available')}
          </div>
        )}
      </div>
    </div>
  );
}
