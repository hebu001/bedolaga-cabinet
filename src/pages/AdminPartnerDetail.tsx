import { useLocation, useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { partnerApi } from '../api/partners';
import { AdminBackButton, backTo } from '../components/admin';
import { useCurrency } from '../hooks/useCurrency';
import { StatCard } from '@/components/stats';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import {
  XIcon,
  UsersIcon,
  CheckCircleIcon,
  UsersOnlineIcon,
  PercentIcon,
  BanknotesIcon,
  CalendarIcon,
  CalendarBlankIcon,
  CalendarStarIcon,
} from '@/components/icons';

// Status badge config — keys must match backend PartnerStatus enum values
const statusConfig: Record<string, { labelKey: string; color: string; bgColor: string }> = {
  approved: {
    labelKey: 'admin.partnerDetail.status.approved',
    color: 'text-apple-green',
    bgColor: 'bg-apple-green/15',
  },
  pending: {
    labelKey: 'admin.partnerDetail.status.pending',
    color: 'text-apple-amber',
    bgColor: 'bg-warning-500/20',
  },
  rejected: {
    labelKey: 'admin.partnerDetail.status.rejected',
    color: 'text-apple-red',
    bgColor: 'bg-apple-red/15',
  },
  none: {
    labelKey: 'admin.partnerDetail.status.none',
    color: 'text-apple-mute',
    bgColor: 'bg-apple-elevated',
  },
};

const unknownStatus = {
  labelKey: 'admin.partnerDetail.status.none',
  color: 'text-apple-mute',
  bgColor: 'bg-apple-elevated',
};

export default function AdminPartnerDetail() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { formatWithCurrency } = useCurrency();

  const unassignMutation = useMutation({
    mutationFn: (campaignId: number) => partnerApi.unassignCampaign(Number(userId), campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partner-detail', userId] });
    },
  });

  // Fetch partner detail
  const {
    data: partner,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-partner-detail', userId],
    queryFn: () => partnerApi.getPartnerDetail(Number(userId)),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <PageSkeleton variant="admin" leading={1} titleWidth="w-56" className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard loading />
          <StatCard loading />
          <StatCard loading />
          <StatCard loading />
        </div>
        <Skeleton variant="card" count={2} className="h-40" />
      </PageSkeleton>
    );
  }

  if (error || !partner) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <AdminBackButton to="/admin/partners" />
          <h1 className="text-xl font-semibold text-apple-ink">{t('admin.partnerDetail.title')}</h1>
        </div>
        <div className="rounded-2xl bg-apple-red/10 p-6 text-center">
          <p className="text-apple-red">{t('admin.partnerDetail.loadError')}</p>
          <button
            onClick={() => navigate('/admin/partners')}
            className="mt-4 text-sm text-apple-mute hover:text-apple-ink"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const badge = statusConfig[partner.partner_status] || unknownStatus;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <AdminBackButton to="/admin/partners" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-apple-ink">
              {partner.first_name || partner.username || `#${partner.user_id}`}
            </h1>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.bgColor} ${badge.color}`}
            >
              {t(badge.labelKey)}
            </span>
          </div>
          {partner.username && <p className="text-sm text-apple-mute">@{partner.username}</p>}
        </div>
      </div>

      <div className="space-y-6">
        {/* Referral Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={t('admin.partnerDetail.stats.totalReferrals')}
            value={partner.total_referrals}
            icon={<UsersIcon className="h-5 w-5" />}
            tone="neutral"
          />
          <StatCard
            label={t('admin.partnerDetail.stats.paidReferrals')}
            value={partner.paid_referrals}
            icon={<CheckCircleIcon className="h-5 w-5" />}
            tone="success"
          />
          <StatCard
            label={t('admin.partnerDetail.stats.activeReferrals')}
            value={partner.active_referrals}
            icon={<UsersOnlineIcon className="h-5 w-5" />}
            tone="accent"
          />
          <StatCard
            label={t('admin.partnerDetail.stats.conversionRate')}
            value={`${partner.conversion_to_paid}%`}
            icon={<PercentIcon className="h-5 w-5" />}
            tone="accent"
          />
        </div>

        {/* Earnings */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
          <h3 className="mb-4 font-medium text-apple-ink">
            {t('admin.partnerDetail.earnings.title')}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label={t('admin.partnerDetail.earnings.allTime')}
              value={formatWithCurrency(partner.earnings_all_time / 100)}
              icon={<BanknotesIcon className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label={t('admin.partnerDetail.earnings.today')}
              value={formatWithCurrency(partner.earnings_today / 100)}
              icon={<CalendarIcon className="h-5 w-5" />}
              tone="neutral"
            />
            <StatCard
              label={t('admin.partnerDetail.earnings.week')}
              value={formatWithCurrency(partner.earnings_week / 100)}
              icon={<CalendarBlankIcon className="h-5 w-5" />}
              tone="neutral"
            />
            <StatCard
              label={t('admin.partnerDetail.earnings.month')}
              value={formatWithCurrency(partner.earnings_month / 100)}
              icon={<CalendarStarIcon className="h-5 w-5" />}
              tone="neutral"
            />
          </div>
        </div>

        {/* Commission */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-apple-ink">
                {t('admin.partnerDetail.commission.title')}
              </h3>
              <div className="mt-1 text-2xl font-bold" style={{ color: '#F97315' }}>
                {partner.commission_percent ?? 0}%
              </div>
            </div>
            <button
              onClick={() =>
                navigate(`/admin/partners/${userId}/commission`, {
                  state: { currentCommission: partner.commission_percent ?? 0 },
                })
              }
              className="rounded-full bg-apple-elevated px-4 py-2 text-sm text-apple-mute transition-colors hover:text-apple-ink"
            >
              {t('admin.partnerDetail.commission.update')}
            </button>
          </div>
        </div>

        {/* Campaigns */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium text-apple-ink">
              {t('admin.partnerDetail.campaigns.title')}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/admin/partners/${userId}/campaigns/assign`)}
                className="rounded-full bg-apple-elevated px-3 py-1.5 text-xs text-apple-mute transition-colors hover:text-apple-ink"
              >
                {t('admin.partnerDetail.campaigns.assign')}
              </button>
              <button
                onClick={() =>
                  navigate(`/admin/campaigns/create?partnerId=${userId}`, backTo(location))
                }
                className="rounded-full bg-[#F97315] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                {t('admin.partnerDetail.campaigns.createNew')}
              </button>
            </div>
          </div>
          {partner.campaigns.length === 0 ? (
            <div className="py-4 text-center text-sm text-apple-faint">
              {t('admin.partnerDetail.campaigns.noCampaigns')}
            </div>
          ) : (
            <div className="space-y-2">
              {partner.campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={`rounded-xl bg-apple-elevated p-3 ${
                    !campaign.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-apple-ink [overflow-wrap:anywhere]">
                        {campaign.name}
                      </div>
                      <div className="font-mono text-xs text-apple-faint break-all">
                        ?start={campaign.start_parameter}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {campaign.is_active ? (
                        <span className="rounded-full bg-apple-green/15 px-2.5 py-1 text-[11px] font-semibold text-apple-green">
                          {t('admin.partnerDetail.campaigns.active')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                          {t('admin.partnerDetail.campaigns.inactive')}
                        </span>
                      )}
                      <button
                        onClick={() => unassignMutation.mutate(campaign.id)}
                        disabled={unassignMutation.isPending}
                        className="rounded p-1 text-apple-faint transition-colors hover:bg-apple-red/10 hover:text-apple-red"
                        title={t('admin.partnerDetail.campaigns.unassign')}
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 border-t border-apple-hairline pt-2">
                    <div className="text-center">
                      <div className="text-sm font-medium text-apple-ink">
                        {campaign.registrations_count}
                      </div>
                      <div className="text-[10px] text-apple-faint">
                        {t('admin.partnerDetail.campaigns.registrations', 'Регистрации')}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-apple-ink">
                        {campaign.referrals_count}
                      </div>
                      <div className="text-[10px] text-apple-faint">
                        {t('admin.partnerDetail.campaigns.referrals', 'Рефералы')}
                      </div>
                    </div>
                    <div className="text-center">
                      <div
                        className={`whitespace-nowrap text-sm font-medium ${campaign.earnings_kopeks > 0 ? 'text-apple-green' : 'text-apple-mute'}`}
                      >
                        {formatWithCurrency(campaign.earnings_kopeks / 100)}
                      </div>
                      <div className="text-[10px] text-apple-faint">
                        {t('admin.partnerDetail.campaigns.earnings', 'Доход')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
          <h3 className="mb-4 font-medium text-apple-ink">
            {t('admin.partnerDetail.dangerZone.title')}
          </h3>
          <button
            onClick={() => navigate(`/admin/partners/${userId}/revoke`)}
            className="w-full rounded-xl bg-apple-red/15 px-4 py-3 text-sm font-medium text-apple-red transition-opacity hover:opacity-90"
          >
            {t('admin.partnerDetail.dangerZone.revokeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
