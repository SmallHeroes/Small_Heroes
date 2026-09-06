# R3-B1b — General supporting-cast and action semantic recovery

Date: 2026-09-06

Status: PROPOSED; PLANNING ONLY; OWNER COVER/CART DECISIONS PENDING

Product owner: Guy. Technical owner: Codex. Independent QA: Claude Code.

## 1. Proposed change

Repair accepted supporting-character authority and action fidelity in the
general compiler/validation path. Add an offline, typed correction lifecycle
that can recover an existing paid candidate without modifying its original
bytes or paying for another provider attempt. Reuse the existing cover-prop
operation. Keep product approval and downstream qualification separate.

This Gate supersedes the earlier recommendation to request re-authoring as the
default next paid step. Recovery is a proposal, not proven salvage: only a
validated effective candidate can establish success. A failed recovery holds
without automatically invoking a provider.

### Topology and review boundary

- Current Lead task is the sole writer on
  `codex/r3b1b-p1-a1-post-cardinality-authoring`, worktree
  `C:/Users/guyna/.codex/worktrees/d53b/Small_Heroes`.
- Independent final evidence-review range:
  `1aae0a0c27e3601075f63c2f852837584164ba25..4453cd9e2edbf37d157698fbfd62f69eeecd4c6c`.
  Claude Code returned PASS P0=0/P1=0/P2=0, closing the documentation finding.
- Closeout transcription commit:
  `e5e66feea9b8f9b1738f05ae70e4f967526578e5`.
  This is the planning base, outside the independently reviewed range.
- Before planning, reviewed HEAD/local upstream were clean 0/0 at `4453cd9e`.
  The local closeout advanced HEAD by one; this planning commit will advance it
  again. Neither new commit is claimed pushed or independently passed.
  These are preparation-time observations; the final Git handoff records any
  subsequent propagation without extending the independently reviewed range.
- Accepted-intent dependency worktree
  `C:/GNart/Work/sh-r3b1b-accepted-intent-wave-2` was clean at `63ccb484`,
  local upstream parity 0/0. It has no write role in this milestone.
- Planning stays in this task. Implementation should use one dedicated
  `codex/` branch/worktree from the final reviewed Gate head, with one writer.
  Re-inspect topology and record its actual path/base before implementation;
  do not create an overlapping task or change the held evidence branch.

## 2. Why now? Observed behavior and root cause

P1 `dragon_dini_adventure` is held before Blueprint. The latest paid attempt
used one provider call, nominal USD 0.376312 / conservative USD 0.413947.
Structural validation and exact offline replay pass, while independent semantic
review confirms P0=0/P1=3/P2=3. Fixing these general gaps serves the remaining
catalog; repeating authoring with the current compiler can reproduce them.

Verified implementation points:

| Observation | Root cause / implementation evidence |
| --- | --- |
| Baker p1/p12, broom man p5, band p9/p11, playing children p9 and birthday girl p11 are outside typed cast | `extractDeterministicFacts.ts` has a closed guard/doctor/parent lexicon. `compileBookVisualContractTemplate.ts` builds humans and page cast from those facts, dropping other drafted humans. |
| Merely retaining new drafted humans would still fail | `injectAppearance` in the compiler uses closed `role-policy/v2` and rejects unknown roles. `castPresenceContradiction.ts` can only see identities/aliases already in the contract. |
| P2 fast side-to-side motion and p6/p10 running become `walks` | `actionSemanticCatalog.ts` v3 has `walks` and `recoils`, but no `runs`. The p6/p10 candidate prose also says chasing/running while the predicates say walking. |
| Cover requires and forbids cake/cart | Page-1 no-spoiler projections conflict with intentional cover visibility. Existing `applyCoverVisibleRecurringPropOperations` can correct exactly this class. Tablecloth is forbidden-only and must stay so. |
| Recovery cannot be just an edited template | Bridge v5's cover correction binds an unchanged action-coverage digest. Cast/action recovery changes template, coverage records, references and potentially catalog authority together. |

Supporting humans must be derived from accepted source and Visual Directions,
not guessed from the candidate. The accepted-authority v1 envelope already binds
the exact `visual-directions.json` hash through its revision file inventory.
`supportingCharacters` is currently an array of free-form strings; it is not a
typed person/group/species/appearance contract.

The existing template represents individual humans with individual appearance
bindings. Its action `cast_group` subject is not proof that arbitrary background
groups already work through template/materialization/Blueprint/runtime. The
implementation must explicitly settle and test that projection.

## 3. Scope and proposed design

### A. Evidence-bound supporting cast

Create one generic reviewed supporting-cast input, bound to accepted revision,
snapshot, source hash and Visual Direction hash. Each entry records stable
identity, role, explicit human-individual/human-group/non-human classification,
gender or unspecified, page presence, exact evidence, and an explicit allowed
appearance-policy class. Resolve aliases/collisions and conflicts before use.

Preserve existing family-policy restrictions. A source-backed non-relative may
use the deterministic palette through its explicit class; unknown role text
alone must never imply family membership or appearance authority. Combine
reviewed entries with trusted extractor facts; conflicts hold instead of being
silently overwritten. The same source-backed assembly must feed future authoring
and offline recovery so they cannot disagree about authoritative cast.

Human groups must remain groups, with no fabricated identity, gender, family
relationship or exact member count. Choose and document a bounded deterministic
group representation during the first implementation milestone, including
recurring membership/appearance behavior, then prove every consumer can render
it as multiple humans. If this requires a template schema extension, version it
explicitly and preserve the legacy loader; do not encode a band as one person
or silently omit it. Non-humans are classified explicitly and must never enter
`humanCast` through a universal free-text-to-human rule.

### B. Faithful motion and source-backed presentation

Add `runs` to the closed catalog for cast subjects with object, laterality and
spatial-effect constraints explicitly defined. Keep existing predicates strict.
Source motion on p2 is hurried/skipped/scurried/darting, not literal `runs`.
Prefer the existing source-bound `presentation_requirement` lane for that
motion if it preserves the complete beat; remove its false walking requirement
and update coverage and generated prose atomically. Do not change the child's
walking or the genuinely walking companion on p8.

Use the same explicit source-backed review for the gentle hand withdrawal on
p12. Preserve the gentle intent and remove the erroneous `recoils` binding and
its generated projection, reconciling with the existing hand-withdrawal
presentation. Do not introduce extra predicates solely to replace a faithful
existing presentation representation.

### C. Immutable candidate recovery and complete reconciliation

Use a new versioned semantic-correction plan/artifact with a closed operation
union, exact source evidence, original candidate/template/coverage identities,
expected before-values, target IDs and explicit owner dispositions. Produce
an effective template plus effective coverage and their own digests. Do not
manufacture a new provider candidate or rewrite the paid receipt/replay.

Validate and apply the selected cast, action/presentation and page-prop
operations atomically. Recompute dependent check IDs, source references,
coverage pointers/values, cast presence and generated prose. Reject partial
operations, stale bindings, overlapping writes, orphaned beats, duplicate
actions and unrelated drift. Surface the complete before/after diff for review.

Page 12 must reconcile/replace the single passive `mustShow` entry
`Cake at the celebration table as the first slice is cut.` with the
baker-agented cutting requirement. Preserve the distinct served-slice/cherry
state. Update the coverage pointer/value for the cutting beat; never append a
second cutting requirement beside the passive line.

For cake/cart cover visibility, reuse the existing exact cover-prop operation
and its drift checks. Compose it in one deterministic correction order with
semantic recovery; preserve the original cover-only lifecycle and its unchanged
coverage invariant. A new bridge path must bind the effective template AND
effective coverage, current catalog and approved correction together.

Fresh current-consumer validation is required before any later reconciliation.
The attestation bound to live HEAD `18f22e75` stays historical. The correction
artifact alone confers no reconciliation approval or Blueprint authority.

## 4. Risk of hardcoding and rejected alternatives

- No Dini, baker, story-key, page-number or prop-ID branches in production code.
  Those values belong only in the exact reviewed correction input and tests.
- Do not add a few occupations to the extractor and call the system general.
- Do not trust provider-authored humans, unconstrained prose or a regex-only
  completeness test; these miss people entirely absent from candidate prose.
- Do not edit the immutable candidate JSON, reuse stale attestation, alias
  running to walking, or append duplicate presentation/actions.
- Do not introduce unbounded automatic repair or another provider attempt.

## 5. Likely files, compatibility and commit boundaries

Observed modules to change or test, according to actual contract impact:

- `lib/visual-package/acceptedStorySourceAuthoringAuthority.ts` and
  `storySourceAuthority.ts`: expose only digest-verified accepted input;
- `lib/visual-contract-compiler/extractDeterministicFacts.ts`,
  `compileBookVisualContractTemplate.ts`, `contractTemplateTypes.ts`,
  `validateTemplateContract.ts`, `materializeContract.ts`,
  `validateResolvedContract.ts`, `castPresenceContradiction.ts` and adapters:
  authoritative cast, class-based appearance, presence and group projection;
- `lib/visual-contract-compiler/actionSemanticCatalog.ts`, source evidence and
  coverage validators: catalog expansion and atomic source-backed rebinding;
- new supporting-cast and semantic-correction modules beside the existing
  authority/correction modules, with one bounded offline CLI;
- `lib/visual-package/visualContractCandidateCoverCorrection.ts`,
  `qaWizardCandidateBridge.ts`, reconciliation, `preRenderBlueprint.ts` and
  `lib/generation-pipeline/runtime-blueprint-projection.ts`: composition,
  effective-authority propagation and tests through the real consumers.

M1: implement typed accepted cast/appearance/group projection and motion
semantics, with version/consumer inventory and hostile tests.
M2: implement atomic recovery and bridge support; prove the existing candidate
through a no-write preview, then produce only review artifacts under a new
ignored root after the required owner dispositions are explicit.
Each milestone is focused, validated and independently QA'd before the next.

The catalog changes v3 to a new version. Introduce semantic-correction v1 and
a new bridge manifest version for changed-coverage recovery; preserve current
cover-only v5 behavior. Audit every imported version pin before editing.
Use an additive source-bound envelope where it suffices; only bump snapshot or
template schemas when their persisted contract actually changes. Preserve the
exact old snapshot-v4/candidate-v9/replay tuple as historical evidence; new
semantics must not silently rewrite that tuple. No production migration,
locator promotion or source revision replacement occurs in this scope.

## 6. Expected behavior and exact P1 product proposal

The effective candidate must preserve the accepted 12-page story, grounded
world, route, child/companion identities, unchanged sets/props and source gender.
It must represent the following accepted supporting cast:

| Cast | Pages | Source constraints |
| --- | --- | --- |
| Baker | 1, 12 | Same female baker; sets cake at start and cuts first slice at finish |
| Broom holder | 5 | Male; retain his source action |
| Band | 9, 11 | Recurring human group; do not invent a source-given headcount |
| Playing children | 9 | Human group, distinct from the hero and birthday child |
| Birthday child | 11 | Female, clapping as in the accepted source |

Only two unresolved visual choices require Guy's decision:

1. Recommended cover: keep both the cake and cart visible; apply the existing
   exact no-spoiler correction to those two props. Tablecloth stays forbidden.
2. Recommended p12 cart: visibly parked unobtrusively beside the picnic serving
   area. Make presence required and consistent across prop state, persistence
   and presentation. Alternative: explicitly off-frame everywhere on p12.

These recommendations are not yet approved. Source-faithful cast, p2 motion,
p6/p10 running, gentle withdrawal and non-duplicating cutting reconciliation
follow the accepted source; they are not requests to rewrite the story.

## 7. Validation plan and acceptance criteria

- Test accepted cast against more than one story fixture and arbitrary roles;
  include known relatives, non-relatives, repeated identities, distinct humans
  with the same role, groups, non-humans, missing evidence and conflicting gender.
- Prove presence/appearance/group projection through compiler, template,
  resolved contract, Blueprint validation and runtime projection. A regression
  must fail when an accepted person is missing even if no prose mentions them.
- Prove `runs` is allowed only on its defined subject/reference shape; existing
  walking and unknown-predicate rejection remain intact. Test p2/p6/p10, p8 and
  independent source examples; do not blindly replace every `walks`.
- Prove correction atomicity, source/candidate/catalog/digest/approval binding,
  non-duplication, stale-before-state rejection, idempotency and no output on
  rejection. Cover-only regression behavior remains exact.
- The no-write P1 preview must close all six confirmed semantic items and show
  only the enumerated source-backed changes. In particular count one cutting
  event, bind the baker, preserve the served slice, and remove contradictory
  walking/recoil/passive projections and stale coverage references together.
- Re-run exact historical offline replay without provider access. Compare all
  original 14 files byte-for-byte before and after recovery. Validate all
  effective template/coverage references and keep downstream gates closed.
- Run both TypeScript projects, relevant source-authority/template/catalog/
  cover/bridge/runtime suites, then `npm run check` for code milestones. Report
  process exit separately from assertions and preserve known baseline failures.
- Deliver an exact before/after review view to Claude Code and Guy. Technical
  PASS and Guy's semantic acceptance precede any separately gated next stage.

## 8. Cost impact

Planning and proposed recovery: zero provider calls, zero image/audio renders,
zero credential access. Additional provider spend ceiling: USD 0.
Paid candidate reuse is the first testable route. If it fails, explain the
remaining blocker and obtain a separate re-authoring decision/budget; do not
spend automatically. This does not predict the eventual total cost of 18 books.

## 9. Rollback

Original candidate, receipt, replay, accepted source and locator stay intact.
Reject or stop consuming the new correction artifact to restore the original
held state. Code rollback is a focused revert of the implementation milestone;
do not delete evidence, worktrees or branches. No database rollback is required.

## 10. Review assignment and stop-check

Guy decides the two visual dispositions above and approves the concrete Gate.
Claude Code should challenge completeness, duplicate cutting/withdrawal beats,
group-as-individual mistakes, appearance/family leakage, source conflicts,
effective-template/coverage mismatch, legacy replay drift and stale authority.
Cowork can advise on the cover composition if Guy wants creative alternatives;
that consultation is optional and has not been dispatched.

Stop-check answers: this is general; it can affect other stories and production
consumers, so defaults/legacy behavior require regression evidence; it spends
USD 0; the smallest proof is a no-write P1 recovery plus representative hostile
fixtures; Guy's open choices are cover/cart; visual acceptance will use the
exact textual before/after scene requirements at this stage. No generated
image is required for the proposed correction proof.

## 11. Do not do

No live authoring/retry, provider call, credential read, images, audio, full-book
render, Blueprint authoring/approval, package creation/promotion, locator or
accepted-source change, next-story publication, deployment or payment work.
Do not infer implementation or product acceptance from the preceding QA PASS.
This planning packet requires an owner decision before dependent implementation.

## Preparation evidence and independent review handoff

Preparation changed documentation only. `npx tsc --noEmit` exited 0 before
the closeout commit and before the planning commit; `git diff --check` passed.
No replay, test battery, Wizard audit or `npm run check` was rerun in this
planning turn. The unchanged code does not imply a new full-check PASS.

Before/after raw-byte inventories of the original output root both contain
14 files / 412,516 bytes, all regular and single-link. A sorted JSON inventory
of each relative path, size, raw SHA-256 and link count hashes to
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`
on both reads. This is a new local before/after comparison, not a reconstruction
of the earlier unpersisted inventory digest. No attempt artifacts were created.

Claude Code handoff (planning review, not implementation PASS):

> Review the range supplied by Codex on branch
> `codex/r3b1b-p1-a1-post-cardinality-authoring` in the d53b worktree above.
> Base is `4453cd9e2edbf37d157698fbfd62f69eeecd4c6c`; the final handoff supplies
> the planning HEAD. Expect two commits: faithful final-QA closeout, then this
> Gate plus CURRENT/ROADMAP planning updates. Confirm documentation-only scope,
> the exact prior verdict, honest planning status and unchanged held artifacts.
> Falsify whether the proposed cast/group/appearance authority can reach all
> consumers, whether new coverage can be bound without weakening legacy
> cover-only/replay authority, and whether the plan accounts for all six semantic
> findings including p2 motion and the surviving p12 passive cutting line.
> Check zero provider cost, owner choices still pending, migration/rollback and
> the absence of automatic re-authoring or downstream approval. Use the evidence
> and test limitations above. Return planning PASS/HOLD with P0/P1/P2 findings.
> Remain read-only; do not access credentials, invoke a provider or generate
> correction/approval/Blueprint artifacts.
