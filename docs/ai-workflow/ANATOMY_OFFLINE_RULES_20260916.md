# Anatomy evidence rules: offline-only Decision Gate

## Approved scope / stop-check

Guy requested continuing the offline recommendation. Sole writer: current task,
C:/GNart/Work/sh-r3b1b-semantic-m1, codex/r3b1b-semantic-recovery-m1,
base 7952ab1ead39f92c174664639e80a9214cdc4df1, clean/ahead 31 at intake.
Protected d53b 768ccb2f and accepted-intent 63ccb484 remain read-only.

1. Change: isolated pure evidence adjudicator and synthetic tests; read-only replay
   of previously paid anatomy records. No live judge imports or schema migration.
2. Problem: legacy fixed four-slot inventory can normalize extra fragments;
   ordinary_occlusion can carry unsupported explanations. A hidden proximal
   attachment alone is NOT proof of malformed anatomy.
3. General evidence rules, no story/page/model-specific repairs.
4. No hardcoded species limb counts: optional endpoint maxima are external policy
   supplied by a caller from canonical authority, not observations/model verdict.
5. Files: new lib/anatomy-evidence-policy.ts and spec, offline replay script,
   CURRENT and this brief. Existing experimental/active policy files unchanged.
6. Expected: visible attachment, supported occlusion and fully hidden parts can
   pass; unresolved/incomplete evidence holds; localized visible defects are
   preserved. Uncertainty outranks repair, and all outputs deny render authority.
   Open-ended parts inventory, not exactly four required limbs.
7. Validate deterministic positive/negative/contradictory cases and old receipts.
   Synthetic tests prove rule behavior only, NOT image detection accuracy.
8. Cost: zero providers, keys, renders or audio. No guessed $0.35 billing promise.
9. Rollback: revert focused addition; leave all existing receipts/media untouched.
   No coercion of old prose into new evidence, no regex-derived defect labels.
10. Owner approval covers this offline milestone; no further product decision
    needed. Claude first pass read-only: falsify hidden-limb handling, evidence
    binding, missing subjects, extra endpoints, uncertainty and no authority.
11. Exclude active judge/prompt/threshold changes, deployment, push, new experiments
    in paid APIs or any automatic release. No new creative review/eyeballing needed.

## Known limits

Structured coordinates and labels remain observations, not pixel truth. A model
can hallucinate an attachment or occlusion boundary. Missing evidence must not be
converted into a proven defect. Distinct observation IDs do not prove distinct
physical endpoints; a future visual extraction experiment must deduplicate views
and measure false positives/negatives, including ordinary occlusion controls.
External endpoint maxima must reflect reference-authorized anatomy, not a global
two-limb rule for creatures or characters with different anatomy.
No independent PASS or general accuracy claim; repository full check remains open.

## Evidence / handoff

135/135 focused tests in five specs: policy32, legacy anatomy27, judge16,
quality28, checkpoints32. Entirely synthetic/mocked inputs except the separate
archive audit below. No live image accuracy claim. Typecheck and diff check exit 0
before commit. Full npm run check not rerun for this isolated offline addition;
historical repository stability is not closed. No independent technical PASS.

Archive audit validates candidate SHA and inspection claim/result fingerprint
agreement, prints receipt SHA, replays saved inspection validators including v3/sol
grounding. It does NOT reconstruct provider requests or prove authenticity of every
identity/location record. It does not access credentials, send API requests, modify
receipts or infer new evidence fields from free prose. Eight receipts, two unique
images, zero calls. Labels below are historical operator labels, not new visual QA.

| Version | Sample a (label defect) | Sample b (label pass) |
| --- | --- | --- |
| v1 | observed_pass | observed_pass |
| v2 | observed_pass | anatomy_box_outside_image |
| v3 | observed_pass | observed_pass |
| sol | observed_pass | observed_pass |

All eight model raw verdicts are pass. Sample-a SHA
25c1545f37bfd9e74158f99c79c88698a2a5e320f9c56366ffdd9525f91ebddb;
sample-b SHA b30c463338ad0cab6a06add458fafc0f3d28047fac21f86c927171399c10271f.
All three inventory sample-a suspect arms have regionPresent=true. This falsifies
the claim that merely removing the null-region exemption fixes these observations.
There is no 2/3 improved-detection claim: old records lack the new fields and are
never silently migrated. Repeated runs on two images are not six independent cases.
Local-only historical outputs are not stored in Git; fresh clones cannot replay
them without separately preserved original artifacts.

## Ready-to-copy independent QA brief

Review-only, no provider/key/image calls or edits. Original requirement: continue
offline rule validation before spending; leave active judge unchanged. Review the
single focused child of base 7952ab1ead39f92c174664639e80a9214cdc4df1 on
codex/r3b1b-semantic-recovery-m1. Resolve range below; if reviewer HEAD differs,
reconcile before accepting any verdict. Only five files: new policy and its spec,
offline archive replay script, CURRENT.md and this document.

Falsify valid occlusion/hidden-limb handling, malformed or missing localization,
unknown subject ownership, candidate/context binding, duplicate endpoints, explicit
defects alongside uncertainty and optional external creature endpoint limits.
Try to get any output to authorize repair/render. Confirm no active caller imports
the new policy and existing image/audio/QA code is byte-unchanged from base.
Do not equate structured claims with pixel-grounded truth; hallucinated attachment
still passes the synthetic contract. Exact-box duplicates hold, near-duplicates
are not solved. A future blinded vision experiment needs distinct positive and
negative images, natural occlusion, extra endpoints and repeatability, not merely
these synthetic tests. No paid run or model adapter is included in this milestone.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$anatomyBase = '7952ab1ead39f92c174664639e80a9214cdc4df1'
$anatomyHead = git rev-list --reverse --ancestry-path "$anatomyBase..codex/r3b1b-semantic-recovery-m1" | Select-Object -First 1
git status --short --branch
git show --no-patch --oneline $anatomyHead
git diff --stat "$anatomyBase..$anatomyHead"
git diff --check "$anatomyBase..$anatomyHead"
npx.cmd tsc --noEmit
npx.cmd vitest run lib/anatomy-evidence-policy.spec.ts lib/__tests__/local-anatomy-experiment.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-story-preview.spec.ts
npx.cmd tsx --require ./scripts/shims/register-server-only.cjs scripts/replay-anatomy-archive-offline.ts
# Optional only following Guy's explicit push instruction (carries earlier unpushed commits too):
# git push origin "${anatomyHead}:refs/heads/codex/r3b1b-semantic-recovery-m1"
```

Tests execute current checkout: if HEAD moved, use an agreed pinned read-only
review worktree. Do not reset the writer. Codex commits the focused milestone;
no staging or additional commit is required in the handoff.
