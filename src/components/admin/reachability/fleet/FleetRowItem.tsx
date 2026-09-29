import { ChevronDownIcon,ChevronRightIcon } from '@/components/admin/legacyIcons';
import { useTranslation } from 'react-i18next';

import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { PurposeChip } from '../PurposeChip';
import { CheckGlyph } from '../SelectableRow';
import { relativeAge } from '../relativeAge';
import type { TargetProgress } from './batchProgress';
import type { FleetRow,FleetState } from './fleet';

export const STATE_TEXT: Record<FleetState | 'checking', string> = {
  ok: 'text-apple-green',
  partial: 'text-apple-amber',
  down: 'text-apple-red',
  unchecked: 'text-apple-mute',
  checking: 'text-[#F97315]',
};

export const STATE_DOT: Record<FleetState | 'checking', string> = {
  ok: 'bg-success-400',
  partial: 'bg-warning-400',
  down: 'bg-error-400',
  unchecked: 'bg-dark-500',
  checking: 'bg-accent-400',
};

/** Ширины колонок «Симки» и «Проверено»: одни и те же у шапки таблицы и у строк. */
export const COL_UNITS = 'md:w-36 md:shrink-0';
export const COL_AGE = 'md:w-28 md:shrink-0';

interface FleetRowItemProps {
  row: FleetRow;
  picked: boolean;
  onToggle: (ref: string) => void;
  onDetails: (row: FleetRow) => void;
  /** Карточка сервера раскрыта прямо под строкой. */
  expanded?: boolean;
  progress?: TargetProgress;
}

interface Cells {
  /** Цвет точки состояния; без точки у непроверенного сервера. */
  dot: string | null;
  units: string;
  when: string;
  whenTone: string;
}

/** Счёт «у 7 из 15» и давность; пока идёт проверка, вместо давности — «Проверяем…» или «ждёт очереди». */
function useCells(row: FleetRow, progress: TargetProgress | undefined): Cells {
  const { t, i18n } = useTranslation();
  const base = 'admin.reachability';
  if (progress?.state === 'queued') {
    return {
      dot: STATE_DOT.unchecked,
      units: '',
      when: t(`${base}.batch.queued`),
      whenTone: 'text-apple-mute',
    };
  }
  if (progress?.state === 'checking') {
    const units =
      progress.total > 0
        ? t(`${base}.fleet.ofUnits`, { ok: progress.ok, total: progress.total })
        : '';
    return {
      dot: STATE_DOT.checking,
      units,
      when: t(`${base}.fleet.state.checking`),
      whenTone: STATE_TEXT.checking,
    };
  }
  if (row.state === 'unchecked') return { dot: null, units: '', when: '', whenTone: '' };
  return {
    dot: STATE_DOT[row.state],
    units: t(`${base}.fleet.ofUnits`, { ok: row.ok, total: row.total }),
    when: row.checkedAt ? relativeAge(row.checkedAt, i18n.language) : '',
    whenTone: 'text-apple-mute',
  };
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', className)} />;
}

/**
 * Строка таблицы серверов: сама строка — чекбокс цели (тап отмечает сервер), в ней имя с меткой
 * назначения, адрес, счёт симок с точкой состояния и давность. Слово состояния не повторяется:
 * его уже сказал заголовок группы. Шеврон раскрывает карточку под строкой.
 */
export function FleetRowItem({
  row,
  picked,
  onToggle,
  onDetails,
  expanded = false,
  progress,
}: FleetRowItemProps) {
  const { t } = useTranslation();
  const cells = useCells(row, progress);
  const selectable = row.ref !== null && !progress;
  const checking = progress?.state === 'checking';

  return (
    <div
      className={cn(
        'flex items-center transition-colors',
        picked ? 'bg-[#F97315]/10' : expanded ? 'bg-apple-card/30' : 'hover:bg-apple-card/30',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={picked}
        aria-disabled={!selectable}
        disabled={!selectable}
        onClick={() => row.ref && onToggle(row.ref)}
        className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
      >
        <span className="flex w-4 shrink-0 justify-center">
          {checking ? (
            <Spinner className="h-4 w-4 text-[#F97315]" />
          ) : (
            <span className={cn(!selectable && 'opacity-40')}>
              <CheckGlyph on={picked} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-apple-ink">{row.label}</span>
            {row.purpose === 'bs' && <PurposeChip purpose="bs" compact />}
          </span>
          <span className="block truncate font-mono text-xs text-apple-faint">{row.address}</span>
          {(cells.units || cells.when) && (
            <span className="mt-1 flex items-center gap-1.5 text-xs md:hidden">
              {cells.dot && <Dot className={cells.dot} />}
              {cells.units && <span className="text-apple-mute">{cells.units}</span>}
              {cells.units && cells.when && <span className="text-apple-faint">·</span>}
              {cells.when && <span className={cells.whenTone}>{cells.when}</span>}
            </span>
          )}
        </span>
        <span
          className={cn('hidden items-center gap-2 text-xs text-apple-mute md:flex', COL_UNITS)}
        >
          {cells.dot && <Dot className={cells.dot} />}
          {cells.units}
        </span>
        <span className={cn('hidden text-xs md:block', COL_AGE, cells.whenTone)}>{cells.when}</span>
      </button>
      <button
        type="button"
        aria-label={t('admin.reachability.fleet.details')}
        aria-expanded={expanded}
        onClick={() => onDetails(row)}
        className={cn(
          'me-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-apple-card hover:text-apple-ink',
          expanded ? 'text-apple-ink' : 'text-apple-faint',
        )}
      >
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
