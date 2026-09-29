// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PageLoadingIndicator, PageLoadingProvider } from './PageLoadingIndicator';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
function Stage({ phase }: { phase: string }) {
  return phase === 'ready' ? <p>Ready</p> : <PageLoadingIndicator key={phase} />;
}
function App({ phase }: { phase: string }) {
  return (
    <StrictMode>
      <PageLoadingProvider>
        <Stage phase={phase} />
      </PageLoadingProvider>
    </StrictMode>
  );
}
it('keeps the same animation node through auth, lazy module and data handoffs, then removes it', () => {
  vi.useFakeTimers();
  const view = render(<App phase="auth" />);
  advance(150);
  const ring = screen.getByRole('status');
  for (const phase of ['module', 'data']) {
    view.rerender(<App phase={phase} />);
    advance(150);
    expect(screen.getAllByRole('status')).toEqual([ring]);
  }
  view.rerender(<App phase="ready" />);
  advance(81);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByText('Ready')).toBeTruthy();
});
it('does not flash on a cached transition and deduplicates simultaneous loaders', () => {
  vi.useFakeTimers();
  const view = render(<App phase="auth" />);
  advance(50);
  view.rerender(<App phase="ready" />);
  advance(200);
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(
    <PageLoadingProvider>
      <PageLoadingIndicator />
      <PageLoadingIndicator />
    </PageLoadingProvider>,
  );
  advance(150);
  expect(screen.getAllByRole('status')).toHaveLength(1);
});
it('bridges a short redirect gap without restarting animation', () => {
  vi.useFakeTimers();
  const view = render(<App phase="list" />);
  advance(150);
  const ring = screen.getByRole('status');
  view.rerender(<App phase="ready" />);
  advance(30);
  view.rerender(<App phase="detail" />);
  advance(150);
  expect(screen.getByRole('status')).toBe(ring);
});
