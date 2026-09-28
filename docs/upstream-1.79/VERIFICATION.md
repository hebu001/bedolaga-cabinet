# Final frontend verification — 2026-09-28

**PASS for the final local frontend candidate, including the admin presentation corrections. Target bot integration and release remain pending.**

The independent verification phase used a fresh `npm ci` on Node **24.19.0** / npm **11.8.0**, with lifecycle scripts enabled. `HUSKY=0` only prevented installation of local Git hooks. The install resolved 471 packages from the frozen lockfile. No server, production service or real account was used.

Tested pre-merge HEAD: `b1a44d3769fa90f73c86c08db09bed843884f237`; merge parent: `f5ea595f8f732c37f2d5c270f34879ab2e2fba2d`. The staged tree before verification was `8bede158a32fa2a5b1655a58f1ab9f013901a605`. The tracked non-document source manifest SHA-256 was `e337f119fe2689d273d2370db5dd67daa2c1dd95b5dfb7c67e29e61cd2a30e5c` and remained unchanged across all final checks. Documentation was finalized afterward.

| Check | Result |
| --- | --- |
| `npm ci` | PASS; lifecycle scripts enabled; 0 audit advisories |
| `npm test` | PASS: **151 custom cases in all 11 suites**, plus **1,449 Vitest cases in 233 files**; no skipped tests |
| `npm run type-check` | PASS |
| `npm run lint` | PASS: 0 errors; 271 warnings and 114 informational diagnostics remain |
| `npm run format:check` | PASS |
| `npm run build` | PASS with CI values `/api`, `test_bot`, `Cabinet`, `V` |
| `npm run check:bundle` | PASS; original fork limits unchanged |
| `npm run test:dependencies` | PASS: 7 browser checks for Telegram SDK, DOMPurify and Tiptap; local Google Chrome, external network blocked by fixture |
| `npm run test:nginx` | PASS: **4/4 actual runtime tests** including API prefix/body/query forwarding, WebSocket upgrade, HTTPS/SNI/certificate verification and cache contracts |
| `npm audit --json` | PASS: 0 advisories |
| Repository integrity | No unresolved merge entries, conflict markers, `.skip`/`.only` tests, source changes during verification or diff whitespace errors |

Nginx was compiled from the [official nginx 1.30.5 source archive](https://nginx.org/download/nginx-1.30.5.tar.gz) into a temporary directory, using the already available compiler, PCRE2 and OpenSSL. It was not installed as a service. Test listeners were random **127.0.0.1** ports; the production IPv6 listener remains in `nginx.conf`. Download SHA-256, configure/build commands and exit codes are retained in the machine evidence.

## Bundle measurements

| Asset | Raw bytes | Gzip bytes | Raw / gzip limits |
| --- | ---: | ---: | ---: |
| Initial JavaScript graph | 893,183 | 284,650 | 900,000 / 285,000 |
| Russian public locale | 119,321 | 29,500 | 120,000 / 30,000 |
| English public locale | 77,939 | 23,249 | 120,000 / 30,000 |
| Persian public locale | 103,770 | 25,979 | 120,000 / 30,000 |
| Chinese public locale | 70,236 | 23,718 | 120,000 / 30,000 |

The initial gzip margin is **350 bytes**. Re-run build and budgets after any source/dependency change; the passing result does not justify increasing limits.

## Final admin presentation re-verification

The final visual review identified three presentation regressions: upstream blue/navy surfaces, hairline opacity overrides and an overly truncated mobile user header. The resulting 13-file patch changes only JSX class strings and layout comments. Independent review found no changes to handlers, API requests, RBAC or data flow. Mobile actions occupy a separate row; the existing desktop grid remains.

After this source freeze, the full `npm test`, lint, format, TypeScript, CI-environment build and bundle checks were repeated and passed with the counts above. The source manifest remained identical before and after this final run. Clean install, audit, nginx runtime and dependency browser smoke were not repeated because their dependencies, configuration and behavior were unchanged. Earlier evidence remains preserved; the latest command logs and source manifests are in `work/cabinet-final-verification-20260928/post-admin-visual/`.

## Health proxy correction

Review found that relative `VITE_API_URL=/api` probed frontend `/health/unified`, which could return SPA HTML with HTTP 200 while the bot was unavailable. The narrow fix sends relative `/api` and `/api/` probes through `/api/health/unified`; absolute API origins and explicit `VITE_HEALTH_URL` retain their behavior. Bare Axios transport and existing 404-compatible availability semantics remain intact.

Four real local HTTP tests cover proxy forwarding and backend 503/200/404 responses, absolute-origin subpaths and explicit overrides. Both relative cases failed before the fix and all four passed afterward. The verifier authored this isolated correction under explicit ownership; `cabinet_final_security_review` independently reviewed it and reported PASS before the final suite.

## Evidence and limits

Machine-readable results: [VERIFICATION.json](VERIFICATION.json), [bundle-metrics-final.json](bundle-metrics-final.json), [npm-audit-final.json](npm-audit-final.json). Full logs, short logs, command exit codes/durations and source manifests are in `work/cabinet-final-verification-20260928/` beside this checkout. Separate visual evidence is documented in `work/cabinet-visual-20260928/README.md`.

The Docker executable/daemon is unavailable locally, so the container image smoke was **not run**. Node 26 remains a configured CI matrix job, **not a locally verified runtime**. JSDOM emitted canvas/scroll implementation notices during otherwise passing tests. No live bot contract, real payment, Telegram account, test-server deployment or production behavior is certified by these synthetic checks.
