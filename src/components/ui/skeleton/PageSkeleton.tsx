import type { ReactNode } from 'react';
import { SkeletonGroup } from './Skeleton';

export type PageSkeletonVariant = 'user' | 'admin';

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  leading?: number | string[];
  titleWidth?: string;
  className?: string;
  children?: ReactNode;
}

/** Existing page callers keep their API; full-page mock cards are no longer
 * mounted. A single compact loading state fits both a page and a dialog. */
export function PageSkeleton({ className }: PageSkeletonProps) {
  return <SkeletonGroup className={className} />;
}
