import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { cabinetSocketEndpoints, connectCabinetSocket } from '../src/utils/cabinetWebSocket.ts';

const flush = () => setImmediate();
const ticket = (n = 0) => String(n).padStart(43, 'a');

function setup(t, getTicket) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const sockets = [],
    connections = [],
    messages = [],
    requests = [];
  const stop = connectCabinetSocket({
    getTicket: async (signal) => {
      requests.push(signal);
      return getTicket ? getTicket(signal, requests.length) : ticket(requests.length);
    },
    createSocket: (value) => {
      const socket = {
        ticket: value,
        readyState: 0,
        sent: [],
        closeCount: 0,
        close() {
          this.closeCount++;
          this.readyState = 3;
        },
        send(data) {
          this.sent.push(JSON.parse(data));
        },
      };
      sockets.push(socket);
      return socket;
    },
    onConnected: (value) => connections.push(value),
    onMessage: (value) => messages.push(value),
    maxReconnectAttempts: 5,
    maxReconnectDelayMs: 30000,
    pingIntervalMs: 25000,
  });
  t.after(stop);
  return { sockets, connections, messages, requests, stop };
}
const acknowledge = (socket) => {
  socket.readyState = 1;
  socket.onmessage({ data: '{"type":"connected"}' });
};

test('WS URLs preserve API prefixes and contain only a single-use ticket', () => {
  for (const [base, expected, ticketPath] of [
    ['/api', 'wss://cabinet.example/api/cabinet/ws', '/cabinet/ws/ticket'],
    ['/api/cabinet/', 'wss://cabinet.example/api/cabinet/ws', '/ws/ticket'],
    ['https://api.example/prefix/', 'wss://api.example/prefix/cabinet/ws', '/cabinet/ws/ticket'],
    ['http://localhost:8080', 'ws://localhost:8080/cabinet/ws', '/cabinet/ws/ticket'],
    ['/api?token=secret#fragment', 'wss://cabinet.example/api/cabinet/ws', '/cabinet/ws/ticket'],
  ]) {
    const result = cabinetSocketEndpoints(base, 'https://cabinet.example/page', ticket());
    assert.equal(result.socketUrl, `${expected}?ticket=${ticket()}`);
    assert.equal(result.ticketPath, ticketPath);
    assert.equal(new URL(result.socketUrl).searchParams.has('token'), false);
  }
  assert.throws(() =>
    cabinetSocketEndpoints('javascript:alert(1)', 'https://example.org', ticket()),
  );
});

test('waits for server authentication, forwards events and pings without credentials', async (t) => {
  const run = setup(t);
  await flush();
  assert.deepEqual(run.connections, [false]);
  acknowledge(run.sockets[0]);
  assert.deepEqual(run.connections, [false, true]);
  for (const data of [
    'invalid',
    'null',
    '{}',
    '{"type":"pong"}',
    '{"type":"balance_updated","amount_kopeks":500}',
  ]) {
    run.sockets[0].onmessage({ data });
  }
  assert.deepEqual(run.messages, [{ type: 'balance_updated', amount_kopeks: 500 }]);
  t.mock.timers.tick(25000);
  assert.deepEqual(run.sockets[0].sent, [{ type: 'ping' }]);
});

test('access expiry (1008) fetches a fresh ticket and can reconnect', async (t) => {
  const run = setup(t);
  await flush();
  acknowledge(run.sockets[0]);
  run.sockets[0].onclose({ code: 1008 });
  t.mock.timers.tick(1000);
  await flush();
  assert.equal(run.sockets.length, 2);
  assert.notEqual(run.sockets[0].ticket, run.sockets[1].ticket);
  acknowledge(run.sockets[1]);
  assert.equal(run.connections.at(-1), true);
});

for (const status of [400, 401, 403, 404]) {
  test(`HTTP ${status} stops ticket retries`, async (t) => {
    const run = setup(t, () => Promise.reject({ response: { status } }));
    await flush();
    t.mock.timers.tick(120000);
    await flush();
    assert.equal(run.requests.length, 1);
    assert.equal(run.sockets.length, 0);
  });
}
for (const status of [429, 503]) {
  test(`HTTP ${status} is retried with a new request`, async (t) => {
    const run = setup(t, (_, n) =>
      n === 1 ? Promise.reject({ response: { status } }) : ticket(n),
    );
    await flush();
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(run.requests.length, 2);
    assert.equal(run.sockets.length, 1);
  });
}

test('rejected sockets cannot reset the retry budget just by opening', async (t) => {
  const run = setup(t);
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000]) {
    await flush();
    const socket = run.sockets.at(-1);
    socket.readyState = 1;
    socket.onclose({ code: 1008 });
    t.mock.timers.tick(delay);
  }
  await flush();
  assert.equal(run.requests.length, 6);
  assert.equal(run.connections.includes(true), false);
});

test('logout/StrictMode cleanup aborts ticket request and ignores late completion', async (t) => {
  let resolve;
  const run = setup(
    t,
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  run.stop();
  assert.equal(run.requests[0].aborted, true);
  resolve(ticket());
  await flush();
  t.mock.timers.tick(120000);
  assert.equal(run.sockets.length, 0);
  assert.equal(run.requests.length, 1);
});

test('a timed-out ticket cannot create a stale socket during the next attempt', async (t) => {
  let resolve;
  const run = setup(t, (_, n) =>
    n === 1
      ? new Promise((r) => {
          resolve = r;
        })
      : ticket(n),
  );
  t.mock.timers.tick(15000);
  assert.equal(run.requests[0].aborted, true);
  t.mock.timers.tick(1000);
  await flush();
  resolve(ticket());
  await flush();
  assert.equal(run.sockets.length, 1);
  assert.equal(run.sockets[0].ticket, ticket(2));
});

test('callbacks from an old connection cannot close or deliver into its replacement', async (t) => {
  const run = setup(t);
  await flush();
  const stale = { close: run.sockets[0].onclose, message: run.sockets[0].onmessage };
  stale.close({ code: 1006 });
  t.mock.timers.tick(1000);
  await flush();
  acknowledge(run.sockets[1]);
  stale.message({ data: '{"type":"balance_updated"}' });
  stale.close({ code: 1008 });
  assert.deepEqual(run.messages, []);
  assert.equal(run.connections.at(-1), true);
  assert.equal(run.sockets[1].closeCount, 0);
  run.stop();
  assert.equal(run.sockets[1].onmessage, null);
});

test('invalid tickets fail closed without JWT fallback', async (t) => {
  const run = setup(t, () => 'eyJhbGciOi.fake.jwt');
  await flush();
  t.mock.timers.tick(120000);
  assert.equal(run.sockets.length, 0);
  assert.equal(run.requests.length, 1);
});
