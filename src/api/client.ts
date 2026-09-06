import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { retrieveRawInitData } from '@telegram-apps/sdk-react';
import { tokenStorage, isTokenExpired, tokenRefreshManager } from '../utils/token';
import {
  assertCurrentSession,
  getSessionGeneration,
  getSessionSignal,
  isCurrentSession,
  ownSessionResult,
  SessionChangedError,
} from '../utils/session';
import { useBlockingStore } from '../store/blocking';
import { API } from '../config/constants';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

tokenRefreshManager.setRefreshEndpoint(`${API_BASE_URL}/cabinet/auth/refresh`);

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? match[2] : null;
}

function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function ensureCsrfToken(): string {
  let token = getCsrfToken();
  if (!token) {
    token = generateCsrfToken();
    document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; SameSite=Strict; Secure`;
  }
  return token;
}

const getTelegramInitData = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = retrieveRawInitData();
    if (raw) {
      tokenStorage.setTelegramInitData(raw);
      return raw;
    }
  } catch {}

  return tokenStorage.getTelegramInitData();
};

const transport = axios.create({
  baseURL: API_BASE_URL,
  timeout: API.TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface SessionRequestConfig extends InternalAxiosRequestConfig {
  _sessionOwner?: number;
  _retry?: boolean;
  _callerSignal?: AxiosRequestConfig['signal'];
  _disposeSessionSignal?: () => void;
}

// Capture ownership at the call site, before Axios schedules async interceptors.
// Otherwise a request queued immediately before logout could acquire B's token.
function ownedConfig(config: AxiosRequestConfig = {}): AxiosRequestConfig {
  const owner = (config as SessionRequestConfig)._sessionOwner ?? getSessionGeneration();
  const callerSignal = (config as SessionRequestConfig)._callerSignal ?? config.signal;
  return { ...config, _sessionOwner: owner, _callerSignal: callerSignal } as AxiosRequestConfig;
}
const bodyMethods = new Set(['post', 'put', 'patch', 'postForm', 'putForm', 'patchForm']);
const methods = new Set(['get', 'delete', 'head', 'options', ...bodyMethods]);
export const apiClient = new Proxy(transport, {
  apply(target, thisArg, args) {
    if (typeof args[0] === 'string') args[1] = ownedConfig(args[1]);
    else args[0] = ownedConfig(args[0]);
    return Reflect.apply(target, thisArg, args);
  },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof property === 'string' && methods.has(property)) {
      return (...args: unknown[]) => {
        const index = bodyMethods.has(property) ? 2 : 1;
        args[index] = ownedConfig(args[index] as AxiosRequestConfig | undefined);
        return Reflect.apply(value, target, args);
      };
    }
    if (property === 'request')
      return (config: AxiosRequestConfig) => target.request(ownedConfig(config));
    return value;
  },
});

const AUTH_ENDPOINTS = [
  '/cabinet/auth/telegram',
  '/cabinet/auth/telegram/widget',
  '/cabinet/auth/email/login',
  '/cabinet/auth/email/register/standalone',
  '/cabinet/auth/email/verify',
  '/cabinet/auth/refresh',
  '/cabinet/auth/password/forgot',
  '/cabinet/auth/password/reset',
  '/cabinet/auth/oauth/',
  '/cabinet/auth/account/link/server-complete',
  '/cabinet/auth/deeplink/',
  '/cabinet/auth/login/auto',
  '/cabinet/landing/',
];

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((endpoint) => url.startsWith(endpoint));
}

apiClient.interceptors.request.use(async (config: SessionRequestConfig) => {
  const owner = config._sessionOwner ?? getSessionGeneration();
  config._sessionOwner = owner;
  assertCurrentSession(owner);
  if (config._callerSignal?.aborted)
    throw Object.assign(new axios.CanceledError('Request canceled'), { config });
  if (config.data instanceof FormData && config.headers) delete config.headers['Content-Type'];

  if (!isAuthEndpoint(config.url)) {
    let token = tokenStorage.getAccessToken();
    if ((!token || isTokenExpired(token)) && tokenStorage.getRefreshToken()) {
      token = await tokenRefreshManager.refreshAccessToken();
      assertCurrentSession(owner);
      // A failed refresh must reject, never send expired/anonymous credentials.
      if (!token || isTokenExpired(token)) throw new Error('Authentication unavailable');
    }
    assertCurrentSession(owner);
    if (token && isTokenExpired(token)) throw new Error('Authentication unavailable');
    if (token && !isTokenExpired(token)) config.headers.Authorization = `Bearer ${token}`;
    else delete config.headers.Authorization;

    const sessionSignal = getSessionSignal();
    if (config._callerSignal) {
      const controller = new AbortController();
      const signal = config._callerSignal;
      const abort = () => controller.abort();
      if (signal.aborted || sessionSignal.aborted) controller.abort();
      signal.addEventListener?.('abort', abort, { once: true });
      sessionSignal.addEventListener('abort', abort, { once: true });
      config._disposeSessionSignal = () => {
        signal.removeEventListener?.('abort', abort);
        sessionSignal.removeEventListener('abort', abort);
      };
      config.signal = controller.signal;
    } else config.signal = sessionSignal;
  }

  const isTelegramAuthEndpoint =
    config.url?.startsWith('/cabinet/auth/telegram') ||
    config.url?.startsWith('/cabinet/auth/account/link/telegram');
  if (isTelegramAuthEndpoint) {
    const telegramInitData = getTelegramInitData();
    if (telegramInitData && config.headers) {
      config.headers['X-Telegram-Init-Data'] = telegramInitData;
    }
  }

  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && config.headers) {
    config.headers[CSRF_HEADER_NAME] = ensureCsrfToken();
  }

  return config;
});

export interface MaintenanceError {
  code: 'maintenance';
  message: string;
  reason?: string;
}

export interface ChannelSubscriptionError {
  code: 'channel_subscription_required';
  message: string;
  channel_link?: string;
  channels?: Array<{
    channel_id: string;
    channel_link?: string;
    title?: string;
    is_subscribed: boolean;
  }>;
}

export interface BlacklistedError {
  code: 'blacklisted';
  message: string;
}

export interface AccountDeletedError {
  code: 'account_deleted';
  message: string;
  bot_username?: string;
  telegram_deep_link?: string;
}

export function isMaintenanceError(
  error: unknown,
): error is { response: { status: 503; data: { detail: MaintenanceError } } } {
  if (!error || typeof error !== 'object') return false;
  const err = error as AxiosError<{ detail: MaintenanceError }>;
  return err.response?.status === 503 && err.response?.data?.detail?.code === 'maintenance';
}

export function isChannelSubscriptionError(
  error: unknown,
): error is { response: { status: 403; data: { detail: ChannelSubscriptionError } } } {
  if (!error || typeof error !== 'object') return false;
  const err = error as AxiosError<{ detail: ChannelSubscriptionError }>;
  return (
    err.response?.status === 403 &&
    err.response?.data?.detail?.code === 'channel_subscription_required'
  );
}

export function isBlacklistedError(
  error: unknown,
): error is { response: { status: 403; data: { detail: BlacklistedError } } } {
  if (!error || typeof error !== 'object') return false;
  const err = error as AxiosError<{ detail: BlacklistedError }>;
  return err.response?.status === 403 && err.response?.data?.detail?.code === 'blacklisted';
}

export function isAccountDeletedError(
  error: unknown,
): error is { response: { status: 403; data: { detail: AccountDeletedError } } } {
  if (!error || typeof error !== 'object') return false;
  const err = error as AxiosError<{ detail: AccountDeletedError }>;
  return err.response?.status === 403 && err.response?.data?.detail?.code === 'account_deleted';
}

apiClient.interceptors.response.use(
  async (response) => {
    const config = response.config as SessionRequestConfig;
    config._disposeSessionSignal?.();
    if (config._sessionOwner !== undefined && !isCurrentSession(config._sessionOwner)) {
      // Auth requests are not aborted: returned orphan credentials must be revoked.
      await tokenRefreshManager.discardResponse(response.data?.refresh_token);
      throw new SessionChangedError();
    }
    return {
      ...response,
      data: ownSessionResult(response.data, config._sessionOwner ?? getSessionGeneration()),
    };
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as SessionRequestConfig | undefined;
    originalRequest?._disposeSessionSignal?.();
    if (!originalRequest || originalRequest._sessionOwner === undefined)
      return Promise.reject(error);
    const owner = originalRequest._sessionOwner;
    assertCurrentSession(owner);

    if (isMaintenanceError(error)) {
      const detail = (error.response?.data as { detail: MaintenanceError }).detail;
      useBlockingStore.getState().setMaintenance({
        message: detail.message,
        reason: detail.reason,
      });
      return Promise.reject(error);
    }

    if (isChannelSubscriptionError(error)) {
      const detail = (error.response?.data as { detail: ChannelSubscriptionError }).detail;
      useBlockingStore.getState().setChannelSubscription({
        message: detail.message,
        channel_link: detail.channel_link,
        channels: detail.channels,
      });
      return Promise.reject(error);
    }

    if (isBlacklistedError(error)) {
      const detail = (error.response?.data as { detail: BlacklistedError }).detail;
      useBlockingStore.getState().setBlacklisted({
        message: detail.message,
      });
      return Promise.reject(error);
    }

    if (isAccountDeletedError(error)) {
      const detail = (error.response?.data as { detail: AccountDeletedError }).detail;
      // Surface the deleted-account screen. The auth flow (initData login)
      // is allowed to auto-revive; this branch is for token-bearing
      // sessions where the user is already in the cabinet but their row
      // got marked DELETED out-of-band, and for password-only logins
      // that can't be silently revived.
      useBlockingStore.getState().setAccountDeleted({
        message: detail.message,
        bot_username: detail.bot_username,
        telegram_deep_link: detail.telegram_deep_link,
      });
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const requestUrl = originalRequest.url || '';

      if (isAuthEndpoint(requestUrl)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      const current = tokenStorage.getAccessToken();
      const sent = originalRequest.headers.Authorization;
      // A late 401 for an access token already replaced in this tab can replay
      // within this same session without another rotation.
      const newToken =
        current && !isTokenExpired(current) && sent !== `Bearer ${current}`
          ? current
          : await tokenRefreshManager.refreshAccessToken();
      assertCurrentSession(owner);
      if (originalRequest._callerSignal?.aborted)
        throw Object.assign(new axios.CanceledError('Request canceled'), {
          config: originalRequest,
        });
      if (newToken && !isTokenExpired(newToken)) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
