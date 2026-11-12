# Render deployment guide

**Current decision:** the owner declined new paid Render hosting and offered an existing Alibaba Cloud server. Continue with the [existing-server plan](deploy-existing-server.md). This Render configuration remains an unapplied reference; do not create its resources.

Status: **prepared for review; no hosted service has been created or verified** as of November 12, 2026. The owner has not approved the hosting cost. Review the settings and estimate below before creating or applying any paid resources.

Current blocker: Render's Blueprint validation endpoint returned HTTP 200 with `valid: false`; its only reported error was `need_payment_info` at `services[0]`. HTTP success is not a successful Blueprint validation. Read-only inspection found no services, and no resources were created. The owner must personally configure billing in Render and approve the specific US$7.25/month baseline plan before creation can proceed. The 33 passing local checks below do not resolve this account-level blocker.

The proposed deployment provides a public Web demo of Helpani Town. Organizations, activities, attendance verification, sponsor budgets, and project updates remain fictional. Game care is virtual, PayPal uses Sandbox test funds, and AI output requires human review. Hosting does not establish a nonprofit partnership or authorize real fundraising. The [English judge guide](judges-guide.md) describes the walkthrough and these boundaries.

## Proposed service and cost

The repository's [render.yaml](../render.yaml) specifies one paid Node web service in Singapore:

| Setting | Proposed value |
| --- | --- |
| Repository | Private GitHub repository `Kennethwuuu/helpani-town` |
| Branch | `codex/ai-draft-readiness` |
| Compute | `0.5c-512mb`, one instance |
| Runtime | Node.js `22.20.0`, pinned in [.node-version](../.node-version) |
| Build | `npm ci --omit=dev` |
| Start | `npm start` |
| Health check | `GET /healthz` |
| Persistent disk | 1 GB mounted at `/var/data` |
| SQLite path | `/var/data/helpani.sqlite` |
| Automatic deployment | Off; later releases are manual |

The estimated baseline is **US$7/month compute + US$0.25/month for a 1 GB disk = US$7.25/month**, before tax, metered usage, any additional workspace charges, and Astropods model usage. Recheck the current plan and total in Render's review screen before applying; this estimate is not a spending authorization. [Official Render pricing](https://render.com/pricing)

Free web services cannot attach persistent disks, lose local SQLite changes on restart/redeploy/spin-down, and spin down after idle periods. They do not meet this demo's persistence requirement. Only files below the mounted directory survive on the proposed paid service. A disk-backed service also has deployment interruptions and must remain a single instance for this SQLite and in-process concurrency design. [Free service limitations](https://render.com/docs/free) · [Persistent disks](https://render.com/docs/disks)

Render honors `.node-version`; a service-level `NODE_VERSION` overrides it. Keep any override aligned with the pinned version. [Node.js version selection](https://render.com/docs/node-version)

## Environment and credentials

Enter only the required application values in Render's private environment configuration. Do not upload the local `.env` wholesale: its local origin and database path do not belong on the hosted service.

| Variable | Hosted value or handling |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | Supplied by Render; let the app use it. |
| `DB_PATH` | `/var/data/helpani.sqlite` |
| `PUBLIC_ORIGIN` | Optional canonical HTTPS origin, with no path. Set it for a custom domain. It takes precedence over `RENDER_EXTERNAL_URL`. Never retain `http://localhost:3000` here. |
| `RENDER_EXTERNAL_URL` | Supplied by Render. Used as the public origin when `PUBLIC_ORIGIN` is absent; the local localhost fallback is for local runs. |
| `PAYPAL_CLIENT_ID` | Existing permitted PayPal **Sandbox** application's client ID; enter privately. |
| `PAYPAL_CLIENT_SECRET` | Matching Sandbox application's secret; enter privately. |
| `ASTRO_GATEWAY_URL` | Existing permitted Astropods HTTPS gateway origin, without `/v1`, query parameters, or embedded credentials. |
| `ASTRO_GATEWAY_API_KEY` | Existing permitted Gateway key; enter privately. |
| `ASTRO_GATEWAY_MODEL` | `claude-sonnet-4-6` |
| `AI_DEMO_MAX_REQUESTS` | `100` total actual Gateway attempts for this database. |
| `AI_DEMO_SESSION_MAX_REQUESTS` | `10` actual attempts per demo browser session. |
| `AI_DEMO_MAX_CONCURRENT` | `1` active generation operation in this Node process. |

**Never set `RENDER_API_KEY` in the hosted application's runtime.** It is an administrative credential for managing Render resources, not an application dependency. Keep a local management key only in the ignored `.env.render.local` file with file permissions `0600`; exclude it from screenshots, logs, the repository, and judge materials. Render documents API keys as secret management credentials. [Render API authentication](https://render.com/docs/api)

The public AI limit counts every actual upstream attempt, including the one permitted format retry. Network failures and invalid responses still consume their attempts. Busy or already-exhausted requests do not reach the Gateway. Counts persist in SQLite across application restarts and deployments, with **no daily or monthly reset**. To add capacity, the owner must intentionally raise the relevant configured maximum and apply that environment change; raising the total from 100 to 150 allows 50 more attempts after 100 have been used. Do not erase the database to replenish it.

`AI_DEMO_MAX_REQUESTS=0` disables this guard for local use; it does **not** disable AI generation or provider billing. The count is an exposure guard, **not a monetary ceiling**: model pricing, tokens, and other account use can affect the provider bill. Browser sessions are anonymous demo sessions, not verified user accounts; the persisted global cap is shared across all sessions.

## Before applying

- [ ] Have the owner personally configure Render billing information and approve the reviewed US$7.25/month baseline plan, disk, region, and usage estimate. Repeat Blueprint validation afterward; do not treat the earlier `need_payment_info` response as a pass.
- [ ] Ensure the intended source revision, `render.yaml`, and `.node-version` are available on the selected branch.
- [ ] Connect Render to the authorized GitHub account and grant its Git provider integration access to the private `Kennethwuuu/helpani-town` repository. Repository access is required even when a local Render management API key exists. [Git provider connection](https://render.com/docs/git-provider)
- [ ] Review one service, one disk, the branch, commands, health path, and automatic deployments set to off. Do not apply a second copy accidentally.
- [ ] Enter the four application credential values above privately and confirm the model and quota settings. Keep PayPal in Sandbox mode.
- [ ] Start with a **fresh online database**. Do not upload the main local `data/helpani.sqlite`, local photos, development records, or private configuration.

Run the targeted local checks from the repository root with Node.js 22.20.0:

```bash
npm ci --omit=dev
node --test tests/ai-demo-gate.test.mjs tests/project-ai.test.mjs tests/project-draft-http.test.mjs tests/deployment-http.test.mjs
```

These checks use isolated databases and mocked/unconfigured providers, with local HTTP listeners for integration checks. They do not make real AI or PayPal calls. The recorded November 12 run passed **33/33** checks; the local, Git-ignored TAP evidence is `output/hosting-2026-11-12/targeted-tests.tap`. It verifies code paths, not a live Render deployment. Avoid running `npm run check:ai` as a deployment prerequisite without intending real provider usage.

## Create only after approval

1. In the Render Dashboard, create a Blueprint from the authorized private repository and the selected branch, using `render.yaml`.
2. Review the generated resources, estimated charges, and private environment values. Apply only after approval. Initial creation builds and starts the service; automatic deployments remain off for later pushes.
3. Inspect the build and runtime logs for the pinned Node version, successful `npm ci --omit=dev`, and server startup. Confirm `/var/data` is mounted and `DB_PATH` points inside it. Do not print credentials or database contents to diagnose startup.
4. Use the assigned HTTPS origin. Leave `PUBLIC_ORIGIN` unset for the default Render URL, or set it to the actual canonical custom-domain origin and deploy the environment change before testing that domain.
5. Record the service URL, deployed revision, date, and sanitized verification results. Share the public app URL with the judge guide only after the checks below pass.

## Hosted acceptance checks — still pending

All of the following require actual execution after approval and service creation. Earlier localhost tests do not establish hosted success.

- [ ] Request `https://YOUR-HOST/healthz`; expect HTTP 200 and `{"status":"ok"}`, with no visitor session cookie. This is a lightweight health endpoint, not a complete provider or data-integrity check.
- [ ] Open `/`, `/stories`, `/activities`, and `/support` over HTTPS on a phone-sized browser. Adopt, interact, feed, reload, and use browser back/forward. Verify same-origin actions and secure session continuity.
- [ ] Complete one new PayPal Sandbox checkout from the hosted `/support` page using a Sandbox buyer. Check that approval returns to the **hosted HTTPS origin**, capture status matches the server record, and test payment success is separate from material purchase/delivery and rescue outcomes. Local callback success does not verify the changed origin.
- [ ] Generate one draft at `/project-draft` using the real configured Astropods connection. Check selected-source citations, model attribution, human-review marking, and source-derived budget calculations. One draft may consume two Gateway attempts if a format retry is needed. Preserve sanitized results; do not expose the key or full private request headers.
- [ ] Record harmless demo progress in the fresh hosted database, restart the service, then revisit with the **same browser, origin, and session cookie**. Confirm progress and AI attempt counts remain, and that restarting does not replenish quota. Do not exhaust the live quota merely to test it; automated cap coverage already exists.
- [ ] Confirm fictional institutions, demo verification, virtual growth, sponsored reservations, Sandbox capture, and fulfillment/outcomes remain visibly distinct. Organizer and AI pages are public demo tools scoped to the visitor's session, not production organization administration.

Photos remain in **IndexedDB on the current device/browser and origin**; the Render disk does not upload or synchronize them. Moving from localhost to HTTPS, changing domains, using another device, or clearing site data does not transfer the album. Server progress uses a 30-day demo-session cookie and has no formal account or cross-device recovery. Download important photos as PNGs before changing origins.

## Updates, rollback, and shutdown

Keep automatic deployments off and deploy reviewed revisions manually. Before schema-affecting changes, prepare a consistent SQLite backup and a compatible migration/recovery plan. Record the deployed revision and preserve the disk.

If a release regresses, roll back application code only when it remains compatible with the current schema; otherwise apply a reviewed schema-compatible fix or migration. A Render code rollback does not rewind persistent disk contents. **Never delete the disk, replace the database with the local development database, or clear progress/payment/quota tables as a rollback step.** Plan for a brief interruption on disk-backed deploys. [Render rollbacks](https://render.com/docs/rollbacks) · [Persistent disk limitations](https://render.com/docs/disks)

After the judging period, the owner should review whether to keep the paid service running, restrict the demo, or shut it down. Review retention and backup needs before removing any persistent resources; payment evidence and demo progress are not disposable deployment files.
