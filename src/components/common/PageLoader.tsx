interface PageLoaderProps {
  variant?: 'dark' | 'light';
}

export default function PageLoader({ variant = 'dark' }: PageLoaderProps) {
  // The old theme's generated accent-500, before route styles are loaded.
  const spinnerColor = variant === 'dark' ? 'border-[#0b64f4]' : 'border-blue-500';

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className={`h-10 w-10 border-[3px] ${spinnerColor} animate-spin rounded-full border-t-transparent`}
      />
    </div>
  );
}
