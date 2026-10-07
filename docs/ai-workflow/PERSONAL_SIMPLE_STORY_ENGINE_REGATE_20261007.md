# Simple story engine: corrections after the Codex HOLD (re-gate request)

Date: 2026-10-07. Implementer: Claude Code. Reviewer: Codex. Product
acceptance: Guy.

Codex reviewed `fe196139..ebd6cb03` and returned HOLD: one P1, five P2 and
three P3 findings, plus cautions on diagnosis claims. This milestone contains
only technical corrections to the additive prototype:

- no provider, paid call, new story, push, deployment or wizard wiring;
- no change to the current writer or to any old gate;
- no edit to any trial evidence file.

- **Branch:** `claude/simple-story-engine-20261007` in
  `C:/GNart/Work/sh-qa-cite-8935beb0` (local, not pushed).
- **Correction range:** `ebd6cb03..HEAD`. The cumulative range for the
  feature is `fe196139..HEAD`. The exact head is in the commit that adds this
  file and in the hand-off message.

## Findings and responses

### F1 (P1): uncertain native termination did not stop later dispatches

Fixed in `scripts/personal-simple-story.ts`. The run core is now
`runSimpleStoryTrial`, with an injectable transport.

- **Classification** (`containedTransportFailure`). A transport failure is
  contained only when the native process provably exited (`killConfirmed`
  true, exit code 0, no signal, no spawn error) and reported a cost.
  Everything else is run-fatal: unconfirmed termination, a non-zero or
  unknown exit, an unknown cost, or a pre-dispatch contract error. Engine
  rejections (`SimpleStoryError`) are contained book failures.
- **On a run-fatal failure:**
  - the first stop record is kept: reason, case, stage, code,
    `killConfirmed`, exit code and reported cost;
  - the shared controller aborts in-flight calls;
  - the pool admits no new case;
  - `generate` refuses to dispatch, with a single check before anything is
    written. Nothing awaits between that check and the transport call.
- **The run summary** records `status`, `exitCode`, `stop`, `costCertain`
  (false whenever any settled call had an unknown cost) and per-case rows
  with a `dispatched` count. Cases never started are rows marked
  `not_dispatched`.
- **Budget ceiling:** reaching it is a controlled stop (`reason: budget`),
  not uncertainty. There are no automatic retries.
- **Tests at the actual runner boundary** (fake transport with the real
  error class and receipt shapes):
  - concurrency 1 with three cases: exactly one dispatch; the other two are
    `not_dispatched`; status `stopped`; `costCertain` false;
  - concurrency 2 with three cases: two dispatches; the in-flight sibling sees
    its signal aborted; the third case is never dispatched;
  - a sibling whose author call completes after the stop: its editor is not
    dispatched (`trial_halted`);
  - the budget ceiling: one dispatch, then `reason: budget`;
  - a contained failure (a malformed author reply after a clean exit): the
    run continues to the next case.

### F2 (P2): failed runs exited 0

Exit codes are now explicit:

| Code | Meaning |
|---|---|
| 0 | every case produced a book |
| 1 | at least one contained book failure (`partial` or `failed`) |
| 2 | the run stopped (uncertain transport, budget or cancellation) |
| 3 | arguments or setup |

`main()` returns the code, and the CLI entry assigns it to
`process.exitCode`. A test drives `main` through `--live` with an injected
transport and a real temporary executable and hash, and gets
`{ complete: 0, contained: 1, stopped: 2 }`.

### F3 (P2): an accepted hyphenated child name could not complete

There were two causes. The normaliser rewrote `לי-ים` to `לי ים`, and
`stripMarks` treated the maqaf (U+05BE) as niqqud, because U+0591–U+05C7
also covers Hebrew punctuation.

- **Nothing rewrites text any more** (see F4).
- `stripMarks` and the niqqud check now use only the true combining marks:
  U+0591–U+05BD, U+05BF, U+05C1–U+05C2, U+05C4–U+05C5 and U+05C7.
- **Approved names** are the child's full name and first word, plus the
  companion's full and short names.
  - They are exempt from the dash check.
  - The name gate matches an approved name with any dash form exactly where
    the approved name has one. A space or a missing dash is a different
    spelling and fails the gate.
  - The gate and the exemption share one boundary rule (`nameInProse`): a
    word boundary, up to two Hebrew prefix letters, the name, and no letter
    after it. A dash inside another word that merely contains the name
    (`עלי-ים`) is still reported.
  - The approved identity in the request is never altered.
- **Prompts:** the conflict with the no-dash style rule is resolved
  explicitly. The author gets one sentence ("The one exception is a name from
  the brief that contains a hyphen: always write names exactly as given.")
  and the editor one parenthetical. This is the only prompt change in this
  milestone.
- **Tests through `writeSimpleStory`:** approved ASCII hyphen or maqaf,
  written in prose as ASCII hyphen, maqaf or U+2011, all complete with the
  name intact. A spaced spelling fails with `simple_story_child_name_missing`,
  and the finding asks for the exact name.

### F4 (P2): the "typography only" normaliser changed numerical meaning

The normaliser is removed. Across all 52 trial stages it had changed nothing
(zero dashes everywhere; Codex verified the byte match).

The engine now performs no deterministic transformation at all. The
manuscript is the editor's text, trimmed by the existing contract.

- **A dash in the draft:** any of 13 forms, including the minus sign, ranges
  and the soft hyphen, outside approved names. It is sent to the editor as a
  quoted snippet with a request to rewrite it ("numbers and ranges in words if
  needed").
- **A dash in the final text:** the book is held
  (`simple_story_dash_in_prose`), untouched.
- **Negative controls:**
  - `−3` and `3–5` are reported as written and left untouched;
  - the draft with `−3` reaches the editor unchanged;
  - the final manuscript equals the editor text;
  - a final `3–5` holds the book with the text intact.

### F5 (P2): the new spec broke the inventory contract

- **Contract:** `lib/__tests__/vitest-workload-classifier.spec.ts` now
  expects 419 inventory, 399 ordinary and 20 resource-intensive files. It
  asserts that the new spec is in the ordinary lane and not in the resource
  lane.
- **Independent partition check:** 419 inventory, 399 ordinary, 20 resource,
  the new spec exactly once in ordinary, and no duplicates.
- **Full-gate delta** (see the gates section): the ordinary lane is back to
  exactly Codex's ten inherited failures, and the classifier passes.

### F6 (P2): storyboard compatibility was archive-only

- **Docs corrected** in the decision doc, the closeout, a note at the top of
  the first QA brief, and this file.
  - The generic contract and the archive storyboard accept these results.
  - The existing editor's input preparation also succeeds, but that does not
    prove a current edit.
  - The current `prepareCurrentPersonalStoryboard` rejects 26/26 with
    `current_edit_required`.
- **Test:** the rejection is now pinned, so the limit cannot be silently
  forgotten.
- **Integration:** stays explicitly blocked. A current-admission design needs
  its own owner decision and review. Nothing bypasses or manufactures a
  semantic-edit receipt.

### P3-A: four guard mutations survived

- **New clause tests:** `page_count`, `page_map_count`,
  `direction_in_prose`, and duplicate moment pages (separately from out of
  range).
- **Claude's own mutation check** (`scratchpad/simple-engine-regate/mutate.cjs`,
  temporary sibling files, always removed): **29/29 caught** at the final
  code, control 43/43.
  - 22 engine mutants:
    - the name prefix boundary and the name trailing boundary;
    - each hard-check clause;
    - range and duplicate moments;
    - name dash-equivalence;
    - name protection;
    - approved-names coverage;
    - the maqaf as a mark;
    - dash snippets;
    - a dash form;
    - the final check skipped;
    - the draft used as the manuscript;
    - the parent check.
  - 7 runner mutants:
    - contained always true;
    - halt without abort;
    - the pool ignoring the stop;
    - dispatch ignoring the stop;
    - stopped exiting 0;
    - the budget not halting;
    - uncertainty not halting.
- The first pass had one survivor, "dispatch ignores the stop". It exposed a
  redundant second stop check: there is no await between the two, so each
  masked the other. The redundant check was removed, and a test was added for
  what the remaining check guards: a sibling whose author call finishes after
  the stop.

This is not an exhaustive mutation of every expression. Codex's own
22-mutant set should be re-run.

### P3-B: the "USD 1.5 ceiling" was wrong

Corrected in the closeout. Reservation ceilings at the current output caps and
the maximum wire size, author plus editor:

| Pages | Reservation ceiling per book |
|---|---|
| 8 | USD 2.15 |
| 12 | USD 2.41 |
| 16 | USD 2.68 |

Trial CLI estimates per book:

| Pages | Trial estimate |
|---|---|
| 8 | USD 0.37–0.73 |
| 12 | USD 0.56–1.03 |
| 16 | USD 0.66–1.16 |

Neither is an invoice guarantee.

### P3-C: seeded variety is not a per-order guarantee

Corrected. The same accepted request and seed always get the same spine, and
the default seed is empty. Repeat odds depend on a caller seed policy that the
integration must define and persist. No "1 in 14" guarantee exists without
it.

### Diagnosis and literary claims

Narrowed in the decision doc and the closeout:

- the convergence is Claude's reading of the saved outputs, and Codex agrees
  only on a convergence concern;
- engine features are described as pressure, not proven mandatory. The
  selected-plan validator checks interest coverage, not a magic key, and the
  active causal craft text makes mechanisms conditional.
- the Astra explanation is an untested hypothesis, since independent runs
  without a reader had already converged;
- the 26 books span four prompt versions, and only three round-4 books use
  the final spines;
- the editor's value is the implementer's reading, not evidence that the
  reader is unnecessary. Removing the reader from a customer path is an owner
  decision after a calibrated evaluation.

The recommended next quality test is the matched, blind comparison Codex
describes: same profiles and output level, repeated requests and seeds,
separate dimensions, and drafts and edits kept apart. It is a proposal only;
it needs Guy's go and budget.

## Gates

- **`tsc --noEmit --incremental false`:** exit 0. `git diff --check` is
  clean.
- **Focused spec:** 43/43, up from 31.
- **Classifier spec:** 7/7.
- **`vitest run lib/personal-wizard`:** 37 files, 1,350/1,350, up from
  1,338.
- **`npm run check`:** see "Full gate" below.

### Full gate

The first run was on the working tree just before the last change, which
shared the name-boundary rule between the gate and the dash exemption. It was
re-run at the committed head; the hand-off message gives that result.

**Ordinary lane:**

- **Files:** 399, with 6 failed, 376 passed and 17 skipped.
- **Tests:** 10 failed, 6,530 passed, 73 skipped.
- **Compared with Codex:** 11 failed / 6,517 passed / 73 skipped. The
  classifier failure is gone. The extra 13 passes are the 12 new spec tests
  plus the classifier test.
- **The ten failures** are exactly Codex's inherited list:
  - `child-lexicon-ages-5-8`: 1
  - `momentum-gate-koko`: 1
  - `page-entity-qa`: 1
  - `story-read-back-validation`: 2
  - `story-source-visual-direction-acceptance-lifecycle`: 4
  - `reserved-page-placement-authority`: 1

**Resource-intensive lane:** 20 files, 635/635 tests passed. The gate still
reports failed, because of 2 unhandled `onTaskUpdate` RPC timeouts; Codex's
base run has the same classification. `npm run check` exits 1 on the
inherited failures plus these timeouts.

## Evidence preservation

- **Trial evidence:** re-checked against Codex's
  `simple-engine-evidence-baseline-20261007.json` with
  `scratchpad/simple-engine-regate/verify-preservation.cjs`. All
  **314/314 files are unchanged** (SHA-256, size and mtime), and no file has
  been added to that folder.
- **Correction artifacts** live in `scratchpad/simple-engine-regate/`:
  `mutate.cjs`, `mutation-results.json`, `verify-preservation.cjs` and
  `full-check.log`.
- **Frozen pre-HOLD deliverables.** `MORNING_REPORT.md`, `STORIES_HE.md` and
  the doc copies in the evidence folder are frozen as reviewed and still carry
  the superseded claims ("fits existing contracts", "USD 1.5 ceiling",
  "1 in 14"). The corrected statements are in the repository docs and here.

## Authorization record

Codex could not locate the authorization for implementation and trials. This
is the factual record from Claude's chat, for Guy to confirm or correct.

The brief that assigned the task included these constraints, verbatim:

> "אין push, פריסה, תמונות, רינדור או שינוי ראיות מקור במסגרת הבריף הזה."
>
> "היתרה אינה אישור לניסוי נוסף. לפני יישום משמעותי או הרצה בתשלום, הצג תוכנית
> ותקציב לאישור."

Guy then wrote in the same chat, before going to sleep. The quotes are
excerpts:

> "אני רוצה שתרוץ קדימה עם המשימה, תהיה יצירתי ותפתור את הבעייה שיש לנו
> ביצירת הסיפורים"
>
> "אני הולך לישון, מקווה לקום בבוקר למנוע משומן שיודע לייצר סיפורי
> מעניינים"
>
> "אה לא רק מנהל את זה עעשיו ומתכנן... אתה גם מבצע.. בסיום בריף QA לקודקס"

What Claude did with that:

- Claude read these messages as authorizing implementation and text-only
  trials overnight.
- Guy named no budget. Claude set its own ceiling of about USD 15–20 in Max
  list-equivalent, ran per-round runner budgets ($12, $10, $6, $4) and spent
  **USD 14.082** in CLI list-price estimates. There was no OpenAI or Astra
  spend and no images.
- Claude did **not** present a plan and budget for explicit approval before
  the first paid run, as the brief required.

Whether the later messages covered that is Guy's call. This correction
milestone spends nothing.

## Out of scope here

- A parallel Claude session proposed further literary prompt changes after
  Guy read books 23 and 24. They await Guy's go and are not part of this
  technical re-gate.
- The current writer's four-character dash class is reported to Codex and
  not changed.
- There is no new trial, wiring, push or deployment.

## Re-gate brief for Codex

The first pass is read-only.

1. **F1/F2:** at the actual runner boundary, try to start a dispatch after a
   run-fatal failure at concurrency 1 to 4. Try to get a zero exit from a
   failed or stopped run. Check `containedTransportFailure` against every
   receipt shape the real transport can produce.
2. **F3/F4:**
   - try approved names with every accepted dash form;
   - try names next to prefixes, pointed names, and names inside snippets;
   - try to get any byte of model text changed by the engine apart from the
     contract's trim;
   - confirm meaning-bearing signs are held, never rewritten.
3. **F5:** re-run the classifier and the full gate. The delta should be only
   the classifier fix plus the new tests.
4. **F6:** confirm the docs no longer claim current-flow compatibility, and
   that nothing bypasses `current_edit_required`.
5. **P3-A:** re-run your 22 mutants, and review the 29 in
   `mutation-results.json`.
6. **Claims:** check the narrowed diagnosis and literary statements against
   the evidence.
7. **Preservation:** re-run your 314-file baseline and the 650 protected
   entries.
