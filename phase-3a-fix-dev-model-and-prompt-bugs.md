# Phase 3a — Fix dev model + prompt assembly bugs

## Principle
Three independent bugs combine to make every dev-generated book look like a generic character sheet:

1. **Dev model is `bytedance/sdxl-lightning-4step`** — a 4-step "preview" model. Not Flux. Doesn't honor long prompts, doesn't accept reference images, produces generic anime-cute output regardless of prompt content.
2. **Character lock builder has a copy-paste bug** — the `Hair` field receives the same fallback text as `Age impression`. Possibly other fields also have generic boilerplate instead of structured character data.
3. **Visual Director's "visual notes" field is polluted** — instead of receiving page-specific stage-4 visual notes, it receives the full `STYLE LOCK` block. Style is now duplicated in the prompt and per-page notes are lost.

This task fixes all three. **No behavior change in production unless explicitly opted in via env override.** The dev change is the riskiest one and ships behind a clear default.

## Goal
After this phase:
- A book generated in dev (`npm run dev`) uses **`black-forest-labs/flux-dev`** by default — real Flux, LoRA-compatible, ~$0.025/image. Production stays on `flux-2-pro`.
- The prompt sent to Flux carries a clean character lock with field-appropriate values (or correct fallbacks — never another field's text).
- The visual director's "visual notes" field carries genuine stage-4 visual notes for that page, not the style block.

## Scope

### In scope
- Single env-default change: `REPLICATE_IMAGE_MODEL_DEVELOPMENT` from SDXL Lightning to `black-forest-labs/flux-dev`.
- Surgical fix in `lib/character-lock.ts` (or wherever `MAIN CHARACTER LOCK` is built — verify): correct field assignment so `Hair`, `Skin tone`, `Facial features`, `Eyes`, `Clothing` each get their own field's content (or a field-specific neutral fallback), not the age fallback.
- Surgical fix in the call site that passes `stage4Prompt` to `composeVisualDirectorPrompt` (in `backend/providers/image.ts` — verify): ensure the stage-4 visual notes string is what's passed, not the assembled style block.
- Update `.env.example` with a comment about the dev model change.
- Add one log line per generation showing the resolved character-lock fields, for verification.

### Out of scope — DO NOT TOUCH
- Production model (`REPLICATE_IMAGE_MODEL_PRODUCTION` stays `black-forest-labs/flux-2-pro`).
- The structure of `lib/visualDirector.ts` itself — only the inputs.
- The structure of `lib/styles.ts` — no style content edits.
- LoRA, IP-Adapter, ControlNet — out.
- The phantom `PageVisualStoryboard` — leave.
- DB schema, migrations, enums.
- Reader / wizard / payment / story generation logic.
- The Phase 1 dual-prompt-path situation. Same flag (`USE_VISUAL_DIRECTOR`) controls which path runs.
- The 38 unrelated uncommitted files in the working tree.

## Tasks

### T1 — Switch dev default model

In `.env.example`:

```
# Image model routing:
# - if IMAGE_MODEL_OVERRIDE is set, it takes strict priority in every environment
# - otherwise development mode uses REPLICATE_IMAGE_MODEL_DEVELOPMENT (Flux dev — LoRA-compatible)
# - production mode: uses REPLICATE_IMAGE_MODEL_PRODUCTION
IMAGE_MODEL_OVERRIDE="" # optional, e.g. flux_pro
REPLICATE_IMAGE_MODEL_DEVELOPMENT="black-forest-labs/flux-dev"
REPLICATE_IMAGE_MODEL_PRODUCTION="black-forest-labs/flux-2-pro"
```

In `lib/replicate.ts` (verify file name — search for `resolveReplicateImageModel`):
- The dev fallback should resolve to `black-forest-labs/flux-dev` if the env var is unset.
- Ensure no hard-coded SDXL Lightning ID remains in source — grep for `sdxl-lightning` and remove any literal references that aren't comment/example.
- The `[ImageGuard]` log already exists; verify it now reports `model=black-forest-labs/flux-dev` for the dev path after this change.

**Migration note:** if any code path expects SDXL-specific behavior (e.g. "SDXL does not support reference images" branching), keep the branching logic — Flux dev does support reference images, so passing them through is the correct behavior. The `[image_reference] SDXL does not support reference images` log line should now stop appearing for dev runs.

### T2 — Fix character lock field assignment bug

Current broken output (from production logs):
```
MAIN CHARACTER LOCK: יובל is the same girl in every image.
Age impression: A girl named יובל, approximately 7 years old, warm and friendly appearance.
Hair: A girl named יובל, approximately 7 years old, warm and friendly appearance.
Skin tone: consistent skin tone.
Facial features: consistent face shape and features.
Eyes: consistent eye shape and color.
Clothing: same clothing colors and silhouette.
```

Bug: `Hair` field repeats `Age impression`. Likely a copy-paste error where the same fallback string was reused.

Find the builder. Likely candidates: `lib/character-lock.ts`, or a helper in `backend/providers/image.ts` that constructs `MAIN CHARACTER LOCK:` text. Search for `"MAIN CHARACTER LOCK"` literal.

Fix:
- Each field must derive from the corresponding source data on `Order.characterAnchors` / `HeroVisualLock` (whichever the existing code uses):
  - `Age impression` ← `ageImpression` (or equivalent)
  - `Hair` ← `hair` description
  - `Skin tone` ← `skinTone`
  - `Facial features` ← `faceShape`
  - `Eyes` ← `eyes`
  - `Clothing` ← `clothing`
- If a specific field is empty/missing, use a **field-appropriate** neutral fallback, NOT the age fallback:
  - Hair: `"natural age-appropriate hair, consistent across pages"`
  - Skin tone: `"natural skin tone, consistent across pages"`
  - Eyes: `"natural expressive eyes, consistent shape and color"`
  - Clothing: `"clothing should remain consistent across pages"`
  - etc.
- No field's fallback may be another field's value.

**Verification log** (new, INFO level, once per page):
```
[character_lock_resolved] orderId=<id> page=<n> hasAge=<bool> hasHair=<bool> hasSkin=<bool> hasFace=<bool> hasEyes=<bool> hasClothing=<bool>
```

This log lets us see at a glance whether structured character data is actually being threaded through.

### T3 — Fix Visual Director "visual notes" pollution

Current broken output:
```
Page 2 of 8: Stage a concrete scene based on this story beat "<page text>"
and these visual notes "STYLE LOCK: STYLE OPTION 2: internal_id:
expressive_painterly_storybook USER_LABEL_HE: איור צבעוני וקומי
STYLE LOCK — EXPRESSIVE PAINTERLY STORYBOOK: A bold, playful..."
```

The string starting `"STYLE LOCK: STYLE OPTION 2..."` is the full positive style prompt block, not stage-4 visual notes. It's being passed in as `stage4Prompt` to `composeVisualDirectorPrompt`.

Find the call site. Search for `composeVisualDirectorPrompt(` in `backend/providers/image.ts`. Look at how `stage4Prompt` is being populated — likely via a helper like `buildVisualDirectorModelInput`.

Fix:
- `stage4Prompt` should receive the **page-level imagePrompt / visual notes** generated in stage 4 of the story pipeline (whichever field on `BookPage` or the image-input contains the per-page visual cue text, e.g. `input.pagePrompt` after extraction of just the scene component, or similar).
- It must NOT receive the assembled style block. The style block belongs in `selectedStyle` and is rendered by `resolveStyleSentence` separately. Including it again as `stage4Prompt` duplicates it AND drowns out the actual page notes.
- If no per-page stage-4 visual notes exist, pass empty string. The Visual Director already handles that correctly (drops the `and these visual notes "..."` clause).

**Verification log** (new, DEBUG level, once per page):
```
[visual_director_inputs] page=<n> stage4PromptLen=<chars> stage4PromptHead=<first 80 chars>
```

If `stage4PromptHead` starts with `"STYLE LOCK"`, `"STYLE OPTION"`, or similar style-block markers, the bug is still there.

## Safety
- Default behavior in **production** unchanged: prod model still resolves to `flux-2-pro`.
- The dev model change is the only behavior change. Mitigation:
  - Document in commit message that dev cost goes from ~$0.005/book to ~$0.20/book.
  - Anyone running unconstrained dev tests is now spending more — this is a deliberate trade for usable output.
- No DB writes added.
- No new dependencies.
- The two new log lines are pure observability — no flow impact.
- All existing logs continue to fire.
- `npm run build` must pass.
- `read-v2` rendering unchanged.

## Acceptance criteria
- `npm run build` passes.
- `tsc --noEmit` passes (or repo equivalent).
- Generating a new book with default dev env results in `[image_pipeline_path] ... model=black-forest-labs/flux-dev` (NOT sdxl-lightning).
- The new `[character_lock_resolved]` log line appears once per page.
- The new `[visual_director_inputs]` log line shows `stage4PromptHead` that does NOT start with `"STYLE LOCK"` or `"STYLE OPTION"`.
- The `MAIN CHARACTER LOCK:` block in the final prompt has the `Hair:` line different from the `Age impression:` line. If both fields are present in the source data, both surface their own content. If `Hair` is missing, the fallback is the field-specific neutral fallback above, not the age fallback.
- Existing read-v2 behavior unchanged — the reader still loads books and shows pages.
- No external API calls in any new test.

## Return format

Reply with:
- **GO / NO-GO** decision
- **Files changed** — full list
- **Where character lock is built** — file + function name + line range
- **Where visual director inputs are assembled** — file + function name + line range
- **Sample new log output** — paste the new `[character_lock_resolved]` and `[visual_director_inputs]` lines from a real generation run (or from a unit test with mocked data)
- **Confirmed** — answer these:
  1. Does `flux-dev` accept reference images via the existing `generateReplicateImage` path? (cite where reference image handling lives in `lib/generate-image.ts`)
  2. After T2, what does the `MAIN CHARACTER LOCK:` block look like for a child with structured anchor data? Paste an example.
  3. After T3, what does the page-2 prompt's `Stage a concrete scene...` clause look like? Paste an example.
- **Risks / open questions** — anything you noticed but did not change. Specifically: if the `MAIN CHARACTER LOCK` source data (e.g. `Order.characterAnchors`) is itself empty/generic for most books, that's a deeper issue worth flagging — but do not fix it in this phase.
