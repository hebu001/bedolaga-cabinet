import {
ChartIcon,
CheckIcon,
EditIcon,
PlusIcon,
TrashIcon,
XIcon,
} from '@/components/admin/legacyIcons';
import { BackIcon } from '@/components/admin/legacyPageIcons/AdminCampaigns';
import { useInfiniteQuery,useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { campaignsApi,type CampaignBonusType,type CampaignListItem } from '../api/campaigns';
import i18n from '../i18n';

import { Skeleton,SkeletonGroup } from '../components/ui/skeleton';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { usePlatform } from '../platform/hooks/usePlatform';

const PAGE_SIZE = 50;

// Bonus type labels and colors
const bonusTypeConfig: Record<
  CampaignBonusType,
  { labelKey: string; color: string; bgColor: string }
> = {
  balance: {
    labelKey: 'admin.campaigns.bonusType.balance',
    color: 'text-apple-green',
    bgColor: 'bg-apple-green/15',
  },
  subscription: {
    labelKey: 'admin.campaigns.bonusType.subscription',
    color: 'text-[#F97315]',
    bgColor: 'bg-[#F97315]/15',
  },
  tariff: {
    labelKey: 'admin.campaigns.bonusType.tariff',
    color: 'text-[#F97315]',
    bgColor: 'bg-[#F97315]/15',
  },
  none: {
    labelKey: 'admin.campaigns.bonusType.none',
    color: 'text-apple-mute',
    bgColor: 'bg-apple-elevated',
  },
};

// Locale mapping for formatting
const localeMap: Record<string, string> = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', fa: 'fa-IR' };

// Format number as rubles
const formatRubles = (kopeks: number) => {
  const locale = localeMap[i18n.language] || 'ru-RU';
  return (
    (kopeks / 100).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) +
    ' ₽'
  );
};

// Main Component
export default function AdminCampaigns() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePlatform();

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const deleteDialogRef = useFocusTrap<HTMLDivElement>(deleteConfirm !== null, {
    onEscape: () => setDeleteConfirm(null),
  });

  // Queries
  const {
    data: campaignsData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-campaigns'],
    queryFn: ({ pageParam = 0 }) => campaignsApi.getCampaigns(true, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.campaigns.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const { data: overview } = useQuery({
    queryKey: ['admin-campaigns-overview'],
    queryFn: () => campaignsApi.getOverview(),
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: campaignsApi.deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns-overview'] });
      setDeleteConfirm(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: campaignsApi.toggleCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
  });

  const campaigns = campaignsData?.pages.flatMap((p) => p.campaigns) ?? [];

  return (
    <div className="animate-fade-in">
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
            <h1 className="text-xl font-semibold text-apple-ink">{t('admin.campaigns.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.campaigns.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/campaigns/create')}
          className="flex items-center justify-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon />
          {t('admin.campaigns.createButton')}
        </button>
      </div>

      {/* Overview */}
      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-ink">{overview.total}</div>
            <div className="text-sm text-apple-mute">
              {t('admin.campaigns.overview.totalCampaigns')}
            </div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-green">{overview.active}</div>
            <div className="text-sm text-apple-mute">{t('admin.campaigns.overview.active')}</div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-[#F97315]">{overview.total_registrations}</div>
            <div className="text-sm text-apple-mute">
              {t('admin.campaigns.overview.registrations')}
            </div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-green">
              {formatRubles(overview.total_balance_issued_kopeks)}
            </div>
            <div className="text-sm text-apple-mute">
              {t('admin.campaigns.overview.bonusesIssued')}
            </div>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      {isLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : campaigns.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-apple-mute">{t('admin.campaigns.noData')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign: CampaignListItem) => (
            <div
              key={campaign.id}
              className={`apple-card-grad rounded-2xl bg-apple-card p-4 transition-opacity ${
                campaign.is_active ? '' : 'opacity-60'
              }`}
            >
              {/* Как у промокодов: на телефоне название, чипы и кнопки — отдельными
                  строками. В одну строку с четырьмя кнопками название сжималось до
                  «Осен…», а чип партнёра налезал на кнопки. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="mb-2 font-medium text-apple-ink [overflow-wrap:anywhere]">
                    {campaign.name}
                  </h3>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bonusTypeConfig[campaign.bonus_type].bgColor} ${bonusTypeConfig[campaign.bonus_type].color}`}
                    >
                      {t(bonusTypeConfig[campaign.bonus_type].labelKey)}
                    </span>
                    {campaign.partner_name && (
                      <span className="rounded-full bg-apple-blue/15 px-2.5 py-1 text-[11px] font-semibold text-apple-blue">
                        {campaign.partner_name}
                      </span>
                    )}
                    {!campaign.is_active && (
                      <span className="rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                        {t('admin.campaigns.table.inactive')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-apple-mute">
                    <span className="w-full font-mono text-xs break-all">
                      ?start={campaign.start_parameter}
                    </span>
                    <span>
                      {t('admin.campaigns.table.registrations', {
                        count: campaign.registrations_count,
                      })}
                    </span>
                    <span>
                      {t('admin.campaigns.table.revenue', {
                        amount: formatRubles(campaign.total_revenue_kopeks),
                      })}
                    </span>
                    <span>
                      {t('admin.campaigns.table.conversion', { rate: campaign.conversion_rate })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-apple-hairline pt-3 sm:border-0 sm:pt-0">
                  {/* Stats */}
                  <button
                    onClick={() => navigate(`/admin/campaigns/${campaign.id}/stats`)}
                    className="rounded-lg bg-apple-elevated p-2 text-apple-mute transition-colors hover:text-apple-ink"
                    title={t('admin.campaigns.table.statistics')}
                  >
                    <ChartIcon />
                  </button>

                  {/* Toggle Active */}
                  <button
                    onClick={() => toggleMutation.mutate(campaign.id)}
                    className={`flex flex-1 justify-center rounded-lg p-2 transition-colors sm:flex-none ${
                      campaign.is_active
                        ? 'bg-apple-green/15 text-apple-green hover:bg-apple-green/25'
                        : 'bg-apple-elevated text-apple-mute hover:text-apple-ink'
                    }`}
                    title={
                      campaign.is_active
                        ? t('admin.campaigns.table.deactivate')
                        : t('admin.campaigns.table.activate')
                    }
                  >
                    {campaign.is_active ? <CheckIcon /> : <XIcon />}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => navigate(`/admin/campaigns/${campaign.id}/edit`)}
                    className="rounded-lg bg-apple-elevated p-2 text-apple-mute transition-colors hover:text-apple-ink"
                    title={t('admin.campaigns.table.edit')}
                  >
                    <EditIcon />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteConfirm(campaign.id)}
                    className="rounded-lg bg-apple-elevated p-2 text-apple-mute transition-colors hover:bg-apple-red/15 hover:text-apple-red"
                    title={t('admin.campaigns.table.delete')}
                    disabled={campaign.registrations_count > 0}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-apple-card py-3 text-sm font-medium text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink disabled:opacity-50"
            >
              {isFetchingNextPage ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-apple-faint border-t-[#F97315]" />
              ) : (
                t('admin.campaigns.loadMore', 'Load more')
              )}
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-dark-950/60"
            onClick={() => setDeleteConfirm(null)}
            aria-hidden="true"
          />
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-delete-title"
            tabIndex={-1}
            className="relative w-full max-w-sm rounded-xl bg-apple-card p-6"
          >
            <h3 id="campaign-delete-title" className="mb-2 text-lg font-semibold text-apple-ink">
              {t('admin.campaigns.confirm.deleteTitle')}
            </h3>
            <p className="mb-6 text-apple-mute">{t('admin.campaigns.confirm.deleteText')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-apple-mute transition-colors hover:text-apple-ink"
              >
                {t('admin.campaigns.confirm.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                className="rounded-full bg-apple-red px-4 py-2 text-white transition-opacity hover:opacity-90"
              >
                {t('admin.campaigns.confirm.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
