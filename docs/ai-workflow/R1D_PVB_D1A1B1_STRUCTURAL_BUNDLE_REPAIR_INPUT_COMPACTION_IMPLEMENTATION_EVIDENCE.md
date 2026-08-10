# R1D-PVB-D1A1B1 Structural-Bundle Repair Input Compaction — Implementation Evidence

Date: 2026-08-10

Base: `b3b38710b65b538ccad24d1f97bffe8ae0ba64e0`

Branch: `codex/r1d-pvb-d1a1b1-structural-bundle-input-compaction`

## Trigger and root cause

The consumed live attempt produced two completed provider responses. The first draft had four typed `out_of_scope_reference` page-action issues. The existing `page_spatial_reference_patch` repaired all four. Complete validation then produced thirteen structural-bundle issues: one recurring-props collection issue and one final-structure issue on each of pages 1 through 12. The planned third call selected `structural_bundle_patch` correctly but was rejected locally by `input_token_ceiling_exceeded` before provider reachability.

Receipt v21 `534f00ea50453f7db8d88b2a2320cedf3d7cd9105f226a48e870a672095befb0` and readiness v19 `65f2c155897da12e88ccbbeebdd1651a712fe3d799a7a7dabe27cdd25ba9e79b` record two provider calls, one repair, zero transport retries, no fallback, aggregate usage `18,160 input / 17,152 cached / 24,675 output / 2,041 reasoning / 42,835 total`, nominal cost `$0.753866`, and conservative cost `$0.939126`. No candidate or downstream authority exists from that consumed attempt.

The structural-bundle output schema, strict response parser, exact-set application and complete revalidation were already correct. The input still repeated full JSON object keys and repeated strings across recurring props, twelve complete page contracts, validation messages and reference authority. The repository already owned a deterministic lossless canonical JSON-domain codec used by page-contract repair. Reusing that codec removes serialization repetition while preserving the exact decoded authority.

## Implementation

- `structural-bundle-repair-prompt/v2` and `structural-bundle-repair-user-prompt/v2` describe and carry the existing repository-owned compact codec.
- The provider-facing input decodes to exactly four keys: `recurringProps`, `affectedPages`, `validationMessages`, and `referenceAuthority`.
- Construction immediately decodes its own bytes and compares canonical JSON equality. Malformed encoding or roundtrip drift fails locally before provider reachability.
- A strict decoder is exported for deterministic tests and fake-provider lifecycle coverage.
- Structural-bundle eligibility, output schema v1, output parser, complete-page/prop exact sets, application, non-target containment and full validation are unchanged.
- Model, Responses API/default tier, prompt content authority outside this lane, schema authority, token/call/repair budgets, timeout, zero transport retries, no fallback, candidate policy and cost ceilings are unchanged.

## Validation

Focused compiler and lifecycle validation:

- `lib/__tests__/structural-bundle-repair.spec.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`
- Result: **3 files / 101 tests PASS**.
- The lifecycle fixture executes an initial spatial-reference repair followed by a twelve-page structural-bundle repair and reaches a completed fake candidate. The existing ceiling assertion proves at least 4,096 conservative units of headroom.

Canonical authority and compatibility validation:

- page-contract codec and prompt-table compaction;
- B0/materialization input, Execution Request, Supervisor, Fresh Readiness, live-request materialization/verification and Structured Outputs compatibility;
- Result: **10 files / 389 tests PASS**.
- Deterministic TypeScript: PASS.
- `git diff --check`: PASS.

Literal repository gate:

- `npm run check` invoked once.
- TypeScript: PASS.
- Resource-intensive phase: **19 files PASS**, valid diagnostic protocol, no timeout/RPC/IPC/reporter/launch/signal/teardown failure.
- Ordinary phase: **271 files** with exactly the six established missing ignored-output fixture failures and no seventh failure.
- The six fixtures remain a separate release HOLD and are accepted only for this bounded local LOW measurement.

## Authority, QA, and exclusions

Implementation cost was `$0`. No credential access, pricing/network/provider call, real B0/Fresh Readiness, canonical preflight, live authoring, candidate, Semantic Reconciliation, Blueprint/Wizard action, image/Vision, render, storage/database, publication, promotion, activation, deployment or production action occurred. Historical live/readiness artifacts remain immutable and non-authorizing. Production remains blocked.

Cloud Ultrareview reported exhausted free quota, and three earlier bounded local Claude review invocations produced no verdict before termination. A later diff-only, no-tools Claude Code review of exact committed range `b3b38710b65b538ccad24d1f97bffe8ae0ba64e0..62c0824d` completed and returned **PASS** with zero BLOCKER, zero MAJOR and one advisory MINOR. It independently verified lossless deterministic encoding, the exact four-key decoded root, pre-provider tamper rejection, unchanged output schema/application/eligibility, the quantitative twelve-page headroom proof, prompt-only v1-to-v2 version movement, unchanged model/budget/retry/fallback/downstream policy and documentation fidelity. Codex records Claude's verdict; it does not self-award it.

The advisory MINOR notes that one `visual-contract-repair-loop.spec.ts` authority expectation uses the correct literal `structural-bundle-repair-user-prompt/v2` rather than the exported constant. Claude classified this as maintenance-only and explicitly non-blocking; it changes neither behavior nor authority. The next operational proof is a newly pushed-head Fresh Readiness and one bounded live attempt; only a valid candidate may proceed to Reconciliation, Blueprint/Wizard qualification and one local `gpt-image-2` LOW portrait-page render.
