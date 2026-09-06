import axios from 'axios';
import {
  advanceSession,
  assertCurrentSession,
  getSessionGeneration,
  isCurrentSession,
  SessionChangedError,
  setSessionSynchronizer,
} from './session';

const TOKEN_KEYS = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
  USER: 'user',
  TELEGRAM_INIT: 'telegram_init_data',
} as const;

// One atomic storage write publishes identity and refresh token together.
// Access tokens remain tab-local and are bound to this shared session id.
const SESSION_KEY = 'cabinet-session-v1';
const ACCESS_SESSION_KEY = 'access_session_id';
interface StoredSession {
  id: string;
  refreshToken: string | null;
}
let sharedSession: StoredSession | undefined;
let memoryAccess: string | null = null;
let sharedStorageAvailable = true;

function sessionId(): string {
  // getRandomValues also works in older Telegram WebViews without randomUUID.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function parseStoredSession(raw: string | null): StoredSession | null {
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (
      value &&
      typeof value === 'object' &&
      typeof value.id === 'string' &&
      value.id &&
      (value.refreshToken === null ||
        (typeof value.refreshToken === 'string' && value.refreshToken))
    )
      return { id: value.id, refreshToken: value.refreshToken };
  } catch {}
  return null;
}

function readSession(): StoredSession {
  if (!sharedStorageAvailable && sharedSession) return sharedSession;
  try {
    const value = parseStoredSession(localStorage.getItem(SESSION_KEY));
    if (value) return value;
    // Stable migration identity lets already-open tabs agree without a lock.
    let legacy = localStorage.getItem(TOKEN_KEYS.REFRESH);
    try {
      legacy ||= sessionStorage.getItem(TOKEN_KEYS.REFRESH);
    } catch {}
    return { id: legacy ? `legacy:${legacy}` : 'signed-out', refreshToken: legacy };
  } catch {
    sharedStorageAvailable = false;
    if (sharedSession) return sharedSession;
    try {
      const fallback = parseStoredSession(sessionStorage.getItem(SESSION_KEY));
      if (fallback) return fallback;
      const refreshToken = sessionStorage.getItem(TOKEN_KEYS.REFRESH);
      return { id: refreshToken ? `legacy:${refreshToken}` : 'memory', refreshToken };
    } catch {
      return { id: 'memory', refreshToken: null };
    }
  }
}

function persistSession(value: StoredSession): void {
  sharedSession = value;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {}
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    sharedStorageAvailable = false;
    // Quota errors can deny setItem while still allowing deletion. Remove an
    // older shared credential so other tabs cannot keep an account we replaced.
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  }
  // Cleanup failure in one storage area must not disable the other one.
  try {
    localStorage.removeItem(TOKEN_KEYS.REFRESH);
    localStorage.removeItem(TOKEN_KEYS.ACCESS);
    localStorage.removeItem(TOKEN_KEYS.USER);
    localStorage.removeItem('cabinet-auth');
  } catch {}
  try {
    sessionStorage.removeItem(TOKEN_KEYS.REFRESH);
  } catch {}
}

function saveAccess(token: string | null, id: string): void {
  memoryAccess = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEYS.ACCESS, token);
    else sessionStorage.removeItem(TOKEN_KEYS.ACCESS);
    sessionStorage.setItem(ACCESS_SESSION_KEY, id);
    sessionStorage.removeItem(TOKEN_KEYS.USER);
  } catch {}
}

function syncSession(): void {
  const next = readSession();
  if (!sharedSession) {
    sharedSession = next;
    try {
      const owner = sessionStorage.getItem(ACCESS_SESSION_KEY);
      // Accept unbound legacy access only alongside legacy refresh credentials.
      memoryAccess =
        owner === next.id || (!owner && next.id.startsWith('legacy:'))
          ? sessionStorage.getItem(TOKEN_KEYS.ACCESS)
          : null;
    } catch {}
    return;
  }
  const changed = sharedSession.id !== next.id;
  sharedSession = next;
  if (changed) {
    saveAccess(null, next.id);
    advanceSession();
  }
}

setSessionSynchronizer(syncSession);
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_KEY || event.key === TOKEN_KEYS.REFRESH || event.key === null)
      syncSession();
  });
  window.addEventListener('focus', syncSession);
}

interface JWTPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null, bufferSeconds = 30): boolean {
  if (!token) return true;

  const payload = decodeJWT(token);
  if (!payload?.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + bufferSeconds;
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  return !isTokenExpired(token);
}

export const tokenStorage = {
  getAccessToken(): string | null {
    syncSession();
    return memoryAccess;
  },
  getRefreshToken(): string | null {
    syncSession();
    return sharedSession!.refreshToken;
  },
  setTokens(accessToken: string, refreshToken: string, owner = getSessionGeneration()): void {
    if (!accessToken || !refreshToken)
      throw new Error('Invalid tokens: cannot store empty credentials');
    assertCurrentSession(owner);
    const next = { id: sessionId(), refreshToken };
    persistSession(next);
    saveAccess(accessToken, next.id);
    advanceSession();
  },
  setAccessToken(accessToken: string): void {
    syncSession();
    saveAccess(accessToken, sharedSession!.id);
  },
  rotateTokens(owner: number, source: string, accessToken: string, refreshToken: string): boolean {
    if (!isCurrentSession(owner) || this.getRefreshToken() !== source) return false;
    persistSession({ id: sharedSession!.id, refreshToken });
    saveAccess(accessToken, sharedSession!.id);
    return true;
  },
  clearTokens(): void {
    syncSession();
    const next = { id: sessionId(), refreshToken: null };
    persistSession(next);
    saveAccess(null, next.id);
    advanceSession();
  },
  migrateFromLocalStorage(): void {
    // Initialization reads legacy values once. New writes use the single record.
    syncSession();
    try {
      if (!memoryAccess && sharedSession!.id.startsWith('legacy:')) {
        saveAccess(localStorage.getItem(TOKEN_KEYS.ACCESS), sharedSession!.id);
      }
      localStorage.removeItem(TOKEN_KEYS.ACCESS);
      localStorage.removeItem('cabinet-auth');
    } catch {}
  },
  getTelegramInitData(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEYS.TELEGRAM_INIT);
    } catch {
      return null;
    }
  },
  setTelegramInitData(data: string): void {
    try {
      sessionStorage.setItem(TOKEN_KEYS.TELEGRAM_INIT, data);
    } catch {}
  },
};

export function clearStaleSessionIfNeeded(freshInitData: string | null): void {
  if (!freshInitData) return;
  try {
    const user = JSON.parse(new URLSearchParams(freshInitData).get('user') || 'null');
    const current = user?.id != null ? String(user.id) : null;
    const previous = localStorage.getItem('tg_user_id');
    if (previous && current && previous !== current) tokenStorage.clearTokens();
    if (current) localStorage.setItem('tg_user_id', current);
    tokenStorage.setTelegramInitData(freshInitData);
    localStorage.removeItem(TOKEN_KEYS.TELEGRAM_INIT);
  } catch {}
}

export class RefreshUnavailableError extends Error {
  constructor(public readonly terminal = false) {
    super(terminal ? 'Authentication expired' : 'Could not refresh authentication; retry later');
    this.name = 'RefreshUnavailableError';
  }
}

const REFRESH_TIMEOUT_MS = 10_000;
const LOCK_TIMEOUT_MS = 12_000;
const RECOVERY_WAIT_MS = 150;
const RECOVERY_ATTEMPTS = 6;

class TokenRefreshManager {
  private active: { owner: number; promise: Promise<string | null> } | null = null;
  private refreshEndpoint = '/api/cabinet/auth/refresh';

  setRefreshEndpoint(endpoint: string): void {
    this.refreshEndpoint = endpoint;
  }

  // Logout never uses the authenticated interceptor and never reads new tokens.
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      await axios.post(
        this.refreshEndpoint.replace(/\/refresh$/, '/logout'),
        { refresh_token: refreshToken },
        { timeout: REFRESH_TIMEOUT_MS },
      );
    } catch {}
  }

  async discardResponse(refreshToken: string | undefined): Promise<void> {
    if (refreshToken && refreshToken !== tokenStorage.getRefreshToken()) {
      await this.revokeRefreshToken(refreshToken);
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    const owner = getSessionGeneration();
    if (this.active?.owner === owner) return this.active.promise;
    if (!tokenStorage.getRefreshToken()) return null;
    const promise = this.coordinatedRefresh(owner);
    const active = { owner, promise };
    this.active = active;
    try {
      return await promise;
    } finally {
      if (this.active === active) this.active = null;
    }
  }

  private async coordinatedRefresh(owner: number): Promise<string | null> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks || !sharedStorageAvailable) return this.doRefresh(owner, false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOCK_TIMEOUT_MS);
    let entered = false;
    try {
      return await locks.request(
        'cabinet-refresh-v1',
        { mode: 'exclusive', signal: controller.signal },
        async () => {
          entered = true;
          clearTimeout(timer);
          assertCurrentSession(owner);
          // The winner may have rotated while this tab waited; always read here.
          return this.doRefresh(owner, true);
        },
      );
    } catch (error) {
      if (entered) throw error;
      assertCurrentSession(owner);
      // Unsupported/security-denied locks use optimistic rotation. A timed-out
      // lock may still have a live owner, so it must not start a second request.
      if (controller.signal.aborted) throw new RefreshUnavailableError();
      return this.doRefresh(owner, false);
    } finally {
      clearTimeout(timer);
    }
  }

  private async doRefresh(owner: number, exclusive: boolean): Promise<string | null> {
    // At most one recovery request; no unbounded loops under contention.
    for (let attempt = 0; attempt < 2; attempt++) {
      assertCurrentSession(owner);
      const source = tokenStorage.getRefreshToken();
      if (!source) return null;
      try {
        const response = await axios.post<{ access_token?: string; refresh_token?: string }>(
          this.refreshEndpoint,
          { refresh_token: source },
          {
            timeout: REFRESH_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/json', 'X-Refresh-Token-Rotation': '1' },
          },
        );
        const access = response.data.access_token;
        const refresh = response.data.refresh_token || source;
        if (!isCurrentSession(owner)) {
          await this.discardResponse(refresh);
          throw new SessionChangedError();
        }
        if (!access) throw new RefreshUnavailableError();
        if (tokenStorage.rotateTokens(owner, source, access, refresh)) return access;
        // Another tab published a successor. Never overwrite or revoke it.
        await this.discardResponse(refresh);
      } catch (error) {
        assertCurrentSession(owner);
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status !== 401 && status !== 403) throw error;
        if (!exclusive) {
          // An advisory fallback cannot distinguish terminal rejection from a
          // winner whose response has not arrived yet. Allow bounded publication
          // time, then preserve credentials if the outcome remains ambiguous.
          for (
            let wait = 0;
            wait < RECOVERY_ATTEMPTS && tokenStorage.getRefreshToken() === source;
            wait++
          ) {
            await new Promise((resolve) => setTimeout(resolve, RECOVERY_WAIT_MS));
            assertCurrentSession(owner);
          }
        }
        if (tokenStorage.getRefreshToken() === source) {
          if (exclusive && sharedStorageAvailable) {
            tokenStorage.clearTokens();
            throw new RefreshUnavailableError(true);
          }
          throw new RefreshUnavailableError();
        }
      }
    }
    throw new RefreshUnavailableError();
  }

  get isRefreshInProgress(): boolean {
    return this.active?.owner === getSessionGeneration();
  }
  async waitForRefresh(): Promise<string | null> {
    return this.active?.owner === getSessionGeneration()
      ? this.active.promise
      : tokenStorage.getAccessToken();
  }
}

export const tokenRefreshManager = new TokenRefreshManager();

const RETURN_URL_KEY = 'auth_return_url';

export function saveReturnUrl(): void {
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath && currentPath !== '/login') {
      sessionStorage.setItem(RETURN_URL_KEY, currentPath);
    }
  }
}

export function getAndClearReturnUrl(): string | null {
  if (typeof window !== 'undefined') {
    const url = sessionStorage.getItem(RETURN_URL_KEY);
    sessionStorage.removeItem(RETURN_URL_KEY);
    return url;
  }
  return null;
}

export function safeRedirectToLogin(): void {
  if (typeof window !== 'undefined') {
    // Guard: don't redirect if already on /login to prevent infinite reload loops
    if (window.location.pathname === '/login') return;
    saveReturnUrl();
    window.location.href = '/login';
  }
}

export function isValidRedirectUrl(url: string): boolean {
  if (!url) return false;

  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}
