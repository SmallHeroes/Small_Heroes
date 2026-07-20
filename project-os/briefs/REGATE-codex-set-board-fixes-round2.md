# CODEX RE-GATE (round 2) — Set Board NO-GO fixes (`c2b5607c`)

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only static audit + resume/integrity reasoning; cite `files:lines`.
- **Commit:** `c2b5607c` on `feat/chunked-generation` (18 files, +2037/-221). **Diff range `028b3514..c2b5607c`.** Architecture (A+B+C) already ACCEPTED in your prior re-gate; this round verifies only that the 4 P0 + 2 P1 you flagged are closed.
- **Gate type:** **[CODEX-GATE]** — decides whether the offline mint + 5-page proof may begin. No mint/render has happened.

## 2. ORIGIN / CONTEXT
Your re-gate of `028b3514` = NO-GO with 4 P0 + 2 P1. This commit closes them + opts the fox into a board + builds the real mint tool. Cowork pre-verified scope: zero excluded-track LOGIC edits (safety/money/readiness-decision/reader/`set-appearance`); tsc 0; 1929 tests pass.

## 3. VERIFY EACH FIX CLOSED (cite files:lines)
1. **[P0-1] snapshot is the authority, not the env flag.** Confirm in the REAL `chunk-runner.ts` path (not the test): when `mode==='required-v1'`, entry into `set_refs` is gated ONLY on the snapshot + bindings; `isSetIdentityBoardEnabled()` has exactly ONE functional reader — snapshot CREATION (claimed `set-identity-board-stage.ts:172`) — everything else is comments/tests. A resume where the flag went OFF after the snapshot STILL enters `set_refs`. An assertion fires (awaited) before EVERY cover AND page provider call. **⚠️ Gap CC flagged: P0-1 is unit-tested via a REPLICA of `deriveStartingStage`, and the two provider-adjacent asserts are proven by tsc + unit specs, NOT by an executed `runCoverStage` — so verify the real chunk-runner code directly.**
2. **[P0-2] styleId namespace unified.** `boardStyleIdOf(order)` normalizes once and is used in BOTH bind AND assert → mint and live agree by construction. Confirm the two "corrected" fixtures didn't weaken the wrong-style REJECTION test (CC claims the `styleId:'some_other_style'` rejection is preserved; the swap `whimsical_comic_fantasy → pencil_watercolor` was because the former normalizes to the same board post-fix).
3. **[P0-3] fox fails closed without a board + real mint tool.** Both fox locations share `setIdentityId:'set_room_balcony_night'` + `setReference.status:'pending'` → required-identities NON-empty → a render without an approved board fails closed (no false proof). The mint tool does render → sha → content-addressed no-overwrite upload → QA → registry; `--approve` is the ONLY approval path and refuses if `qaStatus!=='passed'`; never auto-approves (`approvedBy/approvedAt` default null).
4. **[P0-4] bytes not swappable.** The storage key includes the SHA as a PATH COMPONENT (different bytes = a physically different object); `noOverwrite` is opt-in so the default `x-upsert` is unchanged (existing uploaders byte-identical); `assertBoardsBoundForRender` re-reads the REAL bytes' sha (`fetchAssetSha256`) before the provider call and on resume, not just contract metadata.
5. **[P1-5] map + manifest can't diverge.** Both the prompt role-map and the `referenceAssets` manifest derive from ONE shared helper (`describeAssembledReferences`) over the ACTUALLY-assembled provider array → child=Image1/set=Image3 is reported correctly in both.
6. **[P1-6] malformed QA fails closed.** A non-array/failed/malformed Board-QA response → `failed`/`error`, never `passed`.

## 4. STILL-OPEN / HONEST GAPS TO ASSESS
- **Gap 1 (above):** the real `runCoverStage`/`processGenerationChunk` resume path isn't executed by tests (no prisma injection seam). Statically confirm the real path is snapshot-gated and the provider-adjacent asserts are on every paid image.
- **Gap 2 (cost):** a board-activated chunk does up to 3 board-object SHA reads (pre-loop + post-bind + provider-adjacent), per-chunk not per-page, zero for legacy/OFF. Acceptable?
- **Gap 3:** registry empty + mint forbidden → the LIVE path is NOT e2e tested; staging+flag-on fails closed at "no approved board" (correct pre-mint). So this re-gate is STATIC; the runtime proof is the 5-page render after GO.
- Bonus fixes to sanity-check: path-traversal (`..`) closed in `safeSegment`; `qaSetIdentityBoardImage` now has coverage (was zero).

## 5. NO-REGRESSION
OFF byte-identical (single flag reader; `x-upsert` default untouched; legacy shorts before any DB/storage dep). 1929 tests pass (1766 pre-existing green). Zero excluded-track LOGIC edits.

## 6. OUTPUT
Verdict **GO / NO-GO to proceed to the offline mint + 5-page proof**, P0/P1/P2 findings as `files:lines`, and an explicit assessment of Gap 1 (real chunk-runner snapshot-gating vs the replica test). If GO, the next spend is: mint ONE fox board → QA → Guy's explicit approval → 5-page staging proof (QA must FAIL on door/railing/window/wall-drift/missing-hash; shots must DIFFER) → then 12 pages.
