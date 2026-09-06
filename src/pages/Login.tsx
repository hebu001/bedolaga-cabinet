import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './Login.css';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { useShallow } from 'zustand/shallow';
import { authApi } from '../api/auth';
import { isValidEmail } from '../utils/validation';
import { localizeServerMessage } from '../utils/serverMessages';
import {
  brandingApi,
  getCachedBranding,
  setCachedBranding,
  type BrandingInfo,
  type EmailAuthEnabled,
} from '../api/branding';
import { getAndClearReturnUrl, tokenStorage } from '../utils/token';
import { isInTelegramWebApp, getTelegramInitData, useTelegramSDK } from '../hooks/useTelegramSDK';
import { closeMiniApp } from '@telegram-apps/sdk-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import TelegramLoginButton from '../components/TelegramLoginButton';
import OAuthProviderIcon from '../components/OAuthProviderIcon';
import { saveOAuthState } from '../utils/oauth';
import { getPendingReferralCode } from '../utils/referral';
import {
  clearTelegramAuthRecoveryAttempt,
  isInvalidTelegramInitDataError,
  tryTelegramAuthRelaunch,
} from '../utils/telegramAuthRecovery';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthenticated,
    isLoading: isAuthInitializing,
    loginWithTelegram,
    loginWithEmail,
    registerWithEmail,
  } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      loginWithTelegram: state.loginWithTelegram,
      loginWithEmail: state.loginWithEmail,
      registerWithEmail: state.registerWithEmail,
    })),
  );

  // Get referral code from localStorage (captured from ?ref= param at module level in auth store)
  const referralCode = getPendingReferralCode() || '';

  const [authMode, setAuthMode] = useState<'login' | 'register'>(() =>
    referralCode ? 'register' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [showTelegram, setShowTelegram] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Telegram safe area insets
  const { safeAreaInset, contentSafeAreaInset } = useTelegramSDK();
  const safeTop = Math.max(safeAreaInset.top, contentSafeAreaInset.top);
  const safeBottom = Math.max(safeAreaInset.bottom, contentSafeAreaInset.bottom);

  // Получаем URL для возврата после авторизации
  const getReturnUrl = useCallback(() => {
    // Сначала проверяем state от React Router
    const stateFrom = (location.state as { from?: string })?.from;
    if (stateFrom && stateFrom !== '/login') {
      return stateFrom;
    }
    // Затем проверяем сохранённый URL в sessionStorage (от safeRedirectToLogin)
    const savedUrl = getAndClearReturnUrl();
    if (savedUrl && savedUrl !== '/login') {
      return savedUrl;
    }
    // По умолчанию на главную
    return '/';
  }, [location.state]);

  // Fetch branding with unified cache
  const cachedBranding = useMemo(() => getCachedBranding(), []);

  const { data: branding } = useQuery<BrandingInfo>({
    queryKey: ['branding'],
    queryFn: async () => {
      const data = await brandingApi.getBranding();
      setCachedBranding(data);
      return data;
    },
    staleTime: 60000,
    initialData: cachedBranding ?? undefined,
    initialDataUpdatedAt: 0,
  });

  // Check if email auth is enabled
  const { data: emailAuthConfig } = useQuery<EmailAuthEnabled>({
    queryKey: ['email-auth-enabled'],
    queryFn: brandingApi.getEmailAuthEnabled,
    staleTime: 60000,
  });
  const isEmailAuthEnabled = emailAuthConfig?.enabled ?? true;

  // Fetch enabled OAuth providers
  const { data: oauthData } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: authApi.getOAuthProviders,
    staleTime: 60000,
  });
  const oauthProviders = Array.isArray(oauthData?.providers) ? oauthData.providers : [];

  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleOAuthLogin = async (provider: string) => {
    setError('');
    setOauthLoading(provider);
    try {
      const { authorize_url, state } = await authApi.getOAuthAuthorizeUrl(provider);

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

      saveOAuthState(state, provider);
      window.location.href = authorize_url;
    } catch {
      setError(t('auth.oauthError', 'Authorization was denied or failed'));
      setOauthLoading(null);
    }
  };

  const appName = branding ? branding.name : import.meta.env.VITE_APP_NAME || 'VPN';

  // Set document title
  useEffect(() => {
    document.title = appName || 'VPN';
  }, [appName]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getReturnUrl(), { replace: true });
    }
  }, [isAuthenticated, navigate, getReturnUrl]);

  // Try Telegram WebApp authentication on mount. Repeating the same request on
  // 401 is useless because Telegram can reopen a WebView with identical cached
  // initData; use a unique startapp relaunch once to obtain a fresh context.
  // Wait for auth store initialization to complete to avoid race conditions
  // with stale tokens triggering interceptor refresh/redirect loops
  useEffect(() => {
    // Don't attempt Telegram auth until store initialization is done
    if (isAuthInitializing || isAuthenticated) return;

    const tryTelegramAuth = async () => {
      const initData = getTelegramInitData();
      if (!isInTelegramWebApp() || !initData) return;

      setIsTelegramWebApp(true);
      setIsLoading(true);

      try {
        await loginWithTelegram(initData);
        clearTelegramAuthRecoveryAttempt();
        navigate(getReturnUrl(), { replace: true });
        return;
      } catch (err) {
        const error = err as { response?: { status?: number; data?: { detail?: string } } };
        const status = error.response?.status;
        const detail = error.response?.data?.detail;
        if (import.meta.env.DEV) {
          console.warn('Telegram auth failed:', status, detail);
        }

        if (isInvalidTelegramInitDataError(err) && (await tryTelegramAuthRelaunch())) {
          // Normally Telegram replaces this WebView immediately. If a client
          // ignores openTelegramLink, restore the compact manual retry UI.
          window.setTimeout(() => {
            setError(localizeServerMessage(detail, t) || t('auth.telegramRequired'));
            setIsLoading(false);
          }, 5000);
          return;
        }

        // Show backend error detail (localized) if available, otherwise generic message
        setError(localizeServerMessage(detail, t) || t('auth.telegramRequired'));
      }

      setIsLoading(false);
    };

    tryTelegramAuth();
  }, [isAuthInitializing, isAuthenticated, loginWithTelegram, navigate, t, getReturnUrl]);

  const handleRetryTelegramAuth = () => {
    // Clear ALL cached auth state to prevent stale token/initData loops
    tokenStorage.clearTokens();
    sessionStorage.removeItem('tapps/launchParams');
    sessionStorage.removeItem('telegram_init_data');
    localStorage.removeItem('cabinet-auth');
    localStorage.removeItem('tg_user_id');

    try {
      // Close miniapp — Telegram will provide fresh initData on reopen
      closeMiniApp();
    } catch {
      // If closeMiniApp fails, force a clean page reload
      window.location.reload();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация email
    if (!email.trim() || !isValidEmail(email.trim())) {
      setError(t('auth.invalidEmail', 'Please enter a valid email address'));
      return;
    }

    if (authMode === 'register') {
      // Валидация для регистрации
      if (password !== confirmPassword) {
        setError(t('auth.passwordMismatch', 'Passwords do not match'));
        return;
      }
      if (password.length < 8) {
        setError(t('auth.passwordTooShort', 'Password must be at least 8 characters'));
        return;
      }
    }

    setIsLoading(true);

    try {
      if (authMode === 'login') {
        await loginWithEmail(email.trim(), password);
        navigate(getReturnUrl(), { replace: true });
      } else {
        const result = await registerWithEmail(
          email.trim(),
          password,
          firstName || undefined,
          referralCode || undefined,
        );
        // Show "check your email" screen
        setRegisteredEmail(result.email);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 400 && detail?.includes('already registered')) {
        setError(t('auth.emailAlreadyRegistered', 'This email is already registered'));
      } else if (status === 401 || status === 403) {
        if (detail?.includes('verify your email')) {
          setError(t('auth.emailNotVerified', 'Please verify your email first'));
        } else {
          setError(t('auth.invalidCredentials', 'Invalid email or password'));
        }
      } else if (status === 429) {
        setError(t('auth.tooManyAttempts', 'Too many attempts. Please try again later'));
      } else {
        setError(localizeServerMessage(detail, t) || t('common.error'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError('');

    if (!forgotPasswordEmail.trim() || !isValidEmail(forgotPasswordEmail.trim())) {
      setForgotPasswordError(t('auth.invalidEmail', 'Please enter a valid email address'));
      return;
    }

    setForgotPasswordLoading(true);
    try {
      await authApi.forgotPassword(forgotPasswordEmail.trim());
      setForgotPasswordSent(true);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail = error.response?.data?.detail;
      setForgotPasswordError(localizeServerMessage(detail, t) || t('common.error'));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setForgotPasswordSent(false);
    setForgotPasswordError('');
  };

  const busy = isLoading || oauthLoading !== null;
  const spinner = <span className="login-v3-spinner" aria-hidden="true" />;

  return (
    <main
      className="login-v3"
      style={
        {
          '--login-safe-top': `${safeTop}px`,
          '--login-safe-bottom': `${safeBottom}px`,
        } as CSSProperties
      }
    >
      <div className="login-v3-language">
        <LanguageSwitcher />
      </div>
      <section className="login-v3-content" aria-labelledby="login-title">
        <img className="login-v3-logo" src="/logo-main.png" alt={appName} />
        <header className="login-v3-heading">
          <h1 id="login-title">
            {t('auth.openFormTitle', 'Your account.')}
            <br />
            {t('auth.openFormTitleSecond', 'Everything at hand.')}
          </h1>
          <p>
            {t(
              'auth.openFormDescription',
              'Your subscription, devices and balance — all in your account.',
            )}
          </p>
        </header>

        {referralCode && isEmailAuthEnabled && (
          <p className="login-v3-referral">{t('auth.referralInvite')}</p>
        )}
        {error && (
          <p className="login-v3-error" role="alert">
            {error}
          </p>
        )}

        {registeredEmail ? (
          <div className="login-v3-confirmation">
            <div className="login-v3-dialog-icon">
              <LoginIcon name="mail" />
            </div>
            <h2>{t('auth.checkEmail', 'Check your email')}</h2>
            <p>{t('auth.verificationSent', 'We sent a verification link to:')}</p>
            <p className="login-v3-email-address">{registeredEmail}</p>
            <p>
              {t(
                'auth.clickLinkToVerify',
                'Click the link in the email to verify your account and log in.',
              )}
            </p>
            <button
              type="button"
              className="login-v3-button login-v3-primary"
              onClick={() => {
                setRegisteredEmail(null);
                setAuthMode('login');
              }}
            >
              {t('auth.backToLogin', 'Back to login')}
            </button>
          </div>
        ) : (
          <>
            {isEmailAuthEnabled && (
              <>
                <div
                  className="login-v3-segment"
                  role="group"
                  aria-label={t('auth.loginWithEmail')}
                >
                  <button
                    type="button"
                    aria-pressed={authMode === 'login'}
                    disabled={busy}
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                    }}
                  >
                    {t('auth.login')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={authMode === 'register'}
                    disabled={busy}
                    onClick={() => {
                      setAuthMode('register');
                      setError('');
                    }}
                  >
                    {t('auth.register')}
                  </button>
                </div>
                <form id="email-auth-form" className="login-v3-form" onSubmit={handleEmailSubmit}>
                  <div className="login-v3-fields">
                    {authMode === 'register' && (
                      <div className="login-v3-field">
                        <label htmlFor="firstName">{t('auth.firstName', 'First Name')}</label>
                        <input
                          id="firstName"
                          name="firstName"
                          autoComplete="given-name"
                          placeholder={t('auth.firstNamePlaceholder', 'Your name (optional)')}
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                    )}
                    <div className="login-v3-field">
                      <label htmlFor="email">{t('auth.email')}</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="login-v3-field">
                      <label htmlFor="password">{t('auth.password')}</label>
                      <div className="login-v3-password">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                          required
                          minLength={authMode === 'register' ? 8 : undefined}
                          placeholder={t(
                            authMode === 'login' ? 'auth.enterPassword' : 'auth.createPassword',
                            authMode === 'login' ? 'Enter your password' : 'Create a password',
                          )}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={busy}
                        />
                        <button
                          className="login-v3-eye"
                          type="button"
                          aria-label={t(
                            showPassword ? 'auth.hidePassword' : 'auth.showPassword',
                            showPassword ? 'Hide password' : 'Show password',
                          )}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <LoginIcon name={showPassword ? 'eye-off' : 'eye'} />
                        </button>
                      </div>
                    </div>
                    {authMode === 'register' && (
                      <div className="login-v3-field">
                        <label htmlFor="confirmPassword">
                          {t('auth.confirmPassword', 'Confirm Password')}
                        </label>
                        <div className="login-v3-password">
                          <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            minLength={8}
                            placeholder={t('auth.confirmPassword', 'Confirm Password')}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={busy}
                          />
                          <button
                            className="login-v3-eye"
                            type="button"
                            aria-label={t(
                              showConfirmPassword ? 'auth.hidePassword' : 'auth.showPassword',
                              showConfirmPassword ? 'Hide password' : 'Show password',
                            )}
                            aria-pressed={showConfirmPassword}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            <LoginIcon name={showConfirmPassword ? 'eye-off' : 'eye'} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="login-v3-button login-v3-primary"
                  >
                    {isLoading ? (
                      <>
                        {spinner}
                        {t('common.loading')}
                      </>
                    ) : authMode === 'login' ? (
                      t('auth.enterAccount', 'Sign in')
                    ) : (
                      t('auth.createAccount', 'Create account')
                    )}
                  </button>
                </form>
                {authMode === 'register' ? (
                  <p className="login-v3-note">
                    {t(
                      'auth.verificationEmailNotice',
                      'After registration, a verification email will be sent to your address',
                    )}
                  </p>
                ) : (
                  <Dialog.Root
                    open={showForgotPassword}
                    onOpenChange={(open) => {
                      if (open) {
                        setForgotPasswordEmail(email);
                        setShowForgotPassword(true);
                      } else closeForgotPasswordModal();
                    }}
                  >
                    <Dialog.Trigger asChild>
                      <button type="button" className="login-v3-link" disabled={busy}>
                        {t('auth.forgotPassword', 'Forgot password?')}
                      </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                      <Dialog.Overlay className="login-v3-overlay" />
                      <Dialog.Content className="login-v3-dialog">
                        <Dialog.Close
                          className="login-v3-close"
                          aria-label={t('common.close', 'Close')}
                        >
                          <LoginIcon name="close" />
                        </Dialog.Close>
                        <div className="login-v3-dialog-icon">
                          <LoginIcon name={forgotPasswordSent ? 'mail' : 'lock'} />
                        </div>
                        <Dialog.Title>
                          {t(
                            forgotPasswordSent ? 'auth.checkEmail' : 'auth.forgotPassword',
                            forgotPasswordSent ? 'Check your email' : 'Forgot password?',
                          )}
                        </Dialog.Title>
                        <Dialog.Description>
                          {forgotPasswordSent
                            ? t(
                                'auth.passwordResetSent',
                                'If an account exists with this email, we sent password reset instructions.',
                              )
                            : t(
                                'auth.forgotPasswordHint',
                                'Enter your email and we will send you instructions to reset your password.',
                              )}
                        </Dialog.Description>
                        {forgotPasswordSent ? (
                          <Dialog.Close className="login-v3-button login-v3-primary">
                            {t('common.back', 'Back')}
                          </Dialog.Close>
                        ) : (
                          <form onSubmit={handleForgotPassword}>
                            <div className="login-v3-fields">
                              <div className="login-v3-field">
                                <label htmlFor="forgotEmail">{t('auth.email')}</label>
                                <input
                                  id="forgotEmail"
                                  name="email"
                                  type="email"
                                  autoComplete="email"
                                  required
                                  autoCapitalize="none"
                                  placeholder="you@example.com"
                                  value={forgotPasswordEmail}
                                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                  disabled={forgotPasswordLoading}
                                />
                              </div>
                            </div>
                            {forgotPasswordError && (
                              <p className="login-v3-error" role="alert">
                                {forgotPasswordError}
                              </p>
                            )}
                            <button
                              type="submit"
                              disabled={forgotPasswordLoading}
                              className="login-v3-button login-v3-primary"
                            >
                              {forgotPasswordLoading ? (
                                <>
                                  {spinner}
                                  {t('common.loading')}
                                </>
                              ) : (
                                t('auth.sendResetLink', 'Send reset link')
                              )}
                            </button>
                          </form>
                        )}
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                )}
                <div className="login-v3-divider">{t('auth.or', 'or')}</div>
              </>
            )}

            {isLoading && isTelegramWebApp ? (
              <p className="login-v3-status" role="status">
                {spinner}
                {t('auth.authenticating')}
              </p>
            ) : isTelegramWebApp && error ? (
              <div className="login-v3-retry">
                <button
                  type="button"
                  className="login-v3-button login-v3-telegram"
                  onClick={handleRetryTelegramAuth}
                >
                  {t('auth.tryAgain')}
                </button>
                <p className="login-v3-note">
                  {t(
                    'auth.telegramReopenHint',
                    'If the problem persists, close and reopen the app',
                  )}
                </p>
              </div>
            ) : (
              <Dialog.Root open={showTelegram} onOpenChange={setShowTelegram}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="login-v3-button login-v3-telegram"
                    disabled={busy}
                  >
                    <LoginIcon name="telegram" />
                    {t('auth.loginWithTelegram')}
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="login-v3-overlay" />
                  <Dialog.Content className="login-v3-dialog login-v3-telegram-dialog">
                    <Dialog.Close
                      className="login-v3-close"
                      aria-label={t('common.close', 'Close')}
                    >
                      <LoginIcon name="close" />
                    </Dialog.Close>
                    <div className="login-v3-dialog-icon login-v3-telegram">
                      <LoginIcon name="telegram" />
                    </div>
                    <Dialog.Title>{t('auth.loginWithTelegram')}</Dialog.Title>
                    <Dialog.Description>
                      {t(
                        'auth.telegramContinue',
                        'Confirm sign-in in Telegram to open your account.',
                      )}
                    </Dialog.Description>
                    <TelegramLoginButton referralCode={referralCode || undefined} />
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            )}
            {oauthProviders.length > 0 && (
              <div
                className="login-v3-social"
                role="group"
                aria-label={t('auth.otherSignInMethods', 'Other sign-in methods')}
              >
                {oauthProviders.map((provider) => (
                  <button
                    key={provider.name}
                    type="button"
                    disabled={busy}
                    onClick={() => handleOAuthLogin(provider.name)}
                    aria-label={t('auth.signInWithProvider', {
                      provider: provider.display_name,
                      defaultValue: 'Sign in with {{provider}}',
                    })}
                    className="login-v3-social-button"
                  >
                    {oauthLoading === provider.name ? (
                      spinner
                    ) : (
                      <OAuthProviderIcon
                        provider={provider.name}
                        className="login-v3-provider-icon"
                      />
                    )}
                    <span>{provider.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <footer className="login-v3-footer">
          <LoginIcon name="lock" />
          {t('auth.accountFooter', { name: 'Evo', defaultValue: '{{name}} account' })}
        </footer>
      </section>
    </main>
  );
}

type LoginIconName = 'telegram' | 'mail' | 'lock' | 'eye' | 'eye-off' | 'close';
function LoginIcon({ name }: { name: LoginIconName }) {
  const paths: Record<LoginIconName, React.ReactNode> = {
    telegram: <path d="m21 3-4 18-6-5-4 3 1-6 10-7-12 6-4-2 19-7Z" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    'eye-off': (
      <>
        <path d="m3 3 18 18M10.6 5.1 12 5c7 0 10 7 10 7a18 18 0 0 1-3 4M6 6a21 21 0 0 0-4 6s3 7 10 7c1.6 0 3-.4 4.2-1" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
