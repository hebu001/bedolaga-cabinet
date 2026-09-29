import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { type SkeletonVariant, skeletonClass } from './skeletonStyles';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  circle?: boolean;
  animate?: boolean;
  /** Сколько одинаковых плейсхолдеров отрисовать подряд. */
  count?: number;
  className?: string;
  /** Optional fill for inline value placeholders. Full card loaders ignore it. */
  style?: CSSProperties;
}

/**
 * Плейсхолдер загрузки. Без классов размера повторяет высоту текста родителя.
 *
 * Рендерится как <span class="block">, а не <div>, чтобы его можно было
 * ставить внутрь <p> и прочих inline-контекстов без невалидной вложенности.
 */
export function Skeleton({
  variant = 'line',
  circle = false,
  animate = false,
  count = 1,
  className,
  style,
}: SkeletonProps) {
  if (variant === 'card') return <SkeletonGroup />;

  const cls = skeletonClass({ variant, circle, animate, className });

  if (count === 1) {
    return <span className={cls} style={style} />;
  }

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cls} style={style} />
      ))}
    </>
  );
}

/** Group loading screens use one compact indicator instead of mounting
 * empty card trees. Inline Skeletons remain for values in populated panels.
 * Children stay in the public API for existing callers but are not mounted. */
export function SkeletonGroup({
  className,
  'aria-label': label,
}: {
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
}) {
  const { t } = useTranslation();
  const loading = t('common.loading');

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label ?? loading}
      className={cn(className, 'min-w-0 max-w-full')}
      data-loading-state="compact"
    >
      <span className="col-span-full flex min-w-0 items-center gap-2 py-3 text-sm leading-5 text-apple-mute">
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none"
        />
        <span className="min-w-0 [overflow-wrap:anywhere]">{loading}</span>
      </span>
    </div>
  );
}
