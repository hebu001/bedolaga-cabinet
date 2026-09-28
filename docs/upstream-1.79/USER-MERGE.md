# User-facing merge: EvoVPN + upstream 1.79

> Итог текущей интеграции: [FRONTEND-HANDOFF](FRONTEND-HANDOFF.md) и [VERIFICATION](VERIFICATION.md). Ниже сохранены этапные результаты владельца модуля; их промежуточные числа и прежний статус visual pending не заменяют итоговую проверку. Target-bot/live интеграция остаётся отдельным этапом.

Source candidate only. Target bot is being merged separately; no backend/live compatibility or pixel-identical result is claimed. No server/prod changes, deployment, migration, real payment, user data or credentials are part of this work.

## Implementation and deliberate custom layout differences

- Purchase now uses upstream `TariffPickerGrid`, `TariffPurchaseForm`, `ClassicPurchaseWizard` and `SwitchTariffSheet`. The old monolithic purchase page is not kept. Custom inline top-up was added as `PurchaseTopUpSheet` reusing the existing `TopUpPanel`; fixed shortage, provider min/max, chosen period/traffic and exact subscription ID survive preflight. Only a typed HTTP 402 with a positive integer `detail.missing_amount` authorizes invoice creation; quote changes require another confirmation. A completed concurrent purchase skips invoice creation.
- Classic/switch previews include subscription ID in their keys. Stale/error/loading quotes cannot submit a mutation. Purchase, switch and reduction callbacks check session generation, including late success. Unknown/non-finite balance does not authorize a paid action.
- Main Dashboard, Subscription, Balance, Profile and Support preserve custom Apple Dark presentation, fixed-screen behavior and inline panels. Upstream logic was ported into those shells: selected subscription ID on dashboard/device/traffic operations; legacy subscriptions requiring tariff selection; best-value renewals/gifts; countdown-based email resend; structured API errors; safe storage; localized date/number conventions; contact fallback and wrapped messages. Main Subscription intentionally keeps its custom inline management layout, while new upstream manage/sheet/lite components remain available.
- Profile keeps linked accounts/referrals in its accordion, Telegram ID copying and fixed 80/90 notifications. Browser OAuth redirects require successful persistent state storage. Current linked-account Telegram OIDC/widget fallback is retained.
- Provider references do not become local payment IDs. Return URLs alone never imply payment. TopUpResult preserves exact payment identity, absolute timeout and renewal return destination. PurchaseSuccess treats verification outages as unknown with retry; only a server failed/expired status renders failure. CompleteLogin/session fencing stays with core auth handling.
- SetupWizard preserves INCY-first Apple setup, separate plain display/copy URL and Happ encrypted/native URL, and hide-link behavior. Clipboard uses the shared WebView fallback. Signed documents retain native Telegram navigation. Web expiration renewal reserves a safe placeholder inside the original click, then navigates that window only after signature and session checks; blocked popups expose an explicit retry. Media never falls back to an unsigned URL.
- Gift sharing accepts upstream canonical artifacts and preserves full legacy gift claim codes; Telegram start payload retains the literal `GIFT_` prefix. Wheel keeps upstream SVG transform/layering fixes alongside custom styling.

## Features retained but not activated

These are explicit release gates from `src/config/integrationCapabilities.ts`, not detected backend support. `recurringPayments` blocks new SBP/Lava purchase/manage/saved-binding requests and buttons even if options or cache say enabled. Existing saved-card functionality remains. `liteMode` keeps lite routes/components inactive. `referralLevels` controls the updated referral UI embedded in the custom profile; current baseline referrals still work. Core additionally gates avatar, consent/legal integration, coupons/public resend and admin-only new contracts. Candidate source must not be described as all upstream 1.79 features live-ready.

Before enabling: record the merged bot SHA, validate actual endpoint bodies/optional fields/permission failures and run the integration scenarios. In particular confirm `missing_amount` units, recurring status shapes, subscription selection, paid trial cost, gift canonical fields and signed attachment expiry.

## Regression mapping

| Original scenario | Current executable check |
| --- | --- |
| Classic/switch quote keys isolate subscription IDs; fetching/error prevents mutation | `test/payment-flow.test.mjs`, original case name retained; declaration extraction points to real `ClassicPurchaseWizard` and `SwitchTariffSheet` after decomposition |
| Tariff cart preflight allows only expected 402; malformed 402/503 do not invoice; completed purchase skips invoice; changed amount needs confirmation | Same custom suite, original preflight case; now extracts actual `PurchaseTopUpSheet.prepare` |
| Selected period/traffic/target carried into tariff cart | `customFlow.test.tsx`: real TariffPurchaseForm + PurchaseTopUpSheet; asserts actual `purchaseTariff(7, 90, undefined, 42)` and unchanged selection after changed quote |
| Fixed shortage/provider min/max/method switching; Stars prep failure; exact provider-vs-local IDs; URL is unverified; timeout/unknown; renewal returnTo/period | Original `test/payment-flow.test.mjs` cases retained on shipped components/API |
| Stale price, unknown balance, default-off recurring, changed session before call and after purchase success | New real component cases in `src/components/subscription/purchase/customFlow.test.tsx` |
| INCY/raw-vs-crypt/hide-link and connection error/wizard slot retention | `test/connection-link.test.mjs` retains all 8 cases; only moved shared imports are mocked |
| Paid trial unknown/loading/error balance | `test/trial-balance.test.cjs`, original cases retained |
| Signed-media API normalization, expiry, bounded refresh/retry and singleflight | Original `test/ticket-media.test.mjs` retained |
| Admin reply/status races and selected-ticket stale response | Admin-owned `src/components/admin/userDetail/ticketMediaRace.test.tsx`; exact mapping in `ADMIN-MERGE.md` |
| Signed document platform navigation, expiry renewal, failed renewal/session switch never open URL | `src/components/tickets/documentNavigation.test.tsx`, eleven DOM cases using the real media hook and web adapter |
| Legacy gift token must not be shortened | Additional `src/utils/giftShare.test.ts` case, alongside upstream canonical-artifact tests |

## Synthetic fixtures and visual review entry states

Everything below is synthetic. Fixtures reflect frontend types and responses consumed by tests, not evidence of the unfinished backend contract. Do not use real authenticated API, payment providers or real subscription/media URLs for visual testing.

Reusable concrete fixture: `src/components/subscription/purchase/customFlow.fixtures.ts` exports typed `customFlowTariff` (ID 7; 30 days = 1000 kopeks, 90 days = 3000; 100 GB; 3 devices). `customFlow.test.tsx` mounts real components under fresh QueryClient + MemoryRouter, uses `subscriptionId=42`, `balanceKopeks=2000`, Russian labels, platform `web`, current session generation 1, and disabled optional capabilities. The top-up transport fixture is `AxiosError` HTTP 402 `{detail:{missing_amount:1000}}`; changed quote uses 1500. Payment methods API returns `[]` in this isolated preflight harness because invoice rendering/creation is exercised separately in the custom payment suite.

For full-page browser review, intercept **all** HTTP/WS before mounting; seed a synthetic signed-in user in the current auth store through its supported test path, with startup initialization complete and a stable session generation. Use local/no-op platform openers; `https://*.invalid` URLs only. Do not simply put a token in localStorage and assume protected startup is ready. Upstream runtime dictionaries are split; use the real Russian dictionary/bootstrap and do not ship the test-only combined locale helper. Set a fixed clock around 2026-09-28 and deterministic random values if screenshots include wheel/animation.

Minimum page/state matrix at 390×844 and 1440×900:

| Entry state | Required synthetic responses and interactions |
| --- | --- |
| `/`, dashboard, then select another subscription | Auth user ID 9001, Telegram ID 900000001; subscriptions-list items IDs 42 and 43; exact `getSubscription(42/43)` status wrapper `{has_subscription:true,subscription:{...}}`, devices and connection URLs; verify active selection governs renew, connection, devices and traffic. Use real `Subscription`/`SubscriptionListItem` fields from types. |
| `/subscriptions/42` | Same subscription plus purchase-options, connectionLink and devices; active, expired, `requires_tariff_selection:true`, daily paused, no-link, hidden-link and cached-error variants; view custom sheets without calling live mutations. |
| `/subscription/purchase?subscriptionId=42&renew=1` | Tariff fixture above within tariff purchase-options response; click 90 days then pay; mock 402 shortage1000 and changed1500; payment methods fixture needs `id,name,description,min_amount_kopeks,max_amount_kopeks,is_available`. Include minimum10000 > shortage, maximum500 < shortage, stale quote and missing balance variants. |
| `/balance?topup=1&amountKopeks=1000&returnTo=%2Fsubscriptions%2F42%2Frenew%3Fperiod%3D90` | Balance `{balance_kopeks:2000,balance_rubles:20}`, paginated empty transactions, synthetic methods; mock invoice URL `https://pay.invalid/invoice`, provider reference and distinct local ID. Return pending, confirmed exact, wrong-ID, timeout/unknown; never let URL `status=success` imply success. |
| `/profile`, expand account/referral/notification panels | Synthetic auth user; baseline referral-info/terms/list/earnings, partner-status, email-auth-enabled, notification-settings and linked providers/config; existing fixture shapes in `blockedStorageRendering.test.tsx` and `connectedAccountsTelegramFallback.test.tsx`; blocked persistent-storage case must show error without browser OAuth redirect. Check ID copy and 80/90 settings. |
| `/support`, selected ticket + composer | Support config, paginated tickets, TicketDetail with `id,title,status,priority,created_at,updated_at,closed_at,is_reply_blocked,messages`. Message must include text/admin/media fields; album items `{type,file_id,caption,token}`. Use future `exp.fixture` and expired `1.expired`; local fixture image response or error, never a real token. Long filenames, failed renewal and reply while refresh pending. |

Routes above follow the current `src/App.tsx`; `/subscription` and legacy top-up routes redirect into the retained workflow. Harness references are the canonical concrete fixture values used by automated checks. Desktop/mobile comparison against the exact custom baseline is complete for the documented synthetic user scenarios: 18 baseline and 24 candidate captures. Purchase accents were corrected to custom orange/white; the new upstream purchase layout remains intentionally different. Final scope and limitations are in FRONTEND-HANDOFF.md; additional admin captures bring the combined total to 54. This does not certify target-bot contracts or native WebView behavior.

## Verification result (2026-09-28)

Node 24.19. Scoped user Vitest: **27 files, 147 tests passed**, including eight new purchase and four document navigation tests. Custom payment/connection/trial suites: **29 passed**. TypeScript check completed without errors after core fixes. Scoped Biome check: **0 errors** (formatting applied to owned files only). Logs during integration: `/tmp/cabinet-user-vitest-final.log`, `/tmp/cabinet-user-custom-final.log`, `/tmp/cabinet-user-tsc-final.log`, `/tmp/cabinet-user-biome-final.json`. Full build, global checks and visual review are recorded by the integrating task after all workers finish.

## Independent user/payment review and signed-document correction

Read-only comparison to `55a4038f` found two P2 issues: Dashboard late traffic/device callbacks could affect a newly selected subscription (assigned to core); asynchronous expired-document opening could lose the web popup gesture (fixed in this scope). No additional confirmed merge regression was found in the examined purchase decomposition, positive-402 preflight, exact payment-ID resolution, payment unknown/timeout states, recurring gates or shared signed-media renewal. This was source review with synthetic frontend tests, not live backend or browser-policy certification.

`src/platform/webDocumentPopup.ts` is a small web-only helper used by MessageMediaGrid, not a new general public platform API. It reserves `about:blank` during the click, clears `opener` and applies `no-referrer`. The component navigates that same window after successful renewal and session/expiry checks; a closed window is cancellation, unmount closes the pending placeholder, failed renewal closes it, and blocking exposes a new explicit retry. Telegram still uses native `openLink` after renewal. The Telegram browser-API lint guard remains enabled.

The document test suite now uses the real `useTicketMedia` and real `createWebAdapter`; only the network and window-opening boundary are synthetic. It checks synchronous opening before a deferred GET, no second asynchronous popup, closed/blocked/error/unmount/session cases and Telegram behavior. The new deferred-window case failed against pre-fix source (`/tmp/cabinet-document-review-before.log`); production source was restored in `finally`. Post-fix targeted document cases passed 11/11; legacy signed-media suite passed 14/14. Scoped lint has zero errors (four pre-existing non-null warnings in image rendering remain). Final logs: `/tmp/cabinet-document-review-final.log`, `/tmp/cabinet-document-review-legacy.log`, `/tmp/cabinet-document-review-biome.log`, `/tmp/cabinet-document-review-tsc-final.log`.
