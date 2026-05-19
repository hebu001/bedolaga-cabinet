import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingDefinition } from '../../api/adminSettings';
import { SearchIcon, CloseIcon } from './icons';
import { formatSettingKey } from './utils';

interface SettingsSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  resultsCount?: number;
  allSettings?: SettingDefinition[];
  onSelectSetting?: (setting: SettingDefinition) => void;
}

export function SettingsSearch({
  searchQuery,
  setSearchQuery,
  allSettings,
  onSelectSetting,
}: SettingsSearchProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter settings for autocomplete
  const suggestions =
    searchQuery.trim() && allSettings
      ? allSettings
          .filter((s) => {
            const q = searchQuery.toLowerCase().trim();
            if (s.key.toLowerCase().includes(q)) return true;
            if (s.name?.toLowerCase().includes(q)) return true;
            const formattedKey = formatSettingKey(s.name || s.key);
            const translatedName = t(`admin.settings.settingNames.${formattedKey}`, formattedKey);
            if (translatedName.toLowerCase().includes(q)) return true;
            if (s.hint?.description?.toLowerCase().includes(q)) return true;
            const categoryLabel = t(`admin.settings.categories.${s.category.key}`, s.category.key);
            if (categoryLabel.toLowerCase().includes(q)) return true;
            return false;
          })
          .slice(0, 8)
      : [];

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions.length, searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (setting: SettingDefinition) => {
    setIsOpen(false);
    setSearchQuery(setting.name || setting.key);
    onSelectSetting?.(setting);
  };

  const getSettingDisplayName = (setting: SettingDefinition) => {
    const formattedKey = formatSettingKey(setting.name || setting.key);
    return t(`admin.settings.settingNames.${formattedKey}`, formattedKey);
  };

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={t('admin.settings.searchPlaceholder')}
        className="w-48 rounded-xl bg-apple-elevated py-2 pl-10 pr-10 text-sm text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50 lg:w-64"
      />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-faint">
        <SearchIcon />
      </div>
      {searchQuery && (
        <button
          onClick={() => {
            setSearchQuery('');
            setIsOpen(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-faint transition-colors hover:text-apple-mute"
        >
          <CloseIcon />
        </button>
      )}

      {/* Autocomplete dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-80 w-80 overflow-y-auto rounded-2xl bg-apple-card py-1 shadow-xl">
          {suggestions.map((setting, index) => (
            <button
              key={setting.key}
              onClick={() => handleSelect(setting)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                index === highlightedIndex ? 'bg-[#F97315]/15' : 'hover:bg-apple-elevated'
              }`}
            >
              <span className="truncate text-sm font-medium text-apple-ink">
                {getSettingDisplayName(setting)}
              </span>
              <span className="truncate text-xs text-apple-faint">
                {t(`admin.settings.categories.${setting.category.key}`, setting.category.key)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsSearchMobile({
  searchQuery,
  setSearchQuery,
  allSettings,
  onSelectSetting,
}: Omit<SettingsSearchProps, 'resultsCount'>) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter settings for autocomplete
  const suggestions =
    searchQuery.trim() && allSettings
      ? allSettings
          .filter((s) => {
            const q = searchQuery.toLowerCase().trim();
            if (s.key.toLowerCase().includes(q)) return true;
            if (s.name?.toLowerCase().includes(q)) return true;
            const formattedKey = formatSettingKey(s.name || s.key);
            const translatedName = t(`admin.settings.settingNames.${formattedKey}`, formattedKey);
            if (translatedName.toLowerCase().includes(q)) return true;
            if (s.hint?.description?.toLowerCase().includes(q)) return true;
            const categoryLabel = t(`admin.settings.categories.${s.category.key}`, s.category.key);
            if (categoryLabel.toLowerCase().includes(q)) return true;
            return false;
          })
          .slice(0, 8)
      : [];

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions.length, searchQuery]);

  const handleSelect = (setting: SettingDefinition) => {
    setIsOpen(false);
    setSearchQuery(setting.name || setting.key);
    onSelectSetting?.(setting);
  };

  const getSettingDisplayName = (setting: SettingDefinition) => {
    const formattedKey = formatSettingKey(setting.name || setting.key);
    return t(`admin.settings.settingNames.${formattedKey}`, formattedKey);
  };

  return (
    <div ref={containerRef} className="relative mt-3 lg:hidden">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={t('admin.settings.searchPlaceholder')}
        className="w-full rounded-xl bg-apple-elevated py-2 pl-10 pr-10 text-sm text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
      />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-faint">
        <SearchIcon />
      </div>
      {searchQuery && (
        <button
          onClick={() => {
            setSearchQuery('');
            setIsOpen(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-faint transition-colors hover:text-apple-mute"
        >
          <CloseIcon />
        </button>
      )}

      {/* Autocomplete dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-2xl bg-apple-card py-1 shadow-xl">
          {suggestions.map((setting, index) => (
            <button
              key={setting.key}
              onClick={() => handleSelect(setting)}
              className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                index === highlightedIndex ? 'bg-[#F97315]/15' : 'hover:bg-apple-elevated'
              }`}
            >
              <span className="truncate text-sm font-medium text-apple-ink">
                {getSettingDisplayName(setting)}
              </span>
              <span className="truncate text-xs text-apple-faint">
                {t(`admin.settings.categories.${setting.category.key}`, setting.category.key)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsSearchResults({
  searchQuery,
  resultsCount,
}: {
  searchQuery: string;
  resultsCount: number;
}) {
  const { t } = useTranslation();

  if (!searchQuery.trim()) return null;

  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <span className="text-apple-mute">
        {resultsCount > 0
          ? t('admin.settings.foundCount', { count: resultsCount })
          : t('admin.settings.notFound')}
      </span>
      {resultsCount > 0 && (
        <span className="text-apple-faint">
          {t('admin.settings.byQuery', { query: searchQuery })}
        </span>
      )}
    </div>
  );
}
