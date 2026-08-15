# R1D Compound Page-Authority Compact Routing — Implementation Evidence

## Milestone

- Branch: `codex/r1d-compound-page-authority-compact-routing`.
- Worktree: `C:\Users\guyna\.codex\worktrees\spotlightlion1\Small_Heroes`.
- Exact base: `9d4b8c2203d6739862ac03e901f51e7366f2dd9b`.
- Implementation commit: `40357d6b` (`fix(authoring): compact compound page authority repair`).
- Immutable implementation range for independent review: `9d4b8c2203d6739862ac03e901f51e7366f2dd9b..40357d6b`.
- External cost: `$0`; no credential, provider, readiness, preflight, live-authoring, render, storage or deployment action occurred in this implementation milestone.

## Problem proven by live evidence

The consumed Leo v12 attempt proved that co-observation was correct but the common repair representation was not. After a successful first full-draft repair, all remaining failures were confined to nine `pageContracts`: three action-binding-cardinality issues and seventeen page-spatial-reference issues. The old router sent a second whole draft, which reached the `36,000` output ceiling and ended before validation. The detailed sanitized record is in `R1D_LEO_V12_COMPOUND_PAGE_AUTHORITY_ROUTING_EXECUTION_EVIDENCE.md`.

## General implementation

1. `pageContractCompoundAuthorityRepairPlan` accepts only an exact mixed set in which every issue maps uniquely to either the closed action-binding-cardinality catalog or the existing repairable page-action spatial-reference identity.
2. It derives the sorted union of affected page numbers and requires exactly one draft page for every identity.
3. It reuses the existing action-cardinality plan and current-zone spatial authority. Missing, duplicate or zone-mismatched authority rejects the plan.
4. Every spatial target carries its typed page/action/field coordinate plus the exact sorted spatial reference values permitted by that page's zone.
5. The rejected provider-authored spatial value is replaced with `__repair_target__` in compact prompt context so it is neither treated nor repeated as authority.
6. The provider returns the existing strict `PageContractRepairPatches` complete-page shape. Application rejects duplicate spatial targets, malformed authority values and every returned spatial ID outside the exact target allowlist. Compiler-owned `locationId` and `zoneId` remain preserved locally.
7. Full compiler validation still runs after application before any candidate can exist.
8. Homogeneous action-binding and homogeneous spatial routes retain their prior behavior. Safety-constraint spatial fields and every third issue family remain outside this combined lane and fail closed through their existing behavior.

## Version and policy boundary

- Page-contract output schema remains `page-contract-repair-schema/v1` / `PageContractRepairPatches`.
- Input encoding remains `page-contract-repair-input-encoding/v2`.
- Page-repair system/user prompt authorities advance from v10 to `page-contract-repair-prompt/v11` and `page-contract-repair-user-prompt/v11`.
- The lifecycle still records repair mode `page_contract_patch`; existing request, receipt and readiness bindings consume the imported prompt authority and therefore bind the new digests on future materialization.
- Model, endpoint, service tier, 64K input ceiling, 36K output ceiling, one-initial/two-repair budget, timeout, transport retries, fallback, pricing ceilings, candidate semantics, Reconciliation, Blueprint, Wizard and render policy are unchanged.
- The prior live output root and every historical artifact remain byte-immutable.

## Changed implementation surface

- `lib/visual-contract-compiler/pageContractRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/__tests__/page-contract-repair.spec.ts`
- `lib/__tests__/draft-reference-domain-hardening.spec.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`
- `docs/ai-workflow/R1D_COMPOUND_PAGE_AUTHORITY_COMPACT_ROUTING_DECISION_GATE.md`

No story-, page-, child- or companion-specific literal was added.

## Validation

### Focused functional and lifecycle proof

- `lib/__tests__/page-contract-repair.spec.ts`
- `lib/__tests__/draft-reference-domain-hardening.spec.ts`
- Result: **2 files / 98 tests PASS**.

Direct controls cover exact mixed admission, affected-page union, typed targets, masked rejected values, current-zone allowlists, valid non-mutating application, topology preservation, missing/duplicate/mismatched authority, duplicate targets, unpermitted IDs and third-family rejection. The compiler lifecycle now proves the mixed set selects one `page_contract_patch`, returns a candidate from the repaired page and never selects `full_draft`.

### Adjacent repair and authority bindings

- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/__tests__/visual-contract-prompt-table-compaction.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`
- Result: **3 files / 104 tests PASS**.

### Canonical boundary and structured-output compatibility

- `lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts`
- `lib/visual-package/__tests__/openai-responses-structured-output-schema-compatibility.spec.ts`
- Result: **2 files / 176 tests PASS**.

Combined focused result: **7 files / 378 tests PASS**.

- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

### Single repository gate

`npm run check` was invoked exactly once and exited `1` only because of the established six missing ignored-output fixtures.

- TypeScript: PASS.
- Story autonomous TypeScript: PASS.
- Resource-intensive phase: **19 files PASS**, two workers, clean diagnostic protocol, no assertion, timeout, RPC/IPC, reporter, launch, signal or teardown failure.
- Ordinary phase: **280 files**; exactly six known fixture-dependent failures:
  - `child-lexicon-ages-5-8.spec.ts` — missing ignored story artifact;
  - `momentum-gate-koko.spec.ts` — missing ignored page-beats artifact;
  - `page-entity-qa.spec.ts` — missing ignored image artifact;
  - `set-appearance-ref-budget.spec.ts` — missing ignored Set Board image;
  - two `story-read-back-validation.spec.ts` assertions — missing ignored story artifacts.
- No seventh assertion and no new infrastructure failure occurred.

The six failures remain a separate release HOLD. They are not accepted as product/release PASS and are not findings in this implementation range.

## Acceptance and rollback

The code milestone is locally green against its approved scope but independent Claude Code QA is still required. Codex does not self-award technical PASS. Revert `40357d6b` to restore the former fail-closed whole-draft route; no persisted artifact migration or deletion is required.

This implementation grants no Fresh Readiness, live-authoring, candidate, Reconciliation, Blueprint, Wizard, render, product, release, deployment or push authority.
