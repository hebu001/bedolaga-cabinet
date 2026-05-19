import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  campaignsApi,
  CampaignUpdateRequest,
  CampaignBonusType,
  ServerSquadInfo,
  TariffListItem,
  AvailablePartner,
} from '../api/campaigns';
import { AdminBackButton } from '../components/admin';
import { CheckIcon, CampaignIcon } from '../components/icons';
import { createNumberInputHandler, toNumber } from '../utils/inputHelpers';
import Twemoji from 'react-twemoji';

// Bonus type config
const bonusTypeConfig: Record<
  CampaignBonusType,
  { labelKey: string; color: string; bgColor: string }
> = {
  balance: {
    labelKey: 'admin.campaigns.bonusType.balance',
    color: 'text-apple-green',
    bgColor: 'bg-apple-green/10',
  },
  subscription: {
    labelKey: 'admin.campaigns.bonusType.subscription',
    color: 'text-[#F97315]',
    bgColor: 'bg-[#F97315]/10',
  },
  tariff: {
    labelKey: 'admin.campaigns.bonusType.tariff',
    color: 'text-[#F97315]',
    bgColor: 'bg-[#F97315]/10',
  },
  none: {
    labelKey: 'admin.campaigns.bonusType.none',
    color: 'text-apple-mute',
    bgColor: 'bg-apple-elevated',
  },
};

// Server selector component
function ServerSelector({
  servers,
  selected,
  onToggle,
}: {
  servers: ServerSquadInfo[];
  selected: string[];
  onToggle: (uuid: string) => void;
}) {
  const { t } = useTranslation();

  if (servers.length === 0) return null;

  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-apple-mute">
        {t('admin.campaigns.form.servers')}
      </label>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-apple-elevated p-3">
        {servers.map((server) => (
          <button
            key={server.id}
            type="button"
            onClick={() => onToggle(server.squad_uuid)}
            className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
              selected.includes(server.squad_uuid)
                ? 'bg-[#F97315]/20 text-[#F97315]'
                : 'bg-apple-card text-apple-mute hover:bg-apple-elevated'
            }`}
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded ${
                selected.includes(server.squad_uuid)
                  ? 'bg-[#F97315] text-white'
                  : 'bg-apple-elevated'
              }`}
            >
              {selected.includes(server.squad_uuid) && <CheckIcon />}
            </div>
            <span className="text-sm font-medium">
              <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}>
                {server.display_name}
              </Twemoji>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Tariff selector component
function TariffSelector({
  tariffs,
  value,
  onChange,
}: {
  tariffs: TariffListItem[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-apple-mute">
        {t('admin.campaigns.form.selectTariff')}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none focus:ring-2 focus:ring-[#F97315]/50"
      >
        <option value="">{t('admin.campaigns.form.notSelected')}</option>
        {tariffs.map((tariff) => (
          <option key={tariff.id} value={tariff.id}>
            {tariff.name} ({tariff.traffic_limit_gb} GB, {tariff.device_limit}{' '}
            {t('admin.campaigns.form.devices')})
          </option>
        ))}
      </select>
    </div>
  );
}

// Partner selector component
function PartnerSelector({
  partners,
  value,
  onChange,
}: {
  partners: AvailablePartner[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-apple-mute">
        {t('admin.campaigns.form.partner')}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none focus:ring-2 focus:ring-[#F97315]/50"
      >
        <option value="">{t('admin.campaigns.form.noPartner')}</option>
        {partners.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.first_name || p.username || `#${p.user_id}`}
            {p.username ? ` (@${p.username})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminCampaignEdit() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const campaignId = parseInt(id || '0');

  // Fetch campaign
  const {
    data: campaign,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-campaign', campaignId],
    queryFn: () => campaignsApi.getCampaign(campaignId),
    enabled: campaignId > 0,
  });

  // Fetch servers
  const { data: servers = [] } = useQuery({
    queryKey: ['admin-campaigns-servers'],
    queryFn: () => campaignsApi.getAvailableServers(),
  });

  // Fetch tariffs
  const { data: tariffs = [] } = useQuery({
    queryKey: ['admin-campaigns-tariffs'],
    queryFn: () => campaignsApi.getAvailableTariffs(),
  });

  // Fetch partners
  const { data: partners = [] } = useQuery({
    queryKey: ['admin-campaigns-partners'],
    queryFn: () => campaignsApi.getAvailablePartners(),
  });

  // Form state
  const [name, setName] = useState('');
  const [startParameter, setStartParameter] = useState('');
  const [bonusType, setBonusType] = useState<CampaignBonusType>('balance');
  const [isActive, setIsActive] = useState(true);

  // Balance bonus
  const [balanceBonusRubles, setBalanceBonusRubles] = useState<number | ''>(0);

  // Subscription bonus
  const [subscriptionDays, setSubscriptionDays] = useState<number | ''>(7);
  const [subscriptionTraffic, setSubscriptionTraffic] = useState<number | ''>(10);
  const [subscriptionDevices, setSubscriptionDevices] = useState<number | ''>(1);
  const [selectedSquads, setSelectedSquads] = useState<string[]>([]);

  // Tariff bonus
  const [tariffId, setTariffId] = useState<number | null>(null);
  const [tariffDays, setTariffDays] = useState<number | ''>(30);

  // Partner
  const [partnerUserId, setPartnerUserId] = useState<number | null>(null);
  const [initialPartnerUserId, setInitialPartnerUserId] = useState<number | null>(null);

  // Initialize form when campaign loads
  useEffect(() => {
    if (campaign) {
      setName(campaign.name || '');
      setStartParameter(campaign.start_parameter || '');
      setBonusType(campaign.bonus_type || 'balance');
      setIsActive(campaign.is_active ?? true);
      setBalanceBonusRubles((campaign.balance_bonus_kopeks || 0) / 100);
      setSubscriptionDays(campaign.subscription_duration_days || 7);
      setSubscriptionTraffic(campaign.subscription_traffic_gb || 10);
      setSubscriptionDevices(campaign.subscription_device_limit || 1);
      setSelectedSquads(campaign.subscription_squads || []);
      setTariffId(campaign.tariff_id || null);
      setTariffDays(campaign.tariff_duration_days || 30);
      setPartnerUserId(campaign.partner_user_id ?? null);
      setInitialPartnerUserId(campaign.partner_user_id ?? null);
    }
  }, [campaign]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CampaignUpdateRequest) => campaignsApi.updateCampaign(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaign', campaignId] });
      navigate('/admin/campaigns');
    },
  });

  const toggleServer = (uuid: string) => {
    setSelectedSquads((prev) =>
      prev.includes(uuid) ? prev.filter((s) => s !== uuid) : [...prev, uuid],
    );
  };

  const handleSubmit = () => {
    const data: CampaignUpdateRequest = {
      name,
      start_parameter: startParameter,
      bonus_type: bonusType,
      is_active: isActive,
    };

    // Only send partner_user_id when it was actually changed
    if (partnerUserId !== initialPartnerUserId) {
      data.partner_user_id = partnerUserId;
    }

    if (bonusType === 'balance') {
      data.balance_bonus_kopeks = Math.round(toNumber(balanceBonusRubles) * 100);
    } else if (bonusType === 'subscription') {
      data.subscription_duration_days = toNumber(subscriptionDays, 7);
      data.subscription_traffic_gb = toNumber(subscriptionTraffic, 10);
      data.subscription_device_limit = toNumber(subscriptionDevices, 1);
      data.subscription_squads = selectedSquads;
    } else if (bonusType === 'tariff') {
      data.tariff_id = tariffId || undefined;
      data.tariff_duration_days = toNumber(tariffDays, 30);
    }

    updateMutation.mutate(data);
  };

  const isNameValid = name.trim().length > 0;
  const isStartParamValid =
    startParameter.trim().length > 0 && /^[a-zA-Z0-9_-]+$/.test(startParameter);
  const isValid = isNameValid && isStartParamValid;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <AdminBackButton to="/admin/campaigns" />
          <h1 className="text-xl font-semibold text-apple-ink">
            {t('admin.campaigns.modal.editTitle')}
          </h1>
        </div>
        <div className="rounded-2xl bg-apple-red/10 p-6 text-center">
          <p className="text-apple-red">{t('admin.campaigns.loadError')}</p>
          <button
            onClick={() => navigate('/admin/campaigns')}
            className="mt-4 text-sm text-apple-mute hover:text-apple-ink"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AdminBackButton to="/admin/campaigns" />
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#F97315]/20 p-2 text-[#F97315]">
            <CampaignIcon />
          </div>
          <div>
            <h1 className="text-xl font-bold text-apple-ink">
              {t('admin.campaigns.modal.editTitle')}
            </h1>
            <p className="text-sm text-apple-mute">{campaign.name}</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-5">
        {/* Name */}
        <div>
          <label className="mb-2 block text-[13px] font-medium text-apple-mute">
            {t('admin.campaigns.form.name')}
            <span className="text-apple-red">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 ${name.length > 0 && !isNameValid ? 'ring-2 ring-apple-red/50' : ''}`}
            placeholder={t('admin.campaigns.form.namePlaceholder')}
            maxLength={255}
          />
          {name.length > 0 && !isNameValid && (
            <p className="mt-1 text-xs text-apple-red">
              {t('admin.campaigns.validation.nameRequired')}
            </p>
          )}
        </div>

        {/* Start Parameter */}
        <div>
          <label className="mb-2 block text-[13px] font-medium text-apple-mute">
            {t('admin.campaigns.form.startParameter')}
            <span className="text-apple-red">*</span>
          </label>
          <input
            type="text"
            value={startParameter}
            onChange={(e) => setStartParameter(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            className={`w-full rounded-xl bg-apple-elevated px-4 py-3 font-mono text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 ${startParameter.length > 0 && !isStartParamValid ? 'ring-2 ring-apple-red/50' : ''}`}
            placeholder="instagram_jan2024"
            maxLength={100}
          />
          <p className="mt-1 text-xs text-apple-faint">
            {t('admin.campaigns.form.startParameterHint')}
          </p>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between rounded-xl bg-apple-elevated p-4">
          <span className="text-sm font-medium text-apple-mute">
            {t('admin.campaigns.form.active')}
          </span>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isActive ? 'bg-[#F97315]' : 'bg-apple-card'
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                isActive ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Partner */}
        {partners.length > 0 && (
          <PartnerSelector partners={partners} value={partnerUserId} onChange={setPartnerUserId} />
        )}
      </div>

      {/* Bonus Type */}
      <div className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-5">
        <h2 className="text-lg font-semibold text-apple-ink">
          {t('admin.campaigns.form.bonusType')}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(bonusTypeConfig) as CampaignBonusType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBonusType(type)}
              className={`rounded-xl p-4 text-left transition-all ${
                bonusType === type
                  ? `${bonusTypeConfig[type].bgColor} ${bonusTypeConfig[type].color}`
                  : 'bg-apple-elevated text-apple-mute hover:opacity-80'
              }`}
            >
              <span className="text-sm font-medium">{t(bonusTypeConfig[type].labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bonus Settings */}
      {bonusType === 'balance' && (
        <div className={`space-y-4 rounded-2xl p-5 ${bonusTypeConfig.balance.bgColor}`}>
          <h2 className={`text-lg font-semibold ${bonusTypeConfig.balance.color}`}>
            {t('admin.campaigns.form.balanceBonus')}
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={balanceBonusRubles}
              onChange={createNumberInputHandler(setBalanceBonusRubles, 0)}
              className="w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              min={0}
              step={1}
            />
            <span className="text-apple-mute">₽</span>
          </div>
        </div>
      )}

      {bonusType === 'subscription' && (
        <div className={`space-y-4 rounded-2xl p-5 ${bonusTypeConfig.subscription.bgColor}`}>
          <h2 className={`text-lg font-semibold ${bonusTypeConfig.subscription.color}`}>
            {t('admin.campaigns.form.trialSubscription')}
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-apple-mute">
                {t('admin.campaigns.form.days')}
              </label>
              <input
                type="number"
                value={subscriptionDays}
                onChange={createNumberInputHandler(setSubscriptionDays, 1)}
                className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                min={1}
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-medium text-apple-mute">
                {t('admin.campaigns.form.trafficGb')}
              </label>
              <input
                type="number"
                value={subscriptionTraffic}
                onChange={createNumberInputHandler(setSubscriptionTraffic, 0)}
                className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                min={0}
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-medium text-apple-mute">
                {t('admin.campaigns.form.devices')}
              </label>
              <input
                type="number"
                value={subscriptionDevices}
                onChange={createNumberInputHandler(setSubscriptionDevices, 1)}
                className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                min={1}
              />
            </div>
          </div>

          <ServerSelector servers={servers} selected={selectedSquads} onToggle={toggleServer} />
        </div>
      )}

      {bonusType === 'tariff' && (
        <div className={`space-y-4 rounded-2xl p-5 ${bonusTypeConfig.tariff.bgColor}`}>
          <h2 className={`text-lg font-semibold ${bonusTypeConfig.tariff.color}`}>
            {t('admin.campaigns.form.tariff')}
          </h2>

          <TariffSelector tariffs={tariffs} value={tariffId} onChange={setTariffId} />

          <div>
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.campaigns.form.durationDays')}
            </label>
            <input
              type="number"
              value={tariffDays}
              onChange={createNumberInputHandler(setTariffDays, 1)}
              className="w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              min={1}
            />
          </div>
        </div>
      )}

      {bonusType === 'none' && (
        <div className={`rounded-2xl p-5 ${bonusTypeConfig.none.bgColor}`}>
          <p className="text-sm text-apple-mute">{t('admin.campaigns.form.noBonusDescription')}</p>
        </div>
      )}

      {/* Footer */}
      <div className="apple-card-grad flex items-center justify-end gap-3 rounded-2xl bg-apple-card p-5">
        <button
          onClick={() => navigate('/admin/campaigns')}
          className="rounded-full bg-apple-elevated px-5 py-2.5 text-sm font-medium text-apple-ink transition-opacity hover:opacity-90"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || updateMutation.isPending}
          className="flex items-center gap-2 rounded-full bg-[#F97315] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {updateMutation.isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : null}
          {updateMutation.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {updateMutation.isError && (
        <div className="rounded-2xl bg-apple-red/10 p-3 text-sm text-apple-red">
          {t('admin.campaigns.updateError')}
        </div>
      )}
    </div>
  );
}
