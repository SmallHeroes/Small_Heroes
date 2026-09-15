# GPT-5.5 Medium recheck — implementation/evidence handoff

## Request, scope and topology
Guy requested5.5 Medium for the visual judge and child resemblance, then individual
rechecks. Worktree C:/GNart/Work/sh-r3b1b-semantic-m1; branch
codex/r3b1b-semantic-recovery-m1. Base4f0b6396e1e495a23133bfd504daa1f5f15dacb6;
head is the focused commit introducing this handoff, exact hash in final message.
Reconcile HEAD first; first independent QA pass read-only. Protected worktrees
d53b768ccb2f and accepted-intent63ccb484 remain unchanged/clean. Start ahead18.
No independent self-PASS, production rollout, push, image/audio creation or prose edit.

## Changes and claims
- local-preview-quality and local-preview-judge: versionv5 pins configured5.5/medium
  in both requests/checkpoint fingerprints; calibration validates model and effort
  as well as version/instruction digests. Existing v4 reports cannot unlock v5.
- page-child-resemblance-vision: explicit reasoningEffort opt-in, only supported
  with requested5.5/medium; Responses/storefalse/6000 tokens/180s. Legacy request
  endpoint/180 tokens/temperature0/timeout defaults remain unchanged. Shared parser,
  weights and minimum0.70 unchanged. Non-completed reasoning output never passes.
- local-preview-identity: shared genuine evaluator, exact-byte snapshots, configured
  model/effort/threshold fingerprints, one dispatch, no retries, raw response/status/
  usage retained, claim/result checkpoint replay, unknown evidence not auto-pass.
- recheck-local-preview-identity: dev-only, output containment, manifest/source/text/
  anchor/page bindings, separate locked new evidence root; no reader writeback.
- calibration budget ceiling5USD, actual config5; identity actual config5 separately.
  All-token30USD/M accounting documents5.5 support (these inputs below272K tokens).

The historical review-local-story-preview CLI is deliberately unchanged (4o/5.4).
New identity rechecks use the new command below. The new generation CLI's numerical
and final-book-review pending flags remain; no claim this opt-in comparison completes
the production/default consumer cutover or book readiness.

## Live results
Judging instructions, original PNGs and deterministic four overlapping crops are
unchanged for the four-case comparison. Expected answers are not model inputs.

| Case | Expected | 5.4 previous | 5.5 Medium |
| --- | --- | --- | --- |
| Original anatomy25c1545f | defect | missed | missed |
| Corrected anatomyb30c4633 | pass | matched | matched |
| Four-tier cake71b84da5 | defect | matched | matched |
| Wood/stone bridge4fdb96e0 | defect | matched | matched |

Eight calls returned completed receipts.3/4 matches, calibration_hold. Blind judge
again rationalized malformed exposed anatomy as plausible occlusion. This is a
failed perception regression, not repaired by a model switch. Additional scale/cart
findings need human validation; do not equate every model observation with truth.
No coverage claim for general anatomy accuracy, scale or framing calibration.

13 separate identity calls on the current narrated-reader PNGs:11passed,2unknown.
Page9 subject_not_assessable0.60; page11 uncertain0.45. Page4/6=0.85, page12=0.75;
other eight scores approximately1.0. Scores are feature sums, not probabilities.
Every identity raw receipt reports gpt-5.5-2026-04-23, reasoning medium, HTTP200,
completed and attempts1. Visual receipts preserve configured model in fingerprints
and parsed response/text/usage, not the complete returned provider envelope.
Some current-reader candidates differ from the original4o review: do not compare
aggregate pass rates as a controlled same-byte identity benchmark.

## Preservation, evidence and cost
All13 reader PNG and12MP3 digests match existing manifest. Manifest SHA256
9905fb7a727cfdf7d17992d8c38587c8cb967d5823972367ddd2d29cc4f63f68;
accepted source225f2b01. Old roots and judgments unchanged. No owner approval moved.

Both new roots/configs are under outputs/, ignored/untracked and only retained
locally; a push does NOT back them up. No off-machine preservation verified.
Calibration root local-preview-quality-calibration-v5-20260915, report SHA256
4a8b236fe7ab400397ffbe316bb3fb05d5889e4e1c54df02dd66358675be7c88.
Identity root local-preview-identity-v5-20260915, report SHA256
918ee8ec027a6fb3aa9d2a9df41df70d5a8fabc583181ec36a29bd5fa97da301.

| Run | Calls/receipts | Input tokens | Output tokens | Upper accounting USD | List-rate estimate USD |
| --- | --- | --- | --- | --- | --- |
| Calibration | 8/8 | 73649 | 18406 | 2.76165 | 0.920425 |
| Identity | 13/13 | 39702 | 4526 | 1.32684 | 0.334290 |
| Total | 21/21 | 113351 | 22932 | 4.08849 | 1.254715 |

Cached input0. Estimate uses5USD/M input and30USD/M output from the official
[GPT-5.5 model page](https://developers.openai.com/api/docs/models/gpt-5.5), checked
2026-09-15. These are usage-based estimates, NOT provider invoices. No reservation
exceeded and neither5USD planning fence exhausted. No retries/unmatched claims.
Calibration live wrapper exit1 on intended nonzero HOLD; replay explicitly captured
Node exit2. Identity live/replay exit0. Fake-key/no-env-file replays reconstructed
the exact reports with existing receipts, no additional claims/receipts.

## Validation and limitations
Final focused run:116/116 across9specs,2.71s. tsc --noEmit exit0; diff-check0.
Specs: local-preview-identity4, local-preview-judge3, local-preview-quality28,
page-child-resemblance-vision15, local-story-preview32, local-book-review17,
local-preview-narration5, quality-evidence7, quality-evidence-review-invalidation5.
Earlier targeted runs45/45,98/98,103/103 and12/12 are not additive final counts.
Full npm check NOT rerun; previous NON-GREEN status remains. No stability closure.
No browser rerun needed: reader/media are untouched; hashes verified instead.

## Falsification targets for Claude Code
1. Actual5.5/medium dispatch, no legacy/environment override, no silent fallback.
2. Exact stored-byte forwarding and unchanged legacy default/threshold/weights.
3. Malformed/incomplete/uncertain result never becomes an accepted identity or a
   retry instruction; no credential in outer errors or recorded request headers.
4. Model/version/effort mismatch rejects calibration/cache; replay cannot rebill.
5. Bindings/containment/locks prevent mixed reader/source or overwritten evidence.
6. Recompute usage,21claims/receipts, report/media hashes. Distinguish estimated
   cost, numerical score and visual correctness. Confirm anatomy stays HELD.

## Copy-ready PowerShell inspection and handoff
The implementation is already committed locally; no staging/commit reconstruction.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format=fuller
git diff --stat 4f0b6396..HEAD
git diff --check 4f0b6396..HEAD
npx.cmd tsc --noEmit
```

After independent review and only if Guy chooses to propagate (not executed here):

```powershell
git push origin HEAD:codex/r3b1b-semantic-recovery-m1
```

Existing receipt replay (dummy credential cannot authorize new paid calls):

```powershell
$env:OPENAI_API_KEY = 'offline-replay-no-provider-key'
node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/calibrate-local-preview-quality.ts outputs/local-preview-quality-calibration-v5-20260915.config.json unavailable.env
# Expected exit2: calibration_hold, not a transport failure.
node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/recheck-local-preview-identity.ts outputs/local-preview-identity-v5-20260915.config.json unavailable.env
# Expected exit0. Use a disposable shell; these commands do not load the real key.
```
