import { describe, expect, it } from 'vitest';
import { isValidTrafficRange, resolveTrafficNodes, utcPeriodRange } from './trafficTopHelpers';

describe('traffic UTC calendar scopes', () => {
  it('counts the current UTC calendar day inclusively', () => {
    expect(utcPeriodRange(1, '2026-10-21')).toEqual({
      start_date: '2026-10-21',
      end_date: '2026-10-21',
    });
    expect(utcPeriodRange(7, '2026-10-21')).toEqual({
      start_date: '2026-10-15',
      end_date: '2026-10-21',
    });
    expect(utcPeriodRange(7, '2026-03-02')).toEqual({
      start_date: '2026-02-24',
      end_date: '2026-03-02',
    });
  });
  it('accepts at most 31 inclusive real dates, and rejects reversed/future/incomplete ranges', () => {
    expect(isValidTrafficRange('2026-01-01', '2026-01-31', '2026-10-21')).toBe(true);
    expect(isValidTrafficRange('2026-01-01', '2026-02-01', '2026-10-21')).toBe(false);
    expect(isValidTrafficRange('2026-02-30', '2026-03-02', '2026-10-21')).toBe(false);
    expect(isValidTrafficRange('2026-10-20', '2026-10-22', '2026-10-21')).toBe(false);
    expect(isValidTrafficRange('2026-10-21', '2026-10-20', '2026-10-21')).toBe(false);
    expect(isValidTrafficRange('', '2026-10-20', '2026-10-21')).toBe(false);
  });
  it('canonicalizes selected UUIDs and distinguishes all from an empty intersection', () => {
    const nodes = [
      { node_uuid: 'b', node_name: 'B', country_code: 'GB' },
      { node_uuid: 'a', node_name: 'A', country_code: 'US' },
    ];
    expect(resolveTrafficNodes(nodes, new Set(), new Set())).toBeNull();
    expect(resolveTrafficNodes(nodes, new Set(['b', 'a']), new Set())).toEqual(['a', 'b']);
    expect(resolveTrafficNodes(nodes, new Set(['a']), new Set(['GB']))).toEqual([]);
    expect(resolveTrafficNodes(nodes, new Set(), new Set(['GB']))).toEqual(['b']);
  });
});
