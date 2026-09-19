# Whole-book planning before images: implementation gate

Owner request: every one of the18 authored stories must be understood as a complete
sequence before rendering. Persist the world/situation; do not freeze acting, camera
or composition. This explicit request authorizes the engineering correction, not
source rewriting, model changes, new acceptance or paid images in this milestone.

Same task, sole writer, C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1, base093d37c0 clean/ahead9/behind0. Dependencies
d53b768ccb2f and accepted-intent63ccb484 stay read-only. No push or overlapping task.

## Investigation and scope

The local planner already sees the entire story but returns appearance and isolated
page staging only. The previous commit added a manually supplied physical sequence
to owner samples, not automatic sequence planning. Production is a different path:
BookVisualContract plus Blueprint/package authority already cover the full book;
their schema/accepted artifacts and earlyRuntimeAuthority must not be overwritten
by local diagnostic data. None of18 slots is newly render-qualified by this change.

Implement mandatory joint plan+sequence authoring in run-local-story-preview, before
any prop board, cover or page image. Derive hashes in code, never ask the model to
assert authority. Compact model output: initial full state + per-page transitions;
expand and validate the entire ledger before image callbacks become reachable.
Use the existing sequence validator and projection. Preserve the existing camera,
angle, expression and occupancy/variety validators; no state compiler rewrite of
these fields. Current-page projection is shared with the owner lane, not duplicated.

The planner receives the full accepted source, including all future pages. Each
image receives the current situation and past context, not future page actions.
The existing full prop-board pixels remain a disclosed exception: narrowing page
text does not remove future prop designs from that image reference.
Within a scene use a hash/review-bound previous image as comparison, not authority;
scene cuts remain separate. Repair keeps the same state and uses its own edit target.
Persist complete plan and ledger before first image. New planning version prevents
silent reuse of old plan-only checkpoints; preserve historic roots without upgrades.

## Proof and limits

Real-entry mocked-provider tests: incomplete/contradictory final page blocks the
FIRST image; valid full plan precedes all images; unchanged cameras/expressions;
no cover/cross-scene predecessor; repair/resume/budget/legacy-root boundaries.
Offline corpus audit: source hashes and all18/216 pages (both genders) reach the
planning request. This measures input coverage, not18 model-generated plans or
semantic understanding. No fake success ledger per story and no provider calls.
Focused tests, both relevant typechecks, full repository check, preservation.

Risks: model authored staging can be wrong despite syntactic validity; exact quotes
do not prove entailment; principal-relation coverage is incomplete physical reasoning;
large plans may exhaust unchanged output/budget limits and must hold. Prior image
can contain a false PASS. Canonical production adapter/migration remains separate
and must preserve reviewed authority. No claim that customer runtime is upgraded.

Rejected: frozen prompts/cameras, previous image as truth, an extra opaque planner
per page, copying the local ledger into approved production packages, loose-text
instructions as the only continuity mechanism. No unnecessary additional model call.

Rollback this focused commit; keep all source/paid artifacts. Cost$0 in this task.
No unresolved product decision for the bounded implementation. Guy reviews actual
visual benefit later; Claude receives read-only code/data scope, not a self-PASS.
