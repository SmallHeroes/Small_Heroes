# R1D Typed Prop-Constraint Repair Authority + Exact-Fingerprint Stagnation Guard — Decision Gate

**Date:** 2026-08-19
**Owner:** Codex (Technical Owner)
**Product authorization:** Guy explicitly authorized investigation, implementation, independent Claude Code QA, push after PASS, and later render only when the canonical gates permit it.
**Implementation boundary:** offline only. No Fresh Readiness, credential access, provider call, live authoring, Candidate promotion, Wizard mutation, image generation or render is authorized by this milestone.

## 1. Proposed change

Make two general changes to the Visual Contract authoring loop:

1. Replace the duplicated broad interpretation of `page_prop_constraints_invalid` with one pure, closed classifier used by both deterministic validation and BookSurface repair-authority construction. The BookSurface input will carry only bounded typed violation records (`code`, `constraintIndex`, and `relatedConstraintIndex`) beside the existing exact page projection and read-only authority. Raw validation prose remains excluded.
2. Stop before another provider dispatch when two consecutive **complete** normalized diagnostic populations and their canonical invalid drafts have the exact same canonical state fingerprint. This is distinct from the existing positive-regression guard and must not compare route subsets, raw emission counts, count equality alone, or issue equality while the draft is still changing.

The BookSurface output schema remains unchanged. Its system/user prompt authority advances because the decoded input contract and repair instructions change. A new truthful terminal classification records stagnation instead of mislabelling it as regression or budget exhaustion.

## 2. Why now?

The consumed eight-page Koko attempt made seven completed calls and six BookSurface repairs. Its complete unique trajectory was `17 -> 7 -> 7 -> 7 -> 7 -> 7 -> 7`. Attempt 2 resolved all ten catalog gaps, while the same seven page-scoped `page_prop_constraints_invalid` identities persisted on pages 1–7 through every remaining repair. At least two responses were byte-identical. No Candidate was created; nominal/conservative cost was USD 1.490370 / 1.777768.

Code inspection proves that the current BookSurface payload deliberately excludes raw validation prose and exposes only the broad page cause. That broad cause covers nine materially different deterministic clauses. The current guard stops only when the complete normalized unique count increases, so an exact fixed point consumes every remaining repair call.

This blocks authoring, Wizard integration and render authority while producing avoidable paid calls.

## 3. Scope

- General system change.
- Applies to every story/page using Visual Contract authoring.
- No story-, child-, companion-, page- or provider-specific constant.
- No best-of-N, resampling, model change, fallback, retry, call-cap or spend-cap change.

## 4. Risk of hardcoding

The classifier derives only from the deterministic validator's existing prop-constraint rules and receives the current recurring-prop and page-anchor authority. It must not encode Koko, eight pages, a specific prop ID, or an inferred live value. The live response/draft bodies were intentionally not persisted, so no exact offending value may be claimed or patched.

## 5. Files likely affected

Core:

- `lib/visual-contract-compiler/pagePropConstraintValidation.ts` (new shared pure classifier)
- `lib/visual-contract-compiler/validateBookVisualContract.ts`
- `lib/visual-contract-compiler/bookSurfaceRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/offlineRepairHarness.ts`
- `lib/visual-package/authoringTerminalDiagnostics.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`

Current-authority version cascade (only where exact prompt/terminal authority is bound):

- `lib/visual-package/liveRequestMaterialization.ts`
- `lib/visual-package/liveExecutionRequestMaterialization.ts`
- `lib/visual-package/liveExecutionSupervisor.ts`
- `lib/visual-package/canonicalPreLiveReadiness.ts`

Focused tests and current/evidence documentation will be updated. Candidate v9, policy v17, output budget v6, provider evidence, model/tier/reasoning, price, timeout, retry and fallback authorities remain unchanged unless repository evidence proves otherwise.

## 6. Expected behavior after change

- Deterministic validation emits byte-equivalent error prose and the same broad typed diagnostic identity/count/order, while the shared classifier also produces a closed clause-level violation list.
- A BookSurface page writable for `propConstraints` receives the exact clause codes and safe indexes needed to interpret its existing projection. It receives no raw error prose, source phrase, credential/path, provider response, stack or arbitrary authored string in the violation records.
- The authority is null if its typed violations cannot be recomputed exactly from the current draft and trusted recurring-prop/anchor authority.
- The applier recomputes and exact-compares the typed violation authority before mutation.
- A completed repair with an unchanged canonical draft and complete normalized issue fingerprint terminates immediately before a further dispatch, retains no Candidate, and produces a distinct sanitized stagnation terminal.
- An atomically rejected PageContract output remains governed by its existing single closed correction allowance; it is not misclassified as an applied repair fixed point.
- Equal counts with different normalized identities/causes continue. Any route-subset comparison remains disabled. A genuine increase still uses the existing regression terminal.

## 7. Validation plan

Smallest offline proof:

1. Table-test all nine existing prop-constraint clauses against the shared classifier and validator, preserving exact message/count/order behavior.
2. Prove BookSurface prompt round-trip includes exact typed records and excludes raw validation messages/high-entropy sentinels.
3. Prove authority tamper, stale indexes, wrong related index, recurring-prop drift and anchor drift reject atomically without input mutation.
4. Prove a typed repair closes each clause (or remains fail-closed when no valid semantic repair is supplied).
5. Prove complete canonical state `A -> A` stops after two total calls; identical issues with a changed draft continue; equal counts with different issues continue; route subset equality continues; a complete unique-count increase still uses regression.
6. Prove receipt/readiness persistence and redigested tamper rejection for the new terminal.
7. Run the production-backed offline harness with `providerCalls:0`, exact route/call sequence and no positive complete delta.
8. Run focused Vitest suites, `npx tsc --noEmit`, `git diff --check`, and one literal `npm run check` without retry.
9. Commit locally, then independent Claude Code read-only QA on an immutable base-to-head range. Fix valid findings in a separate commit and re-gate.

No full book, image or provider call is part of validation.

## 8. Cost impact

- Implementation and validation cost: USD 0 provider/image spend.
- Expected runtime impact after later authorization: fewer paid calls on exact fixed points.
- No call budget or hard USD ceiling increase.

## 9. Rollback plan

Revert the focused implementation commit(s). Historical artifacts remain immutable. Current writers never rewrite prior request/receipt/readiness/Fresh evidence. No external state is mutated by this milestone.

## 10. Review assignment

Guy has already decided the product priority and authorized the offline implementation/QA loop. No open product or creative decision remains.

Claude Code must try to falsify:

- classifier/validator parity for every existing clause;
- violation-index precision and closed exact keys;
- raw prose/high-entropy/secret leakage;
- stale/tampered authority acceptance;
- false stagnation on equal-count identity changes or route subsets;
- missing lifecycle terminal/persistence binding;
- incomplete prompt/terminal version cascade or unjustified version churn;
- policy/model/budget/retry/fallback/Candidate/Wizard/render drift.

Claude Cowork is not required: this is an engineering authority/observability change, not a product, UX or creative decision.

## 11. Stop-check answers

1. **General or story-specific?** General system fix.
2. **Could another story/child/companion/style break?** Yes, because it changes shared authoring prompt authority; mitigated by clause parity, exact authority recomputation, full focused suites and immutable-range QA.
3. **Production behavior?** Yes, but only repair input and pre-dispatch termination. No render behavior changes.
4. **Spend money?** Not during this milestone.
5. **Smallest safe validation?** Pure classifier + BookSurface + compiler/lifecycle + offline harness tests; no provider/image.
6. **What must Guy decide?** Already decided: proceed offline and use Claude before/after implementation.
7. **What should Claude falsify?** Listed above.
8. **Need product/creative review?** No.
9. **What should Guy eyeball?** Nothing visual yet; a real Candidate and the smallest authorized render remain later gates.

## 12. Do not do

- Do not inspect or infer unpersisted provider response bodies.
- Do not patch a specific Koko prop/page/value.
- Do not send raw validation prose to BookSurface.
- Do not stop on raw-count equality, unique-count equality alone, or route-subset equality.
- Do not reuse consumed Fresh/Execution Requests.
- Do not access credentials, call a provider, create Fresh, run live authoring, mint/promote a Candidate, mutate Wizard state, generate images or render.
- Do not increase budget/calls/retries/fallbacks or change the model/tier/reasoning.

## 13. Execution clarification

The approved gate was implemented as two independently reviewable milestones.
The exact-fingerprint stagnation guard landed first and received independent
Claude Code PASS. The second milestone is only the typed prop-constraint
classifier and BookSurface prompt authority described above. It does not edit
the compiler loop, offline-harness implementation, terminal taxonomy or
authoring policy; those surfaces already contain the reviewed first milestone.

The nine legacy validator messages comprise two collection-level clauses and
seven item-level clauses. Collection records therefore contain only `code`;
item records contain `code + constraintIndex`, and only the contradiction
record additionally contains `relatedConstraintIndex`. This is the smallest
truthful, index-only authority shape and does not invent an item index where no
array item exists.
