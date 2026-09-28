// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { integrationCapabilities } from '../config/integrationCapabilities';
import { advanceSession, getSessionGeneration, ownSessionResult } from '../utils/session';
import { useLegalConsentGate } from './useLegalConsentGate';

vi.mock('../config/integrationCapabilities', () => ({
  integrationCapabilities: { legalConsent: true },
}));

const requirement = () => ({
  response: { status: 428, data: { detail: { documents: ['offer'] } } },
});
const prechecked = () => ({
  response: { status: 428, data: { detail: { documents: ['offer'], prechecked: true } } },
});

afterEach(cleanup);
beforeEach(() => {
  advanceSession();
  Object.assign(integrationCapabilities, { legalConsent: true });
});

describe('consent retry ownership', () => {
  it('requires consent before retrying and sends only accepted document keys', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLegalConsentGate());
    act(() => {
      expect(result.current.capture(requirement(), retry)).toBe(true);
    });
    await act(() => result.current.confirm('failure'));
    expect(retry).not.toHaveBeenCalled();
    act(() => result.current.toggle('offer', true));
    await act(() => result.current.confirm('failure'));
    expect(retry).toHaveBeenCalledExactlyOnceWith(['offer']);
    expect(result.current.pending).toBe(false);
  });

  it('fails closed while the target bot consent contract is disabled', () => {
    Object.assign(integrationCapabilities, { legalConsent: false });
    const retry = vi.fn();
    const { result } = renderHook(() => useLegalConsentGate());
    act(() => {
      expect(result.current.capture(prechecked(), retry)).toBe(false);
    });
    expect(result.current.pending).toBe(false);
    expect(retry).not.toHaveBeenCalled();
  });

  it('cannot retry a captured closure after logout even if an old handler is retained', async () => {
    const retry = vi.fn();
    const { result } = renderHook(() => useLegalConsentGate());
    act(() => {
      result.current.capture(prechecked(), retry);
    });
    const oldConfirm = result.current.confirm;
    act(() => advanceSession());
    expect(result.current.pending).toBe(false);
    await act(() => oldConfirm('failure'));
    expect(retry).not.toHaveBeenCalled();
  });

  it('rejects the previous login intent without needing a session generation change', async () => {
    let loginIntent = 1;
    const error = ownSessionResult(prechecked(), getSessionGeneration(), () => loginIntent === 1);
    const retry = vi.fn();
    const { result } = renderHook(() => useLegalConsentGate());
    act(() => {
      result.current.capture(error, retry);
    });
    loginIntent = 2;
    await act(() => result.current.confirm('failure'));
    expect(retry).not.toHaveBeenCalled();
  });

  it('does not erase a newer consent prompt when an older retry completes', async () => {
    let resolve!: () => void;
    const first = new Promise<void>((done) => {
      resolve = done;
    });
    const { result } = renderHook(() => useLegalConsentGate());
    act(() => {
      result.current.capture(prechecked(), () => first);
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.confirm('failure');
    });
    act(() => {
      result.current.capture(requirement(), vi.fn());
    });
    await act(async () => {
      resolve();
      await pending;
    });
    expect(result.current.pending).toBe(true);
  });
});
