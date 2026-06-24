import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../../api/auth';
import { brandingApi, type TelegramWidgetConfig, type EmailAuthEnabled } from '../../api/branding';
import { useToast } from '../Toast';
import ProviderIcon from '../ProviderIcon';
import { LINK_OAUTH_STATE_KEY, LINK_OAUTH_PROVIDER_KEY, getErrorDetail } from '../../utils/oauth';
import { getTelegramInitData } from '../../hooks/useTelegramSDK';
import { usePlatform, useIsTelegram } from '@/platform/hooks/usePlatform';
import { useAuthStore } from '../../store/auth';
import { isValidEmail } from '../../utils/validation';
import { localizeServerMessage } from '../../utils/serverMessages';
import type { LinkedProvider } from '../../types';

const OAUTH_PROVIDERS = ['google', 'yandex', 'discord', 'vk'];

const isOAuthProvider = (provider: string): boolean => OAUTH_PROVIDERS.includes(provider);

const isLinkableProvider = (provider: string): boolean =>
  isOAuthProvider(provider) || provider === 'telegram' || provider === 'email';

// SessionStorage key for Telegram link CSRF state
export const LINK_TELEGRAM_STATE_KEY = 'link_telegram_state';

const LINK_SCRIPT_LOAD_TIMEOUT_MS = 8000;

// Apple-dark helpers
const inputCls =
  'w-full rounded-xl bg-apple-card px-4 py-3 text-[15px] text-apple-ink outline-none transition-shadow placeholder:text-apple-faint focus:ring-2 focus:ring-apple-blue/60 disabled:opacity-50';

function PrimaryButton({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}

/** Telegram account linking widget (browser only). Supports OIDC popup and legacy widget. */
function TelegramLinkWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [oidcLoading, setOidcLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const mountedRef = useRef(true);

  const { data: widgetConfig } = useQuery<TelegramWidgetConfig>({
    queryKey: ['telegram-widget-config'],
    queryFn: brandingApi.getTelegramWidgetConfig,
    staleTime: 60000,
  });

  const botUsername =
    widgetConfig?.bot_username || import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';
  const isOIDC = Boolean(widgetConfig?.oidc_enabled && widgetConfig?.oidc_client_id);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleLinkResult = useCallback(
    async (response: Awaited<ReturnType<typeof authApi.linkTelegram>>) => {
      if (response.merge_required && response.merge_token) {
        navigate(`/merge/${response.merge_token}`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
        showToast({ type: 'success', message: t('profile.accounts.linkSuccess') });
      }
    },
    [navigate, queryClient, showToast, t],
  );

  // Handle script load failure (timeout or error)
  const handleScriptFailed = useCallback(() => {
    if (!mountedRef.current || scriptLoaded) return;
    setScriptFailed(true);
  }, [scriptLoaded]);

  // OIDC callback handler (ref pattern to avoid stale closures)
  const handleOIDCCallbackRef =
    useRef<(data: { id_token?: string; error?: string }) => void>(undefined);

  handleOIDCCallbackRef.current = async (data: { id_token?: string; error?: string }) => {
    if (!mountedRef.current) return;
    if (data.error || !data.id_token) {
      setOidcLoading(false);
      showToast({
        type: 'error',
        message: data.error || t('profile.accounts.linkError'),
      });
      return;
    }
    try {
      setOidcLoading(true);
      const response = await authApi.linkTelegram({ id_token: data.id_token });
      if (mountedRef.current) await handleLinkResult(response);
    } catch (err: unknown) {
      if (mountedRef.current) {
        showToast({
          type: 'error',
          message: localizeServerMessage(getErrorDetail(err), t) || t('profile.accounts.linkError'),
        });
      }
    } finally {
      if (mountedRef.current) setOidcLoading(false);
    }
  };

  // Load OIDC script and init with timeout
  useEffect(() => {
    if (!isOIDC || !widgetConfig?.oidc_client_id) return;

    const scriptId = 'telegram-login-oidc-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initTelegramLogin = () => {
      if (window.Telegram?.Login) {
        window.Telegram.Login.init(
          {
            client_id: Number(widgetConfig.oidc_client_id) || widgetConfig.oidc_client_id,
            request_access: widgetConfig.request_access ? ['write'] : undefined,
            lang: document.documentElement.lang || 'en',
          },
          (data) => handleOIDCCallbackRef.current?.(data),
        );
        setScriptLoaded(true);
      }
    };

    const timeoutId = setTimeout(() => {
      if (!scriptLoaded) {
        handleScriptFailed();
      }
    }, LINK_SCRIPT_LOAD_TIMEOUT_MS);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://oauth.telegram.org/js/telegram-login.js?3';
      script.async = true;
      script.onload = () => {
        clearTimeout(timeoutId);
        initTelegramLogin();
      };
      script.onerror = () => {
        clearTimeout(timeoutId);
        handleScriptFailed();
      };
      document.head.appendChild(script);
    } else {
      clearTimeout(timeoutId);
      initTelegramLogin();
    }

    return () => clearTimeout(timeoutId);
  }, [
    isOIDC,
    widgetConfig?.oidc_client_id,
    widgetConfig?.request_access,
    scriptLoaded,
    handleScriptFailed,
  ]);

  // Ref-based callback for legacy widget (avoids re-creating iframe on every render)
  const handleWidgetAuthRef = useRef<(user: Record<string, unknown>) => void>(undefined);
  handleWidgetAuthRef.current = async (user: Record<string, unknown>) => {
    if (!mountedRef.current) return;
    try {
      const response = await authApi.linkTelegram({
        id: user.id as number,
        first_name: user.first_name as string,
        last_name: (user.last_name as string) || undefined,
        username: (user.username as string) || undefined,
        photo_url: (user.photo_url as string) || undefined,
        auth_date: user.auth_date as number,
        hash: user.hash as string,
      });
      if (mountedRef.current) await handleLinkResult(response);
    } catch (err: unknown) {
      if (mountedRef.current) {
        showToast({
          type: 'error',
          message: localizeServerMessage(getErrorDetail(err), t) || t('profile.accounts.linkError'),
        });
      }
    }
  };

  // Legacy widget effect (only when NOT OIDC) with timeout
  useEffect(() => {
    if (isOIDC || !containerRef.current || !botUsername) return;

    const container = containerRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const callbackName = '__onTelegramLinkAuth';
    (window as unknown as Record<string, unknown>)[callbackName] = (
      user: Record<string, unknown>,
    ) => {
      handleWidgetAuthRef.current?.(user);
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?23';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'small');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const timeoutId = setTimeout(() => {
      if (container && !container.querySelector('iframe')) {
        handleScriptFailed();
      }
    }, LINK_SCRIPT_LOAD_TIMEOUT_MS);

    script.onerror = () => {
      clearTimeout(timeoutId);
      handleScriptFailed();
    };

    container.appendChild(script);

    return () => {
      clearTimeout(timeoutId);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [isOIDC, botUsername, handleScriptFailed]);

  if (!botUsername && !isOIDC) {
    return null;
  }

  // Script failed to load - show unavailable message with bot link
  if (scriptFailed) {
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="text-xs text-apple-faint">{t('profile.accounts.telegramLinkUnavailable')}</p>
        <a
          href={`https://t.me/${botUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm transition-colors hover:opacity-80"
          style={{ color: '#F97315' }}
        >
          @{botUsername}
        </a>
      </div>
    );
  }

  if (isOIDC) {
    return (
      <PrimaryButton
        disabled={oidcLoading || !scriptLoaded}
        loading={oidcLoading}
        onClick={() => {
          setOidcLoading(true);
          if (window.Telegram?.Login) {
            window.Telegram.Login.open();
          } else {
            setOidcLoading(false);
          }
        }}
      >
        {t('profile.accounts.link')}
      </PrimaryButton>
    );
  }

  return <div ref={containerRef} className="flex items-center" />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-apple-elevated p-3">
          <div className="flex animate-pulse items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-apple-card" />
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-apple-card" />
                <div className="h-3 w-32 rounded bg-apple-card" />
              </div>
            </div>
            <div className="h-8 w-20 rounded-full bg-apple-card" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Connected-accounts management, restyled apple-dark for inline embedding. */
export default function ConnectedAccountsPanel() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [confirmingUnlink, setConfirmingUnlink] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [waitingExternalLink, setWaitingExternalLink] = useState(false);
  const pendingLinkProvider = useRef<string | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Email linking inline form state
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);

  const { data: emailAuthConfig } = useQuery<EmailAuthEnabled>({
    queryKey: ['email-auth-enabled'],
    queryFn: brandingApi.getEmailAuthEnabled,
    staleTime: 60000,
  });
  const isEmailAuthEnabled = emailAuthConfig?.enabled ?? true;

  const inTelegram = useIsTelegram();
  const platform = usePlatform();

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['linked-providers'],
    queryFn: () => authApi.getLinkedProviders(),
    refetchOnWindowFocus: true,
    // Poll every 5s while waiting for external browser OAuth to complete
    refetchInterval: waitingExternalLink ? 5000 : false,
  });

  // Stop polling after 90 seconds with timeout feedback
  useEffect(() => {
    if (!waitingExternalLink) return;
    const timeout = setTimeout(() => {
      setWaitingExternalLink(false);
      pendingLinkProvider.current = null;
      // Final refresh in case link succeeded during the last polling interval
      queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
      showToast({ type: 'warning', message: t('profile.accounts.pollingTimeout') });
    }, 90_000);
    return () => clearTimeout(timeout);
  }, [waitingExternalLink, showToast, t, queryClient]);

  // Detect successful external link: stop polling when the target provider becomes linked
  useEffect(() => {
    if (!waitingExternalLink || !data || !pendingLinkProvider.current) return;
    const target = data.providers.find((p) => p.provider === pendingLinkProvider.current);
    if (target?.linked) {
      setWaitingExternalLink(false);
      pendingLinkProvider.current = null;
      showToast({ type: 'success', message: t('profile.accounts.linkSuccess') });
    }
  }, [data, waitingExternalLink, showToast, t]);

  const unlinkMutation = useMutation({
    mutationFn: (provider: string) => authApi.unlinkProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
      showToast({
        type: 'success',
        message: t('profile.accounts.unlinkSuccess'),
      });
    },
    onError: () => {
      showToast({
        type: 'error',
        message: t('profile.accounts.unlinkError'),
      });
    },
    onSettled: () => {
      setConfirmingUnlink(null);
    },
  });

  const registerEmailMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.registerEmail(email, password),
    onSuccess: async (response) => {
      if (response.merge_required && response.merge_token) {
        navigate(`/merge/${response.merge_token}`, { replace: true });
        return;
      }
      setEmailSuccess(t('profile.emailSent'));
      setEmailError(null);
      setEmailValue('');
      setEmailPassword('');
      setEmailConfirmPassword('');
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      const detail = err.response?.data?.detail;
      if (detail?.includes('already registered')) {
        setEmailError(t('profile.emailAlreadyRegistered'));
      } else if (detail?.includes('already have a verified email')) {
        setEmailError(t('profile.alreadyHaveEmail'));
      } else {
        setEmailError(localizeServerMessage(detail, t) || t('common.error'));
      }
      setEmailSuccess(null);
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (!emailValue.trim() || !isValidEmail(emailValue.trim())) {
      setEmailError(t('profile.invalidEmail'));
      return;
    }
    if (!emailPassword || emailPassword.length < 8) {
      setEmailError(t('profile.passwordMinLength'));
      return;
    }
    if (emailPassword !== emailConfirmPassword) {
      setEmailError(t('profile.passwordsMismatch'));
      return;
    }
    registerEmailMutation.mutate({ email: emailValue, password: emailPassword });
  };

  const canUnlink = (provider: LinkedProvider): boolean => {
    if (!provider.linked) return false;
    if (!isOAuthProvider(provider.provider)) return false;
    const linkedCount = data?.providers.filter((p) => p.linked).length ?? 0;
    return linkedCount > 1;
  };

  const handleLinkOAuth = async (provider: string) => {
    if (linkingProvider) return;
    setLinkingProvider(provider);
    try {
      const { authorize_url, state } = await authApi.linkProviderInit(provider);
      if (!authorize_url || !state) {
        throw new Error('Invalid response from server');
      }

      // Validate redirect URL — only allow HTTPS to prevent open redirect
      let parsed: URL;
      try {
        parsed = new URL(authorize_url);
      } catch {
        throw new Error('Invalid OAuth redirect URL');
      }
      if (parsed.protocol !== 'https:') {
        throw new Error('Invalid OAuth redirect URL');
      }

      if (inTelegram) {
        // Mini App: open in external browser to avoid WebView OAuth restrictions.
        // The callback will use server-complete flow (auth via state token, no JWT).
        platform.openLink(authorize_url);
        setLinkingProvider(null);
        // Track which provider we're waiting to become linked
        pendingLinkProvider.current = provider;
        // Start polling for linked providers (external browser has no way to notify Mini App)
        setWaitingExternalLink(true);
        showToast({
          type: 'info',
          message: t('profile.accounts.continueInBrowser'),
        });
      } else {
        // Regular browser: navigate within the same tab.
        // Save state in sessionStorage for the callback page to verify.
        sessionStorage.setItem(LINK_OAUTH_STATE_KEY, state);
        sessionStorage.setItem(LINK_OAUTH_PROVIDER_KEY, provider);
        window.location.href = authorize_url;
      }
    } catch (err: unknown) {
      showToast({
        type: 'error',
        message: localizeServerMessage(getErrorDetail(err), t) || t('profile.accounts.linkError'),
      });
      setLinkingProvider(null);
    }
  };

  const handleLinkTelegram = async () => {
    if (linkingProvider) return;
    const initData = getTelegramInitData();
    if (!initData) return;

    setLinkingProvider('telegram');
    try {
      const response = await authApi.linkTelegram({ init_data: initData });
      if (response.merge_required && response.merge_token) {
        navigate(`/merge/${response.merge_token}`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
        showToast({ type: 'success', message: t('profile.accounts.linkSuccess') });
      }
    } catch (err: unknown) {
      showToast({
        type: 'error',
        message: localizeServerMessage(getErrorDetail(err), t) || t('profile.accounts.linkError'),
      });
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleLink = async (provider: string) => {
    if (provider === 'telegram') {
      await handleLinkTelegram();
    } else {
      await handleLinkOAuth(provider);
    }
  };

  const handleUnlink = (provider: string) => {
    if (confirmingUnlink === provider) {
      setConfirmingUnlink(null);
      unlinkMutation.mutate(provider);
    } else {
      setConfirmingUnlink(provider);
    }
  };

  const renderLinkButton = (provider: LinkedProvider) => {
    if (provider.provider === 'email') {
      if (!isEmailAuthEnabled) return null;
      return (
        <button
          type="button"
          onClick={() => {
            setEmailFormOpen((prev) => !prev);
            setEmailError(null);
            setEmailSuccess(null);
          }}
          className="rounded-full bg-[#F97315] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {emailFormOpen ? t('common.cancel') : t('profile.accounts.link')}
        </button>
      );
    }

    if (provider.provider === 'telegram') {
      if (inTelegram && getTelegramInitData()) {
        // Mini App: one-click button
        return (
          <PrimaryButton
            disabled={linkingProvider !== null || waitingExternalLink}
            loading={linkingProvider === 'telegram'}
            onClick={() => handleLink('telegram')}
          >
            {t('profile.accounts.link')}
          </PrimaryButton>
        );
      }
      // Browser: Telegram Login Widget
      return <TelegramLinkWidget />;
    }

    if (isOAuthProvider(provider.provider)) {
      return (
        <PrimaryButton
          disabled={linkingProvider !== null || waitingExternalLink}
          loading={linkingProvider === provider.provider}
          onClick={() => handleLink(provider.provider)}
        >
          {t('profile.accounts.link')}
        </PrimaryButton>
      );
    }

    return null;
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-xl bg-apple-elevated py-8 text-center text-apple-mute">
        {t('common.error')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-apple-mute">{t('profile.accounts.subtitle')}</p>
      <div className="space-y-2">
        {data?.providers.map((provider) => (
          <div key={provider.provider} className="rounded-xl bg-apple-elevated p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProviderIcon provider={provider.provider} />
                <div className="min-w-0">
                  <p className="font-medium text-apple-ink">
                    {t(`profile.accounts.providers.${provider.provider}`)}
                  </p>
                  {provider.identifier && (
                    <p className="truncate text-sm text-apple-mute">{provider.identifier}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {provider.linked ? (
                  <>
                    <span className="text-sm font-medium text-apple-green">
                      {t('profile.accounts.linked')}
                    </span>
                    {canUnlink(provider) && (
                      <button
                        type="button"
                        disabled={unlinkMutation.isPending}
                        onClick={() => handleUnlink(provider.provider)}
                        onBlur={() => {
                          blurTimeoutRef.current = setTimeout(() => {
                            setConfirmingUnlink((cur) => (cur === provider.provider ? null : cur));
                          }, 150);
                        }}
                        className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 ${
                          confirmingUnlink === provider.provider
                            ? 'bg-apple-red text-white'
                            : 'border border-apple-hairline text-apple-mute'
                        }`}
                      >
                        {confirmingUnlink === provider.provider
                          ? t('profile.accounts.unlinkConfirmBtn')
                          : t('profile.accounts.unlink')}
                      </button>
                    )}
                  </>
                ) : (
                  isLinkableProvider(provider.provider) && renderLinkButton(provider)
                )}
              </div>
            </div>

            {/* Inline email linking form */}
            {provider.provider === 'email' && !provider.linked && (
              <AnimatePresence>
                {emailFormOpen && (
                  <motion.div
                    key="email-link-form"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 border-t border-apple-hairline pt-3">
                      <p className="mb-3 text-sm text-apple-mute">
                        {t('profile.linkEmailDescription')}
                      </p>
                      <form onSubmit={handleEmailSubmit} className="space-y-3">
                        <div>
                          <label
                            htmlFor="email-link-input"
                            className="mb-1.5 block text-[13px] font-medium text-apple-mute"
                          >
                            Email
                          </label>
                          <input
                            id="email-link-input"
                            type="email"
                            value={emailValue}
                            onChange={(e) => setEmailValue(e.target.value)}
                            placeholder="email@example.com"
                            className={inputCls}
                            autoComplete="email"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="email-link-password"
                            className="mb-1.5 block text-[13px] font-medium text-apple-mute"
                          >
                            {t('auth.password')}
                          </label>
                          <input
                            id="email-link-password"
                            type="password"
                            value={emailPassword}
                            onChange={(e) => setEmailPassword(e.target.value)}
                            placeholder={t('profile.passwordPlaceholder')}
                            className={inputCls}
                            autoComplete="new-password"
                          />
                          <p className="mt-1 text-xs text-apple-faint">
                            {t('profile.passwordHint')}
                          </p>
                        </div>
                        <div>
                          <label
                            htmlFor="email-link-confirm"
                            className="mb-1.5 block text-[13px] font-medium text-apple-mute"
                          >
                            {t('auth.confirmPassword')}
                          </label>
                          <input
                            id="email-link-confirm"
                            type="password"
                            value={emailConfirmPassword}
                            onChange={(e) => setEmailConfirmPassword(e.target.value)}
                            placeholder={t('profile.confirmPasswordPlaceholder')}
                            className={inputCls}
                            autoComplete="new-password"
                          />
                        </div>

                        {emailError && (
                          <div className="rounded-xl border border-apple-red/30 bg-apple-red/10 p-3 text-sm text-apple-red">
                            {emailError}
                          </div>
                        )}
                        {emailSuccess && (
                          <div className="rounded-xl border border-apple-green/30 bg-apple-green/10 p-3 text-sm text-apple-green">
                            {emailSuccess}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={registerEmailMutation.isPending}
                          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#F97315] px-5 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          {registerEmailMutation.isPending && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          )}
                          {t('profile.linkEmail')}
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
