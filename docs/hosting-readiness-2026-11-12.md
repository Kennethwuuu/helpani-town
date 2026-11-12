# Hosting readiness — 12 November 2026

The hosting increment passed **33/33 targeted local tests**. Deployment remains blocked pending billing setup and approval for the proposed paid Render service and persistent disk. No paid resources were created. This record does not certify a deployed HTTPS application.

## Candidate configuration

- [`.node-version`](../.node-version) pins the runtime target to **Node.js 22.20.0**. The actual Render build and runtime version still require deployment verification.
- [`render.yaml`](../render.yaml) proposes one Node web-service instance in Singapore, using plan `0.5c-512mb` and a 1 GB disk mounted at `/var/data`. The application database path is `/var/data/helpani.sqlite`. Automatic deployment is disabled in the candidate configuration.
- The service binds to `0.0.0.0` and uses Render's supplied port. The build command is `npm ci --omit=dev`; the start command is `npm start`.
- The application resolves its canonical origin in this order: `PUBLIC_ORIGIN`, `RENDER_EXTERNAL_URL`, then the local development origin. This origin controls accepted browser POST origins and the `Secure` session-cookie attribute. Setting a canonical origin does not itself configure DNS, TLS, or a redirect between hostnames.
- `GET /healthz` returns HTTP 200 with `{"status":"ok"}` before visitor-session handling, without a `Set-Cookie` header. It reports process liveness, not successful PayPal authentication or model access.
- PayPal and Gateway credentials remain private deployment configuration. The candidate does not upload the developer's player database or browser photo storage.

## Render preflight

These API checks are separate from the local test suite:

| Check | Observed result | Scope |
| --- | --- | --- |
| `GET /owners` | HTTP 200; one workspace available | Account/workspace discovery only. |
| `GET /services` | HTTP 200; empty service list | No deployed service was found in the queried workspace. |
| `POST /blueprints/validate` | HTTP 200, **`valid: false`**; sole issue `need_payment_info` at `services[0]` | Validation did not pass. The account needs billing information before this paid candidate can proceed. |

No service or disk was created, no deployment was started, and no billing configuration was changed. Deployment requires the user's billing setup and approval for the paid compute-and-disk configuration. A successful HTTP response from the validator must not be reported as successful Blueprint validation.

## Targeted local evidence

The saved TAP artifact is `output/hosting-2026-11-12/targeted-tests.tap`. It records **33 tests, 33 passed, 0 failed, 0 cancelled, 0 skipped**. This document was written by reviewing that run and its test definitions; the tests were not rerun for documentation.

| Coverage | Tests | What passed |
| --- | ---: | --- |
| [AI demo gate](../tests/ai-demo-gate.test.mjs) | 11 | Global/session accounting, rejection without charging, concurrency release, SQLite reopening, invalid configuration, and charging of retries and failed upstream attempts. |
| [Deployment HTTP wiring](../tests/deployment-http.test.mjs) | 4 | Cookie-free health checks, configured HTTPS-origin acceptance, secure-cookie headers, explicit-origin precedence, and web-route quota enforcement without changing gameplay or funding state. |
| [AI adapter](../tests/project-ai.test.mjs) and [draft HTTP regression](../tests/project-draft-http.test.mjs) | 18 | Selected-source budgets, configuration and model selection, response/citation validation, bounded format retry, safe errors, and existing local draft/budget behavior. |

The HTTP fixtures ran on loopback **HTTP**, with temporary SQLite databases and isolated source copies. Render-style HTTPS URLs were configuration inputs to those fixtures. They verified emitted cookie attributes and origin handling, **not** browser cookie delivery over real HTTPS, Render's proxy, a certificate, or a public hostname. Provider responses were controlled mocks; no real Astropods or PayPal requests were made in this increment.

## AI attempt limits

The candidate Blueprint configures the application's `/api/project-draft` route as follows:

| Setting | Candidate value | Meaning |
| --- | ---: | --- |
| `AI_DEMO_MAX_REQUESTS` | 100 | Lifetime admitted Gateway attempts across visitors sharing this SQLite database. |
| `AI_DEMO_SESSION_MAX_REQUESTS` | 10 | Lifetime admitted attempts for one browser demo session, subject to the global allowance. |
| `AI_DEMO_MAX_CONCURRENT` | 1 | One in-flight draft operation in this application process. |

An attempt is charged immediately before its Gateway fetch. A failed upstream request still consumes that attempt. The one permitted invalid-response retry consumes another attempt; one successful draft operation can therefore use one or two units. The two attempts retain the existing shared 45-second deadline. Busy or quota-denied work does not issue another fetch or increment usage.

Global and session counts are committed atomically to SQLite. Local tests confirmed that recreating the gate or reopening the database retains usage, and raising a limit does not reset it. These are lifetime counters, not daily allowances or provider-account dollar limits. A browser demo session is not a verified user identity. The separate maintainer `check:ai` command is outside this web-route gate.

Concurrency is process-local and releases its slot after success or error; the Blueprint intentionally specifies a single instance. The persistent disk is proposed configuration. Actual retention of these counters and player state across a hosted restart remains unverified. Without a positive global-limit setting, the gate preserves the existing local behavior and creates no usage schema.

## Acceptance after deployment approval

The following remain **NOT_RUN on a deployed service**:

1. Confirm the selected source revision, Node runtime, public hostname, valid TLS, and `/healthz` response without a visitor cookie.
2. In a real HTTPS browser, verify `Secure`, `HttpOnly`, and `SameSite=Lax` cookie behavior, stable session state, canonical-origin POST acceptance, and ordinary page navigation.
3. Verify a PayPal **Sandbox** return on the hosted origin with the buyer's permitted interaction, matching the hosted session and honest payment record. Existing local payment evidence does not establish a hosted callback pass.
4. Perform one real hosted AI draft operation. Review its selected-source grounding and citations; record `generation.attempts` and the corresponding one-or-two-unit counter change. A local mock is not evidence of this check.
5. Restart the hosted service and confirm that the same mounted SQLite database retains player state, payment records, and AI usage. Record sanitized before/after evidence without publishing cookies or credentials.

The existing gameplay, Sandbox-payment, organizer, and live-Astropods QA passes remain separate evidence. They were not repeated or relabelled as hosted passes. Only changed paths and the hosted acceptance above require follow-up; this increment does not mandate another complete gameplay suite.

## Evidence delivery

Raw files under `output/` are ignored local QA artifacts and do not accompany the repository. The TAP path above is a local evidence reference, not a publicly available report link. Publish a separately reviewed, redacted evidence copy if it is needed for judging. This summary contains no workspace identifier, private Gateway host, credential value, or visitor session identifier.
