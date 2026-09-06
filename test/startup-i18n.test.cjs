// Exercise the real i18n module with actual i18next; replace only asset URL imports and HTTP transport.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { setImmediate: flush } = require('node:timers/promises');
const root = path.resolve(__dirname, '..');

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function runtime({ language = 'ru', beforeLoad = async () => {} } = {}) {
  const instance = require('i18next').createInstance();
  const document = { documentElement: { lang: 'ru', dir: 'ltr' } };
  const downloads = [];
  const requests = [];
  class Detector {
    static type = 'languageDetector';
    init() {}
    detect() {
      return [language];
    }
    cacheUserLanguage() {}
  }
  const source = fs.readFileSync(path.join(root, 'src/i18n.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      document,
      console,
      require(name) {
        if (name.includes('.json?url&no-inline')) return name.split('?')[0];
        if (name === 'i18next') return instance;
        if (name === 'i18next-browser-languagedetector') return Detector;
        return require(name);
      },
      async fetch(file, options) {
        downloads.push(file);
        requests.push({ file, cache: options?.cache });
        const response = await beforeLoad(file);
        return (
          response ?? {
            ok: true,
            status: 200,
            json: async () => JSON.parse(fs.readFileSync(path.join(root, 'src', file), 'utf8')),
          }
        );
      },
    },
    { filename: 'src/i18n.ts' },
  );
  return { ...module.exports, instance, document, downloads, requests };
}

test('cold startup waits for the detected language and fallback, deduplicating StrictMode loads', async () => {
  const gate = deferred();
  const app = runtime({
    language: 'en-US',
    beforeLoad: (file) => (file.endsWith('en.json') ? gate.promise : undefined),
  });
  let ready = false;
  const first = app.prepareI18n().then(() => {
    ready = true;
  });
  const second = app.prepareI18n();
  await flush();
  assert.equal(ready, false);
  assert.equal(app.downloads.length, 2);
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(app.instance.language, 'en');
  assert.equal(app.instance.t('auth.login'), 'Login');
  assert.equal(app.instance.resolvedLanguage, 'en');
  assert.equal(app.document.documentElement.lang, 'en');
  assert.equal(
    app.downloads.some((file) => file.includes('/admin/')),
    false,
  );
});

test('startup failure is retryable instead of mounting untranslated content', async () => {
  let fail = true;
  const app = runtime({
    beforeLoad() {
      if (fail) throw new Error('offline');
    },
  });
  await assert.rejects(app.prepareI18n(), /offline/);
  fail = false;
  await app.prepareI18n();
  assert.notEqual(app.instance.t('auth.email'), 'auth.email');
  assert.equal(app.downloads.length, 2);
});

test('HTTP and malformed JSON failures retry the same asset URL without reloading or poisoning resource cache', async () => {
  let attempt = 0;
  const app = runtime({
    beforeLoad() {
      attempt++;
      if (attempt === 1) return { ok: false, status: 503, json: async () => ({}) };
      if (attempt === 2)
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Invalid JSON');
          },
        };
    },
  });
  await assert.rejects(app.prepareI18n(), /503/);
  await assert.rejects(app.prepareI18n(), /Invalid JSON/);
  await app.prepareI18n();
  assert.equal(app.instance.t('auth.login'), 'Вход');
  assert.equal(app.downloads.length, 3);
  assert.equal(new Set(app.downloads).size, 1);
  assert.deepEqual(
    app.requests.map(({ cache }) => cache),
    [undefined, 'reload', 'reload'],
  );
});

test('language switching retains old text until ready; failed switches preserve language and can retry', async () => {
  const gate = deferred();
  let fail = true;
  const app = runtime({
    beforeLoad(file) {
      if (file.endsWith('en.json')) return gate.promise;
      if (file.endsWith('fa.json') && fail) throw new Error('offline');
    },
  });
  await app.prepareI18n();
  const original = app.instance.t('auth.login');
  const switching = app.changeAppLanguage('en');
  await flush();
  assert.equal(app.instance.language, 'ru');
  assert.equal(app.instance.t('auth.login'), original);
  gate.resolve();
  await switching;
  await assert.rejects(app.changeAppLanguage('fa'), /offline/);
  assert.equal(app.instance.language, 'en');
  fail = false;
  await app.changeAppLanguage('fa');
  assert.equal(app.instance.language, 'fa');
  assert.equal(app.document.documentElement.dir, 'rtl');
});

test('admin code can mount only after translated resources; language changes also wait for admin', async () => {
  const gate = deferred();
  const app = runtime({
    beforeLoad: (file) => (file === './locales/admin/en.json' ? gate.promise : undefined),
  });
  await app.prepareI18n();
  assert.equal(app.instance.exists('admin.settings.availableThemes'), false);
  await app.loadAdminTranslations();
  assert.equal(app.instance.exists('admin.settings.availableThemes'), true);
  const switching = app.changeAppLanguage('en');
  await flush();
  assert.equal(app.instance.language, 'ru');
  gate.resolve();
  await switching;
  assert.equal(app.instance.language, 'en');
  assert.equal(app.instance.t('admin.settings.availableThemes'), 'Available themes');
});

test('admin HTTP failure is retryable and loaded admin navigation requires no new fetch', async () => {
  let fail = true;
  const app = runtime({
    beforeLoad(file) {
      if (file.includes('/admin/') && fail) return { ok: false, status: 503 };
    },
  });
  await app.prepareI18n();
  assert.equal(app.areAdminTranslationsLoaded(), false);
  await assert.rejects(app.loadAdminTranslations(), /503/);
  assert.equal(app.areAdminTranslationsLoaded(), false);
  assert.equal(app.instance.exists('admin.settings.availableThemes'), false);
  fail = false;
  await app.loadAdminTranslations();
  assert.equal(app.areAdminTranslationsLoaded(), true);
  assert.equal(app.instance.exists('admin.settings.availableThemes'), true);
  const requests = app.downloads.length;
  await app.loadAdminTranslations();
  assert.equal(app.downloads.length, requests);
  assert.deepEqual(
    app.requests.filter(({ file }) => file.includes('/admin/')).map(({ cache }) => cache),
    [undefined, 'reload'],
  );
});

test('last requested language wins if older downloads finish later', async () => {
  const gate = deferred();
  const app = runtime({
    beforeLoad: (file) => (file.endsWith('en.json') ? gate.promise : undefined),
  });
  await app.prepareI18n();
  const old = app.changeAppLanguage('en');
  await app.changeAppLanguage('zh');
  gate.resolve();
  await old;
  assert.equal(app.instance.language, 'zh');
});

test('public translations stay separate from admin pages and contain the shell admin link', async () => {
  for (const language of ['ru', 'en', 'zh', 'fa']) {
    const app = runtime({ language });
    await app.prepareI18n();
    assert.equal(app.instance.exists('admin.nav.title'), true);
    assert.equal(app.instance.exists('admin.settings.availableThemes'), false);
    assert.equal(
      app.downloads.some((file) => file.includes('/admin/')),
      false,
    );
  }
});

function userTranslationCalls() {
  const calls = [];
  function walkFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (
        /[/\\](admin|preview|broadcasts|sales-stats)[/\\]|[/\\](Admin|ReferralNetwork)/.test(file)
      )
        continue;
      if (entry.isDirectory()) {
        walkFiles(file);
        continue;
      }
      if (!/\.tsx?$/.test(file)) continue;
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node) {
        if (
          ts.isCallExpression(node) &&
          ((ts.isIdentifier(node.expression) && node.expression.text === 't') ||
            (ts.isPropertyAccessExpression(node.expression) &&
              node.expression.name.text === 't')) &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          calls.push({ key: node.arguments[0].text, file: path.relative(root, file) });
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  walkFiles(path.join(root, 'src'));
  return calls;
}

test('every static user translation has a resource, including plural and fallback keys', async () => {
  const app = runtime();
  await app.prepareI18n();
  const missing = userTranslationCalls().filter(
    ({ key }) => ![0, 1, 2, 5].some((count) => app.instance.exists(key, { count })),
  );
  assert.deepEqual(missing, []);
});

function flatten(data, prefix = '') {
  return Object.fromEntries(
    Object.entries(data).flatMap(([key, value]) => {
      const full = prefix + key;
      return value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(flatten(value, full + '.'))
        : [[full, value]];
    }),
  );
}
const tokens = (value) =>
  [...String(value).matchAll(/{{-?\s*([\w.]+)(?:\s*,[^}]*)?\s*}}/g)]
    .map((match) => match[1])
    .sort();

test('matching user translation keys preserve interpolation parameters across languages', () => {
  const canonical = flatten(
    JSON.parse(fs.readFileSync(path.join(root, 'src/locales/ru.json'), 'utf8')),
  );
  const mismatches = [];
  for (const language of ['en', 'zh', 'fa']) {
    const translations = flatten(
      JSON.parse(fs.readFileSync(path.join(root, 'src/locales', language + '.json'), 'utf8')),
    );
    for (const [key, value] of Object.entries(translations)) {
      if (
        typeof canonical[key] === 'string' &&
        JSON.stringify(tokens(value)) !== JSON.stringify(tokens(canonical[key]))
      ) {
        mismatches.push({ language, key, expected: tokens(canonical[key]), actual: tokens(value) });
      }
    }
  }
  assert.deepEqual(mismatches, []);
});

test('paid trial displays converted kopeks instead of relabelling raw rubles', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const formatted = [];
  const source = fs.readFileSync(
    path.join(root, 'src/components/dashboard/TrialOfferCard.tsx'),
    'utf8',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(name) {
      if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
      if (name.endsWith('/useCurrency'))
        return {
          useCurrency: () => ({
            currencySymbol: '$',
            formatAmount: (rubles) => {
              formatted.push(rubles);
              return (rubles / 100).toFixed(2);
            },
          }),
        };
      if (name.endsWith('/useHaptic')) return { useHapticFeedback: () => ({}) };
      return require(name);
    },
  });
  const html = renderToStaticMarkup(
    React.createElement(module.exports.default, {
      trialInfo: {
        requires_payment: true,
        price_kopeks: 19900,
        price_rubles: 999,
        duration_days: 3,
        traffic_limit_gb: 10,
        device_limit: 2,
      },
      balanceKopeks: 50000,
      balanceRubles: 500,
      activateTrialMutation: { isPending: false },
      trialError: null,
    }),
  );
  assert.deepEqual(formatted, [199, 500]);
  assert.match(html, />1\.99<\/span>/);
  assert.match(html, />\$<\/span>/);
});
