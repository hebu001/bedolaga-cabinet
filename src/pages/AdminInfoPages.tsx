import {
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from '@/components/admin/legacyPageIcons/AdminInfoPages';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { infoPagesApi } from '../api/infoPages';
import { AdminBackButton, backTo } from '../components/admin';
import { Toggle } from '../components/admin/Toggle';
import { cn } from '../lib/utils';
import { useHapticFeedback } from '../platform/hooks/useHaptic';
import { useDestructiveConfirm } from '../platform/hooks/useNativeDialog';

import { ListRowSkeleton } from '@/components/admin/ListRowSkeleton';
import type { InfoPageListItem, InfoPageType } from '../api/infoPages';

type FilterTab = 'all' | 'page' | 'faq';

// --- Page Row ---

const PageRow = memo(function PageRow({
  page,
  locale,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  page: InfoPageListItem;
  locale: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const { t } = useTranslation();
  const resolvedTitle = page.title[locale] || page.title['ru'] || page.title['en'] || '';

  return (
    <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
      {/* На телефоне кнопки — отдельной строкой: рядом с ними заголовку оставалось 72 px. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {page.icon && <span className="text-base">{page.icon}</span>}
            <span className="max-w-full rounded bg-apple-elevated px-2 py-0.5 font-mono text-[10px] font-medium text-apple-mute break-all">
              /{page.slug}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                page.page_type === 'faq'
                  ? 'bg-apple-amber/15 text-apple-amber'
                  : 'bg-apple-blue/15 text-apple-blue'
              }`}
            >
              {page.page_type === 'faq' ? 'FAQ' : t('admin.infoPages.typePage')}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                page.is_active
                  ? 'bg-apple-green/15 text-apple-green'
                  : 'bg-apple-elevated text-apple-mute'
              }`}
            >
              {page.is_active ? t('admin.infoPages.active') : t('admin.infoPages.inactive')}
            </span>
            {page.replaces_tab && (
              <span className="rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                {t(`admin.infoPages.replacesTabOptions.${page.replaces_tab}`)}
              </span>
            )}
            <span className="text-xs text-apple-faint">#{page.id}</span>
          </div>

          <p className="truncate text-sm font-medium text-apple-ink">{resolvedTitle}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-apple-faint">
            <span className="whitespace-nowrap">
              {t('admin.infoPages.fields.sortOrder')}: {page.sort_order}
            </span>
            {page.updated_at && <span>{new Date(page.updated_at).toLocaleDateString()}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-apple-hairline/50 pt-2 sm:border-0 sm:pt-0">
          <Toggle
            checked={page.is_active}
            onChange={onToggleActive}
            aria-label={t('admin.infoPages.fields.isActive')}
          />
          <button
            type="button"
            onClick={onEdit}
            className="min-h-[44px] min-w-[44px] rounded-lg p-2.5 text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink"
            title={t('admin.infoPages.edit')}
            aria-label={t('admin.infoPages.edit')}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="min-h-[44px] min-w-[44px] rounded-lg p-2.5 text-apple-mute transition-colors hover:bg-apple-red/10 hover:text-apple-red"
            title={t('admin.infoPages.delete')}
            aria-label={t('admin.infoPages.delete')}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

// --- Row Wrapper (stable callbacks for memo) ---

interface PageRowWrapperProps {
  page: InfoPageListItem;
  locale: string;
  onNavigate: (path: string) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number) => void;
}

const PageRowWrapper = memo(function PageRowWrapper({
  page,
  locale,
  onNavigate,
  onDelete,
  onToggleActive,
}: PageRowWrapperProps) {
  const handleEdit = useCallback(
    () => onNavigate(`/admin/info-pages/${page.id}/edit`),
    [page.id, onNavigate],
  );
  const handleDelete = useCallback(() => onDelete(page.id), [page.id, onDelete]);
  const handleToggleActive = useCallback(() => onToggleActive(page.id), [page.id, onToggleActive]);

  return (
    <PageRow
      page={page}
      locale={locale}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onToggleActive={handleToggleActive}
    />
  );
});

export default function AdminInfoPages() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const haptic = useHapticFeedback();
  const confirm = useDestructiveConfirm();
  const currentLocale = i18n.language.split('-')[0];
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filterParam: InfoPageType | undefined = activeFilter === 'all' ? undefined : activeFilter;

  const {
    data: pages,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'info-pages', 'list', activeFilter],
    queryFn: () => infoPagesApi.getAdminPages(filterParam),
    staleTime: 30_000,
  });

  const items = pages ?? [];

  const deleteMutation = useMutation({
    mutationFn: infoPagesApi.deletePage,
    onSuccess: () => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: ['admin', 'info-pages'] });
      queryClient.invalidateQueries({ queryKey: ['info-pages'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: infoPagesApi.toggleActive,
    onSuccess: () => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: ['admin', 'info-pages'] });
      queryClient.invalidateQueries({ queryKey: ['info-pages'] });
    },
  });

  const handleDelete = useCallback(
    async (id: number) => {
      const confirmed = await confirm(t('admin.infoPages.confirmDelete'));
      if (confirmed) {
        deleteMutation.mutate(id);
      }
    },
    [confirm, deleteMutation, t],
  );

  const handleToggleActive = useCallback(
    (id: number) => {
      toggleActiveMutation.mutate(id);
    },
    [toggleActiveMutation],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          <AdminBackButton />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-apple-ink">{t('admin.infoPages.title')}</h1>
            {items.length > 0 && (
              <span className="rounded-full bg-apple-elevated px-2 py-0.5 text-xs font-medium text-apple-mute">
                {items.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              haptic.buttonPress();
              navigate('/admin/legal-pages', backTo(location));
            }}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-apple-card px-4 py-2.5 text-apple-ink transition-colors hover:bg-apple-elevated"
            aria-label={t('admin.legalPages.open')}
          >
            <FileTextIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.legalPages.open')}</span>
          </button>
          <button
            onClick={() => refetch()}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-apple-card p-2.5 text-apple-mute transition-colors hover:text-apple-ink"
            aria-label={t('common.refresh')}
          >
            <RefreshIcon />
          </button>
          <button
            onClick={() => {
              haptic.buttonPress();
              navigate('/admin/info-pages/create?type=faq');
            }}
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-apple-amber px-4 py-2.5 text-white transition-opacity hover:opacity-90"
            aria-label={t('admin.infoPages.createFaq')}
          >
            <PlusIcon />
            <span className="hidden sm:inline">{t('admin.infoPages.createFaq')}</span>
          </button>
          <button
            onClick={() => {
              haptic.buttonPress();
              navigate('/admin/info-pages/create');
            }}
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-[#F97315] px-4 py-2.5 text-white transition-opacity hover:opacity-90"
            aria-label={t('admin.infoPages.create')}
          >
            <PlusIcon />
            <span className="hidden sm:inline">{t('admin.infoPages.create')}</span>
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        {(['all', 'page', 'faq'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveFilter(tab)}
            className={cn(
              'min-h-[44px] rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
              activeFilter === tab
                ? 'bg-[#F97315] text-white'
                : 'bg-apple-elevated text-apple-mute hover:bg-dark-600 hover:text-apple-ink',
            )}
          >
            {t(`admin.infoPages.filter.${tab}`)}
          </button>
        ))}
      </div>

      {/* Pages list */}
      {isLoading ? (
        <ListRowSkeleton />
      ) : items.length === 0 ? (
        <div className="apple-card-grad flex flex-col items-center rounded-2xl bg-apple-card p-8 text-center text-apple-mute">
          <FileTextIcon className="h-6 w-6" />
          <p className="mt-2">{t('admin.infoPages.noPages')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((page) => (
            <PageRowWrapper
              key={page.id}
              page={page}
              locale={currentLocale}
              onNavigate={navigate}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
