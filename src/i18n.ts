import i18n, { type ResourceLanguage } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ruUrl from './locales/ru.json?url&no-inline';
import enUrl from './locales/en.json?url&no-inline';
import zhUrl from './locales/zh.json?url&no-inline';
import faUrl from './locales/fa.json?url&no-inline';
import ruAdminUrl from './locales/admin/ru.json?url&no-inline';
import enAdminUrl from './locales/admin/en.json?url&no-inline';
import zhAdminUrl from './locales/admin/zh.json?url&no-inline';
import faAdminUrl from './locales/admin/fa.json?url&no-inline';

// Import only the hashed asset URLs. Fetch is retryable after an HTTP/network
// failure; the browser module cache would retain a failed dynamic import.
const localeUrls: Record<string, string> = { ru: ruUrl, en: enUrl, zh: zhUrl, fa: faUrl };
const adminUrls: Record<string, string> = {
  ru: ruAdminUrl,
  en: enAdminUrl,
  zh: zhAdminUrl,
  fa: faAdminUrl,
};

export const SUPPORTED_LANGUAGES = Object.keys(localeUrls);
const FALLBACK_LNG = 'ru';
const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();
const failedDownloads = new Set<string>();
let adminRequested = false;
let languageIntent = 0;

function normalizeLanguage(lng: string): string {
  const code = lng.toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(code) ? code : FALLBACK_LNG;
}

function loadLanguage(lng: string, admin = false): Promise<void> {
  const key = `${admin ? 'admin' : 'user'}:${lng}`;
  if (loaded.has(key)) return Promise.resolve();
  const existing = pending.get(key);
  if (existing) return existing;

  const request = fetch(
    (admin ? adminUrls : localeUrls)[lng],
    failedDownloads.has(key) ? { cache: 'reload' } : undefined,
  )
    .then(async (response) => {
      if (!response.ok) throw new Error(`Translation request failed (${response.status})`);
      const resources: unknown = await response.json();
      if (!resources || typeof resources !== 'object' || Array.isArray(resources)) {
        throw new Error('Invalid translation resource');
      }
      // Preserve existing key paths; admin screens need no namespace migration.
      i18n.addResourceBundle(lng, 'translation', resources as ResourceLanguage, true, true);
      loaded.add(key);
      failedDownloads.delete(key);
    })
    .catch((error) => {
      failedDownloads.add(key);
      throw error;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

const initialized = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: FALLBACK_LNG,
    supportedLngs: SUPPORTED_LANGUAGES,
    load: 'languageOnly',
    resources: {},
    initImmediate: false,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'cabinet_language',
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false, bindI18nStore: 'added' },
    showSupportNotice: false,
  });

async function loadLanguages(lng: string, admin = false): Promise<void> {
  await Promise.all([...new Set([FALLBACK_LNG, lng])].map((code) => loadLanguage(code, admin)));
}

/** Called before mounting application consumers. Failed asset requests can be retried. */
export async function prepareI18n(): Promise<void> {
  await initialized;
  const code = normalizeLanguage(i18n.language || FALLBACK_LNG);
  await loadLanguages(code);
  // Refresh resolvedLanguage and notify subscribers after resources are ready.
  await i18n.changeLanguage(code);
}

/** A loaded admin locale can mount immediately when navigating between admin pages. */
export function areAdminTranslationsLoaded(): boolean {
  const code = normalizeLanguage(i18n.language || FALLBACK_LNG);
  return [FALLBACK_LNG, code].every((language) => loaded.has(`admin:${language}`));
}

/** Admin routes await their translations before mounting. */
export async function loadAdminTranslations(): Promise<void> {
  adminRequested = true;
  await initialized;
  await loadLanguages(normalizeLanguage(i18n.language || FALLBACK_LNG), true);
}

/** Keep the old language visible if the requested download fails. */
export async function changeAppLanguage(lng: string): Promise<void> {
  const intent = ++languageIntent;
  const code = normalizeLanguage(lng);
  await loadLanguages(code);
  if (adminRequested) await loadLanguages(code, true);
  if (intent === languageIntent) await i18n.changeLanguage(code);
}

function syncHtmlLang(lng: string): void {
  if (typeof document === 'undefined') return;
  const code = normalizeLanguage(lng);
  document.documentElement.lang = code;
  document.documentElement.dir = code === 'fa' ? 'rtl' : 'ltr';
}
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
