# #6-fix-3 checkpoint — regen-rescue reserve→mark→clear→dispatch (Codex-ratified). For Codex gate → #7-a CLOSED.

**Branch:** `feat/chunked-generation`. **Commit:** `0e7e2eb6` (Part A). **Flag:** `READINESS_MANIFEST_ENABLED` OFF. **Renders:** 0.
**Gate:** `npm run check` green (tsc clean; 1055 pass — the lone failure is the pre-existing flaky `env-separation-guard`
network test, passes in isolation 9/9). **No schema change.** (Part B #35 = commit `d1b2bd89`, separate, below.)

## The 3 Codex blockers — applied EXACTLY per the ratified design
Design: **ATOMICALLY reserve → mark durable regen-pending → clear asset (ONE tx) → THEN dispatch.** A non-start
(started:false) stays RETRYABLE from the durable marker (never a destroyed-asset refund).

- **BLOCKER 1 (fail-open):** the recovery `FALLBACK_QA_CONTEXT` was strict on `expectsChild` but LENIENT on
  companion/time-of-day/crib/family/emotional → a re-QA of a missing-evidence row could PASS a page actually missing
  its required companion. **FIX:** `persistQualityContext` (`quality-evidence-producer.ts`) binds the EXACT 7-axis
  qaContext ATOMICALLY WITH the delivered asset — called INSIDE the chunk-runner page tx (`~1387`) and cover tx
  (`~901`), inside `withDeliveryInputMutation`. If the asset exists, its real requirements exist too → the missing-row
  window is CLOSED. `reQaUnknownQualityEvidence` no longer fabricates a lenient context: a genuinely context-less row
  is pushed to `stillUnknown` (fail-closed → recommit BLOCKS → recovery/refund), the evaluator is never called.
  `persistQualityContext` writes ONLY the merged `evidence` JSON (never verdict/assetSha256/regenCount → budget preserved).

- **BLOCKER 2 (budget not consumed):** the old rescue only checked `regenCount`; the in-loop reserve fired only if the
  RE-RENDER failed, so a rescue whose redrive passed in-loop consumed 0 budget. **FIX:** `reserveMarkAndClearRegen`
  (`clear-page-images-for-regen.ts`) reserves the durable budget ITSELF (conditional `updateMany WHERE regenCount<budget
  → increment`) BEFORE clearing; `granted:false` when spent → NOT cleared → stays failed-terminal → recommit →
  quality_failed → refund. "≤ QUALITY_REGEN_BUDGET (2) then refund" is now enforced at the rescue level regardless of
  in-loop behavior. The shared durable regenCount (also bumped by the 5b in-loop reserver during a redrive) is capped by
  the conditional increment, so total in-loop+rescue replacements never exceed the budget.

- **BLOCKER 3 (destructive clear before scheduling):** old order cleared THEN dispatched; started:false left the asset
  gone with no retry → refund of a recoverable page. **FIX:** reserve + set `evidence.regenPending` + clear commit in
  ONE tx BEFORE dispatch (reserve-before-clear: a spent budget never destroys the asset). `loadRegenPendingArtifacts`
  returns every still-`regenPending` artifact; the processor re-dispatches them each tick, so a `started:false` redrives
  again next tick. A re-dispatch of an already-pending artifact does NOT re-reserve (only NEW `nowFailed` reserve → no
  double-spend). The marker is cleared when the re-rendered bytes are re-QA'd (persist overwrites evidence). A persistent
  non-start is bounded by `EXCEPTION_MAX_RECOVERY_ATTEMPTS` → refund.

## Files (Part A, 9)
`quality-evidence-producer.ts` (persistQualityContext) · `chunk-runner.ts` (2 seams) · `clear-page-images-for-regen.ts`
(reserveMarkAndClearRegen; clears INLINED in the barrier callback so the delivery-input-writer-coverage guard passes) ·
`quality-recovery.ts` (fallback removed + loadRegenPendingArtifacts) · `exception-processor.ts` (rescue reorder + deps
`reserveMarkAndClearRegen`/`loadRegenPending`, dropped `clearPageAssets`/`clearCoverAsset`) · +4 specs.

## Tests (production path, NOT mock counters)
- `reserve-mark-clear-regen.spec.ts` (NEW): the REAL `reserveMarkAndClearRegen` against a fake tx with a REAL
  conditional-increment store — regenCount 0→1→2 granted, 3rd DECLINED, marks regenPending (preserving qaContext),
  clears page/cover; budget-spent → NO clear; flag-off / malformed-key → no-op.
- `quality-recovery.spec.ts`: missing-context row NEVER re-QA'd under a lenient context (stillUnknown); a row with
  `expectsCompanion` → re-QA'd against the REAL requirement → companion-missing FAILS (not a lenient pass).
- `exception-processor.spec.ts`: the RESCUE (not the redrive) advances the durable budget → failed×2 → recommit at
  budget (quality_failed, NOT the attempts-cap no-op); started:false stays retryable from the marker; next tick
  re-dispatches a pending artifact WITHOUT re-reserving; attempts-cap → refund.
- `quality-evidence-producer.spec.ts`: persistQualityContext creates/merges the real context without touching
  verdict/regenCount; flag-off / no-context → no-op.

## Claude re-verify (ultracode, 4 lenses × refute-by-default, 8 agents) — CLEAN
**4 candidates → 4 CONFIRMED (all info-level POSITIVE PASS), 0 uncertain, 0 refuted, 0 actionable defects.** Every lens
confirmed against the actual source: (b1) fallback gone + evaluator never called for a context-less row + 7-axis atomic
bind at both seams + update preserves the budget; (b2) rescue reserves the durable budget itself before clearing, capped,
budget-driven refund before the attempts cap; (b3) non-start retryable from the marker, no destroyed-asset dead-end,
bounded to refund; (no-reg) flag-off byte-identical, no unprotected writer, no broken caller, no new fail-open.

## Order
Part A committed → Claude re-verify (DONE, clean) → **Codex gate** → #7-a CLOSED. Flag stays OFF. Push from your terminal.

---
## Part B — #35 (commit `d1b2bd89`, SEPARATE, light review)
Bundle the Style01 multi-view companion sheets (`public/companions/<id>/style01-sheets/**` — 42 png + 7 manifest.json,
NO URL fallback: `resolveStyle01CompanionReferencePaths` does existsSync→readFileSync on the function disk) into the 5
render routes via `outputFileTracingIncludes`. **Also narrowed** the generation-route companions exclude from
`public/companions/**` to `public/companions/**/*.jpg` — because Next 15 applies `outputFileTracingExcludes` to the
combined set AFTER includes (`collect-build-traces.js:496-513`), so the broad glob would have DELETED the just-included
sheets. Verified with picomatch under posix (Vercel) semantics: `.png`/`.json` sheets survive, `.jpg` source refs stay
excluded, all 49 sheet files resolve. LEAN_ROUTES + dev/story-bank still exclude all of `public/companions`.
**OPS (staging, not committed):** unset `ALLOW_SINGLE_IMAGE_COMPANION_REF` so the render uses the multi-view anchor.
Full bundle verification needs a `next build` on deploy.
