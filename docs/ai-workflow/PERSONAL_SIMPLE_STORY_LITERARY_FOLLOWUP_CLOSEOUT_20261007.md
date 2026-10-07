# Simple story engine — literary follow-up closeout (2026-10-07)

Status: local prompt milestone committed, awaiting Codex independent QA. **No literary improvement is claimed:** no new books were
produced. Integration (wizard or production) stays blocked separately. The technical base `ebd6cb03..0a845285` is still pending
Codex PASS.

- Worktree `C:/Users/guyna/.codex/worktrees/simple-story-literary-followup/Small_Heroes`, branch `codex/claude-simple-story-literary-20261007`, not pushed.
- Review ranges, to be QA'd separately: technical `ebd6cb03..0a845285` (unchanged here), literary `0a845285..HEAD`, where HEAD
  is the docs-only closeout commit on top of the prompt commit `15fa48e6`. No PASS has been awarded for either.
- Gate and diagnosis: `PERSONAL_SIMPLE_STORY_LITERARY_FOLLOWUP_DECISION_20261007.md`.

## Plan against execution

| Planned | Done |
|---|---|
| Varied agency, no "saw what nobody saw" requirement, companion does not take the child's part | Author item 3 and editor "The hero"; the clue-spotting line is removed from the comic list |
| Resilience inside the adventure; no invented fear when there is no theme; not every scene a test | Author theme and no-theme paragraphs; editor theme bullet; `resilienceMoments`/`whatHelps` descriptions only |
| Age fits voice, humour, complexity and situations; reaction is fine, invented biography is not | Author item 2 and facts paragraph; new editor "The child's facts" bullet |
| Editing keeps meaning: causality, time/place, consistency, closing threads that matter | Editor "Clarity" bullet; editor keeps the author's voice and best jokes |
| Endings and the running gag less fixed | "with a twist at the end" becomes "with a twist"; the ending may echo or close on something new |
| Fewer stock body similes, without a word ban | Feelings mostly through action and speech; comparisons only when fresh and story-specific (both prompts) |

## Rejected or deferred (reasons in the gate)

- No banned-word list and no mechanical detector.
- No contract migration: min(1) moments stays.
- No engine version bump, so shapes stay comparable.
- No third call, memory, Astra or QA layer.
- No edits to saved books.

## Files

- `lib/personal-wizard/simple-story-engine.ts`: prompt text and two field descriptions. No logic change.
- `lib/personal-wizard/__tests__/simple-story-engine.spec.ts`: one contract test. It checks that the old phrases are gone, the new
  freedoms are present, and the moments minItems is still 1.
- `docs/ai-workflow/PERSONAL_SIMPLE_STORY_LITERARY_FOLLOWUP_{DECISION,CLOSEOUT}_20261007.md`, `CURRENT.md`, `ROADMAP.md`.

Prompt lengths: author 5,322 → 6,094 chars (test bound 7,000); editor 2,465 → 3,186 (bound 4,000). Both grew: freedoms needed
words. The added text is mostly permissions and distinctions, not new quotas.

## Tests (no provider calls)

Measured by Codex on the host at `15fa48e6`, with only `CURRENT.md` and `ROADMAP.md` dirty; both hashes were unchanged across
every run. Receipts and logs are in the Codex evidence root (`claude-literary-host-{tsc,focused,full}-20261007-exit.json` and the
matching `.log` files).

- `npx tsc --noEmit`: exit 0.
- Focused command: 51/51 passed across 2 files (simple-story-engine 44, including the new contract test; vitest workload
  classifier 7). Exit 0.
- `npm run check`: exit 1. **Gate RED.**
  - Ordinary lane: 6,531 passed / 10 failed / 73 skipped; files 6 failed / 376 passed / 17 skipped (399). All ten failure names
    match the 2026-10-06 baseline (`premise-six-correction-full-check-20261006.log`) exactly. That baseline had 6,487 passed in
    398 files.
  - Resource lane: 635/635 tests in 20 files pass, but the lane exits 1 with **three** unhandled `onTaskUpdate` RPC timeout
    errors. The baseline had two. The count went up; nothing here shows why. The stack frames resolve vitest from
    `GNart/Work/sh-order-package-authority/node_modules`, not from this worktree.
  - No reliability waiver, and no claim that the failures are caused by load.
- My own earlier check attempts did not produce evidence: task `br7dfeph7` never started (missing `tmp`) and `btfnqrsx4` was
  killed. They are superseded by the host run above.
- Passing tests do not mean every runner assertion from the base was independently attacked. That is part of the pending QA.

## Proposed comparison (not run; a paid run needs a separate decision and pricing)

- **Arms:** base prompts `0a845285` against follow-up prompts `HEAD`. Same engine version and seeds, so the same shapes; same
  briefs, lengths, model and caps.
- **Cases:** at least 4 briefs across at least 3 profiles:
  - one no-theme book at age 4 (the Tom/Momo brief);
  - a theme book at age 8 (the Itai/Leo confidence brief);
  - a no-theme book at age 6 or 7 with a different companion;
  - one fear theme with a real-world safety side.
  - Use 2 seeds per case when budget allows.
- **Read separately:** the draft and the edit. Assess each on its own, then the edit's added value: what it improved and what it
  flattened.
- **Look at:**
  - how the child influences the plot, and whether the forms differ across books;
  - who drives the climax;
  - the ending type (echo or new image);
  - any invented fear in no-theme books;
  - any invented biography;
  - how many scenes are a theme test;
  - opened threads left unclosed;
  - stock body similes;
  - companion personality, which must not get flatter;
  - laughs.
- **Non-regression:** fun, clarity and companion voice should be no worse. The safety-theme book must still keep the safe
  behaviour.
- The reader should be blind to the arm. This is a small sample, so it is not proof of a product quality bar.

## Limitations

- Prompt tests prove the wording contract only. The diagnosis is code-based; the cause is not proven.
- A no-theme book may lose stakes. The "don't take the child's part" line may make companions passive.
- Visual notes for the storyboard stage, not acted on:
  - Leo is written four-legged, against the earlier bipedal direction.
  - Momo carries Tom while scale is unapproved.

## Evidence preservation

The original evidence root, the saved Momo/Itai drafts and edits, and the branch `claude/simple-story-engine-20261007` were only
read. Nothing there was written. The prior docs in this worktree were not edited, apart from appending to CURRENT/ROADMAP.

## Falsification targets for Codex

1. Some old convergent phrase still survives in either prompt, or a new phrase re-creates a fixed template (for example a mandated
   ending type or a mandated agency type).
2. The no-theme guidance plus min(1) moments is contradictory enough to force invented hesitation anyway.
3. The biography rule wrongly blocks theme-grounded lines. Itai's page 1 is grounded in the parent fact and must stay allowed.
4. The editor's thread-closure rule invites closing every small prop.
5. A logic, schema-shape, checker, runner or version change slipped into `0a845285..HEAD`.
6. The base tests weakened, or a new `npm run check` failure was blamed on load without evidence.
7. The third `onTaskUpdate` timeout (two in the baseline) is caused by something in either range, not by the host.
8. The docs closeout commit touches anything other than `CURRENT.md`, `ROADMAP.md` and this file.
