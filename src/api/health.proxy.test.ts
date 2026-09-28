import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

const servers: http.Server[] = [];
async function listen(server: http.Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) return resolve();
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

async function loadHealth(apiUrl: string, browserOrigin?: string, override?: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', apiUrl);
  vi.stubEnv('VITE_HEALTH_URL', override ?? '');
  // Node's HTTP adapter needs an origin for the same relative URL a browser
  // resolves against its page. No request or response is mocked.
  const { default: axios } = await import('axios');
  axios.defaults.baseURL = browserOrigin;
  const health = await import('./health');
  return health;
}

describe('backend health through the cabinet proxy', () => {
  it.each(['/api', '/api/'])(
    '%s probes the API upstream, never the SPA fallback',
    async (apiUrl) => {
      let backendStatus = 503;
      const backendPaths: string[] = [];
      const backendOrigin = await listen(
        http.createServer((request, response) => {
          backendPaths.push(request.url ?? '');
          response.writeHead(backendStatus, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ status: backendStatus === 200 ? 'ok' : 'unavailable' }));
        }),
      );
      const frontendPaths: string[] = [];
      const browserOrigin = await listen(
        http.createServer((request, response) => {
          frontendPaths.push(request.url ?? '');
          if (!request.url?.startsWith('/api/')) {
            response.writeHead(200, { 'content-type': 'text/html' });
            response.end('<!doctype html><title>Cabinet SPA</title>');
            return;
          }
          const upstream = http.request(`${backendOrigin}${request.url.slice(4)}`, (received) => {
            response.writeHead(received.statusCode ?? 502, received.headers);
            received.pipe(response);
          });
          upstream.on('error', () => {
            response.writeHead(502).end();
          });
          request.pipe(upstream);
        }),
      );
      const { HEALTH_URL, pingBackend } = await loadHealth(apiUrl, browserOrigin);
      expect(HEALTH_URL).toBe('/api/health/unified');
      expect(await pingBackend()).toBe(false);
      backendStatus = 200;
      expect(await pingBackend()).toBe(true);
      backendStatus = 404;
      expect(await pingBackend()).toBe(true);
      expect(frontendPaths).toEqual(Array(3).fill('/api/health/unified'));
      expect(backendPaths).toEqual(Array(3).fill('/health/unified'));
    },
  );

  it('keeps health at the origin root for an absolute API URL with a subpath', async () => {
    const paths: string[] = [];
    const origin = await listen(
      http.createServer((request, response) => {
        paths.push(request.url ?? '');
        response.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
      }),
    );
    const { HEALTH_URL, pingBackend } = await loadHealth(`${origin}/cabinet`);
    expect(HEALTH_URL).toBe(`${origin}/health/unified`);
    expect(await pingBackend()).toBe(true);
    expect(paths).toEqual(['/health/unified']);
  });

  it('uses an explicit health override unchanged', async () => {
    const paths: string[] = [];
    const origin = await listen(
      http.createServer((request, response) => {
        paths.push(request.url ?? '');
        response.writeHead(503, { 'content-type': 'application/json' }).end('{"status":"down"}');
      }),
    );
    const { HEALTH_URL, pingBackend } = await loadHealth('/api', undefined, `${origin}/health`);
    expect(HEALTH_URL).toBe(`${origin}/health`);
    expect(await pingBackend()).toBe(false);
    expect(paths).toEqual(['/health']);
  });
});
