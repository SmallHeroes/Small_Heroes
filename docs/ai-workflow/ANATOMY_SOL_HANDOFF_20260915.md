# Claude Code handoff: Sol Medium anatomical experiment

First pass read-only. No provider calls, key access, renders, acceptance or push.
Requirement: Guy requested GPT-5.6 Sol at medium for the anatomy test, after5.5
missed the original malformed child. No full-book generation requested this turn.
Worktree C:/GNart/Work/sh-r3b1b-semantic-m1; branch codex/r3b1b-semantic-recovery-m1.
Base807b59ea266352239027bb1be4b039af450c1cc7; head is the single local commit
`test(preview): compare Sol Medium anatomy on existing images`. Resolve its full
SHA before reviewing; stop/reconcile if additional commits or dirty changes exist.
This task is the sole writer. Protected d53b768ccb2f and accepted-intent63ccb484
remain read-only/clean. Started ahead20/behind0; no push in this task.

## Implementation and boundaries

Only optional exact gpt-5.6-sol experiment configuration/adapter override and tests.
Defaults, production/local active judge, identity threshold, prompts, schemas,
geometry, output tokens, retries and reader media unchanged. Model is bound in
run and checkpoint identities. CLI schema and direct adapter reject other strings.
Both stages change model, so localized crops can differ: NOT fixed-crop inspector A/B.
No expected labels, case names, filenames or historical verdicts in provider input.
No model fallback. Each of4 actual receipts identifies gpt-5.6-sol. Medium is pinned
in request code and run identity; response receipt does not repeat reasoning effort.

## Results, not independent PASS

Both cases returned pass with structurally valid grounded limb inventories.
Original25c1545f37bfd9e74158f99c79c88698a2a5e320f9c56366ffdd9525f91ebddb:
missed owner-rejected anatomy. Model rationalizes rear fragment as ordinary occlusion.
Corrected b30c463338ad0cab6a06add458fafc0f3d28047fac21f86c927171399c10271f:
passed as expected. Geometry is not semantic verification. Report experiment_hold,
renderAuthorized=false, generalAccuracyProven=false. Original Guy rejection remains.
This is a failed discriminator on this pair, not a general model ranking.
No further prompt tuning or paid retries; no new image/audio/source/reader changes.

## Evidence and accounting

Root outputs/localized-anatomy-sol-20260915; config sibling .config.json.
All ignored/untracked, machine-local, no verified off-machine backup; Git push
does NOT preserve them. Existing roots untouched.

- Report SHA2566f1fd42c57d79bd8bc91259b8933fd0b29c34643752f0effdefa9eec8099323b.
- Identity SHA25615481aec260105f63c5bfd3ba6730aae4179c84d92a0020134667fc5c9cb1259.
- a-inspect receipt4d34ef6d72519e76f17183f44fb16eb9f9454820ed5068c7ef79fa2130e9ac41.
- a-locate receipt75095e0b2bbc0b1a17fb7cc8b9d6ecb1715464ccc6b4ca1c75b0d74ab085a0ea.
- b-inspect receipt549f92dac9f74d434048c3f0d0a194d0bae593f7f5d85cb4ad14a26fea008aa6.
- b-locate receipt0f8a0c365386cc3514264a37a8f64767d5f920e7cf1b97d8219ac6de3e745ccb.

4claims/4receipts, no orphan or lock; no retry. Inputs14674 (1514cached,
13148cache-written,12ordinary), outputs4038. Standard estimate:
(12*4 +1514*0.4 +13148*5 +4038*20)/1e6 =0.1471536USD.
Official https://developers.openai.com/api/docs/pricing fetched2026-09-15.
Serving tier not explicitly pinned/recorded, so this is a standard-list estimate,
NOT verified charge. Existing all-token30USD/M accounting0.56136USD is below2USD
planning fence and every per-call reserve; it is not a universal fast-tier bound.
No billing endpoint/invoice read. A future accounting hardening may pin and record
serving tier; no retrospectively invented tier here.

## Validation and falsification targets

131/131 in8specs (2.78s), tsc exit0, diff-check0. New anatomy suite27/27.
Focused paths: local-anatomy-experiment, local-preview-quality, local-story-preview,
local-preview-judge, local-preview-identity, local-book-review, local-preview-narration,
generation-pipeline/page-child-resemblance-vision. No full check rerun; remains
NON-GREEN. No independent technical PASS/product/release readiness claimed.

Fake-key CLI replay: Sol exits2 and reproduces exact report. Old v1/v2/v3 exits2/1/2;
v2 retains its prior geometry failure. No new receipts/calls on replay. Live native
shell wrapper reported exit1 for expected nonzero; direct replay propagating
$LASTEXITCODE proves CLI exit2. Both Sol crops raw-pixel equal to source extracts.
All13 current reader PNG/12MP3 hashes equal before/after.

Try to falsify exact routing/effort in both calls; no-label-leak; omitted-option
old replay compatibility; cross-model cache reuse rejection; arbitrary override
rejection before dispatch; exact source crops; unchanged active calibration hold;
receipt hashes/counts/cost arithmetic including cache writes; and no overclaim
that usable coordinates mean correct anatomy or that this pair proves accuracy.

## Copy-ready inspection/push, after independent review

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format=fuller
git diff --stat 807b59ea266352239027bb1be4b039af450c1cc7 HEAD
git diff --check 807b59ea266352239027bb1be4b039af450c1cc7 HEAD
# Only if Guy elects to push: carries ALL local ahead commits, not this one alone.
git push origin codex/r3b1b-semantic-recovery-m1
```
