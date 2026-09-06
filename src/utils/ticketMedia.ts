export interface MediaItem {
  type: string;
  file_id: string;
  caption?: string | null;
  token?: string | null;
}

export interface MediaMessage {
  id?: number;
  has_media?: boolean;
  media_type?: string | null;
  media_file_id?: string | null;
  media_caption?: string | null;
  media_token?: string | null;
  media_items?: MediaItem[] | null;
}

export function getMessageMedia(message: MediaMessage): MediaItem[] {
  if (message.media_items?.length) return message.media_items;
  if (!message.media_file_id || !message.media_type) return [];
  return [
    {
      type: message.media_type,
      file_id: message.media_file_id,
      caption: message.media_caption,
      token: message.media_token,
    },
  ];
}

// The backend signs exp.signature. This reads expiry for renewal only; signature
// verification and access control remain exclusively on the backend.
export function mediaTokenExpiresAt(token: string | null | undefined): number | null {
  if (!token) return null;
  const match = /^(\d+)\.(.+)$/.exec(token);
  if (!match) return null;
  const milliseconds = Number(match[1]) * 1000;
  return Number.isSafeInteger(milliseconds) ? milliseconds : null;
}

export function isMediaTokenExpired(token: string | null | undefined, now = Date.now()): boolean {
  const expires = mediaTokenExpiresAt(token);
  return expires === null || expires <= now + 5_000;
}

export function signedMediaUrl(
  apiBase: string,
  fileId: string,
  token?: string | null,
): string | null {
  if (!fileId || !token?.trim()) return null;
  return `${apiBase.replace(/\/+$/, '')}/cabinet/media/${encodeURIComponent(fileId)}?token=${encodeURIComponent(token)}`;
}

// Several failed thumbnails in one message share one request. Unchanged expired
// tokens, permanent 404s and failed renewals cannot cause an automatic loop.
export class MediaRefreshGate<T> {
  private pending: Promise<T | null> | null = null;
  private lastAttempt = -Infinity;

  run(load: () => Promise<T | undefined>, manual = false): Promise<T | null> {
    if (this.pending) return this.pending;
    if (!manual && Date.now() - this.lastAttempt < 60_000) return Promise.resolve(null);
    this.lastAttempt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), 15_000);
    });
    const pending = Promise.race([Promise.resolve().then(load), timeout])
      .then(
        (value) => value ?? null,
        () => null,
      )
      .finally(() => {
        clearTimeout(timer);
        if (this.pending === pending) this.pending = null;
      });
    this.pending = pending;
    return pending;
  }
}
