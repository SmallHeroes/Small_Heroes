# Phase 2 fix — relax auto-selector and drop stored-prompt parsing

## Context
The Phase 2 experiment script (`scripts/style-experiment.ts`) was built correctly but found zero eligible orders, because the strict auto-selector requires `ImageAsset.prompt` to contain a `PAGE_SCENE_INTENT: ... BOOK_ILLUSTRATION_PLACEMENT:` block. Most current `ready` orders were generated via the Visual Director path, whose prompts don't carry those markers.

The experiment doesn't actually need historical prompt content. It just needs a consistent scene seed to build new prompts (current and minimalist) for the same scene.

## Goal
Make the script find an eligible order and complete an end-to-end 16-image run.

## Change — single file: `scripts/style-experiment.ts`

### A. Relax auto-select criteria
Drop the requirement that `ImageAsset.prompt` is parseable. New criteria, all must hold:

1. `Order.status = 'ready'`
2. Has a `GeneratedBook` with at least 8 `BookPage` rows
3. `Order.characterAnchors` is populated (non-null, non-empty)
4. Selected pages (1, 3, 6, 8) all have non-null `BookPage.text`

If multiple match → prefer the one with the most distinct `pageTemplate` values; tie-break by most recent `updatedAt`.

If none match → exit with the same clear error.

### B. Replace prompt parsing with page-text scene seed
Remove `extractSceneIntent`. Replace with:

```ts
function buildSceneSeed(page: { pageNumber: number; text: string }, totalPages: number): string {
  const cleanedText = page.text.replace(/\s+/g, ' ').trim();
  return `Page ${page.pageNumber} of ${totalPages}: stage a concrete scene based on "${cleanedText}". ` +
         `Show where it happens, what the child is doing, what the companion or entity is doing, and what surrounds them. ` +
         `Include full environment depth with foreground, midground, and background.`;
}
```

This mirrors how `lib/visualDirector.ts` already constructs scene sentences from page text. The seed is identical for both variants and both styles in any given page — only the style block + negatives differ across cells.

### C. Update both variants to use the new seed

For `current` variant:
- Always call `buildImagePrompt` from `lib/promptBuilder.ts` (do not reuse stored prompts at all). Pass the new scene seed as `pageSceneIntent`.
- For both styles (whichever is the book's original AND the opposite), call `buildImagePrompt` with the matching `styleIdInput`.

For `minimalist_v1` variant:
- Construct inline as before:
  ```
  {minimalistStyleBlock}

  Scene: {sceneSeed}

  Character: keep child consistent with reference (use anchor URL if present in characterAnchors).
  ```
- Negatives from `MINIMALIST_STYLE_BLOCKS[styleId].negatives`.

### D. Cleanup
- Remove the unused `extractSceneIntent` function and its references.
- Remove any imports that were only used by the removed parser.
- Update the in-line comment block at the top of the script to describe the new selector + seed strategy in 2 lines.

## Out of scope
- All production code stays byte-identical (same as Phase 2 v1).
- DB writes still forbidden.
- Cost gate, output structure, manifest, `index.html` — unchanged.
- Auth, env handling, file naming — unchanged.

## Acceptance criteria
- `npm run build` passes.
- Running `npx tsx scripts/style-experiment.ts` auto-selects a real order from the current DB and prints the cost gate prompt.
- After confirmation, runs the full 16-cell matrix and produces:
  - 16 image files
  - `manifest.json`
  - `index.html`
- The chosen order has `Visual Director–shaped` prompts in its existing `ImageAsset.prompt` rows — i.e. the test now works on the actual data shape.
- No production code modified.
- No DB writes.

## Return format
- **GO / NO-GO**
- **Files changed** — should be exactly one: `scripts/style-experiment.ts`
- **Auto-select result** — orderId chosen, page numbers, original style of book, page templates seen
- **Run summary** — 16 cells: how many succeeded, how many failed, output directory absolute path
- **Sample prompt lengths** — for one page, report `current` length and `minimalist_v1` length for both styles (4 numbers)
- **Risks / open questions**
