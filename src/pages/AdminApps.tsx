import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminAppsApi } from '../api/adminApps';
import { usePlatform } from '../platform/hooks/usePlatform';

export default function AdminApps() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePlatform();

  // RemnaWave status
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
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-elevated transition-opacity hover:opacity-90"
          >
            <svg
              className="h-5 w-5 text-apple-mute"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
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
              ? t('admin.apps.remnaWaveConnected', 'RemnaWave connected')
              : t('admin.apps.remnaWaveDisconnected', 'RemnaWave not connected')}
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
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
          </div>
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
