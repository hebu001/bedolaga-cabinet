import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SETTINGS_TREE } from './constants';
import { StarIcon, SearchIcon, CloseIcon, ChevronDownIcon } from './icons';
import { SettingDefinition } from '../../api/adminSettings';
import { formatSettingKey } from './utils';
import { cn } from '../../lib/utils';

interface SettingsTreeSidebarProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  favoritesCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  allSettings?: SettingDefinition[];
  onSelectSetting?: (setting: SettingDefinition) => void;
  className?: string;
}

export function SettingsTreeSidebar({
  activeSection,
  onSectionChange,
  favoritesCount,
  searchQuery,
  onSearchChange,
  allSettings,
  onSelectSetting,
  className,
}: SettingsTreeSidebarProps) {
  const { t } = useTranslation();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-expand the group containing the active section
  useEffect(() => {
    for (const group of SETTINGS_TREE.groups) {
      if (group.children.some((child) => child.id === activeSection)) {
        setExpandedGroup(group.id);
        return;
      }
    }
  }, [activeSection]);

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

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
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
    if (!isSearchOpen || suggestions.length === 0) return;

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
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsSearchOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectSuggestion = (setting: SettingDefinition) => {
    setIsSearchOpen(false);
    onSearchChange(setting.name || setting.key);
    onSelectSetting?.(setting);
  };

  const getSettingDisplayName = (setting: SettingDefinition) => {
    const formattedKey = formatSettingKey(setting.name || setting.key);
    return t(`admin.settings.settingNames.${formattedKey}`, formattedKey);
  };

  const handleGroupToggle = (groupId: string) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupId);
      // Auto-select first child when expanding
      const group = SETTINGS_TREE.groups.find((g) => g.id === groupId);
      if (group && group.children.length > 0) {
        onSectionChange(group.children[0].id);
      }
    }
  };

  const isGroupActive = (groupId: string) => {
    const group = SETTINGS_TREE.groups.find((g) => g.id === groupId);
    return group?.children.some((child) => child.id === activeSection) ?? false;
  };

  // Special items excluding favorites (favorites is rendered separately)
  const customizationItems = SETTINGS_TREE.specialItems.filter((item) => item.id !== 'favorites');

  return (
    <nav className={cn('flex flex-col', className)}>
      {/* Search bar */}
      <div ref={searchContainerRef} className="relative px-3 pb-2 pt-3">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsSearchOpen(true);
          }}
          onFocus={() => setIsSearchOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('admin.settings.searchPlaceholder')}
          className="w-full rounded-xl bg-apple-elevated py-2 pl-9 pr-8 text-sm text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
        />
        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-apple-faint">
          <SearchIcon className="h-4 w-4" />
        </div>
        {searchQuery && (
          <button
            onClick={() => {
              onSearchChange('');
              setIsSearchOpen(false);
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-apple-faint transition-colors hover:text-apple-mute"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}

        {/* Autocomplete dropdown */}
        {isSearchOpen && suggestions.length > 0 && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl bg-apple-card py-1 shadow-xl">
            {suggestions.map((setting, index) => (
              <button
                key={setting.key}
                onClick={() => handleSelectSuggestion(setting)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors',
                  index === highlightedIndex ? 'bg-[#F97315]/15' : 'hover:bg-apple-elevated',
                )}
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

      {/* Favorites button */}
      <div className="px-3 pb-1">
        <button
          onClick={() => onSectionChange('favorites')}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all',
            activeSection === 'favorites'
              ? 'bg-[#F97315]/15 text-[#F97315]'
              : 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink',
          )}
        >
          <StarIcon className="h-4 w-4" filled={activeSection === 'favorites'} />
          <span className="text-sm font-medium">{t('admin.settings.favorites', 'Favorites')}</span>
          {favoritesCount > 0 && (
            <span
              className={cn(
                'ml-auto rounded-full px-2 py-0.5 text-xs',
                activeSection === 'favorites'
                  ? 'bg-[#F97315]/15 text-[#F97315]'
                  : 'bg-apple-amber/15 text-apple-amber',
              )}
            >
              {favoritesCount}
            </span>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-apple-hairline" />

      {/* Customization section label */}
      <div className="px-6 pb-1 pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-apple-faint">
          {t('admin.settings.customization', 'Customization')}
        </span>
      </div>

      {/* Special items (branding, theme, analytics, buttons) */}
      <div className="space-y-0.5 px-3 pb-1">
        {customizationItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all',
                isActive
                  ? 'bg-[#F97315]/15 text-[#F97315]'
                  : 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink',
              )}
            >
              {item.icon && <span className="text-sm">{item.icon}</span>}
              <span className="text-sm font-medium">{t(`admin.settings.${item.id}`, item.id)}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-apple-hairline" />

      {/* Settings section label */}
      <div className="px-6 pb-1 pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-apple-faint">
          {t('admin.settings.settingsLabel', 'Settings')}
        </span>
      </div>

      {/* Tree groups */}
      <div className="space-y-0.5 px-3 pb-3">
        {SETTINGS_TREE.groups.map((group) => {
          const isExpanded = expandedGroup === group.id;
          const hasActiveChild = isGroupActive(group.id);

          return (
            <div key={group.id}>
              {/* Group header */}
              <button
                onClick={() => handleGroupToggle(group.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all',
                  hasActiveChild
                    ? 'text-[#F97315]'
                    : 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink',
                )}
              >
                <span className="text-sm">{group.icon}</span>
                <span className="flex-1 text-left text-sm font-medium">
                  {t(`admin.settings.groups.${group.id}`, group.id)}
                </span>
                <ChevronDownIcon
                  className={cn(
                    'h-4 w-4 transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )}
                />
              </button>

              {/* Children */}
              {isExpanded && (
                <div className="relative ml-5 mt-0.5 space-y-0.5 border-l border-apple-hairline pl-3">
                  {group.children.map((child) => {
                    const isActive = activeSection === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onSectionChange(child.id)}
                        className={cn(
                          'flex w-full items-center rounded-xl px-3 py-1.5 text-left text-sm transition-all',
                          isActive
                            ? 'bg-[#F97315]/15 text-[#F97315]'
                            : 'text-apple-mute hover:bg-apple-elevated hover:text-apple-ink',
                        )}
                      >
                        {t(`admin.settings.tree.${child.id}`, child.id)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
