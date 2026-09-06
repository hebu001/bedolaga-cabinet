const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Execute the actual card and handlers; only framework/services are adapters.
function renderTrial(overrides = {}) {
  const state = { mutations: 0, retries: 0, formatted: [] };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const module = { exports: {} };
  const source = fs.readFileSync(
    path.join(root, 'src/components/dashboard/TrialOfferCard.tsx'),
    'utf8',
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2021,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require(name) {
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
        if (name === 'react-router') return { Link: 'link' };
        if (name.endsWith('/useCurrency'))
          return {
            useCurrency: () => ({
              currencySymbol: '₽',
              formatAmount: (value) => {
                state.formatted.push(value);
                return value.toFixed(2);
              },
            }),
          };
        if (name.endsWith('/useHaptic'))
          return { useHapticFeedback: () => ({ buttonPressMedium() {} }) };
        throw new Error(`Unexpected module ${name}`);
      },
    },
  );
  const tree = module.exports.default({
    trialInfo: {
      requires_payment: true,
      price_kopeks: 10000,
      duration_days: 3,
      traffic_limit_gb: 10,
      device_limit: 2,
    },
    activateTrialMutation: { isPending: false, mutate: () => state.mutations++ },
    trialError: null,
    onRetryBalance: () => state.retries++,
    ...overrides,
  });
  return { tree, state };
}
function nodes(tree) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (typeof tree !== 'object') return String(tree);
  return text(tree.props?.children);
}

test('paid trial unknown/loading/failed balances are never zero or insufficient; payment is guarded', () => {
  for (const overrides of [{}, { balanceLoading: true }, { balanceError: true }]) {
    const { tree, state } = renderTrial(overrides);
    assert.match(text(tree), /—/);
    assert.doesNotMatch(text(tree), /insufficientBalance|topUpToActivate/);
    assert.deepEqual(state.formatted, [100]);
    const activate = nodes(tree).find(
      (node) => node.type === 'button' && text(node).includes('payAndActivate'),
    );
    assert.equal(activate.props.disabled, true);
    activate.props.onClick();
    assert.equal(state.mutations, 0);
    if (overrides.balanceError) {
      assert.match(text(tree), /common.loadError/);
      nodes(tree)
        .find((node) => node.type === 'button' && text(node) === 'common.retry')
        .props.onClick();
      assert.equal(state.retries, 1);
    }
  }
});

test('known trial balance preserves activation/top-up choices and stale data blocks payment', () => {
  const available = renderTrial({ balanceKopeks: 10000, balanceRubles: 100 });
  const button = nodes(available.tree).find((node) => node.type === 'button');
  assert.equal(button.props.disabled, false);
  assert.match(button.props.className, /text-white/);
  button.props.onClick();
  assert.equal(available.state.mutations, 1);
  const insufficient = renderTrial({ balanceKopeks: 0, balanceRubles: 0 });
  assert.match(text(insufficient.tree), /0.00 ₽/);
  assert.match(text(insufficient.tree), /insufficientBalance/);
  assert.equal(nodes(insufficient.tree).find((node) => node.type === 'link').props.to, '/balance');
  const stale = renderTrial({ balanceKopeks: 10000, balanceRubles: 100, balanceError: true });
  assert.match(text(stale.tree), /common.staleData/);
  assert.equal(
    nodes(stale.tree).find(
      (node) => node.type === 'button' && text(node).includes('payAndActivate'),
    ).props.disabled,
    true,
  );
});

test('free trial stays available when the balance endpoint fails', () => {
  const { tree, state } = renderTrial({
    trialInfo: {
      requires_payment: false,
      price_kopeks: 0,
      duration_days: 3,
      traffic_limit_gb: 10,
      device_limit: 2,
    },
    balanceError: true,
  });
  assert.doesNotMatch(text(tree), /currentBalance|loadError|insufficientBalance/);
  const button = nodes(tree).find((node) => node.type === 'button');
  assert.equal(button.props.disabled, false);
  assert.match(button.props.className, /text-white/);
  button.props.onClick();
  assert.equal(state.mutations, 1);
});
