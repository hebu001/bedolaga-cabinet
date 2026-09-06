import { useEffect, useState, type ReactNode } from 'react';
import i18n, { areAdminTranslationsLoaded, loadAdminTranslations, prepareI18n } from '../i18n';

// Available even if the translation asset could not be downloaded.
const messages: Record<string, { loading: string; error: string; retry: string }> = {
  ru: { loading: 'Загрузка…', error: 'Не удалось загрузить переводы.', retry: 'Повторить' },
  en: { loading: 'Loading…', error: 'Could not load translations.', retry: 'Try again' },
  zh: { loading: '加载中…', error: '无法加载翻译。', retry: '重试' },
  fa: { loading: 'در حال بارگذاری…', error: 'بارگیری ترجمه‌ها ناموفق بود.', retry: 'تلاش دوباره' },
};

function TranslationGate({
  children,
  load,
  initiallyReady = false,
  fullScreen = true,
}: {
  children: ReactNode;
  load: () => Promise<void>;
  initiallyReady?: boolean;
  fullScreen?: boolean;
}) {
  const [ready, setReady] = useState(initiallyReady);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ready) return;
    let active = true;
    load().then(
      () => {
        if (active) setReady(true);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, load, ready]);

  if (ready) return children;
  const language = i18n.language?.split('-')[0] || 'ru';
  const copy = messages[language] || messages.ru;
  return (
    <div
      className={`flex items-center justify-center p-6 text-center text-white ${fullScreen ? 'min-h-dvh' : 'min-h-48'}`}
      lang={language}
      dir={language === 'fa' ? 'rtl' : 'ltr'}
    >
      {failed ? (
        <div role="alert">
          <p>{copy.error}</p>
          <button
            className="mt-4 rounded-lg border border-white/40 px-4 py-2"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            {copy.retry}
          </button>
        </div>
      ) : (
        <p role="status">{copy.loading}</p>
      )}
    </div>
  );
}

export function I18nBootstrap({ children }: { children: ReactNode }) {
  return <TranslationGate load={prepareI18n}>{children}</TranslationGate>;
}

export function AdminTranslationsGate({ children }: { children: ReactNode }) {
  return (
    <TranslationGate
      load={loadAdminTranslations}
      initiallyReady={areAdminTranslationsLoaded()}
      fullScreen={false}
    >
      {children}
    </TranslationGate>
  );
}
