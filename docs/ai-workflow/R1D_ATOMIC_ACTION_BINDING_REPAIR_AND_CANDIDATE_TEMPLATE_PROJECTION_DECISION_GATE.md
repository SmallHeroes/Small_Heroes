# R1D Atomic Action-Binding Repair and Candidate Template Projection — Decision Gate

**Date:** 2026-08-17
**Status:** approved for implementation under Guy's standing authority to continue to a QA Wizard LOW proof
**Base:** `b2ebdf8aa57dc588cdab4a56cbce96132b511999`
**Branch:** `codex/r1d-atomic-action-binding-repair-template-projection`

## 1. Proposed change

Correct two general blockers discovered by the consumed post-bridge live attempt:

1. Treat every duplicate action-beat binding as one closed action↔coverage component during page-contract repair. The component authority may make the minimum exact 1:1 beat binding closure, including the exact coverage deficit required by that component, while preserving action semantics, Source Evidence identities and every non-target field.
2. After the canonical Supervisor boundary produces a validated Visual Contract candidate, have the QA Wizard bridge deterministically project `candidate.template` into a contained, content-addressed bare template artifact. The bridge, not an operator-supplied file, owns that projection.

## 2. Why now?

The live attempt completed three provider calls and two repairs without a candidate. It stayed below every input and cost fence, so neither provider transport nor the 64K ceiling was causal.

The initial 11 cardinality diagnostics contained three 2-actions→1-coverage components. The repair planner exposed scalar action/coverage locators, and the applier changed a targeted action `beatId` without authority to create the missing matching coverage record. One action remained orphaned in each component, consuming the second repair. Once those three issues closed, 19 already-present surface issues became visible after the standard budget was exhausted.

Separately, live authoring persists a candidate envelope, while the production reconciliation builder requires a bare Visual Contract template. The selected Dini story has no tracked template, and manual extraction would violate the no-manual-authority-injection boundary.

## 3. Scope

This is a general compiler/repair-authority and QA-bridge change. It is not specific to Dini, one story, one page, one child, one companion or one provider response.

## 4. Nine architectural decisions

1. **Closed component identity.** Component membership is derived only from validated current page indices and one original page-scoped `beatId`; no prose parsing, fuzzy matching, authored free-form locator or story literal may create authority.
2. **Minimum writable closure.** A component repair may change only member action `beatId` values, member action-requirement coverage `beatId` values, and append exactly the component's coverage deficit. It may not change action bodies, existing Source Evidence IDs, non-target coverage records, page order or other page fields.
3. **Exact 1:1 acceptance.** The complete repaired component must contain one unique valid page-scoped beat per member action and exactly one `action_requirement` coverage record per resulting beat. Missing, extra, duplicate, reordered, stale or semantically drifted records fail closed.
4. **No policy expansion.** The standard budget remains one initial call and two repairs with `[40,000, 32,000, 36,000]`; the optional cleanup remains narrow and unchanged. There are zero transport retries, no fallback and a hard `$5.00` ceiling.
5. **Full deterministic revalidation.** The normal compiler reruns after application. When action cardinality closes, the existing `book_surface_patch` route owns any newly visible closed presentation/cover/page/lifecycle family. No issue is waived or relabeled.
6. **Legacy route preservation.** Existing scalar action-coverage, coverage-action, represented-elsewhere, spatial, presentation and `target_scope_invalid` behavior remains fail-closed and regression-covered. Mixed or non-closed identities do not gain component authority.
7. **Bridge-owned projection.** A canonical candidate is the sole source of the bare template projection. Its bytes are canonical JSON, its filename is the candidate's `templateDigest`, and the bridge manifest binds candidate path/digest to projection path/digest/schema.
8. **Contained immutable persistence.** Projection persistence uses the existing contained content-addressed store with regular-file, unique-link, realpath and collision protections. Missing, wrapper-as-template, arbitrary external, tampered, cross-candidate and alias paths are rejected.
9. **Versioning and cutover.** Page-repair prompt/user-prompt/input authority is bumped only where its bytes or closed target shape changes; the complete-page output schema remains v2. The bridge manifest version is bumped for the new projection binding. Historical receipts, candidates and bridge manifests remain immutable; a new pushed HEAD, Fresh Readiness and Execution Request are required before another live attempt.

## 5. Expected files

- `lib/visual-contract-compiler/pageContractRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts` only if routing/closure verification requires it
- focused compiler and lifecycle specs under `lib/__tests__/`
- `lib/visual-package/qaWizardCandidateBridge.ts`
- `scripts/qa-wizard-candidate-bridge.ts` if the request/CLI contract changes
- `lib/visual-package/__tests__/qa-wizard-candidate-bridge.spec.ts`
- canonical authority validators/tests only when required by an actual version cutover
- `CURRENT.md` and implementation evidence

## 6. Expected behavior

For the observed topology, call 2 repairs all four action-binding components atomically. Full validation then exposes the latent closed book-surface family, and call 3 uses the already-existing book-surface repair. A valid response can therefore produce a candidate within the unchanged standard budget.

After candidate persistence, bridge preparation creates and verifies the bare template projection itself and can reach the exact reconciliation-content checkpoint without operator-authored template material.

## 7. Validation and acceptance

- Unit proof for one and multiple 2-actions→1-coverage components.
- Reject missing/extra/reordered component records, new or changed Source Evidence IDs, action semantic drift, invalid beats and non-target drift.
- End-to-end repair sequence: initial cardinality failure → one atomic page repair → latent book-surface repair → candidate in exactly three calls/two repairs.
- Preserve page-repair predecessor/mixed-failure exhaustion and optional reference-only cleanup behavior.
- Novel-story bridge proof with no tracked template; canonical projection bytes/digest, idempotency, tamper/collision/alias/cross-candidate rejection and downstream reconciliation replay.
- Focused tests, deterministic TypeScript, `git diff --check`, one repository gate, and independent Claude Code adversarial PASS before push/live.
- After push: new canonical Git probe/Fresh Readiness/Execution Request, official pricing check, one preflight, one Supervisor verify and one bounded live invocation.

## 8. Cost impact

Implementation and tests cost `$0`. No image generation is authorized by this gate. A later live authoring attempt retains the existing `$5.00` maximum and is not run until technical QA closes. Any later image proof starts with one gpt-image-2 LOW page before additional pages.

## 9. Rollback and migration

Rollback is a focused revert of the component-repair and projection commits. No database, storage or historical artifact migration is required. Historical authority versions remain readable under their existing immutable rules; only the new current path may create the projection binding.

## 10. Review assignment

Claude Code must try to falsify component membership, minimum-delta application, non-target immutability, Source Evidence preservation, exact 1:1 closure, legacy routing, prompt/version claims, projection provenance, containment, idempotency and downstream replay. Guy retains exact reconciliation, Blueprint, package and visual product acceptance; this technical gate does not manufacture those approvals.

## 11. Explicit exclusions

No production deployment, model/tier change, token/call/repair budget change, timeout change, retry/fallback change, fourth-call widening, prompt prose unrelated to the repair contract, story-specific literal, credential access, provider call, render, Vision, storage/database write, publication or package approval occurs during implementation.

## Stop-check

- General system fix: yes.
- Cross-story risk: bounded by typed component authority, exact application and negative regressions.
- Production behavior affected: compiler repair behavior only; no deployment.
- Implementation spend: `$0`.
- Smallest validation: synthetic component + novel-story projection, then focused lifecycle aggregate.
- Unresolved Guy decision: none; budgets and product policy are unchanged.
- Claude Cowork review: not required; no product/creative decision is being made.
- Guy eyeball checkpoint: the first later LOW page, only after candidate and downstream authority exist.
