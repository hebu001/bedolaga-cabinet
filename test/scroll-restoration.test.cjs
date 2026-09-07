const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the shipped hook with browser event targets; layout/clipping is checked in the browser.
function harness({ desktop = true, frame = true } = {}) {
  function target() {
    const listeners = new Set();
    return {
      scrollTop: 0,
      scrollY: 0,
      calls: [],
      addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn),
      scrollTo({ top }) {
        this.calls.push(top);
        this.scrollTop = this.scrollY = top;
      },
      userScroll(top) {
        this.scrollTop = this.scrollY = top;
        listeners.forEach((fn) => fn());
      },
      listeners,
    };
  }
  const window = target(),
    pane = target(),
    media = target();
  media.matches = desktop;
  window.matchMedia = () => media;
  const document = { querySelector: () => (frame ? pane : null) };
  const history = { scrollRestoration: 'auto' };
  let pathname = '/',
    slot = 0;
  const refs = [],
    effects = [],
    pending = [];
  const modules = {};
  const hooks = {
    useRef(initial) {
      const i = slot++;
      return (refs[i] ??= { current: initial });
    },
    useEffect(fn, deps) {
      const i = slot++;
      const old = effects[i];
      if (old && deps.every((d, j) => d === old.deps[j])) return;
      old?.cleanup?.();
      const effect = { deps };
      effects[i] = effect;
      pending.push(() => {
        effect.cleanup = fn();
      });
    },
  };
  function load(file) {
    if (modules[file]) return modules[file].exports;
    const module = (modules[file] = { exports: {} });
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      module,
      exports: module.exports,
      window,
      document,
      history,
      require(id) {
        if (id === 'react') return hooks;
        if (id === 'react-router') return { useLocation: () => ({ pathname }) };
        if (id === '@/utils/pageScroll') return load('src/utils/pageScroll.ts');
        throw new Error('Unexpected import: ' + id);
      },
    });
    return module.exports;
  }
  const { useScrollRestoration } = load('src/hooks/useScrollRestoration.ts');
  return {
    window,
    pane,
    history,
    navigate(next) {
      pathname = next;
      slot = 0;
      useScrollRestoration();
      pending.splice(0).forEach((fn) => fn());
    },
    resize(wide) {
      media.matches = wide;
      media.listeners.forEach((fn) => fn());
    },
    unmount() {
      effects.forEach((effect) => effect?.cleanup?.());
    },
    target: load('src/utils/pageScroll.ts').getPageScrollTarget,
  };
}

test('desktop route changes start the frame at the top, without scrolling the window', () => {
  const h = harness();
  h.navigate('/balance');
  h.pane.userScroll(1200);
  h.navigate('/subscriptions');
  assert.equal(h.pane.scrollTop, 0);
  assert.deepEqual(h.window.calls, []);
  assert.equal(h.history.scrollRestoration, 'manual');
  h.unmount();
  assert.equal(h.pane.listeners.size, 0);
});

test('admin pages restore their own frame positions, including zero for a new page', () => {
  const h = harness();
  h.navigate('/admin/users');
  h.pane.userScroll(760);
  h.navigate('/admin/settings');
  assert.equal(h.pane.scrollTop, 0);
  h.pane.userScroll(180);
  h.navigate('/admin/users');
  assert.equal(h.pane.scrollTop, 760);
  h.navigate('/admin/settings');
  assert.equal(h.pane.scrollTop, 180);
  h.unmount();
});

test('mobile keeps window scrolling and admin restoration', () => {
  const h = harness({ desktop: false });
  h.navigate('/balance');
  assert.deepEqual(h.window.calls, []);
  h.navigate('/admin/users');
  h.window.userScroll(480);
  h.navigate('/admin/settings');
  h.navigate('/admin/users');
  assert.equal(h.window.scrollY, 480);
  assert.deepEqual(h.pane.calls, []);
  h.unmount();
});

test('crossing the desktop breakpoint switches listeners and settings scroll target', () => {
  const h = harness();
  h.navigate('/admin/users');
  h.resize(false);
  assert.equal(h.pane.listeners.size, 0);
  assert.equal(h.target(), h.window);
  h.window.userScroll(320);
  h.navigate('/admin/settings');
  h.navigate('/admin/users');
  assert.equal(h.window.scrollY, 320);
  h.resize(true);
  assert.equal(h.window.listeners.size, 0);
  assert.equal(h.target(), h.pane);
  h.unmount();
  assert.equal(h.pane.listeners.size, 0);
});

test('pages outside the cabinet shell fall back to the window', () => {
  const h = harness({ frame: false });
  assert.equal(h.target(), h.window);
});
