# Decision Gate: one new book from scratch, to test the engine (staged, experimental CLI)

**Date:** 2026-10-12. Builder: Claude Code, branch `claude/book-render-20261009`. Independent QA: Codex. Product, visual and spending owner: Guy.

**Authority:** Guy asked for a brand-new book (a new story, rendered) to test the engine. Codex judged the engine ready for a bounded, staged experimental book. Codex did not judge it ready for unattended production, and no model was trained.

On the Decision Gate, Guy chose (AskUserQuestion):
1. The **experimental CLI path**, not the customer wizard.
2. A **$7 API cap, staged**, effective only after Codex QA of this offline build. Claude Max is reported separately.
3. **Continue automatically** when the 2 sample pages pass the gates.
4. **Claude picks** a new fictional child and a companion other than Dini.

## 1. Change (offline; this commit spends nothing)

**`scripts/personal-new-book-experiment.ts`** is one approved slot, `new-book-20261012`, hard-coded like the old single-book slot. A new book needs a new decision. Every stage is dry unless run with `--execute`, and every stage is single-use. Its stages:
- **`plan`**: provider-free.
- **`text`**:
  - Opus author, then a fresh Opus editor, on Claude Max. They are journaled in `claude-max-stages`, never against the API cap.
  - Two blind Sol readers.
  - Astra storyboard, then a Sol review, under the actor-owned appearance, moments and landmark-kind contracts.
  - The API meter has the one $7 cap.
- **`child`**: the fictional child reference, from its written design, with no photo.
  - Rendered with gpt-image-2 LOW and judged by Sol with the existing reference judge.
  - Exactly one targeted edit, and only for an evidenced defect. An uncertain judgment is held, never redrawn.
  - Prior spend is the verified text ledger.
- **`grant`** (provider-free): the audition grant for the remaining allowance.
  - Prior spend = the verified text + child ledgers.
  - Pages 0–8, with an early sample: the earliest pair of narrative pages in one scene.

**Generalized reviewed-audition loader** (`personal-simple-book-reviewed-audition.ts`):
- An optional `--layout` gives a book's folders, its seed and its written child design. The layout is routing only: every binding (request id, storyboard, frames, child context and review) is recomputed.
- The old book uses `LEGACY_BOOK_LAYOUT`, which holds its constants unchanged. Its loader and dry-run fingerprints are identical before and after this change, with and without its re-plan.
- The saved moments marker is now read from the digest-bound book, like the landmark-kind marker.

**Early sample** in the orchestration (`simple-book-reviewed-audition.ts`), opt-in through the grant's `scope.sample`:
- The sample pages are drawn first, after the sheets.
- The rest are drawn in book order, and only when every sample page is `qa_supported`.
- Otherwise the run ends `held_sample`.
- Absent, nothing changes.

**Design change from the proposal:** the sample is a gate inside ONE audition run. It is not a second run that adopts the first run's sheets. The behaviour is the same (same sheets, automatic continuation per Guy's choice), with less code.

**Small shared refactors, identical text:**
- `simpleChildReferencePrompt`
- `REFERENCE_REPAIR_EDIT_INSTRUCTION`
- the judge budget type `Pick<SimpleBookBudget, 'run'>`
- the exported `auditionAdapters`
- the `identity` render mode for the child anchor

**Story-flow pass-through** of the two opt-in storyboard contracts.

## 2–4. Why now, scope, hardcoding

- **Why now:** the only from-scratch pipeline wrote into a used-up single slot, and the audition loader was hard-wired to the old book.
- **Scope:** general machinery, plus one approved experiment slot.
- **Hardcoding:**
  - No story-, child- or companion-specific logic.
  - The child and companion come from the experiment config: a fictional profile, with no example (fixture) data and no photo.

## 5. Files

**Code:**
- `scripts/personal-new-book-experiment.ts` (new)
- `scripts/personal-simple-book-reviewed-audition.ts`
- `lib/personal-wizard/simple-book-reviewed-audition.ts`
- `lib/personal-wizard/simple-book-flow.ts`
- `lib/personal-wizard/simple-book-illustrations.ts`
- `scripts/personal-simple-book-illustrator.ts`

**Tests:**
- `lib/personal-wizard/__tests__/new-book-experiment.spec.ts` (new)
- `lib/personal-wizard/__tests__/simple-book-reviewed-audition.spec.ts`

## 6. Expected behaviour

Each stage stops at its own gate:
- story held;
- storyboard held;
- child reference held;
- sample page held;
- unknown cost or outcome;
- two consecutive failed calls;
- the call limit;
- the cap.

Every attempt, receipt and failure is kept. Nothing is retried. Nothing is accepted for the product: `qa_supported` is a label, and Guy judges the book.

## 7. Validation

**Offline rehearsal** (synthetic providers at the transport boundary; no key, no network): the real CLI path with the real contracts runs text, then child, then grant, then the real reviewed-audition runner on the new book. It covers:
- the supported sample continuing to all nine frames;
- a held sample stopping after its 2 pages;
- refusals: single use, source and executable changes, fences, the ledger, the layout, a wrong-model reply, an unchanged repair edit, a held child.

**Also:**
- tsc;
- focused suites;
- an in-memory mutant matrix;
- legacy fingerprints identical.

## 8. Cost

None in this change. The paid run is under Guy's $7 API cap: expected about $3.5–4, worst case about $6.4 within the cap. Claude Max is reported separately.

## 9. Rollback

Every new path is opt-in: the experiment script, `--layout`, and the grant's `scope.sample`. Revert the commit.

## 10. Review

**Codex QA of this build before any paid stage.** Guy's eye is the final judge of the book.

Open product points:
- the story itself;
- whether the moments contract becomes the default for new storyboards (decided for this experiment only).

## 11. Do not

- No wizard integration.
- No production, push, merge or deploy.
- No threshold, policy or canon change.
- No retries.
- No manual image or story fixes.
- No force-accepting a held reference.
- No spending beyond the $7 API cap.
- No second book.
