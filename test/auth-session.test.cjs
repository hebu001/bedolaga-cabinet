// Actual application modules, transpiled for Node; real Axios, Zustand and QueryClient.
// The adapter is the only HTTP substitute. Each VM is an independent browser tab.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { setImmediate: flush } = require('node:timers/promises');
const ts = require('typescript');
const axios = require('axios');
const { MutationObserver } = require('@tanstack/react-query');
const root = path.resolve(__dirname, '..');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const jwt = (user = 'A', expires = 3600) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: user, exp: Math.floor(Date.now() / 1000) + expires })).toString('base64url')}.signature`;
function storage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
  };
}
function lockManager() {
  let tail = Promise.resolve();
  return {
    request: (_name, options, callback) => {
      const run = tail.then(() => {
        if (options.signal.aborted) throw new Error('Aborted lock');
        return callback();
      });
      tail = run.catch(() => {});
      return run;
    },
  };
}
function tab(options = {}) {
  const shared = options.shared || storage();
  const local = options.local || shared;
  const sessionStorage = options.session || storage();
  const requests = [];
  const events = new Map();
  const cache = new Map();
  const adapter = async (config) => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const request = { url: config.url, body, config };
    requests.push(request);
    const value = await options.http?.(request);
    if (value?.error) throw new axios.AxiosError(value.error, value.code, config);
    const status = value?.status || 200;
    const response = {
      data: value?.data ?? {},
      status,
      statusText: String(status),
      headers: {},
      config,
    };
    if (status >= 400)
      throw new axios.AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', config, {}, response);
    return response;
  };
  const plain = axios.create({ adapter });
  const axiosModule = {
    ...axios,
    create: (config) => axios.create({ ...config, adapter }),
    post: plain.post.bind(plain),
  };
  const browser = {
    addEventListener: (name, fn) => {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name).add(fn);
    },
    location: {
      pathname: '/login',
      search: '',
      hash: '',
      href: 'https://cabinet.example/login',
      origin: 'https://cabinet.example',
    },
  };
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = fs
      .readFileSync(filename, 'utf8')
      .replaceAll('import.meta.env', '({VITE_API_URL:"/api", DEV:false})');
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const requireLocal = (name) => {
      if (name === 'axios') return axiosModule;
      if (name === '@telegram-apps/sdk-react') return { retrieveRawInitData: () => null };
      if (name.endsWith('/utils/yandexCid') || name === '../utils/yandexCid')
        return { getYandexCid: () => null };
      if (name.endsWith('/utils/campaign'))
        return {
          captureCampaignFromUrl() {},
          consumeCampaignSlug() {},
          getPendingCampaignSlug: () => null,
        };
      if (name.endsWith('/utils/referral'))
        return {
          captureReferralFromUrl() {},
          consumeReferralCode() {},
          getPendingReferralCode: () => null,
        };
      if (!name.startsWith('.')) return require(name);
      const imported = path.resolve(path.dirname(filename), name);
      return load(fs.existsSync(imported) ? imported : `${imported}.ts`);
    };
    const timers = options.fastTimers
      ? (fn, ms, ...args) => setTimeout(fn, ms >= 10000 ? 20 : ms, ...args)
      : setTimeout;
    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        require: requireLocal,
        console,
        URL,
        URLSearchParams,
        atob,
        Date,
        crypto: options.crypto || webcrypto,
        AbortController,
        FormData,
        TextDecoder,
        fetch: options.fetch,
        queueMicrotask,
        setTimeout: timers,
        clearTimeout,
        setInterval,
        clearInterval,
        localStorage: local,
        sessionStorage,
        window: browser,
        document: { cookie: 'csrf_token=test' },
        navigator: { language: 'en', ...(options.locks ? { locks: options.locks } : {}) },
      },
      { filename },
    );
    return module.exports;
  }
  const tokens = load('src/utils/token.ts');
  const session = load('src/utils/session.ts');
  const queries = load('src/utils/sessionQueryClient.ts');
  return {
    ...tokens,
    ...session,
    ...queries,
    requests,
    shared,
    local,
    sessionStorage,
    load,
    auth: () => load('src/store/auth.ts').useAuthStore,
    api: () => load('src/api/client.ts').apiClient,
    authApi: () => load('src/api/auth.ts').authApi,
    permissions: () => load('src/store/permissions.ts').usePermissionStore,
    storageEvent: () => events.get('storage')?.forEach((fn) => fn({ key: 'cabinet-session-v1' })),
  };
}
const basic = ({ url, config }) => {
  const user = String(config.headers.Authorization || '').includes(jwt('B')) ? 'B' : 'A';
  if (url.endsWith('/me')) return { data: { id: user, first_name: user } };
  if (url.endsWith('/is-admin')) return { data: { is_admin: false } };
  return { data: {} };
};
async function signedIn(options = {}, user = 'A') {
  const run = tab({ http: basic, ...options });
  const auth = run.auth();
  await auth.getState().initialize();
  auth.getState().setTokens(jwt(user), `R-${user}`);
  auth.getState().setUser({ id: user });
  await flush();
  return { ...run, store: auth };
}
function isSessionChange(error) {
  return error.name === 'SessionChangedError';
}

test('logout → B replaces the real QueryClient; late private query/mutation callbacks cannot populate B', async () => {
  const r = await signedIn();
  const old = r.getSessionQueryClient();
  old.setQueryData(['saved-cards'], { owner: 'A', last4: '4242' });
  const query = deferred(),
    mutation = deferred();
  const pendingQuery = old
    .fetchQuery({ queryKey: ['private-slow'], queryFn: () => query.promise })
    .catch(() => {});
  let callbacks = 0;
  const observer = new MutationObserver(old, {
    mutationFn: () => mutation.promise,
    onSuccess: () => callbacks++,
    onError: () => callbacks++,
    onSettled: () => callbacks++,
  });
  const unsubscribe = observer.subscribe(() => {});
  const pendingMutation = observer
    .mutate({}, { onSuccess: () => callbacks++, onError: () => callbacks++ })
    .catch(() => {});
  await flush();
  r.store.getState().logout();
  r.store.getState().setTokens(jwt('B'), 'R-B');
  const current = r.getSessionQueryClient();
  assert.notEqual(current, old);
  assert.equal(current.getQueryData(['saved-cards']), undefined);
  assert.equal(old.getQueryCache().getAll().length, 0);
  query.resolve({ owner: 'A' });
  mutation.resolve({ owner: 'A' });
  await Promise.all([pendingQuery, pendingMutation]);
  assert.equal(callbacks, 0);
  assert.equal(current.getQueryData(['private-slow']), undefined);
  assert.deepEqual(
    await current.fetchQuery({
      queryKey: ['saved-cards'],
      queryFn: async () => ({ owner: 'B' }),
      staleTime: 300000,
    }),
    { owner: 'B' },
  );
  unsubscribe();
  current.clear();
});

test('same-user new login is a boundary; refresh rotation keeps a healthy query cache', async () => {
  const r = await signedIn({
    locks: lockManager(),
    http: (q) =>
      q.url.endsWith('/refresh')
        ? { data: { access_token: jwt('A'), refresh_token: 'R-A1' } }
        : basic(q),
  });
  const old = r.getSessionQueryClient();
  old.setQueryData(['saved-cards'], 'A');
  const owner = r.getSessionGeneration();
  await r.tokenRefreshManager.refreshAccessToken();
  assert.equal(r.getSessionGeneration(), owner);
  assert.equal(r.getSessionQueryClient(), old);
  assert.equal(old.getQueryData(['saved-cards']), 'A');
  r.store.getState().setTokens(jwt('A'), 'another-login-A');
  assert.notEqual(r.getSessionQueryClient(), old);
  assert.equal(r.getSessionQueryClient().getQueryData(['saved-cards']), undefined);
});

for (const loginB of [false, true])
  test(`late rotated refresh is discarded/revoked after logout${loginB ? ' and login B' : ''}`, async () => {
    const refresh = deferred();
    const r = await signedIn({
      http: (q) => (q.url.endsWith('/refresh') ? refresh.promise : basic(q)),
    });
    const pending = r.tokenRefreshManager.refreshAccessToken();
    await flush();
    r.store.getState().logout();
    if (loginB) {
      r.store.getState().setTokens(jwt('B'), 'R-B');
      r.store.getState().setUser({ id: 'B' });
    }
    refresh.resolve({ data: { access_token: jwt('A'), refresh_token: 'R-A1' } });
    await assert.rejects(pending, isSessionChange);
    assert.equal(r.tokenStorage.getRefreshToken(), loginB ? 'R-B' : null);
    assert.equal(r.store.getState().user?.id, loginB ? 'B' : undefined);
    const revoked = r.requests
      .filter((q) => q.url.endsWith('/logout'))
      .map((q) => q.body.refresh_token);
    assert.deepEqual(revoked.sort(), ['R-A', 'R-A1']);
    assert.equal(r.requests.filter((q) => q.url.endsWith('/refresh')).length, 1);
  });

test('late /me, admin, permissions and blocking failures cannot overwrite B', async () => {
  const waiting = new Map();
  const r = await signedIn({ http: (q) => waiting.get(q.url)?.promise || basic(q) });
  for (const url of [
    '/cabinet/auth/me',
    '/cabinet/auth/me/is-admin',
    '/cabinet/auth/me/permissions',
    '/cabinet/private',
  ])
    waiting.set(url, deferred());
  const pending = [
    r.store.getState().refreshUser(),
    r.store.getState().checkAdminStatus(),
    r.permissions().getState().fetchPermissions(),
    r
      .api()
      .get('/cabinet/private')
      .catch(() => {}),
  ];
  await flush();
  r.store.getState().logout();
  r.store.getState().setTokens(jwt('B'), 'R-B');
  r.store.getState().setUser({ id: 'B' });
  waiting.get('/cabinet/auth/me').resolve({ data: { id: 'A' } });
  waiting.get('/cabinet/auth/me/is-admin').resolve({ data: { is_admin: true } });
  waiting
    .get('/cabinet/auth/me/permissions')
    .resolve({ data: { permissions: ['*:*'], roles: ['admin'], role_level: 999 } });
  waiting
    .get('/cabinet/private')
    .resolve({ status: 403, data: { detail: { code: 'blacklisted', message: 'old account' } } });
  await Promise.all(pending);
  assert.equal(r.store.getState().user.id, 'B');
  assert.equal(r.store.getState().isAdmin, false);
  assert.equal(r.permissions().getState().permissions.length, 0);
  assert.equal(r.load('src/store/blocking.ts').useBlockingStore.getState().blockingType, null);
});

test('late login after logout/B and a delayed completeLogin consumer cannot restore A', async () => {
  const login = deferred();
  const r = await signedIn({
    http: (q) => (q.url.endsWith('/email/login') ? login.promise : basic(q)),
  });
  const pending = r.store.getState().loginWithEmail('a@example.org', 'dummy');
  await flush();
  r.store.getState().logout();
  r.store.getState().setTokens(jwt('B'), 'R-B');
  login.resolve({ data: { access_token: jwt('A'), refresh_token: 'R-late-A', user: { id: 'A' } } });
  await assert.rejects(pending, isSessionChange);
  assert.equal(r.tokenStorage.getRefreshToken(), 'R-B');
  const result = await r.authApi().autoLogin('token'); // stamped result without tokens, just ownership
  result.access_token = jwt('A');
  result.refresh_token = 'R-delayed';
  result.user = { id: 'A' };
  r.store.getState().logout();
  r.store.getState().setTokens(jwt('B'), 'R-B2');
  await assert.rejects(r.store.getState().completeLogin(result), isSessionChange);
  assert.equal(r.tokenStorage.getRefreshToken(), 'R-B2');
});

test('latest-started login wins even when an older response finishes first', async () => {
  const first = deferred(),
    second = deferred();
  let count = 0;
  const r = await signedIn({
    http: (q) =>
      q.url.endsWith('/email/login') ? (++count === 1 ? first.promise : second.promise) : basic(q),
  });
  const a = r.store.getState().loginWithEmail('a@example.org', 'dummy');
  const b = r.store.getState().loginWithEmail('b@example.org', 'dummy');
  await flush();
  first.resolve({ data: { access_token: jwt('A'), refresh_token: 'R-first', user: { id: 'A' } } });
  await assert.rejects(a, isSessionChange);
  second.resolve({
    data: { access_token: jwt('B'), refresh_token: 'R-second', user: { id: 'B' } },
  });
  await b;
  assert.equal(r.store.getState().user.id, 'B');
});

test('all store login variants and direct auto/verify/merge complete through one boundary', async () => {
  const r = await signedIn({
    http: (q) =>
      q.url.endsWith('/is-admin')
        ? { data: { is_admin: true } }
        : q.url.endsWith('/permissions')
          ? { data: { permissions: ['users:read'], roles: ['support'], role_level: 10 } }
          : {
              data: {
                success: true,
                access_token: jwt('B'),
                refresh_token: 'R-B',
                user: { id: 'B' },
              },
            },
  });
  for (const action of [
    () => r.store.getState().loginWithTelegram('dummy'),
    () => r.store.getState().loginWithTelegramWidget({ id: 1 }),
    () => r.store.getState().loginWithTelegramOIDC('dummy'),
    () => r.store.getState().loginWithEmail('a@example.org', 'dummy'),
    () => r.store.getState().loginWithOAuth('google', 'code', 'state'),
    () => r.store.getState().loginWithDeepLink('dummy'),
    async () => r.store.getState().completeLogin(await r.authApi().autoLogin('dummy')),
    async () => r.store.getState().completeLogin(await r.authApi().verifyEmail('dummy')),
    async () => r.store.getState().completeLogin(await r.authApi().executeMerge('dummy', 1)),
  ]) {
    const generation = r.getSessionGeneration();
    await action();
    assert.equal(r.getSessionGeneration(), generation + 1);
    assert.equal(r.store.getState().isAuthenticated, true);
    assert.equal(r.store.getState().isAdmin, true);
    assert.equal(r.permissions().getState().hasPermission('users:read'), true);
  }
});

test('valid and expired-token initialization load the current user/admin and retain rotated refresh', async () => {
  for (const expired of [false, true]) {
    const local = storage(),
      session = storage();
    local.setItem('refresh_token', 'legacy-R');
    session.setItem('access_token', jwt('A', expired ? -1 : 3600));
    const r = tab({
      shared: local,
      session,
      locks: lockManager(),
      http: (q) =>
        q.url.endsWith('/refresh')
          ? { data: { access_token: jwt('A'), refresh_token: 'rotated-R' } }
          : basic(q),
    });
    await r.auth().getState().initialize();
    assert.equal(r.auth().getState().isAuthenticated, true);
    assert.equal(r.auth().getState().user.id, 'A');
    assert.equal(r.tokenStorage.getRefreshToken(), expired ? 'rotated-R' : 'legacy-R');
    assert.equal(r.auth().getState().isLoading, false);
  }
});

test('two tabs serialize Web Locks rotation and reread the refresh inside the lock', async () => {
  const shared = storage(),
    locks = lockManager(),
    first = deferred();
  let live = 'R0',
    calls = 0;
  const http = async (q) => {
    if (!q.url.endsWith('/refresh')) return basic(q);
    calls++;
    assert.equal(q.body.refresh_token, live);
    if (calls === 1) await first.promise;
    live = `R${calls}`;
    return { data: { access_token: jwt('A'), refresh_token: live } };
  };
  const a = tab({ shared, locks, http });
  a.tokenStorage.setTokens(jwt('A'), 'R0');
  const b = tab({ shared, locks, http });
  const pa = a.tokenRefreshManager.refreshAccessToken(),
    pb = b.tokenRefreshManager.refreshAccessToken();
  await flush();
  assert.equal(calls, 1);
  first.resolve();
  await Promise.all([pa, pb]);
  assert.equal(calls, 2);
  assert.equal(a.tokenStorage.getRefreshToken(), 'R2');
  assert.equal(b.tokenStorage.getRefreshToken(), 'R2');
  assert.deepEqual(
    b.requests.map((q) => q.body.refresh_token),
    ['R1'],
  );
});

for (const rejectFirst of [false, true])
  test(`unsupported-lock fallback recovers a concurrent rotation (401 ${rejectFirst ? 'before' : 'after'} winner publication)`, async () => {
    const shared = storage(),
      winner = deferred(),
      loser = deferred();
    let calls = 0;
    const http = (q) => {
      if (!q.url.endsWith('/refresh')) return basic(q);
      calls++;
      if (calls === 1) return winner.promise;
      if (calls === 2) return loser.promise;
      assert.equal(q.body.refresh_token, 'R1');
      return { data: { access_token: jwt('A'), refresh_token: 'R2' } };
    };
    const a = tab({ shared, http });
    a.tokenStorage.setTokens(jwt('A'), 'R0');
    const b = tab({ shared, http });
    const pa = a.tokenRefreshManager.refreshAccessToken(),
      pb = b.tokenRefreshManager.refreshAccessToken();
    await flush();
    if (rejectFirst) {
      loser.resolve({ status: 401 });
      await flush();
    }
    winner.resolve({ data: { access_token: jwt('A'), refresh_token: 'R1' } });
    await pa;
    if (!rejectFirst) loser.resolve({ status: 401 });
    await pb;
    assert.equal(a.tokenStorage.getRefreshToken(), 'R2');
    assert.equal(b.tokenStorage.getRefreshToken(), 'R2');
    assert.equal(a.requests.concat(b.requests).filter((q) => q.url.endsWith('/logout')).length, 0);
  });

for (const kind of ['unsupported', 'denied-lock', 'storage-unavailable'])
  test(`ordinary rotation works with ${kind}`, async () => {
    const denied = {
      getItem() {
        throw new Error('storage denied');
      },
      setItem() {
        throw new Error('storage denied');
      },
      removeItem() {
        throw new Error('storage denied');
      },
    };
    const r = tab({
      ...(kind === 'denied-lock'
        ? {
            locks: {
              request: async () => {
                throw new Error('SecurityError');
              },
            },
          }
        : {}),
      ...(kind === 'storage-unavailable' ? { local: denied, session: denied } : {}),
      http: () => ({ data: { access_token: jwt('A'), refresh_token: 'R1' } }),
    });
    r.tokenStorage.setTokens(jwt('A', -1), 'R0');
    await r.tokenRefreshManager.refreshAccessToken();
    assert.equal(r.tokenStorage.getRefreshToken(), 'R1');
    assert.equal(r.tokenStorage.getAccessToken(), jwt('A'));
    assert.equal(r.requests[0].config.headers['X-Refresh-Token-Rotation'], '1');
    assert.equal(r.requests[0].config.timeout, 10000);
  });

for (const failure of [
  { status: 503 },
  { error: 'offline', code: 'ERR_NETWORK' },
  { error: 'timeout', code: 'ECONNABORTED' },
])
  test(`transient refresh ${failure.status || failure.error} retains credentials and never dispatches expired API requests`, async () => {
    const r = await signedIn({
      locks: lockManager(),
      http: (q) => (q.url.endsWith('/refresh') ? failure : basic(q)),
    });
    r.tokenStorage.setAccessToken(jwt('A', -1));
    const owner = r.getSessionGeneration(),
      cache = r.getSessionQueryClient();
    await assert.rejects(r.api().post('/cabinet/private', { shouldNotSend: true }));
    assert.equal(r.requests.filter((q) => q.url === '/cabinet/private').length, 0);
    assert.equal(r.tokenStorage.getRefreshToken(), 'R-A');
    assert.equal(r.getSessionGeneration(), owner);
    assert.equal(r.getSessionQueryClient(), cache);
    assert.equal(r.store.getState().isAuthenticated, true);
  });

test('terminal refresh under the lock logs out; ambiguous fallback 401 preserves the shared session', async () => {
  for (const exclusive of [true, false]) {
    const r = await signedIn({
      ...(exclusive ? { locks: lockManager() } : {}),
      http: (q) => (q.url.endsWith('/refresh') ? { status: 401 } : basic(q)),
    });
    await assert.rejects(r.tokenRefreshManager.refreshAccessToken());
    assert.equal(r.tokenStorage.getRefreshToken(), exclusive ? null : 'R-A');
    assert.equal(r.store.getState().isAuthenticated, !exclusive);
  }
});

test('lock acquisition has a bounded wait and cannot start an overlapping refresh on timeout', async () => {
  const r = tab({
    fastTimers: true,
    locks: {
      request: (_name, { signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(new Error('timeout'))),
        ),
    },
  });
  r.tokenStorage.setTokens(jwt('A'), 'R0');
  await assert.rejects(r.tokenRefreshManager.refreshAccessToken());
  assert.equal(r.requests.length, 0);
  assert.equal(r.tokenStorage.getRefreshToken(), 'R0');
});

test('other-tab logout/login resets auth, permissions and query data before storage-event delivery', async () => {
  const shared = storage();
  const a = await signedIn({ shared });
  const b = tab({ shared, http: basic, locks: lockManager() });
  const old = a.getSessionQueryClient();
  old.setQueryData(['saved-cards'], 'A');
  a.permissions().setState({
    permissions: ['*:*'],
    roles: ['admin'],
    roleLevel: 99,
    isLoaded: true,
  });
  b.tokenStorage.clearTokens();
  assert.equal(a.tokenStorage.getRefreshToken(), null); // read synchronizes before event
  assert.equal(a.store.getState().isAuthenticated, false);
  assert.equal(a.permissions().getState().permissions.length, 0);
  assert.equal(a.getSessionQueryClient().getQueryData(['saved-cards']), undefined);
  b.tokenStorage.setTokens(jwt('B'), 'R-B');
  a.storageEvent();
  assert.equal(a.store.getState().isLoading, true);
  assert.equal(a.store.getState().user, null);
  assert.equal(a.tokenStorage.getAccessToken(), null);
});

for (const method of ['get', 'request', 'call', 'string'])
  test(`request ownership captured before Axios async dispatch (${method})`, async () => {
    const r = await signedIn();
    const api = r.api();
    const pending =
      method === 'get'
        ? api.get('/cabinet/private')
        : method === 'request'
          ? api.request({ url: '/cabinet/private' })
          : method === 'string'
            ? api('/cabinet/private', { method: 'get' })
            : api({ url: '/cabinet/private', method: 'get' });
    r.store.getState().logout();
    r.store.getState().setTokens(jwt('B'), 'R-B');
    await assert.rejects(pending, isSessionChange);
    assert.equal(r.requests.filter((q) => q.url === '/cabinet/private').length, 0);
  });

test('an old 401 cannot refresh/replay using B credentials', async () => {
  const request = deferred();
  const r = await signedIn({
    http: (q) => (q.url === '/cabinet/private' ? request.promise : basic(q)),
  });
  const pending = r.api().get('/cabinet/private');
  await flush();
  r.store.getState().logout();
  r.store.getState().setTokens(jwt('B'), 'R-B');
  request.resolve({ status: 401 });
  await assert.rejects(pending, isSessionChange);
  assert.equal(r.requests.filter((q) => q.url.endsWith('/refresh')).length, 0);
  assert.equal(r.requests.filter((q) => q.url === '/cabinet/private').length, 1);
});

test('caller cancellation during a 401 refresh wait prevents replay (WS ticket lifecycle)', async () => {
  const refresh = deferred();
  const r = await signedIn({
    http: (q) =>
      q.url.endsWith('/refresh')
        ? refresh.promise
        : q.url === '/cabinet/ws/ticket'
          ? { status: 401 }
          : basic(q),
  });
  const caller = new AbortController();
  const pending = r.api().post('/cabinet/ws/ticket', null, { signal: caller.signal });
  await flush();
  assert.equal(r.requests.filter((q) => q.url.endsWith('/refresh')).length, 1);
  caller.abort();
  refresh.resolve({ data: { access_token: jwt('A'), refresh_token: 'R-A1' } });
  await assert.rejects(pending, (error) => axios.isCancel(error));
  assert.equal(r.requests.filter((q) => q.url === '/cabinet/ws/ticket').length, 1);
  assert.equal(r.tokenStorage.getRefreshToken(), 'R-A1');
});

test('401 for an already replaced access token retries within the same session without extra refresh', async () => {
  const request = deferred();
  let calls = 0;
  const r = await signedIn({
    http: (q) => (q.url === '/cabinet/private' && ++calls === 1 ? request.promise : basic(q)),
  });
  const pending = r.api().get('/cabinet/private');
  await flush();
  const replacement = jwt('A', 7200);
  r.tokenStorage.setAccessToken(replacement);
  request.resolve({ status: 401 });
  await pending;
  assert.equal(calls, 2);
  assert.equal(r.requests.filter((q) => q.url.endsWith('/refresh')).length, 0);
  assert.equal(
    r.requests.filter((q) => q.url === '/cabinet/private')[1].config.headers.Authorization,
    `Bearer ${replacement}`,
  );
});

for (const hook of ['onMutate', 'onSuccess', 'onError', 'onSettled'])
  test(`session switch in the awaited global ${hook} hook gap suppresses per-mutation callbacks`, async () => {
    const r = await signedIn();
    const client = r.getSessionQueryClient(),
      cache = client.getMutationCache();
    const original = cache.config[hook];
    let callbacks = 0,
      switched = false;
    cache.config[hook] = (...args) => {
      const value = original(...args);
      if (!switched)
        queueMicrotask(() => {
          switched = true;
          r.store.getState().logout();
          r.store.getState().setTokens(jwt('B'), 'R-B');
        });
      return value;
    };
    const observer = new MutationObserver(client, {
      mutationFn: async () => {
        if (hook === 'onError') throw new Error('failed');
        return 'A';
      },
      [hook]: () => {
        callbacks++;
        r.getSessionQueryClient().setQueryData(['private'], 'A');
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    await observer.mutate({}).catch(() => {});
    assert.equal(switched, true);
    assert.equal(callbacks, 0);
    assert.equal(r.getSessionQueryClient().getQueryData(['private']), undefined);
    unsubscribe();
  });

test('late initialize response cannot undo an explicit login and transient init can be retried', async () => {
  const sessionStorage = storage(),
    shared = storage(),
    me = deferred();
  let calls = 0;
  shared.setItem('refresh_token', 'R0');
  sessionStorage.setItem('access_token', jwt('A'));
  const r = tab({
    shared,
    session: sessionStorage,
    http: (q) => (q.url.endsWith('/me') && calls++ === 0 ? me.promise : basic(q)),
  });
  const auth = r.auth(),
    pending = auth.getState().initialize();
  await flush();
  auth.getState().setTokens(jwt('B'), 'R-B');
  auth.getState().setUser({ id: 'B' });
  me.resolve({ data: { id: 'A' } });
  await pending;
  assert.equal(auth.getState().user.id, 'B');
  assert.equal(auth.getState().isAuthenticated, true);

  const retryShared = storage(),
    retrySession = storage();
  let fail = true;
  retryShared.setItem('refresh_token', 'retry-R');
  retrySession.setItem('access_token', jwt('A'));
  const retry = tab({
    shared: retryShared,
    session: retrySession,
    http: (q) => (q.url.endsWith('/me') && fail ? { status: 503 } : basic(q)),
  });
  await retry.auth().getState().initialize();
  assert.equal(retry.tokenStorage.getRefreshToken(), 'retry-R');
  assert.equal(retry.auth().getState().isLoading, false);
  fail = false;
  await retry.auth().getState().initialize();
  assert.equal(retry.auth().getState().isAuthenticated, true);
});

test('a delayed stamped /me consumer cannot overwrite the newly logged-in user', async () => {
  const r = await signedIn();
  const oldUser = await r.authApi().getMe();
  r.store.getState().setTokens(jwt('B'), 'R-B');
  r.store.getState().setUser({ id: 'B' });
  assert.throws(() => r.store.getState().setUser(oldUser), isSessionChange);
  assert.equal(r.store.getState().user.id, 'B');
});

test('an already-returned login response is rejected if a newer login starts before completion', async () => {
  const second = deferred();
  let calls = 0;
  const r = await signedIn({
    http: (q) =>
      q.url.endsWith('/email/login')
        ? ++calls === 1
          ? { data: { access_token: jwt('A'), refresh_token: 'R-first', user: { id: 'A' } } }
          : second.promise
        : basic(q),
  });
  const first = await r.authApi().loginEmail('a@example.org', 'dummy');
  const next = r.store.getState().loginWithEmail('b@example.org', 'dummy');
  await assert.rejects(r.store.getState().completeLogin(first), isSessionChange);
  second.resolve({ data: { access_token: jwt('B'), refresh_token: 'R-B', user: { id: 'B' } } });
  await next;
  assert.equal(r.store.getState().user.id, 'B');
});

test('shared-storage quota failure removes the previously published account and retains new credentials locally', async () => {
  const shared = storage();
  const a = tab({ shared });
  a.tokenStorage.setTokens(jwt('A'), 'R-A');
  const b = tab({ shared });
  assert.equal(b.tokenStorage.getRefreshToken(), 'R-A');
  const set = shared.setItem;
  shared.setItem = () => {
    throw new Error('quota');
  };
  a.tokenStorage.setTokens(jwt('B'), 'R-B');
  shared.setItem = set;
  assert.equal(a.tokenStorage.getRefreshToken(), 'R-B');
  assert.equal(b.tokenStorage.getRefreshToken(), null);
  assert.equal(shared.getItem('cabinet-session-v1'), null);
});

test('old native admin SSE is aborted and cannot deliver events after an account switch', async () => {
  const chunk = deferred();
  let requestSignal,
    events = 0;
  const r = await signedIn({
    fetch: async (_url, config) => {
      requestSignal = config.signal;
      return {
        ok: true,
        headers: { get: () => 'text/event-stream' },
        body: { getReader: () => ({ read: () => chunk.promise }) },
      };
    },
  });
  const pending = r
    .load('src/api/adminBulkActions.ts')
    .adminBulkActionsApi.executeWithStream({ action: 'add_days' }, () => events++);
  await flush();
  r.store.getState().logout();
  r.store.getState().setTokens(jwt('B'), 'R-B');
  assert.equal(requestSignal.aborted, true);
  chunk.resolve({
    done: false,
    value: new TextEncoder().encode('data: {"type":"complete","total":1}\n'),
  });
  await assert.rejects(pending, isSessionChange);
  assert.equal(events, 0);
});

test('logout from a second tab discards and revokes the first tab late refresh successor', async () => {
  const shared = storage(),
    refresh = deferred();
  const a = await signedIn({
    shared,
    http: (q) => (q.url.endsWith('/refresh') ? refresh.promise : basic(q)),
  });
  const b = tab({ shared, http: basic });
  const pending = a.tokenRefreshManager.refreshAccessToken();
  await flush();
  b.tokenStorage.clearTokens();
  refresh.resolve({ data: { access_token: jwt('A'), refresh_token: 'R-late' } });
  await assert.rejects(pending, isSessionChange);
  assert.equal(a.tokenStorage.getRefreshToken(), null);
  assert.equal(b.tokenStorage.getRefreshToken(), null);
  assert.equal(
    a.requests.some((q) => q.url.endsWith('/logout') && q.body.refresh_token === 'R-late'),
    true,
  );
});

test('older WebViews with getRandomValues but no randomUUID can log in, refresh and log out', async () => {
  const r = tab({
    crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
    http: () => ({ data: { access_token: jwt('A'), refresh_token: 'R1' } }),
  });
  r.tokenStorage.setTokens(jwt('A'), 'R0');
  await r.tokenRefreshManager.refreshAccessToken();
  assert.equal(r.tokenStorage.getRefreshToken(), 'R1');
  r.tokenStorage.clearTokens();
  assert.equal(r.tokenStorage.getRefreshToken(), null);
});

for (const raw of ['null', '{}', '"bad"', '{', '{"id": 1, "refreshToken": 42}'])
  test(`invalid fallback session record is ignored safely (${raw})`, () => {
    const denied = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
      removeItem() {
        throw new Error('denied');
      },
    };
    const fallback = storage();
    fallback.setItem('cabinet-session-v1', raw);
    const r = tab({ local: denied, session: fallback });
    assert.equal(r.tokenStorage.getRefreshToken(), null);
    assert.equal(r.tokenStorage.getAccessToken(), null);
    r.tokenStorage.setTokens(jwt('A'), 'R0');
    assert.equal(r.tokenStorage.getRefreshToken(), 'R0');
  });

test('sessionStorage denial does not disable working shared storage or delete the published session', async () => {
  const denied = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
  const shared = storage();
  const a = tab({
    shared,
    session: denied,
    locks: lockManager(),
    http: () => ({ data: { access_token: jwt('A'), refresh_token: 'R1' } }),
  });
  a.tokenStorage.setTokens(jwt('A'), 'R0');
  await a.tokenRefreshManager.refreshAccessToken();
  const b = tab({ shared });
  assert.equal(a.tokenStorage.getRefreshToken(), 'R1');
  assert.equal(b.tokenStorage.getRefreshToken(), 'R1');
});
