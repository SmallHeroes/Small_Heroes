# R1D Post-Repair Mixed Validation Routing — Decision Gate

**Status:** approved implementation under Guy's standing instruction to continue toward the first QA render without repeated approval pauses
**Base:** `9d0504a78048c7daff2ec5c7b12de17aecb2b532`
**Branch:** `codex/r1d-post-repair-mixed-validation-routing`
**Scope:** general Visual Contract authoring repair routing; no story-, child-, companion-, or page-specific behavior

## Observed behavior and root cause

Two bounded Leo QA authoring attempts each completed an initial provider response and one compact page repair, then stopped as `local_processing_failed / unexpected_local_failure`. The raw provider material was correctly not persisted, so the repository path was investigated through deterministic fixtures and control-flow analysis.

After a compact repair, assembly can expose both a closed Action Semantic capability gap and a non-page-local final structural failure. `compileBookVisualContractTemplate` catches that combination as `PresentationStructuralValidationError`. When the existing combined page-local repair planner returns no page-only plan, the catch currently rethrows the nested `InvalidTemplateContractError`. That throw escapes the bounded compiler repair loop and reaches the lifecycle's generic local-failure boundary. The existing full-draft repair route is therefore never offered even though one authorized repair call remains.

## Architectural decisions

1. Preserve the closed validation taxonomy and keep all deterministic validation inside the compiler's bounded repair loop when the failure is repairable draft material.
2. Keep the existing compact presentation/page repair route unchanged when every diagnostic is safely page-local.
3. When a presentation-capability gap is mixed with structural diagnostics that cannot form one page-local repair authority, retain both typed diagnostic sets and select the existing `full_draft` repair route.
4. Do not introduce a new fallback, retry, repair mode, schema, prompt, model, service tier, timeout, or budget. The maximum remains one initial call plus two repairs.
5. Continue to throw `ActionSemanticCapabilityGapError` when the gap has no valid presentation-requirement target; the correction must not turn a closed capability gap into an open-ended repair.
6. Unknown local exceptions, malformed repair responses, provider/transport failures, and exhausted attempts remain terminal and fail closed.
7. Receipt diagnostics must show the first compact page failure, the newly exposed mixed structural/capability issues, the selected full-draft repair, and either a fully revalidated candidate or the exact existing terminal classification.
8. Existing receipts, readiness artifacts, and consumed live attempts remain immutable historical evidence. A successful future live attempt requires new Fresh Readiness and a new Execution Request.
9. The implementation is accepted technically only after deterministic regression coverage, focused validation, TypeScript, the repository gate, and independent Claude Code adversarial QA. Product/visual acceptance still requires Guy to inspect the later three-page LOW proof.

## Expected behavior

Given an initial draft with a page-spatial defect that masks a later combination of a repairable presentation gap and a non-page-local structural defect, the first response receives the existing compact page-spatial repair. After that patch, the compiler records the mixed typed diagnostics and spends the final authorized repair as the existing full-draft repair. A valid third response produces a candidate. No error escapes as the generic `local_processing_failed` fallthrough.

## Validation and acceptance criteria

- Add one direct regression reproducing the exact post-compact-repair sequence and proving repair modes `[initial, page_spatial_reference_patch, full_draft]` with three logical calls and two repairs.
- Assert the final candidate passes full validation and the intermediate receipt remains sanitized.
- Preserve the existing page-local combined repair, compact spatial repair, presentation repair, action-gap terminal, repair-exhaustion, and malformed-output tests.
- Run the focused compiler/lifecycle suites, deterministic TypeScript, `git diff --check`, and one repository gate.
- Treat the six established ignored-fixture failures as the existing separate release HOLD; any new assertion or infrastructure failure stops the milestone.

## Cost and external boundaries

The implementation and validation spend `$0`: no credential access, provider call, Fresh Readiness, preflight, live authoring, image generation, render, storage/database write, deployment, or Production action. After independent technical PASS, the next separately evidenced operational step may rematerialize Fresh Readiness and attempt exactly the already authorized three-page gpt-image-2 LOW QA proof.

## Rollback

Revert the focused implementation commit. The prior behavior then returns unchanged; all historical artifacts remain byte-identical. No data migration or persisted-authority rewrite is involved.

## Rejected alternatives

- Retrying either exhausted live attempt: violates consumed authority and would not correct the local routing defect.
- Increasing calls, timeouts, or budgets: unnecessary and outside the approved policy.
- Treating the mixed failure as page-local: would create incomplete repair authority and weaken fail-closed validation.
- Special-casing Leo or either live repair payload: violates the general-system requirement and cannot be justified from sanitized evidence.
- Persisting raw provider responses for debugging: violates credential/provider-material boundaries.

## Stop-check

This is a general production-code correction to authoring repair routing, not a story patch. It can affect any Story Source whose compact repair exposes mixed validation, so regression breadth and independent QA are required. It spends no money. The smallest product validation after technical PASS is the already approved three-page Leo LOW sample; no full-book render is authorized by this gate. Claude Code must attempt to falsify the bounded-call invariant, retained fail-closed terminals, diagnostic sanitization, and absence of story-specific literals.
