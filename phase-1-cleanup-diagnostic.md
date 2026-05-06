# Phase 1 — Cleanup + Diagnostic (no behavior changes)

## Principle
Before changing how style works, resolve current ambiguity in the system: which prompt path runs, whether post-processing is applied, and what Flux actually receives. We instrument and document the current state before changing any behavior. **No prompt text changes. No model changes. No flag default changes.**

## Goal
At the end of this task we must be able to answer, for any generated page, with code-grounded certainty:

1. Which prompt assembly path ran — legacy `buildImagePrompt` or `composeVisualDirectorPrompt`?
2. Was the result post-processed by `lib/illustrationPresentation`, and is what the user sees the raw or post-processed image?
3. What is the exact final prompt + negative prompt that was sent to Replicate for a given page?

Plus: surface a controllable post-process toggle, and clean obvious root-level junk.

## Scope

### In scope
- One-line deterministic log per image generation showing which path ran and whether post-process was applied
- Env flag for post-processing (default preserves current behavior)
- Read-only debug endpoint that returns the stored prompt for any order page
- Inline documentation comments in `backend/providers/image.ts` and `lib/styles.ts` explaining the current dual-path situation
- Delete root-level junk files: `tmp_storyboard_run.json`, `story-output.json`

### Out of scope — DO NOT TOUCH
- Any style content in `lib/styles.ts` — `optionBlock`, `lineRules`, `colorRules`, `shadingRules`, `lightingRules`, `backgroundRules`, `compositionRules`, `negativeConstraints`, `imageNudge` all stay byte-identical
- Any prompt text in `lib/promptBuilder.ts` or `lib/visualDirector.ts`
- The `USE_VISUAL_DIRECTOR` flag default — remains `"false"`
- DB schema — no migration, no enum changes
- The `LEGACY_STYLE_INPUT_MAP` — leave all 30+ entries
- The phantom `PageVisualStoryboard` type in `image.ts` — leave it (deleting it is a future phase)
- Resemblance system / `ResemblanceAudit` / `lib/resemblance-core.ts`
- Character anchor / `lib/character-lock.ts`
- `lib/visualDirector.ts` and `lib/promptBuilder.ts` content — only documentation comments
- Reader / read-v2 / wizard / payment / story generation
- Any model / provider switching
- LoRA, IP-Adapter, reference packs — out of scope entirely

## Tasks

### T1 — Path attribution log
In `backend/providers/image.ts`, both image-generation provider functions (`generateWithDallE` and `generateWithReplicate`) already log composition info. Add ONE additional line per image generation, immediately before the actual provider API call:

```
[image_pipeline_path] orderId=<id|unknown> page=<n>/<total> path=<legacy|visual_director> postProcess=<on|off> styleId=<id> model=<provider-or-model-name>
```

Where:
- `path` is `visual_director` if `isVisualDirectorEnabledForInput(input)` returned true, else `legacy`.
- `postProcess` reads `process.env.ENABLE_PRESENTATION_POSTPROCESS` (see T2). Default `on`.
- `styleId` is the normalized style id.
- `model` is the resolved model name for Replicate, or `'dall-e-3'` for the DALL-E path.

This is the single source of truth for what ran. No other behavior changes in these functions.

### T2 — Env flag for presentation post-processing
Currently `app/api/generate/route.ts` runs `lib/illustrationPresentation` unconditionally for every page (around lines 797-852). Add an env flag:

- `ENABLE_PRESENTATION_POSTPROCESS` — default `"true"` (preserves all current behavior).
- When `"false"`: skip the entire `evaluateImageSignal` + `storePresentationBuffer` block; `presentationUrl` stays `null`; reader code (`app/api/orders/[orderId]/route.ts`) already uses `presentationUrl ?? url`, so the raw URL surfaces automatically.
- Add to `.env.example` directly below `USE_VISUAL_DIRECTOR` with a comment:
  ```
  # When "false", page images are persisted without post-processing
  # (no smart crop, no paper fade integration). Reader falls back to raw URL.
  # Default "true" preserves existing pipeline behavior.
  ENABLE_PRESENTATION_POSTPROCESS="true"
  ```
- Log once per page when the flag is read: `[presentation_postprocess] enabled=<true|false> page=<n>`.
- Read the env once at the top of the page loop, not per-page (avoid repeated env reads).

### T3 — Debug endpoint: image prompt trace
Create `app/api/debug/image-prompt/[orderId]/route.ts`:

- `GET` handler. Optional query param `?page=N` (1-indexed). If missing, return all pages.
- Auth: require header `x-generation-secret` matching `process.env.GENERATION_SECRET` (follow existing patterns in `app/api/debug/visual-director/route.ts` if that's how that endpoint authenticates; otherwise pick the closest existing dev-only auth pattern).
- Reads from DB (no regeneration, no model calls):
  - `Order` for `illustrationStyle`
  - `GeneratedBook` → `BookPage` → `ImageAsset` for stored prompt + URLs
- Returns JSON:
  ```json
  {
    "orderId": "...",
    "styleId": "soft_hand_drawn_storybook",
    "pages": [
      {
        "pageNumber": 1,
        "prompt": "<full stored prompt>",
        "promptLength": 1234,
        "rawUrl": "...",
        "presentationUrl": "...",
        "isPostProcessed": true
      }
    ]
  }
  ```
- Returns 404 if order or book not found, 401 if auth missing/wrong.
- Should be ≤ 100 lines including imports.

### T4 — Inline documentation comments
Add a top-of-file comment block (no logic changes):

**`backend/providers/image.ts`** — at the top of the file, after the existing JSDoc:
```ts
/**
 * PIPELINE STATE NOTE (Phase 1 cleanup, [date]):
 * Two prompt-assembly paths coexist in this file:
 *  - LEGACY: buildImagePrompt() from lib/promptBuilder.ts — assembles the full
 *    STYLE_CONTRACT block (style optionBlock + rules + character lock + scene + negatives).
 *    ~1000+ words per call. Used when USE_VISUAL_DIRECTOR is unset or "false".
 *  - VISUAL_DIRECTOR: composeVisualDirectorPrompt() from lib/visualDirector.ts —
 *    shorter prompt (~300 words) gated by USE_VISUAL_DIRECTOR="true".
 *
 * In production today, USE_VISUAL_DIRECTOR is "false" by default → the LEGACY
 * path is what real users get. The visual-director path is opt-in only.
 *
 * Future phase will consolidate to one path. For now: do not change defaults.
 * Inspect which path actually ran via the [image_pipeline_path] log line.
 */
```

**`lib/styles.ts`** — at the top, after the existing JSDoc:
```ts
/**
 * STYLES STATE NOTE (Phase 1 cleanup, [date]):
 * Two active styles for new books: SOFT_HAND_DRAWN_STORYBOOK, EXPRESSIVE_PAINTERLY_STORYBOOK.
 * The DB enum (IllustrationStyle) still has three values including legacy
 * `realistic_illustrated`, which is silently routed to SOFT_HAND_DRAWN_STORYBOOK.
 * LEGACY_STYLE_INPUT_MAP retains 30+ aliases for in-flight orders / safety;
 * a future phase will trim this once a one-time DB audit confirms which values
 * actually appear. Do not trim entries in this phase.
 */
```

### T5 — Delete root junk
Delete (do NOT modify, do NOT move):
- `tmp_storyboard_run.json`
- `story-output.json`

Before deleting each file, run a grep for the filename in the repo (excluding `node_modules` and `.git`) to confirm no code imports/reads them. If any reference is found, do NOT delete — report it instead.

## Safety
- Zero prompt text changes (`promptBuilder.ts`, `visualDirector.ts`, `styles.ts` content stays byte-identical except for the doc comment block at the top of `styles.ts`).
- Zero model changes.
- Zero DB migrations.
- Zero changes to flag defaults: `USE_VISUAL_DIRECTOR` stays `"false"`; new flag `ENABLE_PRESENTATION_POSTPROCESS` defaults to `"true"` (= current behavior).
- Reader / read-v2 unchanged.
- Checkout / payment / order locking untouched.
- Resemblance / character anchor systems untouched.
- All current behavior preserved unless explicitly opted-out via the new env var.

## Acceptance criteria
- `npm run build` passes.
- `tsc --noEmit` passes (or repo equivalent type check).
- No new ESLint errors in changed files.
- For an existing order, `GET /api/debug/image-prompt/<orderId>?page=1` (with valid auth header) returns the stored prompt and URLs.
- The `[image_pipeline_path]` log line appears once per page generation, with correct `path` and `postProcess` fields.
- Setting `ENABLE_PRESENTATION_POSTPROCESS=false` and triggering a generation results in `presentationUrl` being `null` on the new `ImageAsset` rows (verify by reading the DB row directly or via the debug endpoint).
- The two junk files are gone; `git status` shows them deleted; no other deletions.
- The two doc comment blocks (in `image.ts` and `styles.ts`) compile cleanly.

## Future phases (NOT in this task — for orientation only)
- Phase 2: prompt minimalism A/B test (still no model change, no LoRA).
- Phase 3: pick one prompt path, remove the other.
- Phase 4: reference packs + style anchor.
- Phase 5: LoRA training per style.
- Phase 6: real Stage D storyboard implementation, replacing the phantom type.

Do not anticipate any of these in Phase 1 work. If during implementation an opportunity to make a forward-compatible change presents itself (e.g. a small refactor that would help Phase 2), note it in the "Risks / open questions" section of the return format — do not implement it.

## Return format

Reply with:

- **GO / NO-GO** decision (NO-GO if anything in this task can't be completed safely)
- **Files changed** — list with one-line description per file
- **New files created** — list with full path
- **Files deleted** — list with full path
- **How to test the diagnostic** — exact commands (curl / npm / etc.) to verify each acceptance criterion
- **Confirmed by inspection** — answer these three with code references:
  1. In current production config (no env overrides), which prompt path runs by default? (cite file:line)
  2. Is post-process applied to all images by default before this PR? (cite file:line)
  3. What is the approximate length (in characters) of the final prompt sent to Replicate for a typical page in the legacy path? (you may estimate by composing the strings from `getPositiveStylePromptBlock` for one style + the strict directive + consistency reinforcement)
- **Risks / open questions** — anything you noticed but did not change, or any place the doc comments may go stale soon
