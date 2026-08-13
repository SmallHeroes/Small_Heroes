# Story Engine vNext Functional-Quality Pilot — Implementation Evidence

**Status:** locally implemented; independent Claude Code QA pending

**Date:** 2026-08-13

**Worktree:** `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`

**Branch:** `codex/story-bank-next-generation-briefs-qa-integration`

**Base:** `a985cc43ad4e8ccf37ee033ba55365bf98d59821`

## Product observation

Guy selected Architect direction A and found its first draft materially better than the earlier over-scripted result. The remaining gaps were functional rather than premise-specific: repeated middle-page dramatic work, no large memorable comic peak, late child agency and several read-aloud/personalization syntax defects. The correction therefore strengthens functional quality boundaries without supplying replacement events or rewriting the draft.

## Implemented authority split

1. `STORY_ARCHITECT_PILOT_CHARTER.md` v2 keeps Stage 1 broad and adds five functional story-shape gates: immediate disruption, causal room for a large visual-comedy escalation, meaningful pre-climax child action, differentiated dramatic problems and one significant unpredictable idea.
2. `Child discovery` is replaced with the implementation-agnostic `Child agency arc`.
3. Stage 2 gives the Writer exactly four compact drafting priorities. It does not prescribe dialogue, choreography, props, locations, page beats, a discovery mechanism or a lyrical ending.
4. `STORY_DRAFT_EDITORIAL_QA_CONTRACT.md` v2 is post-draft and diagnostic-only. It may return `pass`, `revise` or `reject`, but cannot rewrite prose or force mechanical checklist compliance.
5. `companion-qa-canons.json` introduces one closed staging canon for Dini. It describes inner character, relationship dynamic and capacity to adapt, while explicitly forbidding a mandatory maneuver or slogan as proof of identity.
6. The companion QA canon and editorial QA contract are bound in manifests but marked outside the Architect dispatch. They are supplied only to the later Editor commission.

## Safe Editor materialization

The new CLI is:

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize-editorial-review-pilot `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --draft-path outputs/story-engine-vnext-dini-cake-draft1/draft.md `
  --output-dir outputs/story-engine-vnext-dini-cake-editor-review-20260813-v1
```

Input restrictions:

- `.md` only;
- regular file and not a symlink;
- real path remains strictly beneath repository `outputs`;
- 1 byte through 64 KiB;
- non-empty UTF-8 text with no NUL;
- output directory must be empty.

The generated commission is diagnostic-only and asks for one closed JSON object. Its issue codes distinguish hook, comic peak, child agency, repeated dramatic function, causality, payoff, companion identity, Hebrew read-aloud, personalization syntax, output structure, category energy and visual repetition. The Editor may name the functional gap and pages but may not prescribe replacement prose or choreography.

## Preserved Draft A and generated evidence

Draft input:

- path: `outputs/story-engine-vnext-dini-cake-draft1/draft.md`
- bytes: `6,322`
- SHA-256: `0f002541b317f952a7ca8ca61da54524d04378717c753372048a65e688301e77`

Editor commission:

- root: `outputs/story-engine-vnext-dini-cake-editor-review-20260813-v1`
- prompt: `dragon_dini_adventure_wobble_cake_convoy_brief_v1.editor.5e1cbf6189f589a01377a1c00a68f7eec46c9b92407fd9ab2d358ed2288a157d.md`
- prompt bytes: `13,164`
- raw and filename SHA-256: `5e1cbf6189f589a01377a1c00a68f7eec46c9b92407fd9ab2d358ed2288a157d`
- manifest version: `small-heroes-story-editorial-review-pilot-manifest/v1`
- prompt contains no `WAITING_FOR_GUY_SELECTION` marker or Architect charter.

The Draft A bytes were not changed. This materialization grants no editorial verdict, revision acceptance, bank authority or runtime authority.

## Validation

- `node --check scripts/materialize-story-commission-briefs.cjs`: PASS.
- `npx vitest run lib/__tests__/story-commission-materializer.spec.ts lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts --maxWorkers=1 --no-file-parallelism`: PASS, 2 files / 16 tests.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS before documentation closeout.
- Literal `npm run check`: run exactly once; exit 1 after 155.8 seconds.
  - TypeScript: PASS.
  - Ordinary: 280 files; exactly seven known failures — six missing ignored-output fixtures and the pre-existing stale Bunny measurement source-string assertion.
  - Resource-intensive: 19 files; PASS with valid diagnostic protocol and no RPC/IPC, reporter, launch, signal, teardown or timeout failure.
  - No Story Engine, materializer or new functional-quality assertion failed.

Repository/release remains HOLD on the separate seven ordinary failures. This milestone does not waive them.

## Unchanged and excluded

- v2 18-slot materializer behavior and existing output contract;
- other 17 prepared story slots;
- approved story banks and runtime loading;
- prompt/model/provider, budgets and credentials;
- Wizard, Reader, checkout and payments;
- image/audio/Vision generation, storage/database, QA/Production deployment and push.

External cost was `$0`. Codex does not self-award independent technical or product PASS.

## Editor result and targeted revision follow-up

The external Editor returned `small-heroes-story-editorial-review/v1` with
verdict `revise`. It preserved four specific strengths and reported exactly:

- major `personalization_syntax_invalid` on pages 2, 4, 6 and 8;
- major `output_structure_invalid` on page 1;
- minor `comic_peak_insufficient` on pages 2, 3, 5 and 6.

The result is stored as ignored evidence at
`outputs/story-engine-vnext-dini-cake-editor-result-20260813-v1/review.json`:

- bytes: `3,525`;
- SHA-256: `08acf80d8b987d7f3b0c536c75286bb18d7000cb8bc52823dc3dbe55836c55c7`.

The follow-up adds a closed result validator and a separate
`materialize-targeted-revision-pilot` command. It rejects extra/missing keys,
unknown issue codes, invalid verdict/issue combinations, duplicate issue
identities, invalid or out-of-range page locators, unsafe paths, oversized JSON
and output-root reuse. Only `revise` can enter the Writer path.

Generated Writer commission:

- root: `outputs/story-engine-vnext-dini-cake-targeted-revision-20260813-v1`;
- prompt: `dragon_dini_adventure_wobble_cake_convoy_brief_v1.revision.a7fa8e88f63677b251e172c574aea10935636c61843d75ac0bb4d31f748794b9.md`;
- bytes: `12,055`;
- raw and filename SHA-256: `a7fa8e88f63677b251e172c574aea10935636c61843d75ac0bb4d31f748794b9`.

The commission binds Draft A and Editor-result digests, preserves the accepted
strengths and `mustPreserve` items, adds deterministic gender-chip/frontmatter
instructions only because the corresponding codes were diagnosed, and leaves
the implementation of the stronger comic peak open. It contains no Architect
charter, full editorial QA contract, companion QA canon or rejected shape.

Follow-up validation passes 2 files / 17 tests, script syntax, deterministic
TypeScript and `git diff --check`. The literal repository gate was not rerun;
the earlier seven-failure baseline remains the separate release HOLD.

## Rollback

Revert only the follow-up commit built on `a985cc43`. The prior Architect v1 pilot commit and its preserved outputs remain independently addressable. Because no bank/runtime authority changed, rollback requires no story migration or data rewrite.
