# R1D General Visual Directions Acceptance and Publication — Decision Gate

**Date:** 2026-08-23

**Status:** approved for implementation and provider-free publication-candidate preparation

**Owner authority:** Guy explicitly approved Visual Directions Candidate
`3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a`
and Review Bundle
`fa519a11bca42e0d565479329b9d5c0767972814ee28d6e73a764a35a1a3b57c`.
Guy previously authorized continued work until the Wizard is operational. This
gate does not infer render authority from either approval.

## 1. Proposed change

Add a general provider-free lifecycle that:

1. reloads and byte-revalidates an existing Visual Directions enrichment
   Candidate;
2. binds an independent technical-review attestation and exact Guy product
   approval;
3. deterministically builds a complete accepted-revision publication bundle;
4. stages that bundle under ignored `outputs/` for independent QA; and
5. exposes a separate atomic publish operation that can copy only the exact
   QA-verified bundle into the canonical accepted-revision directory.

The real milestone executes preparation only. Publication into tracked Story
Source authority waits for Claude Code PASS on the lifecycle and bundle.

## 2. Why now?

The accepted `story_text_only` creative revision and its new Visual Directions
are separately approved, but the combined Story Source is not yet a durable
accepted revision. Downstream Blueprint authoring must consume one immutable,
product-accepted Story Source plus Visual Directions authority.

The existing v2 revision lifecycle and package migration are not reusable:
they require the historical `female -> neutral` metadata correction. The current
Visual Package also contains a Visual Contract for the superseded bus-stop
story. Advancing its locator would create cross-story runtime authority drift.

## 3. Scope

- General system change: a content-addressed acceptance/publication lifecycle.
- One real story instance: prepare the already approved Bar/Kim Candidate.
- No story-, child-, companion-, page- or digest-specific branch in production
  code.

## 4. Risk of hardcoding

The lifecycle accepts only typed paths and digest-bound artifacts. Story and
companion identities are read from the validated candidate. Real digests exist
only in ignored request/evidence artifacts, never in executable code.

## 5. Files likely affected

- a new acceptance/publication lifecycle under `scripts/`;
- a dedicated hermetic lifecycle spec under `lib/__tests__/`;
- one narrow reusable existing-candidate loader in the enrichment lifecycle;
- workload-inventory coverage;
- `CURRENT.md` and implementation evidence;
- ignored real request, technical-review and publication-candidate artifacts.

No accepted Story Source, Visual Package, locator, Wizard, Board, provider,
render or deployment artifact changes during this milestone.

## 6. Expected behavior after change

- Exact Candidate, Review Bundle, technical PASS and Guy approval are jointly
  required.
- Any stale digest, altered inventory, symlink/hardlink, cross-story replay,
  malformed time, wrong approver or unaccepted technical result fails closed.
- The staged accepted bundle preserves the source story, directions, integrated
  source, candidate identity and review bytes exactly.
- Runtime eligibility remains false with an explicit requirement for a fresh
  Visual Contract.
- Exact staging replay is byte-idempotent.
- The publish operation refuses absent/unverified staging, collisions and
  noncanonical targets and writes one complete revision directory atomically.

## 7. Validation plan

- dedicated unit/integration tests for preparation, replay, rejection,
  containment, collision and temp-root publication;
- existing Visual Directions and creative-replacement lifecycle suites;
- accepted-source and runtime loaders remain unchanged;
- a real `write:true` staging followed by exact `created:false` replay;
- real `publish --write false` only; no canonical publication before QA;
- TypeScript, Node syntax, diff hygiene and workload inventory.

## 8. Cost impact

`$0`. Zero provider, model, image, audio, Vision, storage, database or payment
calls. Zero renders.

## 9. Rollback plan

Before publication, rollback is deletion of the new ignored staging root and a
revert of the focused commit. After a later authorized publication, rollback is
locator-independent because the accepted revision is immutable and remains
runtime-ineligible until a fresh package is separately approved.

## 10. Review assignment

- Guy has already made the exact product decision for the Candidate and Review.
- Claude Code must falsify binding, replay, containment, atomicity, identity
  preservation, runtime ineligibility and the absence of publication during the
  reviewed preparation run.
- No Claude Cowork decision is needed; no new creative content is introduced.
- Guy need not eyeball new imagery because no image is generated.

## 11. Stop-check resolution

1. General system, not story-specific patch: yes.
2. Other stories/styles can break only if generic loading or canonical accepted
   paths drift; hermetic cross-story and replay tests cover that risk.
3. Production behavior changes only after a later explicit publish and still
   remains locator-ineligible; this milestone changes none.
4. Cost: none.
5. Smallest proof: temp-root publish plus real ignored staging/replay.
6. Guy decision: exact Candidate/Review approval — received.
7. Claude targets: authority binding, path attacks, partial writes, replay,
   accepted-target collision and capability reachability.
8. Creative consultation: unnecessary.
9. Guy visual inspection: unnecessary at this non-render step.

## 12. Do not do

- Do not call a provider or generate an image/audio asset.
- Do not publish the real accepted revision before Claude Code PASS.
- Do not author or migrate a Blueprint/Visual Contract in this milestone.
- Do not assemble or approve a Visual Package.
- Do not change a locator, Wizard sellability, deployment or production state.
- Do not touch or stage the four pre-existing untracked Board artifacts.
