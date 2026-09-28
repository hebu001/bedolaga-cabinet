import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  tariffsApi,
  type TariffDetail,
  type TariffCreateRequest,
  type TariffUpdateRequest,
  type PeriodPrice,
  type ServerInfo,
  type ExternalSquadInfo,
} from '../api/tariffs';
import { AdminBackButton } from '../components/admin';
import { createNumberInputHandler, toNumber } from '../utils/inputHelpers';
import Twemoji from 'react-twemoji';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import {
  CalendarIcon,
  CheckIcon,
  InfinityIcon,
  PlusIcon,
  RefreshIcon,
  SunIcon,
  StarIcon,
  TrashIcon,
} from '@/components/icons';

type TariffType = 'period' | 'daily' | null;

export default function AdminTariffCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  // Step: null = type selection, 'period' or 'daily' = form
  const [tariffType, setTariffType] = useState<TariffType>(null);

  // Form state - matches bot fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [trafficLimitGb, setTrafficLimitGb] = useState<number | ''>(100);
  const [deviceLimit, setDeviceLimit] = useState<number | ''>(1);
  const [devicePriceKopeks, setDevicePriceKopeks] = useState<number | ''>(0);
  const [maxDeviceLimit, setMaxDeviceLimit] = useState<number | ''>(0);
  const [tierLevel, setTierLevel] = useState<number | ''>(1);
  const [periodPrices, setPeriodPrices] = useState<PeriodPrice[]>([]);
  // Период, отмеченный как самый выгодный. Хранится днями: набор периодов правят
  // прямо на этой форме, и индекс после правки указывал бы на другой период.
  const [highlightPeriodDays, setHighlightPeriodDays] = useState<number | null>(null);
  const [selectedSquads, setSelectedSquads] = useState<string[]>([]);
  const [selectedExternalSquad, setSelectedExternalSquad] = useState<string | null>(null);
  const [selectedPromoGroups, setSelectedPromoGroups] = useState<number[]>([]);
  const [dailyPriceKopeks, setDailyPriceKopeks] = useState<number | ''>(0);
  const [lavaProductId, setLavaProductId] = useState('');
  // Тег панели Remnawave: сервер поднимает регистр и проверяет формат
  const [panelTag, setPanelTag] = useState('');
  // Дни триала на этом тарифе; '' — глобальная настройка
  const [trialDurationDays, setTrialDurationDays] = useState<number | ''>('');

  // Traffic topup
  const [trafficTopupEnabled, setTrafficTopupEnabled] = useState(false);
  const [maxTopupTrafficGb, setMaxTopupTrafficGb] = useState<number | ''>(0);
  const [trafficTopupPackages, setTrafficTopupPackages] = useState<Record<string, number>>({});

  // New traffic package for adding
  const [newPackageGb, setNewPackageGb] = useState<number | ''>(10);
  const [newPackagePrice, setNewPackagePrice] = useState<number | ''>(100);

  // Track editing state for traffic package prices
  const [editingPackagePrices, setEditingPackagePrices] = useState<Record<string, string>>({});

  // Traffic reset mode
  const [trafficResetMode, setTrafficResetMode] = useState<string | null>(null);

  // Gift visibility
  const [showInGift, setShowInGift] = useState(true);
  // Тариф отмечен как выгодный — выделяется в списке тарифов у клиента.
  const [isTariffHighlighted, setIsTariffHighlighted] = useState(false);

  // New period for adding
  const [newPeriodDays, setNewPeriodDays] = useState<number | ''>(30);
  const [newPeriodPrice, setNewPeriodPrice] = useState<number | ''>(300);

  // Track editing state for period prices
  const [editingPeriodPrices, setEditingPeriodPrices] = useState<Record<number, string>>({});

  const [activeTab, setActiveTab] = useState<'basic' | 'periods' | 'servers' | 'extra'>('basic');

  // Fetch servers
  const { data: servers = [] } = useQuery({
    queryKey: ['admin-tariffs-servers'],
    queryFn: () => tariffsApi.getAvailableServers(),
  });

  // Fetch external squads
  const { data: externalSquads = [] } = useQuery({
    queryKey: ['admin-tariffs-external-squads'],
    queryFn: () => tariffsApi.getAvailableExternalSquads(),
  });

  // Fetch promo groups
  const { data: promoGroups = [] } = useQuery({
    queryKey: ['admin-tariffs-promo-groups'],
    queryFn: () => tariffsApi.getAvailablePromoGroups(),
  });

  // Fetch tariff for editing
  const { isLoading: isLoadingTariff } = useQuery({
    queryKey: ['admin-tariff', id],
    queryFn: () => tariffsApi.getTariff(Number(id)),
    enabled: isEdit,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    select: useCallback((data: TariffDetail) => {
      setTariffType(data.is_daily ? 'daily' : 'period');
      setName(data.name);
      setDescription(data.description || '');
      setIsActive(data.is_active ?? true);
      setTrafficLimitGb(data.traffic_limit_gb ?? 100);
      setDeviceLimit(data.device_limit || 1);
      setDevicePriceKopeks(data.device_price_kopeks || 0);
      setMaxDeviceLimit(data.max_device_limit || 0);
      setTierLevel(data.tier_level || 1);
      setPeriodPrices(data.period_prices?.length ? data.period_prices : []);
      setHighlightPeriodDays(data.highlight_period_days ?? null);
      setSelectedSquads(data.allowed_squads || []);
      setSelectedExternalSquad(data.external_squad_uuid || null);
      setSelectedPromoGroups(
        data.promo_groups?.filter((pg) => pg.is_selected).map((pg) => pg.id) || [],
      );
      setDailyPriceKopeks(data.daily_price_kopeks || 0);
      setLavaProductId(data.lava_product_id || '');
      setPanelTag(data.panel_tag || '');
      setTrialDurationDays(data.trial_duration_days ?? '');
      setTrafficTopupEnabled(data.traffic_topup_enabled || false);
      setMaxTopupTrafficGb(data.max_topup_traffic_gb || 0);
      setTrafficTopupPackages(data.traffic_topup_packages || {});
      setTrafficResetMode(data.traffic_reset_mode || null);
      setShowInGift(data.show_in_gift ?? true);
      setIsTariffHighlighted(data.is_highlighted ?? false);
      return data;
    }, []),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: tariffsApi.createTariff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
      navigate('/admin/tariffs');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TariffUpdateRequest }) =>
      tariffsApi.updateTariff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
      navigate('/admin/tariffs');
    },
  });

  const handleSubmit = () => {
    const isDaily = tariffType === 'daily';
    const highlightPayload = isDaily ? null : highlightPeriodDays;

    // PATCH applies a field only when it is present in the payload, so empty
    // values ('' / []) must still be sent when editing — omitting them makes
    // clearing the description or unchecking all promo groups impossible.
    const data: TariffCreateRequest | TariffUpdateRequest = {
      name,
      description: isEdit ? description : description || undefined,
      is_active: isActive,
      show_in_gift: showInGift,
      is_highlighted: isTariffHighlighted,
      traffic_limit_gb: toNumber(trafficLimitGb, 100),
      device_limit: toNumber(deviceLimit, 1),
      device_price_kopeks:
        toNumber(devicePriceKopeks) >= 0 ? toNumber(devicePriceKopeks) : undefined,
      max_device_limit: toNumber(maxDeviceLimit) > 0 ? toNumber(maxDeviceLimit) : undefined,
      tier_level: toNumber(tierLevel, 1),
      period_prices: isDaily ? [] : periodPrices.filter((p) => p.price_kopeks >= 0),
      // Выделение необязательно. На правке 0 — «снять выделение» (пустое поле
      // означало бы «не трогать»); на создании снимать нечего, и без отметки
      // поле не уходит — сервер отверг бы ноль.
      highlight_period_days: isEdit ? (highlightPayload ?? 0) : (highlightPayload ?? undefined),
      allowed_squads: selectedSquads,
      external_squad_uuid: selectedExternalSquad || null,
      promo_group_ids: selectedPromoGroups,
      traffic_topup_enabled: trafficTopupEnabled,
      traffic_topup_packages: trafficTopupPackages,
      max_topup_traffic_gb: toNumber(maxTopupTrafficGb),
      is_daily: isDaily,
      daily_price_kopeks: isDaily ? toNumber(dailyPriceKopeks) : 0,
      // Пустая строка отвязывает тариф от продукта Lava
      lava_product_id: lavaProductId.trim(),
      // Пустая строка снимает тег панели (на правке); формат проверяет сервер
      panel_tag: panelTag.trim(),
      // Дни триала: пусто — глобальная настройка
      trial_duration_days: toNumber(trialDurationDays) > 0 ? toNumber(trialDurationDays) : null,
      traffic_reset_mode: trafficResetMode,
    };

    if (isEdit) {
      updateMutation.mutate({ id: Number(id), data });
    } else {
      createMutation.mutate(data as TariffCreateRequest);
    }
  };

  const toggleServer = (uuid: string) => {
    setSelectedSquads((prev) =>
      prev.includes(uuid) ? prev.filter((s) => s !== uuid) : [...prev, uuid],
    );
  };

  const togglePromoGroup = (groupId: number) => {
    setSelectedPromoGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  const addPeriod = () => {
    const days = toNumber(newPeriodDays, 0);
    const price = toNumber(newPeriodPrice, 0);
    // Нулевая цена допустима: бесплатный тариф — штатная настройка, и бот с
    // кабинетом такой период продают. Раньше кнопка на нуле молча ничего
    // не делала, а поле ввода само подменяло ноль единицей.
    if (days > 0 && price >= 0) {
      const exists = periodPrices.some((p) => p.days === days);
      if (!exists) {
        setPeriodPrices((prev) =>
          [...prev, { days, price_kopeks: price * 100 }].sort((a, b) => a.days - b.days),
        );
        setNewPeriodDays(30);
        setNewPeriodPrice(300);
      }
    }
  };

  const removePeriod = (days: number) => {
    setPeriodPrices((prev) => prev.filter((p) => p.days !== days));
    // Удалённый период не может оставаться выделенным.
    setHighlightPeriodDays((current) => (current === days ? null : current));
  };

  /** Повторное нажатие снимает выделение — отдельной кнопки «снять» не нужно. */
  const toggleHighlight = (days: number) => {
    setHighlightPeriodDays((current) => (current === days ? null : days));
  };

  const updatePeriodPrice = (days: number, priceRubles: number) => {
    setPeriodPrices((prev) =>
      prev.map((p) => (p.days === days ? { ...p, price_kopeks: priceRubles * 100 } : p)),
    );
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Validation like bot: name 2-50 chars, device_limit >= 1, tier_level 1-10
  const isNameValid = name.length >= 2 && name.length <= 50;
  const isDeviceLimitValid = deviceLimit !== '' && toNumber(deviceLimit) >= 1;
  const isTierLevelValid =
    tierLevel !== '' && toNumber(tierLevel) >= 1 && toNumber(tierLevel) <= 10;
  const hasTrafficPackages = !trafficTopupEnabled || Object.keys(trafficTopupPackages).length > 0;
  const isValidPeriod =
    isNameValid &&
    isDeviceLimitValid &&
    isTierLevelValid &&
    periodPrices.length > 0 &&
    hasTrafficPackages;
  const isValidDaily =
    isNameValid &&
    isDeviceLimitValid &&
    isTierLevelValid &&
    toNumber(dailyPriceKopeks) > 0 &&
    hasTrafficPackages;
  const isValid =
    tariffType === 'period' ? isValidPeriod : tariffType === 'daily' ? isValidDaily : false;

  // Collect validation errors for display
  const validationErrors: string[] = [];
  if (!isNameValid) {
    if (name.length === 0) {
      validationErrors.push('nameRequired');
    } else if (name.length < 2 || name.length > 50) {
      validationErrors.push('nameLength');
    }
  }
  if (!isDeviceLimitValid) validationErrors.push('deviceLimitRequired');
  if (!isTierLevelValid) validationErrors.push('tierLevelInvalid');
  if (tariffType === 'period' && periodPrices.length === 0) {
    validationErrors.push('periodsRequired');
  }
  if (tariffType === 'daily' && toNumber(dailyPriceKopeks) === 0) {
    validationErrors.push('dailyPriceRequired');
  }
  if (trafficTopupEnabled && Object.keys(trafficTopupPackages).length === 0) {
    validationErrors.push('trafficPackagesRequired');
  }

  // Loading state
  if (isEdit && isLoadingTariff) {
    return (
      <PageSkeleton variant="admin" leading={1} titleWidth="w-56" className="space-y-6">
        <div className="flex gap-2">
          <Skeleton count={4} className="h-10 w-28 shrink-0 rounded-xl" />
        </div>
        <Skeleton variant="card" className="h-96" />
      </PageSkeleton>
    );
  }

  // Type selection step (only for creation)
  if (!isEdit && tariffType === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <AdminBackButton to="/admin/tariffs" />
          <div>
            <h1 className="text-xl font-bold text-apple-ink">{t('admin.tariffs.selectType')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.tariffs.selectTypeDesc')}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => setTariffType('period')}
            className="apple-card-grad group rounded-2xl bg-apple-card p-6 text-left transition-opacity hover:opacity-90"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg p-3">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-medium text-apple-ink">{t('admin.tariffs.periodTariff')}</h3>
                <p className="mt-1 text-sm text-apple-mute">
                  {t('admin.tariffs.periodTariffDesc')}
                </p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setTariffType('daily')}
            className="apple-card-grad group rounded-2xl bg-apple-card p-6 text-left transition-opacity hover:opacity-90"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-apple-amber/15 p-3 text-apple-amber">
                <SunIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-medium text-apple-ink">{t('admin.tariffs.dailyTariff')}</h3>
                <p className="mt-1 text-sm text-apple-mute">{t('admin.tariffs.dailyTariffDesc')}</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  const isDaily = tariffType === 'daily';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AdminBackButton to="/admin/tariffs" />
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg p-2 ${isDaily ? 'bg-apple-amber/15 text-apple-amber' : ''}`}
            style={
              isDaily ? undefined : { backgroundColor: 'rgba(249,115,21,0.15)', color: '#F97315' }
            }
          >
            {isDaily ? <SunIcon className="h-6 w-6" /> : <CalendarIcon className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-apple-ink">
              {isEdit
                ? t('admin.tariffs.editTitle')
                : isDaily
                  ? t('admin.tariffs.newDailyTitle')
                  : t('admin.tariffs.newPeriodTitle')}
            </h1>
            <p className="text-sm text-apple-mute">
              {isDaily ? t('admin.tariffs.dailyDeduction') : t('admin.tariffs.periodPayment')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {(isDaily
          ? (['basic', 'servers', 'extra'] as const)
          : (['basic', 'periods', 'servers', 'extra'] as const)
        ).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab
                ? isDaily
                  ? 'bg-apple-amber/15 text-apple-amber ring-1 ring-apple-amber/30'
                  : 'bg-[#F97315]/15 text-[#F97315] ring-1 ring-[#F97315]/30'
                : 'bg-apple-elevated text-apple-mute'
            }`}
          >
            {tab === 'basic' && t('admin.tariffs.tabBasic')}
            {tab === 'periods' && t('admin.tariffs.tabPeriods')}
            {tab === 'servers' && t('admin.tariffs.tabServers')}
            {tab === 'extra' && t('admin.tariffs.tabExtra')}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'basic' && (
        <div className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-4">
          {/* Name */}
          <div>
            <label
              htmlFor="tariff-name"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.tariffs.nameLabel')}
              <span className="text-apple-red">*</span>
            </label>
            <input
              id="tariff-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 ${!isNameValid && name.length > 0 ? 'ring-2 ring-apple-red/50' : ''}`}
              placeholder={
                isDaily ? t('admin.tariffs.nameExampleDaily') : t('admin.tariffs.nameExamplePeriod')
              }
              maxLength={50}
            />
            <p className="mt-1 text-xs text-apple-faint">{t('admin.tariffs.nameHint')}</p>
            {name.length > 0 && (name.length < 2 || name.length > 50) && (
              <p className="mt-1 text-xs text-apple-red">
                {t('admin.tariffs.validation.nameLength')}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="tariff-description"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.tariffs.descriptionLabel')}
            </label>
            <textarea
              id="tariff-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] w-full resize-none rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              placeholder={t('admin.tariffs.descriptionPlaceholder')}
            />
          </div>

          {/* Daily Price (only for daily tariff) */}
          {isDaily && (
            <div className="rounded-xl bg-apple-amber/10 p-4">
              <label
                htmlFor="tariff-daily-price"
                className="mb-2 block text-[13px] font-medium text-apple-amber"
              >
                {t('admin.tariffs.dailyPriceLabel')}
                <span className="text-apple-red">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="tariff-daily-price"
                  type="number"
                  value={dailyPriceKopeks === '' ? '' : dailyPriceKopeks / 100}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setDailyPriceKopeks('');
                    } else {
                      const num = Math.max(0, parseFloat(val) || 0) * 100;
                      setDailyPriceKopeks(num);
                    }
                  }}
                  className={`w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 ${dailyPriceKopeks === '' || dailyPriceKopeks === 0 ? 'ring-2 ring-apple-red/50' : ''}`}
                  min={0}
                  step={0.1}
                  placeholder="50"
                />
                <span className="text-apple-mute">{t('admin.tariffs.currencyPerDay')}</span>
              </div>
              <p className="mt-2 text-xs text-apple-faint">
                {t('admin.tariffs.dailyDeductionDesc')}
              </p>
            </div>
          )}

          {/* Lava recurrent product */}
          <div>
            <label
              htmlFor="tariff-lava-product"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.tariffs.lavaProductLabel')}
            </label>
            <input
              id="tariff-lava-product"
              type="text"
              value={lavaProductId}
              onChange={(e) => setLavaProductId(e.target.value)}
              className="input w-full"
              placeholder="6be21df9-0bcd-44ac-9c2c-3be7bc94decc"
            />
            <p className="mt-2 text-xs text-apple-faint">{t('admin.tariffs.lavaProductDesc')}</p>
          </div>

          {/* Remnawave panel tag */}
          <div>
            <label
              htmlFor="tariff-panel-tag"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.tariffs.panelTagLabel')}
            </label>
            <input
              id="tariff-panel-tag"
              type="text"
              value={panelTag}
              onChange={(e) => setPanelTag(e.target.value)}
              className="input w-full uppercase"
              maxLength={16}
              placeholder="PAID_PRO"
            />
            <p className="mt-2 text-xs text-apple-faint">{t('admin.tariffs.panelTagDesc')}</p>
          </div>

          {/* Trial days on this tariff */}
          <div>
            <label
              htmlFor="tariff-trial-days"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.tariffs.trialDaysLabel')}
            </label>
            <input
              id="tariff-trial-days"
              type="number"
              min={1}
              value={trialDurationDays}
              onChange={(e) =>
                setTrialDurationDays(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="input w-full"
            />
            <p className="mt-2 text-xs text-apple-faint">{t('admin.tariffs.trialDaysDesc')}</p>
          </div>

          {/* Traffic Limit */}
          <div>
            <label
              htmlFor="tariff-traffic-limit"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.tariffs.trafficLimitLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="tariff-traffic-limit"
                type="number"
                value={trafficLimitGb}
                onChange={createNumberInputHandler(setTrafficLimitGb, 0)}
                className="w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                min={0}
                placeholder="100"
              />
              <span className="text-apple-mute">{t('admin.tariffs.gbUnit')}</span>
              {(trafficLimitGb === 0 || trafficLimitGb === '') && (
                <span className="flex items-center gap-1 text-sm text-apple-green">
                  <InfinityIcon className="h-4 w-4" />
                  {t('admin.tariffs.unlimited')}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-apple-faint">{t('admin.tariffs.trafficLimitHint')}</p>
          </div>

          {/* Device Limit */}
          <div>
            <label
              htmlFor="tariff-device-limit"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.tariffs.deviceLimitLabel')}
              <span className="text-apple-red">*</span>
            </label>
            <input
              id="tariff-device-limit"
              type="number"
              value={deviceLimit}
              onChange={createNumberInputHandler(setDeviceLimit, 1)}
              className={`w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 ${!isDeviceLimitValid ? 'ring-2 ring-apple-red/50' : ''}`}
              min={1}
              placeholder="1"
            />
          </div>

          {/* Tier Level */}
          <div>
            <label
              htmlFor="tariff-tier-level"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.tariffs.tierLevelLabel')}
              <span className="text-apple-red">*</span>
            </label>
            <input
              id="tariff-tier-level"
              type="number"
              value={tierLevel}
              onChange={createNumberInputHandler(setTierLevel, 1, 10)}
              className={`w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 ${!isTierLevelValid ? 'ring-2 ring-apple-red/50' : ''}`}
              min={1}
              max={10}
              placeholder="1"
            />
            <p className="mt-1 text-xs text-apple-faint">{t('admin.tariffs.tierLevelHint')}</p>
          </div>
        </div>
      )}

      {activeTab === 'periods' && !isDaily && (
        <div className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-4">
          <p className="text-sm text-apple-mute">{t('admin.tariffs.periodsTabHint')}</p>

          {/* Add new period */}
          <div className="rounded-xl bg-apple-elevated p-4">
            <h4 className="mb-3 text-sm font-medium text-apple-mute">
              {t('admin.tariffs.addPeriodTitle')}
            </h4>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-apple-faint">
                  {t('admin.tariffs.daysLabel')}
                </label>
                <input
                  type="number"
                  value={newPeriodDays}
                  onChange={createNumberInputHandler(setNewPeriodDays, 1)}
                  className="w-24 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                  placeholder="30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-apple-faint">
                  {t('admin.tariffs.priceLabel')}
                </label>
                {/* Минимум 0, а не 1: бесплатный тариф — штатная настройка,
                    и набранный ноль не должен превращаться в рубль. */}
                <input
                  type="number"
                  value={newPeriodPrice}
                  onChange={createNumberInputHandler(setNewPeriodPrice, 0)}
                  className="w-28 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                  placeholder="300"
                />
              </div>
              <button
                onClick={addPeriod}
                disabled={periodPrices.some((p) => p.days === toNumber(newPeriodDays, 0))}
                className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <PlusIcon />
                {t('admin.tariffs.addButton')}
              </button>
            </div>
          </div>

          {/* Period list */}
          {periodPrices.length === 0 ? (
            <div className="py-8 text-center text-apple-faint">
              {t('admin.tariffs.noPeriodsHint')}
            </div>
          ) : (
            <div className="space-y-2">
              {periodPrices.map((period) => (
                <div
                  key={period.days}
                  className="flex items-center gap-3 rounded-xl bg-apple-elevated p-3"
                >
                  <div className="w-16 shrink-0 whitespace-nowrap font-medium text-apple-mute">
                    {period.days}
                    {'\u00A0'}
                    {t('admin.tariffs.daysShort')}
                  </div>
                  <input
                    type="number"
                    value={
                      editingPeriodPrices[period.days] !== undefined
                        ? editingPeriodPrices[period.days]
                        : period.price_kopeks / 100
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingPeriodPrices((prev) => ({ ...prev, [period.days]: val }));
                      if (val !== '') {
                        const num = parseFloat(val);
                        if (!Number.isNaN(num)) {
                          updatePeriodPrice(period.days, Math.max(0, num));
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        updatePeriodPrice(period.days, 0);
                      }
                      setEditingPeriodPrices((prev) => {
                        const copy = { ...prev };
                        delete copy[period.days];
                        return copy;
                      });
                    }}
                    className="w-28 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                    step={1}
                    placeholder="0"
                  />
                  <span className="text-apple-mute">₽</span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => toggleHighlight(period.days)}
                    title={t('admin.tariffs.bestValueHint')}
                    aria-pressed={highlightPeriodDays === period.days}
                    className={`rounded-lg p-2 transition-colors ${
                      highlightPeriodDays === period.days
                        ? 'bg-urgent-400/20 text-urgent-400'
                        : 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink'
                    }`}
                  >
                    <StarIcon filled={highlightPeriodDays === period.days} className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removePeriod(period.days)}
                    className="rounded-lg p-2 text-apple-mute transition-colors hover:bg-apple-red/15 hover:text-apple-red"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'servers' && (
        <div className="space-y-4">
          {/* External Squad */}
          {externalSquads.length > 0 && (
            <div className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-4">
              <h4 className="text-sm font-medium text-apple-ink">
                {t('admin.tariffs.externalSquadTitle')}
              </h4>
              <p className="text-sm text-apple-mute">{t('admin.tariffs.externalSquadHint')}</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedExternalSquad(null)}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                    !selectedExternalSquad
                      ? isDaily
                        ? 'bg-apple-amber/15 text-apple-amber'
                        : 'bg-[#F97315]/15 text-[#F97315]'
                      : 'bg-apple-elevated text-apple-mute'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      !selectedExternalSquad
                        ? isDaily
                          ? 'bg-warning-500 text-white'
                          : 'bg-[#F97315] text-white'
                        : 'bg-dark-600'
                    }`}
                  >
                    {!selectedExternalSquad && <CheckIcon />}
                  </div>
                  <span className="flex-1 text-sm font-medium">
                    {t('admin.tariffs.noExternalSquad')}
                  </span>
                </button>
                {externalSquads.map((squad: ExternalSquadInfo) => {
                  const isSelected = selectedExternalSquad === squad.uuid;
                  return (
                    <button
                      key={squad.uuid}
                      type="button"
                      onClick={() => setSelectedExternalSquad(squad.uuid)}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                        isSelected
                          ? isDaily
                            ? 'bg-apple-amber/15 text-apple-amber'
                            : 'bg-[#F97315]/15 text-[#F97315]'
                          : 'bg-apple-elevated text-apple-mute'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          isSelected
                            ? isDaily
                              ? 'bg-warning-500 text-white'
                              : 'bg-[#F97315] text-white'
                            : 'bg-dark-600'
                        }`}
                      >
                        {isSelected && <CheckIcon />}
                      </div>
                      {/* Имя важнее счётчика: раньше «123456 пользователей» съедало
                          строку, а имя сквада обрезалось до «Внешний …». */}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium [overflow-wrap:anywhere]">
                          {squad.name}
                        </span>
                        <span className="text-xs text-apple-faint">
                          {squad.members_count} {t('admin.tariffs.externalSquadUsers')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Servers */}
          <div className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-4">
            <h4 className="text-sm font-medium text-apple-ink">
              {t('admin.tariffs.serversTitle')}
            </h4>
            <p className="text-sm text-apple-mute">{t('admin.tariffs.serversTabHint')}</p>
            {servers.length === 0 ? (
              <p className="py-4 text-center text-apple-faint">
                {t('admin.tariffs.noServersAvailable')}
              </p>
            ) : (
              <div className="space-y-2">
                {servers.map((server: ServerInfo) => {
                  const isSelected = selectedSquads.includes(server.squad_uuid);
                  return (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => toggleServer(server.squad_uuid)}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                        isSelected
                          ? isDaily
                            ? 'bg-apple-amber/15 text-apple-amber'
                            : 'bg-[#F97315]/15 text-[#F97315]'
                          : 'bg-apple-elevated text-apple-mute'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                          isSelected
                            ? isDaily
                              ? 'bg-warning-500 text-white'
                              : 'bg-[#F97315] text-white'
                            : 'bg-dark-600'
                        }`}
                      >
                        {isSelected && <CheckIcon />}
                      </div>
                      <span className="flex-1 text-sm font-medium">
                        <Twemoji
                          tag="span"
                          options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}
                        >
                          {server.display_name}
                        </Twemoji>
                      </span>
                      {server.country_code && (
                        <span className="text-xs text-apple-faint">{server.country_code}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'extra' && (
        <div className="space-y-4">
          {/* Device addon */}
          <div className="apple-card-grad space-y-3 rounded-2xl bg-apple-card p-4">
            <h4 className="text-sm font-medium text-apple-ink">
              {t('admin.tariffs.extraDeviceTitle')}
            </h4>
            <div className="flex items-center gap-3">
              <span className="w-48 text-sm text-apple-mute">
                {t('admin.tariffs.devicePriceLabel')}
              </span>
              <input
                type="number"
                value={devicePriceKopeks === '' ? '' : devicePriceKopeks / 100}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setDevicePriceKopeks('');
                  } else {
                    setDevicePriceKopeks(Math.max(0, parseFloat(val) || 0) * 100);
                  }
                }}
                className="w-24 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                min={0}
                step={1}
                placeholder="0"
              />
              <span className="text-apple-mute">₽</span>
            </div>
            <p className="text-xs text-apple-faint">{t('admin.tariffs.devicePriceHint')}</p>
            <div className="flex items-center gap-3">
              <span className="w-48 text-sm text-apple-mute">
                {t('admin.tariffs.maxDeviceLabel')}
              </span>
              <input
                type="number"
                value={maxDeviceLimit}
                onChange={createNumberInputHandler(setMaxDeviceLimit, 0)}
                className="w-24 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                min={0}
                placeholder="0"
              />
            </div>
            <p className="text-xs text-apple-faint">{t('admin.tariffs.noLimitHint')}</p>
          </div>

          {/* Traffic topup */}
          <div className="apple-card-grad space-y-3 rounded-2xl bg-apple-card p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-apple-ink">
                {t('admin.tariffs.extraTrafficTitle')}
              </h4>
              <button
                type="button"
                onClick={() => setTrafficTopupEnabled(!trafficTopupEnabled)}
                role="switch"
                aria-checked={trafficTopupEnabled}
                aria-label={t('admin.tariffs.extraTrafficTitle')}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  trafficTopupEnabled ? 'bg-[#F97315]' : 'bg-apple-elevated'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    trafficTopupEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
            {trafficTopupEnabled && (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-32 text-sm text-apple-mute">
                    {t('admin.tariffs.trafficMaxLimitLabel')}
                  </span>
                  <input
                    type="number"
                    value={maxTopupTrafficGb}
                    onChange={createNumberInputHandler(setMaxTopupTrafficGb, 0)}
                    className="w-24 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                    min={0}
                    placeholder="0"
                  />
                  <span className="text-apple-mute">{t('admin.tariffs.gbUnit')}</span>
                </div>
                {/* Add new package */}
                <div className="rounded-xl bg-apple-elevated p-3">
                  <h5 className="mb-2 text-xs font-medium text-apple-mute">
                    {t('admin.tariffs.addPackageTitle')}
                  </h5>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-apple-faint">
                        {t('admin.tariffs.gbUnit')}
                      </label>
                      <input
                        type="number"
                        value={newPackageGb}
                        onChange={createNumberInputHandler(setNewPackageGb, 1)}
                        className="w-20 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-apple-faint">
                        {t('admin.tariffs.priceLabel')}
                      </label>
                      <input
                        type="number"
                        value={newPackagePrice}
                        onChange={createNumberInputHandler(setNewPackagePrice, 1)}
                        className="w-24 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                        placeholder="100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const gb = toNumber(newPackageGb, 0);
                        const price = toNumber(newPackagePrice, 0);
                        if (gb > 0 && price >= 0 && !trafficTopupPackages[String(gb)]) {
                          setTrafficTopupPackages((prev) => ({
                            ...prev,
                            [String(gb)]: price * 100,
                          }));
                          setNewPackageGb(10);
                          setNewPackagePrice(100);
                        }
                      }}
                      disabled={
                        newPackageGb === '' ||
                        newPackagePrice === '' ||
                        !!trafficTopupPackages[String(newPackageGb)]
                      }
                      className="flex items-center gap-1 rounded-full bg-[#F97315] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                    >
                      <PlusIcon />
                      {t('admin.tariffs.addButton')}
                    </button>
                  </div>
                </div>

                {/* Package list */}
                <div>
                  <span className="text-sm text-apple-mute">
                    {t('admin.tariffs.trafficPackagesLabel')}
                  </span>
                  {Object.keys(trafficTopupPackages).length === 0 ? (
                    <div className="mt-2 py-4 text-center text-sm text-apple-faint">
                      {t('admin.tariffs.noPackagesHint')}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {Object.entries(trafficTopupPackages)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([gb, priceKopeks]) => (
                          <div
                            key={gb}
                            className="flex items-center gap-2 rounded-xl bg-apple-elevated p-2"
                          >
                            <span className="w-16 text-sm font-medium text-apple-mute">
                              {gb} {t('admin.tariffs.gbPackageUnit')}
                            </span>
                            <input
                              type="number"
                              value={
                                editingPackagePrices[gb] !== undefined
                                  ? editingPackagePrices[gb]
                                  : priceKopeks / 100
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingPackagePrices((prev) => ({ ...prev, [gb]: val }));
                                if (val !== '') {
                                  const num = parseFloat(val);
                                  if (!Number.isNaN(num)) {
                                    setTrafficTopupPackages((prev) => ({
                                      ...prev,
                                      [gb]: Math.max(0, num) * 100,
                                    }));
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  setTrafficTopupPackages((prev) => ({
                                    ...prev,
                                    [gb]: 0,
                                  }));
                                }
                                setEditingPackagePrices((prev) => {
                                  const copy = { ...prev };
                                  delete copy[gb];
                                  return copy;
                                });
                              }}
                              className="w-24 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                              step={1}
                              placeholder="0"
                            />
                            <span className="text-xs text-apple-mute">₽</span>
                            <div className="flex-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setTrafficTopupPackages((prev) => {
                                  const copy = { ...prev };
                                  delete copy[gb];
                                  return copy;
                                });
                              }}
                              className="rounded-lg p-2 text-apple-mute transition-colors hover:bg-apple-red/15 hover:text-apple-red"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Traffic reset mode */}
          <div className="apple-card-grad space-y-3 rounded-2xl bg-apple-card p-4">
            <h4 className="text-sm font-medium text-apple-ink">
              {t('admin.tariffs.trafficResetModeTitle')}
            </h4>
            <p className="text-xs text-apple-faint">{t('admin.tariffs.trafficResetModeDesc')}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: null, labelKey: 'admin.tariffs.resetModeGlobal', emoji: '🌐' },
                { value: 'DAY', labelKey: 'admin.tariffs.resetModeDaily', emoji: '📅' },
                { value: 'WEEK', labelKey: 'admin.tariffs.resetModeWeekly', emoji: '📆' },
                { value: 'MONTH', labelKey: 'admin.tariffs.resetModeMonthly', emoji: '🗓️' },
                {
                  value: 'MONTH_ROLLING',
                  labelKey: 'admin.tariffs.resetModeMonthRolling',
                  emoji: '🔄',
                },
                { value: 'NO_RESET', labelKey: 'admin.tariffs.resetModeNever', emoji: '🚫' },
              ].map((option) => (
                <button
                  key={option.value || 'global'}
                  type="button"
                  onClick={() => setTrafficResetMode(option.value)}
                  className={`rounded-xl p-3 text-left text-sm transition-colors ${
                    trafficResetMode === option.value
                      ? isDaily
                        ? 'bg-apple-amber/15 text-apple-amber ring-1 ring-apple-amber/30'
                        : 'bg-[#F97315]/15 text-[#F97315] ring-1 ring-[#F97315]/30'
                      : 'bg-apple-elevated text-apple-mute'
                  }`}
                >
                  {option.emoji} {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Promo Groups */}
          <div className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-4">
            <h4 className="text-sm font-medium text-apple-ink">
              {t('admin.tariffs.promoGroupsTitle')}
            </h4>
            <p className="text-sm text-apple-mute">{t('admin.tariffs.promoGroupsHint')}</p>
            {promoGroups.length === 0 ? (
              <p className="py-4 text-center text-apple-faint">
                {t('admin.tariffs.noPromoGroups')}
              </p>
            ) : (
              <div className="space-y-2">
                {promoGroups.map((group) => {
                  const isSelected = selectedPromoGroups.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => togglePromoGroup(group.id)}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                        isSelected
                          ? isDaily
                            ? 'bg-apple-amber/15 text-apple-amber'
                            : 'bg-[#F97315]/15 text-[#F97315]'
                          : 'bg-apple-elevated text-apple-mute'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                          isSelected
                            ? isDaily
                              ? 'bg-warning-500 text-white'
                              : 'bg-[#F97315] text-white'
                            : 'bg-dark-600'
                        }`}
                      >
                        {isSelected && <CheckIcon />}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {group.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tariff status */}
          <div className="apple-card-grad space-y-3 rounded-2xl bg-apple-card p-4">
            <h4 className="text-sm font-medium text-apple-ink">{t('admin.tariffs.statusTitle')}</h4>
            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-xl bg-apple-elevated p-3">
              <div>
                <span className="text-sm font-medium text-apple-ink">
                  {t('admin.tariffs.isActiveLabel')}
                </span>
                <p className="text-xs text-apple-faint">{t('admin.tariffs.isActiveHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                role="switch"
                aria-checked={isActive}
                aria-label={t('admin.tariffs.isActiveLabel')}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  isActive ? 'bg-apple-green' : 'bg-apple-card'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    isActive ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
            {/* Highlight tariff toggle */}
            <div className="flex items-center justify-between rounded-xl bg-apple-elevated p-3">
              <div>
                <span className="text-sm font-medium text-apple-ink">
                  {t('admin.tariffs.highlightLabel')}
                </span>
                <p className="text-xs text-apple-faint">{t('admin.tariffs.highlightHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTariffHighlighted(!isTariffHighlighted)}
                role="switch"
                aria-checked={isTariffHighlighted}
                aria-label={t('admin.tariffs.highlightLabel')}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  isTariffHighlighted ? 'bg-urgent-400' : 'bg-dark-600'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    isTariffHighlighted ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
            {/* Show in gift toggle */}
            <div className="flex items-center justify-between rounded-xl bg-apple-elevated p-3">
              <div>
                <span className="text-sm font-medium text-apple-ink">
                  {t('admin.tariffs.showInGiftLabel')}
                </span>
                <p className="text-xs text-apple-faint">{t('admin.tariffs.showInGiftHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInGift(!showInGift)}
                role="switch"
                aria-checked={showInGift}
                aria-label={t('admin.tariffs.showInGiftLabel')}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  showInGift ? 'bg-[#F97315]' : 'bg-apple-card'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    showInGift ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="apple-card-grad space-y-3 rounded-2xl bg-apple-card p-4">
        {validationErrors.length > 0 && (
          <div className="rounded-xl bg-apple-red/10 p-3">
            <p className="mb-1 text-sm font-medium text-apple-red">
              {t('admin.tariffs.cannotSave')}
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-apple-red/80">
              {validationErrors.map((error) => (
                <li key={error}>{t(`admin.tariffs.validation.${error}`)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {isLoading && <RefreshIcon spinning />}
            {isLoading ? t('admin.tariffs.savingButton') : t('admin.tariffs.saveButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
