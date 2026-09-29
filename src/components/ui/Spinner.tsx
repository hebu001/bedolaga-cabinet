import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-label={t('common.loading')}
      className={cn(
        'h-8 w-8 animate-spin border-[#F97315] border-t-transparent rounded-full border-2  ',
        className,
      )}
    />
  );
}
