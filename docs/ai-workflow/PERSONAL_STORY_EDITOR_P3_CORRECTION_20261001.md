# Claude Code — small literary-editor corrective re-gate

## Received verdict / exact authority

Your review gave technical PASS, P0/P1/P2=0, four P3 notes, for
`2da203c2..5f3ba39c`. Separate availability PASS: `30961ca5..2da203c2`.
Markdown successor `8695d196` was consistent. None of these is creative/product
acceptance, a whole-branch PASS or release authority. Earlier bridge remains open.

Received source:
`C:/Users/guyna/AppData/Local/Temp/claude/C--GNart-Work-Small-Heroes/af9211ff-30ea-426d-9794-43cad9ee3788/scratchpad/qa-editor/CLAUDE-QA-EDITOR-5f3ba39c.md`
SHA256 `b5f1ea2010538a3d41ff59d039659945fda572856d5a0759551d1e6ad5026b8f`.
I read it and the pasted transcript. The source report itself is untouched.

## Approved scope / topology / diagnosis

Continuation of Guy's approved engine improvement and the required validate/fix/
re-gate protocol. Sole Codex writer in the existing execution worktree:
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`, branch
`codex/personal-book-storyboard-bridge`, local/no upstream. Base `8695d196`.
This handoff is committed in the corrective milestone; freeze its enclosing commit
and review `8695d196..that commit` (provided in the accompanying message).

Pre-edit and pre-handoff topology: protected d53b `768ccb2f`, accepted-intent-wave-2
`63ccb484`, Claude site `86ca47e8` (ahead 2) remained clean. Your detached reviewer
worktree is now `2da203c2`, matching your disclosed separate availability review,
NOT the new review endpoint. Reconcile that before a new verdict. No other writer.

Observed defects: unsafe exception-field access skipped ledger failure recording;
plain editor exceptions lost preflight identity at the outer runner boundary.
Missing tests left working safeguards unpinned. Expected: bounded diagnosis,
failed/unknown accounting, immutable old evidence and tests at actual call paths.
No prompt/model/cap, production flow, release or rendering decision is changed.

Rejected: rewriting historical failures, increasing input limits to hide the
problem, breaking legacy offline compatibility, and treating receipt hashes as
proof against an actor who rewrites an entire result. Rollback: revert this one
focused commit, no DB migration or evidence-root change.

## Correction claims and files

- `scripts/personal-story-editor-trial.ts`: guard access to exception providerUsage,
  so a throwing getter cannot skip failed/unknown persistence. Unknown cost stays
  unknown. No replay, alternate root, refund or extra call was added.
- `lib/personal-wizard/story-editor.ts`: internally typed `StoryEditorError`, with
  old message codes preserved. No input/output/creative validation was weakened.
- `lib/personal-wizard/book-runner.ts`: prepare-stage typed input/source failure
  becomes `book_editor_input_limit` / `book_editor_source_binding`. Other prepare
  failures become fixed `book_editor_invalid`, never a private message. Existing
  partial/lock/accounting handling stays responsible; no editor dispatch occurred.
  Failure telemetry names editor preflight rather than the completed manuscript.
- Three existing specs: real oversized combined outline+manuscript after TWO
  writer calls; typed/unknown faults; unsafe exception accessors through main()
  and mocked SDK; claimed-root refusal; identical prose with different editing
  receipt changes source identity; malicious sixth subordinate dispatch is stopped
  before the sixth provider method invocation.
- P3-3 documented, NOT falsely fixed: stripping editing and rewriting accounting
  passes the compatible legacy offline parser. Committed test makes the limit
  visible, shows runtimeEligible=false and rejection by the edited-result schema.
  Authenticating persisted provenance would be separate scoped work, not a patch
  to a backwards-compatible parser.

No new test file, dependency, inventory count, reader/UI, public route activation,
story source, key, accepted prose, rendering/narration or money allowance changed.

## Tests / deliberate falsification / limits

Final focused suite: 14 files, **372/372**, native 0. Same exact file selection as
the original handoff. Changed counts: editor 39 (was 37), trial 15 (was 10), runner
87 (was 82). All other 11 files/counts unchanged. `npx tsc --noEmit` native 0;
`git diff --check` clean.

Five deliberate negative-control edits:

1. Remove editing from storyboard fingerprint.
2. Remove claimed-root refusal.
3. Restore unguarded providerUsage read.
4. Loosen invocation ceiling from 5 to 6.

One combined narrow test run caught those four as FOUR failing tests, native 1.
Then a fifth control removed the new preflight classification; its four selected
tests failed (including real oversized input), native 1. All source mutations were
restored before final validation; storyboard source is byte-identical to base.
These are local test controls, not a repeated independent 16-mutation audit.

Initial tsc caught an incorrect test-only type inference when relabelling edited
accounting as legacy; corrected by constructing a separate legacy-shaped object.
It also caught Array.at beyond this repo's target; use of ordinary array indexing
fixed the test without changing tsconfig. No production schema was loosened.

No new full `npm run check` run in this small corrective milestone: the focused
suite covers the changed paths, and the independently measured predecessor gate
stays explicitly RED. Your measured run at `5f3ba39c`: ordinary 10 failed / 5343
passed / 73 skipped, resource 635/635 with RPC errors. The three earlier resource
timeouts not reproducing is consistent with load sensitivity but does NOT establish
the causal diagnosis. No stability or release closure is requested here.

Six paid-trial artifacts were independently rehashed 6/6 against the original
handoff table, unchanged. $0 new provider spend, no real key read, image, narration,
server reset, push or deployment. Historical seven invocations / known estimate
$0.280328 / unknown failed long-plan usage are unchanged. Final writer instructions
still have no new paid creative evidence. Local ignored logs/artifacts have no
verified off-machine backup.

## Falsification targets

Read-only first pass, mock providers only; no key, paid trial, evidence overwrite,
cleanup, retry, threshold change or push.

- Throw on providerUsage and other exception accessors through trial main(). Does
  the persisted row become failed/unknown without an extra call or raw sentinel?
- Produce a valid but verbose outline and manuscript through the two REAL writer
  stages. Does edit preflight classify input limit with exactly two attempts,
  original partial text, no editor/visual call, and released lock? Inject an
  unknown private exception and ensure only fixed classification escapes.
- Reproduce M6/M16/M3 against the committed tests. Ensure no changes to the actual
  five-call ceiling, source receipt hash or one-shot root mechanism slipped in.
- Check that the legacy trust limitation is precisely worded and has no false
  tamper-proof, render-eligibility, quality or acceptance claim.
- Reconcile the received two PASS ranges; do not extend either to this successor
  until your own re-gate. Confirm the six historical artifact hashes are unchanged.

## PowerShell handoff (already committed; no push requested)

```powershell
$taskRepo = 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git -C $taskRepo status --short --branch
git -C $taskRepo branch -vv --list codex/personal-book-storyboard-bridge
git -C $taskRepo log --oneline 8695d196..HEAD
git -C $taskRepo diff --check 8695d196..HEAD
git -C $taskRepo show --stat HEAD
# Publishing the whole branch needs Guy's explicit instruction:
# git -C $taskRepo push -u origin codex/personal-book-storyboard-bridge
```

After this bounded corrective review the substantive next dependency is creative
measurement of the final writer, not more bookkeeping or illustrations. Technical
PASS does not turn the current stories into a sellable product.
