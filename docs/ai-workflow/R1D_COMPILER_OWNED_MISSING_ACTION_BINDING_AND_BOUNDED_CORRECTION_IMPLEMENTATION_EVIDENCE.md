# R1D Compiler-Owned Missing Action Binding and Bounded Correction — Implementation Evidence

**Date:** 2026-08-19

**Decision Gate:**
`R1D_COMPILER_OWNED_MISSING_ACTION_BINDING_AND_BOUNDED_CORRECTION_DECISION_GATE.md`

**Base:** `5d7a818e4ae7bf715bd2c83046a1249569404392`

**Implementation commit:** `5a9ea30b`

## Outcome

The exact mechanical missing-binding class observed in the consumed eight-page
live attempt now closes locally before the first draft assembly. No provider
route, prompt or schema receives authority to invent the record.

An eligible action must be the sole owner of a valid page-scoped beat, carry an
exact `source_phenomenon` subject with canonical same-page Source Evidence, and
have zero existing same-beat coverage records of any disposition. The
normalizer preserves every action and existing coverage byte and appends one
exact `action_requirement` record. It is deterministic, idempotent, clone-first
and independently versioned from the existing duplicate-component identity.

PageContract correction is now genuinely bounded by one shared allowance. One
scope-invalid response may use the existing closed correction hint, or one
incomplete set may reuse the same authority. After either path consumes the
allowance, the next rejection of either class becomes the existing sanitized
`repair_output_invalid` terminal after call 3 rather than repeating through
call 7. A rejected first response followed by a valid second response still
completes.

Independent QA found that the initial implementation bounded the two failure
classes separately, permitting an alternating sequence to reach call 4. The
QA-fix adds one shared session flag, resets it only after a successful atomic
PageContract apply, and proves both `incomplete -> scope-invalid` and
`scope-invalid -> incomplete` terminate at call 3. Claude also requested a
page-beat postcondition and broader idempotence assertions; both were added.

## Consumed live evidence

The output root
`outputs/r1d-collect-all-eight-page-readiness-5d7a818e-20260818T201855197Z`
is immutable and was not reused. Its v46 receipt
`0247a55b738408e63e1a677cc46bdf20892def4f08c46b53a366ad9196054619`
records seven completed calls, six repairs, zero transport retries, no fallback
and terminal `page_contract_repair_action_binding_scope_invalid` with no
Candidate. Attempts 1 through 6 have the same complete normalized 27-issue
census and fingerprint. Four pages contain the paired
`action_coverage_cardinality_invalid` and `action_binding_missing` identities.

The persisted artifacts do not contain provider response bodies, so this
milestone does not claim field-level reconstruction of calls 2 through 6. It
fixes the source-proven inability of the PageContract applier to insert the
fully determined missing row and independently bounds repeated rejected output.

## Changed surfaces

- `lib/visual-contract-compiler/actionBindingComponentNormalization.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- focused pure/compiler/harness/lifecycle tests
- Decision Gate, this evidence and `CURRENT.md`

Unchanged: prompts, provider schemas, policy v17, output budget v6, model,
service tier, reasoning, prices, timeout, call caps, retry/fallback behavior,
Candidate v9, Wizard bridge v2, Reader, Story Source and render behavior.

## Validation

- six focused files after the QA fix: **222/222 PASS**;
- source lifecycle included current receipt/Candidate persistence and both
  successful and terminal bounded-correction paths;
- `npx --no-install tsc --noEmit`: **PASS**;
- `git diff --check`: **PASS**;
- literal `npm run check`: TypeScript and autonomous-story typecheck passed;
  ordinary phase ran **3,303 PASS / 65 skipped** with only the five established
  ignored-`outputs/` fixture ENOENT failures; resource-intensive phase ran
  **609/609 assertions PASS** and then reported the established Vitest
  `onTaskUpdate` RPC timeout. No retry was made and no new product-code failure
  appeared.

The failed repository exit is recorded, not relabeled green. The focused
authoring proof is independently reproducible without the absent historical
output fixtures.

## Cost and external effects

Implementation and tests made no credential, provider, Fresh, live, image,
Vision, storage/database, deployment or render call. External generation cost
was `$0`. One attempted local `npx prettier --write` was cancelled by npm
because Prettier was not installed; no package was installed and package/lock
files were unchanged.

## Independent QA result

The first split read-only audit returned PASS for the local normalizer with no
BLOCKER/MAJOR and three defense-in-depth MINORs. The second audit found one
valid BLOCKER in alternating correction classes. QA-fix commit `c7b26e47`
closed the BLOCKER and all three MINORs. Claude Code then re-gated
`ece3ff44865116e34d6bc2372000d9677550045f..c7b26e47` read-only and returned
**PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It explicitly confirmed both
alternating orders stop at call 3, the allowance resets only after successful
atomic apply, terminal evidence remains truthful and no policy, prompt,
schema, budget or version drift exists.

Guy's explicit authorization permits push after this independent PASS. Fresh,
provider, Candidate, Wizard and render remain subject to their canonical
current-head gates.
