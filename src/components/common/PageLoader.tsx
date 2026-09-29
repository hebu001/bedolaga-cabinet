import { SkeletonGroup } from '@/components/ui/skeleton';

interface PageLoaderProps {
  variant?: 'dark' | 'light';
}

export default function PageLoader(_props: PageLoaderProps) {
  return (
    <div className="flex min-h-40 min-w-0 items-center justify-center">
      <SkeletonGroup />
    </div>
  );
}
