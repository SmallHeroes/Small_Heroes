# R1D Child Expression and Style Fidelity — Implementation Evidence

Date: 2026-08-11

Base: `ced2f4e19dcaf843f772ba88b09adf2fc5509604`

Branch: `codex/r1d-child-expression-style-fidelity`

Status: implementation and bounded LOW proof complete; independent QA and Guy product review pending

## Observed defect and root cause

The first Dini/Bar five-page prompts contained the same literal identity phrase on pages 1–5:

`natural child nose and broad open smile`

The supplied photo's expression had therefore been promoted into immutable identity. The canonical `authoritativeBlueprintFrame` branch also returned before the legacy page-expression lock and built its own unsanitized identity text. Reference manifests recorded no child-expression anchor. Pages 3 and 4 used the same child/companion/style references as page 5, but their approved child regions were materially smaller (230×203 and 270×244 versus 410×349), isolating small-scale simplification—not a swapped reference set—as the main style-drift factor.

## Implemented boundaries

1. `sanitizeTransientExpressionFromIdentity` removes transient smile/frown/open-mouth/emotion phrases while retaining stable face morphology. It is applied both during child-DNA sanitation and at final Style 01 child-lock construction.
2. The child-photo instruction explicitly makes photographed expression non-authoritative and makes the child photo the primary human-identity anchor. Creature/style references cannot change human anatomy.
3. `Style01PageExpressionKind` is a closed catalog. Classification consumes narrative/source evidence only to select a type; it does not copy raw prose into the expression directive.
4. The authoritative Blueprint branch now calls the shared sanitized child-lock builder and binds a typed page expression.
5. Small-in-frame fidelity is derived only from approved child placement geometry and camera class. Its instruction explicitly preserves the existing region.
6. The Dini/Bar measurement runner reads the already-selected Story Source through `parseStorySourceContent`, passes page text/direction to the shared prompt boundary, removes the smile literal, and accepts a validated render-page subset.

No Story Source, Blueprint, Visual Contract, camera plan, placement, model, quality, retry, fallback, storage, production or deployment policy changed.

## Validation

- `lib/__tests__/child-photo-dna-sanitize.spec.ts`
- `lib/__tests__/style01-child-expression-style-fidelity.spec.ts`
- `lib/__tests__/r1d-dini-bar-five-page-measurement-authority.spec.ts`
- `lib/__tests__/style01-prompt-assembly-child-presence.spec.ts`
- `lib/generation-pipeline/__tests__/runtime-world-authority.spec.ts`

Results:

- direct sanitizer/expression/classifier: 3 files / 23 tests PASS;
- focused prompt/measurement/runtime integration: 5 files / 44 tests PASS;
- deterministic TypeScript: PASS;
- `git diff --check`: PASS;
- one literal `npm run check`: TypeScript PASS; 19/19 resource-intensive files PASS with valid diagnostics; ordinary phase reported exactly the six established missing ignored-output fixtures and no seventh assertion or infrastructure failure.

The six fixtures remain a separate release HOLD. They are accepted only for this local LOW product measurement and are not waived for production.

## LOW proof boundary

The approved first proof is pages 1, 3 and 4 only on `gpt-image-2` LOW. Pages 2 and 5 remain the comparison baseline. No Vision call, automatic retry, fallback, full-book render, remote storage/database, Board action, publication, promotion, deployment or production enablement is authorized. If the first proof remains materially wrong, at most one evidence-driven second visual attempt is allowed before stopping for Guy.

## LOW proof result

Official OpenAI pricing was checked immediately before dispatch. The current `gpt-image-2` model page lists image generation and editing support; the official API pricing page lists `$8/M` image-input tokens, `$2/M` cached image-input tokens, `$30/M` image-output tokens, `$5/M` text-input tokens and `$1.25/M` cached text-input tokens.

Exactly three sequential local LOW calls completed in `101` seconds:

| Page | Prompt state | Image SHA-256 | Provider usage |
|---|---|---|---|
| 1 | `subdued` | `d6b6cd590e0bd860092a39ae6a397625784b6b63136a53d0a0ac68ae1b5e0425` | 8 text input / 158 image output |
| 3 | `attentive_neutral` | `9731dbd4ec8a32b07a823292e0892ca51e01f4921ebddd7140a7fdbb15c8653a` | 8 text input / 158 image output |
| 4 | `surprised` | `b2a8ddd388234c81b9ecfc44c148cc223bffa07d894bf6f987d5c862dd70f078` | 8 text input / 158 image output |

All outputs are `1024x1536`. Total provider-reported usage was 24 text-input and 474 image-output tokens. Applying the official rates gives `$0.014340` nominal accounting. This is not an OpenAI billing/account audit. Transport retries were 0, fallback was false, Vision calls were 0 and remote database/storage access was false.

The visual comparison proves that the uploaded-photo smile is no longer immutable identity. Page 1 is subdued and closed-mouth; page 3 is attentive/uncertain; page 4 is surprised. No new prompt contains `broad open smile` or `recognisable smile`. Bar's identity, hair and outfit are directionally more coherent. The smaller page-3/page-4 figures remain somewhat more illustrated than page 1, so Guy's visual acceptance remains open.

Artifacts:

- `outputs/r1d-dini-bar-expression-style-fidelity-20260811-render-1/`
- `before-after-pages-1-3-4.png`
- `reader-verification.png`
- mixed Reader manifest `outputs/style01-auditions/r1d-dini-bar-expression-style-fidelity-reader/manifest.json` in the local Reader worktree

The real local Reader returned HTTP 200, displayed page 1 with the exact corrected PNG, and advanced to page 2 through its navigation control. All five page asset routes returned `200 image/png`. No Next.js error overlay appeared. One unrelated `/favicon.ico` request returned 404. The Reader has working navigation but no true page-turn animation; that is a separate UI implementation gap and was not smuggled into this image-authoring milestone.

## Independent QA targets

Claude Code should falsify:

- expression phrases cannot survive either Blueprint or legacy child identity construction;
- every emitted page expression belongs to the closed catalog and raw Story Source prose is not pasted into the lock;
- the small-frame guard is derived from child placement/camera and does not mutate or replan Blueprint geometry;
- the change contains no Bar-, Dini-, story-key- or page-number-specific production routing;
- measurement subset dispatch cannot render an invalid, duplicate or out-of-authority page;
- prompt/model/budget/retry/fallback and production-release boundaries remain unchanged.
