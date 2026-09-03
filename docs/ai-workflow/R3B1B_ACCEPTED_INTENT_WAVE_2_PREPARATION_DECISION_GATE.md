# R3-B1b Accepted-Intent Wave 2 Preparation — Decision Gate

Date: 2026-09-03

Product owner: Guy

Technical owner: Codex

Status: **ZERO-COST PREPARATION INDEPENDENTLY PASSED; STOP BEFORE TECHNICAL
ACCEPTANCE, FINAL DIGEST CONFIRMATION OR PUBLICATION**

Branch: `codex/r3b1b-accepted-intent-wave-2`

Base: `417d0807d1d7226d57845cbfbf31e65653d64d54`

Authority comes from Guy's approved packet commit `19f110f4`, exact candidate
batch `96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`,
acceptance intent for P2-P5/P7/P8, and the existing R3-B1b rule that later
eligible records advance in bounded waves. This gate narrows the present action to
preparation and evidence. It does not convert intent into final acceptance.

## 1. Proposed change

Prepare the six eligible accepted-intent records as one bounded review wave using
the already independently passed correction-v4 lifecycle. Reproduce the exact
R3-B1a batch, materialize one immutable pending candidate per record, derive
each exact future revision digest with `inspect`, and publish one consolidated
technical-review packet.

No new production abstraction or story-specific runtime path is required.

## 2. Why now?

P1 proved and closed the lifecycle. These six records already have exact Guy
acceptance intent, exact world-mode decisions, zero unresolved creative-source
issues, zero protected-authority issues and zero critical TTS items. Four
records retain **10 soft narration-review items**, all for the ambiguous lemma
`שם`: P4 has 2 on page 8, P5 has 2 on page 3, P7 has 4 on pages 2 and 9, and
P8 has 2 on page 5; P2 and P3 have none. These items remain substantive input
to the separate narration-pronunciation and human-ear gate. Preparing the
source/Visual Direction identities together avoids six repetitive operational
cycles without weakening per-record identity or approval.

## 3. Scope

This is a bounded operational preparation using the general lifecycle:

- P2 `bunny_ometz_adventure`;
- P3 `bunny_ometz_fantasy`;
- P4 `chameleon_koko_adventure`;
- P5 `fox_uri_bedtime`;
- P7 `lion_shaket_fantasy`; and
- P8 `panda_anat_bedtime`.

Each record retains its own record, Story Source, Visual Direction, pending
manifest and revision identities. Generated candidates remain ignored under
`outputs/`; only the gate, evidence and canonical project-state documentation
are tracked.

P1, P6, all HOLD/D records, narration ear acceptance, Visual Contracts,
Blueprints, Boards/props, packages, render eligibility and release are outside
this wave.

## 4. Risk of hardcoding

The selected records come from the approved decision IDs and immutable batch,
not from runtime conditionals. No production code branches on these story keys.
The existing generic materializer and lifecycle validate every record using the
same schemas and digest bindings. A future wave may use the same commands with
another independently eligible decision set.

## 5. Files and artifacts

Tracked:

- this Decision Gate;
- `R3B1B_ACCEPTED_INTENT_WAVE_2_PREPARATION_EVIDENCE.md`;
- `CURRENT.md`; and
- `ROADMAP.md`.

Ignored/reproducible:

- the exact R3-B1a batch artifact; and
- six request/candidate directories beneath its bound request identity.

No production TypeScript/JavaScript, accepted-source directory, package,
locator or deployment file changes.

## 6. Expected behavior

- All six candidates materialize once and replay with `created:false`.
- Every `inspect` result is
  `pending_implementation_technical_review_and_final_confirmation`.
- Runtime eligibility stays false with reason
  `accepted_story_source_requires_fresh_visual_contract`.
- All ten external-effect counters remain zero for every record.
- The canonical accepted tree remains unchanged.
- Wizard sellability remains 17/18 during preparation. Publishing all six
  accepted sources before exact-source packages exist would be expected to
  fail closed on six additional slots and reduce sellability to 11/18. That
  consequence is not authorized by Guy's separate P1-only 17/18 decision and
  must be independently verified and separately decided before publication.
- One technical QA pass can review the six identities together; later Guy
  confirmation and publication still remain exact per record.

## 7. Validation plan

1. Reproduce batch digest `96154a...` in dry-run and write/replay modes.
2. Materialize/replay all six and verify six files per record.
3. Run `inspect` for all six and record exact revision digests and pending gates.
4. Prove no accepted-tree or tracked production change.
5. Run correction-batch plus correction-acceptance lifecycle tests.
6. Run both TypeScript checks and diff hygiene.
7. Send one read-only Claude Code handoff for the exact docs-only range plus the
   reproducible ignored artifacts.

No image, page, audio or full-book render is needed.

## 8. Cost impact

Provider calls 0; network model calls 0; image/audio/PDF renders 0; database,
storage, order, payment and deployment writes 0; maximum spend USD 0. The 0.70
resemblance threshold is unchanged.

## 9. Rollback plan

Revert the focused documentation commit. The ignored candidate outputs are
non-authoritative and content-addressed; they may be retained for reproducible
QA or removed later in a separately verified cleanup. No canonical rollback is
required because this wave writes no accepted authority.

## 10. Review assignment

Claude Code must falsify batch/decision/record/source/Visual Direction/manifest/
revision identity, replay, record selection, effect counters, zero canonical
change and the projected 17/18-to-11/18 publication consequence. Guy later
chooses publication/package sequencing and confirms or rejects the six exact
revision digests after technical PASS. Cowork is not required for the already
decided Story Source / Visual Direction intent of P2-P5/P7/P8; it remains
required for P6. The 10 soft narration-review items remain open for the
separate narration-pronunciation and human-ear workflow.

## 11. Independent QA result and correction closeout

Claude Code reviewed exact range
`417d0807d1d7226d57845cbfbf31e65653d64d54..0f1af28ce4ae8dc51a69d4f54d5b0138d1c2b398`
read-only and returned **HOLD with no P0, one P1 and one P2**. It independently
verified the preparation topology, all six identities and future revision
digests, materialized inventories, replay, 20/20 focused tests, both
typechecks, zero effects and the projected 17/18-to-11/18 publication
consequence. The P1 identified the false zero-soft-TTS statement corrected
above. The P2 required the P1 push record to distinguish Guy's report from
what Git itself proves. No implementation defect was found.

Claude Code then independently re-gated exact correction range
`0f1af28ce4ae8dc51a69d4f54d5b0138d1c2b398..d47fe4e9abaf1eb1ebc76d4e4d97918409840501`
read-only and returned **PASS with no P0/P1/P2**. It reproduced the per-record
soft counts `0/0/2/2/4/2`, the 10-of-24 wave/batch total, symmetric boy/girl
locations, zero creative/protected/critical items, the corrected push
attribution, clean five-document scope and zero effects. Both prior findings
are closed. This PASS covers the preparation and its documentation correction;
it grants no technical-review envelope, product acceptance, publication,
package, Visual Contract, render, narration, deployment or spend authority.

## 12. Do not do

Do not create technical PASS envelopes before independent review. Do not create
Guy final-acceptance receipts, publish canonical revisions, enable Wizard slots,
reuse legacy packages, author Visual Contracts, render, narrate, deploy, push or
spend money in this milestone.

## Stop-check

1. General mechanism or story patch? Existing general mechanism; bounded data
   selection only.
2. Cross-story risk? Limited to ignored artifacts and documentation; every
   record is independently digest-bound.
3. Production behavior? None.
4. Spend? USD 0.
5. Smallest proof? Six materialize/inspect/replay operations plus two focused
   specs and typechecks.
6. Guy decision still required? Publication/package sequencing given the
   projected temporary 11/18 state, then exact six revision confirmations.
7. Claude target? Identity, reproducibility, selection totality, zero effects
   and the fail-closed catalog projection.
8. Cowork? No for P2-P5/P7/P8; yes separately for P6.
9. Guy eyeball? One consolidated digest packet, not six separate workflows.
