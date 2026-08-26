# Decision Gate — R1D Page-Contract Source-Evidence Identity Fence

## 1. Proposed change

Make `actionSemanticCoverage[].sourceEvidenceId` compiler-owned across every
page returned by `page_contract_patch`. Before any targeted or structural page
repair is applied, the compiler will rebind every existing coverage slot to
the original draft's evidence identity. It will fail closed on unapproved
coverage cardinality, reorder, malformed records, or beat drift, and on any
unapproved `actionRequirements[].beatId` reorder, insertion, removal, or
replacement. The only new records permitted by the existing atomic
action-binding-component target receive the target's compiler-owned evidence
identity.

The provider continues to choose only fields it already owns. Exact closed
presentation class and pointer/value allowlists remain unchanged. This
milestone does not weaken those checks or accept provider-authored identity.

## 2. Why now?

The single paid attempt at reviewed HEAD `64c0b5df` stopped after two calls and
`$0.770925` conservative cost with
`page_contract_repair_presentation_target_invalid`. Exact offline replay proved
that all nine presentation selections were valid, but the complete-page wire
response changed `sourceEvidenceId` on 26 of 50 coverage records. The schema
currently requires the model to echo opaque compiler identities even though no
repair target authorizes changing them.

Rebinding all existing identities in memory advances the exact captured
response from a complete census of `12` issues to `5` (delta `-7`) and routes
to `book_surface_patch`. Rebinding only the nine presentation targets is unsafe:
structural pages retain wrong-page evidence IDs and the census remains `12`.

## 3. Scope

This is a general compiler/runtime safety correction for every Story Source.
It is not specific to Chameleon, Bar, a page, child, companion, or story text.

## 4. Risk of hardcoding

No story literal, page number, evidence digest, or response value is used in
production logic. Association is derived from the original page, the typed
repair targets, stable array slots, and the existing closed beat authority.

## 5. Files likely affected

- `lib/visual-contract-compiler/pageContractRepair.ts`
- `lib/visual-contract-compiler/authoringPolicy.ts`
- canonical authoring request/receipt/readiness and Fresh/live-execution
  envelope version constants plus their focused tests
- `lib/visual-contract-compiler/templateRepairOutputDiagnostics.ts` only if a
  new typed rejection identity is required
- focused repair/compiler/harness tests
- `CURRENT.md`
- implementation evidence for this gate

Prompt prose, provider schema, model, budgets, retry/fallback policy, Story
Source, Visual Package, Wizard, reader, renderer, and deployment are excluded.
The authoring policy and outer live/Fresh envelopes advance one version because
the same provider bytes now have different application semantics; immediate
predecessor authoring artifacts remain readable only as immutable legacy
evidence and must not be reused as current spend authority.

## 6. Expected behavior after change

Provider-returned evidence-ID drift is ignored and replaced by compiler-owned
identity before the page repair can enter the draft. Existing coverage records
remain bound to their original evidence. Provider changes to count, order,
action or coverage beat association, presentation class, or pointer/value
outside typed authority still reject. Structural page replacement can no
longer import evidence-ID or action-beat topology drift.

## 7. Validation plan

1. Unit regressions for same-page and wrong-page ID substitutions on targeted
   and structural pages.
2. Hostile cardinality, reorder, duplicate/malformed record, beat drift, class,
   and pointer/value counterexamples remain fail-closed.
3. Existing action-binding-component append authority remains functional and
   compiler-binds new record identities.
4. Replay the captured sanitized live evidence offline and prove the frontier
   moves `12→5`, delta `-7`, with next route `book_surface_patch` and zero
   provider calls. Because the historical request is deliberately legacy after
   cutover, drive the current harness directly from its immutable snapshot and
   captured structured responses; do not redigest or rewrite the old request,
   receipt, or replay artifact.
5. Run affected suites, `npx tsc --noEmit`, `git diff --check`, and the
   repository gate in proportion to the final diff.
6. Independent Claude Code review must falsify the exact committed range before
   any new live attempt.

## 8. Cost impact

Implementation, tests, replay, and QA cost `$0`. This gate authorizes no live
provider or render call. A future attempt requires a new clean reviewed HEAD,
Fresh Readiness, and the existing single-attempt stop rule.

## 9. Rollback plan

Revert the focused implementation commit. Historical output artifacts remain
immutable and require no migration or rewrite.

## 10. Review assignment

Guy's standing authorization to diagnose and make the smallest general offline
fix is applied to this bounded technical gate; there is no unresolved product
choice. Claude Code must test identity preservation across structural pages,
all authorized action-binding exceptions, target/pointer closure, replay delta,
version truth, and absence of policy drift. Claude Cowork is not needed because
this milestone changes no product, story, UX, or creative behavior.

## 11. Do not do

Do not delete the presentation allowlist guard, accept a provider evidence ID,
special-case Chameleon, alter source text, increase calls/cost, change model or
fallback, call a provider, render, deploy, publish a package, mutate historical
artifacts, or touch Production in this milestone.
