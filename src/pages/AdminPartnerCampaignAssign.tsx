import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { partnerApi } from '../api/partners';
import { campaignsApi } from '../api/campaigns';
import { AdminBackButton } from '../components/admin';

export default function AdminPartnerCampaignAssign() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch partner detail to know already assigned campaign IDs
  const { data: partner } = useQuery({
    queryKey: ['admin-partner-detail', userId],
    queryFn: () => partnerApi.getPartnerDetail(Number(userId)),
    enabled: !!userId,
  });

  // Fetch all campaigns
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['admin-campaigns-all'],
    queryFn: () => campaignsApi.getCampaigns(true, 0, 100),
  });

  const assignMutation = useMutation({
    mutationFn: (campaignId: number) => partnerApi.assignCampaign(Number(userId), campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partner-detail', userId] });
      navigate(`/admin/partners/${userId}`);
    },
  });

  const assignedIds = new Set(partner?.campaigns.map((c) => c.id) ?? []);
  const available =
    campaignsData?.campaigns.filter((c) => !assignedIds.has(c.id) && c.partner_user_id === null) ??
    [];
  const takenByOthers =
    campaignsData?.campaigns.filter((c) => !assignedIds.has(c.id) && c.partner_user_id !== null) ??
    [];

  const partnerName = partner
    ? partner.first_name || partner.username || `#${partner.user_id}`
    : '';

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <AdminBackButton to={`/admin/partners/${userId}`} />
        <div>
          <h1 className="text-xl font-semibold text-apple-ink">
            {t('admin.partnerDetail.campaigns.assignTitle')}
          </h1>
          {partnerName && <p className="text-sm text-apple-mute">{partnerName}</p>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
        </div>
      ) : available.length === 0 ? (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-6">
          <div className="py-4 text-center text-sm text-apple-faint">
            {t('admin.partnerDetail.campaigns.noAvailable')}
          </div>
          <button
            onClick={() => navigate(`/admin/campaigns/create?partnerId=${userId}`)}
            className="mt-2 w-full rounded-full bg-[#F97315] px-4 py-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            {t('admin.partnerDetail.campaigns.createNew')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {available.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl bg-apple-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-apple-ink">{campaign.name}</span>
                    {!campaign.is_active && (
                      <span className="rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                        {t('admin.campaigns.table.inactive')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-apple-faint">
                    <span className="font-mono">?start={campaign.start_parameter}</span>
                    <span>
                      {campaign.registrations_count}{' '}
                      {t('admin.campaigns.overview.registrations').toLowerCase()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => assignMutation.mutate(campaign.id)}
                  disabled={assignMutation.isPending}
                  className="shrink-0 rounded-full bg-[#F97315]/15 px-4 py-2 text-sm font-medium text-[#F97315] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {t('admin.partnerDetail.campaigns.assign')}
                </button>
              </div>
            </div>
          ))}

          {/* Show campaigns assigned to other partners as greyed out */}
          {takenByOthers.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl bg-apple-card p-4 opacity-50">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-apple-mute">{campaign.name}</span>
                    <span className="rounded-full bg-apple-blue/15 px-2.5 py-1 text-[11px] font-semibold text-apple-blue">
                      {campaign.partner_name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-apple-faint">
                    <span className="font-mono">?start={campaign.start_parameter}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignMutation.isError && (
        <div className="mt-4 rounded-xl bg-apple-red/10 p-3 text-sm text-apple-red">
          {t('common.error')}
        </div>
      )}
    </div>
  );
}
