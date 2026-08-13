# Story Engine vNext Functional Quality Pilot — Decision Gate

**Status:** approved by Guy on 2026-08-13 with standing execution authority.

**Branch/worktree:** `codex/story-bank-next-generation-briefs-qa-integration` at `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`.

**Exact base:** `a985cc43ad4e8ccf37ee033ba55365bf98d59821`.

## Observed behavior

The first Story Architect pilot materially improved the Dini cake draft: it invented new locations, obstacles, physical comedy and an earned payoff instead of paraphrasing the old screenplay. The resulting story nevertheless exposed four bounded weaknesses: the anomaly could arrive with more force, the adventure lacks one unmistakable comic peak, the child mostly observes before the climax, and several consecutive sections repeat the same dramatic function.

## Expected behavior

Strengthen the functions a successful story must achieve without specifying the events, props, locations, dialogue or choreography that achieve them. Keep creation and evaluation separate. Preserve the current selected A draft as evidence rather than rerunning the Architect and introducing model variance.

## Root cause

The pilot correctly removed plot rails, but its Architect and Writer charters did not explicitly distinguish broad quality functions from plot implementation. Its post-draft QA contract covered the right themes but lacked a separate companion QA canon, a typed editor-only review workflow and an explicit rule that child agency may be experiment, choice, construction, investigation, negotiation or another causal contribution—not always a discovery of something the companion missed.

## Nine decisions

1. Keep the experiment limited to the Dini cake pilot; do not migrate the other 17 slots.
2. Replace the repeated `childDiscovery` framing with `childAgencyArc`: the child must cause meaningful change and lead the climax, but the mechanism remains open.
3. Add only functional Architect constraints: immediate visible hook potential, large comic-peak potential for adventure, active child agency before climax, differentiated dramatic problems and a surprise not directly predictable from the nucleus.
4. Keep StoryShape broad. Do not add page assignments, exact objects, exact attempts, exact climax actions or exact endings.
5. Give the Writer only four compact drafting priorities: enter the anomaly quickly, create one memorable comic peak for adventure, give the child one intentional pre-climax action and transform/compress repeated dramatic functions.
6. Keep numerical delight observations diagnostic rather than individually gate-failing. Editors judge the whole experience; they do not insert checklist jokes.
7. Add a separate closed `CompanionQACanon` used only by Editor/QA. It may test inner-character fidelity, sincere help, adaptation and non-swappability, but may not require canonical maneuvers or catchphrases.
8. Add a content-addressed editor-only materializer. It diagnoses a completed draft and returns `pass`, `revise` or `reject`; it must not rewrite the story or leak rejected Architect shapes.
9. Preserve selected Draft A, run the Editor workflow on it, then create a separate targeted Writer revision. Require one later cross-companion pilot before any system-wide migration.

## Rejected alternatives

- Rerunning the Architect now: model variance would confound the quality-layer experiment.
- Returning the full QA checklist to the Writer: this recreates specification prose.
- Hard-requiring two or three jokes, a catchphrase or one discovery mechanism: numerical/formula compliance is not delight.
- Rewriting the current draft manually inside the Editor stage: diagnosis and authorship must remain separate.
- Migrating all 18 slots after one Dini success: insufficient evidence of generality.

## Acceptance criteria

- Architect output uses `Child agency arc`, not a mandatory discovery pattern.
- Architect and Writer receive no Companion QA canon or full editorial QA contract.
- The Writer charter contains exactly four compact functional priorities and no plot implementation.
- The Editor receives the draft, editorial QA contract and selected companion QA canon, but no rejected shape or legacy screenplay.
- Editor output is diagnostic-only with a closed verdict and bounded revision priorities.
- Draft files must be regular, non-symlink Markdown under `outputs`, nonempty and bounded to 64 KiB.
- Generated editor prompt and manifest are content-addressed and an existing output root is rejected.
- Existing v2 materializer, approved banks, runtime, Wizard, Reader and render pipeline remain unchanged.

## Rollback

Revert the focused functional-quality commit. The earlier `a985cc43` Architect pilot and its output remain intact and usable as staging evidence.

## Cost and exclusions

External cost is `$0`. No provider/model call, credential access, story generation, bank import, render, database/storage action, QA deployment, Production action or push is authorized by this implementation milestone.
