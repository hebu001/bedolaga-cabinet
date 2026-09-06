# Mandatory audit fixes — phase 2 (F01, F02, F03)

Date: 2026-09-06. Repository: `bedolaga-cabinet`. Local base: `d841826`, branch `codex/fix-mandatory-audit`. This phase changes the cabinet only. No server, SSH, provider account, deployment or push operation is part of this phase. The verified phase is recorded in a local commit.

## Problem and resulting behavior

F01: a single QueryClient outlived logout/login, allowing account B to see still-fresh private data belonging to A. F02: refresh, login, initialization, profile and permission responses could finish after logout/account replacement and restore A's credentials or state. F03: two tabs could send the same rotating refresh token, and the loser's 401 could clear the winner's credentials.

Every explicit login, same-user new login, logout, or shared session replacement now advances a local session generation. Refresh rotation retains that generation. Generation changes synchronously cancel private HTTP/query work, clear/replace the QueryClient, detach mutation observers, strip old mutation callbacks, reset profile/admin/permissions/blocking state, and stop the old WebSocket. Protected user/admin/permission routes are keyed by generation so their component state and query observers remount. One-time token callback pages (AutoLogin, VerifyEmail, OAuth and Telegram callback) retain their component identity, avoiding repeated token submission. Public query/mutation pages (Login, TelegramRedirect, MergeAccounts, PurchaseSuccess and QuickPurchase) remount by generation. Persistent theme/analytics/site-verification effects and deep-link branding are isolated in keyed leaves, preserving the page below and its one-time intent/countdown.

## Implementation contract

- `src/utils/session.ts` provides generation capture/checks, abort signals, boundary subscribers and response ownership stamps. A stamp can also check whether an authentication attempt is still the newest attempt.
- `src/utils/sessionQueryClient.ts` owns the active QueryClient. It uses installed TanStack Query APIs (`MutationCache`, `Mutation.setOptions`, observer `reset`, `cancelQueries`, `clear`). Clearing MutationCache alone does not cancel callbacks. Disposal therefore removes callbacks synchronously, including the microtask between a global hook and a per-mutation callback. Private cached data is never moved to the replacement client.
- `src/providers/SessionQueryProvider.tsx`, route keys in `App.tsx`/`PermissionRoute.tsx`, and WebSocketProvider connect the session boundary to React and socket lifetime. `SessionQueryScope` remounts query-owning leaves. TanStack hooks retain their initial Query/MutationObserver and do not rebind simply because the provider value changed: every new persistent/public query or mutation consumer must be inside this scope or an equivalent generation key. One-time token-consuming effects must remain outside that remounted subtree.
- `src/api/client.ts` captures request ownership at the actual Axios call site, before its async interceptors run. The request interceptor validates ownership, obtains a current access token, and binds caller/session cancellation. Both successful and failed responses check ownership before delivering data, changing blocking state or retrying. A 401 only retries within the same session. Original caller cancellation remains effective while refresh is pending; an aborted ticket request cannot replay afterward.
- `src/api/auth.ts` stamps token-issuing responses and rejects superseded login attempts. `completeLogin` is the single guarded consumer for Telegram, widget, OIDC, email, OAuth, deeplink, auto-login, email verification and merge results. Profile `/me` results are stamped too. Auth state no longer hydrates a persisted private profile before server validation.
- `src/store/auth.ts` and `src/store/permissions.ts` capture generation before async work and check it before applying results. Initialization reads the actual post-rotation refresh token and preserves credentials after transient errors so initialization can be retried. A shared replacement with credentials synchronously exposes loading state until initialization completes; protected routes remain in place instead of briefly navigating through `/login`.
- The one private native-fetch bypass, `adminBulkActions.ts` SSE, also refreshes before dispatch, aborts on a session boundary and checks generation before forwarding stream events.

## Token storage and cross-tab behavior

The authoritative shared credential is one localStorage record, `cabinet-session-v1 = { id, refreshToken }`. A single `setItem` publishes the session id and refresh token together. Access tokens remain tab-local in sessionStorage and are bound to the shared session id. This is atomic publication of one record; it is **not** a localStorage compare-and-swap or mutex.

Legacy `refresh_token`/`access_token` values are read for migration. New credential writes remove legacy credential/profile keys. Rotation retains the existing session id; logout/login creates a new random id. Other tabs react to storage/focus events and also synchronize before token/session checks, covering requests made before a queued storage event is delivered. They drop their old access token and private state; a shared login initializes a fresh `/me` and permissions in each tab.

When localStorage is unavailable, the current tab uses sessionStorage/memory fallback. Each operation still fences stale responses within that tab. If a write fails but deletion remains available (for example a quota error), old shared credential keys are removed instead of leaving the previous account published. When the browser denies all shared storage operations, cross-tab persistence/synchronization cannot be guaranteed; no atomic lock is claimed for that mode.

## Refresh and logout

- Normal rotating refresh keeps `X-Refresh-Token-Rotation: 1`. There is no backend rotation or `auth_version` relaxation.
- Within one tab, the active promise belongs to a generation, so an old refresh cannot take over a new login's singleflight operation.
- With Web Locks, cooperating same-origin tabs use the exclusive `cabinet-refresh-v1` lock. Refresh re-reads the token after acquiring the lock. Lock acquisition is bounded at 12 seconds; each HTTP refresh/revocation uses a 10 second Axios timeout. A lock timeout does not start an overlapping fallback request.
- Missing/security-denied Web Locks use optimistic rotating refresh. A stale 401 waits up to 6 × 150 ms for another tab's publication, then can retry a changed refresh token once. Writes check captured generation and source token. If the fallback cannot distinguish an invalid token from a winner whose response has not arrived, it preserves credentials and returns a retryable error. This supports ordinary unsupported-WebView operation without claiming a distributed mutex.
- Network failures, HTTP 5xx and timeouts preserve credentials and do not send the protected request with expired/anonymous credentials. Only a terminal 401/403 for the still-current source, while holding the supported shared lock, clears the session. A failed/stale refresh cannot clear a newer record.
- Logout invalidates local/shared state synchronously and revokes the captured refresh token using plain Axios. Revocation cannot itself trigger authentication refresh. A later successful refresh/login from the discarded session is ignored and its returned orphan refresh token is revoked, unless it is the current stored credential of the new session.

Backend reference was read-only: the local backend accepts a refresh token body on `/cabinet/auth/logout` without access-token authentication; `/auth/refresh` rotates when the existing rotation header is sent. No backend change was needed.

## Verification

`npm run test:auth` loads the actual TypeScript modules into isolated VM tab contexts. Only network and browser storage/lock surfaces are substituted; Axios, Zustand, QueryClient and MutationObserver are the installed implementations. Deferred responses exercise ordering rather than mirroring production logic.

Covered regressions include account A → logout → B with a still-fresh saved-cards key; delayed query/mutation callbacks including four awaited-global-hook microtask gaps; same-user new login versus healthy rotation; refresh after logout/B with old and rotated revocation; delayed login/init/profile/admin/permissions/blocking responses; all token-issuing login paths; valid/expired-token initialization and transient retry; Web Locks serialization; fallback rotation with rejection before/after winner publication; unsupported/denied locks; storage denial; network/timeout/503 failures; terminal versus ambiguous 401; bounded lock wait; cross-tab state invalidation; Axios invocation variants; old 401 responses; and caller cancellation during WS-ticket refresh.

Checks for this phase:

- Auth/session regression suite: **45 passed**.
- Prior single-use WebSocket ticket suite: **14 passed**.
- Independent headless Chrome probe against real modules served by local Vite: **11 passed**, including native same-origin Web Locks, browser storage events, actual 10-second HTTP timeout and HTTP/fallback contention ordering. Source hashes were stable throughout the run. Evidence: `../audit/frontend-backend-2026-09-06/fix-verification/auth-browser/report.json` (relative to the cabinet repository root).
- Independent real React/React Router Chrome checks: **4 targeted cases + 1 route case passed**. Theme CSS follows the new client, the public merge mutation works before/after replacement, actual AutoLogin/VerifyEmail each submit once under StrictMode, and a shared B replacement stays on the protected route without a `/login` detour. Before/after evidence and runnable scripts: `../audit/frontend-backend-2026-09-06/fix-verification/react-session-review/`.
- TypeScript/Vite build: **passed** (existing Browserslist age advisory only).
- Changed-file ESLint: **passed**. Formatting and `git diff --check`: **passed**.
- Global ESLint has an existing unrelated baseline in TrialOfferCard/hooks; this phase does not modify it.

API references: [MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [TanStack QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient). Installed library source was checked for the mutation/cache lifecycle used here.

## Limits and release notes

No live production behavior has been asserted. The browser/provider rollout must replace old cabinet assets: older tabs do not participate in the new shared-record/lock protocol. Backend compatibility remains the previously required coordinated WS-ticket/auth-version release.

Logout and orphan revocation are bounded best-effort network operations. If a server commits rotation and the response is irretrievably lost, the client cannot know the successor token to revoke or recover; credentials are preserved after timeouts and explicit login remains the recovery path. Without Web Locks, contention lasting longer than the bounded recovery window may require a subsequent retry. With all shared storage disabled, tabs operate independently.

The boundary prevents old client callbacks from applying private state. It cannot undo a mutation already accepted by the server; session cancellation must not be described as rolling back backend effects.
