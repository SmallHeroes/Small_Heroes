# R1D Blueprint Static Spatial Constraint Feasibility — Decision Gate

## 1. Proposed change

Teach the existing Blueprint validator to evaluate a static `beside` constraint
against the exact `spatialTargetRegions` entry already authored by the action
space when the target is a `spatial` node or location `anchor`. Preserve the
existing current-frame placement requirement for `cast` and `prop` targets.

## 2. Why now?

The approved eight-page Chameleon Production Authoring Context reaches a
provider-free whole-book Blueprint draft with one remaining deterministic
issue. Page 8 requires the companion to sit beside `sp_bed`. The Blueprint
schema cannot author placements for spatial nodes, while the validator currently
looks only for cast/prop placements. It ignores the action space's already
typed target-region authority, making this valid contract impossible to satisfy.

## 3. Scope

General Blueprint validation correction. It is not story-, page-, child-,
companion-, or style-specific.

## 4. Risk of hardcoding

No Chameleon identifier or bed-specific rule enters production code. The branch
is selected only by the closed `EntityRef.kind` domain. `cast` and `prop` remain
placement-bound; only `spatial` and `anchor` may use exactly one matching typed
target region.

## 5. Files likely affected

- `lib/visual-package/preRenderBlueprint.ts`
- `lib/visual-package/__tests__/pre-render-book-visual-blueprint.spec.ts`
- this Decision Gate, implementation evidence, and `CURRENT.md`

## 6. Expected behavior after change

A static action targeting fixed set geometry or an anchor is feasible only when
its action space carries exactly one resolving target region and current subject
placements satisfy the existing geometric `beside` predicate. Missing,
ambiguous, overlapping, too-distant, or vertically incompatible geometry still
fails closed. Prop/cast targets still require their exact current placement.

## 7. Validation plan

Add direct positive and hostile validator regressions, rerun the focused
Blueprint suites, TypeScript, diff-check, and the exact provider-free Chameleon
whole-book draft. Success requires zero Blueprint issues and no provider/image/
network/database/production activity.

## 8. Cost impact

`$0`. No provider or media generation is part of this milestone.

## 9. Rollback plan

Revert the focused validator/test/docs commit. No schema, prompt, persisted
artifact version, database, or production data migration is involved.

## 10. Review assignment

Guy has authorized continued system completion. Claude Code should falsify the
closed target-kind split, exact target-region cardinality, geometry boundaries,
unchanged prop/cast behavior, and absence of prompt/schema/version drift.
Claude Cowork review is not required because this is a technical feasibility
bug with no product or creative choice.

## 11. Do not do

- Do not change the Visual Contract, Story Source, reconciliation, or Candidate.
- Do not change prompt/schema/model/budget/fallback/render policy.
- Do not call a provider or generate an image in this milestone.
- Do not weaken current-placement authority for cast or prop targets.

## Stop-check

1. General fix: yes.
2. Cross-story risk: bounded to existing typed geometry and guarded by hostile tests.
3. Production behavior: validator accepts previously impossible valid spatial/anchor static geometry only.
4. Spend: none.
5. Smallest proof: direct validator tests plus the exact nine-frame Chameleon draft.
6. Owner decision: Guy already authorized continued completion; no new product choice.
7. Independent falsification: target-kind split, cardinality, geometry, regression and drift.
8. Product/creative review: not needed.
9. Guy eyeball: the generated Blueprint review packet after technical validation.
