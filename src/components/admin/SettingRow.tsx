import { useTranslation } from 'react-i18next';
import { SettingDefinition } from '../../api/adminSettings';
import { StarIcon, LockIcon, RefreshIcon } from './icons';
import { SettingInput } from './SettingInput';
import { Toggle } from './Toggle';
import { formatSettingKey, stripHtml } from './utils';

interface SettingRowProps {
  setting: SettingDefinition;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onUpdate: (value: string) => void;
  onReset: () => void;
  isUpdating?: boolean;
  isResetting?: boolean;
}

export function SettingRow({
  setting,
  isFavorite,
  onToggleFavorite,
  onUpdate,
  onReset,
  isUpdating,
  isResetting,
}: SettingRowProps) {
  const { t } = useTranslation();

  const formattedKey = formatSettingKey(setting.name || setting.key);
  const displayName = t(`admin.settings.settingNames.${formattedKey}`, formattedKey);
  const description = setting.hint?.description ? stripHtml(setting.hint.description) : null;

  // Check if this is a long/complex value
  const isLongValue = (() => {
    const val = String(setting.current ?? '');
    const key = setting.key.toLowerCase();
    return (
      val.length > 50 ||
      val.includes('\n') ||
      val.startsWith('[') ||
      val.startsWith('{') ||
      key.includes('_items') ||
      key.includes('_config') ||
      key.includes('_keywords') ||
      key.includes('_template') ||
      key.includes('_packages')
    );
  })();

  return (
    <div className="apple-card-grad group rounded-2xl bg-apple-card p-4 transition-all hover:opacity-95 sm:p-5">
      {/* Header row - name, badges, favorite */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-apple-ink">{displayName}</h3>
            {setting.has_override && (
              <span className="rounded-full bg-apple-amber/15 px-2.5 py-1 text-[11px] font-semibold text-apple-amber">
                {t('admin.settings.modified')}
              </span>
            )}
            {setting.read_only && (
              <span className="flex items-center gap-1 rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                <LockIcon />
                {t('admin.settings.readOnly')}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-apple-mute">{description}</p>
          )}
        </div>

        {/* Favorite button */}
        <button
          onClick={onToggleFavorite}
          className={`flex-shrink-0 rounded-xl p-2 transition-all ${
            isFavorite
              ? 'bg-apple-amber/15 text-apple-amber hover:bg-apple-amber/25'
              : 'text-apple-faint opacity-0 hover:bg-apple-elevated hover:text-apple-amber group-hover:opacity-100'
          }`}
          title={
            isFavorite
              ? t('admin.settings.removeFromFavorites')
              : t('admin.settings.addToFavorites')
          }
        >
          <StarIcon filled={isFavorite} />
        </button>
      </div>

      {/* Setting key (muted) */}
      <div className="mb-3">
        <code className="rounded bg-apple-elevated px-2 py-1 font-mono text-xs text-apple-faint">
          {setting.key}
        </code>
      </div>

      {/* Control section */}
      <div
        className={`${isLongValue ? '' : 'flex items-center justify-between gap-3'} border-t border-apple-hairline pt-3`}
      >
        {setting.read_only ? (
          // Read-only display
          <div className="flex items-center gap-2 rounded-xl bg-apple-elevated px-4 py-2.5 text-apple-mute">
            <span className="break-all font-mono text-sm">{String(setting.current ?? '-')}</span>
          </div>
        ) : setting.type === 'bool' ? (
          // Boolean toggle
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-apple-mute">
              {setting.current === true || setting.current === 'true'
                ? t('admin.settings.enabled')
                : t('admin.settings.disabled')}
            </span>
            <div className="flex items-center gap-2">
              <Toggle
                checked={setting.current === true || setting.current === 'true'}
                onChange={() =>
                  onUpdate(
                    setting.current === true || setting.current === 'true' ? 'false' : 'true',
                  )
                }
                disabled={isUpdating}
              />
              {/* Reset button for boolean */}
              {setting.has_override && (
                <button
                  onClick={onReset}
                  disabled={isResetting}
                  className="rounded-lg p-2 text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink disabled:opacity-50"
                  title={t('admin.settings.reset')}
                >
                  <RefreshIcon />
                </button>
              )}
            </div>
          </div>
        ) : (
          // Input field
          <div
            className={`${isLongValue ? 'w-full' : 'flex flex-1 items-center justify-end gap-2'}`}
          >
            <SettingInput setting={setting} onUpdate={onUpdate} disabled={isUpdating} />
            {/* Reset button for non-long values */}
            {!isLongValue && setting.has_override && (
              <button
                onClick={onReset}
                disabled={isResetting}
                className="flex-shrink-0 rounded-lg p-2 text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink disabled:opacity-50"
                title={t('admin.settings.reset')}
              >
                <RefreshIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reset button for long values - shown below */}
      {isLongValue && setting.has_override && !setting.read_only && setting.type !== 'bool' && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onReset}
            disabled={isResetting}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-apple-mute transition-colors hover:bg-apple-elevated hover:text-apple-ink disabled:opacity-50"
            title={t('admin.settings.reset')}
          >
            <RefreshIcon />
            <span>{t('admin.settings.reset')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
