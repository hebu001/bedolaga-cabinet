import { useTranslation } from 'react-i18next';
import { SettingDefinition } from '../../api/adminSettings';
import { cn } from '../../lib/utils';
import { formatSettingKey } from './utils';

interface QuickTogglesProps {
  settings: SettingDefinition[];
  onUpdate: (key: string, value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function QuickToggles({ settings, onUpdate, disabled, className }: QuickTogglesProps) {
  const { t } = useTranslation();

  const booleanSettings = settings.filter((s) => s.type === 'bool' && !s.read_only);

  if (booleanSettings.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-2xl bg-apple-card px-3 py-2.5', className)}>
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-apple-faint">
        {t('admin.settings.quickToggles')}
      </span>
      <div className="flex flex-wrap gap-2">
        {booleanSettings.map((setting) => {
          const isOn = setting.current === true || setting.current === 'true';
          const formattedKey = formatSettingKey(setting.name || setting.key);
          const label = t(`admin.settings.settingNames.${formattedKey}`, formattedKey);

          return (
            <button
              key={setting.key}
              type="button"
              onClick={() => onUpdate(setting.key, isOn ? 'false' : 'true')}
              disabled={disabled}
              className={cn(
                'flex min-h-[44px] items-center gap-2 rounded-lg px-2.5 py-2.5 text-xs font-medium transition-all',
                isOn ? 'bg-apple-green/[0.12] text-apple-ink' : 'bg-apple-elevated text-apple-mute',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80',
              )}
            >
              {/* Mini toggle indicator */}
              <div
                className={cn(
                  'relative h-3.5 w-6 flex-shrink-0 rounded-full transition-colors',
                  isOn ? 'bg-apple-green' : 'bg-apple-faint',
                )}
              >
                <div
                  className={cn(
                    'absolute left-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform duration-200',
                    isOn ? 'translate-x-2.5' : 'translate-x-0',
                  )}
                />
              </div>
              <span className="max-w-[120px] truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
