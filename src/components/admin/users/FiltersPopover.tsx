import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DropdownOption } from '@/components/admin/bulkActions/DropdownSelect';
import { CheckIcon, ChevronDownIcon, FilterIcon } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/primitives';
import { cn } from '@/lib/utils';

export type FilterKey = 'status' | 'sub' | 'tariff' | 'group' | 'campaign';

export interface FilterField {
  key: FilterKey;
  label: string;
  /** '' — «любой»: первый пункт `options`. */
  value: string;
  options: DropdownOption[];
  /** Значение поставила выбранная выборка — не чип и не в счётчике, это её повтор. */
  fromView?: boolean;
}

/** Фильтр выбран руками: не «любой» и не повтор выборки. */
export function isApplied(field: FilterField): boolean {
  return field.value !== '' && !field.fromView;
}

interface FiltersPopoverProps {
  fields: FilterField[];
  onChange: (key: FilterKey, value: string) => void;
  onReset: () => void;
}

export function currentLabel(field: FilterField): string {
  return (
    (field.options.find((option) => option.value === field.value) ?? field.options[0])?.label ?? ''
  );
}

/**
 * Все фильтры списка — за одной кнопкой «Фильтры» со счётчиком. Пять чипов «Статус:
 * любой ▾» в ряд растягивали тулбар и не говорили, что выбрано; здесь каждый фильтр —
 * строка с текущим значением, пункты раскрываются на месте, без меню в меню (на телефоне
 * вложенные меню налезают друг на друга). Выбранные показываются чипами под тулбаром.
 */
export function FiltersPopover({ fields, onChange, onReset }: FiltersPopoverProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<FilterKey | null>(null);
  const applied = fields.filter(isApplied).length;
  const baseId = useId();

  return (
    <Popover onOpenChange={(open) => !open && setExpanded(null)}>
      <PopoverTrigger
        aria-label={
          applied > 0
            ? t('admin.users.filters.buttonApplied', { count: applied })
            : t('admin.users.filters.title')
        }
        className={cn(
          'inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40',
          'data-[state=open]:border-[#F97315]/50',
          applied > 0
            ? 'border-[#F97315]/50 bg-[#F97315]/10 text-[#F97315]'
            : 'border-apple-hairline bg-apple-card text-apple-mute hover:border-apple-hairline hover:text-apple-ink',
        )}
      >
        <FilterIcon className="h-5 w-5" />
        <span className="hidden sm:inline">{t('admin.users.filters.title')}</span>
        {applied > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F97315] px-1.5 text-xs font-semibold tabular-nums text-white light:bg-champagne-700 light:text-white">
            {applied}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={16}
        className="w-[min(22rem,calc(100vw-2rem))] bg-apple-card p-0 backdrop-blur-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-apple-hairline px-4 py-3">
          <span className="text-sm font-semibold text-apple-ink">
            {t('admin.users.filters.title')}
          </span>
          {applied > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="btn-secondary min-h-0 px-2.5 py-1 text-xs"
            >
              {t('admin.users.filters.reset')}
            </button>
          )}
        </div>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1.5">
          {fields.map((field) => {
            const open = expanded === field.key;
            const listId = `${baseId}-${field.key}`;
            return (
              <div key={field.key}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => setExpanded(open ? null : field.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors',
                    'hover:bg-apple-card/70 focus-visible:bg-apple-card/70 focus-visible:outline-none',
                    open && 'bg-apple-card/70',
                  )}
                >
                  <span className="flex-1 text-apple-mute">{field.label}</span>
                  <span
                    className={cn(
                      'max-w-[55%] truncate',
                      field.value ? 'font-medium text-[#F97315]' : 'text-apple-faint',
                    )}
                  >
                    {currentLabel(field)}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      'h-4 w-4 shrink-0 text-apple-faint transition-transform',
                      open && 'rotate-180',
                    )}
                  />
                </button>
                {open && (
                  <div
                    id={listId}
                    role="radiogroup"
                    aria-label={field.label}
                    className="mb-1 ml-2.5 mt-0.5 max-h-72 overflow-y-auto border-l border-apple-hairline pl-1.5"
                  >
                    {field.options.map((option) => {
                      const selected = option.value === field.value;
                      return (
                        <button
                          key={option.value || '__any'}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            onChange(field.key, option.value);
                            setExpanded(null);
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40',
                            selected
                              ? 'bg-[#F97315]/10 font-medium text-[#F97315]'
                              : 'text-apple-ink hover:bg-apple-card/70',
                          )}
                        >
                          <span className="flex-1 truncate">{option.label}</span>
                          {selected && <CheckIcon className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
