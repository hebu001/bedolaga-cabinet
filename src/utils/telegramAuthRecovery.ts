import { openTelegramLink } from '@telegram-apps/sdk-react';
import { tokenStorage } from './token';

const RECOVERY_ATTEMPT_KEY = 'telegram_auth_relaunch_at';
const RECOVERY_COOLDOWN_MS = 60_000;
const BOT_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

let recoveryPromise: Promise<boolean> | null = null;

type TelegramAuthError = {
  response?: {
    status?: number;
    data?: { detail?: unknown };
  };
};

export function isInvalidTelegramInitDataError(error: unknown): boolean {
  const apiError = error as TelegramAuthError;
  const detail = apiError.response?.data?.detail;
  return (
    apiError.response?.status === 401 &&
    typeof detail === 'string' &&
    /invalid or expired telegram (authentication )?data/i.test(detail)
  );
}

export function clearTelegramAuthRecoveryAttempt(): void {
  try {
    localStorage.removeItem(RECOVERY_ATTEMPT_KEY);
  } catch {}
}

function clearCachedTelegramSession(): void {
  tokenStorage.clearTokens();
  try {
    sessionStorage.removeItem('tapps/launchParams');
    sessionStorage.removeItem('telegram_init_data');
    localStorage.removeItem('cabinet-auth');
  } catch {}
}

async function resolveBotUsername(): Promise<string | null> {
  const envUsername = String(import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '')
    .trim()
    .replace(/^@/, '');

  try {
    const apiBase = String(import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
    const response = await fetch(`${apiBase}/cabinet/branding/telegram-widget`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) {
      const data = (await response.json()) as { bot_username?: unknown };
      const serverUsername =
        typeof data.bot_username === 'string' ? data.bot_username.trim().replace(/^@/, '') : '';
      if (BOT_USERNAME_RE.test(serverUsername)) return serverUsername;
    }
  } catch {}

  return BOT_USERNAME_RE.test(envUsername) ? envUsername : null;
}

async function relaunchTelegramAuth(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  try {
    const previousAttempt = Number(localStorage.getItem(RECOVERY_ATTEMPT_KEY) || 0);
    if (Number.isFinite(previousAttempt) && now - previousAttempt < RECOVERY_COOLDOWN_MS) {
      return false;
    }
    // Set before the network request so React StrictMode/effect races cannot
    // launch two Mini Apps at once.
    localStorage.setItem(RECOVERY_ATTEMPT_KEY, String(now));
  } catch {
    return false;
  }

  const botUsername = await resolveBotUsername();
  if (!botUsername) {
    clearTelegramAuthRecoveryAttempt();
    return false;
  }

  clearCachedTelegramSession();

  // A unique startapp value forces Telegram to create a new signed launch
  // context instead of reopening the WebView with the cached initData.
  const startParam = `reauth_${now.toString(36)}`;
  try {
    openTelegramLink(`https://t.me/${botUsername}?startapp=${encodeURIComponent(startParam)}`);
    return true;
  } catch {
    clearTelegramAuthRecoveryAttempt();
    return false;
  }
}

export function tryTelegramAuthRelaunch(): Promise<boolean> {
  if (recoveryPromise) return recoveryPromise;

  recoveryPromise = relaunchTelegramAuth().finally(() => {
    recoveryPromise = null;
  });
  return recoveryPromise;
}
