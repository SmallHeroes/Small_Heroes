# R3-B1b — General supporting-cast and action semantic recovery

Date: 2026-09-06

Status: OWNER APPROVED 2026-09-06; PLANNING P2 RE-GATE PASS P0=0/P1=0/P2=0;
M1a IMPLEMENTATION; NO PROVIDER / RENDER / DOWNSTREAM AUTHORITY

Product owner: Guy. Technical owner: Codex. Independent QA: Claude Code.

Guy's explicit approval follows Claude Code's final planning-correction PASS
on `581adc14..768ccb2f`. Both recommended visual dispositions in §6 are approved.
Execution continues in the current task as sole writer on new branch
`codex/r3b1b-semantic-recovery-m1`, worktree
`C:/GNart/Work/sh-r3b1b-semantic-m1`, based on exact reviewed HEAD
`768ccb2fe20edb1351cb4783796613cbf7a2993c`. The previous worktree/branch is
read-only evidence, not a second implementation task. No new app task was
created. Preparation-time and reviewer handoffs below are retained as history.

Implementation subdivision: M1a is the source-bound cast-review input and
individual compiler preview, without persisted-schema/catalog migration.
M1b adds the bounded group projection, `runs` and legacy-version cutover after
M1a independent QA; M2 remains atomic candidate recovery and bridge support.
This makes the schema/consumer migration a separate verifiable boundary; it
does not drop any M1 acceptance criterion or claim the whole M1 is complete.
See `R3B1B_SEMANTIC_RECOVERY_M1A_EXECUTION_EVIDENCE.md` for current scope/evidence.

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

Planning-review update: Claude Code independently reviewed
`4453cd9e2edbf37d157698fbfd62f69eeecd4c6c..581adc14d97eea0b78e25a7550273a9137238b96`
and returned **planning PASS, P0=0/P1=0/P2=3**. It confirmed two commits,
five Markdown paths, zero non-Markdown paths, clean 0/0 and TypeScript exit 0.
That review includes the closeout transcription and this Gate; the earlier
preparation-time observations above remain historical. At correction start,
HEAD/local upstream are `581adc14`, clean 0/0, and the accepted-intent dependency
is still clean 0/0 at `63ccb484`. The Lead task remains the sole documentation
writer. The three non-blocking scoping/reproducibility findings are corrected
below, not independently closed by Codex. No product decision or implementation
authority follows from this planning verdict.

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

Minimum known consumer inventory to inspect and change or regression-test as
appropriate; this is not a claim that every listed module needs an edit. M1
must finish the caller/version inventory before code changes and record each
consumer's disposition, including evidence for any unchanged path:

- `lib/visual-package/acceptedStorySourceAuthoringAuthority.ts` and
  `storySourceAuthority.ts`: expose only digest-verified accepted input;
- `lib/visual-contract-compiler/extractDeterministicFacts.ts`,
  `compileBookVisualContractTemplate.ts`, `contractTemplateTypes.ts`,
  `validateTemplateContract.ts`, `materializeContract.ts`,
  `validateResolvedContract.ts`, `castPresenceContradiction.ts` and adapters:
  authoritative cast, class-based appearance, presence and group projection;
- `lib/visual-contract-compiler/validateVNextVisualContract.ts`: cast-ID
  resolution, individual-human shape and bidirectional page-presence checks;
- `lib/visual-contract-compiler/projectContractProse.ts` and
  `lib/visual-contract-compiler/buildVisualContractPromptBlock.ts`: cast labels,
  group/action projections and final prompt text. Prove stale walking, recoil
  and passive-cutting projections cannot survive effective coverage changes;
- `lib/visual-contract-compiler/compileBookVisualContract.ts`,
  `lib/visual-contract-compiler/bookSurfaceRepair.ts` and
  `lib/visual-contract-compiler/structuralBundleRepair.ts`: alternate authoring
  contract instructions and repair reference inventories; preserve legacy
  behavior while preventing unsupported group identities from being dropped;
- `lib/visual-contract-compiler/writeVisualContractReview.ts`: cast lookup,
  structured presence and review diffs must expose, not hide, effective changes;
- `lib/visual-contract-compiler/actionSemanticCatalog.ts`, source evidence and
  coverage validators: catalog expansion and atomic source-backed rebinding;
- new supporting-cast and semantic-correction modules beside the existing
  authority/correction modules, with one bounded offline CLI;
- `lib/visual-package/visualContractCandidateCoverCorrection.ts`,
  `qaWizardCandidateBridge.ts`, reconciliation, `preRenderBlueprint.ts` and
  `lib/generation-pipeline/runtime-blueprint-projection.ts`: composition,
  effective-authority propagation and tests through the real consumers.
- `lib/visual-package/runtimeAuthority.ts`,
  `lib/visual-package/preRenderBlueprintProviderWire.ts` and
  `lib/visual-package/sourcePromptReconciliation.ts`: runtime cast resolution
  and projection, Blueprint wire cast/reference encoding, and protected
  source-reconciliation fields. Validate these boundaries offline; listing
  them does not authorize a Blueprint/provider/downstream execution.
- `lib/visual-package/visualContractAuthoringLifecycle.ts` and
  `lib/visual-package/visualContractAuthoringReplayRunner.ts`: distinguish the
  current-catalog candidate factory from historical receipt/replay handling.

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

Concrete version-pin boundary (verified at planning HEAD `581adc14`):
`buildVisualContractCandidateArtifact` in
`lib/visual-package/visualContractAuthoringLifecycle.ts:6203-6223` rejects
receipts whose Action Semantic Coverage catalog version/digest do not equal
the current constants. The held receipt and candidate bind
`action-semantic-catalog/v3`, digest
`c8b366c2ca4f6d1b43eb0ee8e4196546e57d5ba279b5786fdb328de9f33acec5`.
After a catalog bump, that unchanged paid receipt cannot be used to rebuild a
candidate through this factory. Keep the assertion strict; do not relabel the
receipt, spoof a provider candidate or relax current-catalog validation.

M1 must preserve an explicit legacy read/validation path for the original v9
candidate and its frozen v3 bindings. M2 must consume that original as
historical input, then bind the separately materialized effective template and
coverage to the new catalog in the new semantic-correction artifact/bridge.
Test this route without sending the old receipt through the current candidate
factory. The historical replay runner imports
`persistVisualContractAuthoringReceipt`, not the candidate factory, and has no
catalog-constant reference. Static inspection therefore does not establish a
replay break from this particular pin, but the exact historical replay in §7
remains a required regression test after implementation, not a test run here.

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

Guy approved both visual choices on 2026-09-06:

1. Recommended cover: keep both the cake and cart visible; apply the existing
   exact no-spoiler correction to those two props. Tablecloth stays forbidden.
2. Recommended p12 cart: visibly parked unobtrusively beside the picnic serving
   area. Make presence required and consistent across prop state, persistence
   and presentation. Alternative: explicitly off-frame everywhere on p12.

The recommended choices are approved, not the off-frame alternative. Source-faithful cast, p2 motion,
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

Guy has decided the two visual dispositions above and approved the concrete Gate.
Claude Code should challenge completeness, duplicate cutting/withdrawal beats,
group-as-individual mistakes, appearance/family leakage, source conflicts,
effective-template/coverage mismatch, legacy replay drift and stale authority.
Cowork can advise on the cover composition if Guy wants creative alternatives;
that consultation is optional and has not been dispatched.

Stop-check answers: this is general; it can affect other stories and production
consumers, so defaults/legacy behavior require regression evidence; it spends
USD 0; the smallest proof is a no-write P1 recovery plus representative hostile
fixtures; Guy's cover/cart choices are now resolved as in §6; visual acceptance will use the
exact textual before/after scene requirements at this stage. No generated
image is required for the proposed correction proof.

## 11. Do not do

No live authoring/retry, provider call, credential read, images, audio, full-book
render, Blueprint authoring/approval, package creation/promotion, locator or
accepted-source change, next-story publication, deployment or payment work.
Do not infer implementation or product acceptance from the preceding QA PASS.
The owner decision above authorizes the scoped implementation only; independent
implementation QA and later exact-artifact product acceptance are still required.

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

Exact inventory serialization (also reproduced during the P2 correction): run
from the repository root. Paths are repo-relative, include the
`outputs/r3b1b-p1a1-v22r2-02/` prefix and use `/`. Sort rows by ordinal JavaScript
string comparison on `path` (not locale sort). Row keys are inserted in exactly
`path`, `bytes`, `sha256`, `nlink` order; `bytes` and `nlink` are numbers. Hash
UTF-8 bytes of compact `JSON.stringify(rows)`, without BOM or trailing newline.
Do not hash the printed summary or apply the artifact canonical-JSON algorithm.

```powershell
$p1InventoryScript = @'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = 'outputs/r3b1b-p1a1-v22r2-02';
const rows = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    const s = fs.lstatSync(p);
    if (s.isSymbolicLink()) throw new Error('Unexpected link');
    if (s.isDirectory()) { scan(p); continue; }
    if (!s.isFile() || s.nlink !== 1) throw new Error('Not a single-link regular file');
    rows.push({
      path: p.replaceAll('\\', '/'),
      bytes: s.size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
      nlink: s.nlink,
    });
  }
}
scan(root);
rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const digest = crypto.createHash('sha256').update(JSON.stringify(rows), 'utf8').digest('hex');
console.log(JSON.stringify({ count: rows.length, bytes: rows.reduce((n, r) => n + r.bytes, 0), rawInventorySha256: digest }));
if (rows.length !== 14 || rows.reduce((n, r) => n + r.bytes, 0) !== 412516 ||
    digest !== 'cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0') {
  throw new Error('Held P1 inventory differs');
}
'@
node -e $p1InventoryScript
```

Original Claude Code handoff (completed planning review; retained as history):

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

### Planning P2 correction handoff

Claude's planning review was documentation/static-code only, with
`npx tsc --noEmit` exit 0. It did not run test batteries, replay, Wizard audit
or `npm run check`; the disclosed non-green repository baseline stands.
It used PowerShell 5.1 because Bash was unavailable. The candidate's separate
semantic HOLD remains P0=0/P1=3/P2=3.

This corrective milestone changes only this Gate, CURRENT and ROADMAP: it adds
the ten missing named consumers (P2-1), the exact current-catalog factory pin
and separate legacy-input/effective-output route (P2-2), and the executable
inventory serialization (P2-3). No production code or held artifact is changed.
Codex reran `npx tsc --noEmit` (exit 0) and `git diff --check` (exit 0), then
extracted and executed the exact Node script from the Markdown block above
(exit 0): 14 files / 412,516 bytes and the same full `cd621f77...` hash as the
pre-edit read. No replay, test battery, Wizard audit or `npm run check` was run
for this documentation correction; no provider, credential or artifact write
occurred. The unchanged-code baseline is not a full-repository green claim.

> Re-gate the documentation-only correction from
> `581adc14d97eea0b78e25a7550273a9137238b96` to the exact corrective HEAD supplied
> by Codex, on the same branch/worktree recorded above. Expect one commit and
> three Markdown paths. Verify the planning-PASS transcription and inspect the
> named consumers, especially vNext validation and prose projection. Challenge
> whether the paid v3 receipt is kept away from the current-catalog candidate
> factory after the proposed bump, with no weakening or fabricated authority.
> Execute the inventory block above from the repository root and reproduce
> the exact hash/count/bytes. Check unchanged owner choices, candidate HOLD,
> zero spend and absence of implementation/downstream authority. Codex's final
> handoff supplies fresh TypeScript/diff/inventory results and commit topology.
> Remain read-only and offline: no credential/provider access, artifact writes,
> correction execution or downstream actions. Return PASS/HOLD and P0/P1/P2;
> Codex does not self-award independent closure of these three findings.
