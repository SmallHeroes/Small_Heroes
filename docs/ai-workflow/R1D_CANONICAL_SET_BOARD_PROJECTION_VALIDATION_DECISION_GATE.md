# R1D Canonical Set Board Projection Validation — Decision Gate

## 1. Proposed change

Replace three object-key-order-sensitive `JSON.stringify` equality checks in the stable Set Board authority validator with canonical JSON equality. The affected compiler-owned projections are page-zone spatial nodes, page-zone spatial relations, and stable fixed objects.

## 2. Why now?

The first successful live Chameleon Candidate is persisted through the canonical artifact writer. That writer recursively sorts object keys, after which the unchanged template fails seven Set Board projection checks. The Candidate cannot enter reconciliation or the QA Wizard bridge until the validator accepts its canonical persistence form.

## 3. Scope

General system correction in an existing QA/validation boundary. It is not story-, child-, companion-, page-, or style-specific.

## 4. Risk of hardcoding

None. Canonical equality preserves array order and exact values while ignoring only object key order and Unicode composition differences introduced by canonical persistence.

## 5. Files likely affected

- `lib/visual-contract-compiler/setBoardStableAuthority.ts`
- `lib/set-identity-board/__tests__/set-definition.spec.ts`
- `CURRENT.md`
- this Decision Gate and focused implementation evidence

## 6. Expected behavior after change

An unchanged Set Board authority remains valid after a canonical JSON write/read round trip. Value drift, missing or extra fields, array reordering, relation drift, and fixed-object drift remain invalid. The persisted Chameleon Candidate passes the current template validator without rewriting the artifact.

## 7. Validation plan

1. Add a canonical round-trip regression with node and fixed-object tamper controls.
2. Run the focused Set Board suite.
3. Re-run `validateBookVisualContractTemplate` against the persisted Chameleon Candidate.
4. Run `npx tsc --noEmit`, `git diff --check`, and one literal `npm run check`.
5. Commit the focused milestone and send the immutable range to Claude Code for adversarial re-gate.

## 8. Cost impact

Zero provider, image, audio, network, database, or production cost.

## 9. Rollback plan

Revert the focused commit. The existing Candidate artifact remains unchanged throughout.

## 10. Review assignment

Guy has already authorized continuing toward the new-story Wizard and render path, subject to the repository gates. Claude Code must try to falsify canonical round-trip acceptance, tamper rejection, array-order preservation, dependency safety, and exact validation of the persisted Candidate. No Claude Cowork product or creative decision is needed.

## 11. Do not do

- Do not rewrite the Candidate or any live artifact.
- Do not call a provider or rerun live authoring.
- Do not create or approve reconciliation in this milestone.
- Do not authorize Wizard, Blueprint, render, publication, or deployment.
