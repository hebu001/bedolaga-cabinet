// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  init: vi.fn<() => void>(),
  restoreInitData: vi.fn<() => void>(),
  mountMiniApp: vi.fn<() => void | Promise<void>>(),
  miniAppReady: vi.fn<() => void>(),
  postEvent: vi.fn<(event: 'web_app_ready') => void>(),
  mountViewport: vi.fn<() => Promise<void>>(),
  expandViewport: vi.fn(),
  mountSwipeBehavior: vi.fn(),
  disableVerticalSwipes: vi.fn(),
  mountClosingBehavior: vi.fn(),
  disableClosingConfirmation: vi.fn(),
  mountBackButton: vi.fn(),
  bindThemeParamsCssVars: vi.fn(),
  bindViewportCssVars: vi.fn(),
  requestFullscreen: vi.fn(),
  isFullscreen: vi.fn(),
}));

const app = vi.hoisted(() => ({
  render: vi.fn(),
  clearStaleSessionIfNeeded: vi.fn(),
  getTelegramInitData: vi.fn(),
  applyTelegramLanguage: vi.fn<() => Promise<void>>(),
  checkBackendOnStartup: vi.fn<() => Promise<void>>(),
  initLogoPreload: vi.fn(),
  installEncodingSurrogateGuard: vi.fn(),
  installTelegramReady: vi.fn(),
  cleanups: [] as Array<() => void>,
}));

vi.mock('@telegram-apps/sdk-react', () => sdk);
vi.mock('react-dom/client', () => ({
  default: { createRoot: () => ({ render: app.render }) },
}));
vi.mock('./providers/SessionQueryProvider', () => ({ SessionQueryProvider: () => null }));
vi.mock('./providers/I18nBootstrap', () => ({ I18nBootstrap: () => null }));
vi.mock('./AppWithNavigator', () => ({ AppWithNavigator: () => null }));
vi.mock('./components/ErrorBoundary', () => ({ ErrorBoundary: () => null }));
vi.mock('./utils/token', () => ({ clearStaleSessionIfNeeded: app.clearStaleSessionIfNeeded }));
vi.mock('./utils/telegramInitData', () => ({ getTelegramInitData: app.getTelegramInitData }));
vi.mock('./i18n', () => ({ applyTelegramLanguage: app.applyTelegramLanguage }));
vi.mock('./api/health', () => ({ checkBackendOnStartup: app.checkBackendOnStartup }));
vi.mock('./api/branding', () => ({ initLogoPreload: app.initLogoPreload }));
vi.mock('./hooks/useTelegramSDK', () => ({
  getCachedFullscreenEnabled: () => false,
  isTelegramMobile: () => true,
}));
vi.mock('./utils/installEncodingSurrogateGuard', () => ({
  installEncodingSurrogateGuard: app.installEncodingSurrogateGuard,
}));
vi.mock('./utils/telegramReady', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/telegramReady')>();
  return {
    installTelegramReady: () => {
      app.installTelegramReady();
      // Exercise the real helper, but collect its teardown because resetting
      // Vitest's module cache does not perform Vite's HMR disposal.
      const cleanup = actual.installTelegramReady();
      app.cleanups.push(cleanup);
      return cleanup;
    },
  };
});

function clearReadyListeners(): void {
  for (const cleanup of app.cleanups.splice(0)) cleanup();
}

async function startApp(): Promise<void> {
  await import('./main');
  // Drain the optional SDK mount handlers, including rejected promises.
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="root"></div>';
  window.history.replaceState({}, '', '/#tgWebAppVersion=8.0');
  Reflect.deleteProperty(window, '__tg_sdk_initialized');
  Reflect.deleteProperty(window, 'TelegramWebviewProxy');
  Reflect.deleteProperty(window, 'Telegram');
  window.localStorage.clear();
  sdk.mountViewport.mockResolvedValue(undefined);
  app.getTelegramInitData.mockReturnValue('auth_date=123&hash=test');
  app.applyTelegramLanguage.mockResolvedValue(undefined);
  app.checkBackendOnStartup.mockResolvedValue(undefined);
});

afterEach(() => {
  clearReadyListeners();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, '__tg_sdk_initialized');
  Reflect.deleteProperty(window, 'TelegramWebviewProxy');
  Reflect.deleteProperty(window, 'Telegram');
  window.localStorage.clear();
});

describe('Telegram startup', () => {
  it('sends ready and renders without waiting for optional mounts', async () => {
    sdk.mountMiniApp.mockReturnValue(new Promise(() => {}));
    sdk.mountViewport.mockReturnValue(new Promise(() => {}));

    await startApp();

    expect(sdk.init).toHaveBeenCalledExactlyOnceWith();
    expect(sdk.restoreInitData).toHaveBeenCalledExactlyOnceWith();
    expect(Reflect.get(window, '__tg_sdk_initialized')).toBe(true);
    expect(app.clearStaleSessionIfNeeded).toHaveBeenCalledExactlyOnceWith(
      'auth_date=123&hash=test',
    );
    expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    expect(app.render).toHaveBeenCalledTimes(1);
    expect(sdk.bindViewportCssVars).not.toHaveBeenCalled();
  });

  it('sends ready after init fails without clearing the existing auth session', async () => {
    window.localStorage.setItem('access_token', 'existing-test-token');
    sdk.init.mockImplementation(() => {
      throw new Error('LaunchParamsRetrieveError');
    });

    await startApp();

    expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    expect(app.render).toHaveBeenCalledTimes(1);
    expect(sdk.restoreInitData).not.toHaveBeenCalled();
    expect(app.clearStaleSessionIfNeeded).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('access_token')).toBe('existing-test-token');
    expect(Reflect.get(window, '__tg_sdk_initialized')).not.toBe(true);
  });

  it('retries a failed init on the next execution and marks only the successful attempt', async () => {
    sdk.init.mockImplementationOnce(() => {
      throw new Error('First launch parameters unavailable');
    });

    await startApp();
    expect(Reflect.get(window, '__tg_sdk_initialized')).not.toBe(true);
    expect(app.clearStaleSessionIfNeeded).not.toHaveBeenCalled();

    clearReadyListeners();
    vi.resetModules();
    await startApp();

    expect(sdk.init).toHaveBeenCalledTimes(2);
    expect(Reflect.get(window, '__tg_sdk_initialized')).toBe(true);
    expect(sdk.restoreInitData).toHaveBeenCalledTimes(1);
    expect(app.clearStaleSessionIfNeeded).toHaveBeenCalledTimes(1);
    expect(sdk.miniAppReady).toHaveBeenCalledTimes(2);
  });

  it('sends ready when restoring init data fails', async () => {
    sdk.restoreInitData.mockImplementation(() => {
      throw new Error('Init data restoration unavailable');
    });

    await startApp();

    expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    expect(app.clearStaleSessionIfNeeded).not.toHaveBeenCalled();
    expect(Reflect.get(window, '__tg_sdk_initialized')).toBe(true);
    expect(app.render).toHaveBeenCalledTimes(1);
  });

  it.each(['sync', 'async'] as const)('survives a %s mini-app mount failure', async (mode) => {
    sdk.mountMiniApp.mockImplementation(() => {
      if (mode === 'sync') throw new Error('Mini-app mount failed');
      return Promise.reject(new Error('Mini-app mount rejected'));
    });

    await startApp();

    expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    expect(sdk.mountViewport).toHaveBeenCalledTimes(1);
    expect(app.render).toHaveBeenCalledTimes(1);
  });

  it.each(['sync', 'async'] as const)('survives a %s viewport mount failure', async (mode) => {
    sdk.mountViewport.mockImplementation(() => {
      if (mode === 'sync') throw new Error('Viewport unavailable');
      return Promise.reject(new Error('Viewport timeout'));
    });

    await startApp();

    expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    expect(sdk.bindViewportCssVars).not.toHaveBeenCalled();
    expect(app.render).toHaveBeenCalledTimes(1);
  });

  it('survives an error inside the viewport completion handler', async () => {
    sdk.bindViewportCssVars.mockImplementation(() => {
      throw new Error('CSS variables already bound');
    });

    await startApp();

    expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    expect(sdk.bindViewportCssVars).toHaveBeenCalledTimes(1);
    expect(app.render).toHaveBeenCalledTimes(1);
  });

  it('notifies a retained native WebView even when its SDK is already initialized', async () => {
    window.history.replaceState({}, '', '/balance');
    Reflect.set(window, '__tg_sdk_initialized', true);
    Object.defineProperty(window, 'TelegramWebviewProxy', {
      configurable: true,
      value: { postEvent: vi.fn() },
    });

    await startApp();

    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.restoreInitData).not.toHaveBeenCalled();
    expect(app.clearStaleSessionIfNeeded).not.toHaveBeenCalled();
    expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    expect(app.render).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(sdk.miniAppReady).toHaveBeenCalledTimes(2);
  });

  it.each(['/?tgWebAppVersion=8.0', '/#tgWebAppVersion=8.0'])(
    'recognizes Telegram launch parameters at %s without a native proxy',
    async (url) => {
      window.history.replaceState({}, '', url);

      await startApp();

      expect(sdk.init).toHaveBeenCalledExactlyOnceWith();
      expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    },
  );

  it('uses the ready fallback after SDK initialization and guarded ready both fail', async () => {
    sdk.init.mockImplementation(() => {
      throw new Error('SDK initialization failed');
    });
    sdk.miniAppReady.mockImplementation(() => {
      throw new Error('SDK not initialized');
    });

    await startApp();

    expect(sdk.postEvent).toHaveBeenCalledExactlyOnceWith('web_app_ready');
    expect(app.render).toHaveBeenCalledTimes(1);
  });
});

describe('ordinary browser startup', () => {
  it('renders and clears stale browser auth without signaling ready or adding resume listeners', async () => {
    window.history.replaceState({}, '', '/login');
    const windowAddListener = vi.spyOn(window, 'addEventListener');
    const documentAddListener = vi.spyOn(document, 'addEventListener');

    await startApp();
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(sdk.init).not.toHaveBeenCalled();
    expect(app.installTelegramReady).not.toHaveBeenCalled();
    expect(sdk.miniAppReady).not.toHaveBeenCalled();
    expect(sdk.postEvent).not.toHaveBeenCalled();
    expect(windowAddListener.mock.calls.filter(([event]) => event === 'pageshow')).toEqual([]);
    expect(
      documentAddListener.mock.calls.filter(([event]) => event === 'visibilitychange'),
    ).toEqual([]);
    expect(app.clearStaleSessionIfNeeded).toHaveBeenCalledExactlyOnceWith(null);
    expect(app.render).toHaveBeenCalledTimes(1);
  });
});
