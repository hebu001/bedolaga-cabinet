import {
BackIcon,
ChartIcon,
CheckIcon,
CopyIcon,
EditIcon,
PlusIcon,
TrashIcon,
} from '@/components/admin/legacyPageIcons/AdminPromocodes';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { promocodesApi,type PromoCode,type PromoCodeType } from '../api/promocodes';
import { useCurrency } from '../hooks/useCurrency';
import i18n from '../i18n';
import { usePlatform } from '../platform/hooks/usePlatform';
import { copyToClipboard } from '../utils/clipboard';

import { Skeleton,SkeletonGroup } from '@/components/ui/skeleton';

// Helper functions
const getTypeLabel = (type: PromoCodeType): string => {
  const labels: Record<PromoCodeType, string> = {
    balance: i18n.t('admin.promocodes.type.balance'),
    subscription_days: i18n.t('admin.promocodes.type.subscriptionDays'),
    trial_subscription: i18n.t('admin.promocodes.type.trialSubscription'),
    promo_group: i18n.t('admin.promocodes.type.promoGroup'),
    discount: i18n.t('admin.promocodes.type.discount'),
    balance_and_days: i18n.t('admin.promocodes.type.balanceAndDays'),
  };
  return labels[type] || type;
};

const getTypeColor = (type: PromoCodeType): string => {
  const colors: Record<PromoCodeType, string> = {
    balance: 'bg-success-500/20 text-apple-green',
    subscription_days: 'bg-[#F97315]/20 text-[#F97315]',
    trial_subscription: 'bg-[#F97315]/20 text-[#F97315]',
    promo_group: 'bg-warning-500/20 text-apple-amber',
    discount: 'bg-pink-500/20 text-pink-400',
    balance_and_days: 'bg-success-500/20 text-apple-green',
  };
  return colors[type] || 'bg-apple-elevated text-apple-mute';
};

const formatDate = (date: string | null): string => {
  if (!date) return '-';
  const localeMap: Record<string, string> = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', fa: 'fa-IR' };
  const locale = localeMap[i18n.language] || 'ru-RU';
  return new Date(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function AdminPromocodes() {
  const { t } = useTranslation();
  const { formatPositive } = useCurrency();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePlatform();

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Query
  const { data: promocodesData, isLoading } = useQuery({
    queryKey: ['admin-promocodes'],
    queryFn: () => promocodesApi.getPromocodes({ limit: 100 }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: promocodesApi.deletePromocode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promocodes'] });
      setDeleteConfirm(null);
    },
  });

  const handleCopyCode = (code: string) => {
    void copyToClipboard(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const promocodes = promocodesData?.items || [];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-elevated transition-opacity hover:opacity-90"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-apple-ink">{t('admin.promocodes.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.promocodes.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/promocodes/create')}
          className="flex items-center justify-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon />
          {t('admin.promocodes.addPromocode')}
        </button>
      </div>

      {/* Stats Overview */}
      {promocodes.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-ink">{promocodes.length}</div>
            <div className="text-xs text-apple-mute">
              {t('admin.promocodes.stats.totalPromocodes')}
            </div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-green">
              {promocodes.filter((p) => p.is_active && p.is_valid).length}
            </div>
            <div className="text-xs text-apple-mute">{t('admin.promocodes.stats.activeCount')}</div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold" style={{ color: '#F97315' }}>
              {promocodes.reduce((sum, p) => sum + p.current_uses, 0)}
            </div>
            <div className="text-xs text-apple-mute">{t('admin.promocodes.stats.usagesCount')}</div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-amber">
              {promocodes.filter((p) => p.uses_left === 0 && p.max_uses > 0).length}
            </div>
            <div className="text-xs text-apple-mute">{t('admin.promocodes.stats.exhausted')}</div>
          </div>
        </div>
      )}

      {/* Promocodes List */}
      {isLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : promocodes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-apple-mute">{t('admin.promocodes.noPromocodes')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promocodes.map((promo: PromoCode) => (
            <div
              key={promo.id}
              className={`apple-card-grad rounded-2xl bg-apple-card p-4 ${
                promo.is_active ? '' : 'opacity-60'
              }`}
            >
              {/* Mobile: stacked layout, Desktop: row layout */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  {/* Code with copy button */}
                  <div className="mb-2 flex min-w-0 items-center gap-2">
                    {/* Код до 50 символов без пробелов: без переноса он уводил
                        страницу вбок на телефоне. */}
                    <button
                      onClick={() => handleCopyCode(promo.code)}
                      className="flex items-center gap-1.5 font-mono font-medium text-apple-ink transition-colors hover:text-[#F97315]"
                    >
                      <span className="min-w-0 break-all">{promo.code}</span>
                      {copiedCode === promo.code ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  </div>
                  {/* Badges - wrap on mobile */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTypeColor(promo.type)}`}
                    >
                      {getTypeLabel(promo.type)}
                    </span>
                    {!promo.is_active && (
                      <span className="rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                        {t('admin.promocodes.stats.inactive')}
                      </span>
                    )}
                    {promo.first_purchase_only && (
                      <span className="rounded-full bg-apple-amber/15 px-2.5 py-1 text-[11px] font-semibold text-apple-amber">
                        {t('admin.promocodes.firstPurchase')}
                      </span>
                    )}
                  </div>
                  {/* Info line */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-apple-mute">
                    {/* Составляющие показываем по значению, а не по типу:
                        balance_and_days теперь стоит и у набора, где баланса
                        или дней нет вовсе, — иначе в списке висело бы «+0 ₽
                        +0 дн.» у кода, который на самом деле раздаёт трафик. */}
                    {(promo.type === 'balance' || promo.type === 'balance_and_days') &&
                      promo.balance_bonus_rubles > 0 && (
                        <span className="text-apple-green">
                          {formatPositive(promo.balance_bonus_rubles)}
                        </span>
                      )}
                    {(promo.type === 'subscription_days' ||
                      promo.type === 'trial_subscription' ||
                      promo.type === 'balance_and_days') &&
                      promo.subscription_days > 0 && (
                        <span className="text-[#F97315]">
                          +{promo.subscription_days} {t('admin.promocodes.form.days')}
                        </span>
                      )}
                    {promo.type === 'balance_and_days' && (promo.traffic_gb || 0) > 0 && (
                      <span className="text-[#F97315]">
                        +{promo.traffic_gb} {t('admin.promocodes.form.gb')}
                      </span>
                    )}
                    {promo.type === 'discount' && (
                      <span className="text-apple-blue">
                        {t('admin.promocodes.discountForHours', {
                          percent: promo.balance_bonus_kopeks,
                          hours: promo.subscription_days,
                        })}
                      </span>
                    )}
                    <span>
                      {t('admin.promocodes.used')}: {promo.current_uses}/
                      {promo.max_uses === 0 ? '∞' : promo.max_uses}
                    </span>
                    {promo.valid_until && (
                      <span>
                        {t('admin.promocodes.until')}: {formatDate(promo.valid_until)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons - full width on mobile */}
                <div className="flex items-center gap-2 border-t border-apple-hairline pt-3 sm:border-0 sm:pt-0">
                  <button
                    onClick={() => navigate(`/admin/promocodes/${promo.id}/stats`)}
                    className="flex-1 rounded-lg bg-apple-elevated p-2 text-apple-mute transition-colors hover:bg-[#F97315]/15 hover:text-[#F97315] sm:flex-none"
                    title={t('admin.promocodes.actions.stats')}
                  >
                    <ChartIcon />
                  </button>
                  <button
                    onClick={() => navigate(`/admin/promocodes/${promo.id}/edit`)}
                    className="flex-1 rounded-lg bg-apple-elevated p-2 text-apple-mute transition-opacity hover:text-apple-ink hover:opacity-90 sm:flex-none"
                    title={t('admin.promocodes.actions.edit')}
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(promo.id)}
                    className="flex-1 rounded-lg bg-apple-elevated p-2 text-apple-mute transition-colors hover:bg-apple-red/15 hover:text-apple-red sm:flex-none"
                    title={t('admin.promocodes.actions.delete')}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="apple-card-grad w-full max-w-sm rounded-2xl bg-apple-card p-6">
            <h3 className="mb-2 text-lg font-semibold text-apple-ink">
              {t('admin.promocodes.confirm.deletePromocode')}
            </h3>
            <p className="mb-6 text-apple-mute">
              {t('admin.promocodes.confirm.deletePromocodeText')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-apple-mute transition-colors hover:text-apple-ink"
              >
                {t('admin.promocodes.form.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                className="rounded-full bg-apple-red px-4 py-2 text-white transition-opacity hover:opacity-90"
              >
                {t('admin.promocodes.confirm.deleteButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
