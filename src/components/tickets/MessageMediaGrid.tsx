import { usePlatform } from '@/platform';
import { reserveDocumentPopup } from '@/platform/webDocumentPopup';
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { ChevronLeftIcon, ChevronRightIcon, DocumentIcon, XIcon } from '@/components/icons';

import { ticketsApi } from '../../api/tickets';

import { useTicketMedia } from '../../hooks/useTicketMedia';
import {
  getMessageMedia,
  isMediaTokenExpired,
  type MediaItem,
  type MediaMessage,
} from '../../utils/ticketMedia';
import { getSessionGeneration, isCurrentSession } from '../../utils/session';
export type { MediaItem } from '../../utils/ticketMedia';

export function MessageMediaGrid({
  message,
  translateError = 'Failed to load attachment',
  translateRetry = 'Retry',
  onRefreshMedia,
}: {
  message: MediaMessage;
  translateError?: string;
  translateRetry?: string;
  onRefreshMedia?: () => Promise<MediaMessage | undefined>;
}) {
  const { t } = useTranslation();
  const { platform, openLink } = usePlatform();
  const { items, refreshing, failed, failedUrls, refreshMedia, mediaFailed } = useTicketMedia(
    message,
    onRefreshMedia,
  );
  const mediaUrl = (item: MediaItem): string | null => {
    if (isMediaTokenExpired(item.token)) return null;
    const url = ticketsApi.getMediaUrl(item.file_id, item.token);
    return url && !failedUrls.has(url) ? url : null;
  };
  const photoItems = items.filter((i) => i.type === 'photo');
  const otherItems = items.filter((i) => i.type !== 'photo');

  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [retryDocumentId, setRetryDocumentId] = useState<string | null>(null);
  const pendingDocument = useRef(false);
  const documentPopup = useRef<Window | null>(null);
  useEffect(
    () => () => {
      documentPopup.current?.close();
      documentPopup.current = null;
    },
    [],
  );

  const openFullscreen = (idx: number) => {
    setFullscreenIndex(idx);
    if (isMediaTokenExpired(photoItems[idx]?.token)) void refreshMedia(true);
  };
  const closeFullscreen = useCallback(() => setFullscreenIndex(null), []);

  const openDocument = async (event: React.MouseEvent<HTMLElement>, item: MediaItem) => {
    // Date is checked at activation as background timers can be throttled.
    event.preventDefault();
    if (pendingDocument.current) return;
    setRetryDocumentId(null);
    const currentUrl = mediaUrl(item);
    if (currentUrl) {
      try {
        openLink(currentUrl);
      } catch {
        setRetryDocumentId(item.file_id);
      }
      return;
    }
    if (refreshing) return;
    const owner = getSessionGeneration();
    pendingDocument.current = true;
    let popup: Window | null = null;
    try {
      if (platform === 'web') {
        // Reserve the window inside the click gesture. Opening it after the
        // renewal GET can be blocked once browser user activation has expired.
        popup = reserveDocumentPopup();
        documentPopup.current = popup;
      }
      const fresh = await refreshMedia(true);
      if (!isCurrentSession(owner)) return;
      const replacement =
        fresh && getMessageMedia(fresh).find((candidate) => candidate.file_id === item.file_id);
      const url =
        replacement && !isMediaTokenExpired(replacement.token)
          ? ticketsApi.getMediaUrl(replacement.file_id, replacement.token)
          : null;
      if (!url) {
        setRetryDocumentId(item.file_id);
        return;
      }
      if (platform === 'web') {
        if (popup) {
          // Closing the placeholder is a cancellation, not permission to open
          // another window when the network eventually finishes.
          if (popup.closed) return;
          popup.location.replace(url);
          documentPopup.current = null;
          popup = null;
        } else {
          // Popup blocking is recoverable with a new explicit click on the
          // now-renewed document; never attempt another asynchronous popup.
          setRetryDocumentId(item.file_id);
        }
      } else {
        openLink(url);
      }
    } catch {
      if (isCurrentSession(owner)) setRetryDocumentId(item.file_id);
    } finally {
      popup?.close();
      if (documentPopup.current === popup) documentPopup.current = null;
      pendingDocument.current = false;
    }
  };

  // Escape + arrow keys for fullscreen nav
  useEffect(() => {
    if (fullscreenIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenIndex(null);
      else if (e.key === 'ArrowLeft' && fullscreenIndex > 0)
        setFullscreenIndex(fullscreenIndex - 1);
      else if (e.key === 'ArrowRight' && fullscreenIndex < photoItems.length - 1)
        setFullscreenIndex(fullscreenIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenIndex, photoItems.length]);

  // Lock body scroll while fullscreen overlay is open (mobile mainly).
  useEffect(() => {
    if (fullscreenIndex === null) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreenIndex]);

  // All hooks have been called — safe to early-return now.
  if (items.length === 0) return null;

  // Grid layout based on photo count
  let gridClass = '';
  if (photoItems.length === 1) {
    gridClass = 'grid-cols-1';
  } else if (photoItems.length === 2) {
    gridClass = 'grid-cols-2';
  } else if (photoItems.length === 3) {
    gridClass = 'grid-cols-3';
  } else {
    gridClass = 'grid-cols-2'; // 4+ → 2x2
  }

  const visiblePhotos = photoItems.slice(0, 4);
  const hiddenCount = photoItems.length - visiblePhotos.length;

  return (
    <div className="mt-3 space-y-2">
      {photoItems.length > 0 && (
        <div className={`grid gap-1 ${gridClass}`}>
          {visiblePhotos.map((item, visIdx) => {
            // visIdx is always the correct index into photoItems (visible prefix)
            const originalIdx = visIdx;
            const isLastVisible = visIdx === visiblePhotos.length - 1 && hiddenCount > 0;
            return (
              <button
                key={`${item.file_id}-${visIdx}`}
                type="button"
                className="group relative aspect-square overflow-hidden rounded-lg bg-dark-800"
                onClick={() => openFullscreen(originalIdx)}
              >
                {mediaUrl(item) ? (
                  <img
                    src={mediaUrl(item)!}
                    alt={item.caption || 'Attached photo'}
                    className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => mediaFailed(ticketsApi.getMediaUrl(item.file_id, item.token)!)}
                  />
                ) : (
                  <span className="p-2 text-xs text-dark-400">{translateError}</span>
                )}
                {isLastVisible && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-dark-950/60 text-2xl font-semibold text-white">
                    +{hiddenCount}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Non-photo media rendered inline */}
      {otherItems.map((item) => {
        const url = mediaUrl(item);
        if (item.type === 'video') {
          return (
            <div key={item.file_id}>
              {url ? (
                <video
                  src={url}
                  controls
                  className="max-h-64 max-w-full rounded-lg"
                  preload="metadata"
                  onError={() => mediaFailed(url)}
                />
              ) : (
                <span className="text-xs text-dark-400">{translateError}</span>
              )}
              {item.caption && <p className="mt-1 text-xs text-dark-400">{item.caption}</p>}
            </div>
          );
        }
        return (
          <a
            key={item.file_id}
            href={url || undefined}
            onClick={(event) => void openDocument(event, item)}
            referrerPolicy="no-referrer"
            target="_blank"
            rel="noopener noreferrer"
            // Длинное имя файла переносится внутри пузыря, а не выталкивает его
            // за карточку; без подписи — «Скачать файл», а не «Download document».
            className="inline-flex max-w-full items-center gap-2 rounded-lg bg-dark-700 px-3 py-2 text-sm text-dark-200 transition-colors hover:bg-dark-600"
          >
            <DocumentIcon className="h-4 w-4" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {item.caption || t('support.downloadFile')}
            </span>
          </a>
        );
      })}

      {fullscreenIndex !== null &&
        photoItems[fullscreenIndex] &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-dark-950"
            style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl transition-colors hover:bg-gray-200"
              onClick={closeFullscreen}
            >
              <XIcon className="h-5 w-5" />
            </button>

            {photoItems.length > 1 && (
              <>
                <button
                  type="button"
                  disabled={fullscreenIndex === 0}
                  onClick={() => setFullscreenIndex(fullscreenIndex - 1)}
                  className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-xl transition-colors hover:bg-white disabled:opacity-30"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  disabled={fullscreenIndex >= photoItems.length - 1}
                  onClick={() => setFullscreenIndex(fullscreenIndex + 1)}
                  className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-xl transition-colors hover:bg-white disabled:opacity-30"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
                <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-dark-950/70 px-3 py-1 text-sm text-white">
                  {fullscreenIndex + 1} / {photoItems.length}
                </div>
              </>
            )}

            <div
              className="flex h-full w-full items-center justify-center overflow-auto"
              onClick={closeFullscreen}
            >
              {mediaUrl(photoItems[fullscreenIndex]) ? (
                <img
                  src={mediaUrl(photoItems[fullscreenIndex])!}
                  alt={photoItems[fullscreenIndex].caption || 'Attached photo'}
                  className="max-h-full max-w-full object-contain"
                  style={{ touchAction: 'pinch-zoom' }}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    mediaFailed(
                      ticketsApi.getMediaUrl(
                        photoItems[fullscreenIndex].file_id,
                        photoItems[fullscreenIndex].token,
                      )!,
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-white">{translateError}</span>
              )}
            </div>
          </div>,
          document.body,
        )}

      {retryDocumentId && (
        <div className="flex items-center gap-2 text-xs text-dark-400" role="alert">
          <span>{translateError}</span>
          <button
            type="button"
            className="underline"
            onClick={(event) => {
              const item = items.find((candidate) => candidate.file_id === retryDocumentId);
              if (item) void openDocument(event, item);
            }}
          >
            {translateRetry}
          </button>
        </div>
      )}
      {!retryDocumentId && (failed || items.some((item) => isMediaTokenExpired(item.token))) && (
        <div className="flex items-center gap-2 text-xs text-dark-400" role="status">
          <span>{translateError}</span>
          {onRefreshMedia && (
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void refreshMedia(true)}
              className="underline disabled:opacity-50"
              aria-busy={refreshing}
            >
              {translateRetry}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
