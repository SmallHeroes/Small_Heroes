# Independent review brief: Qwen style calibration

## Requirement and topology

Guy wants an automatic visual QA/repair path without manual inspection of every
book. Specifically test whether teaching normal illustrated hands/occlusions fixes
Qwen's oversensitivity. This milestone tests that hypothesis, not production cutover.

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1. Sole writer: this Codex task. Base
6542e4faf447918a31bd2bbba3cb43af573b7256; review the one focused successor commit
containing this file. Resolve its full hash below, then review that immutable range,
not a later mutable HEAD. At start ahead22/behind0 and clean. Protected d53b768ccb2f
and accepted-intent63ccb484 remain clean/read-only. No push by this task.

## Implementation / files

- lib/visual-qa-comparison.ts: optional Qwen-only rubric/examples input; ordered
  images, final-target instruction; baseline input unchanged when option omitted.
- scripts/lib/visual-qa-comparison.ts: exemplar byte/SHA validation and optional
  official async transport. Calibration bytes/text and transport bind cached calls.
  Existing unknown/reconcile/receipt behavior and old cache fingerprints preserved.
- scripts/run-style-calibrated-qa.ts: preregistered3x4 runner, source snapshots,
  example/target family separation, immutable identity/report, exclusive lock,
 12-call/3USD fixed reservation, safe stdout and no paid retry.
- lib/__tests__/visual-qa-comparison.spec.ts:5 added tests,23 total.
- CURRENT.md and STYLE_CALIBRATION_GATE_20260915.md: scope, results and limitations.

No active production caller uses the new calibration option; only the experiment
runner. No new dependency, source/reader/anchor edit, image or audio generation.
Rollback is omission of the options; retain existing evidence and unknown claims.

## Live result, not self-PASS

| arm | original owner-rejected page1 | corrected page1 | page8 | page12 |
| --- | --- | --- | --- | --- |
| baseline | defect | defect | defect | defect |
| explicit rubric | defect | pass | pass | pass |
| same rubric plus2 examples | defect | defect | defect | defect |

All three normal labels are implementer-provisional. The original defect is the
only owner-labelled defective case. Original/corrected are related. No claimed
general held-out sensitivity, independent quality verdict, or statistical significance.
Examples are old page4 and new page6, no target-family/hash overlap. Original defect
was NOT shown as a labelled example. No target label/id/path/prior result sent.
Text-only rubric specifically identifies the disjointed rear arm in target-a.
OtherFindings still include doubtful detail complaints on axles, wings and musical
instruments; unscored and unvalidated, not automatic regeneration authority.

12 creation calls,12 persisted IDs,12 succeeded results,0 unresolved/retries.
Async official route returned IDs reliably in THIS run. No causal claim about old504s.
Provider returned version hidden; configured hash was not attested or sent as a
version pin on the official-name endpoint. No snapshot guarantee.

Receipt totals35420 input/3428 output. Published <=256K tier observed2026-09-15:
0.276USD/M input,1.101USD/M output. Estimate0.013550148USD for this run only;
not invoice-confirmed cost. Ledger deliberately retains3USD reservation, usage=null.
No hard-dollar-cap claim and no reclassification of older unresolved charges.
Sources: [Qwen model/pricing](https://replicate.com/qwen/qwen3-7-plus),
[official async route](https://replicate.com/docs/topics/predictions/create-a-prediction).

## Reproduction and preservation

Local ignored root outputs/visual-qa-style-calibration-20260915 contains identity,
12 dispatches,12 claims,12 receipts and report; no run lock remains. This data is
local-only, not backed up by Git push. Report SHA-256:
6c594f929677def8dd93dbabd10c53509b894283e224d27156c19179dc0c0946.
30 dataset PNGs +13 reader PNGs +12 narration MP3s preserve all55 before/after hashes.

154/154 tests across visual-qa-comparison, local-anatomy-experiment,
local-preview-quality, local-story-preview, local-preview-judge,
local-preview-identity, local-book-review, local-preview-narration,
page-child-resemblance-vision (9specs). tsc --noEmit0; git diff --check0.
Full npm run check NOT rerun; repository NON-GREEN remains. No stability closure.
Fake-key replay of new CLI returns all12 same outcomes without POST. Legacy Qwen
replay still3defects/3unknowns, no provider retry. Reader and active5.5 gate unchanged.

## Adversarial targets / next action

Review-only first pass. Falsify target leakage, provisional-label overclaims, rubric
vs examples isolation, old-cache compatibility, exemplar mutation, unexpected
network calls in replay, hidden-version claims, and reservation vs cost confusion.
Check that a general-QA or render unlock was not inferred from anatomy-only results.
CLI local/path/run-identity guard coverage is inspection-only; not a subprocess suite.
No cross-style/multiple-defect coverage or run-to-run variance established.

Next engineering step: frozen text-only rubric on a broader, separate corpus with
multiple genuine defect types; then bounded automatic repair/recheck for confirmed
defects. A transport/uncertain result must not spend image-repair budget. Continuity
needs canonical object/location state and reference images, not single-image guesses.
No request that Guy become routine per-book QA. No independent self-PASS or launch
authority; product acceptance remains separate from automatic QA implementation.

## Copy-ready PowerShell inspection / optional explicit push

```powershell
Set-Location C:/GNart/Work/sh-r3b1b-semantic-m1
$calibrationHead = git log -1 --format=%H -- docs/ai-workflow/STYLE_CALIBRATION_HANDOFF_20260915.md
git status --short --branch
git show --stat $calibrationHead
git diff --check "6542e4faf447918a31bd2bbba3cb43af573b7256..$calibrationHead"
# Only if Guy elects to propagate; this pushes all earlier unpushed commits too.
# git push origin codex/r3b1b-semantic-recovery-m1
```

No stage/commit reconstruction required: this milestone is committed locally.
Reconcile branch/hash before review; no range expansion or active reviewer presumed.
