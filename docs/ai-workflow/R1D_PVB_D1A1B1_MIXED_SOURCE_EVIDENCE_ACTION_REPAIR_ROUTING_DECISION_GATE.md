# R1D-PVB-D1A1B1 Mixed Source-Evidence / Action Repair Routing — Decision Gate

Status: APPROVED FOR IMPLEMENTATION under Guy's standing authorization to continue autonomously to a QA Wizard LOW proof.

Base: `0285df438bd5a8bbcbd9db7563ab0778f50e4599`

## 1. Proposed change

Preserve the compiler-produced `SourceEvidenceIdRepairAffectedRecord` authority when malformed Source Evidence IDs and their dependent action-semantic diagnostics are reported through `ActionSemanticCoverageValidationError`. Route the first bounded repair through the existing `source_evidence_id_patch`; after full deterministic revalidation, route any newly proven closed-catalog capability gap through the existing `presentation_requirement_patch`.

## 2. Why now?

The post-canonical-spatial live attempt completed three provider responses but produced no candidate. Its initial draft contained two malformed Source Evidence IDs and one dependent `disposition_payload_invalid`. Repository tracing proved a two-link cause: the unresolved valid `unsupported/closed_action_catalog_gap` record first emitted that misleading dependent diagnostic and triggered an early generic validation throw; after removing that false diagnostic, the later exact `coverage_missing` wrapper still discarded the compiler-owned affected-record authority. Either link selected destructive `full_draft`. That call resolved the original three diagnostics but introduced a new action-binding failure, and the final page-contract repair expanded the draft to 158 emitted diagnostics.

## 3. Scope

General compiler error-provenance and repair-routing correction for every Story Source. No story, child, companion, page, authored value, source phrase, or provider-output literal is special-cased.

## 4. Risk of hardcoding

Low. The change carries only typed compiler-owned affected records that already pass the closed Source Evidence repair contract. The repair itself remains exact-ID-only, deduplicated, non-mutating and fail-closed. No prose parsing, fuzzy match, or inferred repair authority is introduced.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`
- `CURRENT.md`
- implementation evidence under `docs/ai-workflow/`

## 6. Expected behavior after change

Nine architectural decisions:

1. Typed Source Evidence affected-record authority survives every compiler error wrapper that also carries its diagnostics.
2. `source_evidence_id_patch` retains first priority only when exact affected-record authority exists and every co-reported action-semantic diagnostic is the causal `coverage_missing` consequence of an unresolved valid `unsupported/closed_action_catalog_gap` record. Independent semantic failures keep their existing route.
3. The patch changes only the targeted coverage `sourceEvidenceId`; predicate, object, spatial effect, disposition, page order and unrelated draft surfaces remain unchanged.
4. Full deterministic compilation and validation always run after the compact patch; no semantic diagnostic is suppressed or declared resolved by routing alone.
5. A valid repaired ID may reveal a genuine closed-catalog capability gap, which is handled only by the already-authorized `presentation_requirement_patch` and within the same two-repair budget.
6. An independent semantic or structural error that remains after the ID patch continues through its existing route or fails closed; the ID patch is not a waiver.
7. Raw prompts, responses, provider messages, source phrases, authored IDs, stacks and secrets are not added to receipts/readiness or compact prompts.
8. Model, schemas/prompts, 64K ceiling, `[40000,32000,36000]` output schedule, call/repair budget, timeout, transport retry/fallback policy and `$5` fence remain unchanged.
9. Artifact schemas/versions, candidate semantics, Blueprint/Wizard gates and historical artifacts remain unchanged.

## 7. Validation plan

- Add one end-to-end lifecycle regression whose initial draft contains a malformed Source Evidence ID and the dependent unsupported-disposition diagnostic.
- Prove the exact repair sequence `[initial, source_evidence_id_patch, presentation_requirement_patch]` and a completed candidate in three calls.
- Prove the source patch prompt excludes whole-book authority and that only the targeted ID changes before the second revalidation.
- Preserve direct source-ID repair, presentation repair, invalid-patch, deduplication, tamper and exhaustion tests.
- Run the focused lifecycle slice, deterministic TypeScript, `git diff --check`, and one repository gate after focused PASS.
- Obtain independent Claude Code adversarial PASS before push.

## 8. Cost impact

Implementation and validation cost `$0`. A later Fresh Readiness and one bounded live attempt may spend only under the unchanged existing `$5` hard cap. No provider or render call is authorized by this implementation milestone.

## 9. Rollback plan

Revert the focused implementation commit. No artifact rewrite, schema downgrade, data migration or downstream rollback is required.

## 10. Review assignment

Claude Code must try to falsify provenance preservation, exact repair ordering, non-target immutability, sanitization, fail-closed behavior and unchanged budgets/policies. Guy retains product and visual acceptance of any later render.

## 11. Stop-check and exclusions

- General fix: yes.
- Production behavior affected: authoring repair routing only; production deployment remains excluded.
- Smallest proof: one deterministic mixed-error fixture and existing focused suites.
- No credentials, pricing/network/provider call, Fresh Readiness, preflight, live authoring, image/Vision, render, storage/database, deployment or push during implementation.
