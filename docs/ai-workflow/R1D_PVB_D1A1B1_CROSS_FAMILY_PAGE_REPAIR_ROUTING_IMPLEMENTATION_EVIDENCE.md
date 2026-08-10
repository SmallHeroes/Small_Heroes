# R1D-PVB-D1A1B1 Cross-Family Page Repair Routing — Implementation Evidence

**Base:** `824e8b3acb0c64e9220bd44542c6821553cd284d`
**Branch:** `codex/r1d-pvb-d1a1b1-cross-family-page-repair-routing`
**Status:** local implementation green; independent QA pending.

## Change

- `assembleTemplateFromDraft` now runs the unchanged final template validator before emitting a closed capability-gap error.
- A private typed bridge preserves both the exact capability gaps and the original typed structural error without prose parsing or persistence.
- `pageContractPresentationStructuralRepairAffectedPages` accepts only exact presentation targets plus a fully page-scoped final-structure set, creates the deterministic page union and rejects malformed/duplicate/unlocatable authority.
- The existing complete-page response schema and exact-page application boundary are reused. Page-contract prompt authority advances to v9 solely to describe the new closed target.
- No Story Source, model, initial prompt/schema, token/call/cost budget, timeout, retry/fallback policy, candidate semantics or downstream behavior changed.

## Validation

- Direct route/planner/compiler/lifecycle: 4 files / 174 tests PASS.
- Diagnostic census and adjacent focused regression: 4 files / 127 tests PASS.
- Canonical Writer/materialization/Supervisor/Fresh Readiness boundary: 7 files / 269 tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- One literal `npm run check`: resource phase 19/19 files PASS with valid diagnostics. Ordinary phase reported the six established missing ignored-output fixtures and one new AST producer-census mismatch. The mismatch came from an unnecessary new fallback `InvalidTemplateContractError`; the final implementation rethrows the original typed structural error, and the exact census regression passes. The literal gate was not rerun.

The decisive regression starts with an out-of-zone action reference, an unsupported presentation record and an invalid page camera. It proves call 2 is the existing field-scoped spatial patch, call 3 is one complete-page patch containing both exact target families, and complete validation returns a candidate. Under the prior ordering, the presentation repair would consume call 3 and final structure would exhaust the budget.

## Boundaries and rollback

Implementation cost `$0`. No credential, pricing/network/provider call, real B0/Fresh Readiness, preflight, live authoring, render, image/Vision, storage/database, Board, approval, publication, deployment or production action occurred. Production remains blocked. The six historical missing fixtures remain a separate release HOLD and receive no launch waiver. Rollback is the single implementation commit; every prior content-addressed artifact remains immutable.
