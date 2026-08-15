# R1D-PVB-D1A1B1 — Terminal Reference Cleanup Budget Implementation Evidence

## Status

Implemented locally and ready for independent Claude Code QA. Codex does not
self-award technical PASS.

- Branch: `codex/r1d-pvb-d1a1b1-terminal-reference-cleanup-budget`
- Worktree: `C:\Users\guyna\.codex\worktrees\cleanupbudget1\Small_Heroes`
- Exact base: `a620ed5485d6f08047759773870d9fcc90d6449b`
- Code commit: `5923a853`
- Provider/credential/render cost: `$0`
- Push/deployment: none

## Problem proven

The prior bounded live authoring flow completed its normal three logical calls:

1. initial authoring;
2. a compact page-spatial repair;
3. a `full_draft` repair required by the mixed residual.

The third response resolved the mixed failure and left only repairable
page-spatial out-of-scope references. The existing compact repair already knew
how to resolve this class, but the standard one-initial-plus-two-repair budget
was exhausted. Treating the state as a general retry would weaken the bounded
policy; treating it as terminal forever prevents the existing closed repair
from finishing the draft.

## Implemented contract

The normal budget is unchanged:

- standard calls: `3`;
- standard repairs: `2`;
- standard input ceiling: `64,000` tokens;
- existing normal output ceiling, model, tier, reasoning and timeout unchanged.

One separate budget class now exists:

- class: `terminal_reference_cleanup`;
- maximum calls/repairs: `1/1`;
- input/output ceiling: `6,000/2,000` tokens;
- preceding repair mode: exactly `full_draft` on attempt 3;
- cleanup repair mode: exactly `page_spatial_reference_patch`;
- residual: non-empty and exclusively compiler-typed page-action reference
  issues with `draft_contract/out_of_scope_reference` persisted identity;
- no fifth call, retry or fallback.

Compiler routing uses the closed page-spatial target detector on the current
attempt. Persisted receipt/readiness validation separately requires the exact
typed residual identity and structural locator on attempt 3. This separation is
intentional: the lifecycle callback cannot receive attempt-3 compiler
diagnostics until compilation returns, while the compiler owns eligibility at
dispatch time and the receipt owns durable post-hoc proof.

The fourth call reuses the established strict patch contract: exact affected
pages/fields, compiler-owned permitted identifiers, duplicate and unexpected
patch rejection, masked non-target equality and input nonmutation.

## Budget proof

The request reserves each standard call with the standard token ceiling and the
cleanup separately at `6,000/2,000`. Static conservative maximum:

- standard sequence: `$4.884`;
- compact cleanup increment: `$0.10725`;
- combined maximum: `$4.99125`;
- hard ceiling: `$5.00`.

Runtime reservation recomputes remaining standard and cleanup exposure from
completed attempts and rechecks the hard ceiling before each dispatch. Provider
usage validation applies the correct per-call token envelope. A 13-page request
remains inadmissible under the current policy.

## Authority and migration

Current versions:

- authoring policy: `visual-contract-authoring-policy/v3`;
- authoring request/receipt/readiness: `v20/v23/v21`;
- live materialization input/manifest/verification: `v9/v18/v18`;
- Supervisor request/readiness/result: `v17/v17/v9`;
- live execution materialization input/result: `v8/v12`;
- canonical Fresh Readiness evidence: `v17`.

Immediate predecessor authoring artifacts (`v19/v22/v20`) remain recognized
only as historical immutable evidence. They cannot authorize a new attempt.
No historical artifact was rewritten or re-digested.

## Production files changed

- `lib/visual-contract-compiler/authoringPolicy.ts`
- `lib/visual-contract-compiler/compileBookVisualContract.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- `lib/visual-package/canonicalLiveVisualContractAuthoring.ts`
- `lib/visual-package/liveRequestMaterialization.ts`
- `lib/visual-package/canonicalPreLiveReadiness.ts`
- `lib/visual-package/liveExecutionSupervisor.ts`
- `lib/visual-package/liveExecutionRequestMaterialization.ts`
- `scripts/visual-contract-authoring.ts`

Test files changed:

- `lib/__tests__/draft-reference-domain-hardening.spec.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts`
- `lib/visual-package/__tests__/canonical-pre-live-readiness.spec.ts`
- `lib/visual-package/__tests__/live-execution-request-materialization.spec.ts`
- `lib/visual-package/__tests__/live-request-materialization.spec.ts`
- `lib/visual-package/__tests__/live-request-verification.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`

## Regression coverage

Positive path:

- initial page-spatial failure;
- standard page-spatial compact repair;
- mixed residual routed to standard `full_draft`;
- reference-only attempt-3 residual;
- one `terminal_reference_cleanup` patch call;
- valid candidate without input mutation.

Fail-closed and tamper paths include:

- non-reference or mixed residual after attempt 3;
- wrong preceding repair mode;
- wrong attempt position, budget class, repair mode or ordering;
- malformed/invalid cleanup patch and explicit no-fifth-call proof;
- cleanup input over 6,000 and output over 2,000;
- missing/extra nested request policy fields;
- duplicate/count/diagnostic locator drift in receipt/readiness;
- projected cost and reservation drift;
- legacy version use as current authority.

## Validation evidence

Dependency preparation was isolated and offline:

- `npm ci --offline --ignore-scripts`: PASS;
- local deterministic Prisma generation: PASS;
- no network fallback.

Focused validation:

- ordinary phase: 3 files, 143 passed and one stale string expectation failed;
- resource-intensive phase: 8 files, 324/324 PASS with clean diagnostics;
- correction: the stale expected receipt message was advanced from `v19` to
  current `v23`;
- direct corrected regression: 1/1 PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

The single authorized literal `npm run check` was run exactly once:

- both TypeScript contracts: PASS;
- ordinary: 281 files; 260 passed, 16 skipped, 5 failed files; 3,165 tests
  passed, 65 skipped and exactly 6 failed;
- all six failures are the established missing ignored-output fixtures:
  `set-appearance-ref-budget` (1), `story-read-back-validation` (2),
  `page-entity-qa` (1), `child-lexicon-ages-5-8` (1), and
  `momentum-gate-koko` (1);
- resource-intensive: 19/19 files and 571/571 tests PASS;
- both diagnostic protocols valid; resource phase had no diagnostic failure
  class and no timeout/RPC/IPC/reporter/launch/signal/teardown failure.

The six fixtures remain a separate release HOLD. They are not caused by this
range and are not waived for release.

## Unchanged surfaces and exclusions

No story, child, companion, page or authored identifier literal participates in
production routing. Prompts, provider response schemas, model, service tier,
reasoning, standard token budget, timeout, transport retries, fallback,
candidate semantics, Blueprint, Wizard, Reader, renderer, resemblance gate,
payment, storage/database and Production state are unchanged.

No credential access, pricing lookup, provider/network call, Fresh Readiness,
canonical preflight, live authoring, image/Vision, render, storage/database,
Board, approval, publication, promotion, deployment or push occurred.

## Rollback

Before any new authority is consumed, revert the implementation and
documentation commits. After a v20/v23/v21 authority is consumed, retain its
artifacts as historical immutable evidence and place authoring on HOLD; never
reclassify or rewrite them as predecessor authority.

## Independent QA targets

Claude Code should try to falsify:

1. The normal three-call/two-repair policy is unchanged in behavior.
2. Call four is reachable only after attempt-3 `full_draft` and an exclusively
   repairable, non-empty page-reference residual.
3. The cleanup uses only the existing strict page-spatial patch authority.
4. Mixed/non-reference residuals, malformed output and cleanup failure cannot
   produce a fourth/fifth unauthorized call or candidate.
5. Static and runtime cost/token gates cannot exceed `$4.99125/$5.00` or use the
   standard 64K envelope for cleanup.
6. Receipt/readiness/candidate persistence rejects order, class, mode, count,
   diagnostic, digest and legacy-version tampering.
7. Every canonical authority surface cut over together and predecessors remain
   immutable historical only.
8. No story-specific literal, raw prompt/response/provider body/stack/secret or
   new external capability was introduced.
9. The code range is focused and the recorded validation is faithful.
