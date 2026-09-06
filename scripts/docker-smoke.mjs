import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
const origin = 'http://127.0.0.1:18080';
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    if ((await fetch(origin)).ok) break;
  } catch {}
  if (attempt === 39) throw new Error('Container did not start');
  await delay(250);
}
const page = await fetch(`${origin}/subscriptions`);
assert.equal(page.status, 200);
assert.match(page.headers.get('content-type'), /text\/html/);
assert.match(page.headers.get('cache-control'), /no-cache/);
const api = await fetch(`${origin}/api/cabinet/balance`);
assert.equal(api.status, 503);
assert.match(api.headers.get('content-type'), /application\/json/);
assert.match((await api.json()).detail, /not configured/);
console.log('Docker entrypoint/static serving + explicit unconfigured API 503 PASS');
