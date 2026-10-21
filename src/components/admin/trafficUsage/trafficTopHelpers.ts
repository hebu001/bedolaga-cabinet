import type { TrafficNodeInfo, TrafficTopItem } from '@/api/adminTraffic';

const DAY_MS = 86_400_000;

export function utcPeriodRange(period: number, today = new Date().toISOString().slice(0, 10)) {
  const end = Date.parse(`${today}T00:00:00Z`);
  return {
    start_date: new Date(end - (period - 1) * DAY_MS).toISOString().slice(0, 10),
    end_date: today,
  };
}

export function isValidTrafficRange(
  start: string,
  end: string,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
  if (
    new Date(from).toISOString().slice(0, 10) !== start ||
    new Date(to).toISOString().slice(0, 10) !== end
  )
    return false;
  return start <= end && end <= today && (to - from) / DAY_MS + 1 <= 31;
}

// null means all; [] is an explicit empty intersection and must never be
// serialized as all nodes. Ordering does not change the cache key.
export function resolveTrafficNodes(
  nodes: TrafficNodeInfo[],
  selected: Set<string>,
  countries: Set<string>,
): string[] | null {
  if (selected.size === 0 && countries.size === 0) return null;
  return nodes
    .filter(
      (node) =>
        (selected.size === 0 || selected.has(node.node_uuid)) &&
        (countries.size === 0 || countries.has(node.country_code)),
    )
    .map((node) => node.node_uuid)
    .sort();
}

export type TrafficTopSort = { field: 'rank' | 'name' | 'traffic'; descending: boolean };

export function filterTrafficTop(
  items: TrafficTopItem[],
  search: string,
  sort: TrafficTopSort,
): TrafficTopItem[] {
  const needle = search.trim().toLocaleLowerCase();
  return items
    .filter((item) =>
      [item.panel_username, String(item.panel_user_id), item.local_user?.display_name ?? ''].some(
        (value) => value.toLocaleLowerCase().includes(needle),
      ),
    )
    .sort((a, b) => {
      const comparison =
        sort.field === 'name'
          ? a.panel_username.localeCompare(b.panel_username)
          : sort.field === 'traffic'
            ? a.total_bytes - b.total_bytes
            : a.rank - b.rank;
      return (sort.descending ? -comparison : comparison) || a.rank - b.rank;
    });
}
