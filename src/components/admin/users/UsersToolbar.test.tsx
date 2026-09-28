// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATE } from '@/pages/adminUsers/usersListState';
import { SEARCH_DEBOUNCE_MS, UsersToolbar } from './UsersToolbar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/platform/hooks/usePlatform', () => ({
  usePlatform: () => ({ capabilities: { hasHapticFeedback: false } }),
}));
const options = { tariffs: [], groups: [], campaigns: [] };
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('toolbar pending search cancellation', () => {
  it('browser back/external q wins over an older pending draft', () => {
    const onChange = vi.fn();
    const state = { ...DEFAULT_STATE, q: 'alpha' };
    const { rerender } = render(
      <UsersToolbar state={state} options={options} onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beta' } });
    act(() => vi.advanceTimersByTime(100));
    rerender(
      <UsersToolbar state={{ ...state, q: 'previous' }} options={options} onChange={onChange} />,
    );
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('previous');
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['alpha', ''])('reset cancels the pending draft even when committed q is "%s"', (q) => {
    const onChange = vi.fn();
    render(
      <UsersToolbar
        state={{ ...DEFAULT_STATE, q, status: 'active' }}
        options={options}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beta' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole('button', { name: 'admin.users.reset' }));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '', status: '', view: 'all' }),
    );
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  });
});
