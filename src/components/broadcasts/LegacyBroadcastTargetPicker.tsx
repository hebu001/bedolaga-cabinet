import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  UsersIcon,
} from '@/components/admin/legacyPageIcons/AdminBroadcastCreate';
import { adminBroadcastsApi, type BroadcastFilter, type TariffFilter } from '@/api/adminBroadcasts';

type Filter = BroadcastFilter | TariffFilter;
interface Props {
  channel: 'telegram' | 'email';
  target: string;
  onChange: (target: string) => void;
  filters: Filter[];
  isLoading: boolean;
}

/** Older bot releases accept one target; retain that contract until audience is verified. */
export function LegacyBroadcastTargetPicker({
  channel,
  target,
  onChange,
  filters,
  isLoading,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const preview = useMutation({
    mutationFn:
      channel === 'telegram' ? adminBroadcastsApi.preview : adminBroadcastsApi.previewEmail,
  });
  const mutate = preview.mutate;
  useEffect(() => {
    if (target) mutate(target);
  }, [target, mutate]);
  const selected = filters.find((filter) => filter.key === target);
  const count = target ? (preview.data?.count ?? selected?.count ?? null) : null;
  const groups = useMemo(() => {
    const grouped: Record<string, Filter[]> = {};
    for (const filter of filters) {
      const group = 'group' in filter && filter.group ? filter.group : 'tariff';
      (grouped[group] ??= []).push(filter);
    }
    return grouped;
  }, [filters]);
  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-apple-mute">
        {t(
          channel === 'telegram'
            ? 'admin.broadcasts.selectFilter'
            : 'admin.broadcasts.selectEmailFilter',
        )}
      </label>
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-xl bg-apple-elevated p-3 text-left transition-colors"
        >
          <div className="flex min-w-0 items-center gap-2">
            <UsersIcon />
            <span className={selected ? 'text-apple-ink' : 'text-apple-mute'}>
              {selected?.label ??
                t(
                  channel === 'telegram'
                    ? 'admin.broadcasts.selectFilterPlaceholder'
                    : 'admin.broadcasts.selectEmailFilterPlaceholder',
                )}
            </span>
            {count !== null && (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#F97315]/20 px-2 py-0.5 text-xs text-[#F97315]">
                {count} {t('admin.broadcasts.recipients')}
              </span>
            )}
          </div>
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-xl bg-apple-card shadow-xl">
            {isLoading ? (
              <div className="p-4 text-center text-apple-mute">{t('common.loading')}</div>
            ) : (
              Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  <div className="bg-apple-elevated px-4 py-2 text-xs font-medium uppercase text-apple-mute">
                    {t(`admin.broadcasts.filterGroups.${group}`, group)}
                  </div>
                  {items.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => {
                        onChange(filter.key);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${target === filter.key ? 'bg-[#F97315]/10 text-[#F97315]' : 'text-apple-ink hover:bg-apple-elevated'}`}
                    >
                      <span>{filter.label}</span>
                      {filter.count !== null && (
                        <span className="text-xs text-apple-mute">{filter.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
