# Native C/D/E integration — approved provider-free milestone

Owner decision: Guy explicitly said "מאשר - תתחיל" on 2026-11-01 after the manual Claude R2 technical PASS and proposed integration order. Codex implements; Claude Code independently re-gates after Guy manually forwards the finished brief. No automatic messages or dispatch.

## 1. Proposed change

Connect the existing opt-in C/D/E storyboard, reload/admission and image-review contracts to scripts/personal-book-e2e-trial.ts. Add one versioned prospective config binding with a one- or two-narrative-frame early sample. Require actual comparable in-range scale evidence and otherwise supported sample pages before any remaining frame. Project book qualification from the engine manifest, never from a count of supported pages.

## 2. Observed behavior, expected behavior, root cause

At base 7350975229dbcbcc69d67f0693699d8770dacccf, C/D/E lower-level contracts passed independent QA at 3e294e7d. The native runner does not opt into them, and its storyboard filesystem admission does not reconstruct their flags. Its image path always uses the all-frames-first fresh diagnostic cohort. A partial sample cannot be bolted onto that mode: its scope explicitly forbids samples, and the caller assumes all nine saved pages exist, runs a legacy outer correction loop and may narrate them. Its outcome reports a supported-page count without a size-aware book decision.

The general solution is explicit prospective binding through config -> recomputed grant -> every board/repair call -> bound source admission/reload -> sequential early-sample audition -> manifest-level outcome. Old configs and cycles without this opt-in retain their behavior. This is the native experimental book runner, not an integration into the customer order/chunk pipeline.

## 3. Scope

General, provider-free engine integration and tests. Also correct CURRENT.md attribution: Claude re-hashed 279 R17 book files; Codex checked the 321-file historical preservation set. No story, child, companion, page-specific production conditions. Test fixtures may use more than one companion authority.

## 4. Hardcoding / compatibility risks

Do not choose a universal companion ratio, force action poses to stand, infer pose eligibility from keywords or certify an abstention. Use each compiled book's approved typed scale authority and actual review evidence. The bounded sample is explicit grant/config data, not hardcoded Momo page numbers. Existing default and unmarked samples remain unchanged.

## 5. Likely files

- scripts/personal-book-e2e-trial.ts
- scripts/personal-simple-book-reviewed-audition.ts
- lib/personal-wizard/engine-continuity-contracts.ts
- lib/personal-wizard/companion-scale.ts
- lib/personal-wizard/simple-book-reviewed-audition.ts
- Focused native/config/admission/sample tests and existing affected wiring assertions
- CURRENT.md, ROADMAP.md and this tracked Decision Gate

## 6. Expected behavior / exceptions

- The opt-in is strict, versioned, fixed to C+D+E, and absent by default. It adds no new cycle, approval, grant or paid allowance. Actual historical claim/outcome consumption still refuses execution.
- The new native mode uses the existing one-initial-attempt bound and a sequential sample, not the legacy full-cohort draw-before-review or its outer post-hoc corrections. It records this choice in the plan. No new repair/continuation authority is invented; historical continuation/recovery may not be upgraded to C/D/E.
- Explicit bound loader flags must reproduce source markers, digests, raw review and all nine compiled packets before image work; unbound or mismatched inputs refuse.
- The early sample contains 1–2 ascending distinct narrative frame IDs. All-abstained evidence halts before every non-sample frame. Bad measured scale, failed identity or another sample HOLD also stops. A valid mixed standing/action sample can proceed without certifying the action frame's standing scale.
- A partial run is preserved truthfully and terminates before later-page correction or narration. It is not full coverage, not a supported book and not product acceptance.
- The final outcome exposes the actual manifest status and scale coverage. A held/diagnostic/unverified manifest cannot be promoted because every individual page passed.
- Model image efficacy and the optional R2-O1/O4 wording/schema debt are outside this milestone.

## 7. Order, validation and acceptance

1. Record topology and sole Codex writer; retain existing independent reports, R17 bytes and financial authority.
2. Add representative failing early-sample tests, preserving the expected red output.
3. Implement the smallest config/binding/admission/sample/outcome changes, with legacy compatibility and refusal paths.
4. Test actual compiled C/D/E source reload and native orchestration with synthetic adapters. Deny provider constructors in the test resolver; do not alias away pure SDK schema helpers. Cover sample stops, positive mixed evidence, measured/identity failures, stale/forged binding, partial outcome and no narration, default/legacy behavior, and rejected historical recovery upgrades.
5. Run relevant full focused suites plus both TypeScript gates and required npx --no-install tsc --noEmit. Do not repeat blind historical full-folder loops; npm run check remains explicitly not declared green unless actually completed. Preserve historical failures/incomplete evidence.
6. Use bounded deliberate broken variants to falsify new tests, restore exact source, and verify unchanged historical bytes. Commit only explicit reviewed paths, freeze exact base/head and source/evidence hashes, then release writer.
7. Give Guy copy-ready PowerShell inspection/push commands and an adversarial read-only Claude brief. No automatic transfer; no self-awarded independent PASS.

## 8. Cost impact

Zero provider/image/audio/book calls and zero provider expense in this milestone. Only local tests/typechecks/fixtures. No keys or .env read. A future LOW visual proof needs a separate exact owner-approved sample, budget, journal/pricing/reservation replay and independently reviewed envelope. No consumed/held grant can be reused.

## 9. Rollback / commit boundary

One focused local green integration commit, or separate focused corrective milestone if validation reveals a real defect. Disable the new config opt-in to retain legacy runtime behavior. Preserve the base and all QA artifacts; a future rollback is a new revert commit rather than reset/cleanup. Nothing pushed.

## 10. Review assignment / owner decisions

Guy's authorization covers this provider-free implementation. No unresolved product choice is required for the conservative sample stop. Claude should try to falsify real flag propagation, raw-packet admission, final book versus page status, sample spending boundary, constructor denial and backward compatibility. Guy will separately decide the later visual proof and budget. No new creative decision or Cowork review is necessary for this wiring milestone.

## 11. Stop-check / do not do

This touches native image orchestration, QA and fallback behavior, so the major-action stop-check applies. It is a general opt-in change, can affect only the new bound mode, spends nothing, and is proved with local adapters. Existing customer production behavior stays unmodified. Do not generate images/books/audio, start a server, read secrets, raise ceilings/thresholds, enable overage, send messages, push/merge/deploy, reset/prune/delete or clean up anything. R17 remains 0/9 held. Resemblance remains 0.70.
