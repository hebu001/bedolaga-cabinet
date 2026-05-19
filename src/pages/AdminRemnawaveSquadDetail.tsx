import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminRemnawaveApi, SquadWithLocalInfo } from '../api/adminRemnawave';
import { AdminBackButton } from '../components/admin';
import { ServerIcon, UsersIcon, CheckIcon, XIcon } from '../components/icons';
import Twemoji from 'react-twemoji';
// Country flags helper
const getCountryFlag = (code: string | null | undefined): string => {
  if (!code) return '🌍';
  const codeMap: Record<string, string> = {
    RU: '🇷🇺',
    US: '🇺🇸',
    DE: '🇩🇪',
    NL: '🇳🇱',
    GB: '🇬🇧',
    UK: '🇬🇧',
    FR: '🇫🇷',
    FI: '🇫🇮',
    SE: '🇸🇪',
    NO: '🇳🇴',
    PL: '🇵🇱',
    TR: '🇹🇷',
    JP: '🇯🇵',
    SG: '🇸🇬',
    HK: '🇭🇰',
    KR: '🇰🇷',
    AU: '🇦🇺',
    CA: '🇨🇦',
    CH: '🇨🇭',
    AT: '🇦🇹',
    IT: '🇮🇹',
    ES: '🇪🇸',
    BR: '🇧🇷',
    IN: '🇮🇳',
    AE: '🇦🇪',
    IL: '🇮🇱',
    KZ: '🇰🇿',
    UA: '🇺🇦',
    CZ: '🇨🇿',
    RO: '🇷🇴',
    LV: '🇱🇻',
    LT: '🇱🇹',
    EE: '🇪🇪',
    BG: '🇧🇬',
    HU: '🇭🇺',
    MD: '🇲🇩',
  };
  return codeMap[code.toUpperCase()] || code;
};

export default function AdminRemnawaveSquadDetail() {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  // Fetch all squads and find the one we need
  const {
    data: squadsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-remnawave-squads'],
    queryFn: adminRemnawaveApi.getSquads,
  });

  const squad: SquadWithLocalInfo | undefined = squadsData?.items?.find(
    (s: SquadWithLocalInfo) => s.uuid === uuid,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
      </div>
    );
  }

  if (error || !squad) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <AdminBackButton to="/admin/remnawave" />
          <h1 className="text-xl font-semibold text-apple-ink">
            {t('admin.remnawave.squads.detail', 'Squad Details')}
          </h1>
        </div>
        <div className="rounded-2xl bg-apple-red/10 p-6 text-center">
          <p className="text-apple-red">
            {t('admin.remnawave.squads.loadError', 'Failed to load squad')}
          </p>
          <button
            onClick={() => navigate('/admin/remnawave')}
            className="mt-4 text-sm text-apple-mute hover:text-apple-ink"
          >
            {t('common.back', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AdminBackButton to="/admin/remnawave" />
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getCountryFlag(squad.country_code)}</span>
          <div className="rounded-lg bg-[#F97315]/20 p-2 text-[#F97315]">
            <ServerIcon />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-apple-ink">
            <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}>
              {squad.display_name || squad.name}
            </Twemoji>
          </h1>
          <p className="text-sm text-apple-mute">{squad.name}</p>
        </div>
        {squad.is_synced ? (
          <span className="rounded-full bg-apple-green/15 px-2.5 py-1 text-[11px] font-semibold text-apple-green">
            {t('admin.remnawave.squads.synced', 'Synced')}
          </span>
        ) : (
          <span className="rounded-full bg-apple-amber/15 px-2.5 py-1 text-[11px] font-semibold text-apple-amber">
            {t('admin.remnawave.squads.notSynced', 'Not synced')}
          </span>
        )}
      </div>

      {/* Main Info */}
      <div className="apple-card-grad rounded-2xl bg-apple-card p-4 sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-apple-ink">
          {t('admin.remnawave.squads.info', 'Information')}
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-apple-faint">UUID</p>
            <p className="break-all font-mono text-xs text-apple-ink">{squad.uuid}</p>
          </div>
          <div>
            <p className="text-sm text-apple-faint">
              {t('admin.remnawave.squads.originalName', 'Original Name')}
            </p>
            <p className="text-apple-ink">{squad.name}</p>
          </div>
          <div>
            <p className="text-sm text-apple-faint">
              {t('admin.remnawave.squads.countryCode', 'Country')}
            </p>
            <p className="text-apple-ink">
              {getCountryFlag(squad.country_code)} {squad.country_code || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="apple-card-grad rounded-2xl bg-apple-card p-4 sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-apple-ink">
          {t('admin.remnawave.squads.statsTitle', 'Statistics')}
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-apple-elevated p-4">
            <div className="flex items-center gap-2 text-apple-mute">
              <UsersIcon className="h-4 w-4" />
              <span className="text-sm">{t('admin.remnawave.squads.members', 'Members')}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-apple-ink">{squad.members_count}</p>
          </div>
          <div className="rounded-xl bg-apple-elevated p-4">
            <div className="flex items-center gap-2 text-apple-mute">
              <ServerIcon className="h-4 w-4" />
              <span className="text-sm">{t('admin.remnawave.squads.inbounds', 'Inbounds')}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-apple-ink">{squad.inbounds_count}</p>
          </div>
          {squad.is_synced && (
            <>
              <div className="rounded-xl bg-apple-elevated p-4">
                <div className="flex items-center gap-2 text-apple-mute">
                  <UsersIcon className="h-4 w-4" />
                  <span className="text-sm">{t('admin.remnawave.squads.users', 'Users')}</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-apple-ink">
                  {squad.current_users ?? 0}
                  <span className="text-sm font-normal text-apple-mute">
                    {' '}
                    / {squad.max_users ?? '∞'}
                  </span>
                </p>
              </div>
              <div className="rounded-xl bg-apple-elevated p-4">
                <div className="flex items-center gap-2 text-apple-mute">
                  <span className="text-sm">{t('admin.remnawave.squads.price', 'Price')}</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-apple-ink">
                  {((squad.price_kopeks ?? 0) / 100).toFixed(0)} ₽
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Local Settings (if synced) */}
      {squad.is_synced && (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold text-apple-ink">
            {t('admin.remnawave.squads.localSettings', 'Local Settings')}
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl bg-apple-elevated p-4">
              <div
                className={`rounded-lg p-2 ${
                  squad.is_available
                    ? 'bg-apple-green/15 text-apple-green'
                    : 'bg-apple-red/15 text-apple-red'
                }`}
              >
                {squad.is_available ? <CheckIcon /> : <XIcon />}
              </div>
              <div>
                <p className="text-sm text-apple-mute">
                  {t('admin.remnawave.squads.available', 'Available')}
                </p>
                <p className={squad.is_available ? 'text-apple-green' : 'text-apple-red'}>
                  {squad.is_available ? t('common.yes', 'Yes') : t('common.no', 'No')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-apple-elevated p-4">
              <div
                className={`rounded-lg p-2 ${
                  squad.is_trial_eligible
                    ? 'bg-apple-green/15 text-apple-green'
                    : 'bg-apple-card text-apple-mute'
                }`}
              >
                {squad.is_trial_eligible ? <CheckIcon /> : <XIcon />}
              </div>
              <div>
                <p className="text-sm text-apple-mute">
                  {t('admin.remnawave.squads.trialEligible', 'Trial Eligible')}
                </p>
                <p className={squad.is_trial_eligible ? 'text-apple-green' : 'text-apple-mute'}>
                  {squad.is_trial_eligible ? t('common.yes', 'Yes') : t('common.no', 'No')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inbounds */}
      {squad.inbounds.length > 0 && (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold text-apple-ink">
            {t('admin.remnawave.squads.inboundsList', 'Inbounds')}
          </h3>
          <div className="space-y-2">
            {squad.inbounds.map((inbound: Record<string, unknown>, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-apple-elevated px-4 py-3"
              >
                <span className="text-sm text-apple-ink">
                  {String(inbound.tag || inbound.uuid || `Inbound ${idx + 1}`)}
                </span>
                {typeof inbound.type === 'string' && (
                  <span className="rounded bg-apple-card px-2 py-1 text-xs text-apple-mute">
                    {inbound.type}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate('/admin/remnawave')}
          className="rounded-full bg-apple-elevated px-4 py-2 text-sm text-apple-ink transition-colors hover:opacity-90"
        >
          {t('common.back', 'Back')}
        </button>
      </div>
    </div>
  );
}
