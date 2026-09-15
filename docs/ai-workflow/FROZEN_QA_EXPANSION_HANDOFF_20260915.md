# Review-only handoff: frozen QA expansion and severe-only probes

Requirement: automatic QA without routine Guy inspection, tolerant of non-realistic
illustration; only clearly wrong severe anatomy should block. Four bounded experiments
tested this intent. No model/policy has earned production cutover from these results.

Branch codex/r3b1b-semantic-recovery-m1, worktree C:/GNart/Work/sh-r3b1b-semantic-m1.
Base936ce9709e5ca05a5b07a5171d732abc718a52a6; review its focused successor containing
this file (resolve full hash with command below, then pin the immutable range).
Codex sole writer; no assumed active reviewer or self-PASS. Start clean ahead23/0.
Protected d53b768ccb2f and accepted-intent63ccb484 clean/read-only. Archived input
images came from main90364542; main has unrelated dirty files, read-only here.

## Code scope

- scripts/lib/frozen-qa-benchmark.ts + run-frozen-qa-benchmark.ts: strict manifest,
  PNG/SHA/prompt/path/environment preflight,12-case maximum, immutable identity and
  reports, lock, old unknown/no-paid-retry semantics, separate cohort summaries.
- Four scripts/fixtures/style-qa-*.json manifests: exact images, labels, view/policy
  settings and hypotheses fixed before each stage. No reference photos sent.
- lib/visual-qa-comparison.ts and scripts/lib/visual-qa-comparison.ts: opt-in exact
  detail views, separate severe schema/parser, and report-finding verification mode.
  Old default inputs/fingerprints/outputs preserved; official async transport reused.
- lib/illustrated-anatomy-severity.ts: severe-classified defects separate from
  nonblocking observations. lib/anatomy-finding-review.ts: exact per-ID coverage,
  severe/minor/unsupported/uncertain classification, software-derived disposition;
  uncertain takes precedence and does not authorize repair.
- Three new specs plus additive comparison tests; CURRENT and Decision Gate.

Proposal provenance checks report hash, target image SHA, unique matching detector
result and exact findings, not merely a descriptive filename. Source labels/bases,
paths, expected verdicts and authority records never enter the provider prompt.
Full image remains first when a detail is used. New modes cannot reuse old receipts.
No production caller or active local quality policy switched. Rollback: do not use
the experimental runners; preserve all recorded results. No source/image migration.

## Actual results / limits

| stage | calls | original known defect | provisional normal controls |
| --- | --- | --- | --- |
| expansion |12| defect | corrected pass;5/10 additional pass,5 defect |
| full + detail |4| defect |0/3 pass |
| severe-only |8| **missed: pass** |7/7 pass |
| verify findings |4| **missed: pass** |3/3 pass |

Leniency removed false alarms but also lost the critical regression. Finding
verification likewise denied the original disconnection while describing the red
sleeve, not the anomalous rear flesh/blue-cloth fragment. Wrong-region grounding is
the next hypothesis, not a proven cause or completed solution. No candidate enabled.
Model-generated critiques are not ground truth. All normal labels provisional;
only1 owner-labelled anatomical defect; later stages post-selected, related samples
present, no general sensitivity/accuracy confidence claim. Same model twice is not
independent QA. Continuity/identity/global anatomy were not validated by this probe.

28 claims/28 IDs/28 succeeded receipts,0 unknowns/retries, no run locks. Provider
version hidden, not an attested deployment hash.57507 input/6913 output tokens.
Using previously observed public Qwen tier0.276/M input and1.101/M output, estimate
0.023483145USD; not invoice billing. Fixed reservations total7USD across3/1/2/1USD
stages. No hard dollar cap asserted, older unresolved costs unaffected.

Local-only ignored roots and report SHA-256 (Git push does not preserve these):

| outputs root suffix (qa-validation-...-20260915) | report SHA-256 |
| --- | --- |
| style-expansion | c8b9558c00b99d334e3336113d0e0f338bcb51bcbc20bf978399cf8760e431ac |
| contact-details | 8f00c622c7e6cb2051bdd2bd13e8548a9f625647552881f4cba5250a3f2209b6 |
| severe-only | f27cd0615b88f62a33bc65cec1b6a575ddef55db3b431728f7f749e9b2c314fc |
| finding-verification | 834038c7c1e86c2b65340f4fc9be39469adcf025e51b1e7b510d012f8773a3f5 |

## Validation and falsification

182/182 across12 specs (anatomy-finding-review, illustrated-anatomy-severity,
frozen-qa-benchmark, visual-qa-comparison, local-anatomy-experiment,
local-preview-quality, local-story-preview, local-preview-judge,
local-preview-identity, local-book-review, local-preview-narration,
page-child-resemblance-vision); tsc --noEmit0, diff-check0. npm run check NOT rerun;
repository remains NON-GREEN. No stability or independent technical closure.
Fake-key replay reproduces all four new stages and preceding3-arm calibration;
no new POST.39 before/after digests unchanged, including12 input images,13 reader
PNGs,12 reader MP3s and2 prior reports. Four derived crops stored separately.

Attack: source/label leakage; unsafe input/output paths and symlinks; changed report,
prompt, bytes, view or policy reusing a cached call; incomplete/duplicate finding IDs;
minor notes becoming repair authority; malformed result becoming pass; same-model
agreement or leniency mislabeled independent QA; ignored-output durability; selected
controls mislabeled general coverage. CLI lacks a subprocess integration suite;
shared entry path is exercised with fake transport. Runtime judged pixels remain
fallible regardless of correct schema and green tests. No human-QA bypass shipped.

## PowerShell inspection / optional owner-directed propagation

```powershell
Set-Location C:/GNart/Work/sh-r3b1b-semantic-m1
$qaExpansionHead = git log -1 --format=%H -- docs/ai-workflow/FROZEN_QA_EXPANSION_HANDOFF_20260915.md
git status --short --branch
git show --stat $qaExpansionHead
git diff --check "936ce9709e5ca05a5b07a5171d732abc718a52a6..$qaExpansionHead"
# Optional only on Guy's push direction; carries ALL prior unpushed commits too.
# git push origin codex/r3b1b-semantic-recovery-m1
```

Already committed locally; no stage/commit reconstruction needed. Reconcile actual
reviewer branch/hash before review. Next work is precise localization/correspondence
before severity verification, not another blanket relaxation or routine owner QA.
