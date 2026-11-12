# Existing-server deployment plan

The owner declined new paid Render hosting and offered an existing Alibaba Cloud Simple Application Server in Silicon Valley, plus unused domains. This is the preferred route to assess. No server connection, installation, DNS change, or deployment has been performed. The operating system, available capacity, existing services, and chosen domain still need confirmation.

The previous [Render plan](deploy-render.md) remains a reference; do not create its resources. Using the existing server avoids that additional Render subscription, but existing server renewal, traffic, domain, and AI usage charges still apply.

## Information needed

Ask the owner for the public IP or an existing SSH alias, operating system/version, CPU and memory, existing websites/services, the proposed hostname, and whether they can change its DNS. Confirm the SSH username and available login method. Passwords, private keys, cloud API keys, and buyer credentials do not belong in chat or the repository.

Inspect the named server read-only before choosing commands: runtime support, disk space, running services, listening ports, service manager, reverse proxy, and firewall rules. Do not assume Linux, systemd, an empty server, or unused ports. Alibaba Cloud supports both Linux and Windows images. [Official server guide](https://www.alibabacloud.com/help/en/simple-application-server/getting-started/novice-guide-1)

## Application configuration

The application remains one Node process with SQLite. The tested hosting candidate uses Node.js 22.20.0, pinned in [`.node-version`](../.node-version), with `npm ci --omit=dev` and a server entry point of `server/index.mjs`. Preserve the existing lockfile and include the installed AG Grid dependency. Do not deploy only `public/`.

| Setting | Existing-server plan |
| --- | --- |
| `HOST` | `127.0.0.1` behind a reverse proxy on the same host. |
| `PORT` | An unused local port, selected after inspecting the server. |
| `PUBLIC_ORIGIN` | Explicit final `https://` hostname, without a path. There is no Render-provided origin on this server. |
| `DB_PATH` | An absolute writable path outside replaceable release directories. Keep SQLite and its WAL/SHM sidecars together. |
| `NODE_ENV` | `production`. |
| `AI_DEMO_MAX_REQUESTS` | `100`. |
| `AI_DEMO_SESSION_MAX_REQUESTS` | `10`. |
| `AI_DEMO_MAX_CONCURRENT` | `1`; run a single application instance. |
| `ASTRO_GATEWAY_MODEL` | `claude-sonnet-4-6`. |

Set the three AI limits explicitly: the local default of zero for the global limit disables the guard. The counters persist in the same SQLite database, count actual upstream attempts including format retries and failures, and have no timed reset. They bound attempt counts, not provider spending. The [hosting readiness record](hosting-readiness-2026-11-12.md) documents the 33 passing isolated tests and their limits.

Transfer only the permitted application configuration through the established secure connection: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `ASTRO_GATEWAY_URL`, and `ASTRO_GATEWAY_API_KEY`. Preserve Sandbox use. Keep server-side credentials in a private environment file outside the served files and source archive. Do not transfer the local environment wholesale, the Render management key, Git credentials, the developer's player database, or browser photos.

## Network and process setup

Serve the complete app through one HTTPS hostname. Reuse an existing reverse proxy when present, adding only the selected site's configuration. If the server is suitable and has no proxy, Caddy is an option: its reverse proxy can forward the site to the Node loopback address, and automatic HTTPS manages certificates when the domain and network requirements are met. This is conditional, not an instruction to replace existing Nginx, Apache, or a hosting panel. [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) · [Automatic HTTPS prerequisites](https://caddyserver.com/docs/automatic-https)

Use the hostname's root path for the complete app; it has no configurable subpath/base-URL support. Preserve browser `Origin` and `Cookie` headers. Set any proxy response-read timeout to at least 60 seconds so it covers the AI adapter's shared 45-second deadline.

Point only the selected hostname's DNS to the confirmed public server address. Check existing A and AAAA records and preserve unrelated records. Verify public TCP 80/443 as required by the chosen HTTPS setup, together with the cloud and operating-system firewalls; the Node port can remain on loopback. Confirm outbound HTTPS access to the configured PayPal Sandbox and Astropods services. Do not change unrelated server firewall or SSH settings.

Choose a persistent process manager after identifying the operating system. On a systemd Linux server, a dedicated service account and unit are a possible implementation; other systems require their own setup. Keep one application instance, private environment permissions, a persistent writable data directory, and automatic recovery from a process failure. Match any executable path to the inspected Node installation.

## Deployment and acceptance

1. Inspect the identified server and agree on the final hostname and isolated application paths. Preserve existing sites and services.
2. Transfer a tracked-file release of the selected private-repository commit through the authorized connection. Install locked dependencies; configure a fresh online database and private application environment. Do not copy development records to the public demo.
3. Start the application on loopback and verify `GET /healthz` before enabling the selected HTTPS site. The endpoint should return `{"status":"ok"}` without a visitor cookie; it does not establish provider health.
4. Configure only the selected domain, DNS, HTTPS, and process service. Record the actual deployed revision and hostname.
5. Verify public TLS, page navigation, session continuity and cookie attributes, same-origin actions, one real hosted AI draft, and one PayPal Sandbox checkout returning to the new hostname. Keep payment confirmation separate from procurement, delivery, and rescue outcomes.
6. Restart the application and confirm that progress, payment records, and AI usage survive with the same browser session. Photos remain device/browser/origin-local IndexedDB data.
7. Update the [judge guide](judges-guide.md), demo recording, and release evidence with verified results. Existing localhost tests are not hosted acceptance.

Use release directories separate from the persistent data directory. Preserve a consistent SQLite backup before schema changes. A code rollback must remain compatible with the stored schema; never replace or erase the online database as a routine rollback or quota reset.

These steps remain pending the server details and actual execution. The [release checklist](release-checklist-2026-11-12.md) still requires the public repository/license, final judge access, and English demonstration video.
