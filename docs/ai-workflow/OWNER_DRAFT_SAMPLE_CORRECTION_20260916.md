# Shared draft sample — QA correction Decision Gate

## Requirement, authority and topology
Correct Claude's HOLD P0=0/P1=1/P2=4 on d1a79ab3..c94b0511 under the standing
fix/re-gate workflow. Same task sole writer in C:/GNart/Work/sh-r3b1b-semantic-m1,
branch codex/r3b1b-semantic-recovery-m1. Correction base
6b14617a58b3ac88eab6335119c767b0eba86747 (documentation successor, clean/ahead38).
Protected d53b at768ccb2f and accepted-intent-wave-2 at63ccb484 clean/read-only.
No dedicated task or parallel writer; no product decision required for this repair.

## Observed, cause and expected behavior
History confirms c94b0511 removed generic `or animals` along with legitimate
removal of predecessor-specific living-path prose. Restore the generic exclusion;
do not attribute unwanted board animals solely to absent board QA. The observed
regression and paid unwanted animals coexist; no counterfactual visual experiment
proves the omission alone caused those pixels or restoration guarantees clean ones.
Sample budgeting also altered the legacy supplied-board reservation; restore old
legacy formula and test both modes. CLI conflict throws outside sanitized handling;
put parsing within an async boundary. Sample prior-page context lacks text and
explicit unaccepted status present in the legacy manifest; use a common page-row
builder for render manifests and sample context and exercise the real caller twice.
Reader evidence issue is a wrong directory, not a missing asset migration.

## Scope, sequence, risk and acceptance
Files: runner, existing spec, CURRENT, original gate and this correction/handoff.
First pin regressions with offline tests, implement, run four focused suites and
tsc/diff-check, verify preserved artifacts, commit only explicit paths. Re-gate
must independently falsify exclusions, legacy/sample budgets, CLI no-stack output,
prior-page text/hash/reference binding and retained non-acceptance. No story-specific
rules. Main compatibility risk is changed prompt/context fingerprints: historical
paid roots remain immutable and are not resumed with changed requests. A future
paid attempt requires a new root, not rewriting existing checkpoints or receipts.
Reject extra board QA calls as the response to this regression. Do not modify
active judge, thresholds, automatic repair, accepted story, reader or customer flow.
No new schema migration. Rollback by reverting this focused commit while preserving
all outputs. Tests establish contract behavior only, not visual accuracy.

## Cost / stop-check / review
Zero image, narration or QA provider calls; no key-file access, push or deployment.
Offline mocked checks are the smallest safe proof. No Guy eyeball needed to verify
restored code constraints; existing board/page remain held and unaccepted. Claude
gets immutable base-to-head re-gate; Codex does not award independent PASS.
Full repository stability remains NON-GREEN; do not widen review coverage to the
three unreviewed commits 5e25996f..d1a79ab3 (including anatomy adapter/schema export).

## Implementation and focused proof
Restored the exact generic `No people or animals` exclusion; predecessor living-path
instructions remain absent. Sample supplied-board deduction stays sample-only;
legacy with props reserves pages plus one board, supplied or not, exactly as before.
CLI parsing now returns through an async boundary caught by the existing sanitizer.
A shared draftPageRow builds legacy render rows and sample comparison context with
text, image name/SHA, automatedPassedfalse, scorenull and original unaccepted reason.
Selection semantics intentionally remain different: sample compares earlier selected
pages; legacy QA compares its last three diagnostically passed body pages. No missing
pages are invented and comparison images are not declared canonical references.
Sample identity policy bumped to shared-quality-before-next-page/v2; a v1 root is
rejected before dispatch. Existing non-sample identity shape is unchanged. The board
prompt itself changes checkpoint fingerprints for newly generated boards in either
mode: preserve historical roots; no paid resume attempted by this correction.

124/124 focused tests: owner48, quality28, judge16, checkpoints32. tsc exit0.
Before implementation the expanded 47-test owner spec had six failing cases: generic
exclusion, supplied-board legacy budget, three CLI conflicts, prior-page context.
CLI harness first required explicit TSX_TSCONFIG_PATH for alias resolution from a
temporary cwd; after that correction all three failed on the actual conflict stack.
After implementation they passed; added v1-identity preservation case also passes.
First typecheck found a test-only Array.at library-target mismatch, corrected with
array indexing; subsequent typecheck exit0. No assertions weakened or timeouts raised.
The real runner, mocked image/judge only, completes two selected pages, binds prior
text/image/reference, and compares that payload against a separately rendered legacy
manifest and real legacy QA caller. This is not a live multi-page vision evaluation.
Shared judge/quality/checkpoint and anatomy-policy source files remain unchanged.

Full `npm run check` also completed exit1: both typechecks passed; ordinary phase
368 passed files/2 failed/17 skipped, tests5640passed/2failed/73skipped (5715),
158.30s. Resource phase22files/671tests passed,230.57s. Inventory409; phase protocol
OK. Same reported assertion failures as the preceding full run: Anthropic model
inventory includes claude-4 plus retired Sonnet; workload count expects393, gets409.
No baseline checkout reproduction and no claim all failures inherited or fixed.
The corrected owner spec passes inside the full run as well as focused execution.

## Preserved evidence and reader reproduction
Source6ad80286..., paid board0a8776ae..., page3a3839a66... and three rejected audition
PNG hashes rechecked unchanged; page7 still absent. Offline receipt audit recomputes
four HISTORICAL provider results, zero unknown, list estimate0.1572235 and conservative
0.81999. Those are previous-run costs, not new spend. Its existing cost-audit.json
is compared byte-for-byte; no write because the file already exists. No paid runner
replay with corrected code; raw blind/contextual disagreement remains unchanged.
Outputs ignored/local-only with no verified off-machine backup; Git push cannot save
them. This tracked brief preserves commands and assertions, not original paid logs.

P2-4: exactly25/25 PNG/MP3 manifest bindings verified at the actual reader root.
PowerShell, read-only, no network/credentials:
```powershell
$readerRoot = 'C:/GNart/Work/sh-r3b1b-semantic-m1/outputs/panda-book-final-draft-20260915'
$readerManifest = Get-Content (Join-Path $readerRoot 'manifest.json') -Raw | ConvertFrom-Json
$verifiedAssets = 0
foreach ($page in $readerManifest.pages) {
  if ((Get-FileHash (Join-Path $readerRoot $page.imageName) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $page.imageSha) { throw 'reader_image_changed' }
  $verifiedAssets++
  if ($page.audio) {
    if ((Get-FileHash (Join-Path $readerRoot $page.audio.fileName) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $page.audio.sha) { throw 'reader_audio_changed' }
    $verifiedAssets++
  }
}
if ($verifiedAssets -ne 25) { throw 'reader_asset_count' }
"preserved_reader_assets=$verifiedAssets"
```

## Claude Code — copy-ready re-gate request
Please re-gate this focused correction, read-only. Original requirement: close your
HOLD0/1/4 without paid rerender, scope creep or false visual-acceptance claims.
Worktree/branch above; immutable base6b14617a58b3ac88eab6335119c767b0eba86747.
Review head is the single fix(drafts) commit containing this handoff; use the exact
hash supplied in Codex's final handoff and reconcile before running if HEAD differs.
Five paths: scripts/run-owner-book-draft.ts, lib/owner-book-draft.spec.ts, CURRENT.md,
docs/ai-workflow/OWNER_DRAFT_GATED_SAMPLE_20260916.md and this file.
Try to falsify each finding's correction and the v1/v2 preservation boundary, including
real CLI stderr and real runner context rather than helper-only tests. Verify reader
hashes at the exact root above. No provider calls, real credentials, render, edits,
commits or push during first review. Do not rerun the old paid command. No independent
PASS is claimed; previous HOLD remains pending your re-gate. Separate three-commit
range5e25996f..d1a79ab3, reader routes, recurring-object fidelity, page7 and repository
stability remain open. This fixes neither general visual detection nor product quality.

Inspection and checks (pin reviewHead from the final handoff before executing):
```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline 6b14617a..HEAD
git diff --stat 6b14617a..HEAD
git diff --check 6b14617a..HEAD
npx.cmd tsc --noEmit
npx.cmd vitest run lib/owner-book-draft.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-story-preview.spec.ts
node outputs/kim-system-sample-input-20260916/audit-results.cjs
```
No stage/commit steps required after this milestone's commit. No push performed.
Only if Guy separately requests propagation (push carries the whole ahead set):
```powershell
git push origin codex/r3b1b-semantic-recovery-m1
```
