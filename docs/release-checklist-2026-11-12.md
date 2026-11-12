# Release preparation — 12 November 2026

**Decision: proceed to release preparation. Final submission acceptance is still pending.**

The tested runtime is `e7a5b480cd30242cd0d0009620d1c57f89c5fb12` on `codex/ai-draft-readiness`. The [latest incremental report](qa-report-2026-11-12-e7a5b48.md) records eight functional IDs passed, zero failed, and two P1 IDs blocked. All five functional P0 IDs passed: GAME-02, MOB-01, AI-04, PAY-03, and PAY-05. The test agent made no implementation changes.

Preserve that runtime as the functional baseline. Documentation-only handoff changes do not require repeating its gameplay, payment, or AI tests. Hosting adaptations are a later implementation change and have their own [targeted readiness evidence](hosting-readiness-2026-11-12.md). The final hosted candidate still needs deployment-specific acceptance.

## Remaining acceptance

| ID | Priority and current status | Work needed |
| --- | --- | --- |
| MOB-04 | P1 / BLOCKED | Use a physical iPhone Safari and record the model, iOS, and browser version. Check touch, history navigation, photo download, and album behavior. Chrome mobile emulation and the already-passed narrow-screen/keyboard/reduced-motion checks are separate evidence. |
| PAY-06 | P1 / BLOCKED, one remaining subcase | In a visible Sandbox browser, the owner signs in as the test buyer and checks the existing USD 10 and USD 20 checkout amounts. Order creation and remote/local amounts already passed. This subcase does not require another payment, capture, or sending credentials in chat. |
| REL-01 | P0 / PASS | Anonymous fresh clone of public `main` at runtime commit `6f7c103`; `npm ci`, blank-key doctor and real-HTTP entry/language-resource tests passed. Full local and Linux isolated suites each pass 111/111. [Release evidence](language-release-2026-11-12.md) |
| REL-02 | P0 / PASS | Owner-authorized repository is public; anonymous API and Git clone verify default `main`, released source and recognized MIT license. Dependency/asset notices and full-history credential audit are complete. [Publication hygiene](publication-hygiene-2026-11-12.md) |
| REL-03 | P0 / NOT_RUN | Record the working application, prepare English narration or subtitles, export a video shorter than three minutes, publish it on YouTube, and check the signed-out link against the final submission version. |
| REL-04 | P0 / IN_PROGRESS | The [hosted Web demo](https://vibecreating.tech) has passed HTTPS, gameplay, real AI, restart checks, and the new-origin USD 5 PayPal Sandbox return with remote/local reconciliation. The owner selected the existing Sandbox Personal buyer and will fill its login in the event's private judging field. [Access instructions](judge-access.md) and a Git-ignored private handoff template are prepared. Final private-field entry and fresh-session buyer login remain owner handoff items. Core access requires no app account, personal key or real payment. [Deployment evidence](vps-deployment-2026-11-12.md) |

The remaining count is four IDs: two partial P1 blocks, REL-03, and the owner handoff in REL-04. REL-01 and REL-02 have passed for this release. Existing passes remain covered; this is not a request for another full test run.

## Execution order

1. **Prepare the release package.** Archive the new QA report, update the remaining-test list, and prepare the final default-branch version, LICENSE decision, asset notices, [English project description](devpost-submission-draft.md), and judge instructions. The owner-authorized publication, default-main alignment and anonymous access checks are complete.
2. **Resolve judge access.** The owner selected an online Web demo and declined new paid Render hosting. The existing Alibaba Cloud server now hosts [vibecreating.tech](https://vibecreating.tech); follow the [server deployment guide](deploy-existing-server.md) and remaining [hosted acceptance](vps-deployment-2026-11-12.md). The [Render plan](deploy-render.md) remains an unapplied reference. Keep developer keys in private server configuration rather than the public repository, and use the selected existing Sandbox buyer through the private event field; never publish its login.
3. **Record the demonstrated product.** Use the [English demo script](demo-script-en.md): virtual animal care and stories, simulated activity verification and points, source-grounded Astropods drafting with human review, and a PayPal Sandbox specified-material payment. Keep fictional projects, virtual growth, test payment, procurement, and rescue outcomes distinct. Generated tasks remain organizer-review drafts, not published game tasks.
4. **Complete the release checks.** Run REL-01 through REL-04 against the final package, check every submission URL while signed out, and reconcile the video, README, repository, and submitted commit. Record the two P1 outcomes or their remaining limitations separately.

MOB-04 and the remaining PAY-06 display check can proceed in parallel with package and video preparation. They do not prevent preparing release artifacts. No new animal, gameplay expansion, payment polling, or webhook implementation is required by the completed functional acceptance.

The working target is **12 November, 22:00 Beijing time**. The official submission deadline is **13 November 2026, 04:00 Beijing time** (12 November, 12:00 PST). The [official rules](https://paypalaihackathon.devpost.com/rules) require a public open-source repository, a functioning deliverable with usable access, and a public YouTube demo shorter than three minutes, with English materials or translations.

## Evidence boundaries

- The latest report's payment-error and AI-error checks use clearly identified mocks. They do not replace the earlier real Sandbox captures or the [real Astropods source comparisons](astropods-live-2026-11-11.md).
- The previously recorded 18 AI tests remain historical evidence. The new QA report did not locate a separate raw TAP artifact and does not claim it reran those tests.
- Raw files under `output/` are ignored local artifacts. Publish only selected, redacted evidence if it is used in the submission; do not make judges depend on development-machine paths.
- Passing the five functional P0 IDs is not the same as passing the four final release gates. No final "ready to submit" claim is made here.

## English-language release increment

The current release adds English by default and a persistent English/Chinese header switch across town, stories, activities, support, organizer and AI draft pages. Canvas photo labels use the selected language; previously saved photo pixels remain unchanged. AI requests explicitly select English or Chinese, and changing language clears stale model output while retaining source choices. Locale validation rejects unsupported values before consuming Gateway attempts. The 111-test local isolated suite passes; browser and hosted acceptance are recorded separately in the new language release evidence. This increment does not complete the video or physical-device gates.
