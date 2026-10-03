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
    '@/components/icons': { PhoneIcon: () => null, SettingsIcon: () => null },
    '@/components/ui/skeleton': { Skeleton: () => null, SkeletonGroup: () => null },
    '@/components/common/PageLoadingIndicator': { PageLoadingIndicator: () => null },
    '../utils/openAppScheme': { openAppScheme: () => {} },
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

test('prepared crypt link remains native launch value regardless of mode spelling', () => {
  assert.equal(
    resolveConnectionUrlForUi({
      mode: 'legacy',
      subscriptionUrl: 'https://example.test/sub/token',
      happCryptoLink: 'happ://crypt5/backend-value',
    }),
    'happ://crypt5/backend-value',
  );
});

const QRCodeSVG = () => null;
const plainUrl = 'https://example.test/sub/Token%2FCase?format=raw&x=a%2Bb#device';

// Run the real TSX branches with deterministic hooks. Only adapters are mocked;
// QR payload selection, client launch handlers and hide-link conditions run as written.
function loadConnectionComponent(file, { step = 0, state, expose = '' } = {}) {
  let hookIndex = 0;
  const effects = [];
  const navigations = [];
  const componentModule = { exports: {} };
  const mocks = {
    react: {
      ...react,
      useState: (initial) => [hookIndex++ === 0 ? step : initial, () => {}],
      useMemo: (fn) => fn(),
      useCallback: (fn) => fn,
      useRef: (current) => ({ current }),
      useEffect: (fn) => effects.push(fn),
    },
    'react-router': {
      useLocation: () => ({ state }),
      useNavigate: () => (path, options) => navigations.push({ path, options }),
    },
    'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    'framer-motion': { AnimatePresence: 'animation', motion: { div: 'div' } },
    'qrcode.react': { QRCodeSVG },
    '@/utils/clipboard': { copyToClipboard: async () => {} },
    '../utils/clipboard': { copyToClipboard: async () => {} },
    '../../hooks/useModalFocus': { useModalFocus: () => {} },
    '../../platform/hooks/useHaptic': {
      useHapticFeedback: () => ({ buttonPressMedium: () => {} }),
    },
    '../../platform/hooks/usePlatform': { usePlatform: () => ({ openLink: () => {} }) },
    './ProgressRing': { default: () => null },
    '../../utils/connectionLink': { resolvePlainSubscriptionUrl },
    '../utils/connectionLink': { resolvePlainSubscriptionUrl },
    '../hooks/useBranding': { useBranding: () => ({ appName: 'Fixture' }) },
    '@/components/admin': { AdminBackButton: () => null },
    '@tanstack/react-query': {},
    '../api/landings': {},
    '../api/auth': {},
    '../store/auth': {},
    '@/components/icons': {},
    '@/components/ui/Spinner': {},
    '@/components/ui/AnimatedCheckmark': { AnimatedCheckmark: () => null },
    '@/components/ui/AnimatedCrossmark': {},
    '../lib/utils': { cn: (...classes) => classes.join(' ') },
  };
  const componentSource = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const componentOutput = ts.transpileModule(componentSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('exports', 'require', 'module', `${componentOutput}\n${expose}`)(
    componentModule.exports,
    (id) => mocks[id] ?? require(id),
    componentModule,
  );
  return { component: componentModule.exports.default, effects, navigations };
}

function renderWizard({
  client = 'Happ',
  subscriptionUrl = plainUrl,
  displayUrl,
  hideLink,
  step = 3,
} = {}) {
  const clientLink =
    client === 'INCY' ? 'incy://crypt1/client-fixture' : 'happ://crypt4/client-fixture';
  const launchUrls = [];
  const { component } = loadConnectionComponent('components/connection/SetupWizard.tsx', { step });
  const element = component({
    appConfig: {
      subscriptionUrl,
      platforms: {
        android: {
          apps: [
            {
              name: client,
              deepLink: clientLink,
              blocks: [{ buttons: [{ type: 'subscriptionLink', resolvedUrl: clientLink }] }],
            },
          ],
        },
      },
    },
    displayUrl,
    hideLink,
    connectionUrl: 'happ://crypt4/connection-fixture',
    onOpenDeepLink: (url) => launchUrls.push(url),
    onGoBack: () => {},
  });
  return { element, launchUrls, clientLink };
}

for (const client of ['Happ', 'INCY']) {
  test(`${client} wizard QR contains the exact ordinary subscription URL instead of either crypt link`, () => {
    const { element } = renderWizard({ client });
    assert.equal(findElement(element, (node) => node.type === QRCodeSVG).props.value, plainUrl);
  });

  test(`${client} add-subscription button keeps its configured client deep link`, () => {
    const { element, launchUrls, clientLink } = renderWizard({ client, step: 2 });
    const button = findElement(element, (node) => node.type === 'button');
    button.props.onClick();
    assert.deepEqual(launchUrls, [clientLink]);
  });
}

test('wizard QR falls back to the ordinary display URL when app config contains crypto', () => {
  const { element } = renderWizard({
    subscriptionUrl: 'happ://crypt4/config-fixture',
    displayUrl: plainUrl,
  });
  assert.equal(findElement(element, (node) => node.type === QRCodeSVG).props.value, plainUrl);
});

test('wizard hides text/copy while still offering an ordinary subscription QR', () => {
  const { element } = renderWizard({ displayUrl: plainUrl, hideLink: true });
  assert.equal(findElement(element, (node) => node.type === QRCodeSVG).props.value, plainUrl);
  assert.equal(
    findElement(element, (node) => node.props?.children === plainUrl),
    null,
  );
  assert.equal(
    findElement(
      element,
      (node) => node.type === 'button' && node.props?.className?.includes('px-4'),
    ),
    null,
  );
});

test('crypto-only wizard disables other-device setup and never renders a crypto or blank QR', () => {
  for (const step of [0, 3]) {
    const { element } = renderWizard({
      subscriptionUrl: 'incy://crypt1/config-fixture',
      displayUrl: 'happ://crypt4/display-fixture',
      step,
    });
    assert.equal(
      findElement(element, (node) => node.type === QRCodeSVG),
      null,
    );
    const button = findElement(
      element,
      (node) =>
        node.type === 'button' && node.props?.children === 'subscription.connection.setupOther',
    );
    assert.equal(button.props.disabled, true);
  }
});

test('legacy connection QR accepts an ordinary state URL or ordinary display fallback verbatim', () => {
  for (const state of [
    { url: plainUrl, hideLink: false },
    { url: 'happ://crypt4/legacy-fixture', displayUrl: plainUrl, hideLink: true },
  ]) {
    const loaded = loadConnectionComponent('pages/ConnectionQR.tsx', { state });
    const element = loaded.component();
    loaded.effects.forEach((effect) => {
      effect();
    });
    assert.equal(findElement(element, (node) => node.type === QRCodeSVG).props.value, plainUrl);
    assert.deepEqual(loaded.navigations, []);
  }
});

test('legacy connection QR returns to setup when only a client scheme is available', () => {
  for (const url of [
    'happ://crypt4/legacy-fixture',
    'incy://crypt1/legacy-fixture',
    'happ://sub/legacy-fixture',
  ]) {
    const loaded = loadConnectionComponent('pages/ConnectionQR.tsx', {
      state: { url, hideLink: false, subscriptionId: 42 },
    });
    assert.equal(loaded.component(), null);
    loaded.effects.forEach((effect) => {
      effect();
    });
    assert.deepEqual(loaded.navigations, [
      { path: '/connection?sub=42', options: { replace: true } },
    ]);
  }
});

function renderPurchaseSuccess(subscriptionUrl, cryptoLink) {
  const { component } = loadConnectionComponent('pages/PurchaseSuccess.tsx', {
    expose: 'exports.default = SuccessState;',
  });
  return component({ subscriptionUrl, cryptoLink, isGift: false });
}

test('purchase success QR keeps the ordinary subscription URL and never uses crypto fallback', () => {
  const plain = renderPurchaseSuccess(plainUrl, 'happ://crypt4/purchase-fixture');
  assert.equal(findElement(plain, (node) => node.type === QRCodeSVG).props.value, plainUrl);
  for (const subscriptionUrl of [null, 'happ://crypt4/sub-fixture', 'incy://crypt1/sub-fixture']) {
    const cryptoOnly = renderPurchaseSuccess(subscriptionUrl, 'happ://crypt4/purchase-fixture');
    assert.equal(
      findElement(cryptoOnly, (node) => node.type === QRCodeSVG),
      null,
    );
    assert.ok(
      findElement(cryptoOnly, (node) => node.type === 'button'),
      'existing copy CTA is preserved',
    );
  }
});
