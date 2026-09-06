import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { setImmediate as flush } from 'node:timers/promises';
import * as flow from '../src/utils/topUpFlow.ts';
import * as statuses from '../src/utils/paymentStatus.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..');
const noop = () => {};
const method = {
  id: 'card',
  name: 'Card',
  is_available: true,
  min_amount_kopeks: 10000,
  max_amount_kopeks: 50000,
};

// Execute the actual TSX with deterministic hook/transport adapters. Keep JSX,
// handlers, amount calculations, state branches and query options unmodified.
function loadComponent(relative, options = {}) {
  const state = {
    queries: [],
    effects: [],
    invoices: [],
    navigations: [],
    updates: [],
    mutations: [],
    cleared: 0,
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const queryClient = { invalidateQueries: noop };
  let id = 0;
  let stateIndex = 0;
  const hookState = [];
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (options.persistentHooks && index in hookState)
        return [hookState[index], (next) => state.updates.push(next)];
      const value = typeof initial === 'function' ? initial() : initial;
      hookState[index] = value;
      return [value, (next) => state.updates.push(next)];
    },
    useRef: (current) => ({ current }),
    useId: () => `id-${++id}`,
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect: (fn) => state.effects.push(fn),
  };
  const t = (key, fallback, params) => {
    const variables = typeof fallback === 'object' ? fallback : (params ?? {});
    const value = typeof fallback === 'string' ? fallback : (variables.defaultValue ?? key);
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => variables[name] ?? `{{${name}}}`);
  };
  const balanceApi = {
    async createTopUp(...args) {
      state.invoices.push(args);
      return {};
    },
    async createStarsInvoice(...args) {
      state.invoices.push(args);
      return {};
    },
    async getPendingPayment(...args) {
      state.invoices.push(args.slice(0, 2));
      return options.payment;
    },
  };
  const modules = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'react-dom': { createPortal: (node) => node },
    'react-router': {
      useSearchParams: () => [new URLSearchParams(options.search)],
      useNavigate: () => (url) => state.navigations.push(url),
      useParams: () => ({ token: 'order-42', subscriptionId: '42' }),
    },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'ru' } }) },
    '@tanstack/react-query': {
      useQuery(config) {
        state.queries.push(config);
        return {
          data: options.queryData?.[config.queryKey[0]],
          isError: options.isError ?? false,
          isPending: false,
          isFetching: false,
          refetch: async () => state.updates.push('refetch'),
        };
      },
      useQueryClient: () => queryClient,
      useMutation: (config) => {
        state.mutations.push(config);
        return {
          isPending: false,
          mutate: (...args) => config.mutationFn(...args),
        };
      },
    },
    'framer-motion': {
      motion: new Proxy({}, { get: (_, name) => name }),
      AnimatePresence: 'presence',
    },
  };
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    console,
    URLSearchParams,
    Date: options.Date ?? Date,
    setTimeout,
    window: options.window ?? { setTimeout, clearTimeout },
    document: {
      body: {},
      createElement: () => ({}),
      head: { appendChild: noop, removeChild: noop },
    },
    require(specifier) {
      if (modules[specifier]) return modules[specifier];
      if (specifier.endsWith('/topUpFlow')) return flow;
      if (specifier.endsWith('/paymentStatus')) return statuses;
      if (specifier.endsWith('/topUpStorage'))
        return {
          loadTopUpPendingInfo: (userId) =>
            options.loadSaved ? options.loadSaved(userId) : (options.saved ?? null),
          clearTopUpPendingInfo: () => state.cleared++,
          saveTopUpPendingInfo: noop,
        };
      if (specifier.endsWith('/api/balance')) return { balanceApi };
      if (specifier.endsWith('/api/landings')) return { landingApi: { getPurchaseStatus: noop } };
      if (specifier === 'qrcode.react') return { QRCodeSVG: () => null };
      if (specifier.endsWith('/api/auth')) return { authApi: {} };
      if (specifier.endsWith('/utils/clipboard')) return { copyToClipboard: noop };
      if (specifier.endsWith('/lib/utils')) return { cn: (...values) => values.join(' ') };
      if (specifier.endsWith('/api/subscription'))
        return { subscriptionApi: { renewSubscription: (...args) => state.invoices.push(args) } };
      if (specifier.endsWith('/store/auth'))
        return { useAuthStore: (selector) => selector({ refreshUser: noop, user: options.user }) };
      if (specifier.endsWith('/useCurrency'))
        return {
          useCurrency: () => ({
            formatAmount: (rub) => rub.toFixed(2),
            currencySymbol: '₽',
            convertToRub: (amount) => amount,
          }),
        };
      if (specifier.endsWith('/rateLimit'))
        return {
          checkRateLimit: () => true,
          getRateLimitResetTime: () => 0,
          RATE_LIMIT_KEYS: { PAYMENT: 'payment' },
        };
      if (specifier.endsWith('/successNotification'))
        return { useCloseOnSuccessNotification: noop };
      if (specifier.endsWith('/useModalFocus')) return { useModalFocus: noop };
      if (specifier === '@/platform' || specifier.endsWith('/platform'))
        return { usePlatform: () => ({}), useHaptic: () => ({ notification: noop, impact: noop }) };
      if (
        /Spinner|AnimatedCheckmark|AnimatedCrossmark|InsufficientBalancePrompt|WebBackButton/.test(
          specifier,
        )
      )
        return new Proxy({}, { get: (_, name) => (name === '__esModule' ? true : () => null) });
      throw new Error(`Unexpected module ${specifier}`);
    },
  };
  vm.runInNewContext(compiled, context, { filename: relative });
  const render = (props) => {
    stateIndex = 0;
    return module.exports.default(props);
  };
  return { state, render };
}
function nodes(tree) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (typeof tree.type === 'function') return text(tree.type(tree.props));
  return text(tree.props?.children);
}

test('fixed shortage below provider minimum: visible amount, explanation, CTA and actual invoice agree', async () => {
  const harness = loadComponent('src/components/balance/TopUpPanel.tsx');
  const tree = harness.render({ methods: [method], fixedAmountKopeks: 1000, onSuccess: noop });
  assert.match(text(tree), /Минимум этого способа — 100\.00 ₽/);
  assert.match(text(tree), /90\.00 ₽ останется/);
  const pay = nodes(tree).find(
    (node) => node.type === 'button' && text(node).includes('Пополнить на'),
  );
  assert.equal(text(pay), 'Пополнить на 100.00 ₽');
  assert.equal(pay.props.disabled, false);
  pay.props.onClick();
  await Promise.resolve();
  assert.deepEqual(harness.state.invoices, [[10000, 'card', undefined]]);
});

test('fixed amount above maximum never creates a smaller, insufficient invoice', () => {
  const harness = loadComponent('src/components/balance/TopUpPanel.tsx');
  const tree = harness.render({ methods: [method], fixedAmountKopeks: 60000, onSuccess: noop });
  assert.match(text(tree), /Максимум этого способа — 500\.00 ₽/);
  const pay = nodes(tree).find(
    (node) => node.type === 'button' && text(node).includes('Пополнить на'),
  );
  assert.equal(pay.props.disabled, true);
  pay.props.onClick(); // Handler must also guard keyboard/programmatic activation.
  assert.equal(harness.state.invoices.length, 0);
});

test('provider and Stars preparation errors stop invoice creation and expose only the safe local message', async () => {
  const harness = loadComponent('src/components/balance/TopUpPanel.tsx');
  harness.render({
    methods: [method],
    fixedAmountKopeks: 1000,
    onSuccess: noop,
    onBeforeTopUp: async () => {
      throw new flow.TopUpPreparationError('Review the changed amount');
    },
  });
  assert.equal(harness.state.mutations.length, 2);
  for (const mutation of harness.state.mutations) {
    let failure;
    await assert.rejects(mutation.mutationFn(10000), (error) => {
      failure = error;
      return error instanceof flow.TopUpPreparationError;
    });
    mutation.onError(failure);
    assert.equal(harness.state.updates.at(-1), 'Review the changed amount');
    mutation.onError(new Error('opaque transport internals'));
    assert.notEqual(harness.state.updates.at(-1), 'opaque transport internals');
  }
  assert.equal(harness.state.invoices.length, 0);
});

test('switching method recalculates the displayed payable amount, including exact minimum/maximum', () => {
  for (const requested of [10000, 50000])
    assert.equal(flow.getTopUpQuote(requested, 10000, 50000).payable, requested);
  assert.equal(flow.getTopUpQuote(1000, 0, 50000).payable, 1000);
  assert.equal(flow.getTopUpQuote(1000, 10000, 50000).payable, 10000);
  for (const bad of [NaN, Infinity, 0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(flow.getTopUpQuote(bad).valid, false);
});

test('provider success URL alone renders unverified, never paid and never queries latest', () => {
  const harness = loadComponent('src/pages/TopUpResult.tsx', {
    search: 'status=success&method=card',
  });
  const tree = harness.render();
  assert.match(text(tree), /Не удалось проверить платёж/);
  assert.doesNotMatch(text(tree), /balance\.topUpResult\.success/);
  assert.equal(harness.state.queries.length, 1);
  assert.equal(harness.state.queries[0].enabled, false);
  assert.equal(harness.state.cleared, 0);
});

test('success URL still polls exact saved payment and pending API cannot become success', async () => {
  const saved = { method_id: 'card', payment_id: '42', local_payment_id: 42, amount_kopeks: 10000 };
  const payment = {
    id: 42,
    method: 'card',
    is_paid: false,
    status: 'pending',
    amount_kopeks: 10000,
  };
  const harness = loadComponent('src/pages/TopUpResult.tsx', {
    search: 'success=true',
    saved,
    payment,
    queryData: { 'topup-status': payment },
  });
  assert.match(text(harness.render()), /balance\.topUpResult\.awaitingPayment/);
  assert.equal(harness.state.queries[0].enabled, true);
  await harness.state.queries[0].queryFn({});
  assert.deepEqual(harness.state.invoices, [['card', 42]]);
  assert.equal(harness.state.cleared, 0);
});

test('token-only sign-in reloads the saved payment when the authenticated user arrives', async () => {
  const saved = {
    user_id: 7,
    method_id: 'card',
    payment_id: '42',
    local_payment_id: 42,
    amount_kopeks: 10000,
  };
  const options = {
    search: 'success=true',
    persistentHooks: true,
    user: undefined,
    loadSaved: (userId) => (userId === saved.user_id ? saved : null),
    payment: { id: 42, method: 'card', is_paid: false, status: 'pending', amount_kopeks: 10000 },
  };
  const harness = loadComponent('src/pages/TopUpResult.tsx', options);
  harness.render();
  assert.equal(harness.state.queries.at(-1).enabled, false);
  options.user = { id: 7 };
  harness.render();
  assert.equal(harness.state.queries.at(-1).enabled, true);
  await harness.state.queries.at(-1).queryFn({});
  assert.deepEqual(harness.state.invoices, [['card', 42]]);
  options.user = { id: 8 };
  harness.render();
  assert.equal(harness.state.queries.at(-1).enabled, false);
});

test('server-confirmed exact payment can show success and retain renewal destination', () => {
  const payment = {
    id: 42,
    method: 'card',
    is_paid: true,
    status: 'completed',
    amount_kopeks: 10000,
  };
  const saved = {
    method_id: 'card',
    payment_id: '42',
    local_payment_id: 42,
    amount_kopeks: 10000,
    return_to: '/subscriptions/3/renew?period=90',
  };
  const harness = loadComponent('src/pages/TopUpResult.tsx', {
    saved,
    queryData: { 'topup-status': payment },
  });
  assert.match(text(harness.render()), /balance\.topUpResult\.success/);
  assert.match(text(harness.render()), /Продолжить покупку/);
});

test('exact URL ID takes priority over saved order and a mismatched API response is rejected', async () => {
  const saved = { method_id: 'card', payment_id: '12', local_payment_id: 12, amount_kopeks: 10000 };
  assert.deepEqual(
    flow.getTopUpIdentity(new URLSearchParams('local_payment_id=42&method=card'), saved),
    { id: 42, method: 'card' },
  );
  const harness = loadComponent('src/pages/TopUpResult.tsx', {
    search: 'local_payment_id=42&method=card',
    saved,
    payment: { id: 12, method: 'card', is_paid: true },
  });
  harness.render();
  await assert.rejects(harness.state.queries[0].queryFn({}), /identity mismatch/);
  assert.equal(
    flow.getTopUpIdentity(new URLSearchParams('payment_id=42&method=card'), saved),
    null,
  );
  assert.equal(
    flow.getTopUpIdentity(new URLSearchParams(), {
      method_id: 'cryptobot',
      payment_id: '42',
      amount_kopeks: 10000,
    }),
    null,
  );
  for (const value of ['42junk', '4.2', '0', '-3', '9007199254740993'])
    assert.equal(flow.parsePaymentId(value), null);
  assert.equal(
    flow.getTopUpIdentity(new URLSearchParams('payment_id=bad&method=card'), saved),
    null,
  );
  assert.equal(flow.getTopUpIdentity(new URLSearchParams('method=other'), saved), null);
});

test('both result pages stop on the absolute deadline without ever receiving data', () => {
  let now = 1000;
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  for (const page of ['TopUpResult', 'PurchaseSuccess']) {
    now = 1000;
    const timers = [];
    const harness = loadComponent(`src/pages/${page}.tsx`, {
      Date: Clock,
      saved: { payment_id: '42', local_payment_id: 42, method_id: 'card', amount_kopeks: 10000 },
      window: {
        setTimeout: (fn, ms) => {
          timers.push({ fn, ms });
          return 1;
        },
        clearTimeout: noop,
      },
    });
    harness.render();
    const config = harness.state.queries[0];
    assert.equal(config.refetchInterval({ state: {} }), 3000);
    now += 600000;
    assert.equal(config.refetchInterval({ state: {} }), false, page);
    // No fetch success is required to schedule the timeout UI.
    harness.state.effects.forEach((effect) => effect());
    assert.equal(timers.length, 1, page);
    assert.equal(timers[0].ms, 0);
    timers[0].fn();
    assert.ok(harness.state.updates.includes(true));
  }
});

test('purchase verification outage shows unknown and retry, only server failed shows failure', () => {
  const outage = loadComponent('src/pages/PurchaseSuccess.tsx', { isError: true });
  const unknownTree = outage.render();
  assert.match(text(unknownTree), /Не удалось проверить платёж/);
  assert.doesNotMatch(text(unknownTree), /landing\.purchaseFailed/);
  const failed = loadComponent('src/pages/PurchaseSuccess.tsx', {
    queryData: { 'purchase-status': { status: 'failed' } },
  });
  assert.match(text(failed.render()), /landing\.purchaseFailed/);
});

test('renewal insufficient-funds CTA opens top-up with exact shortage and selected period, without renewing', () => {
  const harness = loadComponent('src/pages/RenewSubscription.tsx', {
    search: 'period=90',
    queryData: {
      'renewal-options': [{ period_days: 90, price_kopeks: 10000, discount_percent: 0 }],
      'purchase-options': { balance_kopeks: 8500 },
    },
  });
  const tree = harness.render();
  const button = nodes(tree)
    .filter((node) => node.type === 'button')
    .at(-1);
  button.props.onClick();
  const destination = new URL(harness.state.navigations[0], 'https://cabinet.example');
  assert.equal(destination.pathname, '/balance');
  assert.equal(destination.searchParams.get('amountKopeks'), '1500');
  assert.equal(destination.searchParams.get('returnTo'), '/subscriptions/42/renew?period=90');
  assert.equal(harness.state.invoices.length, 0);
});

test('return paths allow only intended local subscription routes', () => {
  assert.equal(
    flow.safeTopUpReturnPath('/subscriptions/42/renew?period=90'),
    '/subscriptions/42/renew?period=90',
  );
  for (const value of [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/subscriptions/../admin',
    '/balance?payment=success',
    'javascript:alert(1)',
  ])
    assert.equal(flow.safeTopUpReturnPath(value), undefined);
});

// Read actual query declarations through the TS AST; compare the values used by
// two subscriptions with identical selections, then execute mutation guards.
test('classic and tariff-switch pricing keys isolate subscription IDs; fetching/errors block confirmation', () => {
  const source = fs.readFileSync(path.join(root, 'src/pages/SubscriptionPurchase.tsx'), 'utf8');
  const ast = ts.createSourceFile('SubscriptionPurchase.tsx', source, ts.ScriptTarget.Latest, true);
  const selected = new Map();
  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      const name = node.declarationList.declarations[0]?.name.getText(ast);
      if (
        name?.includes('data: preview,') ||
        name?.includes('data: switchPreview,') ||
        name === 'purchaseMutation' ||
        name === 'switchTariffMutation'
      )
        selected.set(name, node.getText(ast));
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const keyDeclarations = [...selected.entries()]
    .filter(([name]) => name.startsWith('{'))
    .map(([, value]) => value)
    .join('\n');
  for (const id of [1, 2]) {
    const calls = [];
    const context = {
      subscriptionId: id,
      currentSelection: { days: 30 },
      switchTariffId: 8,
      selectedPeriod: {},
      showPurchaseForm: true,
      currentStep: 'confirm',
      subscriptionApi: {},
      useQuery: (config) => {
        calls.push(config);
        return {};
      },
    };
    vm.runInNewContext(
      ts.transpileModule(keyDeclarations, { compilerOptions: { target: ts.ScriptTarget.ES2021 } })
        .outputText,
      context,
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[0].queryKey[1], id);
    assert.equal(calls[1].queryKey[1], id);
  }
  for (const [name, loading, error, data] of [
    ['purchaseMutation', 'previewLoading', 'previewError', 'preview'],
    ['switchTariffMutation', 'switchPreviewLoading', 'switchPreviewError', 'switchPreview'],
  ]) {
    for (const blockedBy of [loading, error]) {
      const context = {
        [loading]: false,
        [error]: false,
        [blockedBy]: true,
        [data]: { can_purchase: true, can_switch: true },
        useMutation: (config) => {
          context.config = config;
        },
        t: () => 'Unavailable',
        subscriptionApi: {
          submitPurchase: () => assert.fail('must not purchase'),
          switchTariff: () => assert.fail('must not switch'),
        },
      };
      vm.runInNewContext(
        ts.transpileModule(selected.get(name), {
          compilerOptions: { target: ts.ScriptTarget.ES2021 },
        }).outputText,
        context,
      );
      assert.throws(() => context.config.mutationFn(8), /Unavailable/);
    }
  }
});

function loadBalanceApi({ invoice, records = [], detail, onGet } = {}) {
  const requests = [];
  const transport = {
    post: async (url, body) => {
      requests.push({ url, body });
      return { data: invoice };
    },
    get: async (url, config) => {
      requests.push({ url, config });
      if (onGet) return onGet(url, config);
      if (url.endsWith('/pending-payments')) return { data: { items: records, pages: 1, page: 1 } };
      if (detail) return { data: detail };
      throw { response: { status: 404 } };
    },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, 'src/api/balance.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    AbortController,
    setTimeout,
    clearTimeout,
    require: (specifier) => {
      if (specifier === './client') return { default: transport };
      if (specifier === '../i18n') return { default: { language: 'ru' } };
      if (specifier === '../utils/topUpFlow') return flow;
      throw new Error(specifier);
    },
  });
  return { api: module.exports.balanceApi, requests };
}

test('CryptoBot numeric provider ID cannot resolve to an unrelated paid local database ID', async () => {
  const created = {
    method: 'cryptobot',
    reference: '42',
    paymentUrl: 'https://t.me/new-invoice',
    amountKopeks: 10000,
  };
  const oldPaid = {
    id: 42,
    method: 'cryptobot',
    identifier: 'old-provider-id',
    payment_url: 'https://t.me/old-invoice',
    amount_kopeks: 10000,
    is_paid: true,
  };
  const correct = {
    id: 9,
    method: 'cryptobot',
    identifier: '42',
    payment_url: created.paymentUrl,
    amount_kopeks: 10000,
    is_paid: false,
  };
  const harness = loadBalanceApi({
    invoice: { payment_id: '42', payment_url: created.paymentUrl, amount_kopeks: 10000 },
    records: [oldPaid, correct],
    detail: oldPaid,
  });
  const invoice = await harness.api.createTopUp(10000, 'cryptobot');
  assert.equal(invoice.payment_id, '42');
  assert.equal(invoice.local_payment_id, 9);
  assert.equal(
    harness.requests.some((request) => request.url.endsWith('/cryptobot/42')),
    false,
  );
  assert.equal(flow.matchesCreatedPayment(oldPaid, created), false);
  assert.equal(flow.matchesCreatedPayment({ ...correct, identifier: '43' }, created), false);
  assert.equal(flow.matchesCreatedPayment({ ...correct, payment_url: null }, created), false);
});

test('missing exact resolution preserves invoice but never fabricates a verified local ID', async () => {
  const harness = loadBalanceApi({
    invoice: {
      payment_id: '123',
      payment_url: 'https://provider.example/123',
      amount_kopeks: 10000,
    },
  });
  const invoice = await harness.api.createTopUp(10000, 'platega');
  assert.equal(invoice.local_payment_id, undefined);
  assert.equal(invoice.payment_id, '123');
  assert.equal(
    harness.requests.filter((request) => request.url.endsWith('/pending-payments')).length,
    1,
  );
  await assert.rejects(
    harness.api.resolveCreatedPayment({
      method: 'tribute',
      reference: 'tribute_user_10000',
      paymentUrl: 'https://provider.example/generic',
      amountKopeks: 10000,
    }),
    /identity unavailable/,
  );
});

test('tariff cart preflight accepts only expected 402; completed purchase skips the invoice', async () => {
  const source = fs.readFileSync(path.join(root, 'src/pages/SubscriptionPurchase.tsx'), 'utf8');
  const ast = ts.createSourceFile('SubscriptionPurchase.tsx', source, ts.ScriptTarget.Latest, true);
  let callback;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onBeforeTopUp')
      callback = node.initializer.expression.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback);
  const { AxiosError } = require('axios');
  for (const [status, missingKopeks] of [
    [200],
    [503],
    [402, 1000],
    [402, 2000],
    [402, 500],
    [402, undefined],
    [402, 0],
    [402, 1.5],
    [402, '1000'],
  ]) {
    const state = { navigation: null, sheet: null };
    const context = {
      AxiosError,
      TopUpPreparationError: flow.TopUpPreparationError,
      topUpSheet: { tariffId: 3, periodDays: 90, trafficGb: 20, missingKopeks: 1000 },
      setTopUpSheet: (sheet) => {
        state.sheet = sheet;
      },
      t: (key) => key,
      queryClient: { invalidateQueries: noop },
      navigate: (url) => {
        state.navigation = url;
      },
      subscriptionApi: {
        purchaseTariff: async () => {
          if (status !== 200)
            throw new AxiosError('Failure', 'ERR_BAD_RESPONSE', undefined, undefined, {
              status,
              data: { detail: { missing_amount: missingKopeks } },
            });
        },
      },
    };
    vm.runInNewContext(
      ts.transpileModule(`globalThis.prepare = ${callback}`, {
        compilerOptions: { target: ts.ScriptTarget.ES2021 },
      }).outputText,
      context,
    );
    if (status === 503) await assert.rejects(context.prepare(), /Failure/);
    else if (status === 402 && (!Number.isSafeInteger(missingKopeks) || missingKopeks <= 0)) {
      await assert.rejects(context.prepare(), /common.loadError/);
      assert.equal(state.sheet, null);
    } else if (status === 402 && missingKopeks !== 1000) {
      await assert.rejects(context.prepare(), /balance.amountChanged/);
      assert.equal(state.sheet.missingKopeks, missingKopeks);
      assert.equal(state.sheet.tariffId, 3);
      assert.equal(state.sheet.trafficGb, 20);
      // Reconfirmation uses the freshly displayed quote and only then succeeds.
      context.topUpSheet = state.sheet;
      assert.equal(await context.prepare(), undefined);
    } else assert.equal(await context.prepare(), status === 200 ? false : undefined);
    assert.equal(state.navigation, status === 200 ? '/subscriptions' : null);
  }
});

test('three-second resolution deadline aborts lookup but preserves the created invoice URL', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const harness = loadBalanceApi({
    invoice: {
      payment_id: '42',
      payment_url: 'https://provider.example/new-invoice',
      amount_kopeks: 10000,
    },
    onGet: async (_url, config) => {
      signal = config.signal;
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }),
      );
    },
  });
  const creation = harness.api.createTopUp(10000, 'cryptobot');
  await flush();
  assert.equal(signal?.aborted, false);
  t.mock.timers.tick(3000);
  const invoice = await creation;
  assert.equal(signal.aborted, true);
  assert.equal(invoice.payment_url, 'https://provider.example/new-invoice');
  assert.equal(invoice.local_payment_id, undefined);
});
