# Localized anatomy experiment — completed negative evidence

## Requirement / topology / authority
Guy approved the recommended automated child-localization experiment and granted
free technical direction. Scope: diagnose the existing anatomy false negative,
test normal poses/occlusion too, preserve original media and paid receipts, no
new render until useful quality evidence. Worktree C:/GNart/Work/sh-r3b1b-semantic-m1,
branch codex/r3b1b-semantic-recovery-m1, base53b9ff5bbf56bee060ca4ab7251cb68475880a66.
Head is the focused commit introducing this handoff (exact hash in final message).
Start clean ahead19; protected d53b768ccb2f and accepted-intent63ccb484 clean and
unchanged. One writer; no agent/reviewer or independent PASS claimed. Claude's
first pass read-only against the reconciled immutable range. No push/deployment.

## Implementation and scope boundaries
New files only, except CURRENT and engineering documentation:
- lib/local-anatomy-experiment.ts: experimental schemas, normalized boxes, 15%
  child-relative padding, bounded crops, explicit defect/uncertain/ordinary-occlusion
  classification, four-limb inventory and consistent verdict validation. Grounded
  variant requires limb/issue regions inside target crop with2% full-image tolerance.
  Coordinate validity does not prove semantic ownership or perception correctness.
- scripts/lib/local-anatomy-experiment.ts: genuine5.5/medium Responses calls for
  localization then inspection. Original image/anchor snapshots are SHA-bound.
  Full image + whole-child crop + overlapping65% upper/lower crops; no upscaling,
  repainting or source mutation. Output crops persisted with digest checks. Separate
  version/prompt/model/geometry fingerprints, response IDs/model/text/usage preserved
  before validation. No SDK retries. Unknown claims/incomplete/invalid evidence hold.
- scripts/experiment-localized-anatomy.ts: dev-only, realpath containment, new root
  identity and exclusive lock, source-anchor/image digest binding, expected labels
  kept out of requests, immutable experiment reports. No source story in inspector.
- lib/__tests__/local-anatomy-experiment.spec.ts: real adapter mocked at provider,
  geometry, evidence contradictions, uncertainty, crop equality, model profile,
  legacy variant cache separation, malformed/incomplete and no-rebilling replay.

Existing active judge v5, calibration validator, reader, image generation, numerical
resemblance0.70 and production defaults are byte-unchanged by this milestone.
Experimental protocols cannot produce a render permit. Historical variants stay
available for evidence replay; none is a recommended active production policy.
No coordinate, name, page number or story-specific rule hardcoded into inspection.

## Experiments and outcomes
Original inputs live in outputs/local-story-preview-dini-20260915. Sample-a is
original page1 (25c1545f), sample-b is repair-01/page-01.png (b30c4633); c/d/e/f are
pages3/5/9/12. Five controls were visually inspected by implementer, not granted
new owner/independent acceptance. False-positive accounting is provisional.

| Variant | Completed calls | Outcome |
| --- | --- | --- |
| v1 localized direct |12/12| Located6/6; original defect missed;5/5 normal controls matched |
| v2 limb inventory |4/12 planned| Raw original PASS again; corrected control's boxes invalid; run halted |
| v3 explicit coordinate units + crop grounding |4/4| Original/corrected pair1/2 matched; original still missed |

v2's first record used legal-range boxes at x0/y0 outside the child. The second
used x1/width1 and was rejected; no complete experiment-report.json exists for v2.
Do not treat v2 as six evaluated images or as a meaningful spatial PASS. v3 corrects
that coordinate-contract weakness; its boxes are valid but its anatomy interpretation
still rationalizes the malformed exposed parts as ordinary hidden/raised limbs.
Known coordinate error is not a transport unknown and is not rebilled.

Root-cause conclusion: localization/crop omission is not sufficient to explain the
false negative. v1 actual original/corrected crops inspected visually; exposed bad
regions are present. All10 saved crops across v1/v2/v3 recomputed pixel-equal to
their source regions. v3 also contains the relevant original area. Instructions inviting plausible
occlusion were a contributing hypothesis, not proven sole cause: neutral wording,
inventory and explicit geometry did not eliminate the perception failure.
No sensitivity/accuracy estimate is inferred from one known defective image.
v2/v3 changed both schema and prose and reran localization; not a pure crop-only A/B.

## Accounting and preservation
All20 provider calls have known completed receipts and recorded model
gpt-5.5-2026-04-23; no unmatched claims, retries, locks or unknown charges inferred.

| Root suffix | Input | Output | Cached input | Upper accounting USD | Standard estimate USD |
| --- | --- | --- | --- | --- | --- |
| v1 |41680|5993|0|1.43019|0.38819|
| v2 |14448|5130|3840|0.58734|0.20886|
| v3 |14720|4476|3840|0.57588|0.19060|
| Total |70848|15599|7680|2.59341|0.78765|

Original task planning limit5USD. v2 allowance3.5 admitted only after v1 settled
1.43019; v3 allowance1.5 admitted after v2 stopped at0.58734. No reservation was
exceeded. Upper accounting prices all tokens at30USD/M; standard estimate uses
5USD/M uncached input,0.50USD/M cached input,30USD/M output per the official
[GPT-5.5 page](https://developers.openai.com/api/docs/models/gpt-5.5). Neither is
invoice-verified charge evidence. No new image or audio calls in this milestone.

Ignored, untracked, local-only roots/configs: outputs/localized-anatomy-v1-20260915,
v2 and v3 correspondingly. Pushing Git does not back them up; no off-machine backup
verified. Published report SHA256:
- v1 experiment-report.json:2f8a663fe3aa2f8a5330bab211b8e431179fe2ab73d8aa3898a81684360d2309.
- v3 experiment-report.json:2a8611f08193babab1f40ea39721e12396785bdff1def0715bd86cfe7793bfe8.
- v2 steps/sample-b-inspect.result.json:6485e182b4067b0832517487bb33f349ad7e751af79e7244d6373967ef0c2536.
Current narrated reader retains13/13PNG and12/12MP3 digests; manifest SHA
9905fb7a727cfdf7d17992d8c38587c8cb967d5823972367ddd2d29cc4f63f68,
source225f2b01. Existing automated and owner verdicts unchanged.

## Validation / limitations / next action
Final focused129/129 tests in8specs,2.44s: new experiment25, local-preview-quality28,
local-story-preview32, local-preview-judge3, local-preview-identity4,
page-child-resemblance-vision15, local-book-review17, local-preview-narration5.
tsc --noEmit exit0; diff-check0. Earlier counts77/121/123/125 are not additive.
Fake-key/no-env-file replay reproduced v1exit2, v2exit1, v3exit2 with no new receipts.
Full check NOT rerun; previous NON-GREEN status remains. No full-book validation,
reader UI change, render, production/default routing change or independent PASS.
This is completed experimental tooling and negative evidence, NOT a repaired
anatomy detector. Stop similar prompt tuning here. A complementary review approach
is needed before relying on automated anatomy acceptance or widening image runs.

## Independent falsification targets
Verify expected labels/filenames/case IDs never enter model requests; geometry and
crop-byte binding; observe the actual original bad crop; reproduce malformed-region
holds; demonstrate replay cannot rebill; compare old active source blobs; recompute
cost/raw hashes. Disprove any alleged improved anatomy detection: none is claimed.
Check that no experiment report can satisfy the active render calibration contract.

## Copy-ready PowerShell
Already committed locally; no staging/commit reconstruction required.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format=fuller
git diff --stat 53b9ff5b..HEAD
git diff --check 53b9ff5b..HEAD
npx.cmd tsc --noEmit
npx.cmd vitest run lib/__tests__/local-anatomy-experiment.spec.ts
```

Optional propagation after review and Guy's explicit push decision (not run here):

```powershell
git push origin HEAD:codex/r3b1b-semantic-recovery-m1
```

For receipt replay in a disposable PowerShell (no usable credential):

```powershell
$env:OPENAI_API_KEY = 'offline-replay-no-provider-key'
foreach ($variant in @('v1', 'v2', 'v3')) {
  node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/experiment-localized-anatomy.ts "outputs/localized-anatomy-$variant-20260915.config.json" unavailable.env
  Write-Output "$variant exit=$LASTEXITCODE"
}
# Expected v1=2, v2=1, v3=2. These are the preserved failure outcomes, not green QA.
```
