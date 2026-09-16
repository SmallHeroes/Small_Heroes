# Indented direction P2: focused correction

Base bfe886db14a1eee2a5b84e42fc4a8cc15e603adf; endpoint is the first commit
adding this file. Worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1, same task/sole writer, clean ahead50 at start.
Protected d53b768ccb2f / wave2 63ccb484 clean and unchanged.

Claude's PASS0/0/1 covers e7f1a023..bfe886db, not this correction. His remaining
P2 is verified: empty first direction + indented nonempty later direction escapes
both checks but remains visible prose. Current corpus clean, no runtime impact.

## Bounded decision and fix

Correct the existing offline intake constraint, not production parser semantics.
Allow leading whitespace excluding CR/LF before the reserved imageDirection key
in the raw scanner. Nonempty values fail; empty values remain allowed. Do not
strip lines, change approved stories, mutate review/approval hashes, or publish.
No new product choice, major action, provider, credential or render allowance.
Rollback is reverting this helper/tests/docs correction; no source migration.

Red proof: new tests against unchanged helper returned16pass/1fail, exit1,
Missing expected exception. Green proof:17/17, exit0. Eight rejection variants
(spaces/tab/mixed/NBSP x pages1/7) prove the parser leaves the injected line in
prose while the helper rejects it. Four empty-first variants preserve all parsed
pages; ordinary prose mentioning the key mid-sentence is accepted unchanged.
Synthetic descriptors are in-memory test fixtures, never Guy approval records.
--check exit0,18/216, identical saved candidates/manifest. tsc --noEmit exit0.
Prior adjacent45 tests not rerun; full check not rerun, remains NON-GREEN.

Only prepare-intake.cjs/test, CURRENT.md and this handoff change. No manuscripts,
candidate files, inventory, OWNER_APPROVAL or manifest edits. Historical preparation
records remain historical; no new Editor verdict/publication/runtime authority.
No paid calls, credentials, renders, push or independent self-PASS.

## Re-gate targets and commands

Please independently reproduce base acceptance and correction rejection; probe
indentation on first/later pages, mixed case, blank values, next-line prose and
ordinary prose false positives. Verify exact preserved candidate/approval bytes.

```powershell
Set-Location C:/GNart/Work/sh-r3b1b-semantic-m1
$indentBase = 'bfe886db14a1eee2a5b84e42fc4a8cc15e603adf'
$indentHead = git log --diff-filter=A --format=%H -- story-pipeline/06_editorial_refresh/2026-09-16/INTAKE_INDENT_REGATE.md | Select-Object -First 1
if ((git rev-parse "$indentHead^") -ne $indentBase) { throw 'Review range mismatch' }
git status --short --branch
git diff --stat "$indentBase..$indentHead"
git diff --check "$indentBase..$indentHead"
node --test story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.test.cjs
node story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.cjs --check
npx --no-install tsc --noEmit
# Only on explicit Guy push instruction; carries all outstanding history:
# git push origin codex/r3b1b-semantic-recovery-m1
```
