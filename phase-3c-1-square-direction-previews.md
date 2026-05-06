# Phase 3c.1 — Square aspect ratio for direction preview images

## Principle
Direction preview images shown in the wizard's three-card chooser should be generated as 1:1 squares (1024×1024) so they fit the card slot without being cropped at the bottom or sides. Book page images stay portrait (1024×1536) — only the direction previews change.

## Scope

### In scope
- The image-generation call path for direction previews — most likely `generateStoryDirectionPreviews` (or wherever `isDirectionPreview: true` is set on `ImageInput`).
- The dimensions / aspect ratio configuration passed to Replicate (`generateReplicateImage` in `lib/generate-image.ts`, or wherever the model invocation lives).

### Out of scope — DO NOT TOUCH
- Book page image generation — must stay portrait at the existing aspect ratio.
- Cover image generation — keep current dimensions.
- Reader, layout, story, wizard CSS, payment.
- Card-component CSS — we're fixing the source image, not the slot.

## Tasks

### T1 — Add a `dimensions` override path for direction previews

In `backend/providers/image.ts` (and/or `lib/generate-image.ts`):

- The `ImageInput` type already has `isDirectionPreview?: boolean`. Use it.
- Where the call to `generateReplicateImage` is composed for the direction-preview path, pass an explicit `width: 1024, height: 1024` (or whatever the equivalent param is for the active model — Flux uses `aspect_ratio: "1:1"`, `width`/`height`, or both depending on the wrapper).

If the existing `generateReplicateImage` does not accept a `width`/`height` / `aspect_ratio` override, add it as an optional input field. Do not change the default — only the caller for direction previews specifies square.

Both the cover-image path and the page-image path keep the existing dimensions (likely 1024×1536 or aspect_ratio "2:3" — verify and preserve).

### T2 — Verify the active model accepts the override

The active dev model is `black-forest-labs/flux-dev` (per `.env.local`). On Replicate, Flux models accept `aspect_ratio` strings like `"1:1"`, `"2:3"`, `"3:2"`, `"16:9"`. Verify the wrapper passes the right field.

If `flux-dev` only accepts `aspect_ratio`, pass `"1:1"` for previews. If it also/only accepts `width`/`height`, pass both. Whichever is consistent with how the wrapper handles the existing portrait path.

### T3 — Logging

Add or extend the existing `[image_pipeline_path]` log so the dimensions are visible:

```
[image_pipeline_path] orderId=... page=... path=visual_director postProcess=on styleId=... model=... aspectRatio=1:1
```

This way we can confirm at a glance which calls are running square vs portrait.

## Safety
- No DB changes.
- No story-generation changes.
- No wizard UI changes.
- Existing book pages must continue to render at portrait dimensions — verify by generating one full book end-to-end.
- `npm run build` must pass.

## Acceptance criteria
- `npm run build` passes.
- For a fresh wizard run: the three direction preview images are returned at 1024×1024 (or `aspect_ratio: 1:1`) — verify in Replicate's prediction history.
- For the same run, the book pages and cover are at the existing portrait dimensions — unchanged.
- The `[image_pipeline_path]` log shows `aspectRatio=1:1` for direction-preview calls and `aspectRatio=2:3` (or whatever the existing portrait ratio is) for page calls.
- The wizard's three-card chooser shows full square images that fit the card slot without bottom/side cropping.

## Return format

- **GO / NO-GO**
- **Files changed** (should be 1–2)
- **Where the dimension override is set for direction previews** (file + function + line range)
- **Where the cover and page paths are confirmed unchanged** (file + line range)
- **Sample log lines** for both a direction-preview call and a page call, showing the different aspect ratios
- **Risks / open questions**
