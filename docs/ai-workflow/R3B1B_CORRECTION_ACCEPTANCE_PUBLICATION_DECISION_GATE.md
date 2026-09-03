# R3-B1b Correction Acceptance and Publication — Decision Gate

Date: 2026-09-03

Product owner: Guy

Technical owner: Codex

Status: **DRAFT — waiting for P1-P5/P7/P8 intent, P6 Cowork referral,
and D1-D13 directions**

Proposed branch: `codex/r3b1b-correction-acceptance-publication`

Proposed milestone: R3-B1b, zero-cost correction disposition and accepted-source
publication only

## 1. Proposed change

Add a correction-aware, digest-bound lifecycle that can record Guy's exact
product/visual decision for one R3-B1a record and, only after every applicable
correction acceptance/publication gate passes, publish a complete accepted Story
Source / Visual Direction authority bundle with explicit correction provenance.

The first proof will use one accepted, issue-free record only. The recommended
record is `dragon_dini_adventure`, digest
`16ab0316f197aff6afae4ad42419c1f3b7d7cc285c71f0a16d75000426cc4046`.
Further records advance in bounded waves; HOLD records cannot enter the path
until their D1-D13 decisions are materialized into new candidate digests.

## 2. Why now?

R3-B1a is independently QA-passed and has produced truthful candidates, but it
intentionally stops before acceptance. The current generic lifecycle rejects a
correction candidate with:

- `story_source_visual_direction_correction_review_not_implemented`; and
- `story_source_visual_direction_correction_promotion_not_implemented`.

Those fences are correct. The existing accepted-v3 publisher consumes an
enrichment candidate derived from already accepted creative-replacement
authority. An R3-B1a correction has different provenance. Removing the fences
or relabeling correction files as enrichment-v3 would falsely claim lineage.

## 3. Scope

This is a general system change. It will:

1. consume one exact R3-B1a batch digest, record digest, request digest, source
   hashes, candidate hashes, Claude Code technical-PASS range, and the exact
   product-decision packet identity: 18,413 bytes, raw SHA-256
   `cbe65b9687d04bba5fdf691a4a0f0275297bc79e5195d8eb0d68a36e9deb3d78`,
   plus the packet Git commit supplied in the handoff and Guy's response;
2. consume a closed product-decision envelope that identifies Guy, the exact
   accepted digest, the accepted `worldMode`, explicit issue dispositions, and
   any required Cowork/narration state without inventing missing decisions;
3. keep the immutable R3-B1a proposal unchanged and write dispositions
   separately;
4. introduce a new accepted schema version with explicit correction provenance
   rather than silently widening or renaming accepted v3;
5. reuse or extract the proven v3 safety kernel for exact identity binding,
   complete inventory, atomic staging, immutable replay, collision/path/link/
   hardlink rejection, and no partial authority;
6. teach `loadAcceptedStorySourceAuthoringAuthority` one closed, validated
   correction-lineage branch;
7. expose the accepted source as authoring authority only. It remains
   non-render-qualified until Visual Contract, Blueprint, Board/prop, Visual
   Package, locator, narration, and release gates pass;
8. update the all-story readiness audit truthfully after each accepted record.

## 4. Risk of hardcoding

The first record is a proof input, not a runtime condition. No code may inspect
story key, direction, companion name, page number, or child name to choose a
validation or publication path. Eligibility must derive entirely from schema,
digests, declared issue dispositions, review requirements, and accepted
authority. `dragon_dini_fantasy` companion surface-change work remains a
separate typed-authority addition after D6; it cannot be special-cased here or
forced dishonestly into the existing four-role appearance axis.

## 5. Files likely affected

- a new correction disposition/acceptance lifecycle module under `scripts/`;
- a provider-free operator CLI and focused package script;
- the R3-B1a correction candidate loader or a narrow shared validation leaf;
- `lib/visual-package/acceptedStorySourceAuthoringAuthority.ts`;
- the all-story readiness audit and CLI;
- new correction-specific acceptance/publication tests;
- workload-classifier coverage if a new test file is added;
- one tracked, digest-bound product-decision input after Guy decides;
- one accepted revision directory only after every applicable correction
  acceptance/publication gate passes;
- `CURRENT.md`, `ROADMAP.md`, and implementation evidence.

The implementation must first inventory the existing v3 safety kernel and
extract shared code only where identical invariants are proven. It must not
duplicate or weaken validation merely to shorten the milestone.

## 6. Expected behavior after change

- Missing, partial, stale, cross-record, wrong-batch, wrong-source, wrong-output,
  fabricated-review, or unresolved-HOLD input fails before staging.
- A P record cannot publish unless Guy accepted its exact record digest and
  `worldMode`; P6 also requires the exact Cowork review disposition.
- A D record cannot reuse the old digest after a source/VD decision changes it.
- Human narration acceptance can remain separately pending and is preserved as
  an external product gate even though the current all-story audit has no
  human-ear boolean. The source-derived automated narration preflight is
  recomputed from the accepted neutral source and may become ready independently;
  it is never called an ear-test PASS.
- A successful first proof publishes one complete immutable accepted-authority
  inventory, replays byte-identically, and grants no package/render authority.
- Chameleon and all historical accepted revisions remain byte-identical and
  load through their existing paths.
- The resemblance threshold stays 0.70.

## 7. Validation plan

The smallest safe proof is provider-free and single-record:

1. dry-run a proposed P1 product-decision envelope with zero writes;
2. reject absent Guy decision, wrong packet bytes/SHA/commit, wrong record digest,
   wrong `worldMode`, unresolved issue, missing Cowork requirement, source/output
   swap, stale batch, altered Claude range, partial inventory, collision,
   traversal, symlink, junction and hardlink aliases;
3. atomically publish one complete accepted-authority bundle into a temporary
   test root, replay it immutably, and reject conflicting bytes;
4. prove the strict loader accepts that one exact new lineage and still rejects
   malformed, legacy-v2, correction-pending and forged-v3 inputs;
5. produce and assert an exact before/after readiness diff, with every delta
   derived from the accepted bytes and lineage. Expected one-record changes
   include accepted lineage, supported gender projection, automated narration
   preflight, and the product-corpus decision state. Narration input and the
   critical-TTS count are already true/18 and should remain unchanged; soft-TTS
   counts and corpus-conflict evidence must be recomputed and asserted rather
   than assumed. The audit does not model a human-ear boolean, so preserve that
   separate gate explicitly, while visual-package/render qualification remains
   false;
6. prove all other 17 catalog records and the accepted Chameleon authority are
   byte-identical and behaviorally unchanged;
7. run `npx tsc --noEmit`, focused tests, `git diff --check`, and `npm run check`,
   disclosing inherited fixture/RPC failures without calling the overall command
   PASS.

No production accepted directory is written until the same implementation is
green, independently reviewed, and Guy re-confirms the exact final digest.

## 8. Cost impact

Provider calls: 0. Network calls: 0. Image renders: 0. Audio renders: 0.
PDF renders: 0. Database/storage/order/payment/deployment writes: 0.
Maximum spend: USD 0.

Visual Contracts, Blueprints, Boards/props, LOW samples, HIGH pages, or full-book
renders require later exact cost gates. The current 1–16-page policy remains
valid; no new page-count exception is needed.

## 9. Rollback plan

Revert the focused implementation commit and remove only an exact newly
published revision that has not been referenced by a package, locator, order or
runtime authority, after proving containment and ownership. Prefer proving the
entire lifecycle in temporary roots before any canonical publication so normal
rollback is code-only. Never rewrite a historical accepted revision.

## 10. Review assignment

- Guy must provide acceptance intent for P1-P5/P7/P8 and directions for D1-D13,
  including each exact current digest, `worldMode`, accepted continuity intent,
  confirmation that no authored wardrobe transition exists, and any rejection.
  Concrete wardrobe is deferred to the Visual Contract.
- Guy initially authorizes only Cowork referral for P6. Claude Cowork must review
  `lion_shaket_adventure` before Guy's later exact P6 acceptance and
  should review any material new prose generated from D decisions.
- Claude Code must independently falsify identity binding, provenance truth,
  product-decision totality, issue closure, staging atomicity, immutable replay,
  filesystem alias safety, old-lineage compatibility, readiness honesty, and
  zero effects.
- Guy must re-confirm the exact final accepted digest after implementation QA
  and before canonical publication.

## 11. Do not do

- Do not remove or bypass the two existing correction lifecycle fences.
- Do not relabel correction provenance as enrichment-v3.
- Do not treat the aggregate 353,307-byte batch as a pending revision.
- Do not invent Guy/Cowork/Claude decisions, identity, timestamps or PASS.
- Do not accept a HOLD record, net issues together, or reuse a pre-correction
  digest after a D decision changes bytes.
- Do not equate product acceptance, automated narration preflight, accepted
  source authority, render qualification, sellability, or launch readiness.
- Do not infer pajamas or a wardrobe transition from `bedtime`.
- Do not modify prompts, image generation, companions, anchors, production
  flags, Wizard catalog, checkout, payments, orders, deployment, or fallback.
- Do not change the 0.70 resemblance threshold.
- Do not call a provider or render any page/book.

## 12. Stop-check

1. **General solution?** Yes: one schema/digest/provenance-bound correction
   acceptance path, not story-specific logic.
2. **Cross-story risk?** High; controlled by single-record proof, exact identity,
   unchanged-lineage tests and bounded waves.
3. **Production impact?** Accepted authoring authority only after every
   applicable correction acceptance/publication gate; package/render/runtime
   behavior remains unchanged.
4. **Spend?** USD 0.
5. **Smallest proof?** One issue-free record in temporary roots, no canonical
   write before QA and final confirmation.
6. **Unresolved owner decisions?** P1-P5/P7/P8 acceptance intent, D1-D13
   directions, initial P6 Cowork referral, Guy's later exact P6 decision after
   Cowork, narration ear acceptance, and final canonical-publication
   confirmation.
7. **Claude Code targets?** Totality, provenance, filesystem safety, replay,
   compatibility, readiness honesty and zero effects.
8. **Claude Cowork?** Required for P6 and any material new prose.
9. **Guy eyeball?** The compact packet now; the exact final digest before
   canonical publication; later LOW visual samples before wider rendering.

**Gate disposition:** STOP. Packet preparation is complete, but implementation
does not begin until Guy explicitly approves the packet decisions and this gate.
