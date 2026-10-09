# Decision: illustrations that tell the page (storyboard instant + audition v2)

Date: 2026-10-09. Builder: Claude Code, branch `claude/book-render-20261009`. Independent QA: Codex. Product acceptance: Guy.
Authority: Guy's execution brief (`CLAUDE-ILLUSTRATION-ENGINE-EXECUTION-BRIEF-20261009.txt`). It authorizes implementation and local tests only, with no new paid calls.

## 1. Change

**Storyboard: opt-in "moments" contract** (`storyboard-moments.ts`, wired into `storyboard.ts`, `book-openai.ts` and `simple-storyboard-diagnostic.ts`).
- Each frame may declare the instant it draws (`depicted`), separate from the end-of-page continuity ledger.
- Each frame may carry up to six source-quoted show/avoid requirements.
- Every override and every requirement must quote its own page.
- A new storyboard under this contract gets its own review (an addendum). An old approval never covers it.
- Without the flag, every existing schema, instruction, digest and packet is byte-identical.

**Audition v2** (`simple-book-reviewed-audition.ts` and the runner):
- **Deferrals are explicit and source-linked.** A requirement leaves a sheet only through an actor attachment, the child's clothing authority, or a quoted later state. Nothing is removed by text matching, and deferred items stay binding on their pages.
- **Location sheets show fixed geography only.** No book premise, and no object sheet as a reference.
- **Flawed references are labelled.** A sheet with findings is a `diagnostic_candidate` with known flaws. The written design wins over it. Repairs edit the chosen sheet instead of redrawing everything.
- **Findings carry impact and cite a requirement.** Impact is safety, story, identity, continuity or detail. A finding that cites no known requirement counts as detail.
- **Selection order:** story, then identity (including the child's 0.70 measurement), then continuity, then detail. Ties go to the earliest attempt. Safety defect or uncertain is never eligible.
- **Status:** `qa_supported` only without critical findings and with a measured child identity of at least 0.70. Everything else is `held`. Neither status is product or production approval.
- **Page checks derived from the storyboard:**
  - story objects not yet revealed;
  - unique landmarks, with instance counts and world placement;
  - per-character identity against each character's own reference.
- **Meter:**
  - the prior ledger is an explicit input to a cumulative cap;
  - an unknown cost or unknown outcome stops paid calls;
  - two consecutive failures stop the run.
  - A spend grant is required for any paid run.
- **New modes:** page subsets, and re-judging saved images (no render).

## 2. Why now

The first full audition (`goni-shadows-20261009`) showed pictures that are consistent but lose the page's event. Evidence:
- **The ledger forces end-of-page instants.** Pages 3, 6, 7 and 8 drew the aftermath of a joke, a failure, a construction and a return. The sequence states are end-of-page, so any earlier instant failed the state check.
- **Story content leaked into the location reference.** The location sheet received the premise and the object sheet, and drew the drag trail. That trail then leaked into the cover and page 1.
- **A reference flaw was copied everywhere.** The flawed bench reached every page.
- **Selection ignored meaning.** Equal weighting of story and detail, plus a "newest" tie-break, discarded better attempts on pages 1 and 5.
- **The checker missed two findings:** a duplicated rock (page 4) and a nose transferred between characters (page 7).

## 3. Scope

General system change. No story text, canon, the 0.70 threshold or safety rule changed. No Goni-specific branch.

## 4. Hardcoding risk

The rules use structured data only: ledger states, entity kinds, attachments, mutable attributes and quotes.

Checked offline:
- the Goni book;
- a second saved book (Leo, 2026-09-28) with no magic object or absence;
- the in-repo ribbon/hut fixture.

## 5. Files

**New:**
- `lib/personal-wizard/storyboard-moments.ts`
- its spec

**Changed:**
- `storyboard.ts`
- `book-openai.ts`
- `book-runner.ts` (a type only)
- `simple-storyboard-diagnostic.ts`
- `simple-book-reviewed-audition.ts`
- `scripts/personal-simple-book-reviewed-audition.ts`
- the audition spec

## 6. Expected behaviour

- **Storyboard:** a picture may show the joke, the failure or the reveal of its page, while later pages still continue from the end-of-page state.
- **Selection:** a page whose meaning is broken is held, even when the face matches.
- **Location sheets:** contain no clues.
- **Flawed references:** labelled, with the written design winning.
- **Spending:** cumulative, and fails closed.

## 7. Validation

Done locally:
- tsc;
- focused specs;
- an in-memory mutant matrix;
- zero-provider probes on saved books.

Visual improvement is NOT claimed. That needs the priced sample proposed in the handoff.

## 8. Cost

None in this change. Any paid sample needs Guy's spend grant, with the inherited ledger stated.

## 9. Rollback

The moments contract is opt-in (omit the flag). The audition is a separate diagnostic script; revert the commit.

## 10. Review

**Codex:** independent QA of the commit range and of the saved full-book evidence.

**Guy decides:**
- whether to fund the priced sample;
- whether to adopt the moments contract for new storyboards.

## 11. Do not

- No push, merge or deploy.
- No production wiring.
- No canon or threshold changes.
- No safety bypass.
- No full re-render.
- No paid call without a grant.
