import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingDefinition } from '../../api/adminSettings';
import { CheckIcon, CloseIcon, EditIcon } from './icons';

interface SettingInputProps {
  setting: SettingDefinition;
  onUpdate: (value: string) => void;
  disabled?: boolean;
}

// Check if value is likely JSON or multi-line
function isLongValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const str = String(value);
  return str.length > 50 || str.includes('\n') || str.startsWith('[') || str.startsWith('{');
}

// Check if key suggests it's a list or JSON config
function isListOrJsonKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey.includes('_items') ||
    lowerKey.includes('_config') ||
    lowerKey.includes('_keywords') ||
    lowerKey.includes('_list') ||
    lowerKey.includes('_json') ||
    lowerKey.includes('_template') ||
    lowerKey.includes('_periods') ||
    lowerKey.includes('_discounts') ||
    lowerKey.includes('_packages')
  );
}

export function SettingInput({ setting, onUpdate, disabled }: SettingInputProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentValue = String(setting.current ?? '');
  const needsTextarea = isLongValue(currentValue) || isListOrJsonKey(setting.key);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 300) + 'px';
    }
  }, [value, isEditing]);

  const handleStart = () => {
    setValue(currentValue);
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate(value);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setValue('');
  };

  // Dropdown for choices
  if (setting.choices && setting.choices.length > 0) {
    return (
      <select
        value={currentValue}
        onChange={(e) => onUpdate(e.target.value)}
        disabled={disabled}
        className="min-w-[140px] cursor-pointer rounded-xl bg-apple-elevated px-3 py-2 text-sm text-apple-ink outline-none focus:ring-2 focus:ring-[#F97315]/50 disabled:opacity-50"
      >
        {setting.choices.map((choice, idx) => (
          <option key={idx} value={String(choice.value)}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  // Editing mode - Textarea for long values
  if (isEditing && needsTextarea) {
    return (
      <div className="w-full space-y-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel();
            // Ctrl+Enter to save
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
          }}
          autoFocus
          placeholder={t('admin.settings.inputPlaceholder')}
          className="min-h-[100px] w-full resize-none rounded-xl bg-apple-elevated px-4 py-3 font-mono text-sm text-apple-ink outline-none ring-2 ring-[#F97315]/50"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-apple-faint">{t('admin.settings.ctrlEnterHint')}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="rounded-full bg-apple-elevated px-3 py-1.5 text-sm text-apple-ink transition-opacity hover:opacity-90"
            >
              {t('admin.settings.cancelButton')}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-full bg-[#F97315] px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-90"
            >
              <CheckIcon />
              {t('admin.settings.saveButton')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Editing mode - Regular input
  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type={setting.type === 'int' || setting.type === 'float' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          autoFocus
          placeholder={t('admin.settings.inputPlaceholder')}
          className="w-48 rounded-xl bg-apple-elevated px-3 py-2 text-sm text-apple-ink outline-none ring-2 ring-[#F97315]/50 sm:w-56"
        />
        <button
          onClick={handleSave}
          className="rounded-full bg-[#F97315] p-2 text-white transition-opacity hover:opacity-90"
          title={t('admin.settings.saveHint')}
        >
          <CheckIcon />
        </button>
        <button
          onClick={handleCancel}
          className="rounded-full bg-apple-elevated p-2 text-apple-ink transition-opacity hover:opacity-90"
          title={t('admin.settings.cancelHint')}
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  // Display mode - Long value preview
  if (needsTextarea) {
    const displayValue = currentValue || '-';
    const previewValue =
      displayValue.length > 60 ? displayValue.slice(0, 60) + '...' : displayValue;

    return (
      <button
        onClick={handleStart}
        disabled={disabled}
        className="group w-full rounded-xl bg-apple-elevated px-4 py-3 text-left font-mono text-sm text-apple-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 flex-1 break-all">{previewValue}</span>
          <span className="flex-shrink-0 text-apple-faint transition-colors group-hover:text-[#F97315]">
            <EditIcon />
          </span>
        </div>
      </button>
    );
  }

  // Display mode - Short value
  return (
    <button
      onClick={handleStart}
      disabled={disabled}
      className="group flex min-w-[100px] max-w-[200px] items-center gap-2 truncate rounded-xl bg-apple-elevated px-3 py-2.5 text-left font-mono text-sm text-apple-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      <span className="flex-1 truncate">{currentValue || '-'}</span>
      <span className="text-apple-faint opacity-0 transition-colors group-hover:text-[#F97315] group-hover:opacity-100">
        <EditIcon />
      </span>
    </button>
  );
}
