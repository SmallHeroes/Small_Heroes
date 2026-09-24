# Claude Code: prospective visual-priority QA

Review-only first pass. No paid calls, credentials, renders, edits or push.

## Freeze / scope

Worktree `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
`codex/r3b1b-semantic-recovery-m1`. Base
`e491c9bcc02dfa5aec61f45735ccfc3eb2a9ced2`. Review its direct child containing this
file, subject `feat(qa): bind prospective decorative preferences in local samples`.
Freeze the child's full SHA before reviewing; do not follow moving HEAD. This
handoff is inside the same commit, so its exact child SHA is supplied separately.

Guy asked to continue after the reconciled push. The engineering objective is to
distinguish required story/physical continuity from optional detail **before**
pixels, not rerender forever for every authored flourish. Narrow first delivery:
nonfunctional surface decoration only, opt-in local owner samples. No independent
self-PASS, no expansion of prior Claude verdicts or acceptance.

## Root cause and actual change

The prior schema only had eight mandatory pass/defect/uncertain checks. Every
defect required repair/hold; no separate optional visual preference existed.
New source/plan-pinned JSON asset under config `visualPriority: {file, sha}` is
loaded through the existing exact-byte/path checker before key/image access.
`compileVisualPriorityPolicy` accepts existing prop/landmark IDs, rejects cast,
duplicates, stale hashes, exact normalized attribute collisions with invariants
and state changes. Process-local validated handles reject cloning/mutation.
This is integrity validation, not a signed content-approval authority.

All existing invariants still apply. The policy is ADDITIVE; it cannot reclassify
the historical wheel-spoke or height requirement. If a future plan deliberately
omits unnecessary precision, that is a separate prospective content decision,
not a silent waiver. No current paid plan/source/artifact was edited.

Policy projected to visible page entities; prop boards get only listed prop
preferences. It is hashed into page context and uses
`local-preview-quality/v6-decorative`. Old v5 identities, raw instructions,
calibration and outputs remain unchanged when the asset is omitted. Automatic
calibrated preview never opts in. New review requires policySha and exactly one
decorativeCheck per projected ID, including the valid zero-visible-detail case.
Values: matched/variation/not_visible/uncertain. Variation is retained in history,
not converted to matched or included in the repair list. Any mandatory defect
still repairs; ANY uncertainty holds, even with another defect.

The real owner runner, shared quality loop, real judge adapter, defect-only repair
prompt and same-scene predecessor all use the bound policy. Predecessor checks
source/plan and the PREVIOUS page's policy, not the current one. New mode rejects
non-samples and imported existing candidate images. Changing policy/config
requires a new output root, including adding/removing policy on a used root.
Blind anatomy sees no new preferences and retains its veto; original raw
contextual response remains untouched even when blind anatomy overrides it.

## Files

Production modules: `lib/local-visual-priority.ts` (new),
`lib/local-preview-quality.ts`, `lib/local-book-sequence.ts`,
`scripts/lib/local-preview-judge.ts`, `scripts/run-owner-book-draft.ts`.
Specs: new local-visual-priority; owner-book-draft, local-preview-judge,
local-book-sequence. Documents: CURRENT, decision gate, this handoff.
No app/reader, source catalog, image provider, model, quality tier, threshold,
payment, deployment or automatic-planner changes.

## Validation actually run

`npx tsc --noEmit`: exit0. `npm run story:autonomous-typecheck`: exit0.
Nine focused files, **330/330**, exit0:

| Spec | Tests |
|---|---:|
| owner-book-draft | 114 |
| local-visual-priority | 33 |
| local-preview-quality | 28 |
| local-preview-judge | 20 |
| local-book-sequence | 33 |
| local-story-preview | 42 |
| local-book-planning | 51 |
| local-preview-identity | 4 |
| local-preview-narration | 5 |

The real owner entry made two mocked image requests, carried the prior image
under the same sequence, saved decorative variation in the manifest, and resumed
without new image requests. Real judge transport is separately mocked at OpenAI:
wire schema/instructions, raw receipts, blind veto (defect AND uncertain), replay,
legacy-shape rejection and pre-dispatch context checks are exercised. These are
NOT paid visual experiments and do not establish perception accuracy.

During implementation tsc caught structural-union narrowing and ES target `.at`
issues; both fixed. One new test initially expected the wrong existing identity
error code; actual `preview_input_changed_new_run_required` confirmed the guard,
and the test now asserts it. Final focused run is the 330 above.

Both existing offline reports rerun read-only with `--report` and
`--report --medium`: no provider calls; historical LOW/MEDIUM still HELD;
nominal usage estimates $0.12878 / $0.13120; preservation 172/203 files;
cumulative upper $8.13226. No invoice verification. Existing outputs remain
ignored, machine-local, without verified off-machine backup.

Full `npm run check` deliberately not repeated in this narrow opt-in milestone.
The previously recorded 39 timeouts + two assertions remain an open RED gate;
focused tests and two typechecks are not release qualification. No claim that
all full-gate failures are inherited, or of fixed repository stability.

## Attack these claims

1. Try demoting any core-category defect via decorative variation. Try uncertainty
   in either lane; it must not authorize repair or successor generation.
2. Try stale source/plan/hash, required-attribute collision, cast target, duplicate
   IDs (including attribute case), cloned or mutated handles. Real loader must
   reject before key/outputs. Policy authority is author data, not model verdict.
3. Try missing/extra/duplicate decorative IDs, wrong page/policy/hash, old review
   under new policy, new review with policy omitted. No implicit migration.
4. Try previous-page decorative evidence with the current page policy, foreign
   plan policy, or old mandatory defect. No unsafe same-scene predecessor.
5. Confirm new policy doesn't reach blind anatomy, doesn't remove required
   corrections, doesn't leak future entity preferences, and survives persistence.
6. Reproduce omitted-policy byte compatibility and both historical reports. No
   hidden edits to the old evidence or accepted source and no root reuse.
7. Attack semantic claims too: schema cannot prove a declared decoration is
   non-narrative, recognize aliases, or validate implications of prose. This limit
   is explicitly tested. Do not label this an autonomous classifier or complete
   fix for continuity, anatomy, scale, camera quality or model omissions.

## Commands

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$base = 'e491c9bcc02dfa5aec61f45735ccfc3eb2a9ced2'
$reviewHead = git rev-list --reverse "$base..HEAD" | Select-Object -First 1
git show --format=fuller --stat $reviewHead
git diff --check "$base..$reviewHead"
git status --short --branch
npx tsc --noEmit
npm run story:autonomous-typecheck
npx vitest run lib/owner-book-draft.spec.ts lib/__tests__/local-visual-priority.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-book-sequence.spec.ts lib/__tests__/local-story-preview.spec.ts lib/__tests__/local-book-planning.spec.ts lib/__tests__/local-preview-identity.spec.ts lib/__tests__/local-preview-narration.spec.ts --silent
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/model-comparison.cjs --report
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/model-comparison.cjs --report --medium
```

Validate HEAD equals the frozen child before executing worktree tests. If not,
reconcile rather than presenting newer-tree tests as frozen-range evidence.
Guy controls push and product acceptance. After QA: author/review a fresh minimal
plan plus preferences and conduct the smallest approved visual experiment.
This handoff itself is not paid-execution or customer-delivery authority.
