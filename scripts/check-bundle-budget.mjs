import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(dist, '.vite/manifest.json'), 'utf8'));
const budgets = JSON.parse(fs.readFileSync(path.join(root, 'scripts/bundle-budgets.json'), 'utf8'));
const entry = Object.entries(manifest).find(
  ([, chunk]) => chunk.isEntry && chunk.src === 'index.html',
);
if (!entry) throw new Error('Vite index.html entry is missing');
const collect = (key, seen = new Set()) => {
  if (seen.has(key)) return seen;
  if (!manifest[key]) throw new Error(`Missing manifest dependency: ${key}`);
  seen.add(key);
  for (const imported of manifest[key].imports ?? []) collect(imported, seen);
  return seen;
};
const measureFiles = (files) => {
  const sizes = files.map((file) => {
    const bytes = fs.readFileSync(path.join(dist, file));
    return { file, raw: bytes.length, gzip: gzipSync(bytes).length };
  });
  return {
    raw: sizes.reduce((sum, item) => sum + item.raw, 0),
    gzip: sizes.reduce((sum, item) => sum + item.gzip, 0),
    files: sizes,
  };
};
const initial = measureFiles(
  [...new Set([...collect(entry[0])].map((key) => manifest[key].file))].filter((file) =>
    file.endsWith('.js'),
  ),
);
const locales = Object.fromEntries(
  ['ru', 'en', 'fa', 'zh'].map((language) => {
    const localeKey = `src/locales/${language}.json`;
    const locale =
      manifest[localeKey] ??
      Object.entries(manifest).find(
        ([key, chunk]) => key.split('?')[0] === localeKey || chunk.src === localeKey,
      )?.[1];
    if (!locale?.file.endsWith('.json')) throw new Error(`Missing emitted JSON locale ${language}`);
    return [language, measureFiles([locale.file])];
  }),
);
const report = { initial, locales, budgets };
fs.writeFileSync(path.join(dist, 'bundle-metrics.json'), `${JSON.stringify(report, null, 2)}\n`);
const failures = [];
for (const kind of ['raw', 'gzip']) {
  if (initial[kind] > budgets.initial[kind])
    failures.push(`initial ${kind}: ${initial[kind]} > ${budgets.initial[kind]}`);
  for (const [language, metrics] of Object.entries(locales))
    if (metrics[kind] > budgets.userLocale[kind])
      failures.push(`${language} locale ${kind}: ${metrics[kind]} > ${budgets.userLocale[kind]}`);
}
console.log(
  JSON.stringify(
    {
      initial: { raw: initial.raw, gzip: initial.gzip },
      locales: Object.fromEntries(
        Object.entries(locales).map(([language, value]) => [
          language,
          { raw: value.raw, gzip: value.gzip },
        ]),
      ),
    },
    null,
    2,
  ),
);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
