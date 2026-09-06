// Execute Login and its actual event handlers with local framework/service adapters.
// No network, real accounts or email delivery are involved.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const code = ts.transpileModule(
  fs
    .readFileSync(path.join(root, 'src/pages/Login.tsx'), 'utf8')
    .replaceAll('import.meta.env', '({DEV:false})'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
function harness(options = {}) {
  let cursor = 0;
  const values = [],
    calls = [];
  const jsx = (type, props) => ({ type, props: props || {} });
  const auth = {
    isAuthenticated: false,
    isLoading: false,
    loginWithTelegram: async () => {},
    loginWithEmail: async (...args) => {
      calls.push(['login', ...args]);
      if (options.loginError) throw options.loginError;
    },
    registerWithEmail: async (...args) => {
      calls.push(['register', ...args]);
      return { email: args[0] };
    },
  };
  const browser = { location: { href: '/login' }, setTimeout };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    window: browser,
    console,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === 'react')
        return {
          useState(initial) {
            const slot = cursor++;
            if (!(slot in values))
              values[slot] = typeof initial === 'function' ? initial() : initial;
            return [
              values[slot],
              (value) => {
                values[slot] = typeof value === 'function' ? value(values[slot]) : value;
              },
            ];
          },
          useEffect() {},
          useMemo: (f) => f(),
          useCallback: (f) => f,
        };
      if (name === '@radix-ui/react-dialog')
        return Object.fromEntries(
          ['Root', 'Trigger', 'Portal', 'Overlay', 'Content', 'Close', 'Title', 'Description'].map(
            (key) => [key, 'Dialog' + key],
          ),
        );
      if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
      if (name === 'react-router')
        return {
          useNavigate:
            () =>
            (...args) =>
              calls.push(['navigate', ...args]),
          useLocation: () => ({ state: { from: '/subscriptions' } }),
        };
      if (name === '@tanstack/react-query')
        return {
          useQuery: ({ queryKey }) => ({
            data: {
              branding: { name: 'Evo VPN' },
              'email-auth-enabled': { enabled: options.emailEnabled !== false },
              'oauth-providers': {
                providers: options.providers ?? [
                  { name: 'google', display_name: 'Google' },
                  { name: 'yandex', display_name: 'Яндекс' },
                  { name: 'vk', display_name: 'VK' },
                ],
              },
            }[queryKey[0]],
          }),
        };
      if (name === 'zustand/shallow') return { useShallow: (selector) => selector };
      if (name === '../store/auth') return { useAuthStore: (selector) => selector(auth) };
      if (name === '../api/auth')
        return {
          authApi: {
            forgotPassword: async (email) => {
              calls.push(['forgot', email]);
            },
            getOAuthAuthorizeUrl: async (provider) => {
              calls.push(['oauth', provider]);
              return {
                authorize_url: options.redirect ?? 'https://accounts.example.invalid/authorize',
                state: 'fixture-state',
              };
            },
          },
        };
      if (name === '../api/branding')
        return { getCachedBranding: () => null, brandingApi: {}, setCachedBranding() {} };
      if (name === '../utils/validation')
        return { isValidEmail: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) };
      if (name === '../utils/serverMessages') return { localizeServerMessage: () => '' };
      if (name === '../utils/token') return { getAndClearReturnUrl: () => null, tokenStorage: {} };
      if (name === '../hooks/useTelegramSDK')
        return {
          useTelegramSDK: () => ({
            safeAreaInset: { top: 0, bottom: 0 },
            contentSafeAreaInset: { top: 0, bottom: 0 },
          }),
          isInTelegramWebApp: () => false,
          getTelegramInitData: () => '',
        };
      if (name === '@telegram-apps/sdk-react') return { closeMiniApp() {} };
      if (name === '../utils/oauth')
        return { saveOAuthState: (...args) => calls.push(['oauth-state', ...args]) };
      if (name === '../utils/referral')
        return { getPendingReferralCode: () => options.referral ?? '' };
      if (name === '../utils/telegramAuthRecovery') return {};
      if (name.startsWith('../components/') || name.endsWith('.css')) return { default: name };
      throw new Error('Unexpected module ' + name);
    },
    URL,
  });
  return {
    calls,
    browser,
    render() {
      cursor = 0;
      return module.exports.default();
    },
  };
}
function nodes(tree) {
  return !tree || typeof tree !== 'object'
    ? []
    : Array.isArray(tree)
      ? tree.flatMap(nodes)
      : [tree, ...nodes(tree.props?.children)];
}
function find(tree, predicate) {
  const result = nodes(tree).find(predicate);
  assert.ok(result, 'Expected control exists');
  return result;
}
function field(tree, id) {
  return find(tree, (node) => node.type === 'input' && node.props.id === id);
}
function button(tree, label) {
  return find(tree, (node) => node.type === 'button' && node.props.children === label);
}
function fill(h, id, value) {
  field(h.render(), id).props.onChange({ target: { value } });
}
function emailForm(h) {
  return find(h.render(), (node) => node.type === 'form' && node.props.id === 'email-auth-form');
}
const submit = { preventDefault() {} };

test('open email form submits trimmed credentials through existing login and returns to the requested page', async () => {
  const h = harness();
  assert.equal(field(h.render(), 'password').props.autoComplete, 'current-password');
  fill(h, 'email', ' user@example.com ');
  fill(h, 'password', 'original-password');
  await emailForm(h).props.onSubmit(submit);
  assert.deepEqual(h.calls[0], ['login', 'user@example.com', 'original-password']);
  assert.deepEqual(h.calls[1].slice(0, 2), ['navigate', '/subscriptions']);
});

test('login failure stays on the form with a localized error and allows retry', async () => {
  const h = harness({
    loginError: { response: { status: 401, data: { detail: 'Invalid credentials' } } },
  });
  fill(h, 'email', 'user@example.com');
  fill(h, 'password', 'wrong-password');
  await emailForm(h).props.onSubmit(submit);
  assert.equal(
    find(h.render(), (n) => n.props.role === 'alert').props.children,
    'auth.invalidCredentials',
  );
  assert.equal(
    h.calls.some((c) => c[0] === 'navigate'),
    false,
  );
  assert.equal(button(h.render(), 'auth.enterAccount').props.disabled, false);
});

test('registration preserves referral/name, rejects mismatch and shows the submitted verification email', async () => {
  const h = harness({ referral: 'INVITE' });
  assert.equal(field(h.render(), 'password').props.autoComplete, 'new-password');
  fill(h, 'firstName', 'Тест');
  fill(h, 'email', ' new@example.com ');
  fill(h, 'password', 'new-password');
  fill(h, 'confirmPassword', 'different');
  await emailForm(h).props.onSubmit(submit);
  assert.equal(h.calls.length, 0);
  assert.equal(
    find(h.render(), (n) => n.props.role === 'alert').props.children,
    'auth.passwordMismatch',
  );
  fill(h, 'confirmPassword', 'new-password');
  await emailForm(h).props.onSubmit(submit);
  assert.deepEqual(h.calls[0], ['register', 'new@example.com', 'new-password', 'Тест', 'INVITE']);
  assert.ok(nodes(h.render()).some((n) => n.props.children === 'new@example.com'));
  assert.equal(
    nodes(h.render()).some((n) => n.type === 'form' && n.props.id === 'email-auth-form'),
    false,
  );
});

test('password visibility changes only the input type and retains the entered value', () => {
  const h = harness();
  fill(h, 'password', 'sample-password');
  find(
    h.render(),
    (n) => n.type === 'button' && n.props['aria-label'] === 'auth.showPassword',
  ).props.onClick();
  assert.equal(field(h.render(), 'password').props.type, 'text');
  assert.equal(field(h.render(), 'password').props.value, 'sample-password');
});

test('forgot-password dialog prefills email and calls the existing reset endpoint', async () => {
  const h = harness();
  fill(h, 'email', ' user@example.com ');
  find(h.render(), (n) => n.type === 'DialogRoot').props.onOpenChange(true);
  assert.equal(field(h.render(), 'forgotEmail').props.value, ' user@example.com ');
  await find(h.render(), (n) => n.type === 'form' && !n.props.id).props.onSubmit(submit);
  assert.deepEqual(h.calls[0], ['forgot', 'user@example.com']);
  assert.ok(nodes(h.render()).some((n) => n.props.children === 'auth.passwordResetSent'));
});

test('only configured OAuth providers render and their real authorize handler preserves state', async () => {
  const h = harness({ providers: [{ name: 'vk', display_name: 'VK' }], emailEnabled: false });
  assert.equal(
    nodes(h.render()).some((n) => n.type === 'form'),
    false,
  );
  const providers = nodes(h.render()).filter(
    (n) => n.type === 'button' && n.props['aria-label'] === 'auth.signInWithProvider',
  );
  assert.equal(providers.length, 1);
  await providers[0].props.onClick();
  assert.deepEqual(h.calls, [
    ['oauth', 'vk'],
    ['oauth-state', 'fixture-state', 'vk'],
  ]);
  assert.equal(h.browser.location.href, 'https://accounts.example.invalid/authorize');
});

test('unsafe OAuth redirects remain blocked and do not persist a state', async () => {
  const h = harness({ redirect: 'javascript:alert(1)' });
  await find(
    h.render(),
    (n) => n.type === 'button' && n.props['aria-label'] === 'auth.signInWithProvider',
  ).props.onClick();
  assert.equal(h.browser.location.href, '/login');
  assert.equal(
    h.calls.some((c) => c[0] === 'oauth-state'),
    false,
  );
  assert.equal(find(h.render(), (n) => n.props.role === 'alert').props.children, 'auth.oauthError');
});
