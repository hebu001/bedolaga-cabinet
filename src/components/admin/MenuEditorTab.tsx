import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  menuLayoutApi,
  type MenuConfig,
  type MenuRowConfig,
  type MenuButtonConfig,
  BUILTIN_SECTIONS,
  BOT_LOCALES,
  STYLE_OPTIONS,
} from '../../api/menuLayout';
import { Toggle } from './Toggle';
import { useNotify } from '../../platform/hooks/useNotify';

const GripIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
    />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const LinkIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.03 8.591"
    />
  </svg>
);

const CallbackIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 6.75h9m-9 5.25h9m-9 5.25h5.25M3.75 5.25v3m0 3v3m0 3v1.5"
    />
  </svg>
);

const ArrowUpIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

function generateId(): string {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateRowId(): string {
  return `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function configsEqual(a: MenuConfig, b: MenuConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const DEFAULT_CONFIG: MenuConfig = { rows: [], callback_actions: [] };

interface MaxPerRowSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

function MaxPerRowSelector({ value, onChange }: MaxPerRowSelectorProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
            value === n
              ? 'bg-[#F97315] text-white'
              : 'bg-apple-elevated text-apple-mute hover:text-apple-ink hover:opacity-90'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

interface ButtonChipProps {
  button: MenuButtonConfig;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<MenuButtonConfig>) => void;
  onRemove: () => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  isBuiltin: boolean;
  callbackActions: string[];
}

function ButtonChip({
  button,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isBuiltin,
  callbackActions,
}: ButtonChipProps) {
  const { t } = useTranslation();

  const displayName =
    button.labels.ru ||
    button.labels.en ||
    (isBuiltin
      ? t(`admin.buttons.sections.${button.id}`)
      : button.type === 'callback' && button.callback_data
        ? t(`admin.menuEditor.callbackActions.${button.callback_data}`)
        : button.id);

  const styleOption = STYLE_OPTIONS.find((s) => s.value === button.style);
  const colorDotClass = styleOption?.colorClass || 'bg-apple-faint';

  return (
    <div
      className={`overflow-hidden rounded-xl transition-colors ${
        button.enabled ? 'bg-apple-card' : 'bg-apple-card opacity-60'
      }`}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex shrink-0 flex-col">
          <button
            onClick={onMoveUp ?? undefined}
            disabled={!onMoveUp}
            aria-label={t('admin.menuEditor.moveUp')}
            className={`rounded-lg p-1.5 transition-colors ${
              onMoveUp
                ? 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink'
                : 'cursor-default text-apple-faint'
            }`}
          >
            <ArrowUpIcon />
          </button>
          <button
            onClick={onMoveDown ?? undefined}
            disabled={!onMoveDown}
            aria-label={t('admin.menuEditor.moveDown')}
            className={`rounded-lg p-1.5 transition-colors ${
              onMoveDown
                ? 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink'
                : 'cursor-default text-apple-faint'
            }`}
          >
            <ArrowDownIcon />
          </button>
        </div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorDotClass}`} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-apple-ink">
          {displayName}
        </span>
        {!isBuiltin && (
          <span
            className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium uppercase tracking-wide ${
              button.type === 'callback'
                ? 'bg-[#F97315]/10 text-[#F97315]'
                : 'bg-apple-elevated text-apple-faint'
            }`}
            title={
              button.type === 'callback'
                ? t('admin.menuEditor.callbackButton')
                : t('admin.menuEditor.urlButton')
            }
          >
            {button.type === 'callback' ? <CallbackIcon /> : <LinkIcon />}
            <span className="hidden sm:inline">
              {button.type === 'callback'
                ? t('admin.menuEditor.callbackBadge')
                : t('admin.menuEditor.urlBadge')}
            </span>
          </span>
        )}
        <Toggle checked={button.enabled} onChange={() => onUpdate({ enabled: !button.enabled })} />
        <button
          onClick={onToggleExpand}
          className="rounded-lg p-1 text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink"
        >
          <ChevronIcon expanded={isExpanded} />
        </button>
        {!isBuiltin && (
          <button
            onClick={onRemove}
            className="rounded-lg p-1 text-apple-faint transition-colors hover:bg-apple-red/10 hover:text-apple-red"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="space-y-3 border-t border-apple-hairline px-3 py-3">
          {/* Color selector */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-apple-mute">
              {t('admin.buttons.color')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdate({ style: opt.value })}
                  className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all ${
                    button.style === opt.value
                      ? 'bg-[#F97315]/10 text-[#F97315]'
                      : 'bg-apple-elevated text-apple-mute hover:opacity-90'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.colorClass}`} />
                  {t(`admin.buttons.styles.${opt.value}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji ID */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-apple-mute">
              {t('admin.buttons.emojiId')}
            </label>
            <input
              type="text"
              value={button.icon_custom_emoji_id}
              onChange={(e) => onUpdate({ icon_custom_emoji_id: e.target.value })}
              placeholder={t('admin.buttons.emojiPlaceholder')}
              className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
            />
          </div>

          {/* URL input + open mode */}
          {button.type === 'custom' && (
            <>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-apple-mute">URL</label>
                <input
                  type="url"
                  value={button.url || ''}
                  onChange={(e) => onUpdate({ url: e.target.value || null })}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-apple-mute">
                  {t('admin.menuEditor.openIn')}
                </label>
                <div className="flex gap-1.5">
                  {(['external', 'webapp'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onUpdate({ open_in: mode })}
                      className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all ${
                        button.open_in === mode
                          ? 'bg-[#F97315]/10 text-[#F97315]'
                          : 'bg-apple-elevated text-apple-mute hover:opacity-90'
                      }`}
                    >
                      {t(`admin.menuEditor.openMode.${mode}`)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Telegram callback action */}
          {button.type === 'callback' && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-apple-mute">
                {t('admin.menuEditor.callbackAction')}
              </label>
              <select
                value={button.callback_data || ''}
                onChange={(event) => onUpdate({ callback_data: event.target.value || null })}
                className="w-full appearance-none rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none focus:ring-2 focus:ring-[#F97315]/50"
              >
                {callbackActions.map((action) => (
                  <option key={action} value={action}>
                    {t(`admin.menuEditor.callbackActions.${action}`)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] leading-relaxed text-apple-faint">
                {t('admin.menuEditor.callbackHint')}
              </p>
            </div>
          )}

          {/* Localized labels */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-apple-mute">
              {t('admin.buttons.customLabels')}
            </label>
            <div className="space-y-2">
              {BOT_LOCALES.map((locale) => (
                <div key={locale} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-center text-[10px] font-semibold uppercase text-apple-faint">
                    {locale}
                  </span>
                  <input
                    type="text"
                    value={button.labels[locale] || ''}
                    onChange={(e) =>
                      onUpdate({
                        labels: { ...button.labels, [locale]: e.target.value },
                      })
                    }
                    placeholder={t('admin.menuEditor.buttonTextPlaceholder')}
                    maxLength={100}
                    className="w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
                  />
                </div>
              ))}
              <p className="text-[10px] text-apple-faint">
                {t('admin.menuEditor.customLabelsHint')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SortableRowProps {
  row: MenuRowConfig;
  rowIndex: number;
  expandedButtons: Set<string>;
  usedBuiltinIds: Set<string>;
  onToggleExpand: (buttonId: string) => void;
  onUpdateRow: (rowId: string, updates: Partial<MenuRowConfig>) => void;
  onRemoveRow: (rowId: string) => void;
  onUpdateButton: (rowId: string, buttonId: string, updates: Partial<MenuButtonConfig>) => void;
  onRemoveButton: (rowId: string, buttonId: string) => void;
  onAddBuiltin: (rowId: string, sectionId: string) => void;
  onAddCustom: (rowId: string) => void;
  onAddCallback: (rowId: string) => void;
  onReorderButton: (rowId: string, buttonIndex: number, direction: 'up' | 'down') => void;
  callbackActions: string[];
}

function SortableRow({
  row,
  rowIndex,
  expandedButtons,
  usedBuiltinIds,
  onToggleExpand,
  onUpdateRow,
  onRemoveRow,
  onUpdateButton,
  onRemoveButton,
  onAddBuiltin,
  onAddCustom,
  onAddCallback,
  onReorderButton,
  callbackActions,
}: SortableRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  const allBuiltin = row.buttons.every((b) => b.type === 'builtin');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-2xl bg-apple-card transition-all ${
        isDragging ? 'shadow-xl shadow-black/40 ring-1 ring-[#F97315]/40' : ''
      }`}
    >
      {/* Row header */}
      <div className="flex items-center gap-3 border-b border-apple-hairline px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab touch-none rounded-lg p-1.5 text-apple-faint hover:bg-apple-elevated hover:text-apple-ink active:cursor-grabbing"
          title={t('admin.menuEditor.dragToReorder')}
        >
          <GripIcon />
        </button>
        <span className="text-sm font-semibold text-apple-ink">
          {t('admin.menuEditor.row')} {rowIndex + 1}
        </span>
        <div className="flex-1" />
        <MaxPerRowSelector
          value={row.max_per_row}
          onChange={(value) => onUpdateRow(row.id, { max_per_row: value })}
        />
        {!allBuiltin && (
          <button
            onClick={() => onRemoveRow(row.id)}
            className="rounded-lg p-1.5 text-apple-faint transition-colors hover:bg-apple-red/10 hover:text-apple-red"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Row body */}
      <div className="space-y-2 p-3">
        {row.buttons.map((button, btnIndex) => (
          <ButtonChip
            key={button.id}
            button={button}
            isExpanded={expandedButtons.has(button.id)}
            onToggleExpand={() => onToggleExpand(button.id)}
            onUpdate={(updates) => onUpdateButton(row.id, button.id, updates)}
            onRemove={() => onRemoveButton(row.id, button.id)}
            onMoveUp={btnIndex > 0 ? () => onReorderButton(row.id, btnIndex, 'up') : null}
            onMoveDown={
              btnIndex < row.buttons.length - 1
                ? () => onReorderButton(row.id, btnIndex, 'down')
                : null
            }
            isBuiltin={button.type === 'builtin'}
            callbackActions={callbackActions}
          />
        ))}

        {/* Inline add button panel */}
        <InlineAddPanel
          rowId={row.id}
          usedBuiltinIds={usedBuiltinIds}
          onAddBuiltin={onAddBuiltin}
          onAddCustom={onAddCustom}
          onAddCallback={onAddCallback}
          canAddCallback={callbackActions.length > 0}
        />
      </div>
    </div>
  );
}

interface InlineAddPanelProps {
  rowId: string;
  usedBuiltinIds: Set<string>;
  onAddBuiltin: (rowId: string, sectionId: string) => void;
  onAddCustom: (rowId: string) => void;
  onAddCallback: (rowId: string) => void;
  canAddCallback: boolean;
}

function InlineAddPanel({
  rowId,
  usedBuiltinIds,
  onAddBuiltin,
  onAddCustom,
  onAddCallback,
  canAddCallback,
}: InlineAddPanelProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const availableBuiltins = BUILTIN_SECTIONS.filter((id) => !usedBuiltinIds.has(id));

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-apple-hairline py-2.5 text-sm text-apple-faint transition-colors hover:text-apple-mute"
      >
        <PlusIcon />
        {t('admin.menuEditor.addButton')}
      </button>
    );
  }

  return (
    <div className="space-y-1 rounded-xl bg-apple-elevated p-2">
      {availableBuiltins.length > 0 && (
        <>
          <p className="px-2 pb-0.5 text-xs font-medium text-apple-faint">
            {t('admin.menuEditor.builtinButtons')}
          </p>
          {availableBuiltins.map((id) => (
            <button
              key={id}
              onClick={() => {
                onAddBuiltin(rowId, id);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-apple-ink transition-colors hover:bg-apple-card"
            >
              {t(`admin.buttons.sections.${id}`)}
            </button>
          ))}
          <div className="my-1 border-t border-apple-hairline" />
        </>
      )}
      <button
        onClick={() => {
          onAddCustom(rowId);
          setIsOpen(false);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-apple-ink transition-colors hover:bg-apple-card"
      >
        <LinkIcon />
        {t('admin.menuEditor.addUrlButton')}
      </button>
      {canAddCallback && (
        <button
          onClick={() => {
            onAddCallback(rowId);
            setIsOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-apple-ink transition-colors hover:bg-apple-card"
        >
          <CallbackIcon />
          {t('admin.menuEditor.addCallbackButton')}
        </button>
      )}
      <button
        onClick={() => setIsOpen(false)}
        className="flex w-full items-center justify-center rounded-lg py-1.5 text-xs text-apple-faint transition-colors hover:text-apple-mute"
      >
        {t('common.cancel')}
      </button>
    </div>
  );
}

export function MenuEditorTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notify = useNotify();

  // Fetch config
  const {
    data: serverConfig,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['menu-layout'],
    queryFn: menuLayoutApi.getConfig,
  });

  // Draft state
  const [draftConfig, setDraftConfig] = useState<MenuConfig>(DEFAULT_CONFIG);
  const [expandedButtons, setExpandedButtons] = useState<Set<string>>(new Set());
  const savedConfigRef = useRef<MenuConfig>(DEFAULT_CONFIG);
  const draftConfigRef = useRef(draftConfig);
  draftConfigRef.current = draftConfig;

  // Sync server data to draft (same pattern as ButtonsTab)
  useEffect(() => {
    if (serverConfig) {
      if (
        configsEqual(savedConfigRef.current, draftConfigRef.current) ||
        configsEqual(savedConfigRef.current, DEFAULT_CONFIG)
      ) {
        setDraftConfig(serverConfig);
        savedConfigRef.current = serverConfig;
      }
    }
  }, [serverConfig]);

  const hasUnsavedChanges = !configsEqual(draftConfig, savedConfigRef.current);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: menuLayoutApi.updateConfig,
    onSuccess: (data) => {
      savedConfigRef.current = data;
      setDraftConfig(data);
      queryClient.setQueryData(['menu-layout'], data);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } };
      const detail = error.response?.data?.detail;
      notify.error(detail || t('common.error'));
    },
  });

  const resetMutation = useMutation({
    mutationFn: menuLayoutApi.resetConfig,
    onSuccess: (data) => {
      savedConfigRef.current = data;
      setDraftConfig(data);
      queryClient.setQueryData(['menu-layout'], data);
    },
    onError: () => {
      notify.error(t('common.error'));
    },
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDraftConfig((prev) => {
        const oldIndex = prev.rows.findIndex((r) => r.id === active.id);
        const newIndex = prev.rows.findIndex((r) => r.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return { ...prev, rows: arrayMove(prev.rows, oldIndex, newIndex) };
      });
    }
  }, []);

  // Row CRUD
  const updateRow = useCallback((rowId: string, updates: Partial<MenuRowConfig>) => {
    setDraftConfig((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === rowId ? { ...r, ...updates } : r)),
    }));
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setDraftConfig((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId),
    }));
  }, []);

  const addRow = useCallback(() => {
    setDraftConfig((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          id: generateRowId(),
          max_per_row: 2,
          buttons: [],
        },
      ],
    }));
  }, []);

  // Button CRUD
  const updateButton = useCallback(
    (rowId: string, buttonId: string, updates: Partial<MenuButtonConfig>) => {
      setDraftConfig((prev) => ({
        ...prev,
        rows: prev.rows.map((r) =>
          r.id === rowId
            ? {
                ...r,
                buttons: r.buttons.map((b) => (b.id === buttonId ? { ...b, ...updates } : b)),
              }
            : r,
        ),
      }));
    },
    [],
  );

  const removeButton = useCallback((rowId: string, buttonId: string) => {
    setDraftConfig((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.id === rowId ? { ...r, buttons: r.buttons.filter((b) => b.id !== buttonId) } : r,
      ),
    }));
  }, []);

  const addBuiltinButton = useCallback((rowId: string, sectionId: string) => {
    const newButton: MenuButtonConfig = {
      id: sectionId,
      type: 'builtin',
      style: 'default',
      icon_custom_emoji_id: '',
      enabled: true,
      labels: {},
      url: null,
      open_in: 'external',
      callback_data: null,
    };
    setDraftConfig((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.id === rowId ? { ...r, buttons: [...r.buttons, newButton] } : r,
      ),
    }));
  }, []);

  const addCustomButton = useCallback((rowId: string) => {
    const newButton: MenuButtonConfig = {
      id: generateId(),
      type: 'custom',
      style: 'default',
      icon_custom_emoji_id: '',
      enabled: true,
      labels: {},
      url: '',
      open_in: 'external',
      callback_data: null,
    };
    setDraftConfig((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.id === rowId ? { ...r, buttons: [...r.buttons, newButton] } : r,
      ),
    }));
  }, []);

  const addCallbackButton = useCallback((rowId: string) => {
    const callbackData = draftConfigRef.current.callback_actions[0] || null;
    const newButton: MenuButtonConfig = {
      id: generateId(),
      type: 'callback',
      style: 'default',
      icon_custom_emoji_id: '',
      enabled: true,
      labels: {},
      url: null,
      open_in: 'external',
      callback_data: callbackData,
    };
    setDraftConfig((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.id === rowId ? { ...row, buttons: [...row.buttons, newButton] } : row,
      ),
    }));
  }, []);

  const reorderButton = useCallback(
    (rowId: string, buttonIndex: number, direction: 'up' | 'down') => {
      setDraftConfig((prev) => ({
        ...prev,
        rows: prev.rows.map((r) => {
          if (r.id !== rowId) return r;
          const newIndex = direction === 'up' ? buttonIndex - 1 : buttonIndex + 1;
          if (newIndex < 0 || newIndex >= r.buttons.length) return r;
          return { ...r, buttons: arrayMove(r.buttons, buttonIndex, newIndex) };
        }),
      }));
    },
    [],
  );

  // Expand/collapse
  const toggleExpand = useCallback((buttonId: string) => {
    setExpandedButtons((prev) => {
      const next = new Set(prev);
      if (next.has(buttonId)) {
        next.delete(buttonId);
      } else {
        next.add(buttonId);
      }
      return next;
    });
  }, []);

  // Collect used builtin IDs across all rows
  const usedBuiltinIds = useMemo(
    () =>
      new Set(
        draftConfig.rows.flatMap((r) =>
          r.buttons.filter((b) => b.type === 'builtin').map((b) => b.id),
        ),
      ),
    [draftConfig.rows],
  );

  // Handlers
  const handleSave = useCallback(() => {
    // Validate custom buttons have valid URLs
    const currentDraft = draftConfigRef.current;
    for (const row of currentDraft.rows) {
      for (const btn of row.buttons) {
        if (btn.type === 'custom') {
          if (
            !btn.url ||
            (!btn.url.startsWith('http://') &&
              !btn.url.startsWith('https://') &&
              !btn.url.startsWith('tg://'))
          ) {
            notify.error(t('admin.menuEditor.invalidUrl'));
            return;
          }
        } else if (
          btn.type === 'callback' &&
          (!btn.callback_data || !currentDraft.callback_actions.includes(btn.callback_data))
        ) {
          notify.error(t('admin.menuEditor.invalidCallback'));
          return;
        }
      }
    }
    updateMutation.mutate(currentDraft);
  }, [updateMutation, notify, t]);

  const handleCancel = useCallback(() => {
    setDraftConfig(savedConfigRef.current);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-apple-mute">
        <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        {t('common.loading')}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl bg-apple-red/10 px-4 py-3 text-sm text-apple-red">
        {t('common.error')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drag hint */}
      <div className="flex items-center gap-2 text-sm text-apple-faint">
        <GripIcon />
        {t('admin.menuEditor.dragHint')}
      </div>

      {/* Rows */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={draftConfig.rows.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {draftConfig.rows.map((row, index) => (
              <SortableRow
                key={row.id}
                row={row}
                rowIndex={index}
                expandedButtons={expandedButtons}
                usedBuiltinIds={usedBuiltinIds}
                onToggleExpand={toggleExpand}
                onUpdateRow={updateRow}
                onRemoveRow={removeRow}
                onUpdateButton={updateButton}
                onRemoveButton={removeButton}
                onAddBuiltin={addBuiltinButton}
                onAddCustom={addCustomButton}
                onAddCallback={addCallbackButton}
                onReorderButton={reorderButton}
                callbackActions={draftConfig.callback_actions}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add row */}
      <button
        onClick={addRow}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-apple-hairline py-4 text-sm font-medium text-apple-faint transition-colors hover:text-apple-mute"
      >
        <PlusIcon />
        {t('admin.menuEditor.addRow')}
      </button>

      {/* Save / Cancel */}
      {hasUnsavedChanges && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-full bg-[#F97315] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
          <button
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            className="rounded-full bg-apple-elevated px-4 py-2 text-sm font-medium text-apple-ink transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Reset */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (window.confirm(t('admin.menuEditor.resetConfirm'))) {
              resetMutation.mutate();
            }
          }}
          disabled={resetMutation.isPending}
          className="rounded-full bg-apple-elevated px-4 py-2 text-sm text-apple-ink transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {t('admin.buttons.resetAll')}
        </button>
      </div>
    </div>
  );
}
