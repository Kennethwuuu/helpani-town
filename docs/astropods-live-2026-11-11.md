# Astropods live draft checks — 11 November 2026

The final mobile-browser check passed with two live draft operations and three actual Gateway requests, using `claude-sonnet-4-6`. The final AI regression suite passed **18/18**. The CLI evidence and failures below are retained with their original scope; a public repository, open-source LICENSE, clean-clone release check, and final video are still pending.

## Initial CLI evidence

Two real Astropods Gateway requests completed using `claude-sonnet-4-6`. Both passed the adapter's structural checks, the developer's manual source comparison, and an independent review of the two fixed outputs. The evidence file was generated at **2026-11-11T13:04:20.654Z**, or **21:04:20.654 Beijing time**, by `npm run check:ai`.

| Case | Selected source IDs | Duration | Recorded result |
| --- | --- | --- | --- |
| All sources | `rescue-plan`, `supply-register`, `observation-notes` | 4,616 ms | Structural checks passed. The summary retained the USD 100 target, eight cloths at USD 8 each, USD 64 subtotal, and USD 36 awaiting a breakdown and quotations. Procurement and receipt records remained awaiting updates. The task asked the reader to locate the light-entry description in the source text. |
| Observation only | `observation-notes` | 3,372 ms | Structural checks passed. The summary stayed within the two light sources entering the observation area and the still-incomplete care-result material. Budget information was identified as missing. The task asked the reader to find the light count and entry location in the selected text, with only that source cited. |

The server's separate budget calculation uses selected structured facts, not model-generated numbers. For all sources it shows a USD 100 target, USD 64 material subtotal, and USD 36 difference. For observation-only input the budget amounts remain unknown. The model's review suggestions and reading task are reviewed against the source text, while the application retains the original fictional-data labels.

The generated task is a draft instruction shown for review. Wording such as “write down” does not establish an implemented answer-entry, map, or gameplay task; the model does not publish or execute the draft.

The local evidence artifact is `output/ai-smoke-latest.json`. Its metadata records the live Gateway mode, requested model, selected sources, timings, structural results, and returned drafts. The file keeps `contentReview: required` and each draft's review requirement. The two samples above were manually reviewed for this run; future drafts still need review. This document contains no Gateway host, key, account identifier, or buyer information.

The run had earlier failures that remain part of its history.

1. Earlier live `claude-haiku-4-5` outputs passed structural checks but failed manual grounding review. They promoted an unconfirmed procurement state and introduced unsupported care or task details, including in the observation-only case. Those results remain failed examples.
2. Initial Sonnet requests returned invalid JSON because of unescaped quotation marks. The adapter rejected them instead of displaying a usable draft.
3. The prompt was corrected to require safely escaped JSON and source-reading tasks confined to supplied material. The final two requests produced the results in the table. Earlier artifacts were retained separately.

The follow-up isolated AI regression suite reported **16/16 passed**. These tests use controlled upstream responses to verify adapter and HTTP behavior. Gameplay and PayPal tests were not rerun as part of this AI check. The earlier Mock-only development checks remain recorded in the readiness history. [Development and Mock history](ai-readiness-2026-11-11.md)

A later browser generation again returned sporadic invalid JSON. A follow-up change adds **one bounded format retry per draft**, only for `AI_RESPONSE_INVALID`, within a shared 45-second deadline. Authentication, quota, and network errors are not retried automatically. The current `check:ai` workflow therefore means **two live draft operations and up to four Gateway requests**; successful drafts return `generation.attempts` as 1 or 2, and the tool records the actual request count. The two successful requests and 16-test result above describe the earlier version, before this retry change.

## Final browser and retry verification

The final retry implementation passed the real `/project-draft` walkthrough in Chrome at **390 × 844**, with an additional **320 px** width check showing no horizontal overflow. These are browser-emulated mobile viewports, not iOS Safari hardware evidence. No Gateway response was mocked for this walkthrough.

| Browser operation | Gateway requests | Result |
| --- | --- | --- |
| All three sources | 1 (`generation.attempts: 1`) | HTTP 200. The source-based panel displayed USD 100 / USD 64 / USD 36. The returned facts and pending states passed the developer's manual source review. |
| Observation only | 2 (`generation.attempts: 2`) | HTTP 200 after the single allowed format retry. Budget amounts changed to unknown; the returned facts and states passed the developer's manual source review. |

The page showed the model and human-review labels. Changing the source selection cleared the old output, including the previous budget amounts. Clicking the observation task citation navigated to `#source-observation-notes`. No unhandled page errors were observed. The observation-only task proposed locating the source-described light entries on a virtual map; it remains a review draft, and this app does not implement that map interaction.

Local screenshots are `output/playwright/ai-readiness/live-all-sources-mobile.png` and `output/playwright/ai-readiness/live-observation-mobile.png`. They are ignored local QA artifacts, not published delivery evidence or a completed video. The final isolated AI regression suite passed **18/18** on the retry logic and prompt; the subsequent source cleanup changed indentation only. Gameplay and PayPal were not rerun for this AI change.

Future generated drafts still require human source review. These results complete the stated AI CLI, browser, and retry checks; clean-clone release verification, public repository and LICENSE, public demo delivery, and video recording remain separate work. A configured indicator alone is not a live result.

The Gateway is used through permitted developer access; this access does not establish an official partnership. The organizations, rescue materials, sponsor budget, and attendance examples remain fictional, and generated drafts remain subject to organizer review. Recorded Sandbox payments and the organizer-to-points workflow have separate evidence. [Sandbox and organizer QA](qa-report-2026-11-11.md) · [Gateway API](https://docs.astropods.com/ai-gateway/chat)
