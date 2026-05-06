# Phase 2 — Style A/B Experiment (no production behavior change)

## Principle
Test, with photographic evidence, whether a minimalist style prompt produces sharper visual separation between Style 1 (`soft_hand_drawn_storybook`) and Style 2 (`expressive_painterly_storybook`) than the current ~5k-character production prompts.

This is a **standalone experiment script**. Production code stays byte-identical. The output is a side-by-side visual comparison that informs the next decision: prompt-only is enough, or we must move to LoRA training.

## Goal
For one auto-selected existing book, render the same 4 pages under a 2×2 matrix:
- **2 styles**: `soft_hand_drawn_storybook`, `expressive_painterly_storybook`
- **2 prompt variants**:
  - `current` — the exact production prompt path (`buildImagePrompt` from `lib/promptBuilder.ts`)
  - `minimalist_v1` — defined inline in this script (see Minimalist prompt definition below)

= 16 images total. All renders bypass post-processing. Output saved with a side-by-side HTML viewer.

## Scope

### In scope
- One new script: `scripts/style-experiment.ts`
- Read-only DB access (no writes to any production table)
- Auto-select a suitable existing order
- Build prompts (current via existing `buildImagePrompt`; minimalist inline)
- Call Replicate via existing `generateReplicateImage` helper from `lib/generate-image.ts`
- Save output images + manifest + side-by-side `index.html` to `experiments/style-test/<orderId>/<timestamp>/`
- Cost guardrail with confirmation prompt before any Replicate calls

### Out of scope — DO NOT TOUCH
- All production pipeline files: `backend/providers/image.ts`, `lib/promptBuilder.ts`, `lib/visualDirector.ts`, `lib/styles.ts`, `lib/character-lock.ts`, `lib/generate-image.ts` — all stay byte-identical
- DB schema and Prisma migrations
- API endpoints — no new endpoint, no edits to existing endpoints
- Wizard, reader, payment, story generation, audio
- LoRA / IP-Adapter / model changes
- The phantom `PageVisualStoryboard` type
- The 38 unrelated uncommitted files in the working tree
- Any `.env` or `.env.example` change

## Auto-select target order

The script picks an order automatically. Criteria (all must hold):

1. `Order.status = 'ready'`
2. Has a `GeneratedBook` with at least 8 `BookPage` rows
3. Every selected page has a non-null `ImageAsset.prompt` (we need to extract scene intent from it)
4. `Order.characterAnchors` is populated (non-null, non-empty)
5. Diverse `pageTemplate` across pages preferred — if multiple orders match, prefer the one with the highest distinct-pageTemplate count

If multiple orders tie → pick the most recently updated.
If none match → exit with a clear error: `[style-experiment] no suitable order found (need status=ready, ≥8 pages with prompts, character anchors populated). Aborting.`

Page selection: pick page numbers `1, 3, 6, 8` (or, if the book has fewer than 8 pages but ≥8 was required so this won't happen, evenly-spaced quartiles). Always 4 distinct pages.

## Minimalist prompt definition

Define inline in the script (not in `lib/styles.ts` — this is experimental):

```ts
const MINIMALIST_STYLE_BLOCKS = {
  soft_hand_drawn_storybook: {
    style:
      "Pencil sketch and watercolor children's book illustration, scan of paper, " +
      "visible graphite lines, washed-out muted palette, paper texture grain.",
    negatives:
      "3D, render, CGI, plastic, glossy, smooth digital, airbrush, photoreal, " +
      "vector, pixar, animation, polished, clean lines, perfect symmetry.",
  },
  expressive_painterly_storybook: {
    style:
      "Gouache and oil pastel painting, thick brushstrokes, exaggerated chunky " +
      "character proportions, saturated colors, visible canvas texture, hand-painted picture book.",
    negatives:
      "3D, render, CGI, plastic, glossy, smooth digital, airbrush, photoreal, " +
      "vector, pixar, dreamworks, animation, polished, thin lines, flat color.",
  },
};
```

## Building prompts for each cell

### `current` variant
Use the **stored** `ImageAsset.prompt` for that page directly. This is the exact prompt that was sent to Replicate in production for this page+style. For the *opposite* style (Style 2 if the book was generated in Style 1, or vice versa) — call `buildImagePrompt` from `lib/promptBuilder.ts` with:
- `styleIdInput`: the target style id
- `characterLock`: reconstructed from `Order.characterAnchors` using the same helper production uses (find it via grep — likely something in `lib/character-lock.ts`; if no helper exists, build a faithful equivalent based on existing usage in `backend/providers/image.ts`)
- `pageSceneIntent`: extract from the stored `ImageAsset.prompt` by parsing the `PAGE_SCENE_INTENT:` block (it's between `PAGE_SCENE_INTENT:` and the next `BOOK_ILLUSTRATION_PLACEMENT:` marker, per `lib/promptBuilder.ts`)

If parsing fails for any page → exit with a clear error before any Replicate call.

### `minimalist_v1` variant
Construct inline:
```
{minimalistStyleBlock}

Scene: {extractedSceneIntent}

Character: keep child consistent with reference (use existing anchor URL if present in characterAnchors).
```

Plus negative prompt: `MINIMALIST_STYLE_BLOCKS[styleId].negatives`.

Total minimalist prompt length should be **under 800 characters** (vs current ~5000). The script must log the actual character count for each prompt sent.

## Pipeline

1. Resolve target order (auto-select).
2. Print: orderId, page numbers chosen, current style of book, total images planned (16), estimated cost (`16 × $0.04 = ~$0.64`).
3. Prompt: `Continue? (y/N)`. Read stdin; abort if not exactly `y` or `Y`.
4. For each of the 16 cells:
   a. Build prompt + negative prompt.
   b. Call `generateReplicateImage` with:
      - `finalPrompt` and `negativePrompt` as built
      - Same model resolution used in production (`resolveReplicateImageModel(undefined)` — production-equivalent)
      - Force seed if provided via `--seed`, else let Replicate pick
      - `assetType: 'page'`
   c. Download the resulting image URL to `experiments/style-test/<orderId>/<timestamp>/page<NN>_<styleId>_<variant>.webp`. Use `sharp` to convert to `.webp` if not already.
   d. Append entry to in-memory manifest.
5. Write `manifest.json`.
6. Generate `index.html`.
7. Print final summary: total cells succeeded / failed, output directory absolute path.

## Output structure
```
experiments/style-test/<orderId>/<YYYYMMDD-HHmmss>/
├── manifest.json
├── index.html
├── page01_soft_hand_drawn_storybook_current.webp
├── page01_soft_hand_drawn_storybook_minimalist_v1.webp
├── page01_expressive_painterly_storybook_current.webp
├── page01_expressive_painterly_storybook_minimalist_v1.webp
├── page03_… (4 files)
├── page06_… (4 files)
└── page08_… (4 files)
```

### `manifest.json` schema
```json
{
  "experimentId": "<timestamp>",
  "orderId": "...",
  "bookOriginalStyleId": "...",
  "selectedPages": [1, 3, 6, 8],
  "matrixSize": 16,
  "model": "<resolved replicate model name>",
  "seed": null,
  "createdAt": "2026-04-27T...",
  "cells": [
    {
      "pageNumber": 1,
      "styleId": "soft_hand_drawn_storybook",
      "variant": "current",
      "promptLength": 5234,
      "negativePromptLength": 412,
      "rawProviderUrl": "...",
      "localFile": "page01_soft_hand_drawn_storybook_current.webp",
      "promptHead": "first 200 chars of prompt"
    }
  ]
}
```

### `index.html`
Simple static HTML, no framework. Uses CSS grid:
- One section per page. Header: `Page <N>`.
- Inside each section, a 2×2 grid:
  - Rows: `current`, `minimalist_v1`
  - Columns: `soft_hand_drawn_storybook`, `expressive_painterly_storybook`
- Each cell: `<img>` showing the local `.webp` + small caption with `promptLength` and `variant` + `styleId`.
- Rendered locally in browser, no external CSS dependencies.

## Safety
- **Read-only DB**: script may issue `prisma.order.findMany`, `findUnique`, `findFirst` only. No `create`, `update`, `delete`, `upsert`. Mention this assertion in code comments.
- **No env mutation**: the script forces `ENABLE_PRESENTATION_POSTPROCESS=false` *in the running process only* (it does not write to `.env`). It uses an internal flag — does not call the production `/api/generate` route at all.
- **Bypasses generation flow**: calls `generateReplicateImage` directly. Does not touch `BookPage`, `ImageAsset`, `ResemblanceAudit`, or any other production table.
- **Confirmation gate before any Replicate call**: the user must type `y` after seeing the cost estimate.
- **Aborts** if `REPLICATE_API_TOKEN` not set, no suitable order found, or any prompt parsing fails.
- **No deletion** of any existing files. Only creates new files under `experiments/style-test/`.

## Acceptance criteria
- `npm run build` passes (no production code changed).
- Running `npx tsx scripts/style-experiment.ts` (no args) auto-selects a book and prints the cost estimate + confirmation prompt.
- After confirmation, produces:
  - 16 image files
  - One valid `manifest.json`
  - One `index.html` that renders a 4×4-style grid in browser
- Re-running creates a fresh timestamped subdirectory; previous results are not overwritten.
- No production code files modified.
- No DB writes occurred during the run (verifiable by querying the `_prisma_migrations` table or by `git status` on backend code being clean).

## Return format
Reply with:
- **GO / NO-GO** decision
- **Files created** — full path list
- **How to run** — exact command
- **Auto-select result** — which order was picked, why, page numbers, cost estimate
- **Confirmed by inspection** — answer these:
  1. Which existing function is used to call Replicate? (cite file:line)
  2. How is the scene intent extracted from a stored `ImageAsset.prompt`? (cite the parsing logic)
  3. How is `characterLock` reconstructed from `Order.characterAnchors`? (cite which helper or which file informed the reconstruction)
- **Risks / open questions**
