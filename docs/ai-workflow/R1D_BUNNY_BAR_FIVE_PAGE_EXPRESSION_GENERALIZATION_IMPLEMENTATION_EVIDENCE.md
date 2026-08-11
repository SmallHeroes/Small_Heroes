# R1D Bunny/Bar five-page expression generalization — implementation evidence

**Date:** 2026-08-11

**Branch:** `codex/r1d-child-expression-style-fidelity`

**Story Source:** `story-bank/v3-approved/bunny_ometz_adventure.md`
**Child anchor SHA-256:** `3715cf8f6dcb1775abba4a81138ac41a2bb2db437b38efaad6aaea936cdbcb88`

## Product question

Can the general child-expression/style treatment preserve the same five-year-old Bar across a different approved story while producing beat-appropriate expressions and materially different compositions, and can those exact pages be reviewed through the real QA Reader with only its physical sheet turn?

## Authority and qualification

- Story Source SHA-256: `a581355950aefa92b4014a47a45301eb2929a8ea32924aa796882dc56ab2bd49`
- Measurement shot-plan SHA-256: `3c270b29fe830c490675e64886ccb827468c2dc25e51f06f41d9d487d8793be4`
- Template SHA-256: `b8c79f1091072bb05b2e0b8adb3d531ee7248f2821e8eada70b5ee4427fb1912`
- Migrated template: `vc-schema/v4`
- Visual Package: `visual-package/v5`, revision `af3d51820c5a687742af94293b2d7d0a56ecf673ae35d40c466215df52d506eb`
- Blueprint: `pre-render-book-visual-blueprint/v4`, digest `5cc4e05056e1100b9cc1a578aadb9b0d053f6e5918a9084ede5f7f7b748cd076`
- Runtime authority: `style01-runtime-authority/v6`, contract hash `f7428d7a1521b3510d9905ea7227aa53b5e94f914c284376c949f740a948760d`
- Wizard `renderQualified: true`; five distinct measured frame signatures; Production blocked.

The measurement-only legacy overlay supplies deterministic migration facts missing from the historical Bunny authority. It is not production authority and does not weaken the canonical compiler, validators, Blueprint or Wizard gates.

## Prompt-length failure and general correction

The first live sequence successfully persisted pages 1-3. Page 4 was rejected before image generation with `Expected maximum 32000, got 34687`. Inspection of the persisted page 1-3 prompts found three occurrences of the exact Runtime Blueprint marker:

1. serialized as the scene description;
2. serialized again as the composition block;
3. serialized a third time inside the Visual Contract prompt block.

The correction keeps one serialized Runtime Blueprint composition authority, one facts-only contract block and the Blueprint's sanitized narrative summary as the human-readable scene/expression input. Frame digest, placements, camera, cast, props, continuity, world geometry and identity/style locks survive unchanged. No truncation, story literal, model, schema, budget, retry, fallback or production policy change was introduced.

Regression assertions require exactly one `[PVB RUNTIME FRAME` marker and exactly one `=== VISUAL CONTRACT FACTS` marker at the provider boundary. Focused validation passed **2 files / 36 tests**; scoped deterministic TypeScript and `git diff --check` passed. Repository-wide TypeScript remains blocked only by the pre-existing `.next/types` rejection of the unrelated `triggerGeneration` route export.

## Bounded render evidence

The existing page 1-3 images were not regenerated. A separate completion root rendered only pages 4-5 with `gpt-image-2` LOW at `1024x1536`.

| Page | SHA-256 | Bytes | Persisted usage | Conservative local cost |
|---|---|---:|---|---:|
| 1 | `28057f986650f8dc9e0a3a2c91646b3b4843c62b9834b9b731586e78db0cb48c` | 2,616,894 | unavailable after interrupted first sequence | not claimed |
| 2 | `fc74ac6864645a5d929d41881ef994ee11617fdda515bf659dee6dfca37cfc81` | 2,703,740 | unavailable after interrupted first sequence | not claimed |
| 3 | `17aecf6439505b073cb2aef53e3574c67cf0e626b181de1bdfff5dc16b60df0e` | 2,242,526 | unavailable after interrupted first sequence | not claimed |
| 4 | `6cc4a5a6ec7c671491ff88c47300824769726ebc896fcc0392dcab5572318b58` | 2,510,799 | 8 text input / 158 image output | `$0.004804` |
| 5 | `c6c84d3a086833fb01f15172fd31f0e4e76a546241d0b727e6cf37e206da047c` | 2,638,819 | 8 text input / 158 image output | `$0.004804` |

The completion used two provider calls, zero transport retries, no fallback and no Vision. The conservative `$0.009608` applies only to the two persisted completion receipts and is not an OpenAI billing/account audit. The wrapper-killed discovery process created no image and reached no provider completion; its partial root is not authority.

## Visual and Reader assessment

- Page 1: anxious/subdued waiting-room establishment with parent.
- Page 2: tentative attention toward Buni from a close, high composition.
- Page 3: restrained amusement in a medium interaction frame.
- Page 4: hesitation at the doctor's doorway, with parent and companion present.
- Page 5: focused/brave action while climbing the examination chair.

Bar's stable identity, hair, clothing and semi-naturalistic watercolor anatomy remain coherent across the five frames. The expression arc changes with the story beat rather than copying the source photo. Buni remains intentionally companion-like. This is LOW evidence for Guy's visual review, not a final HIGH or launch acceptance.

The exact five images are compressed into tracked WebP assets under `qa-fixtures/reader/r1d-bunny-bar-expression-generalization-fe97f823/` and bound through `lib/tracked-qa-reader-fixtures.ts`. The Reader implementation contains no legacy whole-book tilt/fade animation; standard desktop story spreads use only the physical paper-sheet turn, while unsupported geometry navigates instantly.

Vercel Preview deployment `dpl_ECXhVoBKBH4DANDDgBhdUhLAzFdK` reached `Ready` for exact fixture commit `845a2ed3`. An authenticated remote-browser check selected `[QA fixture] Buni + Bar · expression generalization · pages 1–5`, loaded counter states 1 through 5 and five distinct static WebP URLs, then returned to page 1. During forward navigation the Reader exposed one `data-physical-page-turn="forward"` sheet and `data-page-turn-mode="physical-sheet"`; backward navigation exposed the equivalent single `backward` sheet. The host returns to `instant` at rest, which means there is no persistent or competing whole-book movement. The verified immutable Preview URL is:

`https://small-heroes-fteat3ll2-smallheroes-projects.vercel.app/dev/viewer?dir=r1d-bunny-bar-expression-generalization-reader-qa-fe97f823&root=outputs`

## Exclusions and remaining gates

No full book, HIGH image, Vision, remote database/storage, Board, publication, production promotion or deployment occurred during rendering. Production remains blocked. Independent Claude Code technical QA and Guy's product/visual acceptance remain outstanding.
