import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergedBotContract as fixture } from '../test/fixtures/mergedBotContract';
import { adminUsersApi } from './adminUsers';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./client', () => ({ default: client }));
beforeEach(() => vi.resetAllMocks());

describe('merged bot numeric identities through admin users API', () => {
  it.each([
    ['user detail', () => adminUsersApi.getUser(7), '/cabinet/admin/users/7'],
    [
      'Telegram lookup',
      () => adminUsersApi.getUserByTelegram(123),
      '/cabinet/admin/users/by-telegram/123',
    ],
  ] as const)('%s adapts the numeric field', async (_name, request, url) => {
    client.get.mockResolvedValue({ data: fixture.user });
    expect(await request()).toEqual({
      ...fixture.user,
      panel_identity: { kind: 'numeric', value: 47 },
    });
    expect(client.get).toHaveBeenCalledWith(url);
  });

  it('keeps an unlinked user accessible without inventing a panel ID', async () => {
    client.get.mockResolvedValue({ data: fixture.unlinkedUser });
    expect((await adminUsersApi.getUser(7)).panel_identity).toBeNull();
  });

  it('adapts sync status and preserves the requested subscription', async () => {
    client.get.mockResolvedValue({ data: fixture.syncStatus });
    expect((await adminUsersApi.getSyncStatus(7, 19)).panel_identity).toEqual({
      kind: 'numeric',
      value: 47,
    });
    expect(client.get).toHaveBeenCalledWith('/cabinet/admin/users/7/sync/status', {
      params: { subscription_id: 19 },
    });
  });

  it('adapts nested panel users, including a missing panel user', async () => {
    client.post.mockResolvedValueOnce({ data: fixture.syncFrom });
    expect((await adminUsersApi.syncFromPanel(7, {}, 19)).panel_user?.panel_identity).toEqual({
      kind: 'numeric',
      value: 47,
    });
    expect(client.post).toHaveBeenCalledWith(
      '/cabinet/admin/users/7/sync/from-panel',
      {},
      { params: { subscription_id: 19 } },
    );
    client.post.mockResolvedValueOnce({ data: { ...fixture.syncFrom, panel_user: null } });
    expect((await adminUsersApi.syncFromPanel(7)).panel_user).toBeNull();
  });

  it('adapts sync-to results without confusing bot and panel IDs', async () => {
    client.post.mockResolvedValueOnce({ data: fixture.syncTo });
    expect((await adminUsersApi.syncToPanel(7, {}, 19)).panel_identity).toEqual({
      kind: 'numeric',
      value: 47,
    });
    expect(client.post).toHaveBeenCalledWith(
      '/cabinet/admin/users/7/sync/to-panel',
      {},
      { params: { subscription_id: 19 } },
    );
    client.post.mockResolvedValueOnce({ data: { ...fixture.syncTo, panel_user_id: null } });
    expect((await adminUsersApi.syncToPanel(7)).panel_identity).toBeNull();
  });

  it.each(['47', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, undefined])(
    'rejects malformed numeric ID %s',
    async (id) => {
      client.get.mockResolvedValue({ data: { remnawave_id: id } });
      await expect(adminUsersApi.getUser(7)).rejects.toThrow('expected remnawave_id');
    },
  );

  it('does not silently fall back to a UUID contract', async () => {
    client.get.mockResolvedValue({
      data: { remnawave_uuid: 'c9e61e1f-9fdc-4450-8774-eb198c310b8b' },
    });
    await expect(adminUsersApi.getUser(7)).rejects.toThrow('expected remnawave_id');
  });

  it('preserves transport errors', async () => {
    const failure = new Error('API unavailable');
    client.post.mockRejectedValue(failure);
    await expect(adminUsersApi.syncToPanel(7)).rejects.toBe(failure);
  });
});
