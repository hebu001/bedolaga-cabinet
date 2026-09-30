import { cn } from '@/lib/utils';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Число рядом с подписью, приглушённое: «Проблемы 8». */
  count?: number;
}

interface ChoiceChipsProps<T extends string> {
  value: T;
  options: ReadonlyArray<ChoiceOption<T>>;
  onChange: (value: T) => void;
  /** Подпись группы для скринридера (и, если `showLabel`, для глаз). */
  label: string;
  showLabel?: boolean;
  className?: string;
}

/** Ряд чипов «один из» в принятом стиле вкладок кабинета (страница пользователя, LocaleTabs). */
export function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
  label,
  showLabel = false,
  className,
}: ChoiceChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {showLabel && <span className="mr-1 text-xs text-apple-mute">{label}</span>}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'shrink-0 whitespace-nowrap min-h-[36px] rounded-full px-3 py-2 text-xs font-medium transition-all',
              active
                ? 'bg-[#F97315]/10 text-[#F97315]'
                : 'bg-apple-elevated/50 text-apple-mute hover:bg-apple-elevated hover:text-apple-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <>
                {' '}
                <span className="tabular-nums opacity-70">{option.count}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
