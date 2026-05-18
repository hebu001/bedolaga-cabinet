import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ticketsApi } from '../api/tickets';
import { MessageMediaGrid } from '../components/tickets/MessageMediaGrid';
import { infoApi } from '../api/info';
import { useAuthStore } from '../store/auth';
import { logger } from '../utils/logger';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMIT_KEYS } from '../utils/rateLimit';
import type { TicketDetail } from '../types';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import { usePlatform } from '@/platform';
import { linkifyText } from '../utils/linkify';

const log = logger.createLogger('Support');

// Apple-dark surface helpers
const cardCls = 'apple-card-grad rounded-2xl bg-apple-card';
const inputCls =
  'w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none transition-shadow placeholder:text-apple-faint focus:ring-2 focus:ring-apple-blue/60 disabled:opacity-50';

const ChatBubbleIcon = ({ className = 'h-8 w-8' }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
    />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const SendIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
    />
  </svg>
);

const ImageIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Spinner = ({ className = 'h-8 w-8' }: { className?: string }) => (
  <div
    className={`animate-spin rounded-full border-2 border-[#F97315] border-t-transparent ${className}`}
  />
);

const STATUS_TONE: Record<string, string> = {
  open: 'bg-apple-blue/15 text-apple-blue',
  answered: 'bg-apple-green/15 text-apple-green',
  pending: 'bg-apple-amber/15 text-apple-amber',
  closed: 'bg-apple-elevated text-apple-mute',
};

// Media attachment state
interface MediaAttachment {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  fileId?: string;
  error?: string;
}

export default function Support() {
  log.debug('Component loaded');

  const { t } = useTranslation();
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const queryClient = useQueryClient();
  const { openTelegramLink, openLink } = usePlatform();
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  // Media attachment states (multi-upload, up to 10)
  const [createAttachments, setCreateAttachments] = useState<MediaAttachment[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<MediaAttachment[]>([]);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const blobUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = blobUrlsRef;
    return () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const clearCreateAttachments = () => {
    createAttachments.forEach((a) => {
      if (a.preview) URL.revokeObjectURL(a.preview);
    });
    setCreateAttachments([]);
    if (createFileInputRef.current) createFileInputRef.current.value = '';
  };

  const clearReplyAttachments = () => {
    replyAttachments.forEach((a) => {
      if (a.preview) URL.revokeObjectURL(a.preview);
    });
    setReplyAttachments([]);
    if (replyFileInputRef.current) replyFileInputRef.current.value = '';
  };

  // Get support configuration
  const { data: supportConfig, isLoading: configLoading } = useQuery({
    queryKey: ['support-config'],
    queryFn: infoApi.getSupportConfig,
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => ticketsApi.getTickets({ per_page: 20 }),
    enabled: supportConfig?.tickets_enabled === true,
  });

  const { data: ticketDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['ticket', selectedTicket?.id],
    queryFn: () => ticketsApi.getTicket(selectedTicket!.id),
    enabled: !!selectedTicket,
  });

  // Handle file selection (multi-upload)
  const handleFileSelect = async (
    file: File,
    setAttachments: React.Dispatch<React.SetStateAction<MediaAttachment[]>>,
  ) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) return;
    if (file.size > 10 * 1024 * 1024) return;

    const preview = URL.createObjectURL(file);
    blobUrlsRef.current.add(preview);
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `att_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entry: MediaAttachment = { id, file, preview, uploading: true };
    setAttachments((prev) => (prev.length >= 10 ? prev : [...prev, entry]));

    try {
      const result = await ticketsApi.uploadMedia(file, 'photo');
      setAttachments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, uploading: false, fileId: result.file_id } : a)),
      );
    } catch {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, uploading: false, error: t('support.uploadFailed') } : a,
        ),
      );
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const ready = createAttachments.filter((a) => a.fileId) as Array<{ fileId: string }>;
      const media =
        ready.length > 0
          ? {
              media_type: 'photo',
              media_file_id: ready[0].fileId,
              media_items: ready.map((a) => ({ type: 'photo' as const, file_id: a.fileId })),
            }
          : undefined;
      return ticketsApi.createTicket(newTitle, newMessage, media);
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setShowCreateForm(false);
      setNewTitle('');
      setNewMessage('');
      clearCreateAttachments();
      setSelectedTicket(ticket);
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const ready = replyAttachments.filter((a) => a.fileId) as Array<{ fileId: string }>;
      const media =
        ready.length > 0
          ? {
              media_type: 'photo',
              media_file_id: ready[0].fileId,
              media_items: ready.map((a) => ({ type: 'photo' as const, file_id: a.fileId })),
            }
          : undefined;
      await ticketsApi.addMessage(selectedTicket!.id, replyMessage, media);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicket?.id] });
      setReplyMessage('');
      clearReplyAttachments();
    },
  });

  const getStatusLabel = (status: string) => {
    return t(`support.status.${status}`) || status;
  };

  const StatusPill = ({ status }: { status: string }) => (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        STATUS_TONE[status] ?? STATUS_TONE.closed
      }`}
    >
      {getStatusLabel(status)}
    </span>
  );

  // Show loading while checking configuration
  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  // If tickets are disabled, show redirect message
  if (supportConfig && !supportConfig.tickets_enabled) {
    log.debug('Tickets disabled, config:', supportConfig);

    const getSupportMessage = () => {
      log.debug('Getting support message for type:', supportConfig.support_type);

      if (supportConfig.support_type === 'profile') {
        const supportUsername = supportConfig.support_username || '@support';
        return {
          title: isAdmin ? t('support.ticketsDisabled') : t('support.title'),
          message: t('support.contactSupport', { username: supportUsername }),
          buttonText: t('support.contactUs'),
          buttonAction: () => {
            const username = supportUsername.startsWith('@')
              ? supportUsername.slice(1)
              : supportUsername;
            openTelegramLink(`https://t.me/${username}`);
          },
        };
      }

      if (supportConfig.support_type === 'url' && supportConfig.support_url) {
        return {
          title: isAdmin ? t('support.ticketsDisabled') : t('support.title'),
          message: t('support.useExternalLink'),
          buttonText: t('support.openSupport'),
          buttonAction: () => {
            openLink(supportConfig.support_url!, { tryInstantView: false });
          },
        };
      }

      // Fallback: contact support
      const supportUsername = supportConfig.support_username || '@support';
      return {
        title: isAdmin ? t('support.ticketsDisabled') : t('support.title'),
        message: t('support.contactSupport', { username: supportUsername }),
        buttonText: t('support.contactUs'),
        buttonAction: () => {
          const username = supportUsername.startsWith('@')
            ? supportUsername.slice(1)
            : supportUsername;
          openTelegramLink(`https://t.me/${username}`);
        },
      };
    };

    const supportMessage = getSupportMessage();

    return (
      <div className="font-sans text-apple-ink">
        <h1 className="mb-4 text-[22px] font-bold text-apple-ink">{t('support.title')}</h1>
        <div className={`${cardCls} p-7 text-center`}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-apple-elevated text-[#F97315]">
            <ChatBubbleIcon />
          </div>
          <h2 className="mb-2 text-[18px] font-semibold text-apple-ink">{supportMessage.title}</h2>
          <p className="mb-6 text-[15px] text-apple-mute">{supportMessage.message}</p>
          <button
            type="button"
            onClick={supportMessage.buttonAction}
            className="w-full rounded-full bg-[#F97315] py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {supportMessage.buttonText}
          </button>
        </div>
      </div>
    );
  }

  // Attachments preview component
  const AttachmentsPreview = ({
    items,
    onRemove,
  }: {
    items: MediaAttachment[];
    onRemove: (idx: number) => void;
  }) =>
    items.length === 0 ? null : (
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((att, idx) => (
          <div key={idx} className="relative">
            {att.preview ? (
              <img
                src={att.preview}
                alt="Preview"
                className="h-16 w-16 rounded-lg border border-apple-hairline object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-apple-elevated text-xs text-apple-mute">
                {att.file.name.slice(-6)}
              </div>
            )}
            {att.uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                <Spinner className="h-4 w-4" />
              </div>
            )}
            {att.error && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-apple-red/30">
                <span className="text-xs text-apple-red">!</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-apple-elevated text-apple-mute transition-colors hover:bg-apple-red hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    );

  return (
    <motion.div
      className="space-y-4 font-sans text-apple-ink"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <h1 className="text-[22px] font-bold text-apple-ink">{t('support.title')}</h1>
        <button
          type="button"
          onClick={() => {
            setShowCreateForm(true);
            setSelectedTicket(null);
            clearCreateAttachments();
          }}
          className="flex items-center justify-center gap-2 rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon />
          <span>{t('support.newTicket')}</span>
        </button>
      </motion.div>

      {/* Contact support card for "both" mode */}
      {supportConfig?.support_type === 'both' && supportConfig.support_username && (
        <motion.div variants={staggerItem}>
          <div className={`${cardCls} flex items-center justify-between p-4`}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-apple-elevated text-[#F97315]">
                <ChatBubbleIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-apple-ink">
                  {t('support.contactUs')}
                </div>
                <div className="truncate text-[13px] text-apple-mute">
                  {supportConfig.support_username}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const username = supportConfig.support_username!.startsWith('@')
                  ? supportConfig.support_username!.slice(1)
                  : supportConfig.support_username!;
                openTelegramLink(`https://t.me/${username}`);
              }}
              className="shrink-0 rounded-full bg-apple-elevated px-4 py-2.5 text-[14px] font-semibold text-apple-ink transition-opacity hover:opacity-80"
            >
              {t('support.contactUs')}
            </button>
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Tickets List */}
        <div className={`${cardCls} p-5 lg:col-span-1`}>
          <h2 className="mb-4 text-[17px] font-semibold text-apple-ink">
            {t('support.yourTickets')}
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : tickets?.items && tickets.items.length > 0 ? (
            <div className="space-y-2">
              {tickets.items.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => {
                    setSelectedTicket(ticket as unknown as TicketDetail);
                    setShowCreateForm(false);
                    clearReplyAttachments();
                  }}
                  className={`w-full rounded-xl p-4 text-left transition-colors ${
                    selectedTicket?.id === ticket.id
                      ? 'bg-[#F97315]/10 ring-1 ring-[#F97315]/40'
                      : 'bg-apple-elevated hover:bg-apple-elevated/70'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="truncate font-medium text-apple-ink">{ticket.title}</div>
                    <StatusPill status={ticket.status} />
                  </div>
                  <div className="text-xs text-apple-faint">
                    {new Date(ticket.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-apple-elevated text-apple-faint">
                <ChatBubbleIcon />
              </div>
              <div className="text-apple-mute">{t('support.noTickets')}</div>
            </div>
          )}
        </div>

        {/* Ticket Detail / Create Form */}
        <div className={`${cardCls} p-5 lg:col-span-2`}>
          {showCreateForm ? (
            <div>
              <h2 className="mb-6 text-[17px] font-semibold text-apple-ink">
                {t('support.createTicket')}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setRateLimitError(null);
                  // Rate limit: max 3 tickets per 60 seconds
                  if (!checkRateLimit(RATE_LIMIT_KEYS.TICKET_CREATE, 3, 60000)) {
                    const resetTime = getRateLimitResetTime(RATE_LIMIT_KEYS.TICKET_CREATE);
                    setRateLimitError(t('support.tooManyRequests', { seconds: resetTime }));
                    return;
                  }
                  createMutation.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-apple-mute">
                    {t('support.subject')}
                  </label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder={t('support.subjectPlaceholder')}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    minLength={3}
                    maxLength={255}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-apple-mute">
                    {t('support.message')}
                  </label>
                  <textarea
                    className={`${inputCls} min-h-[150px]`}
                    placeholder={t('support.messagePlaceholder')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    required
                    minLength={10}
                    maxLength={4000}
                  />
                </div>

                {/* Image attachments for create */}
                <div>
                  <input
                    ref={createFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      files.forEach((file) => handleFileSelect(file, setCreateAttachments));
                      e.target.value = '';
                    }}
                  />
                  <AttachmentsPreview
                    items={createAttachments}
                    onRemove={(idx) =>
                      setCreateAttachments((prev) => {
                        const removed = prev[idx];
                        if (removed?.preview) URL.revokeObjectURL(removed.preview);
                        return prev.filter((_, i) => i !== idx);
                      })
                    }
                  />
                  {createAttachments.length < 10 && (
                    <button
                      type="button"
                      onClick={() => createFileInputRef.current?.click()}
                      disabled={createAttachments.some((a) => a.uploading)}
                      className="mt-2 flex items-center gap-2 text-sm text-apple-mute transition-colors hover:text-apple-ink disabled:opacity-50"
                    >
                      <ImageIcon />
                      {t('support.attachImage')}{' '}
                      {createAttachments.length > 0 && `(${createAttachments.length}/10)`}
                    </button>
                  )}
                </div>

                {rateLimitError && (
                  <div className="rounded-xl border border-apple-red/30 bg-apple-red/10 p-3 text-sm text-apple-red">
                    {rateLimitError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={
                      createAttachments.some((a) => a.uploading) || createMutation.isPending
                    }
                    className="flex items-center gap-2 rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {createMutation.isPending ? <Spinner className="h-4 w-4" /> : <SendIcon />}
                    <span>{t('support.send')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      clearCreateAttachments();
                    }}
                    className="rounded-full bg-apple-elevated px-5 py-2.5 text-[14px] font-semibold text-apple-ink transition-opacity hover:opacity-80"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          ) : selectedTicket ? (
            <div className="flex h-full flex-col">
              <div className="mb-6 flex flex-col gap-2 border-b border-apple-hairline pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-[17px] font-semibold text-apple-ink">
                    {ticketDetail?.title || selectedTicket.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={ticketDetail?.status || selectedTicket.status} />
                    <span className="text-xs text-apple-faint">
                      {t('support.created')}{' '}
                      {new Date(selectedTicket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner />
                </div>
              ) : ticketDetail?.messages ? (
                <div className="scrollbar-hide mb-6 max-h-96 flex-1 space-y-4 overflow-y-auto">
                  {ticketDetail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-4 ${
                        msg.is_from_admin
                          ? 'ml-4 bg-[#F97315]/10 ring-1 ring-[#F97315]/20'
                          : 'mr-4 bg-apple-elevated'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={`text-xs font-medium ${
                            msg.is_from_admin ? 'text-[#F97315]' : 'text-apple-mute'
                          }`}
                        >
                          {msg.is_from_admin ? t('support.supportTeam') : t('support.you')}
                        </span>
                        <span className="text-xs text-apple-faint">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      {msg.message_text && (
                        <div
                          className="whitespace-pre-wrap text-[15px] text-apple-ink [&_a]:text-[#F97315] [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: linkifyText(msg.message_text) }}
                        />
                      )}
                      {/* Display media if present */}
                      <MessageMediaGrid
                        message={msg}
                        translateError={t('support.imageLoadFailed')}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Reply Form */}
              {ticketDetail?.status !== 'closed' && !ticketDetail?.is_reply_blocked && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setRateLimitError(null);
                    // Rate limit: max 5 replies per 30 seconds
                    if (!checkRateLimit(RATE_LIMIT_KEYS.TICKET_REPLY, 5, 30000)) {
                      const resetTime = getRateLimitResetTime(RATE_LIMIT_KEYS.TICKET_REPLY);
                      setRateLimitError(t('support.tooManyRequests', { seconds: resetTime }));
                      return;
                    }
                    replyMutation.mutate();
                  }}
                  className="border-t border-apple-hairline pt-4"
                >
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <textarea
                        className={`${inputCls} min-h-[80px] flex-1`}
                        placeholder={t('support.replyPlaceholder')}
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        maxLength={4000}
                      />
                    </div>

                    {/* Image attachments for reply */}
                    <div>
                      <input
                        ref={replyFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          files.forEach((file) => handleFileSelect(file, setReplyAttachments));
                          e.target.value = '';
                        }}
                      />
                      <AttachmentsPreview
                        items={replyAttachments}
                        onRemove={(idx) =>
                          setReplyAttachments((prev) => {
                            const removed = prev[idx];
                            if (removed?.preview) URL.revokeObjectURL(removed.preview);
                            return prev.filter((_, i) => i !== idx);
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      {replyAttachments.length < 10 && (
                        <button
                          type="button"
                          onClick={() => replyFileInputRef.current?.click()}
                          disabled={replyAttachments.some((a) => a.uploading)}
                          className="flex items-center gap-2 text-sm text-apple-mute transition-colors hover:text-apple-ink disabled:opacity-50"
                        >
                          <ImageIcon />
                          {t('support.attachImage')}{' '}
                          {replyAttachments.length > 0 && `(${replyAttachments.length}/10)`}
                        </button>
                      )}

                      <button
                        type="submit"
                        disabled={
                          (!replyMessage.trim() &&
                            replyAttachments.filter((a) => a.fileId).length === 0) ||
                          replyAttachments.some((a) => a.uploading) ||
                          replyMutation.isPending
                        }
                        className="flex items-center justify-center rounded-full bg-[#F97315] px-5 py-2.5 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {replyMutation.isPending ? <Spinner className="h-4 w-4" /> : <SendIcon />}
                      </button>
                    </div>
                    {rateLimitError && (
                      <div className="mt-2 rounded-xl border border-apple-red/30 bg-apple-red/10 p-3 text-sm text-apple-red">
                        {rateLimitError}
                      </div>
                    )}
                  </div>
                </form>
              )}

              {ticketDetail?.is_reply_blocked && (
                <div className="border-t border-apple-hairline py-4 text-center text-sm text-apple-faint">
                  {t('support.repliesDisabled')}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-apple-elevated text-apple-faint">
                <ChatBubbleIcon />
              </div>
              <div className="text-apple-mute">{t('support.selectTicket')}</div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
