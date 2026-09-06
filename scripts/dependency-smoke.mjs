import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundled = await build({
  entryPoints: [path.join(import.meta.dirname, 'fixtures/dependency-runtime.js')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  logLevel: 'silent',
});
const script = bundled.outputFiles[0].contents;
const server = http.createServer((request, response) => {
  response.setHeader(
    'content-type',
    request.url === '/smoke.js' ? 'application/javascript' : 'text/html',
  );
  response.end(
    request.url === '/smoke.js'
      ? script
      : '<!doctype html><div id="editor"></div><script src="/smoke.js"></script>',
  );
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  });
  const page = await browser.newPage();
  await page.route('**/*', (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort(),
  );
  await page.goto(origin);
  await page.waitForFunction(() => !!window.__dependencyResult);
  const result = await page.evaluate(() => window.__dependencyResult);
  assert.equal(result.pass, true, result.error);
  assert.equal(await page.evaluate(() => !!window.__executed), false);
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
