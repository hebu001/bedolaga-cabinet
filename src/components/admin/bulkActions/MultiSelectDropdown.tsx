import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CheckIcon } from '@/components/icons';
import { ChevronDownIcon } from './DropdownSelect';

// ──────────────────────────────────────────────────────────────────
// MultiSelectDropdown
//
// Pop-over multi-select used by AdminBulkActions filters (tariffs,
// statuses, nodes, etc.). Closes on outside click; provides
// select-all / deselect-all helpers. Pure controlled component.
// ──────────────────────────────────────────────────────────────────

export interface MultiSelectOption {
  value: number;
  label: string;
}

export interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  className?: string;
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
  className,
}: MultiSelectDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const buttonLabel = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length <= 2) {
      return selected
        .map((id) => options.find((o) => o.value === id)?.label)
        .filter(Boolean)
        .join(', ');
    }
    return t('admin.bulkActions.filters.tariffsSelected', { count: selected.length });
  }, [selected, options, placeholder, t]);

  const handleToggle = (value: number) => {
    if (selected.includes(value)) {
      onChange(selected.filter((id) => id !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border bg-apple-card px-3 py-2.5 text-left text-sm outline-none transition-colors',
          open
            ? 'border-[#F97315]/40 shadow-[0_0_0_3px_rgba(var(--color-accent-500),0.08)]'
            : 'border-apple-hairline',
          selected.length > 0 ? 'text-apple-ink' : 'text-apple-faint',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{buttonLabel}</span>
        <div
          className={cn(
            'ml-2 shrink-0 text-apple-faint transition-transform',
            open && 'rotate-180',
          )}
        >
          <ChevronDownIcon />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-apple-hairline bg-apple-card py-1 shadow-2xl">
          <div className="flex items-center gap-1 border-b border-apple-hairline/50 px-3 py-1.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-[#F97315] transition-colors hover:text-accent-300"
            >
              {t('admin.bulkActions.filters.selectAll')}
            </button>
            <span className="text-apple-faint">/</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-xs font-medium text-apple-mute transition-colors hover:text-apple-mute"
            >
              {t('admin.bulkActions.filters.deselectAll')}
            </button>
          </div>

          {options.map((option) => {
            const isChecked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleToggle(option.value)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-apple-elevated/50"
                role="option"
                aria-selected={isChecked}
              >
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150',
                    isChecked
                      ? 'border-[#F97315] bg-[#F97315]'
                      : 'border-dark-500 bg-apple-elevated/60',
                  )}
                >
                  {isChecked && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className={cn('text-sm', isChecked ? 'text-apple-ink' : 'text-apple-mute')}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
