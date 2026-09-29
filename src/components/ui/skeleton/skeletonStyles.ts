import { cn } from '@/lib/utils';

export type SkeletonVariant = 'line' | 'card';

/** Static inline placeholders use the existing neutral fill. Dimensions are
 * capped to their container and one compact row. Whole cards and groups are
 * rendered separately as a single loading indicator by Skeleton.tsx. */
const VARIANT_FILL: Record<SkeletonVariant, string> = {
  line: 'bg-dark-500/40',
  card: 'border border-dark-500/40 bg-dark-500/25',
};

/** Радиусы по канону CLAUDE.md:134-137: строки — lg, внутренние панели — 2xl. */
const VARIANT_RADIUS: Record<SkeletonVariant, string> = {
  line: 'rounded-lg',
  card: 'rounded-2xl',
};

export interface SkeletonClassOptions {
  variant?: SkeletonVariant;
  /** Круглый плейсхолдер — аватар, точка, иконка. */
  circle?: boolean;
  /** Отключить пульсацию (например, для статичного макета). */
  animate?: boolean;
  /** Классы вызывающей стороны. Перекрывают дефолты через twMerge. */
  className?: string;
}

export function skeletonClass({
  variant = 'line',
  circle = false,
  animate = false,
  className,
}: SkeletonClassOptions = {}): string {
  return cn(
    // shrink-0 намеренно НЕ в дефолтах: в узких flex-рядах (подвал подписки
    // на маленьком экране Mini App) он запретил бы сжатие и вызвал переполнение.
    // Где нужно — добавляется через className, как было в исходном коде.
    'block max-h-8 max-w-full',
    // Авторазмер в духе react-loading-skeleton: без явных классов размера
    // строка повторяет высоту текста родителя и тянется на всю ширину.
    // Любой h-*/w-* в className это перекрывает — cn построен на twMerge.
    'h-[1em] w-full',
    VARIANT_FILL[variant],
    circle ? 'rounded-full' : VARIANT_RADIUS[variant],
    animate && 'animate-pulse motion-reduce:animate-none',
    className,
  );
}
