# Clean-clone candidate verification — 11 November 2026

The private remote candidate at `0d373fd92c3a2fb2908fa581cdfd06bc0654f086` passed an independent installation and local browser smoke check. This is candidate verification, not final acceptance of the public release or of judge access to external services.

## Environment and isolation

- Repository: `Kennethwuuu/helpani-town`, branch `codex/ai-draft-readiness`.
- Fresh clone: `/private/tmp/helpani-clean-clone-20261111T1334` on macOS, using Node.js 22.20.0 and npm 10.9.3.
- The clone initially had 128 tracked files and a clean worktree. No `.env`, `node_modules`, or `data` directory existed, and none was tracked.
- Dependencies were installed by `npm ci` in the new directory. Application dependencies and databases were not copied from the development workspace. npm reported three installed packages, completion in two seconds, and no dependency vulnerabilities in its audit output.
- A new `.env` was copied from `.env.example`. Only the host, port, and public origin were changed to `127.0.0.1`, `3120`, and `http://127.0.0.1:3120`. Payment and AI credentials remained empty. SQLite was created under the clone's own `data` directory.
- The existing development service at `localhost:3000`, its private credentials, database, and browser photos were preserved. All service calls in this check went to the isolated 3120 instance; no PayPal or Astropods requests were made.

The run followed the guide's installation, environment, `npm run doctor`, and `npm start` sequence. The follow-up setup documentation now includes the full branch-specific clone command and an alternative port/database example.

## Recorded results

| Check | Result and scope |
| --- | --- |
| Local configuration check | PASS. Node and AG Grid were available. PayPal and Astropods were correctly reported as unconfigured; `doctor` made no network requests. |
| Startup | PASS. `npm start` created the new SQLite database and served port 3120. Node's experimental SQLite notice was informational; startup succeeded. |
| Static routes and assets | PASS, 59/59 URLs. All declared page/static routes, root SVGs, and species medal artwork returned HTTP 200 with nonempty bodies and expected content types. PNG signatures were also checked. This includes the AG Grid bundle from the newly installed dependencies. |
| Budget without AI access | PASS. All three sources returned target/itemized/unallocated values of 10000/6400/3600 cents; observation-only input returned unknown amounts. A direct unconfigured draft request returned 503 with `AI_NOT_CONFIGURED`. |
| Initial playable scene | PASS. One red panda was adopted through the browser. Its Canvas rendered actual pixels, and the welcome grant showed one virtual food and zero charity points. |
| Four-page navigation | PASS for Chrome at 390 × 844. Town, Stories, Activities, and Support were selected through the bottom navigation after scrolling; each showed one active page and the correct selected link. Each path was refreshed, and browser back/forward restored the expected route. The adopted species was retained. |
| Payment configuration UI | PASS. Expanding the donation and specified-material sections showed the missing-Sandbox-configuration message, with payment actions disabled. No payment was initiated. |
| Organizer | PASS. The independently installed AG Grid mounted, its search controls became available, and the new session displayed the empty-registration explanation. No registration or verification was performed. |
| Draft configuration UI | PASS. Three sources loaded, the generation button remained disabled, local budget checks worked, and selecting only the observation source cleared old amounts. The draft page also had no horizontal overflow at 320 px. |
| Browser errors and requests | The successful smoke walkthrough recorded zero unhandled page errors, zero failed resource responses, and zero requests to external origins. These are Chrome viewport checks, not touch-enabled or physical iPhone Safari evidence. |
| Process restart and interaction | PASS. After stopping and restarting only the 3120 service, the same browser session restored the red panda, one food, and zero charity points. One greeting produced exactly one local touch request, marked the encounter, and preserved the food and charity balances. |

Two initial inspection-script assumptions were corrected and their logs retained. The first incorrectly expected the display Canvas to use the 1600 × 1000 photograph-export size; its actual responsive backing size was 328 × 205 with rendered pixels. The second read visible text inside a closed payment section; the corrected walkthrough expanded the payment sections before checking their explanations. Neither finding required changing application rendering or payment behavior. A separate CLI-help request encountered the automation shell's restricted npm DNS; the application installation and the browser walkthrough completed successfully with network access enabled where needed.

## Follow-up documentation corrections

- README and the English guide now show the handoff branch in the clone instructions. The default `main` branch still predates the AI integration and remains a release-alignment task.
- The configuration template now describes the standalone account-Gateway-key path as well as optional agent-runtime injection.
- The configured `doctor` hint now describes two live draft operations and up to four Gateway attempts, matching the bounded retry behavior. Its local-only configured path was checked without making API calls.

Local JSON results, inspection scripts, screenshots, and retained initial-probe logs are under `output/clean-clone-20261111/` in the development workspace. This ignored directory is not required to build the application and is not published evidence. The original temporary clone also retains its own copies.

The payment and AI integrations retain their earlier, separate live evidence. This run did not repeat the full gameplay suite, payment captures, or model generation. [Sandbox and organizer evidence](qa-report-2026-11-11.md) · [Live AI evidence](astropods-live-2026-11-11.md)

## Remaining release work

The repository is still private and has no open-source LICENSE. The final public/default-branch build, permitted judge access to Sandbox and AI, English video, submission links, and public-access checks remain open. Touch-enabled and physical-device navigation, interrupted Canvas recovery, the complete care-story chain, and the remaining payment/AI error branches keep their separate test status. This result does not mark REL-01 through REL-04 or the full mobile test matrix complete. [Remaining test plan](test-plan-2026-11-11.md)
