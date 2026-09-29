import { ChevronRightIcon } from '@/components/admin/legacyIcons';
import { SettingsIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
partnerApi,
type AdminPartnerApplicationItem,
type AdminPartnerItem,
} from '../api/partners';
import { AdminBackButton } from '../components/admin';
import { useCurrency } from '../hooks/useCurrency';

import { Skeleton,SkeletonGroup } from '@/components/ui/skeleton';

export default function AdminPartners() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatWithCurrency } = useCurrency();

  const [activeTab, setActiveTab] = useState<'partners' | 'applications'>('partners');

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['admin-partner-stats'],
    queryFn: () => partnerApi.getStats(),
  });

  const { data: partnersData, isLoading: partnersLoading } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => partnerApi.getPartners(),
  });

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery({
    queryKey: ['admin-partner-applications'],
    queryFn: () => partnerApi.getApplications({ status: 'pending' }),
  });

  const partners = partnersData?.items || [];
  const applications = applicationsData?.items || [];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <AdminBackButton to="/admin" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-apple-ink">{t('admin.partners.title')}</h1>
          <p className="text-sm text-apple-mute">{t('admin.partners.subtitle')}</p>
        </div>
        <button
          onClick={() => navigate('/admin/partners/settings')}
          className="rounded-full bg-apple-card p-2 text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink"
          title={t('admin.partners.settings')}
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-ink">{stats.total_partners}</div>
            <div className="text-sm text-apple-mute">{t('admin.partners.totalPartners')}</div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-[#F97315]">{stats.pending_applications}</div>
            <div className="text-sm text-apple-mute">{t('admin.partners.pendingApplications')}</div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-ink">{stats.total_referrals}</div>
            <div className="text-sm text-apple-mute">{t('admin.partners.totalReferrals')}</div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-green">
              {formatWithCurrency(stats.total_earnings_kopeks / 100)}
            </div>
            <div className="text-sm text-apple-mute">{t('admin.partners.totalEarnings')}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-apple-card p-1">
        <button
          onClick={() => setActiveTab('partners')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'partners'
              ? 'bg-apple-elevated text-apple-ink'
              : 'text-apple-mute hover:text-apple-ink'
          }`}
        >
          {t('admin.partners.tabs.partners')}
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'applications'
              ? 'bg-apple-elevated text-apple-ink'
              : 'text-apple-mute hover:text-apple-ink'
          }`}
        >
          {t('admin.partners.tabs.applications')}
          {applications.length > 0 && (
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-xs"
              style={{ backgroundColor: 'rgba(249, 115, 21, 0.2)', color: '#F97315' }}
            >
              {applications.length}
            </span>
          )}
        </button>
      </div>

      {/* Partners Tab */}
      {activeTab === 'partners' && (
        <>
          {partnersLoading ? (
            <SkeletonGroup className="space-y-3">
              <Skeleton variant="card" count={3} className="h-16" />
            </SkeletonGroup>
          ) : partners.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-apple-mute">{t('admin.partners.noPartners')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {partners.map((partner: AdminPartnerItem) => (
                <button
                  key={partner.user_id}
                  onClick={() => navigate(`/admin/partners/${partner.user_id}`)}
                  className="apple-card-grad w-full rounded-2xl bg-apple-card p-4 text-left transition-colors hover:bg-apple-elevated"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <h3 className="min-w-0 font-medium text-apple-ink [overflow-wrap:anywhere]">
                          {partner.first_name || partner.username || `#${partner.user_id}`}
                        </h3>
                        {partner.username && (
                          <span className="min-w-0 text-sm text-apple-faint [overflow-wrap:anywhere]">
                            @{partner.username}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-apple-mute">
                        <span>
                          {t('admin.partners.commission', {
                            percent: partner.commission_percent ?? 0,
                          })}
                        </span>
                        <span>
                          {t('admin.partners.referrals', { count: partner.total_referrals })}
                        </span>
                        <span className="text-apple-green">
                          {formatWithCurrency(partner.total_earnings_kopeks / 100)}
                        </span>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-apple-faint" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <>
          {applicationsLoading ? (
            <SkeletonGroup className="space-y-3">
              <Skeleton variant="card" count={3} className="h-16" />
            </SkeletonGroup>
          ) : applications.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-apple-mute">{t('admin.partners.noApplications')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app: AdminPartnerApplicationItem) => (
                <div key={app.id} className="apple-card-grad rounded-2xl bg-apple-card p-4">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <h3 className="min-w-0 font-medium text-apple-ink [overflow-wrap:anywhere]">
                          {app.first_name || app.username || `#${app.user_id}`}
                        </h3>
                        {app.username && (
                          <span className="min-w-0 text-sm text-apple-faint [overflow-wrap:anywhere]">
                            @{app.username}
                          </span>
                        )}
                      </div>
                      {app.company_name && (
                        <div className="text-sm text-apple-mute">{app.company_name}</div>
                      )}
                    </div>
                  </div>

                  {/* Application details */}
                  <div className="mb-3 space-y-1 text-sm text-apple-mute">
                    {app.website_url && (
                      <div>
                        {t('admin.partners.applicationFields.website')}: {app.website_url}
                      </div>
                    )}
                    {app.telegram_channel && (
                      <div>
                        {t('admin.partners.applicationFields.channel')}: {app.telegram_channel}
                      </div>
                    )}
                    {app.description && (
                      <div>
                        {t('admin.partners.applicationFields.description')}: {app.description}
                      </div>
                    )}
                    {app.expected_monthly_referrals != null && (
                      <div>
                        {t('admin.partners.applicationFields.expectedReferrals')}:{' '}
                        {app.expected_monthly_referrals}
                      </div>
                    )}
                    {app.desired_commission_percent != null && (
                      <div>
                        {t('admin.partners.applicationFields.desiredCommission')}:{' '}
                        {app.desired_commission_percent}%
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        navigate(`/admin/partners/applications/${app.id}/review`, {
                          state: { application: app },
                        })
                      }
                      className="flex-1 rounded-full bg-[#F97315] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      {t('admin.partners.actions.review')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
