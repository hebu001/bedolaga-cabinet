import { EditIcon } from '@/components/admin/legacyIcons';
import {
EyeIcon,
MailIcon,
ResetIcon,
SaveIcon,
SendIcon,
} from '@/components/admin/legacyPageIcons/AdminEmailTemplates';
import { useNotify } from '@/platform';
import { getApiErrorMessage } from '@/utils/api-error';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
adminEmailTemplatesApi,
type EmailTemplateDetail,
type EmailTemplateLanguageData,
type EmailTemplateType,
} from '../api/adminEmailTemplates';
import { AdminBackButton,BackIcon } from '../components/admin';
import { EmailQueueCard } from '../components/admin/EmailQueueCard';
import { Toggle } from '../components/admin/Toggle';
import { useNativeDialog } from '../platform/hooks/useNativeDialog';

import { Skeleton,SkeletonGroup } from '@/components/ui/skeleton';

const LANG_LABELS: Record<string, string> = {
  ru: 'RU',
  en: 'EN',
  zh: 'ZH',
  ua: 'UA',
  fa: 'FA',
};

const LANG_FULL_LABELS: Record<string, string> = {
  ru: 'Русский',
  en: 'English',
  zh: '中文',
  ua: 'Українська',
  fa: 'فارسی',
};

// ============ Template List View ============

function TemplateCard({
  template,
  currentLang,
  onClick,
}: {
  template: EmailTemplateType;
  currentLang: string;
  onClick: () => void;
}) {
  const label = template.label[currentLang] || template.label['en'] || template.type;
  const description = template.description[currentLang] || template.description['en'] || '';
  const customCount = Object.values(template.languages).filter((l) => l.has_custom).length;
  const { t } = useTranslation();
  const sendingOff = template.enabled === false;

  return (
    <button
      onClick={onClick}
      className={`group w-full rounded-xl border border-apple-hairline bg-apple-card p-3 text-left transition-all duration-200 hover:border-[#F97315]/50 sm:p-4 ${
        sendingOff ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium text-apple-ink transition-colors group-hover:text-[#F97315]">
            {label}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-apple-mute">{description}</p>
        </div>
        <div className="mt-0.5 flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
          {Object.entries(template.languages).map(([lang, status]) => (
            <span
              key={lang}
              className={`inline-flex h-5 w-6 items-center justify-center rounded text-2xs font-medium sm:w-7 ${
                status.has_custom
                  ? 'bg-[#F97315]/20 text-[#F97315]'
                  : 'bg-apple-elevated text-apple-mute'
              }`}
              title={`${LANG_FULL_LABELS[lang] || lang}: ${status.has_custom ? 'Custom' : 'Default'}`}
            >
              {LANG_LABELS[lang] || lang}
            </span>
          ))}
        </div>
      </div>
      {(customCount > 0 || sendingOff) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sendingOff && (
            <span className="inline-flex items-center gap-1 rounded-full bg-error-500/10 px-2 py-0.5 text-2xs text-apple-red">
              <span className="h-1.5 w-1.5 rounded-full bg-error-400" />
              {t('admin.emailTemplates.sendingOffBadge')}
            </span>
          )}
          {customCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F97315]/10 px-2 py-0.5 text-2xs">
              <span className="h-1.5 w-1.5 rounded-full" />
              {customCount} custom
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ============ Template Editor ============

// Extract body content from full HTML (strip base template wrapper)
/** Псевдо-тип общей обёртки писем — см. email_layout в боте. */
const EMAIL_LAYOUT_TYPE = 'email_layout';

function extractBodyContent(html: string): string {
  const contentMatch = html.match(
    /<div class="content">\s*([\s\S]*?)\s*<\/div>\s*<div class="footer">/,
  );
  if (contentMatch) {
    return contentMatch[1].trim();
  }
  return html;
}

function TemplateEditor({
  detail,
  onClose,
  currentLang: interfaceLang,
}: {
  detail: EmailTemplateDetail;
  onClose: () => void;
  currentLang: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { confirm: confirmDialog } = useNativeDialog();

  const [activeLang, setActiveLang] = useState('ru');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const langData: EmailTemplateLanguageData | undefined = detail.languages[activeLang];
  // Общая обёртка писем — не письмо, а каркас: у неё нет темы, а её HTML
  // редактируется целиком (тело письма встаёт в {content}), без вырезания.
  const isLayout = detail.notification_type === EMAIL_LAYOUT_TYPE;

  // Load data for current language (defaults arrive with {placeholders} intact)
  useEffect(() => {
    if (langData) {
      setEditSubject(langData.subject);
      setEditBody(
        langData.is_default && !isLayout
          ? extractBodyContent(langData.body_html)
          : langData.body_html,
      );
      setIsDirty(false);
      setActiveTab('editor');
    }
  }, [activeLang, langData, isLayout]);

  const notifyError = useCallback(
    (error: unknown) => {
      notify.error(getApiErrorMessage(error, t('common.error')));
    },
    [notify, t],
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      adminEmailTemplatesApi.updateTemplate(detail.notification_type, activeLang, {
        subject: isLayout ? EMAIL_LAYOUT_TYPE : editSubject,
        body_html: editBody,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'email-template', detail.notification_type],
      });
      setIsDirty(false);
      notify.success(t('admin.emailTemplates.saved'));
    },
    onError: notifyError,
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => adminEmailTemplatesApi.deleteTemplate(detail.notification_type, activeLang),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'email-template', detail.notification_type],
      });
      setIsDirty(false);
      notify.success(t('admin.emailTemplates.resetted'));
    },
    onError: notifyError,
  });

  // Send test mutation — sends the CURRENT editor content (even unsaved)
  const testMutation = useMutation({
    mutationFn: () =>
      adminEmailTemplatesApi.sendTestEmail(detail.notification_type, {
        language: activeLang,
        email: testEmail.trim(),
        subject: isLayout ? EMAIL_LAYOUT_TYPE : editSubject,
        body_html: editBody,
      }),
    onSuccess: (data) => {
      notify.success(`${t('admin.emailTemplates.testSent')} → ${data.sent_to}`);
    },
    onError: notifyError,
  });

  // Preview mutation — renders current content with sample values
  const previewMutation = useMutation({
    mutationFn: () =>
      adminEmailTemplatesApi.previewTemplate(detail.notification_type, {
        language: activeLang,
        subject: isLayout ? EMAIL_LAYOUT_TYPE : editSubject,
        body_html: editBody,
      }),
    onSuccess: (data) => {
      setPreviewHtml(data.body_html);
      setPreviewSubject(data.subject);
    },
    onError: notifyError,
  });

  const openPreview = () => {
    setActiveTab('preview');
    previewMutation.mutate();
  };

  // Выключатель писем этого типа: отключённое письмо не отправляется никому.
  const enabledMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      adminEmailTemplatesApi.setEnabled(detail.notification_type, enabled),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'email-template', detail.notification_type],
      });
      notify.success(
        data.enabled ? t('admin.emailTemplates.sendingOn') : t('admin.emailTemplates.sendingOff'),
      );
    },
    onError: notifyError,
  });
  const sendingEnabled = detail.enabled !== false;

  const insertVariable = (variable: string) => {
    const token = `{${variable}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setEditBody(editBody + token);
      setIsDirty(true);
      return;
    }
    const start = textarea.selectionStart ?? editBody.length;
    const end = textarea.selectionEnd ?? editBody.length;
    const next = editBody.slice(0, start) + token + editBody.slice(end);
    setEditBody(next);
    setIsDirty(true);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const insertDefaultTemplate = async () => {
    if (!langData) return;
    if (!(await confirmDialog(t('admin.emailTemplates.insertDefaultConfirm')))) return;
    setEditSubject(langData.default_subject);
    setEditBody(
      isLayout ? langData.default_body_html : extractBodyContent(langData.default_body_html),
    );
    setIsDirty(true);
    setActiveTab('editor');
  };

  const label = detail.label[interfaceLang] || detail.label['en'] || detail.notification_type;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 sm:items-center">
        <div className="flex min-w-0 flex-1 basis-48 items-start gap-2 sm:items-center sm:gap-3">
          <button
            onClick={onClose}
            className="mt-0.5 flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-apple-elevated sm:mt-0"
          >
            <BackIcon />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-apple-ink sm:text-lg">{label}</h2>
            <p className="line-clamp-2 text-xs text-apple-mute">
              {detail.description[interfaceLang] || detail.description['en'] || ''}
            </p>
          </div>
        </div>
        {langData && !langData.is_default && (
          <span
            className="flex-shrink-0 rounded-full bg-[#F97315]/15 px-2 py-1 text-2xs font-medium sm:px-2.5 sm:text-xs"
            style={{ color: '#F97315' }}
          >
            Custom
          </span>
        )}
      </div>

      {/* Sending switch — не у обёртки: она не письмо */}
      {!isLayout && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 sm:p-3 ${
            sendingEnabled
              ? 'border-apple-hairline bg-apple-card/60'
              : 'border-error-500/30 bg-error-500/5'
          }`}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-apple-ink">
              {t('admin.emailTemplates.sendingToggle')}
            </div>
            <p className="text-xs text-apple-mute">
              {detail.can_disable === false
                ? t('admin.emailTemplates.sendingLocked')
                : sendingEnabled
                  ? t('admin.emailTemplates.sendingOnHint')
                  : t('admin.emailTemplates.sendingOffHint')}
            </p>
          </div>
          <Toggle
            checked={sendingEnabled}
            disabled={detail.can_disable === false || enabledMutation.isPending}
            onChange={() => enabledMutation.mutate(!sendingEnabled)}
            aria-label={t('admin.emailTemplates.sendingToggle')}
          />
        </div>
      )}

      {/* Language tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-apple-card p-1">
        {Object.keys(detail.languages).map((lang) => {
          const isActive = lang === activeLang;
          const langInfo = detail.languages[lang];
          return (
            <button
              key={lang}
              onClick={async () => {
                if (isDirty && !(await confirmDialog(t('admin.emailTemplates.unsavedWarning'))))
                  return;
                setActiveLang(lang);
              }}
              className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition-all duration-150 sm:gap-1.5 sm:px-3 sm:text-sm ${
                isActive
                  ? 'bg-apple-elevated text-apple-ink shadow-sm'
                  : 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink'
              }`}
            >
              <span className="sm:hidden">{LANG_LABELS[lang] || lang}</span>
              <span className="hidden sm:inline">{LANG_FULL_LABELS[lang] || lang}</span>
              {!langInfo.is_default && (
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: '#F97315' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Editor / Preview tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-apple-card p-1">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150 sm:text-sm ${
            activeTab === 'editor'
              ? 'bg-apple-elevated text-apple-ink shadow-sm'
              : 'text-apple-mute hover:bg-apple-card hover:text-apple-ink'
          }`}
        >
          <EditIcon className="h-4 w-4" />
          {t('admin.emailTemplates.editorTab')}
        </button>
        <button
          onClick={openPreview}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150 sm:text-sm ${
            activeTab === 'preview'
              ? 'bg-apple-elevated text-apple-ink shadow-sm'
              : 'text-apple-mute hover:bg-apple-card hover:text-apple-ink'
          }`}
        >
          <EyeIcon className="h-4 w-4" />
          {t('admin.emailTemplates.preview')}
        </button>
      </div>

      {activeTab === 'preview' ? (
        <div className="space-y-2">
          {previewSubject && (
            <div className="rounded-lg border border-apple-hairline bg-apple-card/60 px-3 py-2">
              <span className="text-xs text-apple-mute">{t('admin.emailTemplates.subject')}: </span>
              <span className="text-sm text-apple-ink">{previewSubject}</span>
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-apple-hairline bg-white">
            {previewMutation.isPending ? (
              <div className="flex h-[420px] items-center justify-center bg-apple-card">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                sandbox=""
                className="h-[420px] w-full sm:h-[560px]"
                title="Email Preview"
              />
            )}
          </div>
          <p className="text-2xs text-apple-faint">{t('admin.emailTemplates.previewHint')}</p>
        </div>
      ) : (
        <>
          {/* Subject — у общей обёртки темы нет */}
          {!isLayout && (
            <div>
              <label className="mb-2 block text-[13px] font-medium text-apple-mute">
                {t('admin.emailTemplates.subject')}
              </label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => {
                  setEditSubject(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                placeholder={t('admin.emailTemplates.subjectPlaceholder')}
              />
            </div>
          )}

          {/* Context variables hint: type-specific + common (available in all templates) */}
          {(detail.context_vars.length > 0 || (detail.common_context_vars?.length ?? 0) > 0) && (
            <div className="space-y-2.5 rounded-lg border border-apple-hairline bg-apple-card/60 p-2.5 sm:p-3">
              {detail.context_vars.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-apple-mute">
                    {t('admin.emailTemplates.variables')}
                  </p>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {detail.context_vars.map((v) => (
                      <code
                        key={v}
                        className="cursor-pointer rounded bg-apple-elevated px-2 py-0.5 font-mono text-xs transition-colors hover:opacity-90"
                        title={t('admin.emailTemplates.clickToInsert')}
                        onClick={() => insertVariable(v)}
                      >
                        {`{${v}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              {(detail.common_context_vars?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-apple-mute">
                    {t('admin.emailTemplates.variablesCommon')}
                  </p>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {detail.common_context_vars!.map((v) => (
                      <code
                        key={v}
                        className="cursor-pointer rounded bg-apple-card px-2 py-0.5 font-mono text-xs text-apple-mute ring-1 ring-dark-600 transition-colors hover:bg-apple-elevated hover:text-[#F97315]"
                        title={t('admin.emailTemplates.clickToInsert')}
                        onClick={() => insertVariable(v)}
                      >
                        {`{${v}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Body HTML editor */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-apple-mute">
                {t('admin.emailTemplates.body')}
              </label>
              <button
                onClick={insertDefaultTemplate}
                className="text-xs text-apple-mute underline-offset-2 transition-colors hover:text-[#F97315] hover:underline"
              >
                {t('admin.emailTemplates.insertDefault')}
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={editBody}
              onChange={(e) => {
                setEditBody(e.target.value);
                setIsDirty(true);
              }}
              rows={12}
              className="min-h-[200px] w-full resize-y rounded-xl bg-apple-elevated px-4 py-3 font-mono text-xs leading-relaxed text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 sm:min-h-[300px] sm:text-sm"
              placeholder="<h2>Title</h2><p>Content...</p>"
              spellCheck={false}
            />
            <p className="mt-1 text-2xs text-apple-faint">{t('admin.emailTemplates.bodyHint')}</p>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#F97315] px-3 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-2"
          >
            <SaveIcon className="h-4 w-4" />
            {saveMutation.isPending ? t('common.loading') : t('common.save')}
          </button>

          {langData && !langData.is_default && (
            <button
              onClick={async () => {
                if (await confirmDialog(t('admin.emailTemplates.resetConfirm'))) {
                  resetMutation.mutate();
                }
              }}
              disabled={resetMutation.isPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-apple-elevated px-3 py-2.5 text-sm font-medium text-apple-amber transition-colors hover:bg-dark-600 disabled:opacity-40 sm:px-4 sm:py-2"
            >
              <ResetIcon className="h-4 w-4" />
              <span className="truncate">{t('admin.emailTemplates.resetDefault')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Test email */}
      <div className="apple-card-grad rounded-2xl bg-apple-card p-2.5 sm:p-3">
        <p className="mb-2 text-xs font-medium text-apple-mute">
          {t('admin.emailTemplates.sendTest')}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="input min-w-0 flex-1"
            placeholder={t('admin.emailTemplates.testRecipientPlaceholder')}
          />
          <button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-apple-elevated px-3 py-2.5 text-sm font-medium text-apple-ink transition-opacity hover:opacity-90 disabled:opacity-40 sm:px-4 sm:py-2"
          >
            <SendIcon className="h-4 w-4" />
            {testMutation.isPending ? t('common.loading') : t('admin.emailTemplates.sendTest')}
          </button>
        </div>
        <p className="mt-1.5 text-2xs text-apple-faint">{t('admin.emailTemplates.testHint')}</p>
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function AdminEmailTemplates() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'ru';
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Fetch template types list
  const { data: typesData, isLoading: typesLoading } = useQuery({
    queryKey: ['admin', 'email-templates'],
    queryFn: adminEmailTemplatesApi.getTemplateTypes,
  });

  // Fetch detail for selected type
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'email-template', selectedType],
    queryFn: () => adminEmailTemplatesApi.getTemplate(selectedType!),
    enabled: !!selectedType,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
      {/* Page Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <AdminBackButton className="flex-shrink-0 rounded-xl bg-apple-card p-1.5 transition-opacity hover:opacity-90 sm:p-2" />
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div className="flex-shrink-0 rounded-xl bg-[#F97315]/15 p-1.5 sm:p-2">
            <MailIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-apple-ink sm:text-xl">
              {t('admin.emailTemplates.title')}
            </h1>
            <p className="truncate text-xs text-apple-mute">
              {t('admin.emailTemplates.description')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {selectedType && detailData ? (
        <TemplateEditor
          detail={detailData}
          onClose={() => setSelectedType(null)}
          currentLang={currentLang}
        />
      ) : (
        <>
          {/* Состояние очереди писем — видно сразу, без похода в базу */}
          <EmailQueueCard />

          {/* Template List */}
          {typesLoading ? (
            <SkeletonGroup className="space-y-3">
              <Skeleton variant="card" count={6} className="h-20 rounded-xl" />
            </SkeletonGroup>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              {typesData?.items.map((template) => (
                <TemplateCard
                  key={template.type}
                  template={template}
                  currentLang={currentLang}
                  onClick={() => setSelectedType(template.type)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail loading overlay */}
      {selectedType && detailLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
