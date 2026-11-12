# Existing-server deployment guide

Helpani Town is live at [https://vibecreating.tech](https://vibecreating.tech) on the owner's existing Alibaba Cloud Simple Application Server in Silicon Valley. SSH inspection, isolated runtime installation, application startup, and public HTTPS checks have been completed. A real hosted AI draft and application-restart persistence also passed. The owner completed a USD 5 Sandbox flow on the new hostname; remote order/capture and the local ledger matched, and the payment record survived a subsequent application restart. See the [deployment evidence and remaining checks](vps-deployment-2026-11-12.md).

The owner declined new paid Render hosting. The previous [Render plan](deploy-render.md) remains a reference; do not create its resources. Using the existing server avoids that additional Render subscription, but existing server renewal, traffic, domain, and AI usage charges still apply.

## Confirmed host and release

The deployment maintainer inspected Ubuntu **24.04.2 x86_64**, on the reported 2 vCPU / 2 GB server. Pre-deployment inspection recorded approximately **736 MB available memory** and **22 GB available disk**; these are a point-in-time observation, not a capacity guarantee. The existing OpenClaw process retained its original PID through the deployment checks.

The deployed application source is `e38a7440c9cce5b368af8343349dcb6a2ea5a7fe`. Its isolated executable at `/opt/helpani-town/runtime/bin/node` is **Node.js 22.22.0**, copied from the server's existing `/usr/bin/node`; the global runtime and OpenClaw's installation were not replaced. The application uses one dedicated `helpani-town` service and a fresh online SQLite database. Caddy **2.11.9** was installed from its official package source. Native `systemd-analyze verify` and `caddy validate` passed before startup.

The repository's [`.node-version`](../.node-version) remains **22.20.0**, matching the earlier local test run. The server's **22.22.0** runtime passed a separate run of the same **33 targeted tests**. Do not describe the VPS as running 22.20.0 or relabel the earlier local run as server evidence. Preserve the lockfile, use `npm ci --omit=dev`, and include `server/`, `public/`, and the installed AG Grid dependency. Deploying only `public/` omits required APIs and assets.

## Application configuration

| Setting | Existing-server configuration |
| --- | --- |
| `HOST` | `127.0.0.1`, behind the same-host HTTPS reverse proxy. |
| `PORT` | `3120`, confirmed by the deployment maintainer; match the actual private environment and proxy upstream. |
| `PUBLIC_ORIGIN` | `https://vibecreating.tech`, with no path. It controls browser POST-origin acceptance, secure session cookies, and the default PayPal return origin. |
| `DB_PATH` | `/var/lib/helpani-town/helpani.sqlite`, outside replaceable releases. Keep SQLite and its WAL/SHM sidecars together. |
| `NODE_ENV` | `production`. |
| `AI_DEMO_MAX_REQUESTS` | `100`. |
| `AI_DEMO_SESSION_MAX_REQUESTS` | `10`. |
| `AI_DEMO_MAX_CONCURRENT` | `1`; run a single application instance. |
| `ASTRO_GATEWAY_MODEL` | `claude-sonnet-4-6`. |

Set all three AI limits explicitly: a global value of zero disables the guard. Counters persist in SQLite, count actual upstream attempts including format retries and failures, and have no timed reset. They bound attempt counts, not provider spending. The [hosting readiness record](hosting-readiness-2026-11-12.md) documents the earlier local tests and their limits; the new deployment record identifies the separate Linux run.

The owner authorized secure transfer of the four application settings: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `ASTRO_GATEWAY_URL`, and `ASTRO_GATEWAY_API_KEY`. The real runtime environment is a root-owned, mode-`0600` private file outside served content and release archives. PayPal remains Sandbox. The developer's full local environment, Render management key, Git credentials, local player database, and browser photos were not deployment inputs.

## Network and service operation

The selected hostname serves the complete app at its root path; the app has no configurable subpath/base-URL support. Preserve browser `Origin` and `Cookie` headers and allow at least 60 seconds for upstream response headers, covering the AI adapter's shared 45-second deadline. Caddy's reverse proxy and automatic HTTPS handle the selected site's HTTPS entry point. [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) · [Automatic HTTPS](https://caddyserver.com/docs/automatic-https)

HTTP redirects to HTTPS with status **308**. Public HTTPS certificate and hostname validation, cookie attributes, same-origin budget actions, and rejection of a foreign POST origin passed the public increment. `GET /healthz` returns HTTP 200 with `{"status":"ok"}` and no visitor cookie. The health endpoint reports liveness, not provider authentication or a completed payment.

Repository [systemd](../deploy/vps/helpani-town.service), [runtime environment](../deploy/vps/runtime.env.example), and [Caddy](../deploy/vps/Caddyfile.example) files remain reusable templates. Their example hostname is deliberately a placeholder. The deployed configuration uses the selected real hostname, a separate `helpani-town` user/group, the isolated Node executable, and persistent state under `/var/lib/helpani-town`. The private environment example contains no real credentials. Do not replace OpenClaw's runtime or unrelated site configuration when maintaining the app.

Use the dedicated service for application updates and recovery. Record the source revision, verify loopback `/healthz`, and verify the public HTTPS site after each reviewed release. A successful process start is not proof of readiness. Keep existing SSH, firewall, and unrelated application settings intact.

## Hosted acceptance still in progress

The saved Linux TAP artifact records **33/33 passing isolated tests**. The independent public HTTP artifact records **23/23 passing checks** with normal TLS validation. Those checks do not create a PayPal order or call a real model. The deployment maintainer separately observed a 390 × 844 browser walkthrough with pangolin adoption, greeting, and one feeding resulting in 10 XP; it is a narrow smoke check, not a complete gameplay rerun.

A real hosted AI draft returned HTTP 200 using `claude-sonnet-4-6`, with `generation.attempts = 1` and `reviewRequired = true`. The source-derived budget remained USD 100 / USD 64 / USD 36 and the task cited `observation-notes`. This is a specific reviewed draft, not a guarantee about later model outputs.

Application-restart persistence passed with the same database inode, the same pangolin and one feeding, 10 XP, and the global AI attempt count retained at 1. The application process changed, health recovered, and the original OpenClaw process remained alive. A separate restart after the completed hosted USD 5 Sandbox contribution retained its payment record and the same AI usage. Photos remain browser/device/origin-local IndexedDB data.

The hosted USD 5 PayPal Sandbox flow is **PASS**: the owner reported returning to the online support record, and the maintainer verified the remote order and capture as `COMPLETED`, matching USD amount, order/reference/capture identifiers, and the completed server ledger. A second application restart retained that record. This does not retest the previous USD 8/10/20 cases. Keep payment confirmation separate from procurement, delivery, and rescue outcomes. Update the judge guide and final release evidence with actual outcomes and limitations.

Use release directories separate from persistent data. Make a consistent SQLite backup before schema changes; a code rollback must remain compatible with the stored schema. Never erase or replace the online database as routine rollback or quota replenishment.

Public hosting does not complete the final release by itself. The [release checklist](release-checklist-2026-11-12.md) still requires the authorized public repository and license, final judge-access acceptance, and the English demonstration video. Raw local QA artifacts are ignored and are not automatically part of the published repository.
