import { cn } from '@/lib/utils';

/** Общий вид строки-переключателя для целей: хосты панели, конфиги подписки. */
export const ROW = 'flex items-center gap-3 rounded-xl border px-3 py-1 transition-colors';
export const ROW_ON = 'border-[#F97315]/40 bg-[#F97315]/10';
export const ROW_OFF = 'border-apple-hairline/60 bg-apple-card/30 hover:border-apple-hairline';
export const ROW_BUTTON = 'flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left';

/** Квадратик чекбокса: галочка, «–» у частично отмеченной группы, пустой. Смысл несёт родитель. */
export function CheckGlyph({ on, mixed = false }: { on: boolean; mixed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs font-bold',
        on || mixed
          ? 'border-[#F97315] bg-[#F97315] text-white'
          : 'border-apple-ink/25 text-transparent',
      )}
    >
      {mixed ? '–' : '✓'}
    </span>
  );
}
