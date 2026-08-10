# R1D-PVB-D1A1B1-PRESENTATION-CAPABILITY-GAP-COMPACT-REPAIR-ROUTING — Implementation Evidence

**Base:** `9ac7ef4293cc724dbda72afc21c0fe2481cd494a`

**Implementation commit:** `b83956da`

**Branch:** `codex/r1d-pvb-d1a1b1-presentation-capability-gap-repair-routing`

**Independent QA:** Claude Code PASS for `9ac7ef4293cc724dbda72afc21c0fe2481cd494a..5f10e5f9`

## Implemented result

- Added `PresentationRequirementRepairPatches` v1 with exact closed keys and presentation classes.
- Added safe target projection from exact page-local `mustShow` authority, strict parse/application, compiler-filled values, duplicate/stale/domain guards and a canonical non-target containment proof.
- Routed only homogeneous safe `ActionSemanticCapabilityGapError` sets through `presentation_requirement_patch`; unsafe or unsupported sets retain the prior terminal classification.
- Bound the repair prompt/schema into Visual Contract request v17, receipt v20, readiness v18 and candidate v9.
- Bound the authority through B0 input v8 / manifest+verifier v15, execution materialization input v6/result v9, Supervisor request+readiness v14/result v7 and Fresh Readiness v14. OpenAI authoring evidence is v4. Prior artifacts remain immutable legacy authority only.
- Updated the OpenAI adapter and canonical live request parser; model, tier, reasoning, token/call/cost budgets, timeout, retries, fallback, candidate semantics, Blueprint v4, Wizard and renderer behavior are unchanged.

## Validation

- Direct repair contract: **1 file / 8 tests PASS**.
- Compiler repair loop: **1 / 26 PASS**.
- Source-authority lifecycle: **1 / 62 PASS**.
- Canonical live boundary: **1 / 136 PASS**.
- Canonical launcher: **1 / 30 PASS**.
- B0 materialization: **1 / 34 PASS**.
- B0 verifier: **1 / 45 PASS**.
- Execution Request materialization: **20/20**, with the corrected focused assertion re-run PASS.
- Execution Supervisor: **1 / 34 PASS**.
- Canonical Pre-Live Readiness: **1 / 12 PASS**.
- Workload classifier: **1 / 7 PASS**; canonical inventory is 289, ordinary 270, resource-intensive 19.
- Deterministic `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

The first literal `npm run check` passed TypeScript and surfaced the six established ignored-output fixture failures plus one stale verifier result-shape expectation. The expectation was updated and the verifier passed **45/45** focused. One replacement literal check then passed TypeScript and the entire **19-file resource-intensive phase** at two workers in `100,714 ms`, with valid diagnostics and no infrastructure class. Its **270-file ordinary phase** reported exactly the six established ignored-output failures and no seventh assertion.

The six unchanged release-HOLD failures are `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two `story-read-back-validation.spec.ts` cases. They are not an implementation finding and are not waived for release; they are accepted only for the bounded local LOW measurement.

## Boundaries and limitations

- No credential read/check, pricing/network/provider call, real B0/Fresh Readiness, preflight, live authoring, candidate, Semantic Reconciliation, Blueprint/Wizard run, image/Vision, render, storage/database, publication, deployment or push occurred in implementation.
- External cost is `$0`.
- The compact repair does not prove product or visual quality. It only creates a bounded chance for complete validation to produce a candidate; downstream qualification remains mandatory.
- Codex does not self-award independent technical PASS. Claude Code must review the immutable implementation range.

## Independent QA closeout

Claude Code independently reconciled the clean two-commit immutable range and returned **PASS** with zero BLOCKER and zero MAJOR. It verified exact target identity, compiler-filled values, duplicate/stale/pointer guards, non-target containment, adapter and canonical request parsing, B0 rebuild-and-compare, Supervisor/readiness nullability and digest bindings, fail-closed legacy cutover, two-call candidate lifecycle coverage, and pre-provider schema/prompt tamper rejection. Codex records Claude's verdict; it does not self-award it.

Two non-blocking defense-in-depth limitations remain advisory for the bounded LOW experiment. First, target pointers use the draft page index while final validation resolves the template page by page number; any divergence rejects fail-closed rather than accepting an incorrect candidate. Second, the parser's runtime `beatId` and `sourceEvidenceId` string checks are broader than the strict provider schema, while exact target matching is the decisive apply-side guard. Neither grants product, visual, candidate, Blueprint, Wizard, render or release acceptance, and neither justifies another pre-measurement hardening loop.
