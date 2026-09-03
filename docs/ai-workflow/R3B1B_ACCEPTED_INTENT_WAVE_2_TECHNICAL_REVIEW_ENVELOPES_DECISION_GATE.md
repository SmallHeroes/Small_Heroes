# R3-B1b Accepted-Intent Wave 2 Technical-Review Envelopes — Decision Gate

Date: 2026-09-04

Product owner: Guy

Technical owner: Codex

Status: **GO FOR SIX ZERO-COST TECHNICAL-REVIEW ENVELOPES UNDER THE PASSED
WAVE-2 PREPARATION; STOP BEFORE GUY FINAL DIGEST CONFIRMATION OR PUBLICATION**

Branch: `codex/r3b1b-accepted-intent-wave-2`

Base: `f5fc5fb365fffd00936cfeb20c0596e25bed165b`

Authority comes from Guy's approved R3-B1b packet/gate, his instruction to
advance all eligible stories together, and the independently passed wave-2
preparation. Claude Code's final exact PASS range is
`0f1af28ce4ae8dc51a69d4f54d5b0138d1c2b398..d47fe4e9abaf1eb1ebc76d4e4d97918409840501`
with P0/P1/P2 all zero. The later `f5fc5fb3` commit only records that external
PASS and is not represented as part of Claude's reviewed range.

## 1. Proposed change

Create six canonical, digest-bound correction technical-review v2 envelopes,
one for each eligible record P2-P5/P7/P8, in one bounded operational batch.
Each envelope transcribes the same real Claude Code PASS range and separately
binds its own candidate batch, product decision, record decision and future
revision digest.

No production abstraction or schema change is needed.

## 2. Observed and expected behavior

Observed: all six candidates are materialized, replay-stable and independently
passed, but `inspect` still reports
`pending_implementation_technical_review_and_final_confirmation` because no
technical-review envelope exists for any of them.

Expected: six unique canonical envelopes exist under ignored `outputs/`, each
valid for exactly one inspected record and the real PASS range. The candidates
remain runtime/production-ineligible and continue to require Guy's exact final
digest confirmation. No canonical Story Source is published.

## 3. Root cause and scope

The remaining technical-review requirement is intentional lifecycle state, not
a code defect. The correction lifecycle accepts only per-record review identity;
there is no truthful single-envelope shortcut for six different record-decision
and revision digests.

Scope is bounded operational review data plus gate/evidence/current-state docs:

- P2 `bunny_ometz_adventure`;
- P3 `bunny_ometz_fantasy`;
- P4 `chameleon_koko_adventure`;
- P5 `fox_uri_bedtime`;
- P7 `lion_shaket_fantasy`; and
- P8 `panda_anat_bedtime`.

P1, P6, all HOLD/D records, product acceptance, narration, Visual Contracts,
Blueprints, Boards/props, packages, rendering and release remain outside scope.

## 4. Risk of hardcoding and rejected alternatives

The six identities are selected from the approved decision and reproduced
immutable batch, not runtime conditionals. Every envelope uses the general v2
schema and the generic `inspect` identity.

Rejected:

- one shared envelope, because record-decision and revision identities differ;
- using the earlier HOLD range as PASS, because that would falsify QA history;
- using `417d0807..d47fe4e9` as a single reviewed range, because Claude did not
  issue that exact combined-range verdict;
- using the later documentation closeout head `f5fc5fb3` as reviewed, because
  Claude's PASS ended at `d47fe4e9`;
- creating product acceptance or publishing alongside the envelopes, because
  those are separate Guy gates and could reduce Wizard sellability to 11/18.

## 5. Files and artifacts

Tracked:

- this Decision Gate;
- a focused implementation-evidence document;
- `CURRENT.md`; and
- `ROADMAP.md`.

Ignored/reproducible:

- six canonical JSON files under
  `outputs/r3b1b-accepted-intent-wave-2/technical-reviews/`; and
- one independent-QA handoff under the same milestone output root.

No production/test source, accepted-source revision, approval receipt, package,
locator, environment or deployment file changes.

## 6. Expected behavior after change

- exactly six technical-review v2 envelopes exist and have distinct digests;
- all use reviewer `Claude Code`, status `pass`, exact range
  `0f1af28c..d47fe4e9`, and P0/P1/P2 `0/0/0`;
- every envelope's four bound identities match fresh lifecycle `inspect` output;
- recomputation produces byte-identical canonical JSON;
- no Guy acceptance artifact exists;
- the accepted tree and Wizard 17/18 state remain unchanged;
- all external-effect counters and spend remain zero.

## 7. Validation plan

1. Freshly inspect all six pending manifests.
2. Derive each canonical envelope and digest from the inspected identities.
3. Verify exact keys, canonical byte form, canonical digest, unique digest and
   one-to-one story/record/revision mapping.
4. Recompute all six expected bytes without writing and compare byte-for-byte.
5. Prove no product-acceptance or accepted-source artifact was created.
6. Run the correction-batch and correction-acceptance lifecycle specs.
7. Run `npx tsc --noEmit`, autonomous typecheck and diff hygiene.
8. Send one read-only Claude Code handoff for the exact tracked range plus the
   six ignored envelopes.

No image, audio, page or book render is required.

## 8. Cost impact

Provider/model/network calls 0; image/audio/PDF renders 0; database, storage,
order, payment and deployment writes 0; maximum spend USD 0. The resemblance
threshold remains 0.70.

## 9. Rollback plan

Revert the focused documentation commit. The ignored review envelopes are
non-authoritative and content-addressed; retain them for reproducible QA or
remove them only in a separately verified cleanup. No canonical rollback is
required.

## 10. Review assignment

Guy has no unresolved product choice inside this preparation. After independent
technical PASS he must still confirm or reject each exact revision digest and
choose publication/package sequencing.

Claude Code must falsify reviewer/range/finding counts, batch/product/record/
revision identity, canonical digest, uniqueness, completeness, replay, absence
of Guy acceptance/canonical publication, zero effects and unchanged 17/18
sellability. Cowork is not required for this technical binding; P6 remains on
its separate Cowork gate.

## 11. Do not do

Do not create Guy product-acceptance receipts, publish canonical revisions,
reuse legacy packages, author Visual Contracts, change Wizard availability,
render, narrate, deploy, push or spend money in this milestone.

## Stop-check

1. General system or story patch? Existing generic lifecycle; per-record review
   data only.
2. Cross-story risk? Bounded by immutable per-record digests; no runtime change.
3. Production behavior? None.
4. Spend? USD 0.
5. Smallest proof? Six canonical envelopes, fresh inspect comparison, two
   focused specs and typechecks.
6. Guy decision before implementation? None unresolved; final digest and
   publication/package decisions remain later.
7. Claude target? Exact QA provenance, per-record identity, canonical bytes,
   completeness and zero downstream authority.
8. Cowork? No for technical binding; yes separately for P6.
9. Guy eyeball? One consolidated six-digest packet after technical PASS.
