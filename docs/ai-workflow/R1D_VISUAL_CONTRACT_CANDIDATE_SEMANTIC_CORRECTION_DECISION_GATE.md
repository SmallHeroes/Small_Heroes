# R1D Visual Contract Candidate Semantic Correction — Decision Gate

**Date:** 2026-08-26
**Owner:** Codex (Technical Owner)
**Product authority:** Guy
**Branch/worktree:** `codex/r1d-qa-wizard-downstream-lifecycle` / `C:\GNart\Work\sh-live-chameleon-v3`
**Implementation base:** `4c34e05bf1633ca0f083a0dd1184025783d5f278`
**Cost allowance for this milestone:** `$0`; no provider, image, audio, Wizard order, or render

## 1. Proposed change

Add a general, immutable `visual-contract-candidate-semantic-correction/v1`
overlay for a receipt-bound Visual Contract Candidate. The original paid
Candidate remains byte-immutable and continues to prove exactly what the
provider run produced. The overlay:

1. loads and re-attests the exact historical paid bridge-v4 chain byte-for-
   byte through a frozen, read-only compatibility loader locked to its
   observed versions, canonical bytes, digests, paths and cross-links; it
   does not recompile the draft, rebuild the Candidate with current builders,
   or pass the original template through the current compiler/package loader;
2. accepts only a closed, typed semantic-correction plan;
3. derives or bounds every correction from existing source/template authority;
4. re-anchors every Action Semantic Coverage record to the exact Source
   Evidence Catalog page and excerpt;
5. emits corrected template/coverage projections, a full content review and a
   pending manifest;
6. requires exact later `Guy` approval of those immutable bytes; and
7. lets a new bridge-manifest version combine the original paid authority with
   the approved overlay and build a fresh pending reconciliation.

The closed operation set is:

- `cover_visible_recurring_prop`: remove `firstRevealPage` and its exact
  compiler projection only when the plan binds one exact cover `mustShow`
  value and the current prop/lifecycle before-state;
- `refresh_action_spatial_projection`: replace only a named action's legacy
  kind-only spatial projection with the compiler-derived description-aware
  projection;
- `add_source_grounded_human_presence`: derive identity, role, gender,
  aliases, presence and appearance from the exact current source/extractor,
  then add one bounded reviewed body-state representation;
- `represent_beat_with_cast_body_state`: bind one existing cast member and one
  exact source beat to a bounded reviewed body-state representation.

No operation accepts a generic JSON Pointer, raw patch, raw replacement
template, source phrase, identity, digest, or approval.

In parallel, fix the general compiler seams that created the bad state:

- spatial action prose uses the unique spatial-node description, not only its
  generic kind;
- the deterministic human-role domain recognizes only low-ambiguity,
  source-prose forms of kindergarten guards and has a closed appearance policy;
- presentation repair now has a pure, closed eligibility contract for an exact
  source beat, presentation class and permitted same-page pointer/value set,
  but no approved eligibility authority is yet persisted or digest-bound to a
  live snapshot/request. Policy v20 therefore supplies an empty eligibility
  set and fails closed with a typed capability gap; provider output cannot
  authorize its own route;
- the paid Candidate's cover/lifecycle contradiction is closed only by the
  typed `cover_visible_recurring_prop` correction, which binds exact
  recurring-prop, lifecycle, cover-`mustShow` and projection before-state.
  This milestone does not add a lexical `mustShow`/`mustNotShow` matcher;
  general future closure requires structured cover-to-prop binding.

## 2. Why now?

The paid Chameleon authoring call succeeded: one provider invocation produced
Candidate `be2d3202ef92b7d0d0e2d9647871bc590cb8ec9bf55465e450c9c8141e7bcbc9`
with 8 pages, 66 coverage records and zero current structural errors. It cost
about `$0.47` nominal / `$0.51` conservative. Rendering it now would preserve
four known semantic defects:

1. cover `mustShow` requires the lantern, cart and route labels while
   lifecycle-derived `mustNotShow` forbids those same props;
2. p5 has two distinct spatial targets but runtime prose collapses both to
   generic labels;
3. p7 source and approved direction require a kindergarten guard, but the
   closed extractor omits her from cast; and
4. p8 represents Kim closing both eyes with an unrelated satchel `mustShow`.

These are deterministic downstream authority defects, not a reason to spend
on another provider sample. They block a truthful Blueprint, package, Wizard
book and render.

## 3. Observed, expected, root cause, and contributing factors

### Observed

- The Candidate passes existing structural validation.
- The four defects are visible by comparing source, typed template and
  coverage; no hidden provider response is needed.
- The historical bridge-v4 chain proves the Candidate's exact receipt binding.
  Because current compiler and authoring versions have advanced, the
  correction lane must preserve that proof through frozen byte/digest/cross-
  link re-attestation rather than current-version Candidate reconstruction.

### Expected

- Paid bytes remain immutable and auditable.
- Any semantic correction has its own identity, review and approval.
- Every correction is source-bound, path-bounded, replayable and produces a
  new pending reconciliation.
- New authoring runs use description-aware spatial projections and exact guard
  extraction, while presentation-shaped gaps terminate unless independently
  approved eligibility is later wired. The historical cover defect is closed
  by the approved correction overlay, not by a new free-prose detector.
- A mixed frontier that contains both an unreviewed presentation gap and an
  otherwise repairable structural failure also terminates before repair. This
  is the deliberate safety tradeoff: a broad repair may not erase an
  unsupported beat and thereby make the provider authorize its own gap.

### Root causes

- Lifecycle validation checks projection containment but not a positive-cover
  contradiction against the same recurring prop.
- `refLabel` projects `SpatialNode.kind` and discards its unique description.
- `HUMAN_LEXICON` contains only doctor and parent even though the downstream
  policy already supports other non-relative roles.
- The historical presentation-repair route proved exact same-page pointer
  identity but did not require independent typed eligibility for the exact
  beat, class and permitted pointer/value set, so provider output could map a
  physical action to unrelated visible prose. The current compiler adds that
  closed eligibility contract and intentionally fails closed until an
  independent persisted authority is wired.

### Contributing factors

- Free prose still carries some cover and cast-state semantics that lack a
  structured binding.
- Structural validity is necessary but does not establish semantic fidelity.
- Candidate v9 is intentionally tied byte-for-byte to the authoring receipt;
  editing it in place would destroy provenance.

## 4. Scope

This is a **general system change** plus one immutable data plan for the real
Chameleon Candidate. Production code contains no Chameleon, Kim, Bar, page-5,
page-7 or page-8 literal.

Likely code scope:

- `lib/visual-contract-compiler/projectContractProse.ts`
- `lib/visual-contract-compiler/extractDeterministicFacts.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/presentationRequirementRepair.ts`
- `lib/visual-contract-compiler/templateDraftSchema.ts`
- `lib/visual-contract-compiler/validateBookVisualContract.ts`
- new `lib/visual-package/visualContractCandidateSemanticCorrectionLifecycle.ts`
- `lib/visual-package/qaWizardCandidateBridge.ts`
- `lib/visual-package/reconciliationAuthoringLifecycle.ts`
- exports, CLI, focused tests, `CURRENT.md`, and implementation evidence.

No Story Source, paid Candidate, receipt, replay evidence, existing
reconciliation, Board, Blueprint, package, locator, Registry, deployment, or
Production artifact is mutated in this milestone.

## 5. Risk of hardcoding

The implementation must fail review if any production module contains story,
companion, child, page or current digest literals. Real Chameleon coordinates
belong only in an external strict plan artifact. Operation semantics are
generic across stories and must prove exact before-state identities.

## 6. Expected behavior after change

- Original Candidate v9 remains byte-identical and receipt-reconstructable.
- A correction preview can prove the exact effective template/coverage and
  zero validation issues without writing.
- Writing persists only content-addressed pending/review artifacts after all
  validations and collision preflights pass.
- Rejection produces no partial output and no approval artifact.
- Approval accepts only exact `Guy` and a canonical real UTC timestamp,
  reloads and re-attests every historical input under the frozen profile,
  re-derives the correction from those exact bytes, and is idempotent.
- Every coverage record resolves to one exact same-page source catalog entry,
  and its `sourcePhrase` equals that entry's excerpt.
- The bridge rejects a pending or unapproved correction, reloads and re-attests
  the approved correction and its exact historical subject, preserves the
  original paid chain without recompiling it, validates the corrected
  effective template/coverage under current rules, and creates a fresh pending
  reconciliation.
- Existing bridge-v4/Candidate-v9 bytes remain immutable and readable only
  through the frozen historical loader; they are not accepted as current live-
  authoring artifacts, and no prior approval is transferred.
- Every refreshed spatial authority in the correction overlay/review records
  its projection version explicitly; `vc-schema/v4` alone is not treated as
  proof of whether legacy-kind or description-v2 prose authored stored bytes.
- Visual Contract enforcement remains hard-off in Production and explicit in
  QA. The current Chameleon package has no safety constraints, so its active
  PVB prompt cannot expose `[spatial:<id>]` through this projector. Before any
  future package with a spatial safety constraint is rendered, Guy makes an
  explicit product decision on retaining the marker or using a separate
  description-only provider projection.

## 7. Validation plan

Smallest proof is entirely offline:

1. pure compiler regressions for distinct same-kind spatial nodes and low-
   ambiguity guard extraction; pure-helper tests for exact typed presentation
   eligibility; and production-lane tests proving absent/unbound eligibility
   is terminal without a repair dispatch;
2. lifecycle fixtures proving the four closed operations and zero unrelated
   diff, including exact typed cover before-state and counterexamples proving
   that free-prose similarity is not treated as typed identity;
3. real-artifact preview against Candidate `be2d…bcbc9`, proving exactly the
   intended path census, full template/coverage validation, zero external
   counters, and that the original Candidate never enters current compile,
   Candidate-build or package-load paths;
4. hostile tests for wrong/stale/cross-bound Candidate, snapshot, request,
   receipt and replay; source-phrase re-digest forgery; wrong-page evidence;
   duplicate/overlapping/no-op operations; arbitrary paths/extra keys;
   plan/review/Markdown tamper; symlink/junction/hardlink aliases; late
   collisions; invalid approver/timestamps; unapproved bridge use; and stale
   reconciliation reuse;
5. focused suites, `npx tsc --noEmit`, `git diff --check`, and literal
   `npm run check` with honest baseline attribution;
6. independent Claude Code read-only falsification of the committed range.

No provider or render is part of validation. A full LOW Wizard render remains
separately authorized only after the corrected content receives exact Guy
approval and the downstream authority chain is green.

## 8. Cost impact

This milestone costs `$0`: provider calls `0`, image generations `0`, audio
generations `0`, Vision calls `0`, Wizard payments/orders `0`, renders `0`.
It prevents a needless new authoring call and a knowingly bad full-book render.

## 9. Rollback plan

The change is additive and commit-bounded. Rollback is the focused commit
revert. The original Candidate and all upstream/downstream artifacts stay
unchanged. New correction artifacts are content-addressed and ignored until
explicit approval/use; removing code support makes them inert without altering
historical authority.

## 10. Review assignment

### Guy

The compiler foundation is implemented and independently passed, but standing
authorization is not treated as approval of its specific capability tradeoff.
Before the semantic-correction lifecycle proceeds, Guy must explicitly confirm
that a mixed frontier containing an unreviewed presentation gap may terminate
without dispatching an otherwise available structural repair. Guy must later
approve the exact real correction/review digests, including the two bounded
body-state phrases for p7 and p8, before they become authority.

### Claude Code

Try to falsify:

- any way to mutate or impersonate the receipt-bound Candidate;
- any generic/raw/unbounded patch path;
- source-phrase or catalog re-digest forgery;
- cross-Candidate, cross-source or stale approval replay;
- partial writes/orphan approvals;
- legacy bridge/approval carry-forward;
- mismatched spatial action identity;
- bare `שומר/שומרת` false positives or direction-only cast invention;
- any physical-action admission, or any production presentation-repair
  dispatch without independently persisted and digest-bound eligibility;
- any cover correction that can act without exact recurring-prop, lifecycle,
  `mustShow` and projection before-state, or that drifts unrelated bytes; do
  not treat free-prose matching as typed identity;
- downstream use of original rather than effective corrected authority.

### Claude Cowork

Not required for implementation. The only creative judgement is the later
human approval of two visible body-state phrases, which Guy owns.

## 11. Rejected alternatives

- **Edit Candidate v9 in place:** destroys receipt/replay provenance.
- **Mint an ordinary replacement Candidate that pretends to be provider
  output:** weakens the authority model.
- **Run provider again:** spends money without addressing deterministic bugs.
- **Approve/render and fix images later:** knowingly propagates contradictory
  and missing authority into expensive assets.
- **Generic JSON Patch:** too broad, hard to review, and unsafe against stale or
  unrelated drift.
- **Story/page-specific production conditionals:** do not solve future books.
- **Lexical similarity for p8:** Hebrew source and English render prose make it
  unreliable. p8 is corrected through the exact reviewed semantic overlay;
  typed presentation eligibility is the future repair seam and remains unwired
  until an independent authority is persisted and digest-bound.

## 12. Stop-check

1. **General or story-specific?** General lifecycle/compiler fix; only the
   external real plan is story-specific data.
2. **Could it break another story/child/companion/style?** Yes if validation or
   bridge compatibility is wrong; legacy fixtures, counterexamples and exact
   version discrimination are required.
3. **Production behavior?** It changes future compiler validation/projection
   and the downstream authority path, but does not deploy or publish anything.
4. **Spend money?** No.
5. **Smallest safe validation?** Offline real-artifact preview plus hostile
   fixtures; no image.
6. **What must Guy decide now?** Confirm the fail-closed mixed-frontier
   capability tradeoff before the semantic-correction lifecycle proceeds.
   Exact content approval remains a later explicit gate, and prompt-marker
   policy is required only before Visual Contract steering is enabled.
7. **What should Claude Code falsify?** The authority, source-binding,
   compatibility, eligibility and partial-write targets listed above.
8. **Claude Cowork?** Not needed now.
9. **What should Guy eyeball?** The exact correction review first, then the
   first completed LOW book before any broader rollout.

## 13. Explicit exclusions

- no provider or credential access;
- no live authoring retry;
- no image/audio/Vision call;
- no fake payment, Wizard Order, or render;
- no Board, Blueprint, package, locator or Registry promotion;
- no deployment or Production action;
- no Candidate/source/receipt/replay mutation;
- no self-awarded technical PASS;
- no automatic push.
