import { CheckIcon } from '@/components/admin/legacyIcons';
import { useEffect, useRef, useState } from 'react';

import { ChevronDownIcon, GlobeIcon } from '../TrafficIcons';
import { getFlagEmoji } from '../trafficUsageHelpers';

export function CountryFilter({
  available,
  selected,
  onChange,
}: {
  available: { code: string; count: number }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (available.length === 0) return null;

  const allSelected = selected.size === 0;
  const activeCount = selected.size;

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    onChange(next);
  };

  const selectAll = () => onChange(new Set());

  return (
    <div className="sm:relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          activeCount > 0
            ? 'border-[#F97315]/50 bg-[#F97315]/10 text-[#F97315]'
            : 'border-apple-hairline bg-apple-card text-apple-ink hover:border-apple-hairline hover:bg-apple-elevated'
        }`}
      >
        <GlobeIcon className="h-4 w-4" />
        {activeCount > 0 && (
          <span className="rounded-full bg-[#F97315] px-1.5 text-[10px] text-white">
            {activeCount}
          </span>
        )}
        <ChevronDownIcon className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-xl border border-apple-hairline bg-apple-card py-1 shadow-xl sm:inset-x-auto sm:left-0 sm:w-48">
          <button
            onClick={selectAll}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-apple-elevated ${
              allSelected ? 'text-[#F97315]' : 'text-apple-mute'
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                allSelected ? 'border-[#F97315] bg-[#F97315]' : 'border-apple-hairline'
              }`}
            >
              {allSelected && <CheckIcon className="h-3 w-3 text-white" />}
            </span>
            All
          </button>

          <div className="mx-2 border-t border-apple-hairline" />

          <div className="max-h-48 overflow-y-auto">
            {available.map(({ code, count }) => {
              const checked = selected.has(code);
              return (
                <button
                  key={code}
                  onClick={() => toggle(code)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-apple-mute transition-colors hover:bg-apple-elevated"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? 'border-[#F97315] bg-[#F97315]' : 'border-apple-hairline'
                    }`}
                  >
                    {checked && <CheckIcon className="h-3 w-3 text-white" />}
                  </span>
                  {getFlagEmoji(code)} {code.toUpperCase()}
                  <span className="ml-auto text-apple-faint">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
