# Cabinet WebSocket tickets

Prepared from `chore/sync-1.57` at `e511ddddcf735a9a0c2c5363d78e389d038c154a`.
Requires the bot session-security fix (`d4cdcd12`, migration `0104` after `0103`).

The provider requests `POST /cabinet/ws/ticket` through the existing Axios client.
The client obtains the current access token from storage, performs the normal
refresh flow and supplies it in the Authorization header. Browser Origin must
match the bot's `CABINET_URL` or explicit `CABINET_ALLOWED_ORIGINS` allowlist.
Do not set Origin manually or use a wildcard to bypass this check.

The returned 30-second, one-use ticket is immediately used as
`/cabinet/ws?ticket=...`. Each reconnect obtains a fresh ticket; JWT query
parameters and fallback to the old protocol are absent. API prefixes, absolute
HTTP(S) base URLs and the cabinet suffix are preserved.

Connection status becomes ready after the server's `connected` message. Ticket
fetch and acknowledgement together have a 15-second deadline. Network/server
failures and close code 1008 retry with exponential delays, up to five attempts.
A ticket request after access expiry uses the normal refresh mechanism. HTTP
4xx failures stop retries except 429. Logout, account/token replacement and React
cleanup abort outstanding requests, detach handlers and invalidate late results.
Errors are not logged with Axios headers or WebSocket URLs.

## Coordinated release

Prepare both static cabinet assets and bot code before switching production.
Apply migrations 0103/0104 as required by the bot release and activate compatible
backend and cabinet versions in the same release window. An old cabinet sends
JWTs in WS URLs; a new cabinet cannot use an old backend lacking `/ws/ticket`.
Clients open during the switch may need a page reload. Do not roll back to bot
code that ignores session revocation after password resets have occurred.

Review proxy/CDN access logs so query credentials (`token` and `ticket`) are not
recorded, including rejected requests from cached old clients. This repository
change neither edits proxy settings nor removes previously recorded credentials.
The deployment, real Origin handling and proxy logging still require verification
on the target environment; no production changes were made during this phase.

## Verification

Node 22.18+ (or newer supported Node) can run the dependency-free controller tests:

```sh
npm ci
npm run test:ws
npm run type-check
npm run build
```

Tests use fake sockets and HTTP responses, checking URL construction, expiry,
HTTP rejection, retry limits, ping/events, logout during ticket fetch, handshake
timeout and stale callbacks. They do not send payments or contact production.
