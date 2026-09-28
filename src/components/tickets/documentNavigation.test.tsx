// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { MessageMediaGrid } from './MessageMediaGrid';
import { createWebAdapter } from '@/platform/adapters/WebAdapter';
import type { PlatformContext } from '@/platform/types';
import { signedMediaUrl, type MediaMessage } from '../../utils/ticketMedia';

const state = vi.hoisted(() => ({
  adapter: {} as PlatformContext,
  currentSession: true,
}));
vi.mock('@/platform', () => ({ usePlatform: () => state.adapter }));
vi.mock('@/utils/session', () => ({
  getSessionGeneration: () => 1,
  isCurrentSession: () => state.currentSession,
}));
vi.mock('@/api/tickets', () => ({
  ticketsApi: {
    getMediaUrl: (file: string, token: string) =>
      signedMediaUrl('https://api.invalid', file, token),
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const attachment = (token: string): MediaMessage => ({
  id: 50,
  media_items: [{ type: 'document', file_id: 'synthetic-document', caption: 'Fixture PDF', token }],
});
let openWindow: MockInstance<
  (url?: string | URL, target?: string, features?: string) => Window | null
>;
const validToken = () => `${Math.floor(Date.now() / 1000) + 60}.fixture`;
const signedUrl = (token: string) =>
  signedMediaUrl('https://api.invalid', 'synthetic-document', token);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
function popupFixture() {
  const popup = {
    opener: {} as unknown,
    document: document.implementation.createHTMLDocument(),
    closed: false,
    location: { replace: vi.fn() },
    close: vi.fn(() => {
      popup.closed = true;
    }),
  };
  return popup;
}
function clickDocument() {
  const link = screen.getByText('Fixture PDF').closest('a');
  if (!link) throw new Error('Missing document link');
  fireEvent.click(link);
}
function expireInBackground() {
  // Move the clock without running the renewal timer, as a throttled background
  // tab may do. The real hook and the real click-time expiry check remain active.
  vi.setSystemTime(Date.now() + 120_000);
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  state.currentSession = true;
  state.adapter = createWebAdapter();
  openWindow = vi.spyOn(window, 'open').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('opens a current signed document using the real web adapter during the click', () => {
  const token = validToken();
  const refresh = vi.fn();
  render(<MessageMediaGrid message={attachment(token)} onRefreshMedia={refresh} />);
  clickDocument();
  expect(openWindow).toHaveBeenCalledExactlyOnceWith(signedUrl(token), '_blank', 'noopener');
  expect(refresh).not.toHaveBeenCalled();
});

it('reserves a safe web popup before a deferred renewal and navigates that same window', async () => {
  const renewal = deferred<MediaMessage>();
  const refresh = vi.fn(() => renewal.promise);
  const popup = popupFixture();
  openWindow.mockReturnValue(popup as unknown as Window);
  render(<MessageMediaGrid message={attachment(validToken())} onRefreshMedia={refresh} />);
  expireInBackground();
  clickDocument();
  expect(openWindow).toHaveBeenCalledExactlyOnceWith('about:blank', '_blank');
  expect(popup.opener).toBeNull();
  expect(popup.document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe(
    'no-referrer',
  );
  expect(popup.location.replace).not.toHaveBeenCalled();
  clickDocument();
  expect(openWindow).toHaveBeenCalledTimes(1);
  await act(async () => {});
  expect(refresh).toHaveBeenCalledTimes(1);
  // Simulate a network response arriving after transient user activation ended.
  openWindow.mockImplementation(() => {
    throw new Error('No user activation');
  });
  const token = validToken();
  await act(async () => renewal.resolve(attachment(token)));
  expect(openWindow).toHaveBeenCalledTimes(1);
  expect(popup.location.replace).toHaveBeenCalledExactlyOnceWith(signedUrl(token));
  expect(popup.close).not.toHaveBeenCalled();
});

it.each(['blocked', 'throws'])(
  'offers a fresh explicit click if the web placeholder %s',
  async (mode) => {
    if (mode === 'throws')
      openWindow.mockImplementationOnce(() => {
        throw new Error('Popup denied');
      });
    const renewal = deferred<MediaMessage>();
    render(
      <MessageMediaGrid
        message={attachment(validToken())}
        onRefreshMedia={() => renewal.promise}
      />,
    );
    expireInBackground();
    clickDocument();
    const token = validToken();
    await act(async () => renewal.resolve(attachment(token)));
    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(openWindow).toHaveBeenLastCalledWith(signedUrl(token), '_blank', 'noopener');
    expect(screen.queryByRole('alert')).toBeNull();
  },
);

it.each([
  'closed',
  'session changed',
  'expired',
  'failed',
  'navigation failed',
  'unmounted',
] as const)('never opens a stale document or replacement popup after renewal: %s', async (mode) => {
  const renewal = deferred<MediaMessage>();
  const popup = popupFixture();
  openWindow.mockReturnValue(popup as unknown as Window);
  const view = render(
    <MessageMediaGrid message={attachment(validToken())} onRefreshMedia={() => renewal.promise} />,
  );
  expireInBackground();
  clickDocument();
  if (mode === 'closed') popup.closed = true;
  if (mode === 'navigation failed')
    popup.location.replace.mockImplementation(() => {
      throw new Error('Navigation denied');
    });
  if (mode === 'session changed') state.currentSession = false;
  if (mode === 'unmounted') view.unmount();
  await act(async () => {
    if (mode === 'failed') renewal.reject(new Error('Synthetic network failure'));
    else renewal.resolve(attachment(mode === 'expired' ? '1.expired' : validToken()));
  });
  if (mode === 'navigation failed') expect(popup.location.replace).toHaveBeenCalledTimes(1);
  else expect(popup.location.replace).not.toHaveBeenCalled();
  expect(openWindow).toHaveBeenCalledTimes(1);
  expect(popup.closed).toBe(true);
});

it('keeps Telegram native navigation after renewing the signed document without a web popup', async () => {
  const nativeOpen = vi.fn();
  state.adapter = { ...createWebAdapter(), platform: 'telegram', openLink: nativeOpen };
  const renewal = deferred<MediaMessage>();
  render(
    <MessageMediaGrid message={attachment(validToken())} onRefreshMedia={() => renewal.promise} />,
  );
  expireInBackground();
  clickDocument();
  expect(nativeOpen).not.toHaveBeenCalled();
  const token = validToken();
  await act(async () => renewal.resolve(attachment(token)));
  expect(nativeOpen).toHaveBeenCalledExactlyOnceWith(signedUrl(token));
  expect(openWindow).not.toHaveBeenCalled();
});
