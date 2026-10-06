# Simple story engine: decision gate and design

Date: 2026-10-07. Author and implementer: Claude Code (assigned by Guy for this
task; Codex reviews; Guy gives product acceptance). Branch
`claude/simple-story-engine-20261007`, based on `fe196139` (Codex's
`codex/personal-book-storyboard-bridge`), in the Claude checkout
`C:/GNart/Work/sh-qa-cite-8935beb0`. Local only: no push, deployment, images,
rendering or change to existing evidence.

## 1. Proposed change

Add a second, much simpler personal story engine next to the existing ones,
without changing any default path:

1. **Prepare** through the existing `preparePersonalStory` (same acceptance,
   request identity, companion authority v4, topic, facts and length).
2. **Spine.** Pick one of 14 open story shapes (big day sideways, mix-up,
   strange visitor, there and back, in charge, making together, secret world,
   wrong size, silly contest, something missing, just this once, learning
   something, chase, one more) deterministically from the request ID plus a
   seed. The shape is a spine for the author, not a slot template.
3. **Author** (Opus via the pinned CLI, stage `author`): one short, positive
   instruction that ranks fun, clarity, child as hero and wonder. The interest
   is used lightly and does not have to solve anything. The theme (when chosen)
   is the emotional heart at one to three honest moments, at least one of which
   changes the story, with no cure, lesson or technique. Includes a freshness
   avoid-list for observed attractors and Hebrew read-aloud language rules.
   The output is prose first (title, exactly N pages), then a descriptive page
   map with the existing plan fields.
4. **Editor** (Opus, fresh process, stage `editor`): a short taste brief
   (laughs, clarity, pace, hero, honest theme moment, language, length). It
   also receives the deterministic findings from the draft as plain-language
   notes, keeps the page count, and returns the full story, an updated map and
   its changes.
5. **Checks and compile.** Typographic dash normalisation, counted and
   recorded. Hard checks: page count, map count, dashes, picture directions,
   excluded subjects (the same exact-phrase guard as the current writer),
   child and companion names on at least 2 pages, moment pages, approved fact
   IDs, and one mapped interest (a downstream storyboard requirement). Soft
   checks: words per page and niqqud. The result compiles into the existing
   `personalStoryResultSchema`; the storyboard accepts it unchanged.

No retries, no fallback to the draft, no Astra reader in the loop.

## 2. Why now

Diagnosis from the real inputs (premise six, plan comparison and the trial
books):

- **Proven:** structural convergence across profiles. Interest as the
  mechanism, difficulty as the climax obstacle and a discovered rule or clue
  show up in 12/12 Bar ideas, 4/4 blind outlines, Ido/Bar/Tamar/Neta/Roni.
  Surface attractor: a lost cloud or creature reunited with its family.
- **Engine facts that encode that template:**
  - candidate slots (`discovery`, `childContribution`, `personalFactUses`
    requiring an interest);
  - validators that fail without a load-bearing interest;
  - resilience moments that must change events;
  - craft rules ("establish rule before using it", "clue", "deadline",
    "prepared ability");
  - a 13K-character, negation-heavy plan prompt on two-fact briefs.
- **Hypothesis:** selecting better among template candidates cannot fix a
  generator that only produces template candidates. The Astra rubric (interest,
  causality, agency, reciprocity, consistency) rewards puzzle structure and
  does not measure fun.
- **Literary preference (Claude's, labelled as such):** strong picture books
  are driven by a simple want, comic escalation, refrains and warmth, not rule
  puzzles.

## 3. Scope

This is a general system change (new engine module plus runner). It is not
story-specific: no profile, child, companion or plot is special-cased. Shapes
are generic narrative spines.

## 4. Risk of hardcoding

- Shapes could become a new template. Mitigation: 14 open spines,
  seed-selected, and the author is told to make the shape its own.
- The avoid-list could become a new attractor list. Mitigation: it is short and
  descriptive.

## 5. Files

- `lib/personal-wizard/simple-story-engine.ts` (new);
- `scripts/personal-simple-story.ts` (new, a text-only diagnostic runner; dry
  run by default, `--live` spends);
- `lib/personal-wizard/__tests__/simple-story-engine.spec.ts` (new);
- this document and the Codex QA brief.

No existing file changes.

## 6. Expected behaviour

Given a reviewed request, the engine returns a manuscript in the existing
contract. The book is funny and clear, the child drives the big moment, the
companion is a partner, and an honest theme moment changes the story. Different
seeds give structurally different books for the same child.

## 7. Validation

- Unit tests (30) for:
  - spine determinism and variety;
  - prose-first exact page schema with no candidate or gate slots;
  - instruction size;
  - output caps above measured use;
  - acceptance parity with the current writer;
  - text-only options for all 15 companions;
  - the dash normaliser, including all dash forms;
  - name variants (unpointed, plene, prefixed);
  - hard and soft checks, including assumed parents and pointed sound words;
  - exactly two calls and the editor findings;
  - no third call or fallback;
  - the coded compile failure;
  - storyboard compatibility.
- Live text-only trials with fictional profiles only, read critically by Claude
  and then by Guy. See the closeout for results and cost.

## 8. Cost

Claude CLI calls only (no OpenAI or Astra), list-price estimates reported by
the CLI and not invoices. Round budgets are recorded in the run plans and the
closeout. No images or audio.

## 9. Rollback

The module and runner are additive and unused by any route. Delete them or
leave them unwired.

## 10. Review assignment

- **Guy:** product acceptance of the sample books; whether the engine replaces
  or runs next to the causal pipeline; whether the Astra reader stays out of
  the loop.
- **Codex:** see `PERSONAL_SIMPLE_STORY_ENGINE_CODEX_QA_BRIEF_20261007.md`.

## 11. Do not

No wiring into the wizard or production, no push or deployment, no
images or rendering, no edits to Codex evidence, no paid run beyond the
recorded rounds, no change of the 0.70 threshold or other gates.
