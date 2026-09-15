# QA handoff: alternative-family visual defect comparison

Original request: proceed with comparing a different family or specialized visual
artifact detector on existing illustrations, no new renders. Read-only first pass;
no keys, paid API, image/audio generation, push or acceptance changes.

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1; branch codex/r3b1b-semantic-recovery-m1.
Base59f79166a8ab09cb8fcba0d063a6cbd37d87a7db; head is the single local commit
`test(qa): compare alternative visual judges without render authority`. Resolve SHA
and reconcile topology before review. This task sole writer; protected d53b768ccb2f
and accepted-intent63ccb484 clean/read-only. Started ahead21, no push in this task.

## Claims to falsify

- Five new technical files: lib/visual-qa-comparison.ts, scripts/lib/visual-qa-comparison.ts,
  scripts/prepare-visual-qa-comparison.ts, scripts/run-visual-qa-comparison.ts,
  lib/__tests__/visual-qa-comparison.spec.ts, plus
  CURRENT and gate/handoff. No active QA/default/reader/generation change.
-30 SHA-unique full-page images, grouped page variants:6 smoke,8 development,
  16 reserved unlabelled.1 Guy-rejected anatomy;5 provisional controls;24 unlabelled.
  Model output is NOT used as ground truth. Reserved set was not sent to providers.
- Same full PNG and neutral instruction for Sonnet/Qwen. No source story, previous
  verdict, expected label, case ID or filename in prompts. Only generated book pages
  sent, no child reference photograph. Provider preprocessing differs. Original
  Sol test had a different prompt/crop pipeline, so no pure model-only A/B claim.
- Requested Replicate versions frozen; actual Qwen response version="hidden".
  Model object in report is requested configuration, NOT attested snapshot identity.
  Exact model name required; non-hidden unexpected version rejected.
- Claim-first receipts, fixed0.25USD accounting per claim with usage=null,
  max3000 output tokens, Cancel-After120s, no paid retries. Token request/deadline/
  planning reservation is NOT a provider-enforced hard-dollar budget.
- Safe error metadata only; no provider-echoed input, logs or secret in receipts.
  HTTP status recording added after initial Sonnet failure, which remains unclassified.
- Read-only recovery: existing dispatch ID, or unique exact-input/time-scoped match
  from complete prediction list, then GET. Redacted image placeholder cannot match.
  No POST in reconcile-only. Failure/malformed/unknown never becomes automatic PASS.
- --continue-unresolved explicitly allows independent cases without retrying old
  claims. Full-case report includes unknown; all renderAuthorized=false. Exit0 for
  writing a complete report does not mean quality PASS. GeneralAccuracyProven=false.

## Runtime result and limitations

Qwen completed3 bound assessments: image02(original malformed) DEFECT;
image10(page9) DEFECT; image29(corrected original) DEFECT. Thus1 owner-label agreement,
2 disagreements with provisional pass labels,3 unresolved cases. Main agent viewed
the corrected full image after output: separate fingers are visible, and requiring
nail beds is not a supported style requirement. This is implementer judgment, not
independent visual PASS. Qwen may be oversensitive; not selected as active judge.

image02 initially held because provider returned hidden version. Its persisted ID
enabled GET-only recovery, no repeat charge. image04 POST504 had a candidate remote
ID589qbyz94srmr0d0mjatqck21w, but images are redacted in GET/list input; cannot prove
exact-input discovery, so not adopted. image06/image13 also POST504 and remain unknown.
Sonnet first POST yielded no dispatch ID; scoped listing showed no matching run.
No HTTP status was captured for that initial failure; NOT classified free/never-run.
Sonnet was not retried or expanded. Comparative evaluation incomplete, no winner.

MagicAssessor card/source inspected, not run; no weights downloaded, GPU service,
training job or new account/key created. Existing Replicate access used under the
approved alternative-provider experiment. No changes to existing OpenAI experiments.

## Evidence / cost / preservation

Ignored/local-only root outputs/visual-qa-cross-family-20260915; push does not preserve
it; no verified off-machine backup. Dataset hash:
c155ee0c890d1850589490210ee5284a3aa1cb6eac5ee72abe3df244061f9134.
Qwen report hash6209ca1a704dc443d38bf1bfd783fcd4059d6efb7d05dccdb20057afb7f5eb79.
7claims (Qwen6/Sonnet1),3known receipts,4unresolved.0.25USD retained per claim =1.75USD
accounting reservation under3USD planning limit, NOT actual spend. Known Qwen only:
5346input/994output; at0.276/1.101USD per million =0.00256989USD estimated.
This excludes unknown requests; no total paid amount or invoice verification claimed.
Pricing from public Replicate model-page billing configuration, retrieved2026-09-15:
https://replicate.com/qwen/qwen3-7-plus and https://replicate.com/anthropic/claude-4.5-sonnet.

All30 source PNG plus13current reader PNG/12MP3 hashes unchanged before/after.
No remaining run.lock. Fake-key Qwen replay exits0 with identical report and no new
POST, preserving3known defects/3unknowns. No repairs or whole-book readiness claimed.

149/149 focused in9specs (2.46s), new suite18/18, tsc0, diffcheck0. Tests include
normal/occluded schema semantics, separate authority metrics, exact provider payload,
version handling, withheld labels, byte binding, replay, identity mismatch, failed
known/unknown transport, read-only recovery, redacted discovery rejection and
independent-case continuation. Full npm run check NOT rerun/remains NON-GREEN.
No independent technical PASS. Next is independent style-aware labels and reliable
transport before any broader benchmark or active judge cutover.

## Inspection / optional push after review

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format=fuller
git diff --stat 59f79166a8ab09cb8fcba0d063a6cbd37d87a7db HEAD
git diff --check 59f79166a8ab09cb8fcba0d063a6cbd37d87a7db HEAD
# Only on Guy's push decision; carries all ahead commits, not just this experiment.
git push origin codex/r3b1b-semantic-recovery-m1
```
