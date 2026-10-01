import { type ComponentType, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface IconTab<T extends string> {
  value: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface IconTabsProps<T extends string> {
  value: T;
  tabs: ReadonlyArray<IconTab<T>>;
  onChange: (value: T) => void;
  /** Подпись полосы вкладок для скринридера. */
  label: string;
  /** На телефоне листать вбок, а не сжимать: нужно, когда вкладок больше шести. */
  scrollOnMobile?: boolean;
}

/**
 * Полоса вкладок раздела со значками: на телефоне значок над подписью (подпись переносится, но
 * вкладки не налезают друг на друга), на десктопе значок рядом с подписью. Выбранная — акцентом.
 */
export function IconTabs<T extends string>({
  value,
  tabs,
  onChange,
  label,
  scrollOnMobile = false,
}: IconTabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (scrollOnMobile && list && list.scrollWidth > list.clientWidth) {
      const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      const strip = list.getBoundingClientRect();
      const selected = active.getBoundingClientRect();
      // Move only this horizontal strip; page scroll restoration owns the document.
      if (selected.left < strip.left) list.scrollLeft += selected.left - strip.left;
      else if (selected.right > strip.right) list.scrollLeft += selected.right - strip.right;
    }
  }, [value, scrollOnMobile]);
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      // С прокруткой: восемь подписей в 390 px налезали друг на друга — полоса листается вбок.
      className={cn(
        'rounded-2xl bg-apple-card p-1.5 sm:grid sm:gap-1.5',
        scrollOnMobile
          ? 'scrollbar-hide flex gap-0.5 overflow-x-auto sm:overflow-visible'
          : 'grid gap-0.5',
      )}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97315] sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2 sm:text-sm',
              scrollOnMobile ? 'min-w-[68px] flex-1 shrink-0 px-1 sm:min-w-0' : 'px-0.5',
              active
                ? 'bg-apple-elevated text-apple-ink shadow-sm'
                : 'text-apple-mute hover:bg-apple-elevated/50 hover:text-apple-ink',
            )}
          >
            <Icon
              className={cn('h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4', active && 'text-[#F97315]')}
            />
            <span
              className={cn(
                'text-center sm:whitespace-nowrap',
                scrollOnMobile && 'whitespace-nowrap',
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
