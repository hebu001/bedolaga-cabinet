# Core frontend integration

> Итог текущей интеграции: [FRONTEND-HANDOFF](FRONTEND-HANDOFF.md) и [VERIFICATION](VERIFICATION.md). Ниже сохранены этапные результаты владельца модуля; их промежуточные числа и прежний статус visual pending не заменяют итоговую проверку. Target-bot/live интеграция остаётся отдельным этапом.

Baseline: fork 55a4038f4ae8692922abc2622f97309840f71064; upstream 1.79.0 at f5ea595f8f732c37f2d5c270f34879ab2e2fba2d. The ordinary two-parent merge is intentionally left uncommitted for independent verification. No server, bot, panel or production state changed.

## Preserved custom contracts

- Session generation, monotonic auth clock, token refresh coordinator, session-owned QueryClient, permission fencing and ticket-only WebSocket transport remain the authentication boundary. `session.ts`, `authClock.ts`, `SessionQueryProvider.tsx`, `cabinetWebSocket.ts` and `store/permissions.ts` remain byte-identical to the fork baseline.
- Optional consent parameters pass through the same authenticated result/completeLogin path. Consent failures carry the login intent and session owner; retries cannot resurrect logout or replace a newer login. The gate also ignores a late retry completion when a newer prompt exists.
- OAuth storage guards, fresh Telegram initData, backend-unavailable detection, upstream router/back-button fixes and document branding are integrated without CloudStorage credential resurrection or callback token writes.
- Apple Dark shell/sidebar/dock, custom login/MergeAccounts, Aurora/per-page backgrounds, safe inline top-up redirects, protected nginx runtime and current callback menu actions remain.
- Admin and public locale assets load separately. User dictionaries retain custom copy and new upstream keys. The `theme` editor keys now live in the admin asset; startup tests prove they are absent before admin readiness. Test-only complete dictionaries live in `src/test/locales.ts` and are never imported by runtime code.

## Pending bot integration

`src/config/integrationCapabilities.ts` is an explicit local release configuration. All pending capabilities default off: advanced user filters, legal consent, public email resend, user avatar, lite mode, reachability, reminders, system errors, node geocheck, numeric panel identity, recurring payments, referral levels, grace access and new coupon screens.

Coupons already exist in the current bot; the new frontend response contracts still require fixtures. This gate does not claim the backend API is absent and does not disable existing promocode flows. UUID identity remains the active mode; numeric identity is not certified against the current panel.

Menus, query hooks and direct routes enforce the gates. Seventeen direct-URL regression cases cover authorized-admin access. Explicit fallback routes prevent `/admin/partners/referral-levels` from falling through to the existing `/admin/partners/:userId` route.

Enable flags only after recording the target bot SHA and validating its request/response fixtures and live scenarios in CONTRACT.md. Version numbers or permissions do not imply a verified capability.

## Dependencies and CI

Runtime for verification: bundled Node 24.19.0; supported engines >=24.15.0,<27. Upstream React Router 8.3.0, Biome and Vitest are retained. `npm test` runs all eleven custom suites followed by upstream Vitest. CI runs this command on Node 24/26 plus the existing browser dependency smoke and nginx runtime tests; build CI keeps the original bundle limits.

The fork security pins remain: axios 1.20.0, DOMPurify 3.4.14, Vite 7.3.6, PostCSS 8.5.28, Playwright 1.62.1, Tiptap 3.31.3 as one coherent package set, valibot 1.4.2 and browserslist 4.28.9 overrides.

Initial upstream lock selection resolved Tiptap core 3.30.2, exposing runtime advisories GHSA-j95f-988m-3j2f (high, ReDoS; fixed 3.30.5) and GHSA-cp6q-959q-f8rh (moderate, attribute handling; fixed 3.30.4). Restoring the fork 3.31.3 set fixed both without a force install or unrelated major update. Non-Tiptap lock entries were retained while regenerating the coherent peer graph. Final `npm ci --ignore-scripts` and a separate `npm audit --json` report zero advisories; see npm-audit-final.json. The local audit is evidence for this exact lock, not a future guarantee.

## Startup and source checks

The unchanged budgets are initial JS900000B/raw and285000B/gzip; each public locale120000B/raw and30000B/gzip. Final measured graph is recorded in bundle-metrics-final.json. At core freeze: startup893118B/raw,284319B/gzip; Russian locale119321B/raw,29697B/gzip. The gzip margin is small and must be rechecked after subsequent source changes.

Actual startup reductions, rather than budget changes:

1. Both user and permission-protected shell entry points lazy-load Layout while retaining the session-generation key.
2. Blocking screens import Button directly, avoiding a primitives barrel that eagerly evaluated optional dialogs/command UI.
3. Radix primitives and DOMPurify have distinct chunks, so a startup Tooltip no longer imports every lazy Select/Dialog or the sanitizer.
4. The Telegram back-button subscriptions API loads when its enabled query executes, rather than for every browser startup.
5. Emitted JSON assets are compacted as actual HTTP payloads; admin assets remain independently fetched.

Core checks: all eleven custom suites pass; focused consent/callback/i18n cases pass; 17 direct route cases pass; shared skeleton guard passes. Scoped 81-file Vitest initially passed 539/540. The final full run passed 1432/1434 Vitest cases plus all eleven custom suites; its two failures identified actual low-contrast dashboard tokens and missing long-word wrapping in AdminTickets. Both consumers were fixed under explicit root assignment; the affected eight regression cases now pass. No tests or guards were weakened. TypeScript and Biome lint finish with zero errors. Biome format passes. The full final suite and browser/nginx verification are coordinated by the root task after source freeze.

General source guards remain active. The hand-drawn icon guard uses only exact baseline custom component paths with provenance, rather than a broad directory exception. Storage/error/currency guards were addressed in actual consumers. Formatting changes to the shared StatCard retain upstream sizing/skeleton behavior and use the custom Apple surface/contrast tokens.

## Dashboard subscription ownership follow-up

Independent review found late traffic-refresh/device-delete callbacks targeting the newly selected subscription. Dashboard now uses the real `useDashboardSubscriptionActions` hook: mutation variables retain the submitted subscription ID and session owner; cache invalidation and refresh timestamps address that captured ID; traffic and cooldown state publish only for the active ID and current session. Each subscription initializes its own automatic refresh.

Four real QueryClient/renderHook regressions cover late A-success after switching to B, late A-rate-limit errors, deletion cache invalidation for A, and session change before traffic/deletion completion. All four pass. Combined with the contrast and ticket-wrap regressions:12/12. Custom trial suite passes. A subsequent complete TypeScript/Vite build and unchanged bundle budgets pass; shared final verification remains with the root task.
