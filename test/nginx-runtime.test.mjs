import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(import.meta.dirname, '..');
const nginx = process.env.NGINX_BINARY || 'nginx';
const listen = async (server) => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
};
const close = (server) => new Promise((resolve) => server.close(resolve));
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cabinet-nginx-'));
function render(directory, origin = '') {
  const file = path.join(directory, 'api.conf');
  const result = spawnSync('sh', [path.join(root, 'docker/40-cabinet-api.sh')], {
    env: { ...process.env, CABINET_BACKEND_ORIGIN: origin, CABINET_API_CONFIG: file },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || 'nginx rendering failed');
  return file;
}
async function startNginx(directory, origin = '', caFile) {
  const portProbe = http.createServer();
  const port = await listen(portProbe);
  await close(portProbe);
  const apiFile = render(directory, origin);
  if (caFile)
    fs.writeFileSync(
      apiFile,
      fs.readFileSync(apiFile, 'utf8').replace('/etc/ssl/certs/ca-certificates.crt', caFile),
    );
  const publicDir = path.join(directory, 'html');
  fs.mkdirSync(path.join(publicDir, 'assets'), { recursive: true });
  fs.writeFileSync(
    path.join(publicDir, 'index.html'),
    '<!doctype html><title>Cabinet fixture</title>',
  );
  fs.writeFileSync(
    path.join(publicDir, 'assets/app-AbCd1234.js'),
    'export const fixture = true;\n'.repeat(100),
  );
  fs.writeFileSync(path.join(publicDir, 'assets/config.js'), 'window.CONFIG = {};');
  fs.writeFileSync(
    path.join(publicDir, 'assets/ru-AbCd1234.json'),
    JSON.stringify({ copy: 'translation'.repeat(200) }),
  );
  const configuration = fs
    .readFileSync(path.join(root, 'nginx.conf'), 'utf8')
    .replace('listen 80;', `listen 127.0.0.1:${port};`)
    .replace('/usr/share/nginx/html', publicDir)
    .replace('/etc/nginx/cabinet-api.conf', apiFile)
    .replace('/var/log/nginx/access.log', path.join(directory, 'access.log'));
  const config = path.join(directory, 'nginx.conf');
  fs.writeFileSync(
    config,
    `daemon off; master_process off; pid ${directory}/nginx.pid; error_log ${directory}/error.log warn; events {} http { types { text/html html; application/javascript js; application/json json; } ${configuration} }`,
  );
  const check = spawnSync(
    nginx,
    ['-t', '-p', `${directory}/`, '-c', config, '-e', `${directory}/error.log`],
    { encoding: 'utf8' },
  );
  assert.equal(check.status, 0, check.error?.message || check.stderr);
  const process = spawn(
    nginx,
    ['-p', `${directory}/`, '-c', config, '-e', `${directory}/error.log`],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderr = '';
  process.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const exited = once(process, 'exit');
  const address = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(address)).ok) break;
    } catch {}
    if (attempt === 59) {
      process.kill();
      throw new Error(`nginx startup failed: ${stderr}`);
    }
    await delay(25);
  }
  return {
    address,
    async stop() {
      process.kill('SIGQUIT');
      await exited;
      return stderr;
    },
  };
}

test('renderer rejects credentials, paths and config injection without echoing sensitive input', () => {
  const dir = temporary();
  try {
    for (const origin of [
      'https://user:secret@host',
      'https://host/path',
      'http://host;return 200;',
      'http://host\nlocation / {}',
    ]) {
      assert.throws(() => render(dir, origin), /must be an http\(s\) origin/);
    }
    const tls = fs.readFileSync(render(dir, 'https://api.example.test:8443/'), 'utf8');
    assert.match(tls, /proxy_pass https:\/\/api\.example\.test:8443\//);
    assert.match(tls, /proxy_ssl_name api\.example\.test;/);
    assert.match(tls, /proxy_ssl_verify on;/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('actual nginx: unconfigured API is JSON 503, SPA works, only hashed assets are immutable', async () => {
  const dir = temporary();
  let server;
  try {
    server = await startNginx(dir);
    for (const route of ['/api', '/api/cabinet/balance', '/api/fake.js?ticket=secret-ticket']) {
      const response = await fetch(`${server.address}${route}`);
      assert.equal(response.status, 503);
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.equal((await response.json()).detail, 'Cabinet backend is not configured');
    }
    const html = await fetch(`${server.address}/subscriptions/42`);
    assert.equal(html.status, 200);
    assert.match(html.headers.get('cache-control'), /no-cache/);
    const hashed = await fetch(`${server.address}/assets/app-AbCd1234.js`);
    assert.match(hashed.headers.get('cache-control'), /immutable/);
    assert.equal(hashed.headers.get('content-encoding'), 'gzip');
    const locale = await fetch(`${server.address}/assets/ru-AbCd1234.json`);
    assert.match(locale.headers.get('cache-control'), /immutable/);
    assert.match(locale.headers.get('content-type'), /application\/json/);
    assert.equal(locale.headers.get('content-encoding'), 'gzip');
    const unversioned = await fetch(`${server.address}/assets/config.js`);
    assert.equal(unversioned.headers.get('cache-control'), 'no-cache');
    assert.equal((await fetch(`${server.address}/assets/missing.js`)).status, 404);
    await server.stop();
    server = null;
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'access.log'), 'utf8'), /secret-ticket|\?/);
  } finally {
    if (server) await server.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('actual nginx: API strips prefix, preserves method/body/query and performs WebSocket upgrade', async () => {
  const dir = temporary();
  let server;
  const calls = [];
  const backend = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    calls.push({ url: request.url, method: request.method, body, host: request.headers.host });
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(calls.at(-1)));
  });
  backend.on('upgrade', (request, socket) => {
    calls.push({ url: request.url, upgrade: request.headers.upgrade });
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
    );
    socket.end();
  });
  const backendPort = await listen(backend);
  try {
    server = await startNginx(dir, `http://127.0.0.1:${backendPort}`);
    const response = await fetch(`${server.address}/api/cabinet/example?ticket=secret-query`, {
      method: 'POST',
      body: '{"amount_kopeks":10000}',
      headers: { 'content-type': 'application/json' },
    });
    assert.deepEqual(await response.json(), {
      url: '/cabinet/example?ticket=secret-query',
      method: 'POST',
      body: '{"amount_kopeks":10000}',
      host: `127.0.0.1:${backendPort}`,
    });
    const edge = await fetch(`${server.address}/api?check=yes`, { redirect: 'manual' });
    assert.equal(edge.status, 308);
    assert.match(edge.headers.get('location'), /\/api\/\?check=yes$/);
    await new Promise((resolve, reject) => {
      const request = http.request(`${server.address}/api/cabinet/ws?ticket=secret-query`, {
        headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
      });
      request.on('upgrade', (response, socket) => {
        assert.equal(response.statusCode, 101);
        socket.destroy();
        resolve();
      });
      request.on('error', reject);
      request.setTimeout(3000, () => {
        request.destroy();
        reject(new Error('upgrade timed out'));
      });
      request.end();
    });
    assert.ok(
      calls.some(
        (call) => call.url === '/cabinet/ws?ticket=secret-query' && call.upgrade === 'websocket',
      ),
    );
    await server.stop();
    server = null;
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'access.log'), 'utf8'), /secret-query/);
  } finally {
    if (server) await server.stop();
    await close(backend);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('actual nginx: HTTPS upstream sends SNI and verifies the configured certificate', async () => {
  const dir = temporary();
  let server;
  const key = path.join(dir, 'key.pem'),
    cert = path.join(dir, 'cert.pem'),
    config = path.join(dir, 'cert.cnf');
  fs.writeFileSync(
    config,
    '[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN=localhost\n[v3]\nsubjectAltName=DNS:localhost\nbasicConstraints=critical,CA:TRUE\n',
  );
  const generated = spawnSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-sha256',
      '-days',
      '1',
      '-config',
      config,
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(generated.status, 0, generated.stderr);
  let sni;
  const backend = https.createServer(
    { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
    (request, response) => {
      sni = request.socket.servername;
      response.setHeader('content-type', 'application/json');
      response.end('{"secure":true}');
    },
  );
  const port = await listen(backend);
  try {
    server = await startNginx(dir, `https://localhost:${port}`, cert);
    const response = await fetch(`${server.address}/api/cabinet/status`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { secure: true });
    assert.equal(sni, 'localhost');
  } finally {
    if (server) await server.stop();
    await close(backend);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
