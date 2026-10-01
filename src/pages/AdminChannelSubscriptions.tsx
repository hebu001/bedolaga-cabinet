import {
  ChannelIcon,
  CheckIcon,
  EditIcon,
  LinkIcon,
  PlusIcon,
  RefreshIcon,
  SettingsIcon,
  TrashIcon,
  XIcon,
} from '@/components/admin/legacyPageIcons/AdminChannelSubscriptions';
import { PageSkeleton, Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  adminChannelsApi,
  type CreateChannelRequest,
  type RequiredChannel,
  type UpdateChannelRequest,
} from '../api/adminChannels';
import { adminSettingsApi, type SettingDefinition } from '../api/adminSettings';
import { AdminBackButton } from '../components/admin';
import { Toggle } from '../components/admin/Toggle';
import { useHaptic, useNotify } from '../platform';
import { useNativeDialog } from '../platform/hooks/useNativeDialog';

// Setting toggle row for global settings
const CHANNEL_SETTING_KEYS = [
  'CHANNEL_IS_REQUIRED_SUB',
  'CHANNEL_DISABLE_TRIAL_ON_UNSUBSCRIBE',
  'CHANNEL_REQUIRED_FOR_ALL',
] as const;

type ChannelSettingKey = (typeof CHANNEL_SETTING_KEYS)[number];

const SETTING_I18N_MAP: Record<ChannelSettingKey, { label: string; desc: string }> = {
  CHANNEL_IS_REQUIRED_SUB: {
    label: 'admin.channelSubscriptions.globalSettings.channelRequired',
    desc: 'admin.channelSubscriptions.globalSettings.channelRequiredDesc',
  },
  CHANNEL_DISABLE_TRIAL_ON_UNSUBSCRIBE: {
    label: 'admin.channelSubscriptions.globalSettings.disableTrialOnUnsub',
    desc: 'admin.channelSubscriptions.globalSettings.disableTrialOnUnsubDesc',
  },
  CHANNEL_REQUIRED_FOR_ALL: {
    label: 'admin.channelSubscriptions.globalSettings.requiredForAll',
    desc: 'admin.channelSubscriptions.globalSettings.requiredForAllDesc',
  },
};

function GlobalSettingsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const notify = useNotify();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings', 'CHANNEL'],
    queryFn: () => adminSettingsApi.getSettings('CHANNEL'),
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      adminSettingsApi.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings', 'CHANNEL'] });
      haptic.impact('light');
    },
    onError: () => {
      haptic.notification('error');
      notify.error(t('common.error'));
    },
  });

  const getSettingByKey = (key: string): SettingDefinition | undefined =>
    settings?.find((s) => s.key === key);

  const isSettingEnabled = (key: string): boolean => {
    const setting = getSettingByKey(key);
    if (!setting) return false;
    return setting.current === true || setting.current === 'true';
  };

  const handleToggleSetting = (key: string) => {
    const current = isSettingEnabled(key);
    updateSettingMutation.mutate({ key, value: !current });
  };

  if (isLoading) {
    return (
      <PageSkeleton variant="admin" leading={2} titleWidth="w-56" className="space-y-6">
        <Skeleton variant="card" count={2} className="h-40" />
      </PageSkeleton>
    );
  }

  return (
    <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="text-apple-mute">
          <SettingsIcon />
        </div>
        <h2 className="text-sm font-semibold text-apple-ink">
          {t('admin.channelSubscriptions.globalSettings.title')}
        </h2>
      </div>

      <div className="space-y-1">
        {CHANNEL_SETTING_KEYS.map((key) => {
          const setting = getSettingByKey(key);
          const i18n = SETTING_I18N_MAP[key];
          const enabled = isSettingEnabled(key);
          const isUpdating = updateSettingMutation.isPending;
          const isReadOnly = setting?.read_only ?? false;

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-apple-elevated"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-apple-ink">{t(i18n.label)}</p>
                <p className="mt-0.5 text-xs text-apple-mute">{t(i18n.desc)}</p>
              </div>
              <Toggle
                checked={enabled}
                onChange={() => handleToggleSetting(key)}
                disabled={isUpdating || isReadOnly || !setting}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Channel card component
function ChannelCard({
  channel,
  onToggle,
  onDelete,
  onEdit,
  onUpdate,
}: {
  channel: RequiredChannel;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (channel: RequiredChannel) => void;
  onUpdate: (id: number, data: UpdateChannelRequest) => void;
}) {
  const { t } = useTranslation();

  const displayName = channel.title || channel.channel_id;
  const hasLink = !!channel.channel_link;

  return (
    <div
      className={`apple-card-grad rounded-2xl p-4 transition-all ${
        channel.is_active ? 'bg-apple-green/10' : 'bg-apple-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Status + sort order */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                channel.is_active
                  ? 'bg-apple-green/15 text-apple-green'
                  : 'bg-apple-elevated text-apple-mute'
              }`}
            >
              {channel.is_active
                ? t('admin.channelSubscriptions.enabled')
                : t('admin.channelSubscriptions.disabled')}
            </span>
            <span className="text-xs text-apple-mute">#{channel.id}</span>
            <span className="text-xs text-apple-faint">
              {t('admin.channelSubscriptions.sortOrder')}: {channel.sort_order}
            </span>
          </div>

          {/* Title / channel_id */}
          <p className="text-sm font-medium text-apple-ink">{displayName}</p>

          {/* Channel ID (if title exists, show ID separately) */}
          {channel.title && <p className="mt-0.5 text-xs text-apple-mute">{channel.channel_id}</p>}

          {/* Link */}
          {hasLink && (
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              <LinkIcon className="h-4 w-4" />
              <a
                href={channel.channel_link!}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline"
              >
                {channel.channel_link}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Per-channel disable toggles */}
      <div className="mt-3 space-y-2 border-t border-apple-hairline pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-apple-mute">
              {t('admin.channelSubscriptions.perChannel.disableTrial')}
            </p>
            <p className="text-xs text-apple-faint">
              {t('admin.channelSubscriptions.perChannel.disableTrialDesc')}
            </p>
          </div>
          <Toggle
            checked={channel.disable_trial_on_leave}
            onChange={() =>
              onUpdate(channel.id, {
                disable_trial_on_leave: !channel.disable_trial_on_leave,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-apple-mute">
              {t('admin.channelSubscriptions.perChannel.disablePaid')}
            </p>
            <p className="text-xs text-apple-faint">
              {t('admin.channelSubscriptions.perChannel.disablePaidDesc')}
            </p>
          </div>
          <Toggle
            checked={channel.disable_paid_on_leave}
            onChange={() =>
              onUpdate(channel.id, {
                disable_paid_on_leave: !channel.disable_paid_on_leave,
              })
            }
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-apple-hairline pt-3">
        <button
          onClick={() => onEdit(channel)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(249,115,21,0.15)', color: '#F97315' }}
        >
          <EditIcon />
          {t('admin.channelSubscriptions.edit')}
        </button>

        {channel.is_active ? (
          <button
            onClick={() => onToggle(channel.id)}
            className="flex items-center gap-1.5 rounded-full bg-apple-amber/15 px-3 py-1.5 text-xs text-apple-amber transition-opacity hover:opacity-80"
          >
            <XIcon />
            {t('admin.channelSubscriptions.disable')}
          </button>
        ) : (
          <button
            onClick={() => onToggle(channel.id)}
            className="flex items-center gap-1.5 rounded-full bg-apple-green/15 px-3 py-1.5 text-xs text-apple-green transition-opacity hover:opacity-80"
          >
            <CheckIcon />
            {t('admin.channelSubscriptions.enable')}
          </button>
        )}

        <button
          onClick={() => onDelete(channel.id)}
          className="flex items-center gap-1.5 rounded-full bg-apple-red/15 px-3 py-1.5 text-xs text-apple-red transition-opacity hover:opacity-80"
        >
          <TrashIcon className="h-4 w-4" />
          {t('admin.channelSubscriptions.delete')}
        </button>
      </div>
    </div>
  );
}

// Shared form fields component
function ChannelFormFields({
  channelId,
  setChannelId,
  title,
  setTitle,
  channelLink,
  setChannelLink,
  sortOrder,
  setSortOrder,
  showChannelId,
  showSortOrder,
}: {
  channelId: string;
  setChannelId: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  channelLink: string;
  setChannelLink: (v: string) => void;
  sortOrder: string;
  setSortOrder: (v: string) => void;
  showChannelId: boolean;
  showSortOrder: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      {showChannelId && (
        <div>
          <label className="mb-1 block text-[13px] font-medium text-apple-mute">
            {t('admin.channelSubscriptions.form.channelId')} *
          </label>
          <input
            type="text"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder={t('admin.channelSubscriptions.form.channelIdHint')}
            className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
            autoFocus
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-[13px] font-medium text-apple-mute">
          {t('admin.channelSubscriptions.form.title')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('admin.channelSubscriptions.form.title')}
          className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
          autoFocus={!showChannelId}
        />
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-apple-mute">
          {t('admin.channelSubscriptions.form.channelLink')}
        </label>
        <input
          type="text"
          value={channelLink}
          onChange={(e) => setChannelLink(e.target.value)}
          placeholder={t('admin.channelSubscriptions.form.channelLinkHint')}
          className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
        />
      </div>

      {showSortOrder && (
        <div>
          <label className="mb-1 block text-[13px] font-medium text-apple-mute">
            {t('admin.channelSubscriptions.sortOrder')}
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
          />
        </div>
      )}
    </>
  );
}

// Add channel form component
function AddChannelForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (data: CreateChannelRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [channelId, setChannelId] = useState('');
  const [channelLink, setChannelLink] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = () => {
    if (!channelId.trim()) return;
    onSubmit({
      channel_id: channelId.trim(),
      channel_link: channelLink.trim() || undefined,
      title: title.trim() || undefined,
    });
  };

  return (
    <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
      <div className="space-y-3">
        <ChannelFormFields
          channelId={channelId}
          setChannelId={setChannelId}
          title={title}
          setTitle={setTitle}
          channelLink={channelLink}
          setChannelLink={setChannelLink}
          sortOrder=""
          setSortOrder={() => {}}
          showChannelId
          showSortOrder={false}
        />

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={!channelId.trim() || isLoading}
            className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckIcon />
            {t('admin.channelSubscriptions.form.submit')}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-full bg-apple-elevated px-4 py-2 text-sm text-apple-mute transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XIcon />
            {t('admin.channelSubscriptions.form.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit channel form component
function EditChannelForm({
  channel,
  onSubmit,
  onCancel,
  isLoading,
}: {
  channel: RequiredChannel;
  onSubmit: (id: number, data: UpdateChannelRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(channel.title ?? '');
  const [channelLink, setChannelLink] = useState(channel.channel_link ?? '');
  const [sortOrder, setSortOrder] = useState(String(channel.sort_order));

  const handleSubmit = () => {
    const updates: UpdateChannelRequest = {};
    const newTitle = title.trim() || undefined;
    const newLink = channelLink.trim() || undefined;
    const newSort = parseInt(sortOrder, 10);

    if (newTitle !== (channel.title ?? undefined))
      updates.title = newTitle ?? (null as unknown as string);
    if (newLink !== (channel.channel_link ?? undefined))
      updates.channel_link = newLink ?? (null as unknown as string);
    if (!isNaN(newSort) && newSort !== channel.sort_order) updates.sort_order = newSort;

    onSubmit(channel.id, updates);
  };

  return (
    <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
      <p className="mb-3 text-xs text-apple-mute">
        {t('admin.channelSubscriptions.editing')}:{' '}
        <code className="text-apple-ink">{channel.channel_id}</code>
      </p>
      <div className="space-y-3">
        <ChannelFormFields
          channelId=""
          setChannelId={() => {}}
          title={title}
          setTitle={setTitle}
          channelLink={channelLink}
          setChannelLink={setChannelLink}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          showChannelId={false}
          showSortOrder
        />

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckIcon />
            {t('admin.channelSubscriptions.form.save')}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-full bg-apple-elevated px-4 py-2 text-sm text-apple-mute transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XIcon />
            {t('admin.channelSubscriptions.form.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main component
export default function AdminChannelSubscriptions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const notify = useNotify();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<RequiredChannel | null>(null);

  // Fetch channels
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-channels'],
    queryFn: adminChannelsApi.list,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => adminChannelsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-channels'] });
      haptic.impact('light');
    },
    onError: () => {
      haptic.notification('error');
      notify.error(t('common.error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminChannelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-channels'] });
      haptic.impact('medium');
    },
    onError: () => {
      haptic.notification('error');
      notify.error(t('common.error'));
    },
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateChannelRequest) => adminChannelsApi.create(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-channels'] });
      setShowAddForm(false);
      haptic.impact('light');
    },
    onError: () => {
      haptic.notification('error');
      notify.error(t('common.error'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateChannelRequest }) =>
      adminChannelsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-channels'] });
      setEditingChannel(null);
      haptic.impact('light');
    },
    onError: () => {
      haptic.notification('error');
      notify.error(t('common.error'));
    },
  });

  const handleToggle = (id: number) => {
    toggleMutation.mutate(id);
  };

  const { confirm: confirmDialog } = useNativeDialog();

  const handleDelete = async (id: number) => {
    if (await confirmDialog(t('admin.channelSubscriptions.deleteConfirm'))) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreate = (data: CreateChannelRequest) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (id: number, data: UpdateChannelRequest) => {
    updateMutation.mutate({ id, data });
  };

  const handleEdit = (channel: RequiredChannel) => {
    setEditingChannel(channel);
    setShowAddForm(false);
  };

  const channels = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          <AdminBackButton />
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2">
              <ChannelIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-apple-ink">
                {t('admin.channelSubscriptions.title')}
              </h1>
              <p className="text-sm text-apple-mute">{t('admin.channelSubscriptions.subtitle')}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            aria-label={t('common.refresh')}
            className="rounded-lg bg-apple-card p-2 text-apple-mute transition-colors hover:text-apple-ink"
          >
            <RefreshIcon />
          </button>
          {!showAddForm && !editingChannel && (
            <button
              onClick={() => setShowAddForm(true)}
              aria-label={t('admin.channelSubscriptions.addChannel')}
              className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-white transition-opacity hover:opacity-90"
            >
              <PlusIcon />
              <span className="hidden sm:inline">{t('admin.channelSubscriptions.addChannel')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Global channel settings */}
      <GlobalSettingsSection />

      {/* Add form */}
      {showAddForm && (
        <AddChannelForm
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit form */}
      {editingChannel && (
        <EditChannelForm
          channel={editingChannel}
          onSubmit={handleUpdate}
          onCancel={() => setEditingChannel(null)}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Channel list */}
      {isLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : channels.length === 0 ? (
        <div className="apple-card-grad rounded-2xl bg-apple-card p-8 text-center text-apple-mute">
          <div className="mx-auto mb-2 w-fit">
            <ChannelIcon className="h-6 w-6" />
          </div>
          <p>{t('admin.channelSubscriptions.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((channel: RequiredChannel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
