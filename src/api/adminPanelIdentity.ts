/** Explicit compatibility boundary. Mode is chosen by release config, never inferred
 * from a response. Sources: baseline bot schemas/users.py and upstream cabinet 1.79.
 * This is an internal representation, not a newly invented backend field. */
export type PanelIdentity = { kind: 'uuid'; value: string } | { kind: 'numeric'; value: number };
export type PanelIdentityMode = 'uuid' | 'numeric';
export type PanelIdentitySource = 'user' | 'panelUser' | 'syncToPanel';
const fields = {
  user: { uuid: 'remnawave_uuid', numeric: 'remnawave_id' },
  panelUser: { uuid: 'uuid', numeric: 'id' },
  syncToPanel: { uuid: 'panel_uuid', numeric: 'panel_user_id' },
} as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPanelIdentity(
  payload: unknown,
  mode: PanelIdentityMode,
  source: PanelIdentitySource,
): PanelIdentity | null {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid panel identity response');
  const key = fields[source][mode];
  const raw = (payload as Record<string, unknown>)[key];
  if (raw === null) return null;
  if (mode === 'uuid' && typeof raw === 'string' && uuid.test(raw))
    return { kind: mode, value: raw };
  if (mode === 'numeric' && typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0)
    return { kind: mode, value: raw };
  throw new Error(`Panel identity contract mismatch: expected ${key}`);
}

/** Panel-specific numeric actions must never receive bot IDs or coerced UUIDs. */
export function numericPanelId(identity: PanelIdentity | null | undefined): number | null {
  return identity?.kind === 'numeric' ? identity.value : null;
}

/** A missing panel user can still be created through the bot user's sync route. */
export function canCreatePanelUser(botUserId: number): boolean {
  return Number.isSafeInteger(botUserId) && botUserId > 0;
}
