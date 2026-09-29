import { PageLoadingIndicator } from './PageLoadingIndicator';

interface PageLoaderProps {
  variant?: 'dark' | 'light';
}

export default function PageLoader(_props: PageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <PageLoadingIndicator />
    </div>
  );
}
