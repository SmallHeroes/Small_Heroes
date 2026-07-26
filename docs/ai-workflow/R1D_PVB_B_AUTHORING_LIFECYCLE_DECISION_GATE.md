# Decision Gate — R1D-PVB-B General Blueprint Authoring Lifecycle

Status: **Approved by Guy for implementation**

Immutable implementation base: `cd0a6c836a917d20d848558a88f649e486d76be1`

Implementation branch: `codex/r1d-pvb-b-authoring-lifecycle`

## 1. Proposed change

Correct PVB-A's dependency direction and implement the general, offline-testable
Blueprint authoring, review, immutable local persistence, and exact-digest approval
lifecycle. The production artifact becomes
`pre-render-book-visual-blueprint/v2`.

## 2. Why now?

PVB-A's feasibility model was valid, but its identity depended on the complete
mutable Visual Package manifest. That made an upstream Blueprint stale when
downstream lifecycle timestamps changed and created a dependency cycle with the
Boards and assets the Blueprint must precede.

PVB-B is required before Blueprint authority can safely be reviewed and, in the
later PVB-C gate, consumed by production.

## 3. Scope

This is a general system change. One Blueprint authority is bound to one exact
Story Source identity and `styleId`, plus immutable source, Visual Contract,
approved semantic reconciliation, and style-content digests.

It includes:

- strict whole-book draft authoring with an injected offline caller;
- deterministic authority overlay and bounded repair provenance;
- separate immutable candidate, provenance, validation, review, and approval
  artifacts;
- deterministic JSON, Markdown, and portrait 2:3 schematic contact-sheet review;
- an exact-digest attestation restricted to the exact approver `Guy`;
- a fail-closed local offline entrypoint.

## 4. Risk of hardcoding

Shared code must contain no current story, child, companion, page-count, Fox,
Uri, bucket, bedroom, balcony, or fixed-page special case. The same compiler and
lifecycle path must cover single-location, multi-zone transition,
journey/fantastical, no-companion, and reveal-timeline synthetic sources.

## 5. Files likely affected

- `lib/visual-package/preRenderBlueprintTypes.ts`
- `lib/visual-package/preRenderBlueprint.ts`
- `lib/visual-package/preRenderBlueprintDraftSchema.ts`
- `lib/visual-package/preRenderBlueprintAuthoring.ts`
- `lib/visual-package/preRenderBlueprintLifecycle.ts`
- focused synthetic tests under `lib/visual-package/__tests__/`
- `scripts/pre-render-blueprint-lifecycle.ts`
- `package.json`
- `CURRENT.md`

No production provider, render, Board, promotion, or deployment module is in
scope.

## 6. Expected behavior after change

Blueprint v2 binds only stable upstream authoring authority. Review or approval
timestamps cannot stale it, while an exact source, template, reconciliation,
style identity, or immutable content change fails closed.

Authoring is one structured whole-book call through an explicit injected seam.
Candidate content is deterministically overlaid with upstream authority, fully
validated, and stored without overwrite at a content address. Review and
approval bind the exact candidate and authority digests. `unresolved` source
coverage blocks persistence and approval.

Blueprint approval is planning approval only. It grants no Board mint, image
render, Visual Package promotion, runtime cutover, deployment, release, or
product/visual acceptance.

## 7. Validation plan

- focused v2 authority, feasibility, authoring, lifecycle, reconciliation, Visual
  Contract, and Visual Package regression tests;
- five synthetic Story Source shapes through the same public authoring path;
- deterministic byte/digest, collision, fault-injection, stale-revision,
  unresolved-coverage, and exact-approver tests;
- `npx --no-install tsc --noEmit`, `git diff --check`, literal and forbidden
  boundary scans, then proportional `npm run check`;
- independent first-pass read-only Claude Code review over the immutable
  base-to-head range.

No image or full-book generation is required.

## 8. Cost impact

Expected API/image/audio cost: **$0**. No live model, provider, Vision, render, or
network call is authorized or executed in this milestone.

## 9. Rollback plan

The implementation is isolated on its milestone branch in focused commits.
Rollback is the removal/revert of those commits. PVB-A v1 has no persisted
production artifact, so there is no data migration and no permissive v1 fallback.
PVB-C remains the sole future runtime cutover gate.

## 10. Review assignment

Guy approved the product and architecture decisions in the implementation brief.
No unresolved product decision remains in PVB-B.

Claude Code's first pass is read-only and should try to falsify:

- absence of downstream Visual Package, Board, asset, or lifecycle-state inputs
  from v2 authority;
- exact content staleness checks and semantic reconciliation behavior;
- total deterministic feasibility preservation across all five shapes;
- strict one-call whole-book schema, bounded repairs, and lack of model fallback;
- immutable/no-overwrite behavior and failure recovery;
- exact review/approval digest binding and unresolved-coverage blocking;
- absence of runtime/provider/storage/database imports or side effects.

Claude Cowork review is not required for this technical lifecycle milestone.

## 11. Do not do

No live authoring/model/LLM call; no render; no OpenAI/provider/Vision/fetch/
network/credentials; no Supabase/storage/database write; no Board action; no
real approval; no Visual Package promotion; no runtime cutover; no deployment;
no push; no branch/worktree cleanup.
