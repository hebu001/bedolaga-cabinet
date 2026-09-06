interface ConnectionOptions {
  getTicket: (signal: AbortSignal) => Promise<string>;
  createSocket: (ticket: string) => WebSocket;
  onConnected: (connected: boolean) => void;
  onMessage: (message: { type: string; [key: string]: unknown }) => void;
  maxReconnectAttempts: number;
  maxReconnectDelayMs: number;
  pingIntervalMs: number;
}

export function cabinetSocketEndpoints(apiBase: string, pageUrl: string, ticket: string) {
  const api = new URL(apiBase.trim(), pageUrl);
  if (!['http:', 'https:'].includes(api.protocol)) throw new Error('Invalid API protocol');
  const basePath = api.pathname.replace(/\/+$/, '');
  const cabinetPath = basePath.endsWith('/cabinet') ? '' : '/cabinet';
  api.pathname = `${basePath}${cabinetPath}/ws`;
  api.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
  api.search = '';
  api.hash = '';
  api.searchParams.set('ticket', ticket);
  return { ticketPath: `${cabinetPath}/ws/ticket`, socketUrl: api.toString() };
}

// Each attempt owns its request, socket and timers. Disposal also invalidates
// callbacks already queued by the browser or an HTTP refresh interceptor.
export function connectCabinetSocket(options: ConnectionOptions): () => void {
  let stopped = false;
  let attempts = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let disposeAttempt = () => {};

  const connect = async () => {
    if (stopped) return;
    const request = new AbortController();
    let active = true;
    let socket: WebSocket | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    disposeAttempt = () => {
      active = false;
      request.abort();
      clearTimeout(readyTimer);
      clearInterval(pingTimer);
      if (socket) {
        socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
        socket.close();
      }
    };

    const disconnect = (retry: boolean) => {
      if (!active || stopped) return;
      disposeAttempt();
      options.onConnected(false);
      if (retry && attempts < options.maxReconnectAttempts) {
        const delay = Math.min(1000 * 2 ** attempts++, options.maxReconnectDelayMs);
        retryTimer = setTimeout(() => void connect(), delay);
      }
    };

    // Includes ticket fetch and the server's authentication acknowledgement.
    const readyTimer = setTimeout(() => disconnect(true), 15_000);
    try {
      const ticket = await options.getTicket(request.signal);
      if (!active || stopped) return;
      if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
        disconnect(false);
        return;
      }
      socket = options.createSocket(ticket);
      socket.onmessage = (event) => {
        if (!active || stopped) return;
        let message: { type: string; [key: string]: unknown };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
        if (message.type === 'connected') {
          clearTimeout(readyTimer);
          attempts = 0;
          options.onConnected(true);
          if (pingTimer) return;
          pingTimer = setInterval(() => {
            if (socket?.readyState === 1) {
              try {
                socket.send(JSON.stringify({ type: 'ping' }));
              } catch {
                disconnect(true);
              }
            }
          }, options.pingIntervalMs);
        } else if (message.type !== 'pong') {
          options.onMessage(message);
        }
      };
      // 1008 can mean access expiry: a fresh HTTP ticket request uses the
      // regular refresh flow. HTTP auth failures below stop the retry loop.
      socket.onclose = (event) => disconnect(event.code !== 1000);
      socket.onerror = () => disconnect(true);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const retry = !status || status === 429 || status >= 500;
      disconnect(retry);
    }
  };

  options.onConnected(false);
  void connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    disposeAttempt();
    options.onConnected(false);
  };
}
