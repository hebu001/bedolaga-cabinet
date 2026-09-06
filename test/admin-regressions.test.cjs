// Execute the shipped components with a small hook host and real QueryObserver.
// Network, routing and the DOM boundary are substituted; queries and memo closures are real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { setImmediate: nextTurn } = require('node:timers/promises');
const query = require('@tanstack/react-query');
const root = path.resolve(__dirname, '..');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const element = (type, props, ...children) => ({
  type,
  props: { ...props, ...(children.length ? { children } : {}) },
});
const walk = (node) =>
  !node || typeof node !== 'object'
    ? []
    : Array.isArray(node)
      ? node.flatMap(walk)
      : [node, ...walk(node.props?.children)];
const find = (tree, predicate) => walk(tree).find(predicate);
function host(page, http) {
  let index = 0,
    dirty = true,
    tree,
    component,
    tableOptions;
  const slots = [],
    effects = [],
    timers = new Map();
  let now = 0,
    timerId = 0;
  const client = new query.QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    createElement: element,
    Fragment: 'fragment',
    useState(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [
        slots[i].value,
        (next) => {
          const value = typeof next === 'function' ? next(slots[i].value) : next;
          if (!Object.is(value, slots[i].value)) {
            slots[i].value = value;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const i = index++;
      return (slots[i] ??= { current: initial });
    },
    useMemo(fn, deps) {
      const i = index++;
      if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useCallback(fn, deps) {
      return hooks.useMemo(() => fn, deps);
    },
    useEffect(fn, deps) {
      const i = index++;
      if (!slots[i] || !equal(slots[i].deps, deps)) {
        const old = slots[i];
        slots[i] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  const requests = [];
  const get = async (url, config = {}) => {
    const request = { url, ...config };
    requests.push(request);
    return { data: await http(request) };
  };
  const table = {
    getHeaderGroups: () => [],
    getRowModel: () => ({
      rows: (tableOptions?.data ?? []).map((original) => ({
        original,
        id: String(original.id),
        getIsSelected: () => false,
        getVisibleCells: () => [],
      })),
    }),
    getToggleAllRowsSelectedHandler: () => () => {},
    getIsAllRowsSelected: () => false,
    getIsSomeRowsSelected: () => false,
  };
  const mocks = {
    react: { ...hooks, default: hooks },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    'react-dom': { createPortal: (node) => node },
    'react-router': { Link: 'a', useNavigate: () => () => {} },
    'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    '@tanstack/react-query': {
      ...query,
      useQuery(options) {
        const i = index++;
        let slot = slots[i];
        if (!slot) {
          const observer = new query.QueryObserver(client, options);
          slot = slots[i] = { observer };
          slot.unsubscribe = observer.subscribe(() => {
            dirty = true;
          });
        } else slot.observer.setOptions(options);
        return slot.observer.getCurrentResult();
      },
    },
    '@tanstack/react-table': {
      useReactTable: (options) => {
        tableOptions = options;
        return table;
      },
      getCoreRowModel: () => () => {},
      flexRender: (fn, context) => (typeof fn === 'function' ? fn(context) : fn),
    },
    '../hooks/useCurrency': { useCurrency: () => ({ formatWithCurrency: String }) },
    '../platform/hooks/usePlatform': {
      usePlatform: () => ({ capabilities: { hasBackButton: false } }),
    },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    './client': { default: { get } },
    '../api/tariffs': { tariffsApi: { getTariffs: async () => ({ tariffs: [] }) } },
    '../api/promocodes': { promocodesApi: { getPromoGroups: async () => ({ items: [] }) } },
    '../api/campaigns': { campaignsApi: { getCampaigns: async () => ({ campaigns: [] }) } },
    '../api/partners': { partnerApi: { getPartners: async () => ({ items: [] }) } },
    '../api/adminBulkActions': { adminBulkActionsApi: {} },
  };
  const cache = new Map();
  const load = (file) => {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    }).outputText;
    const requireModule = (id) => {
      if (mocks[id]) return mocks[id];
      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(file), id);
        return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx');
      }
      return require(id);
    };
    vm.runInNewContext(
      source,
      {
        exports,
        React: hooks,
        require: requireModule,
        console,
        AbortController,
        setTimeout,
        clearTimeout,
        document: { body: {} },
        window: {
          setTimeout(fn, ms) {
            const id = ++timerId;
            timers.set(id, { fn, at: now + ms });
            return id;
          },
          clearTimeout(id) {
            timers.delete(id);
          },
        },
      },
      { filename: file },
    );
    return exports;
  };
  component = load(path.join(root, 'src/pages', page + '.tsx')).default;
  function render() {
    index = 0;
    dirty = false;
    tree = component();
    while (effects.length) effects.shift()();
    return tree;
  }
  async function settle() {
    for (let i = 0; i < 10; i++) {
      if (dirty) render();
      await nextTurn();
      if (!dirty && !effects.length) break;
    }
    return tree;
  }
  return {
    render,
    settle,
    get tree() {
      return tree;
    },
    get table() {
      return table;
    },
    get columns() {
      return tableOptions.columns;
    },
    requests,
    async tick(ms) {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
      return settle();
    },
    close() {
      for (const slot of slots) {
        slot?.cleanup?.();
        slot?.unsubscribe?.();
      }
      client.clear();
    },
    load,
  };
}
const user = (id, subs = []) => ({
  id,
  full_name: `User ${id}`,
  username: `user${id}`,
  balance_rubles: 0,
  subscriptions: subs.map((id) => ({ id, is_trial: false, tariff_id: 1 })),
  subscription_is_trial: false,
});
const usersResponse = (users, total = users.length) => ({ users, total, offset: 0, limit: 20 });

test('rapid search typing commits only final input, retaining rows and resetting page atomically', async () => {
  const h = host('AdminUsers', async ({ url, params }) =>
    url.endsWith('/stats') ? {} : usersResponse([user(params?.search === 'alex' ? 2 : 1)], 60),
  );
  try {
    await h.settle();
    assert.equal(h.requests.filter((r) => r.params).length, 1);
    find(h.tree, (n) => n.props?.['aria-label'] === 'admin.users.pagination.next').props.onClick();
    await h.settle();
    for (const text of ['a', 'al', 'alex']) {
      find(h.tree, (n) => n.type === 'input' && n.props.type === 'text').props.onChange({
        target: { value: text },
      });
      await h.settle();
      await h.tick(90);
    }
    assert.equal(h.requests.filter((r) => r.params).length, 2);
    assert.ok(
      find(h.tree, (n) => n.props?.user?.id === 1),
      'loaded rows remain during debounce',
    );
    await h.tick(210);
    const list = h.requests.filter((r) => r.params);
    assert.equal(list.length, 3);
    assert.equal(list[2].params.search, 'alex');
    assert.equal(list[2].params.offset, 0);
  } finally {
    h.close();
  }
});

test('older in-flight search cannot replace the current results and receives cancellation', async () => {
  const old = deferred(),
    latest = deferred();
  const h = host('AdminUsers', ({ url, params }) =>
    url.endsWith('/stats')
      ? {}
      : params?.search === 'old'
        ? old.promise
        : params?.search === 'new'
          ? latest.promise
          : usersResponse([user(1)]),
  );
  try {
    await h.settle();
    const type = async (value) => {
      find(h.tree, (n) => n.type === 'input' && n.props.type === 'text').props.onChange({
        target: { value },
      });
      await h.settle();
      await h.tick(300);
    };
    await type('old');
    await type('new');
    const oldRequest = h.requests.find((r) => r.params?.search === 'old');
    assert.equal(oldRequest.signal.aborted, true);
    latest.resolve(usersResponse([user(3)]));
    await h.settle();
    old.resolve(usersResponse([user(2)]));
    await h.settle();
    assert.ok(find(h.tree, (n) => n.props?.user?.id === 3));
    assert.equal(
      find(h.tree, (n) => n.props?.user?.id === 2),
      undefined,
    );
  } finally {
    h.close();
  }
});

test('failed user request is an explicit retry state, never a successful empty result; row is a link', async () => {
  let fail = true;
  const h = host('AdminUsers', ({ url }) => {
    if (url.endsWith('/stats')) return {};
    if (fail) throw Error('503');
    return usersResponse([user(7)]);
  });
  try {
    await h.settle();
    const alert = find(h.tree, (n) => n.props?.role === 'alert');
    assert.ok(alert);
    assert.equal(
      find(h.tree, (n) => n.props?.children === 'admin.users.noData'),
      undefined,
    );
    fail = false;
    find(alert, (n) => n.type === 'button').props.onClick();
    await h.settle();
    const row = find(h.tree, (n) => n.props?.user?.id === 7);
    const rendered = row.type(row.props);
    assert.equal(rendered.type, 'a');
    assert.equal(rendered.props.to, '/admin/users/7');
    assert.equal(rendered.props.onClick, undefined);
  } finally {
    h.close();
  }
});

test('bulk header tracks some/all immediately and toggles only current page, keeping hidden IDs', async () => {
  const h = host('AdminBulkActions', async ({ params }) =>
    usersResponse(params.offset ? [user(2, [21])] : [user(1, [11, 12])], 100),
  );
  try {
    await h.settle();
    const header = () => h.columns[0].header({ table: h.table });
    const select = () => find(header(), (n) => n.props?.role === 'checkbox');
    assert.equal(select().props['aria-checked'], false);
    const subrow = find(h.tree, (n) => n.props?.subscription?.id === 11);
    subrow.props.onToggleSelect();
    await h.settle();
    assert.equal(select().props['aria-checked'], 'mixed');
    select().props.onClick();
    await h.settle();
    assert.equal(select().props['aria-checked'], true);
    find(h.tree, (n) => n.props?.['aria-label'] === 'common.next').props.onClick();
    await h.settle();
    assert.equal(
      select().props['aria-checked'],
      false,
      'single-subscription page keeps subscription action mode',
    );
    select().props.onClick();
    await h.settle();
    assert.equal(select().props['aria-checked'], true);
    let bar = find(h.tree, (n) => n.props?.selectedSubscriptionCount !== undefined);
    assert.equal(bar.props.selectedSubscriptionCount, 3);
    assert.equal(bar.props.allVisibleSubscriptionsSelected, true);
    select().props.onClick();
    await h.settle();
    bar = find(h.tree, (n) => n.props?.selectedSubscriptionCount !== undefined);
    assert.equal(bar.props.selectedSubscriptionCount, 2, 'hidden page selections preserved');
    assert.equal(bar.props.allVisibleSubscriptionsSelected, false);
    // Two quick events must apply to the latest state rather than lose an intermediate update.
    const callback = select().props.onClick;
    callback();
    callback();
    await h.settle();
    bar = find(h.tree, (n) => n.props?.selectedSubscriptionCount !== undefined);
    assert.equal(bar.props.selectedSubscriptionCount, 2);
  } finally {
    h.close();
  }
});

test('bulk filters refresh visible subscription IDs without clearing other selections', async () => {
  const h = host('AdminBulkActions', async () =>
    usersResponse([
      {
        ...user(1, [11, 12]),
        subscription_is_trial: true,
        subscriptions: [
          { id: 11, is_trial: true, status: 'trial', tariff_id: 1 },
          { id: 12, is_trial: false, status: 'active', tariff_id: 2 },
        ],
      },
    ]),
  );
  try {
    await h.settle();
    const header = () =>
      find(h.columns[0].header({ table: h.table }), (n) => n.props?.role === 'checkbox');
    header().props.onClick();
    await h.settle();
    const trial = find(h.tree, (n) => n.type === 'button' && n.props?.['aria-pressed'] === false);
    assert.ok(trial, 'trial filter button exists');
    trial.props.onClick();
    await h.settle();
    assert.equal(header().props['aria-checked'], true);
    header().props.onClick();
    await h.settle();
    const bar = find(h.tree, (n) => n.props?.selectedSubscriptionCount !== undefined);
    assert.equal(bar.props.selectedSubscriptionCount, 1);
    assert.equal(bar.props.totalVisibleSubscriptionCount, 1);
  } finally {
    h.close();
  }
});

test('editor initializes asynchronously in active locale once, and never resets later edits', () => {
  const file = path.join(root, 'src/pages/AdminInfoPageEditor.tsx');
  const source = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(parsed) === 'useEffect' &&
      node.arguments[0]?.getText(parsed).includes('editorPopulated.current')
    )
      effect = node;
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(effect);
  const calls = [];
  const scope = {
    pageData: { content: { ru: 'RU', en: 'EN' } },
    editor: null,
    activeLocale: 'en',
    editorPopulated: { current: false },
  };
  const callback = vm.runInNewContext(effect.arguments[0].getText(parsed), scope);
  callback();
  assert.equal(scope.editorPopulated.current, false);
  scope.editor = { commands: { setContent: (value) => calls.push(value) } };
  callback();
  assert.deepEqual(calls, ['EN']);
  scope.activeLocale = 'ru';
  scope.pageData.content.ru = 'server update';
  callback();
  assert.deepEqual(calls, ['EN']);
  assert.ok(
    effect.arguments[1].elements.some((node) => node.getText(parsed) === 'activeLocale'),
    'locale is a dependency when the editor becomes ready',
  );
});

test('bulk page requests ignore late completions and show explicit retry after a failure', async () => {
  const old = deferred();
  let nextPageRequests = 0;
  const h = host('AdminBulkActions', ({ params }) => {
    if (!params.offset) return usersResponse([user(1, [11, 12])], 100);
    nextPageRequests += 1;
    if (nextPageRequests === 1) return old.promise;
    if (nextPageRequests === 2) throw Error('503');
    return usersResponse([user(2, [21, 22])], 100);
  });
  try {
    await h.settle();
    find(h.tree, (node) => node.props?.['aria-label'] === 'common.next').props.onClick();
    await h.settle();
    // Return while the second page is still in flight.
    const previous = walk(h.tree)
      .filter((node) => node.props?.['aria-label'] === 'common.back')
      .pop();
    previous.props.onClick();
    await h.settle();
    assert.equal(h.requests[1].signal.aborted, true);
    old.resolve(usersResponse([user(9, [91, 92])], 100));
    await h.settle();
    assert.ok(find(h.tree, (node) => node.props?.subscription?.id === 11));
    assert.equal(
      find(h.tree, (node) => node.props?.subscription?.id === 91),
      undefined,
    );
    find(h.tree, (node) => node.props?.['aria-label'] === 'common.next').props.onClick();
    await h.settle();
    const alert = find(h.tree, (node) => node.props?.role === 'alert');
    assert.ok(alert);
    find(alert, (node) => node.type === 'button').props.onClick();
    await h.settle();
    assert.equal(
      find(h.tree, (node) => node.props?.role === 'alert'),
      undefined,
    );
    assert.ok(find(h.tree, (node) => node.props?.subscription?.id === 21));
  } finally {
    h.close();
  }
});
