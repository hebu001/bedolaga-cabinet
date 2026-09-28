import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  promoOffersApi,
  type PromoOfferBroadcastRequest,
  TARGET_SEGMENTS,
  type TargetSegment,
  OFFER_TYPE_CONFIG,
  type OfferType,
} from '../api/promoOffers';
import { adminBroadcastsApi } from '../api/adminBroadcasts';
import { adminUsersApi, type UserListItem } from '../api/adminUsers';
import { AdminBackButton } from '../components/admin';
import {
  BroadcastDeliveryStats,
  BroadcastStatusBadge,
} from '../components/broadcasts/BroadcastDeliveryStats';
import { broadcastPollInterval } from '../utils/broadcastStatus';
import { getApiErrorMessage } from '../utils/api-error';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import {
  SendIcon,
  CheckIcon,
  UsersIcon,
  UserIcon,
  SearchIcon,
  CloseIcon,
  XIcon,
} from '@/components/icons';

const getOfferTypeIcon = (offerType: string): string => {
  return OFFER_TYPE_CONFIG[offerType as OfferType]?.icon || '🎁';
};

export default function AdminPromoOfferSend() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [sendMode, setSendMode] = useState<'segment' | 'user'>('segment');
  const [selectedTarget, setSelectedTarget] = useState<TargetSegment>('active');
  const [userId, setUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{
    title: string;
    message: string;
    isSuccess: boolean;
    broadcastId?: number | null;
  } | null>(null);

  // Query templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['admin-promo-templates'],
    queryFn: promoOffersApi.getTemplates,
  });

  // Recipient counts per segment — админ видит охват до отправки
  const { data: segmentsData } = useQuery({
    queryKey: ['admin-promo-segments'],
    queryFn: promoOffersApi.getSegments,
    staleTime: 60000,
  });

  const segmentCounts = new Map(
    (segmentsData?.segments || []).map((segment) => [segment.key, segment.count]),
  );
  const selectedSegmentCount = segmentCounts.get(selectedTarget);

  // Delivery progress of the offer we have just sent
  const broadcastId = result?.broadcastId ?? null;
  const { data: delivery } = useQuery({
    queryKey: ['admin', 'broadcasts', 'detail', broadcastId],
    queryFn: async () => adminBroadcastsApi.get(broadcastId as number),
    enabled: broadcastId !== null,
    refetchInterval: (query) => broadcastPollInterval(query.state.data?.status),
  });

  const templates = templatesData?.items || [];
  const activeTemplates = templates.filter((t) => t.is_active);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Set default template when loaded
  if (!selectedTemplateId && activeTemplates.length > 0) {
    setSelectedTemplateId(activeTemplates[0].id);
  }

  // User search query with debounce
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['admin-users-search', searchQuery],
    queryFn: () => adminUsersApi.getUsers({ search: searchQuery, limit: 10 }),
    enabled: searchQuery.length >= 2 && sendMode === 'user',
    staleTime: 30000,
  });

  // Filter users with telegram_id only
  const filteredUsers = (searchResults?.users || []).filter((u) => u.telegram_id);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle user selection
  const handleSelectUser = (user: UserListItem) => {
    setSelectedUser(user);
    setUserId(user.telegram_id.toString());
    setSearchQuery('');
    setShowDropdown(false);
  };

  // Clear selected user
  const handleClearUser = () => {
    setSelectedUser(null);
    setUserId('');
    setSearchQuery('');
  };

  // Broadcast mutation
  const broadcastMutation = useMutation({
    mutationFn: promoOffersApi.broadcastOffer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo-logs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });

      let message = t('admin.promoOffers.result.offersCreated', { count: data.created_offers });
      if (data.notifications_sent > 0 || data.notifications_failed > 0) {
        message +=
          '\n' +
          t('admin.promoOffers.result.notificationsSent', { count: data.notifications_sent });
        if (data.notifications_failed > 0) {
          message +=
            ' ' +
            t('admin.promoOffers.result.notificationsFailed', {
              count: data.notifications_failed,
            });
        }
      }

      setResult({
        title: t('admin.promoOffers.result.sentTitle'),
        message,
        isSuccess: true,
        broadcastId: data.broadcast_id,
      });
    },
    onError: (error: unknown) => {
      setResult({
        title: t('common.error'),
        message: getApiErrorMessage(error, t('admin.promoOffers.result.sendError')),
        isSuccess: false,
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedTemplateId || !selectedTemplate) return;

    const data: PromoOfferBroadcastRequest = {
      notification_type: selectedTemplate.offer_type,
      valid_hours: selectedTemplate.valid_hours,
      discount_percent: selectedTemplate.discount_percent,
      effect_type:
        selectedTemplate.offer_type === 'test_access' ? 'test_access' : 'percent_discount',
      extra_data: {
        template_id: selectedTemplate.id,
        active_discount_hours: selectedTemplate.active_discount_hours,
        test_duration_hours: selectedTemplate.test_duration_hours,
        test_squad_uuids: selectedTemplate.test_squad_uuids,
      },
      send_notification: true,
      message_text: selectedTemplate.message_text,
      button_text: selectedTemplate.button_text,
    };

    if (sendMode === 'user') {
      const id = parseInt(userId);
      if (!id) return;
      data.telegram_id = id;
    } else {
      data.target = selectedTarget;
    }

    broadcastMutation.mutate(data);
  };

  const isValid = () => {
    if (!selectedTemplateId) return false;
    if (sendMode === 'user' && !userId.trim()) return false;
    return true;
  };

  if (isLoading) {
    return (
      <PageSkeleton
        variant="admin"
        leading={2}
        titleWidth="w-56"
        className="mx-auto max-w-2xl space-y-6"
      >
        <Skeleton variant="card" className="h-96" />
      </PageSkeleton>
    );
  }

  // Result screen
  if (result) {
    return (
      <div className="animate-fade-in">
        <div className="mx-auto max-w-2xl py-12 text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              result.isSuccess ? 'bg-apple-green/15' : 'bg-apple-red/15'
            }`}
          >
            {result.isSuccess ? (
              <CheckIcon className="h-8 w-8 text-apple-green" />
            ) : (
              <XIcon className="h-8 w-8 text-apple-red" />
            )}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-apple-ink">{result.title}</h3>
          <p className="mb-6 whitespace-pre-wrap text-apple-mute">{result.message}</p>

          {/* Прогресс доставки в Telegram: сколько дошло, кто заблокировал бота */}
          {delivery && (
            <div className="mb-6 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-apple-mute">
                  {t('admin.promoOffers.result.deliveryTitle')}
                </span>
                <BroadcastStatusBadge status={delivery.status} />
              </div>
              <BroadcastDeliveryStats
                status={delivery.status}
                progressPercent={delivery.progress_percent}
                totalCount={delivery.total_count}
                sentCount={delivery.sent_count}
                blockedCount={delivery.blocked_count}
                failedCount={delivery.failed_count}
              />
              <button
                onClick={() => navigate(`/admin/broadcasts/${delivery.id}`)}
                className="text-sm text-[#F97315] transition-colors hover:text-accent-300"
              >
                {t('admin.promoOffers.result.openAsBroadcast')}
              </button>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('/admin/promo-offers')}
              className="rounded-lg bg-[#F97315] px-6 py-2 text-white transition-colors hover:bg-accent-600"
            >
              {t('admin.promoOffers.backToList')}
            </button>
            {result.isSuccess && (
              <button
                onClick={() => setResult(null)}
                className="rounded-full bg-apple-elevated px-6 py-2 text-apple-mute transition-colors hover:opacity-90"
              >
                {t('admin.promoOffers.sendAnother')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <AdminBackButton to="/admin/promo-offers" />
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#F97315]/15 p-2" style={{ color: '#F97315' }}>
            <SendIcon />
          </div>
          <h1 className="text-xl font-semibold text-apple-ink">
            {t('admin.promoOffers.send.title')}
          </h1>
        </div>
      </div>

      {activeTemplates.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-apple-mute">{t('admin.promoOffers.noActiveTemplates')}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Template Selection */}
          <div className="apple-card-grad rounded-2xl bg-apple-card p-6">
            <label
              id="po-template-label"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.promoOffers.send.offerTemplate')}
              <span className="text-apple-red">*</span>
            </label>
            <div className="space-y-2" role="radiogroup" aria-labelledby="po-template-label">
              {activeTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedTemplateId === template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full rounded-xl p-4 text-left transition-colors ${
                    selectedTemplateId === template.id
                      ? 'bg-[#F97315]/10 ring-1 ring-[#F97315]'
                      : 'bg-apple-elevated hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getOfferTypeIcon(template.offer_type)}</span>
                    <div className="flex-1">
                      <div className="font-medium text-apple-ink">{template.name}</div>
                      <div className="text-sm text-apple-mute">
                        {template.discount_percent > 0 &&
                          t('admin.promoOffers.send.discountLabel', {
                            percent: template.discount_percent,
                          })}
                        {template.offer_type === 'test_access' &&
                          t('admin.promoOffers.offerType.testAccess')}
                        <span className="mx-1">•</span>
                        {t('admin.promoOffers.send.hoursToActivate', {
                          hours: template.valid_hours,
                        })}
                      </div>
                    </div>
                    {selectedTemplateId === template.id && (
                      <div style={{ color: '#F97315' }}>
                        <CheckIcon />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Send Mode */}
          <div className="apple-card-grad rounded-2xl bg-apple-card p-6">
            <label
              id="po-sendmode-label"
              className="mb-2 block text-[13px] font-medium text-apple-mute"
            >
              {t('admin.promoOffers.send.sendTo')}
              <span className="text-apple-red">*</span>
            </label>
            <div className="mb-4 flex gap-2" role="radiogroup" aria-labelledby="po-sendmode-label">
              <button
                type="button"
                role="radio"
                aria-checked={sendMode === 'segment'}
                onClick={() => setSendMode('segment')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  sendMode === 'segment'
                    ? 'bg-[#F97315]/10 ring-1 ring-[#F97315]'
                    : 'bg-apple-elevated text-apple-mute hover:opacity-90'
                }`}
                style={sendMode === 'segment' ? { color: '#F97315' } : undefined}
              >
                <UsersIcon />
                <span>{t('admin.promoOffers.send.segment')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={sendMode === 'user'}
                onClick={() => setSendMode('user')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  sendMode === 'user'
                    ? 'bg-[#F97315]/10 ring-1 ring-[#F97315]'
                    : 'bg-apple-elevated text-apple-mute hover:opacity-90'
                }`}
                style={sendMode === 'user' ? { color: '#F97315' } : undefined}
              >
                <UserIcon />
                <span>{t('admin.promoOffers.send.user')}</span>
              </button>
            </div>

            {sendMode === 'segment' ? (
              <>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value as TargetSegment)}
                  className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                >
                  {Object.entries(TARGET_SEGMENTS).map(([key, labelKey]) => {
                    const count = segmentCounts.get(key);
                    return (
                      <option key={key} value={key}>
                        {count === undefined
                          ? t(labelKey)
                          : `${t(labelKey)} — ${count} ${t('admin.broadcasts.recipients')}`}
                      </option>
                    );
                  })}
                </select>
                {selectedSegmentCount !== undefined && (
                  <div className="mt-2 text-sm text-apple-mute">
                    {t('admin.broadcasts.willBeSent')}:{' '}
                    <strong className="text-[#F97315]">{selectedSegmentCount}</strong>
                  </div>
                )}
              </>
            ) : (
              <div ref={searchRef} className="relative">
                {selectedUser ? (
                  // Selected user display
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[#F97315] bg-[#F97315]/10 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dark-600">
                        <UserIcon />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-apple-ink">
                          {selectedUser.full_name ||
                            selectedUser.username ||
                            `ID: ${selectedUser.telegram_id}`}
                        </div>
                        <div className="text-xs text-apple-mute">
                          {selectedUser.username && `@${selectedUser.username} · `}
                          Telegram: {selectedUser.telegram_id}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleClearUser}
                      className="rounded-lg p-1.5 text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  // Search input
                  <>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-apple-mute">
                        <SearchIcon className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder={t('admin.promoOffers.send.searchUserPlaceholder')}
                        className="w-full rounded-xl bg-apple-elevated px-4 py-3 pl-10 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
                        </div>
                      )}
                    </div>

                    {/* Dropdown results */}
                    {showDropdown && searchQuery.length >= 2 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl bg-apple-card shadow-xl">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => handleSelectUser(user)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-apple-elevated"
                            >
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-apple-elevated">
                                <UserIcon />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-apple-ink">
                                  {user.full_name || user.username || `User #${user.id}`}
                                </div>
                                <div className="truncate text-xs text-apple-mute">
                                  {user.username && `@${user.username} · `}
                                  Telegram: {user.telegram_id}
                                </div>
                              </div>
                              {user.has_subscription && (
                                <span className="flex-shrink-0 rounded-full bg-apple-green/15 px-2.5 py-1 text-[11px] font-semibold text-apple-green">
                                  {t('admin.promoOffers.send.hasSubscription')}
                                </span>
                              )}
                            </button>
                          ))
                        ) : !isSearching ? (
                          <div className="px-3 py-4 text-center text-sm text-apple-mute">
                            {t('admin.promoOffers.send.noUsersFound')}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Preview */}
          {selectedTemplate && (
            <div className="apple-card-grad rounded-2xl bg-apple-card p-6">
              <h4 className="mb-2 text-[13px] font-medium text-apple-mute">
                {t('admin.promoOffers.send.preview')}
              </h4>
              <div className="rounded-xl bg-apple-elevated p-4">
                <div className="whitespace-pre-wrap text-sm text-apple-ink">
                  {selectedTemplate.message_text}
                </div>
                <div className="mt-4">
                  <span className="inline-block rounded-full bg-[#F97315] px-4 py-2 text-sm text-white">
                    {selectedTemplate.button_text}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => navigate('/admin/promo-offers')}
              className="rounded-full bg-apple-elevated px-4 py-2 text-sm font-medium text-apple-mute transition-colors hover:opacity-90"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid() || broadcastMutation.isPending}
              className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendIcon />
              {broadcastMutation.isPending
                ? t('admin.promoOffers.send.sending')
                : t('admin.promoOffers.send.sendButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
