import { describe, expect, it } from 'vitest';
import { canCreatePanelUser, numericPanelId, readPanelIdentity } from './adminPanelIdentity';

const uuid = 'c9e61e1f-9fdc-4450-8774-eb198c310b8b';
// Synthetic fixtures preserve only the fields proven in schemas/users.py (baseline
// bot 4b06edc) and adminUsers.ts (upstream cabinet f5ea595), not a live target response.
describe('explicit panel identity contract', () => {
  it.each([
    ['user', 'remnawave_uuid', 'remnawave_id'],
    ['panelUser', 'uuid', 'id'],
    ['syncToPanel', 'panel_uuid', 'panel_user_id'],
  ] as const)(
    'validates the configured wire mode for %s without coercion',
    (source, uuidKey, idKey) => {
      expect(readPanelIdentity({ [uuidKey]: uuid }, 'uuid', source)).toEqual({
        kind: 'uuid',
        value: uuid,
      });
      expect(readPanelIdentity({ [idKey]: 47 }, 'numeric', source)).toEqual({
        kind: 'numeric',
        value: 47,
      });
      expect(() => readPanelIdentity({ [uuidKey]: uuid }, 'numeric', source)).toThrow(
        'contract mismatch',
      );
      expect(() => readPanelIdentity({ [idKey]: 47 }, 'uuid', source)).toThrow('contract mismatch');
      expect(() => readPanelIdentity({ [idKey]: '47' }, 'numeric', source)).toThrow();
      expect(() => readPanelIdentity({}, 'uuid', source)).toThrow();
      expect(readPanelIdentity({ [uuidKey]: null }, 'uuid', source)).toBeNull();
    },
  );
  it('refuses UUID/null/missing identities for numeric panel actions', () => {
    expect(numericPanelId({ kind: 'uuid', value: uuid })).toBeNull();
    expect(numericPanelId(null)).toBeNull();
    expect(numericPanelId(undefined)).toBeNull();
    expect(numericPanelId({ kind: 'numeric', value: 47 })).toBe(47);
  });
  it('keeps missing-user creation available through the real bot user ID', () => {
    const identity = readPanelIdentity({ remnawave_uuid: null }, 'uuid', 'user');
    expect(identity).toBeNull();
    expect(canCreatePanelUser(7)).toBe(true);
    expect(canCreatePanelUser(0)).toBe(false);
    expect(canCreatePanelUser(NaN)).toBe(false);
  });
});
