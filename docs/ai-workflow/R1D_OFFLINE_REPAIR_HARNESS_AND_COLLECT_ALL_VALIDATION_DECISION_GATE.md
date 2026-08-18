# R1D Offline Repair Harness and Collect-All Validation — Decision Gate

**Owner decision:** approved by Guy on 2026-08-18

**Implementation branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`

**Starting HEAD:** `89ecd3389f220844241a61167e9d4140ccd72192`

## 1. Proposed change

Add a zero-provider offline replay harness for the Visual Contract authoring loop, then change draft assembly from fail-fast diagnostic exposure to collect-all exposure wherever later validation can run safely. The complete mixed structural/presentation surface will prefer the existing BookSurface repair before narrow reference repair. No validation rule is relaxed and no invalid Candidate may be returned.

The harness accepts one recorded or synthetic initial draft, optional injected repair responses, and optional expected complete diagnostic sets. It runs the production compiler with a local stub, records every selected route, and reports surfaced and complete issue counts plus per-stage net delta.

## 2. Why now?

Thirty-one paid attempts produced no Candidate. Route-level evidence shows BookSurface usually reduces issues, while PageSpatial and PageContract appear to introduce large structural families. Source inspection proves much of that increase is masking: `assembleTemplateFromDraft` throws on reference-domain failures before the full structural validator runs. Paid runs are therefore currently spending calls to discover already-existing families.

## 3. Scope

This is a general compiler, diagnostics, routing, and offline-test-system change. It is not specific to Dini, one child, one companion, one page, or one story.

## 4. Risk of hardcoding

The harness uses the production compiler and generic JSON fixtures. Collect-all behavior is keyed to existing typed diagnostic contracts, not story text. Route selection remains based on closed typed authority. Story-specific error strings, IDs, or pages are forbidden.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- a new offline harness module under `lib/visual-contract-compiler/`
- a new zero-provider CLI under `scripts/`
- focused compiler/harness tests under `lib/__tests__/`
- lifecycle tests only if the persisted diagnostic trail shape changes
- `CURRENT.md` and implementation evidence

No image, renderer, Wizard, payment, storage, deployment, model, pricing, or credential module is in scope.

## 6. Expected behavior after change

1. Offline scenarios show the exact route sequence and issue-count progression without calling a provider.
2. An early page reference failure no longer hides independently evaluable structural and presentation diagnostics from the same draft.
3. One combined throw carries the complete safe diagnostic surface for that draft.
4. When the complete surface contains an admissible BookSurface authority, BookSurface is selected before a narrow spatial repair.
5. A repair result whose complete issue count is greater than its predecessor cannot become the new repair baseline; the loop stops fail-closed and retains the prior draft as the best known state.
6. PageContract action-array/cardinality mutation is measured separately and is not misclassified as unmasking.
7. Candidate creation still requires a fully valid zero-issue final draft.

## 7. Validation plan

- First prove the harness itself against a deliberately masked synthetic fixture.
- Replay recorded/synthetic sequences for BookSurface, PageSpatial, PageContract, and full-draft routes.
- Prove that unchanged complete diagnostics with increased surfaced diagnostics are reported as unmasking, not damage.
- Prove a genuinely larger complete set stops immediately and retains the prior draft.
- Prove collect-all does not alter individual validator rules, diagnostic identities, error prose, or Candidate validation.
- Prove mixed reference + structural + presentation input selects BookSurface when its existing authority is admissible.
- Prove malformed/unsafe authority remains fail-closed and cannot be routed to BookSurface.
- Run focused tests, `npx tsc --noEmit`, `git diff --check`, and one literal `npm run check` after the milestone is complete.

No Fresh, live authoring, credential access, network/provider call, image generation, or render is permitted in this milestone.

## 8. Cost impact

Implementation and validation cost: USD 0. No provider or image calls. Model, tier, token budgets, call count, hard cost ceiling, retry and fallback policy remain unchanged.

## 9. Rollback plan

Revert the focused milestone commit. Existing persisted requests, receipts, readiness evidence and consumed attempts remain immutable. The harness is additive and can be removed independently. No database or artifact migration is required.

## 10. Review assignment

Guy has approved the strategy and the no-live stop rule. Claude Code must independently try to falsify:

- that the harness executes the production path rather than a duplicate loop;
- that collect-all reports only rules that actually ran safely;
- that error identity/count/order remain deterministic;
- that BookSurface preference is closed and does not swallow unrepairable reference authority;
- that a positive complete-issue delta cannot advance the loop;
- that PageContract action-array damage remains observable;
- that no live/provider/render behavior or budget was widened.

Claude Cowork is not required for this engineering-only diagnostic milestone.

## 11. Do not do

- Do not implement best-of-N sampling.
- Do not increase budget, call count, hard dollar ceiling, model, tier, timeout, retry, or fallback.
- Do not fix the last live symptom directly.
- Do not run Fresh or live merely to see whether the change works.
- Do not weaken, waive, reorder away, or silently discard a validation rule.
- Do not render any image or create Wizard authority during this milestone.
- Do not claim that a surfaced-count increase is repair damage unless the complete issue set also increases.
