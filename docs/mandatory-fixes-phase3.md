# Mandatory audit fixes — phase 3, cabinet F04

Date: 2026-09-06. Repository: `bedolaga-cabinet`, branch `codex/fix-mandatory-audit`. Base is phase 2 commit `9c5603f6f09846f6597b172fa0e70128e52f88b2`. This document covers cabinet F04 only; the subscription-page fixes have separate ownership and evidence. No backend, provider, SSH, push or deployment operation was performed.

## Problem and behavior

The backend requires a signed media token before downloading a Telegram file. Ticket responses already contain `media_token` for legacy single attachments and `token` on each `media_items` entry. The cabinet dropped these fields and built unsigned URLs, causing 404 responses for user/admin photos, video and documents. An unset `VITE_API_URL` also omitted the shared `/api` prefix.

The cabinet now preserves each signature, uses the same exported `API_BASE_URL` as the authenticated API client, normalizes its trailing slash, and encodes file ids and tokens independently. `ticketsApi.getMediaUrl(fileId, token)` returns `null` when the file id or token is absent. It never creates an unsigned fallback. Thumbnail, fullscreen, video and document URLs all use the corresponding file's token.

User and admin media types now include optional response token fields. `getMessageMedia` prefers album items and maps `media_token` into a single item's token only for a legacy attachment. Missing album signatures are not substituted with another file's signature.

## Expiry and recovery

The unchanged backend contract is `exp.signature`, with a 24-hour TTL and HMAC bound to the file id and expiry. The frontend reads expiry solely to decide when to renew; the backend remains the only signature verifier and access-control authority.

`useTicketMedia` renews the authenticated ticket response five seconds before the earliest attachment expiry. It also checks on focus/visibility restoration because background timers can be throttled. Missing signatures and media load errors trigger the same bounded recovery path. A media message shares one active refresh; automatic attempts are limited to one per minute, including unchanged/invalid responses and permanent 404s. Explicit Retry permits a user-initiated attempt. The UI stops waiting after 15 seconds; late results cannot update an unmounted/different session's media state. Underlying ticket requests retain the API client's timeout and session cancellation.

Document activation checks expiry again at click time. A valid signed anchor opens normally. When renewal is necessary, the click reserves a blank window, removes its opener, refreshes the ticket, and navigates that window only to a newly signed, unexpired URL for the same file in the same session. Failure closes it. If the browser blocks the window, the renewed signed anchor remains available for a subsequent click. No expired/missing-token fallback is opened.

All three consumers return the refreshed message to the grid:

| Consumer          | Renewal path                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `Support`         | Current `['ticket', id]` query `refetch({ cancelRefetch: false, throwOnError: true })`               |
| `AdminTickets`    | Current `['admin-ticket', id]` query with the same refetch options                                   |
| `AdminUserDetail` | Background `loadTicketDetail(id, true)`, preserving mounted media and sharing one request per ticket |

The imperative admin loader now checks the selected ticket id and request sequence before changing the selected detail. A late refresh for ticket A cannot replace ticket B. Only background media renewals share an active request; foreground loads after a reply/status POST always start a newer GET, so an older pre-mutation snapshot cannot hide the new reply/status. A failed background load returns no message, which the grid treats as a visible bounded failure. The existing phase 2 account/session fences remain active for these requests and callbacks.

## Verification

`npm run test:media` uses the actual TypeScript media helpers and actual user/admin API modules with only HTTP transport substituted. **17 cases pass**: four base URL forms and encoding, missing credentials, user/admin album response flow, all three legacy media types, a missing album token, expiry parsing/boundary, concurrent failure singleflight/cooldown, explicit retry after failure, a 15-second timeout with late completion, and three actual admin loader/handler cases. The latter extract the page's declarations with the TypeScript AST and defer transport responses: reply and status changes each require a new post-mutation GET and reject the late old snapshot; background requests still coalesce and a previous ticket cannot replace the current one.

Independent Chrome review passes **11 scenarios** on actual API modules, `MessageMediaGrid` and `useTicketMedia`: user/admin albums and fullscreen, legacy photo/video/document, missing/expired token renewal, bounded failed or unchanged-token responses, repeated image 404, and document expiry checked at activation with a popup opening the renewed signed URL. No page errors or unsigned requests were observed, and source hashes remained stable. Fixtures use the read-only backend signing/serialization functions with a dummy secret; **8 backend contract groups pass**. Evidence is kept under `../audit/frontend-backend-2026-09-06/fix-verification/f04-media-review/` relative to the cabinet repository root (`browser-results.json`, `browser-extra-results.json`, `fixtures.json` and the review report).

Original F04 validation: `npm run test:auth` **45/45**, `npm run test:ws` **14/14**, the media suite, `npm run build`, changed-file ESLint, Prettier and `git diff --check` all pass. The subsequent admin-loader-only correction reruns media **17/17**, build, changed-file ESLint, Prettier and `git diff --check`; auth/WS code is unchanged. Before/after logs for the confirmed loader regression are `loader-mutation-before.log` (reply/status assertions fail) and `loader-mutation-after.log` (all pass) in the same evidence directory. Build reports the existing Browserslist data-age warning. No unrelated lint baseline repairs are included.

## Limits

A signed media URL is a temporary download capability; clearing the cabinet session removes it from private UI state but does not revoke a previously issued URL on the server. This phase does not change the backend's 24-hour expiry policy. Permanent missing files and unsupported/corrupt media remain errors after bounded renewal; the UI offers explicit retry instead of sending repeated automatic requests. No live Telegram media or production account was accessed by the fixtures.
