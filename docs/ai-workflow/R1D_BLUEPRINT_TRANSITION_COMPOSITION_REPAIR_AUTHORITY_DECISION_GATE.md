# R1D Blueprint Transition + Composition Repair Authority — Decision Gate

## 1. Proposed change

Make the existing Blueprint validation diagnostics actionable without changing any validation rule:

- split the currently combined transition-traversal failure into the two actual writable cases: missing/bad visible traversal binding versus missing cast/footprint overlap;
- attach closed structured `expected` and `actual` evidence to both cases;
- expose structured observations for the already-existing composition policy failures while preserving the current human-readable messages and thresholds;
- prove the terminal frontier in an offline, provider-free authoring harness.

## 2. Why now?

The authorized ordinary live run for Request `3232af557a75239f0395343636e4efaf2670ce4e2cc85e59bacb4b0bf36f3a19` completed with retry `0`, fallback `false`, three generation calls, two repairs, and conservative cumulative cost `$1.367213`, but ended in `draft_validation_repair_exhausted`.

The complete untruncated census converged `70 -> 52 -> 6` unique identities. The last repair resolved 46 identities and introduced 0. The final six are five `traversal_infeasible` entries at `frames[*].affordanceIds` and one `composition_policy_invalid` entry at `frames`. They are the only remaining launch blocker for this authoring attempt family.

## 3. Scope

General system change. It applies to every Blueprint story and every transition/composition failure. It contains no Chameleon, Bar, page-number, child, companion, story, or style special case.

## 4. Risk of hardcoding

The implementation must derive all IDs, page numbers, zones, directions, consumers, placements, shots, angles, and ratios from the candidate being validated. Tests must use synthetic fixtures and counterexamples, not the paid run's raw provider draft (which is intentionally not persisted).

## 5. Files likely affected

- `lib/visual-package/preRenderBlueprint.ts`
- `lib/visual-package/preRenderBlueprintCompositionPolicy.ts`
- `lib/visual-package/preRenderBlueprintAuthoringContract.ts`
- `lib/visual-package/blueprintAuthoringExecutionProgram.ts`
- focused Blueprint validator/authoring specs
- one provider-free production-scale frontier regression
- `CURRENT.md`
- an implementation evidence document

No Story Source, Visual Contract, package, Wizard, payment, provider adapter, budget, model, retry, fallback, render, or deployment file is in scope.

## 6. Expected behavior after change

The validator rejects exactly the same invalid Blueprints and accepts exactly the same valid Blueprints, but the repair provider receives a lossless structured target:

- whether it must create/rebind a visible direction-compatible traversal, or instead make an existing matching traversal overlap a cast placement;
- which connection, frame zone, transition direction, transition consumer, frame membership, traversal candidates, and overlap state govern the fix;
- the exact composition threshold and the measured observation that missed it.

## 7. Validation plan

1. Preserve all existing validator tests.
2. Add counterexamples for both traversal branches and assert exact structured evidence.
3. Add structured composition observations for every existing policy family and prove the legacy message projection is byte-equivalent.
4. Run a provider-free eight-page authoring harness with six transition pages and an enforced composition policy. Its invalid draft must reproduce a five-traversal-plus-one-composition frontier; one injected corrected whole-book response must reach zero issues within the existing repair budget.
5. Cut repair-prompt semantic identity to v8 because the same failed draft now produces materially different repair-user bytes. Freeze the exact prompt-v7/program `19c5...` object as replay-only, reject it for every fresh dispatch lane, and keep draft schema v6 plus repair wire v2 unchanged.
6. Run focused suites, `npx tsc --noEmit`, `git diff --check`, and the repository stability check proportionate to the final diff.

## 8. Cost impact

`$0` for this milestone. No provider, count endpoint, image, audio, render, upload, deployment, or credential access. Model, three-call budget, two-repair budget, `$5` hard ceiling, retry `0`, and no-fallback policy remain unchanged.

## 9. Rollback plan

Revert the focused commit. No durable authority artifact, production locator, database row, or remote state changes during this milestone.

## 10. Review assignment

Guy already authorized continued offline diagnosis and correction after the failed single live attempt. No unresolved product decision remains: the validation rules and visual quality thresholds are unchanged.

Claude Code must independently falsify:

- that rule semantics are unchanged;
- that expected/actual evidence is derived from the same values the validator evaluates;
- that no raw provider prose or PII is persisted by the sanitized capture;
- that the harness is non-vacuous and exercises both traversal branches plus all composition families;
- that repair-prompt v8/program `3e36...` is the only semantic identity cutover, frozen
  prompt-v7/program `19c5...` remains replayable but cannot fresh-dispatch, and no schema, wire,
  budget, retry, fallback, provider, render, Wizard, or package drift entered the range.

Claude Cowork review is not required because this is a technical observability/repair-authority correction, not a product or creative decision.

## 11. Do not do

- no retry of execution identity `59717a794965945124d2fa4bf9558cc031ca26680f3d8bac1bafb0ab1085bffd`;
- no provider/live/count-endpoint call;
- no render, image, audio, approval, package promotion, Wizard qualification, deployment, or database mutation;
- no model, budget, retry, fallback, validation-threshold, or composition-policy change;
- no story-, child-, companion-, or page-specific patch.
