# English/Chinese release — 12 November 2026

The release adds English by default and a persistent English/Chinese selector on all six entry routes: town, stories, activities, support, organizer, and project draft. Existing gameplay, charity points, fictional budgets, Sandbox payments and real outcomes remain separate.

## Implementation

- Shared local dictionaries translate page text, accessible names, dynamically rendered state, source records, patrol questions, explanations, story chapters and error feedback. Switching language preserves browser progress and does not recreate game controls.
- The selected language persists in localStorage. A blocked storage API falls back to an in-memory English default without preventing play. The document language follows the current selection.
- New photo watermarks, species labels and medal text follow the selected language. Previously saved PNG pixels retain the language used when the photo was composed. Date formatting uses the selected locale when rendered.
- Draft requests explicitly allow only `en` or `zh-CN`, defaulting to `en`. Unsupported locale values are rejected before Gateway allowance is consumed. Model prompts and bounded format-retry prompts use the selected output language; selected original source text and IDs are unchanged.
- Switching language clears a previous or pending model draft, retains selected sources and budget evidence, and asks for regeneration. The app does not claim to machine-translate an arbitrary previous model answer.
- English organizer search indexes translated activity titles. English text wraps within wallet cards and narrow headers; the registration grid scrolls within its panel.

## Validation

The local isolated suite passes **111/111 tests**, including new real-HTTP language-asset/load-order checks and mocked default-English/Chinese/invalid-locale/retry tests. No model or PayPal request is made by that suite. Earlier sandbox-denied loopback runs were rerun with local network permission; those environment failures are not product failures.

The browser fixture `tools/browser/language-gate.js` passed:

- Fresh browser defaults to English; Chinese survives reload and route navigation; switching back restores English.
- All six routes at **1200, 390 and 320 px** have no visible untranslated Chinese text outside the intentionally bilingual language selector, and no document horizontal overflow.
- A virtual turtle is adopted through the interface; translated dynamic care state is displayed.
- Copied daily-project metadata restores Chinese correctly, and AI source selections remain intact across switches.
- No page JavaScript errors; no actual provider requests.

Local artifacts `output/playwright/language-acceptance.json`, `language-en-care-390.png` and `language-en-draft-390.png` are ignored development evidence and are not required to run a clean checkout. The runtime was copied to a temporary directory because cloud-backed workspace files could stall synchronous Node asset reads; the snapshot contains application source and dependencies, without private `.env` or player data.

## Publication and handoff

MIT LICENSE, dependency/asset notices, English setup instructions, judge access instructions, and [publication hygiene evidence](publication-hygiene-2026-11-12.md) are included. The owner authorized public release and selected the existing Sandbox Personal buyer. The owner will enter buyer credentials in the event's private testing field using the local ignored handoff template; those credentials are absent from source and public docs.

Runtime commit **`6f7c103aa00b8db7635225a93cc0f7405733fd66`** was pushed to the candidate branch and default `main`. The repository is public; anonymous API access recognizes MIT, and a credential-free fresh clone of `main` matches that commit. Fresh `npm ci`, blank-key doctor and real-HTTP page/resource checks passed. The temporary checkout contains no private environment file.

The existing VPS now runs `/opt/helpani-town/releases/6f7c103`. The uploaded archive SHA-256 was verified before extraction. The Linux Node 22.22.0 suite passes **111/111** before the atomic release switch. Loopback and public HTTPS health passed; database inode `662055`, private configuration metadata, and the existing OpenClaw processes were unchanged. No schema, credential, network or unrelated-service configuration changed.

Public HTTPS checks passed for six routes and five language resources, with normal certificate validation; every hosted language resource matches the released source byte-for-byte. Local dynamic browser acceptance also passed greeting/feeding, patrol question and answer, English organizer search, simulated verification awarding 100 points, and language round trips.

These final results close REL-01 and REL-02 in the release checklist. Later documentation-only commits preserve the tested runtime source. The public English video, physical-iPhone acceptance, and private buyer-field entry remain separate delivery items; local browser checks do not certify them.

## English quotation correction

The first hosted real draft retained a Chinese source title inside otherwise English task instructions. The final adapter explicitly requires translating source titles and quoted material into English and validates all user-facing fields for Han characters. A mixed-language response uses the existing single bounded format retry; a second failure remains an actionable error and never silently displays an unvalidated English draft. Source text, source IDs, source-derived budgets, the 45-second deadline and attempt charging are unchanged. A mocked regression covers correction, repeated failure, and Chinese-mode compatibility. Final local and Linux suites each pass 111/111.

The corrected hosted real draft passed on `claude-sonnet-4-6` in **one Gateway attempt**. Summary, budget flags, task title, instructions and quoted source title were English; source citation was `observation-notes`, the source-derived budget remained unknown, and `reviewRequired` stayed true. Switching to Chinese cleared the draft and preserved the one selected source. Chinese preference survived a reload; the browser was returned to English. Evidence is the ignored `output/hosted-language-ai.json` and `output/playwright/language-hosted-ai-390.png`. This is one reviewed real response, not a guarantee of future provider availability.
