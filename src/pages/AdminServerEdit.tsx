import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { serversApi, ServerUpdateRequest } from '../api/servers';
import { AdminBackButton } from '../components/admin';
import { ServerIcon } from '../components/icons';
import { createNumberInputHandler, toNumber } from '../utils/inputHelpers';
import Twemoji from 'react-twemoji';

// Country flags (simple emoji mapping)
const getCountryFlag = (code: string | null): string => {
  if (!code) return '';
  const codeMap: Record<string, string> = {
    RU: '🇷🇺',
    US: '🇺🇸',
    DE: '🇩🇪',
    NL: '🇳🇱',
    GB: '🇬🇧',
    FR: '🇫🇷',
    FI: '🇫🇮',
    SE: '🇸🇪',
    PL: '🇵🇱',
    CZ: '🇨🇿',
    AT: '🇦🇹',
    CH: '🇨🇭',
    UA: '🇺🇦',
    KZ: '🇰🇿',
    JP: '🇯🇵',
    KR: '🇰🇷',
    SG: '🇸🇬',
    HK: '🇭🇰',
    CA: '🇨🇦',
    AU: '🇦🇺',
    BR: '🇧🇷',
    IN: '🇮🇳',
    TR: '🇹🇷',
    IL: '🇮🇱',
    AE: '🇦🇪',
  };
  return codeMap[code.toUpperCase()] || code;
};

export default function AdminServerEdit() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const serverId = parseInt(id || '0');

  const {
    data: server,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-server', serverId],
    queryFn: () => serversApi.getServer(serverId),
    enabled: serverId > 0,
  });

  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [priceKopeks, setPriceKopeks] = useState<number | ''>(0);
  const [maxUsers, setMaxUsers] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<number | ''>(0);

  useEffect(() => {
    if (server) {
      setDisplayName(server.display_name);
      setDescription(server.description || '');
      setCountryCode(server.country_code || '');
      setPriceKopeks(server.price_kopeks);
      setMaxUsers(server.max_users);
      setSortOrder(server.sort_order);
    }
  }, [server]);

  const updateMutation = useMutation({
    mutationFn: (data: ServerUpdateRequest) => serversApi.updateServer(serverId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-server', serverId] });
      navigate('/admin/servers');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: ServerUpdateRequest = {
      display_name: displayName,
      description: description || undefined,
      country_code: countryCode || undefined,
      price_kopeks: toNumber(priceKopeks),
      max_users: maxUsers || undefined,
      sort_order: toNumber(sortOrder),
    };
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <AdminBackButton to="/admin/servers" />
          <h1 className="text-xl font-semibold text-apple-ink">{t('admin.servers.edit')}</h1>
        </div>
        <div className="rounded-2xl bg-apple-red/10 p-6 text-center">
          <p className="text-apple-red">{t('admin.servers.loadError')}</p>
          <button
            onClick={() => navigate('/admin/servers')}
            className="mt-4 text-sm text-apple-mute hover:text-apple-ink"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <AdminBackButton to="/admin/servers" />
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getCountryFlag(server.country_code)}</span>
          <div className="rounded-lg bg-[#F97315]/20 p-2" style={{ color: '#F97315' }}>
            <ServerIcon />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-apple-ink">{t('admin.servers.edit')}</h1>
          <p className="text-sm text-apple-mute">
            <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}>
              {server.display_name}
            </Twemoji>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Settings */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
          <h3 className="mb-4 text-lg font-semibold text-apple-ink">
            {t('admin.servers.mainSettings')}
          </h3>

          {/* Original Name (readonly) */}
          <div className="mb-4">
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.servers.originalName')}
            </label>
            <div className="rounded-xl bg-apple-elevated px-4 py-3 text-apple-mute">
              {server.original_name || server.squad_uuid}
            </div>
          </div>

          {/* Display Name */}
          <div className="mb-4">
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.servers.displayName')}
              <span className="text-apple-red">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 ${displayName.length > 0 && !displayName.trim() ? 'ring-2 ring-apple-red/50' : ''}`}
              placeholder={t('admin.servers.displayNamePlaceholder')}
              maxLength={255}
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.servers.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              rows={2}
              placeholder={t('admin.servers.descriptionPlaceholder')}
            />
          </div>

          {/* Country Code */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.servers.countryCode')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                className="w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                placeholder="RU"
                maxLength={2}
              />
              {countryCode && <span className="text-xl">{getCountryFlag(countryCode)}</span>}
            </div>
          </div>
        </div>

        {/* Pricing & Limits */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
          <h3 className="mb-4 text-lg font-semibold text-apple-ink">
            {t('admin.servers.pricingAndLimits')}
          </h3>

          {/* Price */}
          <div className="mb-4">
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.servers.price')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={priceKopeks === '' ? '' : priceKopeks / 100}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setPriceKopeks('');
                  } else {
                    setPriceKopeks(Math.max(0, parseFloat(val) || 0) * 100);
                  }
                }}
                className="w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                min={0}
                step={1}
              />
              <span className="text-apple-mute">₽</span>
            </div>
            <p className="mt-1 text-xs text-apple-faint">{t('admin.servers.priceHint')}</p>
          </div>

          {/* Max Users */}
          <div className="mb-4">
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.servers.maxUsers')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={maxUsers || ''}
                onChange={(e) =>
                  setMaxUsers(e.target.value ? Math.max(0, parseInt(e.target.value)) : null)
                }
                className="w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                min={0}
                placeholder={t('admin.servers.unlimited')}
              />
              {!maxUsers && (
                <span className="text-sm text-apple-mute">{t('admin.servers.unlimited')}</span>
              )}
            </div>
          </div>

          {/* Sort Order */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.servers.sortOrder')}
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={createNumberInputHandler(setSortOrder)}
              className="w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
          <h3 className="mb-4 text-lg font-semibold text-apple-ink">{t('admin.servers.stats')}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-apple-elevated p-3">
              <div className="text-2xl font-bold text-apple-ink">{server.current_users}</div>
              <div className="text-sm text-apple-mute">{t('admin.servers.currentUsers')}</div>
            </div>
            <div className="rounded-xl bg-apple-elevated p-3">
              <div className="text-2xl font-bold text-apple-ink">{server.active_subscriptions}</div>
              <div className="text-sm text-apple-mute">
                {t('admin.servers.activeSubscriptions')}
              </div>
            </div>
          </div>
          {server.tariffs_using.length > 0 && (
            <div className="mt-4">
              <span className="text-sm text-apple-mute">{t('admin.servers.usedByTariffs')}:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {server.tariffs_using.map((tariff) => (
                  <span
                    key={tariff}
                    className="rounded-lg bg-apple-elevated px-3 py-1 text-sm text-apple-mute"
                  >
                    {tariff}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/servers')}
            className="rounded-full bg-apple-elevated px-5 py-2.5 text-[14px] font-semibold text-apple-ink transition-opacity hover:opacity-90"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!displayName || updateMutation.isPending}
            className="rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t('common.saving')}
              </span>
            ) : (
              t('common.save')
            )}
          </button>
        </div>

        {updateMutation.isError && (
          <div className="rounded-xl bg-apple-red/10 p-3 text-sm text-apple-red">
            {t('admin.servers.updateError')}
          </div>
        )}
      </form>
    </div>
  );
}
