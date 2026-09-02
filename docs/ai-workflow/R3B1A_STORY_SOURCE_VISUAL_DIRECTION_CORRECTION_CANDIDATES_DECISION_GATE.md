# R3-B1a Story Source / Visual Direction Correction Candidates — Decision Gate

Date: 2026-09-03
Product owner: Guy
Technical owner: Codex
Implementation branch: `codex/r3b1a-story-correction-candidates`
Worktree: `C:\GNart\Work\sh-r3b0b-story-source-review`
Base: `462aaf4c19c7e8809284a96579fb993400e5a593`
Milestone: R3-B1a, zero-cost correction-candidate preparation only

## 1. Proposed change

Prepare one deterministic, content-addressed correction-candidate batch for the
exact 17 records in R3-B0b batch
`7a8434c76f90bc96776909430e93fecb97f2c8a08800085d0ba3e55d7f97a143`.
The batch will bind exact Story Source and Visual Direction corrections,
boy/girl projections, proposed continuity intent, unresolved creative review
items, and an explicit per-record disposition. It remains review-only.

The implementation will also stop the readiness audit from describing a
fixed-female Story Source as boy/girl-ready merely because its placeholders are
syntactically resolved.

## 2. Why now?

Claude Code independently passed the R3-B0b preparation mechanism, including
its exact source-byte graph and provider-free import closure. That PASS did not
approve the candidate content. Page-by-page review of all 17 exact pairs found:

- all 17 source manifests are legacy `story_text_only` v1 and all 17 sources
  still declare `gender: female`;
- the current personalization gate misses child-gender errors that are not a
  narrow marker directly adjacent to the child name;
- the exact review produced 14 `HOLD`, 3 `REVIEW`, and 0 content `PASS`
  dispositions before correction;
- material Visual Direction defects include eight definite child-pronoun leaks,
  prop/state discontinuities, and five records that fail the existing
  composition policy;
- the current enrichment lifecycle only consumes an accepted creative-
  replacement parent, requires Chameleon-specific appearance-state authority
  even for companions with no state transition, and overmatches unrelated
  clothing words;
- narration remains a separate gate, including seven critical `ספר` findings
  in `fox_uri_fantasy` and uncovered reported homographs such as `הד`, `ברח`,
  `ספרה`, and `לתפוח`.

The missing layer is therefore a truthful, scalable correction-candidate
boundary. Directly accepting the R3-B0b JSON would publish known defects.

## 3. Scope

This is a general system change plus exact review data. It will:

1. recompute R3-B0b from tracked authority and require the exact batch and
   record digests instead of trusting an ignored output file;
2. validate one tracked correction plan with exactly the 17 sorted matrix-
   derived records and no hidden acceptance fields;
3. support exact source replacements that preserve the current female prose
   byte-for-byte while producing a canonical `gender: neutral` candidate and
   complete boy/girl projections;
4. support typed Visual Direction edits, including the existing prose fields
   and the closed `shotType`/`cameraAngle` fields needed for composition repair;
5. require new candidate Visual Directions to use explicit names or
   `the child`, not singular English gender pronouns;
6. carry proposed `continuityIntent` and reviewer-owned `worldMode` as
   recommendations, never as accepted authority;
7. distinguish exact mechanical corrections from issues that require a later
   creative Story Source decision;
8. correct enrichment preflight so a valid empty companion-state transition
   list does not require an appearance-state axis, while a non-empty transition
   still fails closed without one;
9. narrow child-wardrobe prose detection to child-attributed claims rather
   than unrelated socks, shorts, uniforms, or supporting-character clothing;
10. optionally write one immutable atomic candidate batch beneath `outputs/`.

R3-B1a may prepare all 17 records, but it may not call any record accepted,
render-ready, sellable, or production-eligible.

## 4. Risk of hardcoding

The exact review findings are story data, but the mechanism must remain general:

- membership comes from the complete Wizard matrix and the R3-B0b predicate;
- every correction binds the source batch record digest and exact old bytes;
- source and Visual Direction edits use closed typed operations;
- no runtime branch may inspect a story key, companion name, child name, or page
  number to change behavior;
- the current exact batch digest is an intentional migration fence, not a
  permanent product special case.

## 5. Files likely affected

- one correction-batch module under `lib/visual-package/`;
- one zero-cost operator CLI under `scripts/` and one `package.json` script;
- a backwards-compatible extension of
  `scripts/materialize-story-source-revision.cjs`;
- focused corrections in
  `scripts/story-source-visual-direction-enrichment-lifecycle.cjs`;
- the all-story readiness analyzer;
- one tracked exact correction plan under the approved Story Source review
  request area;
- focused unit/integration specs and the milestone evidence/current-state docs.

The acceptance publisher is out of scope unless a loader-only compatibility
change is proven necessary for candidate validation. Publication remains a
later milestone.

## 6. Expected behavior after change

- A dry run deterministically evaluates exactly 17 correction records and 208
  pages with zero writes.
- Every mechanically eligible source candidate declares `gender: neutral`,
  preserves the original female prose projection, and exposes complete boy and
  girl review projections.
- Every candidate direction record is canonical, composition-valid, free of
  singular English gender pronouns, and bound to its exact source record.
- Every record exposes unresolved creative, narration, companion-state,
  wardrobe, world-mode, and human-review requirements honestly.
- Fixed-female candidate sources no longer count as supported boy/girl-ready in
  the readiness report.
- The existing accepted Chameleon bedtime revision, package, and locator remain
  byte-identical; strict readiness intentionally remains 1/18.

## 7. Validation plan

The smallest safe proof is provider-free:

- exact 17/1 membership, 5/6/6 direction counts, six 16-page fantasy records,
  and 208 total pages;
- exact batch/record/raw-SHA bindings and deterministic replay;
- complete plan coverage, exact occurrence counts, rejected overlaps and
  source/record swaps;
- female-prose identity and resolved boy/girl projection checks;
- Visual Direction shape, neutral-pronoun, composition, continuity-bound, and
  protected-authority checks;
- dry-run no-write, atomic write/idempotent replay, collision/path/link/hardlink
  rejection, and zero external counters;
- readiness regression proving no false boy/girl readiness and no publication;
- `npx tsc --noEmit`, focused tests, `git diff --check`, and `npm run check`,
  with inherited fixture/RPC failures reported rather than relabeled PASS.

No image, audio, PDF, page sample, or full book is needed for this milestone.

## 8. Cost impact

Provider calls: 0. Network calls: 0. Image renders: 0. Audio renders: 0.
PDF renders: 0. Database/storage/order/payment/deployment writes: 0.
Maximum spend: USD 0.

Visual Contract, Blueprint, Board/prop, LOW-page, HIGH-page, or full-book work
requires a later exact budget gate.

## 9. Rollback plan

Revert only the focused R3-B1a implementation commit. Remove an ignored output
artifact only after verifying its exact content-addressed path. No accepted
revision, current locator, package, order, or production rollback is required.

## 10. Review assignment

- Guy has authorized Codex to continue the zero-cost preparation work. Guy must
  later approve the exact corrected digests, world mode, wardrobe choices, and
  any creative Story Source changes before publication.
- Claude Code must try to falsify membership, source-byte binding, projection
  completeness, female-prose preservation, edit occurrence counts, composition,
  continuity, filesystem safety, determinism, authority non-escalation, and the
  truthful readiness result.
- Claude Cowork must review `lion_shaket_adventure` story quality before Guy's
  exact acceptance. It should also review any later source-prose rewrite or
  density-driven editorial change.
- Guy should eyeball a compact correction packet, not 208 unfiltered pages,
  before publication. Visual quality still requires separately authorized LOW
  samples afterward.

## 11. Do not do

- Do not mutate historical QA, source, receipt, review-batch, or accepted bytes.
- Do not invent Guy or Claude approval, timestamps, decisions, or PASS.
- Do not publish an accepted v2/v3 revision, package, or locator.
- Do not change production flags, Wizard catalog availability, checkout,
  payment, orders, deployment, or runtime fallback behavior.
- Do not silently repair a creative source inconsistency under the mechanical
  female-projection-preserving lane.
- Do not infer a wardrobe transition or pajamas from the `bedtime` label.
- Do not infer `worldMode` from direction/category labels.
- Do not weaken the 0.70 resemblance threshold.
- Do not call a provider or render any page or book.

## 12. Stop-check

1. General solution? Yes: one matrix/digest-bound correction boundary, with
   exact story edits represented as data.
2. Cross-story risk? Yes; controlled by closed operations, all-17 coverage,
   exact hashes, and hostile swap/tamper tests.
3. Production impact? None; candidates remain ineligible and unpublished.
4. Spend? USD 0.
5. Smallest proof? One exact dry run plus immutable replay and focused tests.
6. Unresolved owner decisions? Exact acceptance, creative prose changes,
   `worldMode`, concrete wardrobe, narration ear choice, and paid waves remain
   pending; none is needed to prepare review-only candidates.
7. Claude Code targets? Identity, determinism, safety, projections, composition,
   continuity, zero effects, and non-escalation.
8. Claude Cowork? Mandatory for `lion_shaket_adventure`; required for later
   creative rewrites, optional for purely mechanical corrections.
9. Guy eyeball? The final compact correction packet before any publication.
