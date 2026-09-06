import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { infoApi, type LanguageInfo } from '@/api/info';
import { changeAppLanguage, SUPPORTED_LANGUAGES } from '@/i18n';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const data = await infoApi.getLanguages();
        setAvailableLanguages(
          data.languages.filter((lang) => SUPPORTED_LANGUAGES.includes(lang.code)),
        );
      } catch {
        // Silently fall back to empty list — component handles it gracefully
      }
    };
    fetchLanguages();
  }, []);

  const currentLang = availableLanguages.find((l) => l.code === i18n.language) ||
    availableLanguages[0] || { code: 'ru', name: 'RU', flag: '🇷🇺' };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = async (code: string) => {
    setIsChanging(true);
    setHasError(false);
    try {
      await changeAppLanguage(code);
      setIsOpen(false);
    } catch {
      setHasError(true);
    } finally {
      setIsChanging(false);
    }
  };

  if (availableLanguages.length <= 1) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-sm transition-all ${
          isOpen
            ? 'border-dark-600 bg-dark-700'
            : 'border-dark-700/50 bg-dark-800/50 hover:border-dark-600 hover:bg-dark-700'
        }`}
        aria-label={t('common.changeLanguage')}
        aria-expanded={isOpen}
        aria-controls="language-options"
      >
        <span>{currentLang.flag}</span>
        <span className="font-medium text-dark-200">{currentLang.code.toUpperCase()}</span>
        <svg
          className={`h-3.5 w-3.5 text-dark-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          id="language-options"
          aria-busy={isChanging}
          className="absolute right-0 z-50 mt-2 w-40 animate-fade-in rounded-xl border border-dark-700/50 bg-dark-800 py-1 shadow-lg"
        >
          {availableLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              disabled={isChanging}
              aria-pressed={lang.code === i18n.language}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                lang.code === i18n.language
                  ? 'bg-accent-500/10 text-accent-400'
                  : 'text-dark-300 hover:bg-dark-700/50'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
          {hasError && (
            <p role="alert" className="px-4 py-2 text-xs text-error-400">
              {t('common.languageLoadError')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
