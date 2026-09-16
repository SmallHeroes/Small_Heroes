# Intake direction P2: correction and independent re-gate request

Base e7f1a02310580223c82b42f5812c598dbe03b0ec; endpoint is the commit first
adding this file. Same sole-writer task at C:/GNart/Work/sh-r3b1b-semantic-m1,
branch codex/r3b1b-semantic-recovery-m1. Start clean ahead49/behind0.
Protected d53b768ccb2f and wave2 63ccb484 clean. No production writes or spend.

## Intake, decision and original independent verdict

Claude supplied PASS P0=0/P1=0/P2=1 for7b21c36a..e7f1a023 only. He confirmed
all18 candidate projections, source/approval hashes, shared validator identity,
11 preparation tests,45 adjacent tests and tsc. He also disclosed two temporary
scratch probe files created/deleted in the worktree; final worktree was clean.
His P2 is valid: no real input direction lines exist in the18 current/reading
predecessor texts, so corpus success does not exercise nonempty-direction rejection.
No new Editor PASS or runtime authority follows from that technical review.

Bounded correction: add explicit synthetic positive/negative guard cases and
document corpus evidence limitations. No manuscript/approval/manifest changes.
No major production/story-bank/gate action, no new owner decision needed. Keep
this milestone in the same task. Rollback is reverting these isolated tooling
and documentation changes; accepted/runtime sources need no rollback.

## Additional defect reproduced during correction

With a synthetic in-memory descriptor (NOT a new Guy approval), insert an empty
imageDirection line then a nonempty one. The genuine shared parser exposes the
first value and strips all direction lines from parsed prose. Thus the existing
every(page.imageDirection === '') guard silently accepted the second value.
Initial test run:13 passed/1 failed, Missing expected exception, exit1. Existing
11 tests and both single-line controls passed. No current corpus is affected.

Fix: the preparation helper additionally inspects ALL raw direction lines using
the parser's case-insensitive line-prefix semantics; every value must be empty.
Keep the existing parsed-value check. No change to the shared parser/publication
validator. Empty values remain accepted; no directions are stripped by this tool.
Synthetic variants cover later nonempty value, uppercase/tab, and multiple empty
values before the nonempty one. Exact approved input hashes still checked first.

## Validation and scope

Final measured results are recorded in CURRENT.md. Tests/README plus4 lines in
prepare-intake.cjs, CURRENT.md and this handoff. No source story, candidate story,
OWNER_APPROVAL.json, inventory or manifest edits. --check must still reproduce
the same18 candidate bytes and manifest. Original technical PASS ends e7f1a023;
this correction is NOT independently passed until re-gated. README now records
the received prior verdict; the hashed intake manifest is preserved as historical
pre-review preparation evidence, not updated to claim new authority.

No paid/API calls, keys, rendering, audio, publication, push or runtime changes.
Full repository check not rerun for isolated intake helper; previous NON-GREEN,
reader/visual issues and outstanding editorial/publication prerequisites remain.
An approved hash is an integrity binding, not proof against forged approval data.

## Independent falsification targets

Reproduce the empty-first bypass on the base and rejection on the correction.
Check nonempty first/later lines, case variants, empty-only false positives and
preservation of next-line prose. Verify all18 old/current/derived hashes, no
approval/manifest mutation, no claim of real-corpus direction removal testing,
and no widening of the old independent PASS. Re-gate this range read-only.

```powershell
Set-Location C:/GNart/Work/sh-r3b1b-semantic-m1
$directionBase = 'e7f1a02310580223c82b42f5812c598dbe03b0ec'
$directionHead = git log --diff-filter=A --format=%H -- story-pipeline/06_editorial_refresh/2026-09-16/INTAKE_DIRECTION_REGATE.md | Select-Object -First 1
if ((git rev-parse "$directionHead^") -ne $directionBase) { throw 'Review range mismatch' }
git status --short --branch
git diff --stat "$directionBase..$directionHead"
git diff --check "$directionBase..$directionHead"
node --test story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.test.cjs
node story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.cjs --check
npx --no-install tsc --noEmit
# Only on Guy's explicit push instruction; carries all outstanding history:
# git push origin codex/r3b1b-semantic-recovery-m1
```
