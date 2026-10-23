import { integrationCapabilities } from '@/config/integrationCapabilities';
import { LegacyBroadcastTargetPicker } from '../components/broadcasts/LegacyBroadcastTargetPicker';
import {
  BroadcastIcon,
  DocumentIcon,
  EmailIcon,
  PhotoIcon,
  RefreshIcon,
  TelegramIcon,
  VideoIcon,
  XIcon,
} from '@/components/admin/legacyPageIcons/AdminBroadcastCreate';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  adminBroadcastsApi,
  emailUserTarget,
  type BroadcastFilter,
  type CombinedBroadcastCreateRequest,
  type CustomBroadcastButton,
} from '../api/adminBroadcasts';
import { AdminBackButton } from '../components/admin';
import {
  BroadcastAudienceEditor,
  emptyAudience,
  isAudienceComplete,
} from '../components/broadcasts/BroadcastAudienceEditor';
import { EmailPreview, TelegramPreview } from '../components/broadcasts/BroadcastPreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../components/primitives/Dialog';

/** `?email_user=<id>` opens an Email broadcast for one user from their profile. */
function parseEmailUserParam(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

export default function AdminBroadcastCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const presetEmailUserId = parseEmailUserParam(searchParams.get('email_user'));
  // Почту кладёт в state карточка пользователя; после перезагрузки остаётся только id.
  const presetEmailUserLabel =
    (location.state as { emailUserLabel?: string } | null)?.emailUserLabel ?? null;

  // Channel toggles (both can be enabled)
  const [telegramEnabled, setTelegramEnabled] = useState(presetEmailUserId === null);
  const [emailEnabled, setEmailEnabled] = useState(presetEmailUserId !== null);

  const advancedAudience = integrationCapabilities.broadcastAudience;
  const [telegramTarget, setTelegramTarget] = useState('');
  const [emailTarget, setEmailTarget] = useState(
    presetEmailUserId !== null ? emailUserTarget(presetEmailUserId) : '',
  );
  const singleUserEmailFilter = useMemo<BroadcastFilter | null>(
    () =>
      presetEmailUserId === null
        ? null
        : {
            key: emailUserTarget(presetEmailUserId),
            label: t('admin.broadcasts.singleUser', {
              name: presetEmailUserLabel ?? `#${presetEmailUserId}`,
            }),
            count: null,
            group: 'recipient',
          },
    [presetEmailUserId, presetEmailUserLabel, t],
  );

  // Separate audiences per channel, as in the existing form.
  const [telegramAudience, setTelegramAudience] = useState(emptyAudience);
  const [emailAudience, setEmailAudience] = useState(() =>
    presetEmailUserId === null
      ? emptyAudience()
      : {
          conditions: [
            {
              field: 'email_user',
              operator: 'eq' as const,
              value: String(presetEmailUserId),
              label: presetEmailUserLabel ?? `#${presetEmailUserId}`,
              join: null,
            },
          ],
        },
  );

  // Broadcast category (system/news/promo)
  const [category, setCategory] = useState<'system' | 'news' | 'promo'>('system');

  // Telegram-specific state
  const [messageType, setMessageType] = useState<'message' | 'main_menu'>('message');
  const isMainMenu = messageType === 'main_menu';
  const [messageText, setMessageText] = useState('');
  const [selectedButtons, setSelectedButtons] = useState<string[]>(['home']);
  const [customButtons, setCustomButtons] = useState<CustomBroadcastButton[]>([]);
  const [isAddingCustomButton, setIsAddingCustomButton] = useState(false);
  const [newButtonLabel, setNewButtonLabel] = useState('');
  const [newButtonActionType, setNewButtonActionType] = useState<'callback' | 'url'>('callback');
  const [newButtonActionValue, setNewButtonActionValue] = useState('');
  const [newButtonEmojiId, setNewButtonEmojiId] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'document'>('photo');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaPreviewRef = useRef<string | null>(null);

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (mediaPreviewRef.current) URL.revokeObjectURL(mediaPreviewRef.current);
    };
  }, []);

  // Email-specific state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');

  // Submitting state for dual send
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview modals
  const [showTelegramPreview, setShowTelegramPreview] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showMainMenuConfirm, setShowMainMenuConfirm] = useState(false);

  const previewMediaTypeForModal: 'photo' | 'video' | null =
    mediaType === 'photo' || mediaType === 'video' ? mediaType : null;

  const previewButtonRows = useMemo(() => {
    const rows: { text: string; url?: string; callback_data?: string }[][] = [];
    if (selectedButtons.length > 0) {
      const presetLabels: Record<string, string> = {
        balance: t('admin.broadcasts.btnBalance', 'Пополнить баланс'),
        // Бот отдаёт ключ кнопки как 'referrals' (см. BROADCAST_BUTTONS в admin.py),
        // раньше тут был 'partners' — из-за рассинхрона кнопка показывалась сырым
        // ключом 'referrals' вместо «Партнёрка» (Telegram-баг #602989).
        referrals: t('admin.broadcasts.btnPartners', 'Партнёрка'),
        promocode: t('admin.broadcasts.btnPromocode', 'Промокод'),
        connect: t('admin.broadcasts.btnConnect', 'Подключиться'),
        subscription: t('admin.broadcasts.btnSubscription', 'Подписка'),
        support: t('admin.broadcasts.btnSupport', 'Техподдержка'),
        home: t('admin.broadcasts.btnHome', 'На главную'),
      };
      for (const id of selectedButtons) {
        rows.push([{ text: presetLabels[id] || id, callback_data: id }]);
      }
    }
    for (const cb of customButtons) {
      rows.push([
        {
          text: cb.label,
          ...(cb.action_type === 'url'
            ? { url: cb.action_value }
            : { callback_data: cb.action_value }),
        },
      ]);
    }
    return rows;
  }, [selectedButtons, customButtons, t]);

  // Fetch Telegram filters
  const { data: filtersData, isLoading: filtersLoading } = useQuery({
    queryKey: ['admin', 'broadcasts', 'filters'],
    queryFn: adminBroadcastsApi.getFilters,
    enabled: telegramEnabled,
  });

  // Fetch Email filters
  const { data: emailFiltersData, isLoading: emailFiltersLoading } = useQuery({
    queryKey: ['admin', 'broadcasts', 'email-filters'],
    queryFn: adminBroadcastsApi.getEmailFilters,
    enabled: emailEnabled,
  });
  const { data: emailTariffsData, isLoading: emailTariffsLoading } = useQuery({
    queryKey: ['admin', 'broadcasts', 'tariffs'],
    queryFn: adminBroadcastsApi.getTariffs,
    enabled: emailEnabled && advancedAudience,
  });

  // Fetch buttons
  const { data: buttonsData } = useQuery({
    queryKey: ['admin', 'broadcasts', 'buttons'],
    queryFn: adminBroadcastsApi.getButtons,
    enabled: telegramEnabled,
  });

  // Create mutation (used for single-channel sends)
  const createMutation = useMutation({
    mutationFn: adminBroadcastsApi.createCombined,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });
      navigate(`/admin/broadcasts/${data.id}`);
    },
  });

  // Handle toggling channels
  const handleToggleTelegram = () => {
    setMessageType('message');
    setShowTelegramPreview(false);
    setShowMainMenuConfirm(false);
    setTelegramEnabled((prev) => !prev);
    setTelegramAudience(emptyAudience());
    setTelegramTarget('');
  };

  const handleToggleEmail = () => {
    if (isMainMenu) return;
    setEmailEnabled((prev) => !prev);
    setEmailAudience(emptyAudience());
    setEmailTarget('');
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine type locally to avoid stale state in async call
    let detectedType: 'photo' | 'video' | 'document';
    if (file.type.startsWith('image/')) {
      detectedType = 'photo';
    } else if (file.type.startsWith('video/')) {
      detectedType = 'video';
    } else {
      detectedType = 'document';
    }

    setMediaFile(file);
    setMediaType(detectedType);

    if (detectedType === 'photo') {
      if (mediaPreviewRef.current) URL.revokeObjectURL(mediaPreviewRef.current);
      const url = URL.createObjectURL(file);
      mediaPreviewRef.current = url;
      setMediaPreview(url);
    } else {
      setMediaPreview(null);
    }

    setIsUploading(true);
    try {
      const result = await adminBroadcastsApi.uploadMedia(file, detectedType);
      setUploadedFileId(result.file_id);
    } catch {
      setMediaFile(null);
      setMediaPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Remove media
  const handleRemoveMedia = () => {
    if (mediaPreviewRef.current) {
      URL.revokeObjectURL(mediaPreviewRef.current);
      mediaPreviewRef.current = null;
    }
    setMediaFile(null);
    setMediaPreview(null);
    setUploadedFileId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Toggle button
  const toggleButton = (key: string) => {
    setSelectedButtons((prev) =>
      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key],
    );
  };

  // Custom button validation
  const isNewButtonValid = useMemo(() => {
    if (!newButtonLabel.trim() || !newButtonActionValue.trim()) return false;
    // custom_emoji_id — необязательное поле, но если задано — числовая строка (Bot API)
    if (newButtonEmojiId.trim() && !/^\d{1,64}$/.test(newButtonEmojiId.trim())) return false;
    if (newButtonActionType === 'url') {
      return /^https:\/\/|^tg:\/\//.test(newButtonActionValue.trim());
    }
    if (newButtonActionType === 'callback') {
      return new TextEncoder().encode(newButtonActionValue.trim()).length <= 64;
    }
    return true;
  }, [newButtonLabel, newButtonActionType, newButtonActionValue, newButtonEmojiId]);

  // Custom button handlers
  const addCustomButton = () => {
    if (!isNewButtonValid) return;
    const emojiId = newButtonEmojiId.trim();
    setCustomButtons((prev) => [
      ...prev,
      {
        label: newButtonLabel.trim(),
        action_type: newButtonActionType,
        action_value: newButtonActionValue.trim(),
        ...(emojiId ? { icon_custom_emoji_id: emojiId } : {}),
      },
    ]);
    setNewButtonLabel('');
    setNewButtonActionValue('');
    setNewButtonActionType('callback');
    setNewButtonEmojiId('');
    setIsAddingCustomButton(false);
  };

  const removeCustomButton = (index: number) => {
    setCustomButtons((prev) => prev.filter((_, i) => i !== index));
  };

  // Validate form
  const isTelegramValid =
    telegramEnabled &&
    (advancedAudience ? isAudienceComplete(telegramAudience) : Boolean(telegramTarget)) &&
    (isMainMenu || messageText.trim().length > 0);
  const isEmailValid =
    emailEnabled &&
    (advancedAudience ? isAudienceComplete(emailAudience) : Boolean(emailTarget)) &&
    emailSubject.trim().length > 0 &&
    emailContent.trim().length > 0;

  const isValid = useMemo(() => {
    if (!telegramEnabled && !emailEnabled) return false;
    if (telegramEnabled && !isTelegramValid) return false;
    if (emailEnabled && !isEmailValid) return false;
    return true;
  }, [telegramEnabled, emailEnabled, isTelegramValid, isEmailValid]);

  const bothChannels = telegramEnabled && emailEnabled;

  const menuAudiencePreview = useQuery<{ count: number }>({
    queryKey: [
      'admin',
      'broadcasts',
      'main-menu-confirm',
      advancedAudience,
      category,
      advancedAudience ? telegramAudience : telegramTarget,
    ],
    queryFn: () =>
      advancedAudience
        ? adminBroadcastsApi.previewAudience({
            channel: 'telegram',
            category,
            audience: telegramAudience,
            limit: 1,
          })
        : adminBroadcastsApi.preview(telegramTarget),
    enabled: showMainMenuConfirm && isMainMenu && isTelegramValid,
    retry: false,
  });

  const handleMessageTypeChange = (next: 'message' | 'main_menu') => {
    setMessageType(next);
    setShowTelegramPreview(false);
    setShowEmailPreview(false);
    setShowMainMenuConfirm(false);
    if (next === 'main_menu') {
      setTelegramEnabled(true);
      setEmailEnabled(false);
      setEmailAudience(emptyAudience());
      setEmailTarget('');
    }
  };

  // Submit
  const handleSubmit = async (confirmedMainMenu = false) => {
    if (!isValid || createMutation.isPending || isSubmitting || isUploading) return;
    if (isMainMenu && !confirmedMainMenu) {
      setShowMainMenuConfirm(true);
      return;
    }
    if (
      isMainMenu &&
      (menuAudiencePreview.isFetching ||
        menuAudiencePreview.isError ||
        !menuAudiencePreview.data?.count)
    ) {
      return;
    }

    // Single channel — use existing createMutation with navigation to detail
    if (telegramEnabled && !emailEnabled) {
      const data: CombinedBroadcastCreateRequest = {
        channel: 'telegram',
        ...(advancedAudience ? { audience: telegramAudience } : { target: telegramTarget }),
        ...(isMainMenu
          ? { message_type: 'main_menu', message_text: '', selected_buttons: [] }
          : {
              message_text: messageText,
              selected_buttons: selectedButtons,
              custom_buttons: customButtons.length > 0 ? customButtons : undefined,
            }),
        category,
      };
      if (uploadedFileId && !isMainMenu) {
        data.media = { type: mediaType, file_id: uploadedFileId };
      }
      createMutation.mutate(data);
      setShowMainMenuConfirm(false);
      return;
    }

    if (emailEnabled && !telegramEnabled) {
      const data: CombinedBroadcastCreateRequest = {
        channel: 'email',
        ...(advancedAudience ? { audience: emailAudience } : { target: emailTarget }),
        email_subject: emailSubject,
        email_html_content: emailContent,
        category,
      };
      createMutation.mutate(data);
      return;
    }

    // Both channels — two sequential requests, navigate to list
    setIsSubmitting(true);
    try {
      const telegramData: CombinedBroadcastCreateRequest = {
        channel: 'telegram',
        ...(advancedAudience ? { audience: telegramAudience } : { target: telegramTarget }),
        message_text: messageText,
        selected_buttons: selectedButtons,
        custom_buttons: customButtons.length > 0 ? customButtons : undefined,
        category,
      };
      if (uploadedFileId) {
        telegramData.media = { type: mediaType, file_id: uploadedFileId };
      }

      const emailData: CombinedBroadcastCreateRequest = {
        channel: 'email',
        ...(advancedAudience ? { audience: emailAudience } : { target: emailTarget }),
        email_subject: emailSubject,
        email_html_content: emailContent,
        category,
      };

      await adminBroadcastsApi.createCombined(telegramData);
      await adminBroadcastsApi.createCombined(emailData);

      queryClient.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });
      navigate('/admin/broadcasts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = createMutation.isPending || isSubmitting;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AdminBackButton />
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2">
            <BroadcastIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-apple-ink">{t('admin.broadcasts.create')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.broadcasts.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
        <p className="mb-3 text-[13px] font-medium text-apple-mute">
          {t('admin.broadcasts.messageType', 'Тип рассылки')}
        </p>
        <div className="flex gap-3">
          {(['message', 'main_menu'] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={messageType === type}
              onClick={() => handleMessageTypeChange(type)}
              disabled={isUploading || isPending}
              className={`flex-1 rounded-xl p-3 text-sm font-medium transition-all disabled:opacity-50 ${
                messageType === type
                  ? 'bg-[#F97315]/10 text-[#F97315]'
                  : 'bg-apple-elevated text-apple-mute'
              }`}
            >
              {type === 'main_menu'
                ? t('admin.broadcasts.mainMenu', 'Обновить главное меню')
                : t('admin.broadcasts.message', 'Сообщение')}
            </button>
          ))}
        </div>
        {isMainMenu && (
          <p className="mt-3 text-sm text-apple-mute">
            {t(
              'admin.broadcasts.mainMenuHint',
              'Каждый получатель получит своё актуальное главное меню с подпиской и кнопками. Нажимать /start не потребуется. Доступно только в Telegram.',
            )}
          </p>
        )}
      </div>

      {/* Channel toggles */}
      <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
        <label className="mb-3 block text-[13px] font-medium text-apple-mute">
          {t('admin.broadcasts.selectChannel')}
        </label>
        <div className="flex gap-3">
          <button
            onClick={handleToggleTelegram}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl p-4 transition-all ${
              telegramEnabled ? '' : 'bg-apple-elevated text-apple-mute'
            }`}
            style={
              telegramEnabled
                ? { backgroundColor: 'rgba(249,115,21,0.12)', color: '#F97315' }
                : undefined
            }
          >
            <TelegramIcon />
            <span className="font-medium">{t('admin.broadcasts.enableTelegram')}</span>
          </button>
          <button
            onClick={handleToggleEmail}
            disabled={isMainMenu}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl p-4 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              emailEnabled ? '' : 'bg-apple-elevated text-apple-mute'
            }`}
            style={
              emailEnabled
                ? { backgroundColor: 'rgba(249,115,21,0.12)', color: '#F97315' }
                : undefined
            }
          >
            <EmailIcon />
            <span className="font-medium">{t('admin.broadcasts.enableEmail')}</span>
          </button>
        </div>
        {!telegramEnabled && !emailEnabled && (
          <p className="mt-2 text-sm text-apple-red">{t('admin.broadcasts.atLeastOneChannel')}</p>
        )}
        {bothChannels && (
          <p className="mt-2 text-sm" style={{ color: '#F97315' }}>
            {t('admin.broadcasts.sendingBoth')}
          </p>
        )}
      </div>

      {/* Broadcast category */}
      <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
        <label className="mb-3 block text-[13px] font-medium text-apple-mute">
          {t('admin.broadcasts.category', 'Категория рассылки')}
        </label>
        <p className="mb-3 text-xs text-apple-faint">
          {t(
            'admin.broadcasts.categoryDesc',
            'Пользователи могут отключить получение новостей и промо в настройках профиля. Системные рассылки доставляются всем.',
          )}
        </p>
        <div className="flex gap-3">
          {(['system', 'news', 'promo'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-1 rounded-xl p-3 text-sm font-medium transition-all ${
                category === cat ? '' : 'bg-apple-elevated text-apple-mute'
              }`}
              style={
                category === cat
                  ? { backgroundColor: 'rgba(249,115,21,0.12)', color: '#F97315' }
                  : undefined
              }
            >
              {cat === 'system' && t('admin.broadcasts.categorySystem', '⚙️ Системное')}
              {cat === 'news' && t('admin.broadcasts.categoryNews', '📰 Новости')}
              {cat === 'promo' && t('admin.broadcasts.categoryPromo', '🎁 Промо')}
            </button>
          ))}
        </div>
      </div>

      {/* Telegram section */}
      {telegramEnabled && (
        <div className="apple-card-grad space-y-6 rounded-2xl bg-apple-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-apple-ink">
              {t('admin.broadcasts.telegramSection')}
            </h2>
            <button
              type="button"
              onClick={() => setShowTelegramPreview(true)}
              disabled={!isMainMenu && messageText.trim().length === 0}
              className="rounded-full bg-apple-elevated px-3 py-1.5 text-sm text-apple-mute transition-colors hover:text-apple-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('admin.broadcasts.preview', 'Предпросмотр')}
            </button>
          </div>

          {/* Telegram filter selection */}
          {advancedAudience ? (
            <BroadcastAudienceEditor
              channel="telegram"
              category={category}
              audience={telegramAudience}
              onChange={setTelegramAudience}
              filters={
                filtersData
                  ? [
                      ...filtersData.filters,
                      ...filtersData.tariff_filters,
                      ...filtersData.custom_filters,
                    ]
                  : []
              }
              isLoading={filtersLoading}
            />
          ) : (
            <LegacyBroadcastTargetPicker
              channel="telegram"
              target={telegramTarget}
              onChange={setTelegramTarget}
              filters={
                filtersData
                  ? [
                      ...filtersData.filters,
                      ...filtersData.tariff_filters,
                      ...filtersData.custom_filters,
                    ]
                  : []
              }
              isLoading={filtersLoading}
            />
          )}

          {!isMainMenu && (
            <>
              {/* Message text */}
              <div>
                <label className="mb-2 block text-[13px] font-medium text-apple-mute">
                  {t('admin.broadcasts.messageText')}
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t('admin.broadcasts.messageTextPlaceholder')}
                  rows={6}
                  maxLength={4000}
                  className="min-h-[150px] w-full resize-y rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                />
                <div className="mt-1 text-right text-xs text-apple-mute">
                  {messageText.length}/4000
                </div>
              </div>

              {/* Media upload */}
              <div>
                <label className="mb-2 block text-[13px] font-medium text-apple-mute">
                  {t('admin.broadcasts.media')}
                </label>
                {mediaFile ? (
                  <div className="rounded-xl bg-apple-elevated p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {mediaType === 'photo' && <PhotoIcon />}
                        {mediaType === 'video' && <VideoIcon />}
                        {mediaType === 'document' && <DocumentIcon />}
                        <div>
                          <p className="text-sm text-apple-ink">{mediaFile.name}</p>
                          <p className="text-xs text-apple-mute">
                            {(mediaFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveMedia}
                        className="rounded-lg p-2 text-apple-mute hover:text-apple-red"
                        disabled={isUploading}
                      >
                        <XIcon className="h-5 w-5" />
                      </button>
                    </div>
                    {mediaPreview && (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="mt-3 max-h-48 rounded-lg object-cover"
                      />
                    )}
                    {isUploading && (
                      <div
                        className="mt-2 flex items-center gap-2 text-sm"
                        style={{ color: '#F97315' }}
                      >
                        <RefreshIcon />
                        {t('admin.broadcasts.uploading')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,application/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-apple-hairline bg-apple-elevated p-6 text-apple-mute transition-colors hover:text-apple-ink"
                    >
                      <PhotoIcon />
                      <span>{t('admin.broadcasts.addMedia')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Buttons selection */}
              <div>
                <label className="mb-2 block text-[13px] font-medium text-apple-mute">
                  {t('admin.broadcasts.buttons')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {buttonsData?.buttons.map((button) => (
                    <button
                      key={button.key}
                      onClick={() => toggleButton(button.key)}
                      className={`rounded-full px-3 py-2 text-sm transition-colors ${
                        selectedButtons.includes(button.key)
                          ? 'bg-[#F97315] text-white'
                          : 'border border-apple-hairline bg-apple-card text-apple-mute hover:bg-apple-elevated'
                      }`}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom buttons */}
              <div>
                <label className="mb-2 block text-[13px] font-medium text-apple-mute">
                  {t('admin.broadcasts.customButtons')}
                </label>

                {/* Existing custom buttons */}
                {customButtons.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {customButtons.map((btn, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-xl bg-apple-elevated px-3 py-2"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="shrink-0 rounded bg-apple-card px-1.5 py-0.5 text-xs text-apple-mute">
                            {btn.action_type === 'url'
                              ? t('admin.broadcasts.customButtonTypeUrl')
                              : t('admin.broadcasts.customButtonTypeCallback')}
                          </span>
                          <span className="truncate text-sm text-apple-ink">{btn.label}</span>
                          <span className="truncate text-xs text-apple-faint">
                            {btn.action_value}
                          </span>
                        </div>
                        <button
                          onClick={() => removeCustomButton(index)}
                          className="ml-2 shrink-0 rounded p-1 text-apple-mute hover:text-apple-red"
                        >
                          <XIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add form */}
                {isAddingCustomButton ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addCustomButton();
                    }}
                    className="space-y-3 rounded-xl bg-apple-elevated p-3"
                  >
                    <input
                      type="text"
                      value={newButtonLabel}
                      onChange={(e) => setNewButtonLabel(e.target.value)}
                      placeholder={t('admin.broadcasts.customButtonLabelPlaceholder')}
                      maxLength={64}
                      className="w-full rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewButtonActionType('callback')}
                        className={`flex-1 rounded-full px-3 py-2 text-sm transition-colors ${
                          newButtonActionType === 'callback'
                            ? 'bg-[#F97315] text-white'
                            : 'border border-apple-hairline bg-apple-card text-apple-mute hover:bg-apple-elevated'
                        }`}
                      >
                        {t('admin.broadcasts.customButtonTypeCallback')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewButtonActionType('url')}
                        className={`flex-1 rounded-full px-3 py-2 text-sm transition-colors ${
                          newButtonActionType === 'url'
                            ? 'bg-[#F97315] text-white'
                            : 'border border-apple-hairline bg-apple-card text-apple-mute hover:bg-apple-elevated'
                        }`}
                      >
                        {t('admin.broadcasts.customButtonTypeUrl')}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newButtonActionValue}
                      onChange={(e) => setNewButtonActionValue(e.target.value)}
                      placeholder={
                        newButtonActionType === 'url'
                          ? t('admin.broadcasts.customButtonUrlPlaceholder')
                          : t('admin.broadcasts.customButtonCallbackPlaceholder')
                      }
                      maxLength={newButtonActionType === 'callback' ? 64 : 256}
                      className="w-full rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newButtonEmojiId}
                      onChange={(e) => setNewButtonEmojiId(e.target.value)}
                      placeholder={t('admin.broadcasts.customButtonEmojiIdPlaceholder')}
                      maxLength={64}
                      className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomButton(false);
                          setNewButtonLabel('');
                          setNewButtonActionValue('');
                          setNewButtonEmojiId('');
                        }}
                        className="flex-1 rounded-full bg-apple-card px-4 py-2.5 text-sm font-medium text-apple-mute transition-colors hover:text-apple-ink"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={!isNewButtonValid}
                        className="flex-1 rounded-full bg-[#F97315] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('common.add')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsAddingCustomButton(true)}
                    disabled={customButtons.length >= 10}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-apple-hairline bg-apple-elevated px-4 py-3 text-sm text-apple-mute transition-colors hover:text-apple-ink"
                  >
                    <span>+</span>
                    <span>{t('admin.broadcasts.addCustomButton')}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Email section */}
      {emailEnabled && (
        <div className="apple-card-grad space-y-6 rounded-2xl bg-apple-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-apple-ink">
              {t('admin.broadcasts.emailSection')}
            </h2>
            <button
              type="button"
              onClick={() => setShowEmailPreview(true)}
              disabled={emailContent.trim().length === 0}
              className="rounded-full bg-apple-elevated px-3 py-1.5 text-sm text-apple-mute transition-colors hover:text-apple-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('admin.broadcasts.preview', 'Предпросмотр')}
            </button>
          </div>

          {/* Email filter selection */}
          {advancedAudience ? (
            <BroadcastAudienceEditor
              channel="email"
              category={category}
              audience={emailAudience}
              onChange={setEmailAudience}
              filters={[
                ...(emailFiltersData?.filters || []),
                ...(emailFiltersData?.promo_group_filters || []),
                ...(emailTariffsData?.tariffs.map((tariff) => ({
                  key: tariff.filter_key,
                  label: tariff.name,
                  tariff_id: tariff.id,
                  count: tariff.active_users_count,
                })) || []),
              ]}
              isLoading={emailFiltersLoading || emailTariffsLoading}
            />
          ) : (
            <LegacyBroadcastTargetPicker
              channel="email"
              target={emailTarget}
              onChange={setEmailTarget}
              filters={[
                ...(singleUserEmailFilter ? [singleUserEmailFilter] : []),
                ...(emailFiltersData?.filters ?? []),
                ...(emailFiltersData?.promo_group_filters ?? []),
              ]}
              isLoading={emailFiltersLoading}
            />
          )}

          {/* Email subject */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.broadcasts.emailSubject')}
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={t('admin.broadcasts.emailSubjectPlaceholder')}
              className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
              maxLength={200}
            />
          </div>

          {/* Email content */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-apple-mute">
              {t('admin.broadcasts.emailContent')}
            </label>
            <p className="mb-2 text-xs text-apple-mute">{t('admin.broadcasts.emailContentHint')}</p>
            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder={t('admin.broadcasts.emailContentPlaceholder')}
              rows={10}
              className="min-h-[200px] w-full resize-y rounded-xl bg-apple-elevated px-4 py-3 font-mono text-sm text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
            />
          </div>

          {/* Email variables hint */}
          <div className="rounded-xl bg-apple-elevated p-4">
            <p className="mb-2 text-sm font-medium text-apple-mute">
              {t('admin.broadcasts.emailVariables')}
            </p>
            <div className="flex flex-wrap gap-2">
              {['{{user_name}}', '{{email}}', '{{user_id}}'].map((variable) => (
                <code
                  key={variable}
                  className="rounded bg-apple-card px-2 py-1 text-xs"
                  style={{ color: '#F97315' }}
                >
                  {variable}
                </code>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="apple-card-grad flex items-center justify-end rounded-2xl bg-apple-card p-4">
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/admin/broadcasts')}
            className="rounded-full bg-apple-elevated px-4 py-2.5 text-sm font-medium text-apple-mute transition-colors hover:text-apple-ink"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => handleSubmit()}
            disabled={!isValid || isPending || isUploading}
            className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <RefreshIcon /> : <BroadcastIcon className="h-6 w-6" />}
            {t('admin.broadcasts.send')}
          </button>
        </div>
      </div>

      <TelegramPreview
        open={showTelegramPreview && !isMainMenu}
        onClose={() => setShowTelegramPreview(false)}
        text={messageText}
        mediaUrl={mediaPreview}
        mediaType={previewMediaTypeForModal}
        buttons={previewButtonRows}
      />
      <Dialog open={showTelegramPreview && isMainMenu} onOpenChange={setShowTelegramPreview}>
        <DialogContent
          className="translate-x-0 translate-y-0 rounded-2xl bg-apple-card"
          style={{ translate: '-50% -50%', width: 'calc(100% - 2rem)' }}
        >
          <DialogTitle>{t('admin.broadcasts.mainMenu', 'Обновить главное меню')}</DialogTitle>
          <DialogDescription>
            {t(
              'admin.broadcasts.mainMenuPreview',
              'Меню будет сформировано отдельно для каждого получателя в момент отправки: его профиль, актуальная подписка и доступные кнопки. Общего текста, дополнительных кнопок и вложений не будет.',
            )}
          </DialogDescription>
        </DialogContent>
      </Dialog>
      <Dialog open={showMainMenuConfirm} onOpenChange={setShowMainMenuConfirm}>
        <DialogContent
          className="translate-x-0 translate-y-0 rounded-2xl bg-apple-card"
          style={{ translate: '-50% -50%', width: 'calc(100% - 2rem)' }}
          showCloseButton={false}
        >
          <DialogTitle>
            {t('admin.broadcasts.mainMenuConfirmTitle', 'Отправить главное меню?')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'admin.broadcasts.mainMenuConfirmText',
              'Бот отправит новое сообщение с персональным главным меню каждому пользователю выбранной аудитории. Пользователю не нужно нажимать кнопку или отправлять /start.',
            )}
          </DialogDescription>
          {menuAudiencePreview.isFetching ? (
            <p className="text-sm text-apple-mute">{t('common.loading')}</p>
          ) : menuAudiencePreview.isError ? (
            <div>
              <p className="text-sm text-apple-red">
                {t('admin.broadcasts.mainMenuCountError', 'Не удалось проверить аудиторию.')}
              </p>
              <button
                type="button"
                onClick={() => menuAudiencePreview.refetch()}
                className="mt-2 text-sm text-[#F97315]"
              >
                {t('common.retry', 'Повторить')}
              </button>
            </div>
          ) : (
            <p className="text-sm text-apple-ink">
              {t('admin.broadcasts.mainMenuAudience', 'Аудитория')}:{' '}
              {menuAudiencePreview.data?.count ?? 0}
            </p>
          )}
          <p className="text-xs text-apple-mute">
            {t(
              'admin.broadcasts.mainMenuDeliveryHint',
              'Доставка учитывает выбранную категорию и настройки уведомлений. Заблокировавшие бота сообщение не получат.',
            )}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowMainMenuConfirm(false)}
              className="rounded-full bg-apple-elevated px-4 py-2.5 text-sm text-apple-mute"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={
                isPending ||
                menuAudiencePreview.isFetching ||
                menuAudiencePreview.isError ||
                !menuAudiencePreview.data?.count
              }
              className="rounded-full bg-[#F97315] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('admin.broadcasts.mainMenuConfirmSend', 'Отправить меню')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <EmailPreview
        open={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        subject={emailSubject}
        htmlContent={emailContent}
      />
    </div>
  );
}
