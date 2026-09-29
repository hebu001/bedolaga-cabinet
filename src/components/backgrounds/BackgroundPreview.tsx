import { Suspense } from 'react';
import { backgroundComponents } from '@/components/ui/backgrounds/registry';
import type { BackgroundType } from '@/components/ui/backgrounds/types';
import { cn } from '@/lib/utils';

interface BackgroundPreviewProps {
  type: BackgroundType;
  settings: Record<string, unknown>;
  opacity?: number;
  blur?: number;
  className?: string;
}

export function BackgroundPreview({
  type,
  settings,
  opacity,
  blur,
  className,
}: BackgroundPreviewProps) {
  if (type === 'none') {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-900',
          className,
        )}
      >
        <div className="flex h-full items-center justify-center text-dark-400">—</div>
      </div>
    );
  }

  const Component = backgroundComponents[type];
  if (!Component) return null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-900',
        className,
      )}
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin border-[#F97315] border-t-transparent rounded-full border-2  " />
          </div>
        }
      >
        <div
          style={{
            opacity: opacity != null ? opacity : undefined,
            filter: blur && blur > 0 ? `blur(${blur}px)` : undefined,
          }}
          className="absolute inset-0"
        >
          <Component settings={settings} />
        </div>
      </Suspense>
    </div>
  );
}
