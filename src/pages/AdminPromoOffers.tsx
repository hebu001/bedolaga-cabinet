import {
BackIcon,
ClockIcon,
EditIcon,
SendIcon,
UserIcon,
} from '@/components/admin/legacyPageIcons/AdminPromoOffers';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
OFFER_TYPE_CONFIG,
promoOffersApi,
type OfferType,
type PromoOfferLog,
} from '../api/promoOffers';
import i18n from '../i18n';
import { usePlatform } from '../platform/hooks/usePlatform';

import { Skeleton,SkeletonGroup } from '@/components/ui/skeleton';

// Helper functions
const formatDateTime = (date: string | null): string => {
  if (!date) return '-';
  const localeMap: Record<string, string> = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', fa: 'fa-IR' };
  const locale = localeMap[i18n.language] || 'ru-RU';
  return new Date(date).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    created: i18n.t('admin.promoOffers.actions.created'),
    claimed: i18n.t('admin.promoOffers.actions.claimed'),
    consumed: i18n.t('admin.promoOffers.actions.consumed'),
    disabled: i18n.t('admin.promoOffers.actions.disabled'),
  };
  return labels[action] || action;
};

const getActionColor = (action: string): string => {
  const colors: Record<string, string> = {
    created: 'bg-[#F97315]/15 text-[#F97315]',
    claimed: 'bg-apple-green/15 text-apple-green',
    consumed: 'bg-[#F97315]/15 text-[#F97315]',
    disabled: 'bg-apple-elevated text-apple-mute',
  };
  return colors[action] || 'bg-apple-elevated text-apple-mute';
};

const getOfferTypeIcon = (offerType: string): string => {
  return OFFER_TYPE_CONFIG[offerType as OfferType]?.icon || '🎁';
};

const getOfferTypeLabel = (offerType: string): string => {
  const config = OFFER_TYPE_CONFIG[offerType as OfferType];
  return config ? i18n.t(config.labelKey) : offerType;
};

export default function AdminPromoOffers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { capabilities } = usePlatform();

  const [activeTab, setActiveTab] = useState<'templates' | 'logs'>('templates');

  // Queries
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['admin-promo-templates'],
    queryFn: promoOffersApi.getTemplates,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-promo-logs'],
    queryFn: () => promoOffersApi.getLogs({ limit: 100 }),
    enabled: activeTab === 'logs',
  });

  const templates = templatesData?.items || [];
  const logs = logsData?.items || [];

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
            <h1 className="text-xl font-semibold text-apple-ink">{t('admin.promoOffers.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.promoOffers.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/promo-offers/send')}
          className="flex items-center justify-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-white transition-opacity hover:opacity-90"
        >
          <SendIcon />
          {t('admin.promoOffers.sendButton')}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex w-fit gap-1 rounded-xl bg-apple-card p-1">
        <button
          onClick={() => setActiveTab('templates')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'templates'
              ? 'bg-apple-elevated text-apple-ink'
              : 'text-apple-mute hover:text-apple-ink'
          }`}
        >
          {t('admin.promoOffers.tabs.templates', { count: templates.length })}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-apple-elevated text-apple-ink'
              : 'text-apple-mute hover:text-apple-ink'
          }`}
        >
          {t('admin.promoOffers.tabs.logs')}
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <>
          {templatesLoading ? (
            <SkeletonGroup className="space-y-3">
              <Skeleton variant="card" count={3} className="h-16" />
            </SkeletonGroup>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-apple-mute">{t('admin.promoOffers.noData.templates')}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`apple-card-grad rounded-2xl bg-apple-card p-4 ${
                    template.is_active ? '' : 'opacity-60'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getOfferTypeIcon(template.offer_type)}</span>
                      <div>
                        <h3 className="font-medium text-apple-ink">{template.name}</h3>
                        <span className="text-xs text-apple-faint">
                          {getOfferTypeLabel(template.offer_type)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/admin/promo-offers/templates/${template.id}/edit`)}
                      className="rounded-lg bg-apple-elevated p-2 text-apple-mute transition-colors hover:text-apple-ink"
                    >
                      <EditIcon />
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    {template.discount_percent > 0 && (
                      <div className="flex justify-between">
                        <span className="text-apple-mute">
                          {t('admin.promoOffers.table.discount')}:
                        </span>
                        <span className="font-medium" style={{ color: '#F97315' }}>
                          {template.discount_percent}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-apple-mute">
                        {t('admin.promoOffers.table.offerDuration')}:
                      </span>
                      <span className="text-apple-ink">
                        {t('admin.promoOffers.table.hoursShort', { hours: template.valid_hours })}
                      </span>
                    </div>
                    {template.active_discount_hours && (
                      <div className="flex justify-between">
                        <span className="text-apple-mute">
                          {t('admin.promoOffers.table.discountDuration')}:
                        </span>
                        <span className="text-apple-ink">
                          {t('admin.promoOffers.table.hoursShort', {
                            hours: template.active_discount_hours,
                          })}
                        </span>
                      </div>
                    )}
                    {template.test_duration_hours && (
                      <div className="flex justify-between">
                        <span className="text-apple-mute">
                          {t('admin.promoOffers.table.testAccess')}:
                        </span>
                        <span className="text-apple-ink">
                          {t('admin.promoOffers.table.hoursShort', {
                            hours: template.test_duration_hours,
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 border-t border-apple-hairline pt-3">
                    <div className="flex items-center gap-2">
                      {template.is_active ? (
                        <span className="rounded-full bg-apple-green/15 px-2.5 py-1 text-[11px] font-semibold text-apple-green">
                          {t('admin.promoOffers.status.active')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                          {t('admin.promoOffers.status.inactive')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <>
          {logsLoading ? (
            <SkeletonGroup className="space-y-3">
              <Skeleton variant="card" count={3} className="h-16" />
            </SkeletonGroup>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-apple-mute">{t('admin.promoOffers.noData.logs')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log: PromoOfferLog) => (
                <div key={log.id} className="apple-card-grad rounded-2xl bg-apple-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-apple-elevated">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-medium text-apple-ink">
                            {log.user?.full_name ||
                              log.user?.username ||
                              (log.user_id ? `#${log.user_id}` : '—')}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getActionColor(log.action)}`}
                          >
                            {getActionLabel(log.action)}
                          </span>
                        </div>
                        <div className="text-sm text-apple-mute">
                          {log.source && <span>{getOfferTypeLabel(log.source)}</span>}
                          {log.percent != null && log.percent > 0 && (
                            <span className="ml-2">{log.percent}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pl-[3.25rem] text-xs text-apple-faint sm:pl-0">
                      <ClockIcon className="h-4 w-4" />
                      {formatDateTime(log.created_at)}
                    </div>
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
