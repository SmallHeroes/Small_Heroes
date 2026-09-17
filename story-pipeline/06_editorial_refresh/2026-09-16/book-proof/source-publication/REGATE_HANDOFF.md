# Claude Code re-gate: publication evidence P2s

Requirement: address the two P2s in the supplied87282474..949a360d publication
PASS0/0/2 without extending authority or changing text/visual candidate bytes.

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1; branch codex/r3b1b-semantic-recovery-m1.
Base949a360df86840c761384eaeaa698b87016c12f9. Head is its single direct child,
subject `docs(story): retain replay receipts and clarify visual scope`.
Resolve to full SHA and reconcile before review. Same sole-writer Codex task;
first QA pass read-only. Start clean/ahead58, protected768ccb2f/63ccb484 clean.

## What changed

- Two NEW real CLI replay receipts, not edits to creating receipts. Both exit0,
  created:false, same identities/results as originals except created.
- replay-preservation.json records fresh observation times, commands and12
  target-file snapshots before/after (SHA256,size,mtime all identical). Source
  lifecycle's transient lock is disclosed; no lock remained. Not write-free.
- Documentation labels candidate page-directions-only, not complete render plan.
  No recurringProps/visualLanguage schema additions or old-board reuse. Canonical
  prop/style, contract/Blueprint/package/references remain downstream gates.
- CURRENT records supplied independent6364pass/73skip full-green observation.
  Historical Codex failures are retained. The supplied review's interim claim
  that they were resource failures is corrected: ordinary failed4,resource passed.
  One inventory test was corrected between the runs. Machine-only causation is
  not established; stability remains a risk, not a permanently closed property.

No production, test, source, acceptance, direction/candidate/preparation mutation.
Original HANDOFF/VALIDATION are updated with dated review context; original
creating receipts, verification.json and full-check-summary.json are untouched.
New records will accompany this commit; old ignored roots remain local. No
verified off-machine backup or automatic push is claimed.

## Actual verification

Both existing real CLI replays exit0 with created:false. Independent receipt
reconciliation (node:assert deepEqual) proves each equals its creating receipt
except created. Before/after inventory exact12/12; all12 current bytes rehashed.
Existing verify.cjs exit0:7/5 files bound,18 original roots,12 directions, exact
prose, runtime null-source hold. npx tsc --noEmit exit0. diff --check clean.
No tests/full check rerun for this evidence-only correction. Reviewer full-green
result is attributed to the supplied report, not claimed as a new Codex run.

## Falsification targets and commands

Try to find changed artifact bytes, mismatched identities or fresh receipts that
actually reconstruct history. Compare creating/replay receipts ignoring only
created. Recompute preservation hashes. Challenge ambiguity about render
readiness and ensure style/prop plans have not been granted authority by prose.
This is submitted for re-gate; Codex does not self-close either P2.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log -2 --format=fuller
git diff --stat 949a360df86840c761384eaeaa698b87016c12f9 HEAD
git diff --check 949a360df86840c761384eaeaa698b87016c12f9 HEAD
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/source-publication/verify.cjs
npx tsc --noEmit
```

Publication PASS stays87282474..949a360d; earlier code PASS stays4fd7eda0..95a8d7b1.
ea3850d7 visual data remains outside independent creative acceptance. No render,
anatomy, narration, complete-book, product or release acceptance. Cost$0;
no provider or credentials. Next genuine dependency is visual review/acceptance
and downstream contract/package, not additional evidence-only loops by default.

## Optional push after explicit Guy instruction

Commit already exists at handoff. Push carries the entire ahead set, not just
this correction. Inspect first; no push was performed in this task.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline origin/codex/r3b1b-semantic-recovery-m1..HEAD
git push origin codex/r3b1b-semantic-recovery-m1
```
