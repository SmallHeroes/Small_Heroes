# Codex QA brief: simple story engine

Date: 2026-10-07. Implementer: Claude Code (Guy assigned diagnosis, planning
and execution of the story-engine fix). Reviewer: Codex. Product acceptance:
Guy.

- **Range:** `fe196139..` the HEAD of local branch
  `claude/simple-story-engine-20261007` in `C:/GNart/Work/sh-qa-cite-8935beb0`.
  Not pushed.
- **First pass is read-only.** No provider, key, paid call, render, push,
  deployment, or edit of the implementation or evidence.

## What changed

- **New** `lib/personal-wizard/simple-story-engine.ts`:
  - 14 seed-picked story spines;
  - one short author prompt and one short editor prompt;
  - a prose-first exact-page schema;
  - deterministic hygiene checks and the dash normaliser;
  - editor findings;
  - compile into `personalStoryResultSchema`;
  - `writeSimpleStory`, which makes exactly two calls with no retry or fallback.
- **New** `scripts/personal-simple-story.ts`, a text-only runner:
  - dry run by default; `--live` spends;
  - reuses `prepareCausalWire` and `createOpusCausalTransport` with the
    pinned CLI;
  - run budget ceiling, per-call CLI cap, fictional-only cases;
  - all 15 canon companions only through the explicit synthetic
    `textCanonOptions`.
- **New** `lib/personal-wizard/__tests__/simple-story-engine.spec.ts`
  (30 tests). The full `lib/personal-wizard` folder is green at the closeout
  commit: 37 files, 1,337 tests (1,335 at `7c71ff71`). `tsc` is clean.
  `npm run check` was not run here; it was already red before this change.
- **Commits:**
  - `7c71ff71`: engine, runner, tests, decision and brief;
  - `1aa67f42`: output headroom from measured usage, plus a coded compile
    failure;
  - the closeout commit: dash-class widening, closeout and doc updates.
- **New** docs: the decision gate, this brief, and the closeout with the trial
  evidence.
- No existing source file is modified.

## Try to falsify

### 1. The template really is gone

Search the author and editor schemas, the instructions and the checks for any
requirement that:

- the interest drives the plot;
- the theme is the climax obstacle;
- a rule, clue or deadline must be established;
- candidates are compared.

The only interest requirement is that one interest fact ID is mapped somewhere,
which the storyboard binding needs (`storyboard.ts:55`). Judge whether that
re-imports the old pressure in practice. Compare against the trial books: how
many climaxes use the interest as the solving mechanism?

### 2. No sneaking through the editor or the findings

`editorFindings` may only carry hygiene notes: names, dashes, words, facts,
moments, niqqud, excluded subjects. Confirm that no literary or plot rule is
injected, that the findings are deterministic, and that they derive only from
`checkSimpleStory`.

### 3. Hygiene parity with the current writer

- The `imageDirection` marker and the excluded-subject exact-phrase guard
  through `comparableText` should match `story-writer.ts:179-182`.
- The dash class is deliberately a superset of `story-writer.ts:178`
  (`[-\u05be\u2013\u2014]`). It also covers U+2010\u2013U+2015, U+2212, the soft
  hyphen and full-width forms, after a model emitted U+2011.
- **Separate finding for the current writer (not changed here):** its
  four-character class lets those forms through Guy's no-dash rule.
- Attack the new name check:
  - prefixed forms (ו, ה, ב, כ, ל, מ, ש);
  - plene and unpointed variants;
  - two-word child names;
  - names that are substrings of common words (for example בר inside שבר is
    deliberately lenient).
- Attack the normaliser:
  - digits and ranges;
  - dialogue dashes;
  - dashes at line ends;
  - mixed quotes.

  Could it change meaning? Counts are recorded per stage in `evidence.json`.

### 4. Contract compatibility

- The result parses with `personalStoryResultSchema` and is accepted by
  `preparePersonalStoryboard` (tested).
- Check `prepareStoryEdit` (the existing editor), the native bridge and the
  worker views for any assumption of `planning` or of a causal receipt.
- `planning` is deliberately omitted (optional in the contract).
- `accounting.providerCalls` is 2.

**Reproduction trap.** `resolvePersonalWizardOptions()` resolves card art and
voice samples relative to `process.cwd()`, and the options fingerprint is
part of the request ID.

- Run any replay of the trial results from the checkout root. From another
  tree every result fails `source_binding`, which is a harness error, not an
  engine one.
- Results for the nine newer companions fail storyboard preparation with
  `companion_unavailable`, because the legacy visual registry has no entry for
  them. This is pre-existing and not caused by this change.

### 5. No public or production path change

- Nothing imports the module except its test and the script.
- `options.ts` and `writePersonalStory` are unchanged.
- The wizard still offers 6 companions.
- `textCanonOptions` is reachable only from the script and the test.

### 6. Accounting and safety of the runner

- Wire contract reuse: the instruction file is exclusive, the executable hash
  is checked before every spawn, and the environment is stripped.
- Budget class: an unknown cost counts as the full reservation; concurrency
  keeps the in-flight reservations within the limit.
- The output root must not exist, and every file is written with `flag: 'wx'`.
- SIGINT aborts.
- Check the cost figures in the closeout against the receipts.

### 7. Reproducibility

- Prompts are constants.
- The spine is `sha256(version, requestId, seed)`.
- Each run saves the instructions file, the wire digest, the exact input, the
  receipts, the draft, the edit and the checks.
- Different seeds for the same request give different spines; the same seed
  gives the same spine.

### 8. Diagnosis claims to verify or refute

- Convergence counts: 12/12 Bar ideas, 4/4 blind outlines, and the
  cloud-reunion attractor across Ido, Bar and Tamar.
- The claim that the old schema, validators and craft rules encode the
  template.
- The untested hypothesis that the Astra rubric rewards puzzle structure.

### 9. Failure policy

- A book whose edited text fails a hard check is not produced (no third call,
  no draft fallback).
- An invalid author output stops before the editor.

Is that the right default for a product path? It is recorded as an open
decision, not decided here.

### 10. Test adequacy

Mutate:

- each hard check;
- the editor findings mapping;
- the exact page bounds;
- the name variants;
- the normaliser cleanup;
- the two-call order.

Report survivors.

## Out of scope for technical PASS

Literary quality, humour, Hebrew and age fit are Guy's product acceptance. The
trial books are evidence for that review, not proof of release quality.
