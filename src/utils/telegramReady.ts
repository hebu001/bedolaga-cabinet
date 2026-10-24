import { miniAppReady, postEvent } from '@telegram-apps/sdk-react';

/** Hide Telegram's native loading placeholder without depending on SDK mounts. */
function notifyTelegramReady(): void {
  try {
    miniAppReady();
    return;
  } catch {}

  // The official bridge is independent of the SDK's launch-parameter cache.
  try {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.ready) {
      webApp.ready();
      return;
    }
  } catch {}

  // This protocol event needs no initData and does not authenticate the user.
  // The installed bridge selects the native transport or Telegram Web origin.
  try {
    postEvent('web_app_ready');
  } catch {}
}

/** Called only in Telegram. Re-send ready when an existing WebView resumes. */
export function installTelegramReady(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') notifyTelegramReady();
  };
  window.addEventListener('pageshow', notifyTelegramReady);
  document.addEventListener('visibilitychange', onVisible);
  notifyTelegramReady();

  return () => {
    window.removeEventListener('pageshow', notifyTelegramReady);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
