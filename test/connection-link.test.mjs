import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  resolveConnectionUrlForUi,
  resolvePlainSubscriptionUrl,
} from '../src/utils/connectionLink.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = require('react');
const source = fs.readFileSync(new URL('../src/pages/Connection.tsx', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderConnection(configQuery, linkQuery) {
  const InstallationGuide = () => null;
  const module = { exports: {} };
  const configRefetch = [];
  const linkRefetch = [];
  const mocks = {
    react: { ...react, useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect: () => {} },
    'react-router': {
      Link: 'a',
      useNavigate: () => () => {},
      useSearchParams: () => [new URLSearchParams()],
    },
    'react-i18next': { useTranslation: () => ({ t: (key) => key, i18n: { language: 'ru' } }) },
    '@tanstack/react-query': {
      useQuery: ({ queryKey }) =>
        queryKey[0] === 'appConfig'
          ? { refetch: () => configRefetch.push(true), ...configQuery }
          : { refetch: () => linkRefetch.push(true), ...linkQuery },
    },
    '@telegram-apps/sdk-react': { openLink: () => {} },
    '../api/subscription': { subscriptionApi: {} },
    '../hooks/useTelegramSDK': { useTelegramSDK: () => ({ isTelegramWebApp: false }) },
    '../platform/hooks/useHaptic': { useHapticFeedback: () => ({ buttonPressMedium: () => {} }) },
    '../utils/templateEngine': { hasTemplates: () => false, resolveTemplate: (url) => url },
    '../utils/connectionLink': {
      resolveConnectionUrlForUi,
      resolvePlainSubscriptionUrl,
      isHappCryptolinkMode: () => false,
    },
    '../store/auth': {
      useAuthStore: (selector) => selector({ user: { username: 'fixture' }, isAdmin: false }),
    },
    '../components/connection/InstallationGuide': { default: InstallationGuide },
  };
  new Function('exports', 'require', 'module', output)(
    module.exports,
    (id) => mocks[id] ?? require(id),
    module,
  );
  return { element: module.exports.default(), InstallationGuide, configRefetch, linkRefetch };
}

function findElement(element, predicate) {
  if (!element || typeof element !== 'object') return null;
  if (predicate(element)) return element;
  for (const child of react.Children.toArray(element.props?.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

const configFixture = {
  hasSubscription: true,
  subscriptionUrl: 'https://example.test/sub/token',
  platforms: { android: { apps: [{}] } },
};
const linkFixture = {
  subscription_url: 'https://example.test/sub/token',
  happ_crypto_link: 'happ://crypt4/fixture',
};

test('cached connection errors preserve the wizard slot and offer retry without replacing setup', () => {
  const ready = renderConnection({ data: configFixture }, { data: linkFixture });
  const stale = renderConnection(
    { data: configFixture, error: new Error('503') },
    { data: linkFixture, isError: true },
  );
  const readySlot = ready.element.props.children[1];
  const staleSlot = stale.element.props.children[1];
  assert.equal(ready.element.type, stale.element.type);
  assert.equal(readySlot.type, staleSlot.type);
  assert.equal(readySlot.props.children.type, ready.InstallationGuide);
  assert.equal(staleSlot.props.children.type, stale.InstallationGuide);
  assert.equal(staleSlot.props.children.props.connectionUrl, 'happ://crypt4/fixture');
  const alert = findElement(stale.element, (element) => element.props?.role === 'alert');
  assert.ok(alert);
  findElement(alert, (element) => element.type === 'button').props.onClick();
  assert.equal(stale.configRefetch.length, 1);
  assert.equal(stale.linkRefetch.length, 1);
});

test('cold connection failure has retry and does not mount a wizard with missing data', () => {
  const cold = renderConnection({ error: new Error('503') }, {});
  assert.equal(cold.element.props.role, 'alert');
  assert.equal(
    findElement(cold.element, (element) => element.type === cold.InstallationGuide),
    null,
  );
});

test('either connection response can require hiding the ordinary subscription URL', () => {
  for (const [configHidden, linkHidden] of [
    [true, false],
    [false, true],
  ]) {
    const rendered = renderConnection(
      { data: { ...configFixture, hideLink: configHidden } },
      { data: { ...linkFixture, hide_link: linkHidden } },
    );
    const guide = findElement(
      rendered.element,
      (element) => element.type === rendered.InstallationGuide,
    );
    assert.equal(guide.props.hideLink, true);
  }
});

test('ordinary display/copy uses raw backend URL while native launch keeps saved crypt4', () => {
  const input = {
    mode: 'HAPP_CRYPTOLINK',
    subscriptionUrl: 'https://example.test/sub/token',
    happCryptoLink: 'happ://crypt4/encrypted',
  };
  assert.equal(resolvePlainSubscriptionUrl(input), 'https://example.test/sub/token');
  assert.equal(resolveConnectionUrlForUi(input), 'happ://crypt4/encrypted');
});

test('ordinary display falls back to subscription response if connection endpoint supplies only crypt', () => {
  assert.equal(
    resolvePlainSubscriptionUrl({
      subscriptionUrl: 'happ://crypt4/encrypted',
      displayLink: 'happ://crypt4/encrypted',
      fallbackUrl: 'https://example.test/sub/token',
    }),
    'https://example.test/sub/token',
  );
});

test('ciphertext alone is never relabelled as an ordinary URL', () => {
  assert.equal(
    resolvePlainSubscriptionUrl({
      subscriptionUrl: 'happ://crypt4/encrypted',
      displayLink: 'happ://sub/secret',
      happCryptoLink: 'happ://crypt4/encrypted',
    }),
    null,
  );
});

test('missing links produce no copy value', () => {
  assert.equal(resolvePlainSubscriptionUrl({}), null);
  assert.equal(resolvePlainSubscriptionUrl({ subscriptionUrl: '', fallbackUrl: null }), null);
});

test('prepared crypt link remains QR/native value regardless of mode spelling', () => {
  assert.equal(
    resolveConnectionUrlForUi({
      mode: 'legacy',
      subscriptionUrl: 'https://example.test/sub/token',
      happCryptoLink: 'happ://crypt5/backend-value',
    }),
    'happ://crypt5/backend-value',
  );
});
