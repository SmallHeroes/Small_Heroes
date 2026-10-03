# Current story edit admission

Guy approved milestone A and then the separate experimental milestone B in
PERSONAL_STORY_CAUSAL_PLANNING_DECISION_20261003.md. This milestone closes the
current admission gap, not story quality. Archives remain readable. No new
provider, image, audio, deployment or push is authorized by this change.

## Cause and change

Archive edited-story schemas intentionally accept v1/v2/v3. Current display and
storyboard preparation used the same archive contract. Relabelling a v3 semantic
HOLD as v2 and removing its audit could therefore turn archive compatibility into
current admission. Removing the whole edit receipt also left an offline draft
path. That path is intentional compatibility, not proof of a paid render exploit.

The current admission version is now engine-owned. Server admission requires the
current receipt, checks canonical source binding and actual audit citations, and
rejects ordinary or semantic editorial HOLD. Current storyboard preparation and
current frame issuance use this boundary; the book runner calls those wrappers.
Complete browser readers require the current schema and non-held observations.
They remain display validators, not cryptographic server authority. Partial/error
and generic offline archive readers retain old behavior and never grant runtime
eligibility. No version opt-out is accepted from a payload or operation.

Six changed code paths: story-editor-contract.ts, story-editor.ts, storyboard.ts,
book-runner.ts, book-preview.ts, and story-semantic-audit.spec.ts under
lib/personal-wizard. Shared provider schemas and the archive validator are unchanged.

## Evidence and limits

Focused five-spec command: story-semantic-audit, story-editor, book-preview,
book-runner and storyboard. 322/322 tests pass: 41+42+39+129+71. This adds 12 tests,
covering all five semantic HOLD categories, v2 relabelling, full receipt removal,
forged citation with a recomputed digest, ordinary display HOLD, all three lengths,
archive compatibility and rejection before an injected author is called.

Four isolated in-memory source mutations are caught. Production bytes are not
edited by the harness. Artifacts are in the ignored local root
outputs/personal-current-admission-20261003, without verified backup. Its first
verification.json records erroneous timestamp differences: Node ISO formatting
rounded sub-milliseconds while parsing the historical strings truncated them.
preservation-correction.ps1/json checks exact .NET ticks and SHA/size instead:
272/272 preserved. Keep the first record, do not silently replace it.

Standalone tsc and both type-check stages of npm run check exit 0 after correcting
one stale ReturnType reference during implementation. Full npm run check exits 1:
ordinary 387 files, 11 failed/5763 passed/73 skipped; resource 20 files, 4 timeout
failures/631 passed of 635 and 4 onTaskUpdate errors. The prior run had 10 ordinary
failures and 3 resource timeouts. No causal attribution or GREEN stability claim.
An ordinary-only rerun with the same 387-file/4-worker partition exits 1 with
10 failed/5764 passed/73 skipped. All ten failures concern missing historical
artifacts. The additional first-run failure did not recur; its identity was lost
in truncated tool output and remains unmeasured. This is not a stability closure.
ordinary-rerun.json/log preserve the rerun; no full base reproduction is claimed.

These guards cannot prove semantic entailment, literary quality, a live SDK
response or product readiness. No independent PASS is self-awarded. Milestone B
must remain isolated from the current GPT runtime and consumed trial records.

## Claude Code falsification targets

Read-only first pass, branch codex/personal-book-storyboard-bridge, worktree
C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes. Base is
4ab69eee5e261eda824fcf44a75f3f982b9b3273; freeze the successor commit before review.

Try relabelling HOLD to v2 and stripping audit or all editing metadata at every
current server/browser/frame entry. Verify archive and partial reads still work.
Try stale/recomputed source digests and forged citations. Confirm no callback is
reached for rejected current input, but generic archive diagnostics stay explicitly
offline. Check the real runner uses current wrappers, all capabilities remain
runtimeEligible false, and no key/provider/paid-render path was added.

Verify the four mutations and exact preservation correction rather than trusting
the first timestamp comparison. Reconcile the full RED gate and ordinary rerun;
do not infer all failures are inherited. Protected worktrees remain unchanged.
No public cutover, payments, wizard UI, old trial rewrite or spend in this range.
