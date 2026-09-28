# Admin merge, 2026-09-28

> Итог текущей интеграции: [FRONTEND-HANDOFF](FRONTEND-HANDOFF.md) и [VERIFICATION](VERIFICATION.md). Ниже сохранены этапные результаты владельца модуля; их промежуточные числа и прежний статус visual pending не заменяют итоговую проверку. Target-bot/live интеграция остаётся отдельным этапом.

Source work only: baseline `55a4038f` + upstream `f5ea595f` (1.79.0). No server calls or deployments; target merged bot is still unknown. The branch remains an integration candidate, not a proven live-compatible release.

## Ported structure and custom behavior

Upstream decomposition is retained: `components/admin/users`, `pages/adminUsers`, `components/admin/userDetail`, `pages/adminUserDetail`, `components/admin/bulkActions`, traffic-usage helpers, inline email-template editor/preview, and new reachability/reminder/system-error/grace modules. Existing accessibility and query/error handling changes are preserved. Legacy email-template preview route should redirect to the editor that now contains the preview tab.

Custom Apple class values are retained where the old element survives; extracted/new admin components use Apple foreground, muted, surface and orange accent tokens. The final synthetic visual pass compared Users, the UserDetail overview and its ticket conversation at 390×844 and 1440×900: six exact-baseline plus six candidate captures. It found and corrected blue avatars/navy surfaces, excessive hairline opacity and truncated mobile header name/email; final PNGs retain orange/gray styling, thin 8% borders and readable mobile identity/actions. This is a scoped visual comparison, not a pixel-identical or full-admin certification; tariffs/Remnawave and native WebView remain outside its visual coverage. See FRONTEND-HANDOFF.md for the final combined result.

- Users list keeps upstream URL state/infinite loading. Search is debounced in the real toolbar, query AbortSignal reaches HTTP, stale results cannot replace a different query, and errors expose retry. Loaded rows remain while typing. Desktop infinite-scroll observer and scroll-to-top use `.app-content` through `getPageScrollTarget`.
- Bulk selection retains hidden-page IDs, only toggles visible subscriptions, uses functional updates for rapid clicks, preserves subscription action mode across single-subscription pages, and renders real partial/all checkbox state. List HTTP consumes query AbortSignal; failures expose retry instead of successful empty state.
- Info page editor initializes exactly once after async editor readiness using the selected locale; later responses or locale changes do not erase edits.
- Telegram menu callback actions, fixed custom flags/helpers, and device aliases survive the split. Device labels retain alias → platform → model → HWID order.
- Signed media renewal is present in both standalone AdminTickets and new user-detail TicketsTab. Shared `useAdminTicketDetail` owns the query: media refreshes share an in-flight request; a completed reply/status mutation cancels the old GET before obtaining a fresh snapshot. Selected-ticket changes have separate query keys. `adminApi.getTicket` propagates AbortSignal. New user-detail action notifications and standalone ticket mutations respect the session generation.

## Explicit pending integration gates

`integrationCapabilities` is a release configuration, **not** backend capability discovery and **not** RBAC. Full `*:*` permission does not enable these integrations. Defaults remain false pending target-bot fixtures:

- Reachability: menu and shortcut/status query disabled; new implementation retained for integration.
- Reminders, system errors, grace-access, referral levels, coupons and legal pages: admin menu hidden and core route gate applies. Coupons exist in the baseline but the new editor schema remains unverified.
- Node GeoCheck: button additionally requires `nodeGeoCheck`; a node version alone is insufficient.
- Advanced user filters: `advancedUserFilters` guards new online/grace/traffic-low/no-payment/expiry views, missing-subscription filter and new sort/direction fields. Explicit URL states are normalized before HTTP requests to avoid a server silently ignoring unsupported filters. Original search/status/subscription/tariff/group/campaign filters and supported sorts remain.
- Numeric panel identity: stays off. Reminders/legal/tariff/recurring and other new endpoint fields still need complete target-bot schema verification; these frontend tests do not establish their live readiness.

## Panel identity and paths

`api/adminPanelIdentity.ts` reads the mode chosen by `numericPanelIdentity`, not whichever field happens to exist. UUID mode validates the proven baseline fields `remnawave_uuid`, `uuid`, `panel_uuid`; numeric mode validates upstream `remnawave_id`, `id`, `panel_user_id`. UUIDs are never converted to numbers. Stringified numbers, absent expected fields and mismatched schemas throw a contract error. Null is a valid unlinked state.

`adminUsersApi` adds an **internal** discriminated `panel_identity` after validation; it does not rename wire fields or fabricate a backend field. User support details display that identity. Pull is disabled without a real linked identity; numeric actions cannot obtain a numeric ID from UUID/null. Push with `create_if_missing:true` remains available for a valid local bot user ID, including a missing panel account.

All existing sync and user-action paths use `/cabinet/admin/users/{botUserId}` and optional `subscription_id`, not a panel ID. `getUserByTelegram` uses Telegram ID only on its named lookup route. UI links `/admin/users/{id}` use the local bot user ID. Node/squad routes in adminRemnawave still use their UUIDs; the panel-user numeric migration must not change those paths. No panel import/mapping/migration was performed. Exact future response bodies and panel links remain a bot-integration review item.

## Regression migration map

The original custom checks were migrated to actual new shipped components/hooks where upstream changed their architecture; they were not replaced by static string assertions.

| Original custom case | Current check |
| --- | --- |
| Rapid search commits only last text, keeps rows, resets page | `src/pages/adminUsers.test.tsx`: `commits only the last search after debounce and retains loaded rows while typing`; offset is 0 on new infinite-query key |
| Old search abort/late result | Same file: `cancels the older search and a late completion never replaces current results` |
| User request retry, no empty success, semantic row link | Same file: `failed request offers retry instead of empty success; rows remain semantic links` |
| Bulk page-local some/all, hidden IDs, rapid toggles | `test/admin-regressions.test.cjs`: original bulk-header case, executes shipped AdminBulkActions + QueryObserver |
| Bulk filter visible selection | Same CJS file: original bulk-filters case |
| Async locale editor initialization, no later edit overwrite | Same CJS file: original editor case |
| Bulk request cancellation/late response/retry | Same CJS file: original bulk-page case |
| Admin reply while old signed-media GET is pending | `src/components/admin/userDetail/ticketMutationRace.test.tsx`: actual user-detail and standalone `real reply handler refreshes after POST and survives a late media snapshot`; shared hook case retained in `ticketMediaRace.test.tsx` |
| Admin status while old signed-media GET is pending | Same consumer test: actual user-detail and standalone `real status handler refreshes after POST and survives a late media snapshot`; shared hook case retained |
| Shared media GET and selected-ticket isolation | Same hook test: `shares media refreshes and isolates a different selected ticket` |

The media checks execute the real shared query hook and QueryClient with synthetic HTTP results. Consumer cases also render the shipped TicketsTab/TicketChat and standalone AdminTickets, press the real reply/status buttons, and exercise useAdminAction. The MessageMediaGrid image-decoding boundary is replaced with a button calling the consumer-provided renewal callback; no query refresh method is called directly by the consumer tests. They prove frontend handler wiring and snapshot ordering, not a real backend POST contract. The obsolete AdminUserDetail declaration extractor was removed from `test/ticket-media.test.mjs`; its remaining signed-token, expiry, retry, timeout and singleflight tests remain intact. Admin CJS now runs four cases; three search cases run with the upstream DOM suite. Test-only locale fixtures combine user/admin JSON dictionaries; runtime dictionaries remain split.

Additional `adminPanelIdentity.test.ts` checks both explicit schemas, mismatches, null/missing IDs, no coercion and allowed local-ID creation. Advanced-filter tests cover the disabled adapter; reachability integration-gate test verifies zero API requests while disabled. Tests for candidate reachability features explicitly opt into mock integration, keeping default-off behavior separately covered.

## Verification status

Node 24.19 bundled runtime. Initial broad admin run: 607 passed / 5 failed; failures were two newly gated reachability fixture cases (4 assertions) and one neutral palette assertion. The feature fixtures were made explicit, the palette assertion follows Apple muted color, and the subsequent affected-scope run passed 51/51. Earlier Users/UserDetail/media focused run passed 33/33; custom admin CJS passed 4/4. Final full admin/type/build results are recorded by the integrating task after all workers finish. The preceding counts are historical module checks; final scoped visual evidence is described above and overall verification is in FRONTEND-HANDOFF.md. Deployment readiness or target-bot compatibility is not claimed.

## Independent review corrections

- A pending search could replay after browser back or Reset. The real UsersToolbar now cancels its timer when external `q` changes and immediately on explicit Reset, including when the committed `q` was already empty. Three new actual-component cases failed before the fix and pass afterward. Other filter changes still use the latest state when a pending search commits.
- Added four consumer-level media/mutation races (reply and status in both ticket screens), retaining the three hook tests. Each begins a deferred media GET through the consumer callback, completes the real POST handler, requires a new GET and cancellation of the older request, renders the new message/status/token, then resolves the old GET and checks it cannot overwrite the UI. A temporary source mutation removing the consumers' detail refresh made all four cases fail; both production files were restored byte-for-byte in `finally`.
- Replaced the CJS fake-hook assignment expression with an explicit assignment for lint compliance.

Review evidence: `/tmp/admin-review-before-toolbar.log` (3 expected failures), `/tmp/admin-consumer-mutation-proof.log` (4 expected failures when refresh was removed), `/tmp/admin-review-after.log` (25 focused cases passed before the bounded mutation check). Post-restoration run: `/tmp/admin-review-restored.log`, 25/25 focused cases passed; custom CJS admin/media 18/18 passed. Lint has no errors in the five touched code/test files (four existing template-literal suggestions remain in the CJS harness).
