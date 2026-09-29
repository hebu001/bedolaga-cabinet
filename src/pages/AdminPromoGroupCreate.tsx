import {
PlusIcon,
RefreshIcon,
TrashIcon,
} from '@/components/admin/legacyPageIcons/AdminPromoGroupCreate';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useCallback,useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate,useParams } from 'react-router';
import {
promocodesApi,
type PromoGroup,
type PromoGroupCreateRequest,
type PromoGroupUpdateRequest,
} from '../api/promocodes';
import { AdminBackButton } from '../components/admin';

import { PageSkeleton,Skeleton } from '@/components/ui/skeleton';

interface PeriodDiscount {
  days: number | '';
  percent: number | '';
}

export default function AdminPromoGroupCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  // Form state
  const [name, setName] = useState('');
  const [serverDiscount, setServerDiscount] = useState<number | ''>(0);
  const [trafficDiscount, setTrafficDiscount] = useState<number | ''>(0);
  const [deviceDiscount, setDeviceDiscount] = useState<number | ''>(0);
  const [applyToAddons, setApplyToAddons] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [autoAssignSpent, setAutoAssignSpent] = useState<number | ''>(0);
  const [periodDiscounts, setPeriodDiscounts] = useState<PeriodDiscount[]>([]);

  // Fetch promo group for editing
  const { isLoading: isLoadingGroup } = useQuery({
    queryKey: ['admin-promo-group', id],
    queryFn: () => promocodesApi.getPromoGroup(Number(id)),
    enabled: isEdit,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    select: useCallback((data: PromoGroup) => {
      setName(data.name);
      setServerDiscount(data.server_discount_percent || 0);
      setTrafficDiscount(data.traffic_discount_percent || 0);
      setDeviceDiscount(data.device_discount_percent || 0);
      setApplyToAddons(data.apply_discounts_to_addons ?? true);
      setIsDefault(data.is_default ?? false);
      setAutoAssignSpent(
        data.auto_assign_total_spent_kopeks ? data.auto_assign_total_spent_kopeks / 100 : 0,
      );
      if (data.period_discounts && typeof data.period_discounts === 'object') {
        setPeriodDiscounts(
          Object.entries(data.period_discounts).map(([days, percent]) => ({
            days: parseInt(days),
            percent: typeof percent === 'number' ? percent : 0,
          })),
        );
      }
      return data;
    }, []),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: promocodesApi.createPromoGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo-groups'] });
      navigate('/admin/promo-groups');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PromoGroupUpdateRequest }) =>
      promocodesApi.updatePromoGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo-groups'] });
      navigate('/admin/promo-groups');
    },
  });

  const addPeriodDiscount = () => {
    setPeriodDiscounts([...periodDiscounts, { days: 30, percent: 0 }]);
  };

  const removePeriodDiscount = (index: number) => {
    setPeriodDiscounts(periodDiscounts.filter((_, i) => i !== index));
  };

  const updatePeriodDiscount = (index: number, field: 'days' | 'percent', value: number | '') => {
    setPeriodDiscounts(
      periodDiscounts.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleSubmit = () => {
    // Convert periodDiscounts array to Record<number, number>
    const periodDiscountsRecord: Record<number, number> = {};
    periodDiscounts.forEach((pd) => {
      const days = pd.days === '' ? 0 : pd.days;
      const percent = pd.percent === '' ? 0 : pd.percent;
      if (days > 0 && percent >= 0) {
        periodDiscountsRecord[days] = percent;
      }
    });

    const serverVal = serverDiscount === '' ? 0 : serverDiscount;
    const trafficVal = trafficDiscount === '' ? 0 : trafficDiscount;
    const deviceVal = deviceDiscount === '' ? 0 : deviceDiscount;
    const autoAssignVal = autoAssignSpent === '' ? 0 : autoAssignSpent;

    const data: PromoGroupCreateRequest | PromoGroupUpdateRequest = {
      name,
      server_discount_percent: serverVal,
      traffic_discount_percent: trafficVal,
      device_discount_percent: deviceVal,
      period_discounts: periodDiscountsRecord,
      apply_discounts_to_addons: applyToAddons,
      auto_assign_total_spent_kopeks: autoAssignVal > 0 ? Math.round(autoAssignVal * 100) : 0,
      is_default: isDefault,
    };

    if (isEdit) {
      updateMutation.mutate({ id: Number(id), data });
    } else {
      createMutation.mutate(data as PromoGroupCreateRequest);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isValid = name.trim().length > 0;

  // Loading state
  if (isEdit && isLoadingGroup) {
    return (
      <PageSkeleton variant="admin" leading={1} titleWidth="w-56" className="space-y-6">
        <Skeleton variant="card" className="h-96" />
      </PageSkeleton>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AdminBackButton to="/admin/promo-groups" />
        <div>
          <h1 className="text-xl font-bold text-apple-ink">
            {isEdit ? t('admin.promoGroups.editTitle') : t('admin.promoGroups.createTitle')}
          </h1>
          <p className="text-sm text-apple-mute">{t('admin.promoGroups.subtitle')}</p>
        </div>
      </div>

      {/* Form */}
      <div className="apple-card-grad space-y-4 rounded-2xl bg-apple-card p-5 sm:p-6">
        {/* Name */}
        <div>
          <label htmlFor="pg-name" className="mb-2 block text-[13px] font-medium text-apple-mute">
            {t('admin.promoGroups.form.name')}
            <span className="text-apple-red">*</span>
          </label>
          <input
            id="pg-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 ${name.length > 0 && name.trim().length === 0 ? 'ring-2 ring-apple-red/50' : ''}`}
            placeholder={t('admin.promoGroups.form.namePlaceholder')}
          />
          {name.length > 0 && name.trim().length === 0 && (
            <p className="mt-1 text-xs text-apple-red">
              {t('admin.promoGroups.form.nameRequired')}
            </p>
          )}
        </div>

        {/* Category Discounts */}
        <div className="space-y-3 rounded-xl bg-apple-elevated p-4">
          <h4 className="mb-3 text-sm font-medium text-apple-ink">
            {t('admin.promoGroups.form.categoryDiscounts')}
          </h4>

          <div className="flex items-center gap-3">
            <span className="w-32 text-sm text-apple-mute">{t('admin.promoGroups.servers')}:</span>
            <input
              type="number"
              value={serverDiscount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setServerDiscount('');
                } else {
                  setServerDiscount(Math.min(100, Math.max(0, parseInt(val) || 0)));
                }
              }}
              className="w-20 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              min={0}
              max={100}
              placeholder="0"
            />
            <span className="text-apple-mute">%</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-32 text-sm text-apple-mute">{t('admin.promoGroups.traffic')}:</span>
            <input
              type="number"
              value={trafficDiscount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setTrafficDiscount('');
                } else {
                  setTrafficDiscount(Math.min(100, Math.max(0, parseInt(val) || 0)));
                }
              }}
              className="w-20 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              min={0}
              max={100}
              placeholder="0"
            />
            <span className="text-apple-mute">%</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-32 text-sm text-apple-mute">{t('admin.promoGroups.devices')}:</span>
            <input
              type="number"
              value={deviceDiscount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setDeviceDiscount('');
                } else {
                  setDeviceDiscount(Math.min(100, Math.max(0, parseInt(val) || 0)));
                }
              }}
              className="w-20 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              min={0}
              max={100}
              placeholder="0"
            />
            <span className="text-apple-mute">%</span>
          </div>
        </div>

        {/* Period Discounts */}
        <div className="space-y-3 rounded-xl bg-apple-elevated p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-apple-ink">
              {t('admin.promoGroups.form.periodDiscounts')}
            </h4>
            <button
              type="button"
              onClick={addPeriodDiscount}
              className="flex items-center gap-1 rounded-full bg-[#F97315]/15 px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ color: '#F97315' }}
            >
              <PlusIcon />
              {t('admin.promoGroups.form.add')}
            </button>
          </div>
          <p className="mb-3 text-xs text-apple-faint">{t('admin.promoGroups.form.periodHint')}</p>

          {periodDiscounts.length === 0 ? (
            <p className="py-2 text-center text-sm text-apple-faint">
              {t('admin.promoGroups.form.noPeriods')}
            </p>
          ) : (
            <div className="space-y-2">
              {periodDiscounts.map((pd, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="number"
                    value={pd.days}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') return updatePeriodDiscount(index, 'days', '');
                      const num = parseInt(val);
                      if (!isNaN(num)) updatePeriodDiscount(index, 'days', num);
                    }}
                    className="w-20 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                    min={1}
                    placeholder={t('admin.promoGroups.form.daysPlaceholder')}
                  />
                  <span className="text-xs text-apple-mute">
                    {t('admin.promoGroups.form.arrow')}
                  </span>
                  <input
                    type="number"
                    value={pd.percent}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') return updatePeriodDiscount(index, 'percent', '');
                      const num = parseInt(val);
                      if (!isNaN(num)) updatePeriodDiscount(index, 'percent', num);
                    }}
                    className="w-20 rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                    min={0}
                    max={100}
                    placeholder="%"
                  />
                  <span className="text-apple-mute">%</span>
                  <button
                    type="button"
                    onClick={() => removePeriodDiscount(index)}
                    className="p-1 text-apple-mute transition-colors hover:text-apple-red"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-assign */}
        <div>
          <label
            htmlFor="pg-auto-assign"
            className="mb-2 block text-[13px] font-medium text-apple-mute"
          >
            {t('admin.promoGroups.form.autoAssign')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pg-auto-assign"
              type="number"
              value={autoAssignSpent}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setAutoAssignSpent('');
                } else {
                  setAutoAssignSpent(Math.max(0, parseFloat(val) || 0));
                }
              }}
              className="w-32 rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              min={0}
              placeholder="0"
            />
            <span className="text-apple-mute">{t('admin.promoGroups.form.rub')}</span>
          </div>
          <p className="mt-1 text-xs text-apple-faint">
            {t('admin.promoGroups.form.autoAssignHint')}
          </p>
        </div>

        {/* Apply to addons */}
        <label className="flex cursor-pointer items-center gap-3">
          <button
            type="button"
            onClick={() => setApplyToAddons(!applyToAddons)}
            role="switch"
            aria-checked={applyToAddons}
            aria-label={t('admin.promoGroups.form.applyToAddons')}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              applyToAddons ? 'bg-[#F97315]' : 'bg-apple-elevated'
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                applyToAddons ? 'left-6' : 'left-1'
              }`}
            />
          </button>
          <span className="text-sm text-apple-ink">
            {t('admin.promoGroups.form.applyToAddons')}
          </span>
        </label>

        {/* Default group */}
        <label className="flex cursor-pointer items-center gap-3">
          <button
            type="button"
            onClick={() => setIsDefault(!isDefault)}
            role="switch"
            aria-checked={isDefault}
            aria-label={t('admin.promoGroups.form.isDefault')}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isDefault ? 'bg-[#F97315]' : 'bg-apple-elevated'
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                isDefault ? 'left-6' : 'left-1'
              }`}
            />
          </button>
          <span className="text-sm text-apple-ink">{t('admin.promoGroups.form.isDefault')}</span>
        </label>
      </div>

      {/* Footer */}
      <div className="rounded-2xl bg-apple-card p-5 sm:p-6">
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/admin/promo-groups')}
            className="rounded-full bg-apple-elevated px-5 py-2.5 text-sm font-medium text-apple-ink transition-opacity hover:opacity-90"
          >
            {t('admin.promoGroups.form.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="flex items-center gap-2 rounded-full bg-[#F97315] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading && <RefreshIcon spinning />}
            {isLoading ? t('admin.promoGroups.form.saving') : t('admin.promoGroups.form.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
