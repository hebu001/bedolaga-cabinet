// SVGs copied from the matching page in codex/cabinet-ux-performance-20260906.
import { cn } from '@/lib/utils';
interface IconProps {
  className?: string;
}

export const BackIcon = ({ className }: IconProps) => (
  <svg
    className={cn('h-5 w-5 text-apple-mute', className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

export const GripIcon = ({ className }: IconProps) => (
  <svg
    className={cn('h-5 w-5', className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
    />
  </svg>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <svg
    className={cn('h-5 w-5', className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

export const SaveIcon = ({ className }: IconProps) => (
  <svg
    className={cn('h-4 w-4', className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);
