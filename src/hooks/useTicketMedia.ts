import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionGeneration, isCurrentSession } from '../utils/session';
import {
  getMessageMedia,
  isMediaTokenExpired,
  mediaTokenExpiresAt,
  MediaRefreshGate,
  type MediaMessage,
} from '../utils/ticketMedia';

export function useTicketMedia(
  message: MediaMessage,
  onRefreshMedia?: () => Promise<MediaMessage | undefined>,
) {
  const current = useRef({ message, onRefreshMedia });
  current.current = { message, onRefreshMedia };
  const gate = useRef(new MediaRefreshGate<MediaMessage>());
  const lifecycle = useRef(0);
  const [override, setOverride] = useState<{ source: MediaMessage; fresh: MediaMessage } | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const effective = override?.source === message ? override.fresh : message;
  const items = getMessageMedia(effective);
  const signature = JSON.stringify(items.map(({ file_id, token }) => [file_id, token]));

  useEffect(() => {
    const epoch = lifecycle.current + 1;
    lifecycle.current = epoch;
    return () => {
      lifecycle.current = epoch + 1;
    };
  }, []);

  const refreshMedia = useCallback(async (manual = false): Promise<MediaMessage | null> => {
    const { message: source, onRefreshMedia: load } = current.current;
    if (!load) {
      setFailed(true);
      return null;
    }
    const epoch = lifecycle.current;
    const owner = getSessionGeneration();
    setRefreshing(true);
    const fresh = await gate.current.run(load, manual);
    if (epoch !== lifecycle.current || !isCurrentSession(owner)) return null;
    if (source.id !== current.current.message.id) return null;
    setRefreshing(false);
    if (!fresh || (source.id !== undefined && fresh.id !== source.id)) {
      setFailed(true);
      return null;
    }
    setOverride({ source, fresh });
    setFailedUrls(new Set());
    setFailed(getMessageMedia(fresh).some((item) => isMediaTokenExpired(item.token)));
    return fresh;
  }, []);

  // Renew before expiry, and re-check when a throttled/background tab returns.
  // Documents need this too: anchors do not report an HTTP 404 to React.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const snapshot = JSON.parse(signature) as [string, string | null | undefined][];
    const check = () => {
      clearTimeout(timer);
      if (!snapshot.length) return;
      const expiries = snapshot.map(([, token]) => mediaTokenExpiresAt(token) || 0);
      const delay = Math.min(...expiries) - Date.now() - 5_000;
      if (delay <= 0) void refreshMedia();
      else timer = setTimeout(check, Math.min(delay, 2_147_483_647));
    };
    const visible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [signature, refreshMedia]);

  const mediaFailed = useCallback(
    (url: string) => {
      setFailedUrls((previous) => new Set(previous).add(url));
      setFailed(true);
      void refreshMedia();
    },
    [refreshMedia],
  );

  return { items, refreshing, failed, failedUrls, refreshMedia, mediaFailed };
}
