# VPS deployment evidence — 12 November 2026

**Status: HTTPS application, one real hosted AI draft, restart persistence, and the new-host USD 5 PayPal Sandbox flow passed.** The public site is [Helpani Town](https://vibecreating.tech). This record describes a deployment increment, not completion of all release gates.

## Host and deployed source

| Item | Observed deployment |
| --- | --- |
| Hosting | Owner's existing Alibaba Cloud Simple Application Server, Silicon Valley. No Render service was created. |
| Operating system | Ubuntu 24.04.2, x86_64. |
| Reported allocation | 2 vCPU, 2 GB RAM. |
| Pre-deployment capacity observation | Approximately 736 MB available memory and 22 GB available disk. These values can change under load. |
| Source revision | `e38a7440c9cce5b368af8343349dcb6a2ea5a7fe`. |
| Application runtime | Node.js **22.22.0**, copied from the existing `/usr/bin/node` into `/opt/helpani-town/runtime/bin/node`. Global Node was not changed. |
| Process and data | Dedicated `helpani-town` systemd service, one application process on `127.0.0.1:3120`, fresh online SQLite database outside release directories. |
| Reverse proxy | Caddy **2.11.9**, installed from the official package source; selected hostname at the root path over ports 80/443. |
| Existing application | The original OpenClaw process retained its PID through deployment checks. This is a continuity observation, not a full OpenClaw regression test. |
| Credentials | Only the four owner-authorized application settings were transferred over the secure connection. The real environment file is root-owned with mode `0600`; no credential values are included here. |

The installation, version, service, and existing-process observations above were supplied by the deployment maintainer's SSH checks. The local artifacts independently reviewed for this document are listed below; they must not be presented as a complete transcript of every installation action.

The repository [`.node-version`](../.node-version) is still **22.20.0**, the earlier local validation version. The server run below used **22.22.0**. The unchanged local pin is not evidence that the deployed executable uses the same patch version.

## Recorded checks

| Check | Result | Evidence and scope |
| --- | --- | --- |
| Native service configuration | PASS | Maintainer observed `systemd-analyze verify` succeed before startup. |
| Native proxy configuration | PASS | Maintainer observed `caddy validate` succeed before startup. |
| Linux isolated regression | **33 PASS / 0 FAIL** | Reviewed `output/hosting-2026-11-12/linux-targeted-tests.tap`: 33 tests, 0 cancelled, 0 skipped. This is a real server-runtime run of isolated mock/HTTP tests, not real AI or PayPal calls. |
| Independent public HTTP increment | **23 PASS / 0 FAIL** | Reviewed `output/hosting-2026-11-12/public-http-check.json`, checked at `2026-11-12T07:24:20.195Z`, against `https://vibecreating.tech`. Certificate and hostname validation used Node defaults with no TLS bypass. |
| HTTP to HTTPS | PASS | Maintainer observed HTTP 308 redirect to the HTTPS site. |
| Health check | PASS | Public artifact records HTTP 200, correct health body, and no visitor session cookie. This proves liveness only. |
| Mobile browser care smoke | PASS, narrow scope | Maintainer observed 390 × 844 viewport, pangolin adoption, greeting, and feeding to 10 XP. The saved before-restart browser record contains `feedCount = 1`, secure/HTTP-only/Lax cookie attributes, and no horizontal overflow. This does not repeat the complete earlier gameplay acceptance. |
| Real hosted Astropods draft | **PASS, one operation** | Reviewed `output/hosting-2026-11-12/hosted-ai-browser.txt`: HTTP 200, `claude-sonnet-4-6`, one attempt, and `reviewRequired = true`. The source-derived budget is USD 100 / USD 64 / USD 36, with a task citation to `observation-notes`. |
| Application restart persistence | **PASS** | Reviewed `restart-server.json` and `after-restart-browser.json`: database inode unchanged, global AI attempts 1 → 1, new application PID, healthy endpoint, same pangolin with one feeding and 10 XP, and no horizontal overflow. The original OpenClaw process remained alive. Payment-record retention was checked separately after the later Sandbox capture, as recorded below. |
| New-host PayPal Sandbox flow | **PASS — USD 5** | Owner reported completing payment and returning to the online support record. `hosted-paypal-verification.json` records local `completed`, remote order and capture `COMPLETED`, USD 500 cents, and matching order/reference/capture identifiers, without publishing them. Verification used an official Sandbox GET, with no repeated capture. |
| Captured-payment restart retention | **PASS** | `payment-restart.json` records an unchanged payment fingerprint, completed count 1 → 1, retained database and AI usage, healthy restart, and the continuing original OpenClaw process. |

The Linux run comprises 11 gate tests, 4 deployment HTTP tests, and 18 AI adapter/draft HTTP regression tests. It covers durable global/session counters, charging retries and failed attempts, concurrency release, source-derived budgets, bounded invalid-format retry, safe errors, health and origin wiring, and isolated route behavior. Some test names refer to the Render-origin fallback because that compatibility behavior remains in the application; those loopback fixtures do not imply a Render deployment.

The 23 public checks cover the six page routes, seven script/dependency routes, health response and cookie absence, a new session state, session-cookie attributes, an accepted same-origin budget action, rejected foreign origin, public draft configuration, credential-field checks on inspected public API responses, and unchanged state after budget/configuration reads. They explicitly exclude AI generation, PayPal order creation/capture, SSH, and access to private environment files. They do not certify all routes or all future responses.

The real AI result is separate from those 23 checks. Its arithmetic remains program-derived from the selected fictional source fields; the model draft and source citation need human review. The maintainer observed the human-review label in the actual page. This one output does not certify future outputs or publish a task into the game.

## Local evidence inventory

- `output/hosting-2026-11-12/linux-targeted-tests.tap`: inspected totals and named test cases.
- `output/hosting-2026-11-12/public-http-check.json`: inspected 23 passing public checks and explicit scope.
- `output/hosting-2026-11-12/hosted-ai-browser.txt`: inspected actual hosted response metadata and source citation.
- `output/hosting-2026-11-12/before-restart-browser.json`: inspected feed count, cookie attributes, and overflow result.
- `output/hosting-2026-11-12/restart-server.json`: inspected unchanged database inode, retained AI usage, changed application process, healthy restart, private file modes, and the continuing original OpenClaw process.
- `output/hosting-2026-11-12/after-restart-browser.json`: inspected same-pet comparison, one feeding, 10 XP, and no horizontal overflow.
- `output/playwright/hosted-care-390.png` and `output/playwright/hosted-ai-390.png`: screenshots reported saved by the deployment maintainer, not independently visually reviewed for this document.

Additional sanitized payment evidence: `output/hosting-2026-11-12/hosted-paypal-verification.json` and `output/hosting-2026-11-12/payment-restart.json`. These records omit order identifiers, session cookies, access tokens, and credential values.

## Configuration retained for the public demo

- One Node application instance, reached through the selected HTTPS hostname.
- A canonical HTTPS `PUBLIC_ORIGIN`, loopback application listener, and persistent SQLite path under `/var/lib/helpani-town`.
- Astropods model `claude-sonnet-4-6`, with limits of **100 total actual attempts**, **10 per browser demo session**, and **one concurrent generation operation**. The one permitted format retry consumes another attempt; failed upstream attempts also consume capacity. Counts have no timed reset and are not a dollar spending cap.
- PayPal uses **Sandbox** credentials and test funds. Virtual care, fictional sponsor reservations, captured test payments, purchasing, delivery, and rescue outcomes remain separate states.
- Organizations, activities, verification, sponsor budgets, and project updates remain clearly labelled fictional demonstrations. AI output remains an organizer-review draft.

## Remaining release work

The hosted USD 5 buyer return and capture are verified. This increment does not repeat the earlier material-payment, cancellation, or USD 10/20 display cases. Final permitted test-buyer access for judges, the public licensed source release, and the English video remain separate work. Do not publish buyer credentials, cookies, session IDs, private environment values, or database dumps.

Raw artifacts under `output/` are Git-ignored local evidence and do not accompany a clean clone. Publish separately reviewed, redacted evidence if required for judging. The runtime environment, administrative credentials, browser cookies, and player database are not deliverables.

The [existing-server guide](deploy-existing-server.md) describes maintenance and rollback. The [release checklist](release-checklist-2026-11-12.md) still requires the authorized public repository and open-source license, final judge access, signed-out URL verification, and the English public demo video. A working HTTPS host alone does not close those gates.
