# Release preparation — 12 November 2026

**Decision: proceed to release preparation. Final submission acceptance is still pending.**

The tested runtime is `e7a5b480cd30242cd0d0009620d1c57f89c5fb12` on `codex/ai-draft-readiness`. The [latest incremental report](qa-report-2026-11-12-e7a5b48.md) records eight functional IDs passed, zero failed, and two P1 IDs blocked. All five functional P0 IDs passed: GAME-02, MOB-01, AI-04, PAY-03, and PAY-05. The test agent made no implementation changes.

Preserve that runtime as the functional baseline. Documentation-only handoff changes do not require repeating its gameplay, payment, or AI tests. Hosting adaptations are a later implementation change and have their own [targeted readiness evidence](hosting-readiness-2026-11-12.md). The final hosted candidate still needs deployment-specific acceptance.

## Remaining acceptance

| ID | Priority and current status | Work needed |
| --- | --- | --- |
| MOB-04 | P1 / BLOCKED | Use a physical iPhone Safari and record the model, iOS, and browser version. Check touch, history navigation, photo download, and album behavior. Chrome mobile emulation and the already-passed narrow-screen/keyboard/reduced-motion checks are separate evidence. |
| PAY-06 | P1 / BLOCKED, one remaining subcase | In a visible Sandbox browser, the owner signs in as the test buyer and checks the existing USD 10 and USD 20 checkout amounts. Order creation and remote/local amounts already passed. This subcase does not require another payment, capture, or sending credentials in chat. |
| REL-01 | P0 / NOT_RUN | Run the final public/default-branch candidate in a fresh directory, following the English instructions. Reuse earlier candidate installation evidence where applicable, and verify the final package and its permitted service-access route. |
| REL-02 | P0 / NOT_RUN | Finalize the open-source LICENSE and asset/dependency notices, align the default branch with the tested candidate, check tracked files and history for credentials or private data, and verify the public repository while signed out. |
| REL-03 | P0 / NOT_RUN | Record the working application, prepare English narration or subtitles, export a video shorter than three minutes, publish it on YouTube, and check the signed-out link against the final submission version. |
| REL-04 | P0 / NOT_RUN | Provide a working hosted demo or complete independent-run instructions with a usable, permitted way for judges to access the AI and Sandbox integrations. Verify access without requiring judges to pay, and keep it available throughout judging. |

The remaining count is six IDs: two partial P1 blocks and four release gates. Existing passes remain covered; this is not a request for another full test run.

## Execution order

1. **Prepare the release package.** Archive the new QA report, update the remaining-test list, and prepare the final default-branch version, LICENSE decision, asset notices, [English project description](devpost-submission-draft.md), and judge instructions. The repository remains private until its owner authorizes publication.
2. **Resolve judge access.** The owner selected an online Web demo, declined new paid Render hosting, and offered an existing Alibaba Cloud server and domains. Assess the [existing-server deployment plan](deploy-existing-server.md) after confirming the server, access, existing services, and hostname. The [Render plan](deploy-render.md) remains an unapplied reference. Local blank-key gameplay is useful installation evidence, but does not establish that judges can exercise the AI and Sandbox flows. Keep developer keys in private server configuration or another explicitly permitted private access arrangement, rather than the public repository.
3. **Record the demonstrated product.** Use the [English demo script](demo-script-en.md): virtual animal care and stories, simulated activity verification and points, source-grounded Astropods drafting with human review, and a PayPal Sandbox specified-material payment. Keep fictional projects, virtual growth, test payment, procurement, and rescue outcomes distinct. Generated tasks remain organizer-review drafts, not published game tasks.
4. **Complete the release checks.** Run REL-01 through REL-04 against the final package, check every submission URL while signed out, and reconcile the video, README, repository, and submitted commit. Record the two P1 outcomes or their remaining limitations separately.

MOB-04 and the remaining PAY-06 display check can proceed in parallel with package and video preparation. They do not prevent preparing release artifacts. No new animal, gameplay expansion, payment polling, or webhook implementation is required by the completed functional acceptance.

The working target is **12 November, 22:00 Beijing time**. The official submission deadline is **13 November 2026, 04:00 Beijing time** (12 November, 12:00 PST). The [official rules](https://paypalaihackathon.devpost.com/rules) require a public open-source repository, a functioning deliverable with usable access, and a public YouTube demo shorter than three minutes, with English materials or translations.

## Evidence boundaries

- The latest report's payment-error and AI-error checks use clearly identified mocks. They do not replace the earlier real Sandbox captures or the [real Astropods source comparisons](astropods-live-2026-11-11.md).
- The previously recorded 18 AI tests remain historical evidence. The new QA report did not locate a separate raw TAP artifact and does not claim it reran those tests.
- Raw files under `output/` are ignored local artifacts. Publish only selected, redacted evidence if it is used in the submission; do not make judges depend on development-machine paths.
- Passing the five functional P0 IDs is not the same as passing the four final release gates. No final "ready to submit" claim is made here.
