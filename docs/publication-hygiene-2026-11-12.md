# Publication hygiene check — 12 November 2026

The check used the remote candidate `8c84146ad1c6aa0f2a292417262a329bf258467e` on `codex/ai-draft-readiness` and the corresponding local tracked files. It covered 144 tracked files and all eight remote commits: 186 file revisions and approximately 1.21 million characters of patch content. Local cloud-backed Git object reads stalled, so the complete commit-content check used the authenticated GitHub connector. The unchanged graph SVG omitted from the initial API patch was checked in the current tree.

No real credential, literal demo-session cookie, buyer email, or private configuration value was found within this scope. Three configured secret values were compared privately against current content and 16,087 candidate substrings in the remote history using SHA-256 fingerprints; no values or fingerprints are published here. The four history pattern matches were intentional test fixtures. All three PNG assets were checked for private-value matches and text/EXIF metadata; none were found.

The checked history contains no private `.env` files, SQLite data, `output/` evidence directory, or `.playwright-cli/` browser logs. These paths remain outside the tracked release package. The earlier `main` is an ancestor of the checked candidate and is seven commits behind it; this records the inspected state, not a completed default-branch change or public-repository verification.

Current documentation was sanitized in five files:

- `medal-art-prompts-2026-11-09.md`: three personal image-source paths omitted.
- `quiz-reward-review-2026-11-09.md`: five screenshot paths converted to portable repository-relative paths, with an explicit note that the ignored local images are not distributed.
- `qa-report-2026-11-11.md`: one personal instruction-file path and four Sandbox transaction identifiers redacted.
- `qa-report-2026-11-12-e7a5b48.md`: one personal instruction-file path and two Sandbox transaction identifiers redacted.
- `paypal-sandbox-2026-11-11.md`: two Sandbox transaction identifiers redacted.

The redactions preserve the recorded test amounts, statuses, outcomes and evidence limits. They do not erase earlier Git history: the original personal paths and Sandbox identifiers remain discoverable in prior commits. No history rewrite was performed. They were not identified as credentials; no credential-based publication blocker was found in the inspected content. Repository visibility, the final published/default-branch candidate and signed-out access still require their own verification.
