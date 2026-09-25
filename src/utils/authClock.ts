// Token expiry is a server-time decision. The phone's wall clock may be wrong
// or change while the cabinet is open; performance.now() does not follow it.
let sample: { serverMs: number; monotonicMs: number } | null = null;

function monotonicNow(): number | null {
  if (typeof performance === 'undefined') return null;
  const now = performance.now();
  return Number.isFinite(now) ? now : null;
}

export function authNowMs(): number | null {
  const now = monotonicNow();
  if (!sample || now === null || now < sample.monotonicMs) return null;
  return sample.serverMs + (now - sample.monotonicMs);
}

export function observeAuthServerTime(date: unknown): void {
  if (typeof date !== 'string') return;
  const serverMs = Date.parse(date);
  const monotonicMs = monotonicNow();
  if (!Number.isFinite(serverMs) || monotonicMs === null) return;
  // HTTP Date has second precision. Delayed responses must not rewind time.
  sample = { serverMs: Math.max(serverMs, authNowMs() ?? serverMs), monotonicMs };
}
