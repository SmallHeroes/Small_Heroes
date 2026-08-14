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

## Independent QA and Writer revision intake

Claude Code independently reviewed exact range `a985cc43..7c55bf93` and returned
technical PASS with zero BLOCKER, MAJOR or MINOR. It exhaustively exercised 36
invalid Editor result shapes and reproduced the 17 focused tests, TypeScript,
script syntax, diff check and byte-identical targeted revision prompt. ADV-1
through ADV-7 are advisory only.

The Writer's first targeted revision is preserved unchanged at
`outputs/story-engine-vnext-dini-cake-revision1-raw/draft.md`:

- bytes: `6,603`;
- SHA-256: `0c33aa0a668d475ea44909af3b911f18478ffb1eef1dda94cccf6de6cd9c6907`.

It fixed all known suffix-style gender chips and strengthened the comic peak on
pages 5–6, but repeated the malformed 22-character frontmatter delimiter. The
new `normalize-targeted-revision-pilot` intake is deliberately narrower than an
editor: it permits that delimiter normalization only because the bound Editor
result contains `output_structure_invalid`, and otherwise fails on identity,
frontmatter shape, page order/count/emptiness or malformed chips.

Normalized story:

- path: `outputs/story-engine-vnext-dini-cake-revision1-normalized-20260814-v1/dragon_dini_adventure_wobble_cake_convoy_brief_v1.normalized.7e496c0365d86b4cf2db0be1cece81a71365451883ce7a2203a598b63af83fa4.md`;
- bytes: `6,584`;
- SHA-256: `7e496c0365d86b4cf2db0be1cece81a71365451883ce7a2203a598b63af83fa4`;
- normalization actions: exactly one `frontmatter_closing_delimiter_normalized`, from length 22 to `---`;
- page contract: 1–12, sequential and nonempty;
- repository suffix-chip scanner: PASS, zero hits.

Editor round-2 commission:

- root: `outputs/story-engine-vnext-dini-cake-editor-review-round2-20260814-v1`;
- filename: `dragon_dini_adventure_wobble_cake_convoy_brief_v1.editor.fff73716b9b8cf5f5830090ffd61f7329b1153c07296824fc42733e84901d01b.md`;
- prompt SHA-256: `fff73716b9b8cf5f5830090ffd61f7329b1153c07296824fc42733e84901d01b`.

Focused validation now passes 2 files / 18 tests. TypeScript, script syntax and
`git diff --check` pass. A direct run through the real repository parser and
suffix-chip scanner confirms the same frontmatter/page/chip facts. The full
repository gate was not rerun and its existing seven-failure HOLD remains.

## Round 2 correction and editorial PASS terminal

Editor round 2 returned `revise` with one major
`dramatic_function_repeated` issue on pages 2–6. It accepted the child's
discovery/climax authority, Dini's character causality, the cake mechanism and
the visual journey, but found that the street and market obstacles still
performed the same dramatic function.

Round-2 result:

- path: `outputs/story-engine-vnext-dini-cake-editor-result-round2-20260814-v1/review.json`;
- bytes: `2,572`;
- SHA-256: `2c0210429fea79fd9af3fd34ff821fad8969323396949f0d4df0f3b23aae001f`.

The bound second targeted-revision prompt is
`outputs/story-engine-vnext-dini-cake-targeted-revision-round2-20260814-v1/dragon_dini_adventure_wobble_cake_convoy_brief_v1.revision.5e20d3561bba508e4002ce4a8f87bc7c78a97ce374ca936ee3c8a6bf43ce52b6.md`
(11,104 bytes; raw SHA-256 equals its filename digest). It authorized only the
diagnosed functional correction and preserved the orange-market peak and the
page 7–12 discovery, climax, payoff and ending.

The Writer made the street obstacle an early observation: Dini physically
stabilizes the cart, the stopped cake begins to lose a strawberry, and the
child asks her to release it. The market remains a distinct environmental
intervention and visual-comedy escalation, after which the child obtains a
second observation before performing the deliberate bridge experiment.

The raw Writer response is preserved at
`outputs/story-engine-vnext-dini-cake-revision2-raw/draft.md` (SHA-256
`94d2adc1709c0f5cde82889a898f61f67283bd8a7905deb10575bfec4e3a1b63`).
Canonical intake rejected it with `story_writer_revision_frontmatter_invalid`:
it repeated the 22-character closing delimiter and contained one suffix chip,
`הסתכל{ה}`. Codex then applied exactly two disclosed input-only mechanical
corrections in a separate preserved copy: delimiter `----------------------` to
`---`, and `והסתכל{ה}` to `{והסתכל|והסתכלה}`. No event or other prose was
changed.

Canonical second revision:

- path: `outputs/story-engine-vnext-dini-cake-revision2-normalized-20260814-v1/dragon_dini_adventure_wobble_cake_convoy_brief_v1.normalized.1e40185446b4a9cba0a321d939774d6452fade5a628f2322df616fe4b083a465.md`;
- bytes: `6,462`;
- SHA-256: `1e40185446b4a9cba0a321d939774d6452fade5a628f2322df616fe4b083a465`;
- page/chip contract: exactly 12 sequential nonempty pages, canonical
  frontmatter and zero malformed suffix chips.

Editor round 3 commission has SHA-256
`405c90325e1f2362ace462709a74d7a74c3d9f4c1da9eca5d164dfd839ed7a67`.
The external Editor returned closed verdict **`pass`** with four strengths,
zero issues and zero revision priorities. It confirmed differentiated
street/market functions, child-owned discovery and climax, Dini's specific but
adaptive role, the orange comic peak and the cake mechanism's complete
setup/discovery/experiment/payoff arc.

Pass result:

- path: `outputs/story-engine-vnext-dini-cake-editor-result-round3-20260814-v1/review.json`;
- bytes: `1,927`;
- SHA-256: `bed8053efb2bfa61faf15060a29fea4de7051242c0bfa7db585d07307c48e80b`.

The new `materialize-editorial-pass-pilot` terminal requires a valid `pass`
with zero issues and zero revision priorities, independently validates an
already-canonical draft without permitting normalization, and writes the exact
story bytes plus `small-heroes-editorial-pass-candidate-manifest/v1`. It rejects
`revise`, malformed frontmatter/chips, byte-identity drift and output-root
reuse. A `pass` remains ineligible for the repair route, proven by the exact
`story_writer_revision_not_authorized:pass` rejection with zero artifacts.

Editorial candidate:

- root: `outputs/story-engine-vnext-dini-cake-editorial-pass-candidate-20260814-v1`;
- filename: `dragon_dini_adventure_wobble_cake_convoy_brief_v1.editorial-pass.1e40185446b4a9cba0a321d939774d6452fade5a628f2322df616fe4b083a465.md`;
- bytes and SHA-256: identical to the canonical source draft;
- status: `editorially_passed_staging_candidate`.

Validation:

- `node --check scripts/materialize-story-commission-briefs.cjs`: PASS;
- focused Vitest: 1 file / 11 tests PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

The literal repository gate was not rerun. Its separate seven ordinary
failures remain the repository/release HOLD. No provider/model/network call,
credential access, story-bank import/approval, Visual Contract, Wizard, image,
audio, Vision, storage/database, QA/Production deployment or push occurred.
The external editorial PASS is not Codex self-awarded product acceptance and
does not itself grant downstream authority.

## Independent QA closeout

Claude Code independently reviewed exact immutable range
`7c55bf931b4488d5ea0340a6b503a1cdcc36e67f..acd445141fda29fddaf6a81eccc870b9d1a62bb3`
read-only and returned **TECHNICAL PASS** with zero BLOCKER, zero MAJOR and zero
MINOR. This document records Claude Code's verdict; Codex does not self-award
independent technical PASS.

Claude confirmed all ten handoff claims. It independently verified the exact
two-commit topology, unchanged package and lockfile, preserved revise behavior,
strict pass-only terminal, no normalization at acceptance, refusal behavior,
candidate/review byte identities, the exact two-line raw-to-corrected diff,
absence of downstream authority and separation of the seven-failure release
HOLD. It also reproduced 1 file / 11 tests, script syntax, deterministic
TypeScript and `git diff --check`.

ADV-1 through ADV-7 remain advisory only:

1. The refusal code for a `pass` carrying priorities names the verdict rather
   than the specific priorities violation.
2. The two disclosed mechanical corrections were manual input edits backed by
   preserved raw bytes and an exact diff, not a repeatable transform.
3. `CURRENT.md` originally omitted the attached `ו` in its quotation of the
   malformed chip; this documentation closeout corrects the quotation to
   `והסתכל{ה}` without changing any artifact.
4. The pass terminal is byte-strict while the revise path still normalizes
   BOM/CRLF/trailing whitespace without recording those changes in `actions`.
5. `gender: female` and `endingType: resolution` remain intentionally limited
   to this one-slot pilot.
6. Claude did not rerun the literal repository gate; the separate seven-failure
   release HOLD remains unwaived.
7. Claude's probes wrote only to temporary directories outside the repository.

No advisory is an implementation finding and no further re-gate is required
for this range absent a factual discrepancy. Product/story acceptance and all
bank, Visual Contract, Wizard, render, deployment and release decisions remain
Guy's authority.

## Rollback

Revert only the follow-up commit built on `a985cc43`. The prior Architect v1 pilot commit and its preserved outputs remain independently addressable. Because no bank/runtime authority changed, rollback requires no story migration or data rewrite.
