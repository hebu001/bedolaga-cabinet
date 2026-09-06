const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function loadActualModule(file) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  const module = {exports: {}};
  new Function('exports', 'require', 'module', output)(module.exports, (id) => id === './types' ? loadActualModule(path.join(path.dirname(file), 'types.ts')) : require(id), module);
  return module.exports;
}
const Aurora = loadActualModule(path.join(root, 'src/components/ui/backgrounds/aurora-background.tsx')).default;
for (const color of ['#00d2ff', '#fff', '#11223388', 'orange', 'rgb(10, 20, 30)', 'rgba(10, 20, 30, 0.4)', 'hsl(120, 40%, 50%)']) {
  test(`static Aurora keeps valid configured color ${color} intact`, () => {
    const element = Aurora({settings: {firstColor: color, secondColor: color, thirdColor: color}});
    const gradient = element.props.children.props.style.backgroundImage;
    assert.ok(gradient.includes(`, ${color}, transparent`));
    assert.equal(element.props.children.props.style.opacity, 0.35);
    const html = renderToStaticMarkup(element);
    assert.doesNotMatch(html, /<canvas|animation:|transition:/);
  });
}
