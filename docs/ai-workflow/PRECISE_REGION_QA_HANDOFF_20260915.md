# Precise-region probe — completed negative result

## Review scope and authority

Requirement: continue to a completed result without repeat approval prompts; stop
when repeated failures make more model calls wasteful. Tolerate illustration,
but catch clearly severe anatomical defects without routine human QA.

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1
Branch codex/r3b1b-semantic-recovery-m1
Base c175586a57f658c5059481f2a66dde5ac646d74e
Head: the focused commit containing this handoff (exact SHA supplied at delivery).
Sole writer current Codex task. Independent reviewer first pass read-only.
No independent technical PASS claimed. No deployment or product acceptance.

Changed: CURRENT.md, this handoff and its gate, two precise-region JSON fixtures.
ZERO production or test implementation changes; reused existing paid-call machinery.
No prompt tuning: hashes bind the existing rubric/full-detail and severe/full-detail
requests. One manually selected 280x320 region at left50/top700 includes the
suspicious rear flesh/blue-gray cloth fragment with head/shoulder/wing context.
Same exact-coordinate crop for original and corrected, supplied with full image.
Implementer inspected both crops before calls. Labels are not provider inputs.

## Results and interpretation

| Policy | Owner-rejected original | Provisional corrected |
| --- | --- | --- |
| Rubric + precise detail | defect | defect |
| Severe-only + precise detail | pass | pass |

Rubric sees the suspicious region but invokes finger separation and wing fusion.
It also rejects the corrected image for elbow/muscle definition and merged fingers.
Some non-anatomy findings demand axle nuts and wheel detail: style overreach remains.
Do not treat coincident original rejection as proof of correctly grounded anatomy.

Severe-only describes the rear arm region yet calls it coherent; it again asserts
a cart-handle grip not present in the original. Thus supplying the relevant pixels
did not solve discrimination. This does not establish internal model causation or
prove no other technique/model can work. It DOES satisfy this diagnostic's stop rule.
No further prompt/crop variants or paid calls scheduled on this calibration track.

Oracle localization is not automated detection. One related original/corrected pair,
one owner-labelled defect, corrected label provisional, deliberate post-selection,
one attempt per policy/target. No sensitivity/specificity or general accuracy claim.
Automatic anatomy QA remains unresolved; no routine-human-QA workaround activated.

## Immutable evidence (all outputs ignored and local-only)

Rubric root: outputs/qa-validation-precise-rubric-20260915
Report SHA256: 9e44f61390339a6350de3d4d0742702f321e3882c28f0ba98ff8d28d02d6244a
Severe root: outputs/qa-validation-precise-severe-20260915
Report SHA256: 5eacaed64148b5ab42b3e2cbc91986c50d7852d76cb692d5a1489a20d4366c23
Original crop SHA256: 27deaee168a713a5b334c2b95264b8a7549d087da662d545c506e8f336415369
Corrected crop SHA256: 7487fcbce2b56e183a8eef0e565018238063c53851ac266649ab351456fac325
Each root preserves input/prompt identity, exact crops, claims, provider dispatch
IDs and selected terminal receipts. Both arms use identical crop hashes.
No original report overwritten; no off-machine backup verified. Git push does not
preserve these ignored outputs. Derived inspection copies are under
outputs/precise-region-inspection-20260915, also local-only.

Four claims / four unique IDs / four succeeded receipts / zero unknown / zero retries.
Rubric IDs: jbcq4127zdrmt0d0mkm9xxt330, rt9hf03kzdrmr0d0mkmb7fc2hm
Severe IDs: 0s0rk4v8thrmy0d0mkmaa31v68, gknrq4wrb1rmr0d0mkmaaz7yf4
Model qwen/qwen3-7-plus; returned deployment version hidden, not hash-attested.
8708 input +1176 output tokens; estimate USD0.003698184 at PREVIOUSLY observed
USD0.276/M input and USD1.101/M output. Not a fresh price check or invoice reconciliation.
Four retained USD0.25 reservations total USD1; these are NOT actual billed charges.
Generic runner still allows up to12 cases/3USD per root; frozen two-case manifests
bounded this execution to4 calls. No new global dollar-cap enforcement is claimed.

## Verification

- Existing frozen-benchmark16 + comparison24 + severe-schema5 =45/45 tests.
- npx.cmd tsc --noEmit exit0.
- Both manifests preflighted before credential access; no changes to the validators.
- Replay both via runFrozenBenchmark with a throwing fetcher: networkCalls0,
  original results reproduced, immutable report comparisons accepted.
- All185 pre-existing PNG/MP3/JSON files in local-story-preview-dini-20260915
  and local-preview-narration-dini-20260915 (recursive), plus prior qa-validation
  report.json files excluding precise roots, preserve aggregate SHA256:
  c714e090fca28c274926c9522081271ecd5ec3db15e787d7b0ba69355c6b0b73.
  Aggregate = SHA256(JSON.stringify(sorted [relativeWindowsPath,fileSHA256] pairs)).
- Both run locks absent. No image/audio generation or production changes.
- Full npm run check not rerun; prior NON-GREEN/stability issue remains open.

## Falsification targets

Verify source/ROI hashes and actual crop location; target labels/pathnames absent
from provider input; existing request schemas unchanged; four dispatch/receipt IDs
match and no extra claims; original model evidence really describes absent grip;
do not confuse reservation with charge, oracle success with automation, or
experiment completion with deployable QA. Preserve owner page7 visual override
alongside original safety result and missing numeric score; unrelated to this probe.

## Inspection / optional push (not performed)

The user-facing delivery supplies the exact local commit SHA. Inspect before any
explicitly requested push; pushing carries the entire ahead set, not only this probe.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --oneline
git diff --stat c175586a57f658c5059481f2a66dde5ac646d74e HEAD
git log --oneline 'origin/codex/r3b1b-semantic-recovery-m1..HEAD'
# Only after explicit owner push direction and review of the entire ahead set:
git push origin HEAD:codex/r3b1b-semantic-recovery-m1
```
