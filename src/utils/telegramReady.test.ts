// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  miniAppReady: vi.fn<() => void>(),
  postEvent: vi.fn<(event: 'web_app_ready') => void>(),
}));

vi.mock('@telegram-apps/sdk-react', () => sdk);

import { installTelegramReady } from './telegramReady';

let cleanups: Array<() => void> = [];

function install(): () => void {
  const cleanup = installTelegramReady();
  cleanups.push(cleanup);
  return cleanup;
}

function setWebApp(webApp: { ready: () => void }): void {
  Object.defineProperty(window, 'Telegram', {
    configurable: true,
    value: { WebApp: webApp },
  });
}

function setVisibility(value: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
}

beforeEach(() => {
  vi.resetAllMocks();
  cleanups = [];
  Reflect.deleteProperty(window, 'Telegram');
  Reflect.deleteProperty(window, 'TelegramWebviewProxy');
  setVisibility('visible');
  window.history.replaceState({}, '', '/');
  window.sessionStorage.clear();
});

afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  Reflect.deleteProperty(window, 'Telegram');
  Reflect.deleteProperty(window, 'TelegramWebviewProxy');
  Reflect.deleteProperty(document, 'visibilityState');
  vi.restoreAllMocks();
});

describe('installTelegramReady', () => {
  it('notifies immediately through the SDK and stops after success', () => {
    const ready = vi.fn();
    setWebApp({ ready });

    install();

    expect(sdk.miniAppReady).toHaveBeenCalledExactlyOnceWith();
    expect(ready).not.toHaveBeenCalled();
    expect(sdk.postEvent).not.toHaveBeenCalled();
  });

  it('uses the official bridge with its receiver when the SDK is unavailable', () => {
    sdk.miniAppReady.mockImplementation(() => {
      throw new Error('SDK not initialized');
    });
    const ready = vi.fn();
    const webApp = { ready };
    setWebApp(webApp);

    install();

    expect(ready).toHaveBeenCalledExactlyOnceWith();
    expect(ready.mock.contexts[0]).toBe(webApp);
    expect(sdk.postEvent).not.toHaveBeenCalled();
  });

  it('uses the raw ready event when the SDK fails and no official bridge is present', () => {
    sdk.miniAppReady.mockImplementation(() => {
      throw new Error('Launch parameters unavailable');
    });

    install();

    expect(sdk.postEvent).toHaveBeenCalledExactlyOnceWith('web_app_ready');
  });

  it('tries SDK, official bridge, and raw transport in that order', () => {
    const order: string[] = [];
    sdk.miniAppReady.mockImplementation(() => {
      order.push('sdk');
      throw new Error('SDK unavailable');
    });
    setWebApp({
      ready: () => {
        order.push('official');
        throw new Error('Official bridge unavailable');
      },
    });
    sdk.postEvent.mockImplementation(() => {
      order.push('raw');
    });

    install();

    expect(order).toEqual(['sdk', 'official', 'raw']);
    expect(sdk.postEvent).toHaveBeenCalledExactlyOnceWith('web_app_ready');
  });

  it('survives a throwing official bridge property getter', () => {
    sdk.miniAppReady.mockImplementation(() => {
      throw new Error('SDK unavailable');
    });
    Object.defineProperty(window, 'Telegram', {
      configurable: true,
      get: () => {
        throw new Error('Bridge access unavailable');
      },
    });

    expect(install).not.toThrow();
    expect(sdk.postEvent).toHaveBeenCalledExactlyOnceWith('web_app_ready');
  });

  it('does not throw when every transport fails, including on resume', () => {
    const fail = () => {
      throw new Error('Transport unavailable');
    };
    sdk.miniAppReady.mockImplementation(fail);
    setWebApp({ ready: fail });
    sdk.postEvent.mockImplementation(fail);

    expect(install).not.toThrow();
    expect(() => window.dispatchEvent(new Event('pageshow'))).not.toThrow();
    expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow();
    expect(sdk.postEvent).toHaveBeenCalledTimes(3);
  });

  it('resends ready for a restored page', () => {
    install();

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    expect(sdk.miniAppReady).toHaveBeenCalledTimes(2);
  });

  it('resends on visible transitions but stays quiet while hidden', () => {
    install();
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sdk.miniAppReady).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sdk.miniAppReady).toHaveBeenCalledTimes(2);
  });

  it('removes both resume listeners and allows repeated cleanup', () => {
    const cleanup = install();

    cleanup();
    cleanup();
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(sdk.miniAppReady).toHaveBeenCalledTimes(1);
  });
});

describe('installed Telegram SDK transport', () => {
  it('delivers raw ready to the native bridge without SDK initialization or launch parameters', async () => {
    // Keep the actual library behavior here: its guarded ready method rejects
    // an uninitialized SDK, while its raw bridge can still release the loader.
    const actual = await vi.importActual<typeof import('@telegram-apps/sdk-react')>(
      '@telegram-apps/sdk-react',
    );
    sdk.miniAppReady.mockImplementation(actual.miniAppReady);
    sdk.postEvent.mockImplementation((event) => actual.postEvent(event));
    const nativePostEvent = vi.fn();
    Object.defineProperty(window, 'TelegramWebviewProxy', {
      configurable: true,
      value: { postEvent: nativePostEvent },
    });

    expect(install).not.toThrow();

    expect(sdk.miniAppReady.mock.results[0]?.type).toBe('throw');
    expect(sdk.postEvent).toHaveBeenCalledExactlyOnceWith('web_app_ready');
    expect(nativePostEvent).toHaveBeenCalledExactlyOnceWith('web_app_ready', undefined);
    expect(window.sessionStorage.length).toBe(0);
  });
});
