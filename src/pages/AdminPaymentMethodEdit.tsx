import {
  BackIcon,
  CheckIcon,
  SaveIcon,
} from '@/components/admin/legacyPageIcons/AdminPaymentMethodEdit';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { adminOverpayCertificateApi, OVERPAY_CERT_MAX_SIZE } from '../api/adminOverpayCertificate';
import { adminPaymentMethodsApi } from '../api/adminPaymentMethods';
import { METHOD_LABELS } from '../constants/paymentMethods';
import { useHapticFeedback } from '../platform/hooks/useHaptic';
import { useDestructiveConfirm } from '../platform/hooks/useNativeDialog';
import { usePlatform } from '../platform/hooks/usePlatform';
import type { PromoGroupSimple } from '../types';
import { createNumberInputHandler, toNumber } from '../utils/inputHelpers';
import { localeMap } from '../utils/withdrawalUtils';

import { PageSkeleton, Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

function extractErrorDetail(err: unknown): string | null {
  const error = err as { response?: { data?: { detail?: unknown } } };
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : null;
}

function OverpayCertificateSection() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHapticFeedback();
  const confirm = useDestructiveConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [certError, setCertError] = useState<string | null>(null);
  const [certWarning, setCertWarning] = useState<string | null>(null);

  const { data: certStatus, isLoading } = useQuery({
    queryKey: ['admin', 'overpay-certificate'],
    queryFn: adminOverpayCertificateApi.getStatus,
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: { file: File; passphrase: string }) =>
      adminOverpayCertificateApi.upload(payload.file, payload.passphrase),
    onSuccess: (resp) => {
      haptic.success();
      setCertError(null);
      setCertWarning(resp.warning ?? null);
      setCertFile(null);
      setPassphrase('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['admin', 'overpay-certificate'] });
    },
    onError: (err) => {
      haptic.error();
      setCertWarning(null);
      setCertError(extractErrorDetail(err) ?? t('admin.paymentMethods.overpayCertUploadError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminOverpayCertificateApi.remove,
    onSuccess: () => {
      haptic.success();
      setCertError(null);
      setCertWarning(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'overpay-certificate'] });
    },
    onError: (err) => {
      haptic.error();
      setCertError(extractErrorDetail(err) ?? t('admin.paymentMethods.overpayCertDeleteError'));
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCertError(null);
    setCertWarning(null);
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.size > OVERPAY_CERT_MAX_SIZE) {
      setCertFile(null);
      e.target.value = '';
      setCertError(t('admin.paymentMethods.overpayCertFileTooLarge'));
      return;
    }
    setCertFile(selected);
  };

  const handleDelete = async () => {
    const confirmed = await confirm(t('admin.paymentMethods.overpayCertConfirmDelete'));
    if (confirmed) deleteMutation.mutate();
  };

  const expiryDate = certStatus?.not_valid_after
    ? new Date(certStatus.not_valid_after).toLocaleDateString(localeMap[i18n.language] || 'ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  const isExpired = certStatus?.not_valid_after
    ? new Date(certStatus.not_valid_after).getTime() < Date.now()
    : false;

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-apple-ink">
        {t('admin.paymentMethods.overpayCertTitle')}
      </h3>

      {isLoading ? (
        <SkeletonGroup>
          <Skeleton className="h-10 w-full rounded-xl" />
        </SkeletonGroup>
      ) : certStatus ? (
        <div>
          {certStatus.valid ? (
            <>
              {isExpired ? (
                <p className="text-sm text-apple-amber">
                  {t('admin.paymentMethods.overpayCertExpired', { date: expiryDate })}
                </p>
              ) : (
                <p className="text-sm text-apple-green">
                  {t('admin.paymentMethods.overpayCertValid', { date: expiryDate })}
                </p>
              )}
              {certStatus.subject && (
                <p className="mt-1 break-all text-xs text-apple-faint">{certStatus.subject}</p>
              )}
            </>
          ) : certStatus.uploaded ? (
            <p className="text-sm text-apple-amber">
              {t('admin.paymentMethods.overpayCertUnreadable')}
            </p>
          ) : (
            <p className="text-sm text-apple-mute">
              {t('admin.paymentMethods.overpayCertMissing')}
            </p>
          )}
          {certStatus.env_locked_path && (
            <p className="mt-1 text-xs text-apple-faint">
              {t('admin.paymentMethods.overpayCertEnvLockedPath')}
            </p>
          )}
          {certStatus.env_locked_passphrase && (
            <p className="mt-1 text-xs text-apple-faint">
              {t('admin.paymentMethods.overpayCertEnvLockedPassphrase')}
            </p>
          )}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="overpay-certificate"
          className="mb-2 block text-[13px] font-medium text-apple-mute"
        >
          {t('admin.paymentMethods.overpayCertFile')}
        </label>
        <input
          id="overpay-certificate"
          ref={fileInputRef}
          type="file"
          accept=".p12,.pfx"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-apple-hairline bg-apple-card/50 p-4 text-sm text-apple-mute transition-colors hover:border-dark-500 hover:text-apple-mute"
        >
          {certFile ? certFile.name : t('admin.paymentMethods.overpayCertChooseFile')}
        </button>
      </div>

      <div>
        <label
          htmlFor="overpay-passphrase"
          className="mb-2 block text-[13px] font-medium text-apple-mute"
        >
          {t('admin.paymentMethods.overpayCertPassphrase')}
        </label>
        <input
          id="overpay-passphrase"
          type="password"
          autoComplete="off"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder={t('admin.paymentMethods.overpayCertPassphrasePlaceholder')}
          className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
        />
      </div>

      {certError && <p className="text-sm text-apple-red">{certError}</p>}
      {certWarning && <p className="text-sm text-apple-amber">{certWarning}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => certFile && uploadMutation.mutate({ file: certFile, passphrase })}
          disabled={!certFile || uploadMutation.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {uploadMutation.isPending && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {t('admin.paymentMethods.overpayCertUpload')}
        </button>
        {certStatus?.uploaded && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="btn-danger"
          >
            {t('admin.paymentMethods.overpayCertDelete')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminPaymentMethodEdit() {
  const { t } = useTranslation();
  const { methodId } = useParams<{ methodId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePlatform();

  // Fetch payment methods
  const { data: methods, isLoading } = useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: adminPaymentMethodsApi.getAll,
  });

  // Fetch promo groups
  const { data: promoGroups = [] } = useQuery<PromoGroupSimple[]>({
    queryKey: ['admin-payment-methods-promo-groups'],
    queryFn: adminPaymentMethodsApi.getPromoGroups,
  });

  const config = methods?.find((m) => m.method_id === methodId);

  // Local state for editing
  const [isEnabled, setIsEnabled] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [subOptions, setSubOptions] = useState<Record<string, boolean>>({});
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'telegram' | 'email'>('all');
  const [firstTopupFilter, setFirstTopupFilter] = useState<'any' | 'yes' | 'no'>('any');
  const [promoGroupFilterMode, setPromoGroupFilterMode] = useState<'all' | 'selected'>('all');
  const [selectedPromoGroupIds, setSelectedPromoGroupIds] = useState<number[]>([]);
  const [openUrlDirect, setOpenUrlDirect] = useState(false);
  const [quickAmounts, setQuickAmounts] = useState<number[]>([]);
  const [quickAmountInput, setQuickAmountInput] = useState('');
  const [quickAmountsError, setQuickAmountsError] = useState<string | null>(null);

  // Initialize state when config loads
  useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setCustomName(config.display_name || '');
      setCustomDesc(config.description || '');
      setSubOptions(config.sub_options || {});
      setMinAmount(config.min_amount_kopeks ?? '');
      setMaxAmount(config.max_amount_kopeks ?? '');
      setUserTypeFilter(config.user_type_filter);
      setFirstTopupFilter(config.first_topup_filter);
      setPromoGroupFilterMode(config.promo_group_filter_mode);
      setSelectedPromoGroupIds(config.allowed_promo_group_ids);
      // ?? false — защита от stale-config (backend ещё не пришёл с миграцией)
      setOpenUrlDirect(config.open_url_direct ?? false);
      setQuickAmounts((config.quick_amounts ?? []).map((kopeks) => kopeks / 100));
    }
  }, [config]);

  // Update method mutation
  const updateMethodMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => adminPaymentMethodsApi.update(methodId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      navigate('/admin/payment-methods');
    },
  });

  const handleSave = () => {
    if (!config) return;

    const data: Record<string, unknown> = {
      is_enabled: isEnabled,
      user_type_filter: userTypeFilter,
      first_topup_filter: firstTopupFilter,
      promo_group_filter_mode: promoGroupFilterMode,
      allowed_promo_group_ids: promoGroupFilterMode === 'selected' ? selectedPromoGroupIds : [],
      open_url_direct: openUrlDirect,
    };

    // Display name
    if (customName.trim()) {
      data.display_name = customName.trim();
    } else {
      data.reset_display_name = true;
    }

    // Description
    if (customDesc.trim()) {
      data.description = customDesc.trim();
    } else {
      data.reset_description = true;
    }

    // Sub-options
    if (config.available_sub_options) {
      data.sub_options = subOptions;
    }

    // Amounts
    if (minAmount !== '') {
      data.min_amount_kopeks = toNumber(minAmount) || null;
    } else {
      data.reset_min_amount = true;
    }
    if (maxAmount !== '') {
      data.max_amount_kopeks = toNumber(maxAmount) || null;
    } else {
      data.reset_max_amount = true;
    }

    if (quickAmounts.length > 0) {
      data.quick_amounts = [...quickAmounts]
        .sort((a, b) => a - b)
        .map((rubles) => Math.round(rubles * 100));
    } else {
      data.reset_quick_amounts = true;
    }

    updateMethodMutation.mutate(data);
  };

  const togglePromoGroup = (id: number) => {
    setSelectedPromoGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addQuickAmount = () => {
    setQuickAmountsError(null);
    const parsed = parseFloat(quickAmountInput.replace(',', '.'));
    const value = Math.round(parsed);
    if (isNaN(value) || value <= 0) {
      setQuickAmountsError(t('admin.paymentMethods.quickAmountsInvalid'));
      return;
    }
    if (quickAmounts.includes(value)) {
      setQuickAmountInput('');
      return;
    }
    if (quickAmounts.length >= 10) {
      setQuickAmountsError(t('admin.paymentMethods.quickAmountsLimit'));
      return;
    }
    setQuickAmounts((prev) => [...prev, value].sort((a, b) => a - b));
    setQuickAmountInput('');
  };

  const removeQuickAmount = (value: number) => {
    setQuickAmounts((prev) => prev.filter((amount) => amount !== value));
  };

  if (isLoading) {
    return (
      <PageSkeleton variant="admin" leading={1} titleWidth="w-56" className="space-y-6">
        <Skeleton variant="card" className="h-96" />
      </PageSkeleton>
    );
  }

  if (!config) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              aria-label={t('common.back')}
              onClick={() => navigate('/admin/payment-methods')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-card transition-colors hover:bg-apple-elevated"
            >
              <BackIcon />
            </button>
          )}
          <h1 className="text-2xl font-bold text-apple-ink">
            {t('admin.paymentMethods.notFound', 'Payment method not found')}
          </h1>
        </div>
      </div>
    );
  }

  const displayName = config.display_name || config.default_display_name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Show back button only on web, not in Telegram Mini App */}
        {!capabilities.hasBackButton && (
          <button
            aria-label={t('common.back')}
            onClick={() => navigate('/admin/payment-methods')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-card transition-colors hover:bg-apple-elevated"
          >
            <BackIcon />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-dark-50 [overflow-wrap:anywhere]">
            {displayName}
          </h1>
          <p className="text-sm text-apple-faint">
            {METHOD_LABELS[config.method_id] || config.method_id}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="apple-card-grad space-y-6 rounded-2xl bg-apple-card p-5">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-apple-ink">
              {t('admin.paymentMethods.methodEnabled')}
            </div>
            {!config.is_provider_configured && (
              <div className="mt-0.5 text-xs text-apple-amber">
                {t('admin.paymentMethods.providerNotConfigured')}
              </div>
            )}
          </div>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            role="switch"
            aria-checked={isEnabled}
            aria-label={t('admin.paymentMethods.methodEnabled')}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isEnabled ? 'bg-[#F97315]' : 'bg-apple-elevated'
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                isEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Open URL directly toggle */}
        <div className="flex items-center justify-between border-t border-apple-hairline pt-6">
          <div className="pr-4">
            <div className="text-sm font-medium text-apple-ink">
              {t('admin.paymentMethods.openUrlDirect', 'Открывать страницу оплаты сразу')}
            </div>
            <div className="mt-0.5 text-xs text-apple-faint">
              {t(
                'admin.paymentMethods.openUrlDirectHint',
                'Без панели со ссылкой — провайдер открывается внутри MiniApp/вкладки сразу после клика. После оплаты юзер возвращается на /balance/result.',
              )}
            </div>
          </div>
          <button
            onClick={() => setOpenUrlDirect(!openUrlDirect)}
            role="switch"
            aria-checked={openUrlDirect}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              openUrlDirect ? 'bg-[#F97315]' : 'bg-dark-600'
            }`}
            aria-label={t('admin.paymentMethods.openUrlDirect', 'Open payment page directly')}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                openUrlDirect ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Display name */}
        <div>
          <label
            htmlFor="payment-display-name"
            className="mb-2 block text-[13px] font-medium text-apple-mute"
          >
            {t('admin.paymentMethods.displayName')}
          </label>
          <input
            id="payment-display-name"
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={config.default_display_name}
            className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
          />
          <p className="mt-1 text-xs text-apple-faint">
            {t('admin.paymentMethods.displayNameHint')}: {config.default_display_name}
          </p>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="payment-description"
            className="mb-2 block text-[13px] font-medium text-apple-mute"
          >
            {t('admin.paymentMethods.description')}
          </label>
          <textarea
            id="payment-description"
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            rows={2}
            className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
          />
          <p className="mt-1 text-xs text-apple-faint">
            {t('admin.paymentMethods.descriptionHint')}
          </p>
        </div>

        {/* Sub-options */}
        {config.available_sub_options && config.available_sub_options.length > 0 && (
          <div>
            <label
              htmlFor="payment-min-amount"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.paymentMethods.subOptions')}
            </label>
            <div className="space-y-2">
              {config.available_sub_options.map((opt) => {
                const enabled = subOptions[opt.id] !== false;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSubOptions((prev) => ({ ...prev, [opt.id]: !enabled }))}
                    className={`flex w-full items-center justify-between rounded-xl p-3 transition-all ${
                      enabled
                        ? 'bg-apple-elevated text-apple-ink ring-1 ring-[#F97315]/30'
                        : 'bg-apple-elevated text-apple-faint'
                    }`}
                  >
                    <span className="text-sm">{opt.name}</span>
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                        enabled
                          ? 'bg-[#F97315] text-white'
                          : 'border border-apple-hairline bg-apple-elevated'
                      }`}
                    >
                      {enabled && <CheckIcon />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Min/Max amounts */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="payment-min-amount"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.paymentMethods.minAmount')}
            </label>
            <input
              id="payment-min-amount"
              type="number"
              value={minAmount}
              onChange={createNumberInputHandler(setMinAmount, 0)}
              placeholder={config.default_min_amount_kopeks.toString()}
              className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
            />
          </div>
          <div>
            <label
              htmlFor="payment-max-amount"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.paymentMethods.maxAmount')}
            </label>
            <input
              id="payment-max-amount"
              type="number"
              value={maxAmount}
              onChange={createNumberInputHandler(setMaxAmount, 0)}
              placeholder={config.default_max_amount_kopeks.toString()}
              className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-medium text-apple-mute">
            {t('admin.paymentMethods.quickAmounts')}
          </label>
          {quickAmounts.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => removeQuickAmount(value)}
                  aria-label={t('admin.paymentMethods.quickAmountsRemove', { value })}
                  className="flex items-center gap-1.5 rounded-xl border border-[#F97315]/30 bg-[#F97315]/10 px-3 py-1.5 text-sm font-medium text-accent-300 transition-colors hover:border-error-500/40 hover:bg-error-500/10 hover:text-apple-red"
                >
                  <span>
                    {value}
                    {'\u00A0'}₽
                  </span>
                  <span className="text-base leading-none">×</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              aria-label={t('admin.paymentMethods.quickAmounts')}
              type="number"
              min="1"
              value={quickAmountInput}
              onChange={(e) => setQuickAmountInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addQuickAmount();
                }
              }}
              placeholder={t('admin.paymentMethods.quickAmountsPlaceholder')}
              className="input min-w-0 flex-1"
            />
            <button type="button" onClick={addQuickAmount} className="btn-secondary shrink-0">
              {t('admin.paymentMethods.quickAmountsAdd')}
            </button>
          </div>
          {quickAmountsError && <p className="mt-1 text-xs text-apple-red">{quickAmountsError}</p>}
          <p className="mt-1 text-xs text-apple-faint">
            {t('admin.paymentMethods.quickAmountsHint', {
              defaults: (config.default_quick_amounts ?? [])
                .map((kopeks) => kopeks / 100)
                .join(', '),
            })}
          </p>
        </div>

        {/* Display conditions */}
        <div className="border-t border-apple-hairline pt-3">
          <h3 className="mb-4 text-sm font-semibold text-apple-ink">
            {t('admin.paymentMethods.conditions')}
          </h3>

          {/* User type filter */}
          <div className="mb-4">
            <label className="mb-2 block text-[13px] text-apple-mute">
              {t('admin.paymentMethods.userTypeFilter')}
            </label>
            <div className="flex gap-2">
              {(['all', 'telegram', 'email'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setUserTypeFilter(val)}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                    userTypeFilter === val
                      ? 'bg-[#F97315]/20 ring-1 ring-[#F97315]/40'
                      : 'bg-apple-elevated text-apple-mute'
                  }`}
                  style={
                    userTypeFilter === val
                      ? { color: 'rgb(var(--color-apple-accent-text))' }
                      : undefined
                  }
                >
                  {val === 'all'
                    ? t('admin.paymentMethods.userTypeAll')
                    : val === 'telegram'
                      ? 'Telegram'
                      : 'Email'}
                </button>
              ))}
            </div>
          </div>

          {/* First topup filter */}
          <div className="mb-4">
            <label className="mb-2 block text-[13px] text-apple-mute">
              {t('admin.paymentMethods.firstTopupFilter')}
            </label>
            <div className="flex gap-2">
              {(['any', 'yes', 'no'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setFirstTopupFilter(val)}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                    firstTopupFilter === val
                      ? 'bg-[#F97315]/20 ring-1 ring-[#F97315]/40'
                      : 'bg-apple-elevated text-apple-mute'
                  }`}
                  style={
                    firstTopupFilter === val
                      ? { color: 'rgb(var(--color-apple-accent-text))' }
                      : undefined
                  }
                >
                  {val === 'any'
                    ? t('admin.paymentMethods.firstTopupAny')
                    : val === 'yes'
                      ? t('admin.paymentMethods.firstTopupWas')
                      : t('admin.paymentMethods.firstTopupWasNot')}
                </button>
              ))}
            </div>
          </div>

          {/* Promo groups filter */}
          <div>
            <label className="mb-2 block text-[13px] text-apple-mute">
              {t('admin.paymentMethods.promoGroupFilter')}
            </label>
            <div className="mb-3 flex gap-2">
              {(['all', 'selected'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setPromoGroupFilterMode(val)}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                    promoGroupFilterMode === val
                      ? 'bg-[#F97315]/20 ring-1 ring-[#F97315]/40'
                      : 'bg-apple-elevated text-apple-mute'
                  }`}
                  style={
                    promoGroupFilterMode === val
                      ? { color: 'rgb(var(--color-apple-accent-text))' }
                      : undefined
                  }
                >
                  {val === 'all'
                    ? t('admin.paymentMethods.promoGroupAll')
                    : t('admin.paymentMethods.promoGroupSelected')}
                </button>
              ))}
            </div>

            {promoGroupFilterMode === 'selected' && (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl bg-apple-elevated p-3">
                {promoGroups.length === 0 ? (
                  <p className="py-2 text-center text-sm text-apple-faint">
                    {t('admin.paymentMethods.noPromoGroups')}
                  </p>
                ) : (
                  promoGroups.map((group) => {
                    const selected = selectedPromoGroupIds.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        onClick={() => togglePromoGroup(group.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all ${
                          selected ? 'bg-[#F97315]/15' : 'text-apple-mute hover:bg-apple-card'
                        }`}
                        style={
                          selected ? { color: 'rgb(var(--color-apple-accent-text))' } : undefined
                        }
                      >
                        <span>{group.name}</span>
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded ${
                            selected ? 'bg-[#F97315] text-white' : 'border border-apple-hairline'
                          }`}
                        >
                          {selected && <CheckIcon />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {config.method_id === 'overpay' && (
        <PermissionGate permission="settings:read">
          <OverpayCertificateSection />
        </PermissionGate>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/payment-methods')}
          className="flex-1 rounded-full bg-apple-elevated px-5 py-2.5 text-[14px] font-semibold text-apple-ink transition-opacity hover:opacity-90"
        >
          {t('admin.paymentMethods.cancelButton')}
        </button>
        <button
          onClick={handleSave}
          disabled={updateMethodMutation.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {updateMethodMutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <SaveIcon className="h-4 w-4" />
          )}
          {t('admin.paymentMethods.saveButton')}
        </button>
      </div>
    </div>
  );
}
