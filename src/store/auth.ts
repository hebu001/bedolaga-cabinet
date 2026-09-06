import { create } from 'zustand';
import type { CampaignBonusInfo, RegisterResponse, User } from '../types';
import { authApi } from '../api/auth';
import { apiClient } from '../api/client';
import {
  captureCampaignFromUrl,
  consumeCampaignSlug,
  getPendingCampaignSlug,
} from '../utils/campaign';
import {
  captureReferralFromUrl,
  consumeReferralCode,
  getPendingReferralCode,
} from '../utils/referral';
import { tokenStorage, isTokenValid, tokenRefreshManager } from '../utils/token';
import {
  assertCurrentSession,
  assertSessionResult,
  getSessionGeneration,
  isCurrentSession,
  subscribeSession,
} from '../utils/session';
import { useBlockingStore } from './blocking';
import { usePermissionStore } from './permissions';

export interface TelegramWidgetData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  pendingCampaignBonus: CampaignBonusInfo | null;

  sessionGeneration: number;
  completeLogin: (response: LoginResult) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string, owner?: number) => void;
  setUser: (user: User) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  clearCampaignBonus: () => void;
  logout: () => void;
  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkAdminStatus: () => Promise<void>;
  loginWithTelegram: (initData: string) => Promise<void>;
  loginWithTelegramWidget: (data: TelegramWidgetData) => Promise<void>;
  loginWithTelegramOIDC: (idToken: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (
    provider: string,
    code: string,
    state: string,
    deviceId?: string | null,
  ) => Promise<void>;
  loginWithDeepLink: (token: string, campaignSlug?: string | null) => Promise<void>;
  registerWithEmail: (
    email: string,
    password: string,
    firstName?: string,
    referralCode?: string,
  ) => Promise<RegisterResponse>;
}

interface LoginResult {
  access_token?: string | null;
  refresh_token?: string | null;
  user?: User | null;
  campaign_bonus?: CampaignBonusInfo | null;
}
const signedOut = {
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isAdmin: false,
  pendingCampaignBonus: null,
};
let initialization: { owner: number; promise: Promise<void> } | null = null;
let initializedOwner: number | undefined;

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...signedOut,
  isLoading: true,
  sessionGeneration: getSessionGeneration(),
  clearCampaignBonus: () => set({ pendingCampaignBonus: null }),
  setTokens: (accessToken, refreshToken, owner) => {
    tokenStorage.setTokens(accessToken, refreshToken, owner);
    set({ accessToken, refreshToken, isAuthenticated: true, isLoading: false });
  },
  completeLogin: async (response) => {
    const sourceOwner = getSessionGeneration();
    try {
      assertSessionResult(response);
    } catch (error) {
      await tokenRefreshManager.discardResponse(response.refresh_token || undefined);
      throw error;
    }
    if (!response.access_token || !response.refresh_token)
      throw new Error('Invalid auth response: missing tokens');
    get().setTokens(response.access_token, response.refresh_token, sourceOwner);
    const owner = getSessionGeneration();
    set({ user: response.user || null, pendingCampaignBonus: response.campaign_bonus || null });
    if (!response.user) await get().refreshUser();
    await get().checkAdminStatus();
    assertCurrentSession(owner);
  },
  setUser: (user) => {
    assertSessionResult(user);
    if (get().isAuthenticated) set({ user });
  },
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  logout: () => {
    const refresh = tokenStorage.getRefreshToken();
    // Invalidate synchronously, before sending any network request.
    tokenStorage.clearTokens();
    if (refresh) void tokenRefreshManager.revokeRefreshToken(refresh);
  },
  checkAdminStatus: async () => {
    const owner = getSessionGeneration();
    try {
      if (!tokenStorage.getRefreshToken()) return;
      const response = await apiClient.get<{ is_admin: boolean }>('/cabinet/auth/me/is-admin');
      assertCurrentSession(owner);
      set({ isAdmin: response.data.is_admin });
      if (response.data.is_admin) await usePermissionStore.getState().fetchPermissions();
      else usePermissionStore.getState().reset();
    } catch {
      if (isCurrentSession(owner)) {
        set({ isAdmin: false });
        usePermissionStore.getState().reset();
      }
    }
  },
  refreshUser: async () => {
    const owner = getSessionGeneration();
    try {
      const user = await authApi.getMe();
      if (isCurrentSession(owner))
        set({
          user,
          accessToken: tokenStorage.getAccessToken(),
          refreshToken: tokenStorage.getRefreshToken(),
        });
    } catch {}
  },
  initialize: async () => {
    tokenStorage.migrateFromLocalStorage();
    const owner = getSessionGeneration();
    if (initializedOwner === owner) return;
    if (initialization?.owner === owner) return initialization.promise;
    const promise = (async () => {
      set({ isLoading: true });
      try {
        if (!tokenStorage.getRefreshToken()) return;
        let accessToken = tokenStorage.getAccessToken();
        if (!isTokenValid(accessToken))
          accessToken = await tokenRefreshManager.refreshAccessToken();
        assertCurrentSession(owner);
        if (!accessToken) return;
        const user = await authApi.getMe();
        assertCurrentSession(owner);
        await get().checkAdminStatus();
        assertCurrentSession(owner);
        set({
          accessToken: tokenStorage.getAccessToken(),
          refreshToken: tokenStorage.getRefreshToken(),
          user,
          isAuthenticated: true,
        });
        initializedOwner = owner;
      } catch {
        // Offline, timeout and server errors keep credentials for a later retry.
        // Only the coordinator clears a confirmed terminal current-session error.
      } finally {
        if (isCurrentSession(owner)) set({ isLoading: false });
      }
    })();
    const active = { owner, promise };
    initialization = active;
    try {
      await promise;
    } finally {
      if (initialization === active) initialization = null;
    }
  },
  loginWithTelegram: async (initData) => {
    const response = await authApi.loginTelegram(
      initData,
      getPendingCampaignSlug(),
      getPendingReferralCode(),
    );
    await get().completeLogin(response);
    consumeCampaignSlug();
    consumeReferralCode();
  },
  loginWithTelegramWidget: async (data) => {
    const response = await authApi.loginTelegramWidget(
      data,
      getPendingCampaignSlug(),
      getPendingReferralCode(),
    );
    await get().completeLogin(response);
    consumeCampaignSlug();
    consumeReferralCode();
  },
  loginWithTelegramOIDC: async (idToken) => {
    const response = await authApi.loginTelegramOIDC(
      idToken,
      getPendingCampaignSlug(),
      getPendingReferralCode(),
    );
    await get().completeLogin(response);
    consumeCampaignSlug();
    consumeReferralCode();
  },
  loginWithEmail: async (email, password) => {
    const response = await authApi.loginEmail(
      email,
      password,
      getPendingCampaignSlug(),
      getPendingReferralCode(),
    );
    await get().completeLogin(response);
    consumeCampaignSlug();
    consumeReferralCode();
  },
  loginWithOAuth: async (provider, code, state, deviceId) => {
    const response = await authApi.oauthCallback(
      provider,
      code,
      state,
      deviceId,
      getPendingCampaignSlug(),
      getPendingReferralCode(),
    );
    await get().completeLogin(response);
    consumeCampaignSlug();
    consumeReferralCode();
  },
  loginWithDeepLink: async (token, campaignSlug) => {
    await get().completeLogin(await authApi.pollDeepLinkToken(token, campaignSlug));
  },
  registerWithEmail: async (email, password, firstName, referralCode) => {
    const response = await authApi.registerEmailStandalone({
      email,
      password,
      first_name: firstName,
      language: navigator.language.split('-')[0] || 'ru',
      referral_code: referralCode || getPendingReferralCode() || undefined,
      campaign_slug: getPendingCampaignSlug() || undefined,
    });
    consumeReferralCode();
    return response;
  },
}));

subscribeSession(() => {
  initializedOwner = undefined;
  usePermissionStore.getState().reset();
  useBlockingStore.getState().clearBlocking();
  useAuthStore.setState({
    ...signedOut,
    // Protect the current route until a shared replacement has initialized.
    // Local completeLogin publishes authenticated state in this same turn.
    isLoading: !!tokenStorage.getRefreshToken(),
    sessionGeneration: getSessionGeneration(),
  });
  // A shared login from another tab needs a fresh local /me and permissions.
  // Local login commits state synchronously before this microtask runs.
  queueMicrotask(() => {
    if (!useAuthStore.getState().isAuthenticated && tokenStorage.getRefreshToken()) {
      void useAuthStore.getState().initialize();
    }
  });
});

captureCampaignFromUrl();
captureReferralFromUrl();
void useAuthStore.getState().initialize();
