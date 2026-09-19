# Book first, pictures second

Guy's requirement is broader than the prior Panda fix. A book has one coherent world
and causal sequence, not12 separately invented scenes. The planner must see the ending
before directing the opening, without painting future events into earlier pages.

## Two separate kinds of information

**Story/world state:** stable identities and appearance, location topology, who is
inside/on/holding what, object state and source-linked changes. Persist offscreen
state as well. An absent mention does not move a person or reconstruct a building.

**Presentation:** angle, distance, framing, expression, gaze and transient acting.
These may vary within the current physical situation. World relations are not fixed
screen coordinates or a demand to repeat the same image. Camera changes do not move
the characters; physical continuity must not force identical compositions.

## Actual implementation in this milestone

The automatic local planner now emits plan+sequence in ONE existing text request.
No extra planner call per page. It receives all personalized source pages, including
later events. The compact response authors initial entity state and per-page changes,
not repeated snapshots. Code expands and checks the entire book before any prop-board,
cover or page generation can execute. Hashes are computed from source/normalized plan
by code, not invented by the model. The complete plan and sequence are persisted first.

Image prompts and shared QA receive current-page state, book premise and past beats;
future page directions are not passed as current requirements. Same-scene initial
generation also receives the adjacent reviewed/hash-bound image for comparison. It
does not receive a cover/cross-scene image as a generation template. Repair uses its
own candidate within the existing reference cap. Existing source acceptance, calibration,
budget, checkpoint, no-retry, publication and narration boundaries remain in force.

New planning identity blocks automatic replay of old plan-only runs. It does not
mutate or upgrade their saved plans, images or approvals. Existing owner-draft data
still uses the prior optional sequence mode; that entry is not made mandatory by this
commit. The current-page QA projection moved to a shared helper without changing it.

## What18-story coverage means

The offline corpus check covers the hash-bound refreshed editorial intake:18 stories,
216 source pages, including6 stories each of8/12/16 pages, in both grammatical genders
(432 personalized page checks). No content or manuscript hashes changed. Every page
reaches the planner input, with no missing ending, hardcoded story or fixed12-page limit.

This is NOT18 generated storyboards, semantic understanding measured on18 outputs,
accepted-source publication, or18 render-qualified slots. The real preview entry still
loads a lifecycle-validated accepted creative revision; intake coverage cannot bypass
that loader. Model-authored plans and their visual benefit are not measured this turn.

## Customer-path mapping and remaining migration

Production already has BookVisualContract with book-level locks, per-page location/
zone/transition, cast/prop state, action requirements and separately bounded camera;
Blueprint/package qualification supplies the frozen runtime projection. The local
preview is not that authority. No local JSON was copied into an accepted package.

To carry this behavior into customer production, the state planning/transition checks
must be represented and validated inside the reviewed contract/Blueprint lifecycle,
then projected through the same frozen authority to rendering and QA. Legacy scene-memory
must not be switched on under earlyRuntimeAuthority as a competing source of truth.
The owner-approved new requirement applies to the target architecture; this commit
implements the automatic local planning seam, not a hidden production migration.
For the fixed18-story catalogue, the production target is a reviewed reusable plan
per exact accepted story/visual revision, materialized with the child's identity.
It should not re-invent the plot/world or require a new manual page brief per order.
That cache/materialization migration is NOT implemented by this local change.

## Risks retained, not waved away

- The compiler can verify declared state, hashes, coverage and exact quotes; it cannot
  prove that the model understood the source or that a quote semantically entails a move.
  Free-form page prose can still contradict structured state and needs semantic review.
- Initial states can be authored incorrectly. Prior pixels can carry a false PASS.
  No claim of calibrated automatic anatomy, custody/capacity or spatial understanding.
- One principal relation is not a full contact/3D graph or metric geometry model.
- The automatic local runner still uses its existing full prop-board image. Current-page
  text projection does NOT mean pixel-level removal of future props from that board.
- Same model, reasoning, output limit and reservation as before. A larger/ambiguous
  plan must hold on incomplete output/validation/budget failure, not fall back to
  independent pages. No expensive blind repair loop was added.
- Source/model/style/plan changes invalidate the new run identity. No old paid
  artifact is relabeled as if it had passed this new planning boundary.

Next empirical proof remains a bounded sequence after independent review, comparing
continuity AND camera diversity. No images/provider calls this turn; new cost$0.
