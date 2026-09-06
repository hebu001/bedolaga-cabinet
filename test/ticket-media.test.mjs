import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { setImmediate as flush } from 'node:timers/promises';
import {
  getMessageMedia,
  mediaTokenExpiresAt,
  isMediaTokenExpired,
  signedMediaUrl,
  MediaRefreshGate,
} from '../src/utils/ticketMedia.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..');
const future = () => Math.floor(Date.now() / 1000) + 86400;
const token = (signature = 'a') => `${future()}.${signature.repeat(64)}`;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

// Load the actual API modules; substitute only the authenticated HTTP transport.
function apiModules(base, response) {
  const requests = [];
  const client = {
    API_BASE_URL: base,
    get: async (url) => {
      requests.push(url);
      return { data: response };
    },
  };
  function load(relative) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(code, {
      module,
      exports: module.exports,
      require: (name) => {
        if (name === './client') return client;
        if (name === '../utils/ticketMedia') return { signedMediaUrl };
        throw new Error(`Unexpected import: ${name}`);
      },
    });
    return module.exports;
  }
  return {
    tickets: load('src/api/tickets.ts').ticketsApi,
    admin: load('src/api/admin.ts').adminApi,
    requests,
  };
}

for (const [base, expected] of [
  ['/api', '/api/cabinet/media/'],
  ['/api/', '/api/cabinet/media/'],
  ['/prefix///', '/prefix/cabinet/media/'],
  ['https://cabinet.example/api/', 'https://cabinet.example/api/cabinet/media/'],
])
  test(`actual ticketsApi signs media URLs with normalized common base ${base}`, () => {
    const { tickets } = apiModules(base);
    const fileId = 'file/id ?#%+';
    const signature = `${future()}.a+b/c?d&e=#`;
    const url = tickets.getMediaUrl(fileId, signature);
    assert.equal(
      url,
      `${expected}${encodeURIComponent(fileId)}?token=${encodeURIComponent(signature)}`,
    );
    const parsed = new URL(url, 'https://cabinet.example');
    assert.equal(parsed.searchParams.get('token'), signature);
    assert.equal([...parsed.searchParams].length, 1);
  });

test('missing file/token never produces an unsigned or current-page media URL', () => {
  const { tickets } = apiModules('/api');
  for (const invalid of [undefined, null, '', '  '])
    assert.equal(tickets.getMediaUrl('file', invalid), null);
  assert.equal(tickets.getMediaUrl('', token()), null);
});

test('user and admin actual ticket APIs preserve each album signature through normalization', async () => {
  const fixture = {
    id: 4,
    messages: [
      {
        id: 8,
        has_media: true,
        media_type: 'photo',
        media_file_id: 'legacy',
        media_token: token('d'),
        media_items: [
          { type: 'photo', file_id: 'photo-1', token: token('a'), caption: 'Photo' },
          { type: 'video', file_id: 'video-2', token: token('b') },
          { type: 'document', file_id: 'document-3', token: token('c') },
        ],
      },
    ],
  };
  const { tickets, admin, requests } = apiModules('/api', fixture);
  for (const detail of [await tickets.getTicket(4), await admin.getTicket(4)]) {
    const items = getMessageMedia(detail.messages[0]);
    assert.equal(items.length, 3);
    for (const item of items) {
      const url = new URL(tickets.getMediaUrl(item.file_id, item.token), 'https://cabinet.example');
      assert.equal(url.searchParams.get('token'), item.token);
      assert.equal(isMediaTokenExpired(item.token), false);
    }
  }
  assert.deepEqual(requests, ['/cabinet/tickets/4', '/cabinet/admin/tickets/4']);
});

for (const type of ['photo', 'video', 'document'])
  test(`legacy single ${type} retains its own media_token`, () => {
    const signed = token();
    const items = getMessageMedia({
      id: 4,
      media_type: type,
      media_file_id: 'single',
      media_token: signed,
      media_caption: 'caption',
      media_items: [],
    });
    assert.deepEqual(items, [{ type, file_id: 'single', token: signed, caption: 'caption' }]);
    assert.equal(
      signedMediaUrl('/api', items[0].file_id, items[0].token),
      `/api/cabinet/media/single?token=${signed}`,
    );
  });

test('missing album signature is retained as unavailable, never replaced by another file signature', () => {
  const items = getMessageMedia({
    media_file_id: 'first',
    media_token: token(),
    media_items: [{ type: 'photo', file_id: 'second' }],
  });
  assert.equal(items[0].token, undefined);
  assert.equal(isMediaTokenExpired(items[0].token), true);
  assert.equal(signedMediaUrl('/api', items[0].file_id, items[0].token), null);
  assert.deepEqual(getMessageMedia({ has_media: true }), []);
});

test('backend exp.signature expiry is rechecked against time with a five-second renewal margin', () => {
  const now = 1_800_000_000_000;
  assert.equal(mediaTokenExpiresAt('1800000060.signature'), now + 60000);
  assert.equal(isMediaTokenExpired('1800000060.signature', now), false);
  assert.equal(isMediaTokenExpired('1800000060.signature', now + 55000), true);
  assert.equal(isMediaTokenExpired('1800000060.signature', now + 61000), true);
  for (const invalid of [
    undefined,
    null,
    '',
    'no-signature',
    '1800000060.',
    'NaN.sig',
    '999999999999999999999.sig',
  ]) {
    assert.equal(mediaTokenExpiresAt(invalid), null);
    assert.equal(isMediaTokenExpired(invalid, now), true);
  }
});

test('many failed media elements share one bounded refresh and cannot automatically loop', async (t) => {
  let now = 0,
    calls = 0;
  t.mock.method(Date, 'now', () => now);
  const gate = new MediaRefreshGate();
  const response = deferred();
  const load = () => {
    calls++;
    return response.promise;
  };
  const requests = Array.from({ length: 10 }, () => gate.run(load));
  assert.equal(
    requests.every((request) => request === requests[0]),
    true,
  );
  await flush();
  assert.equal(calls, 1);
  response.resolve({ media_token: 'still-expired' });
  await Promise.all(requests);
  assert.equal(await gate.run(load), null);
  assert.equal(calls, 1);
  now = 60001;
  await gate.run(async () => {
    calls++;
    return { media_token: token() };
  });
  assert.equal(calls, 2);
});

test('refresh rejection is bounded; explicit user retry can recover without waiting for automatic cooldown', async () => {
  const gate = new MediaRefreshGate();
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new Error('503');
  };
  assert.equal(await gate.run(fail), null);
  assert.equal(await gate.run(fail), null);
  assert.equal(calls, 1);
  assert.deepEqual(
    await gate.run(async () => {
      calls++;
      return { id: 4 };
    }, true),
    { id: 4 },
  );
  assert.equal(calls, 2);
});

test('renewal times out after 15 seconds and ignores a late completion without retaining singleflight', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const gate = new MediaRefreshGate(),
    response = deferred();
  const pending = gate.run(() => response.promise);
  t.mock.timers.tick(15000);
  assert.equal(await pending, null);
  assert.deepEqual(await gate.run(async () => ({ id: 'current' }), true), { id: 'current' });
  response.resolve({ id: 'late' });
  await flush();
  assert.deepEqual(await gate.run(async () => ({ id: 'next' }), true), { id: 'next' });
});
