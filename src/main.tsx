import './styles/legacyOrangeButtons.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SessionQueryProvider } from './providers/SessionQueryProvider';
import { I18nBootstrap } from './providers/I18nBootstrap';
import {
  init,
  restoreInitData,
  mountMiniApp,
  mountViewport,
  expandViewport,
  mountSwipeBehavior,
  disableVerticalSwipes,
  mountClosingBehavior,
  disableClosingConfirmation,
  mountBackButton,
  bindThemeParamsCssVars,
  bindViewportCssVars,
  requestFullscreen,
  isFullscreen,
} from '@telegram-apps/sdk-react';
import { clearStaleSessionIfNeeded } from './utils/token';
import { AppWithNavigator } from './AppWithNavigator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initLogoPreload } from './api/branding';
import { getCachedFullscreenEnabled, isTelegramMobile } from './hooks/useTelegramSDK';
import { getTelegramInitData } from './utils/telegramInitData';
import { applyTelegramLanguage } from './i18n';
import { installEncodingSurrogateGuard } from './utils/installEncodingSurrogateGuard';
import { checkBackendOnStartup } from './api/health';
import { installTelegramReady } from './utils/telegramReady';
import './styles/globals.css';

installEncodingSurrogateGuard();
const objectHasOwnProperty = Object.prototype.hasOwnProperty;

// Polyfill Object.hasOwn for older iOS/Android WebViews (Safari < 15.4, old Chrome).
// @telegram-apps/sdk v3 depends on valibot which uses Object.hasOwn internally.
// Without this, init() throws LaunchParamsRetrieveError on affected devices.
// See: https://github.com/Telegram-Mini-Apps/tma.js/issues/683
if (typeof (Object as { hasOwn?: unknown }).hasOwn !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Object as any).hasOwn = (obj: object, prop: PropertyKey): boolean =>
    objectHasOwnProperty.call(obj, prop);
}

// Only initialize Telegram SDK when running inside Telegram
const isTelegramEnv =
  !!(window as unknown as Record<string, unknown>).TelegramWebviewProxy ||
  location.hash.includes('tgWebApp') ||
  location.search.includes('tgWebApp');

const HMR_KEY = '__tg_sdk_initialized';
const alreadyInitialized = (window as unknown as Record<string, unknown>)[HMR_KEY] === true;

if (isTelegramEnv && !alreadyInitialized) {
  try {
    init();
    (window as unknown as Record<string, unknown>)[HMR_KEY] = true;
    restoreInitData();

    clearStaleSessionIfNeeded(getTelegramInitData());
    void applyTelegramLanguage().catch(() => {});

    // Each mount in its own try/catch so one failure doesn't block others.
    // mountMiniApp() internally mounts themeParams in SDK v3,
    // so we don't call mountThemeParams() separately to avoid ConcurrentCallError.
    try {
      void Promise.resolve(mountMiniApp()).catch(() => {});
    } catch {}
    try {
      bindThemeParamsCssVars();
    } catch {}
    try {
      mountSwipeBehavior();
      disableVerticalSwipes();
    } catch {}
    try {
      mountClosingBehavior();
      disableClosingConfirmation();
    } catch {}
    try {
      mountBackButton();
    } catch {}
    // Viewport must be mounted before requesting fullscreen
    mountViewport()
      .then(() => {
        bindViewportCssVars();
        expandViewport();

        // Auto-enter fullscreen if enabled in settings (mobile only)
        if (getCachedFullscreenEnabled() && isTelegramMobile()) {
          if (!isFullscreen()) {
            requestFullscreen();
          }
        }
      })
      .catch(() => {});
  } catch {}
} else if (!isTelegramEnv) {
  // Outside Telegram — still clear stale session tokens if any
  clearStaleSessionIfNeeded(null);
}

if (isTelegramEnv) {
  // Native loading must not depend on SDK restoration or optional UI mounts.
  // A retained WebView also needs this even when the SDK is already initialized.
  const disposeTelegramReady = installTelegramReady();
  import.meta.hot?.dispose(disposeTelegramReady);
}

void checkBackendOnStartup();

if ('requestIdleCallback' in window) {
  requestIdleCallback(() => initLogoPreload());
} else {
  setTimeout(initLogoPreload, 100);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary level="app">
      <I18nBootstrap>
        <SessionQueryProvider>
          <AppWithNavigator />
        </SessionQueryProvider>
      </I18nBootstrap>
    </ErrorBoundary>
  </React.StrictMode>,
);
