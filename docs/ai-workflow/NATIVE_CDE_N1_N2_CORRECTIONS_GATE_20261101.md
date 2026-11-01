# Native CDE R2 — complete N1/N2 before any run staging

## Approval and scope

This is a bounded corrective milestone within Guy's approved provider-free native C/D/E integration ("מאשר - תתחיל", 2026-11-01) and the required Codex-fixes/Claude-re-gates loop. Guy manually returned Claude's R1 technical PASS and its next action: record the PASS and correct N1/N2 before any run is approved. No new product decision, paid sample or book authority is inferred. Codex implements; Guy manually forwards the frozen corrective commit to Claude Code, first pass read-only.

Base: c226f2a9cf1b3051479aba4c63ce36b788637fd7. Branch claude/book-render-20261009, worktree C:/GNart/Work/sh-book-render-20261009. Continue this root task and existing checkout; one writer only.

## Observed versus expected / root causes

- N1: planTrialInputs validates the selected companion and pins its source but does not resolve its approved standing-scale authority. That check occurs later in runSimpleWizardBook, after the one-shot claim is written. An unsupported CDE companion can therefore burn a cycle with zero spend. Expected: CDE planning itself refuses an unavailable/invalid scale authority before a claim can be staged/executed. Fix: resolve companionScaleAuthority for the validated selected companion during the dry plan only when CDE is opted in. Preserve legacy behavior and the per-companion authority, not a universal ratio.
- N2: final-selection/outcome contain truthful bookQa/scope, but writeTrialReader receives none of them and its legacy header always says cover plus eight pages. Individual supported sample pages can look like an approved book. Expected: prospective CDE viewers clearly show whole-book held/supported/incomplete state, produced versus requested coverage and the applicable scale/quality stop reason. A stopped sample must not imply book completion or narration. Existing saved books are never rewritten.

## Smallest general solution / files

- scripts/personal-book-e2e-trial.ts: early CDE scale preflight; pass typed whole-book display state to the existing diagnostic viewer; render a truthful status notice without a layout redesign or new endpoint.
- Focused native dry-plan, real viewer-output and native caller tests. Reuse the approved provider-constructor-denied resolver and strictly synthetic transport fixture.
- CURRENT.md, ROADMAP.md and this Decision Gate.

No companion, child, story or page-specific production patch. Defaults/unmarked viewer bytes stay compatible where no new display state is supplied. No new source schema, scale range, threshold, grant, cycle, repair route, budget or continuation permission.

## Work order and acceptance

1. Verify final R1 report/ready/index, all 48 reviewer evidence files, 134 writer evidence files and 40 committed/source pins, plus actual manual end_turn. Preserve all R1 reports and failures. Record R1 technical PASS only for c226f2a9.
2. Acquire sole Codex corrective writer. Reproduce N1 with the actual dry-plan slice and N2 with the real viewer writer in temporary synthetic directories; retain expected red assertions.
3. Implement the early authority check and optional viewer status. Both changes are prospective and general. Unsupported CDE scale fails during planning, before claim/cost. Measured versus unmeasured action behavior and the 0.70 identity gate are unchanged.
4. Exercise approved Momo and a second approved authority, unsupported companion with CDE, and legacy opt-out compatibility. Check a real all-abstained sample viewer, failed-quality sample, full held/supported book notices, escaping and native caller forwarding, plus a generic review-error notice when no final manifest is available.
5. Run relevant full focused suites, both TypeScript gates, meaningful negative controls and historical R17 hash/review preservation. Do not repeat a blind full historical suite; npm run check remains not declared green unless actually completed. Make a focused local commit with explicit paths, freeze it and release the writer for Guy-manual independent Claude re-gate.

## Alternatives and risks

- Reject a global ban or ratio fallback for companions lacking authority: the restriction belongs only to opted-in CDE planning.
- Reject checking after claim, resetting a consumed claim, relaxing image gates, inferring standing poses from prose, or approving a book by page count.
- Reject retroactive viewer/book repair. Only future diagnostic outputs receive the new optional display state; R17 files remain immutable.
- Keep status text separate from actual qualification: a notice reports bookQa/scope; it grants no product/production permission. Full-book narration after a passed sample remains the existing bounded behavior (N5), not a small-sample authorization.

## Cost, stop-check and rollback

This touches preflight and diagnostic viewer truth, so the stop-check applies. It is a general corrective change already within the approved $0 milestone. Local synthetic fixtures/typechecks only, no provider/image/audio calls, no key/.env reads, server, full render, push/merge/deploy or cleanup. No data migration. Rollback is a future focused revert or absent CDE/display opt-in, never reset/cleanup. A later visual proof still needs an already compiled eligible source, explicit page-only scope, independent envelope and Guy's exact budget approval (N3/N5). N4 SDK-HTTP coverage debt is retained, not claimed solved.
