# Phase 3f — Composition Variety & Scene Fidelity

## Problem Statement

Generated books look repetitive and generic:
- Same compositions across all pages (centered medium shot, eye-level, forest path)
- Images don't match story text
- Same camera angle throughout
- No "wow" factor — no visual variety
- Text overlay fails in both light and dark

## Root Cause

**The pipeline's Stage 4/4B work is discarded before reaching Flux.**

Stage 4B generates excellent per-page composition plans (camera distance, angle, placement,
heroPresence, visualRhythm) with anti-repetition rules. Stage 4 generates rich imagePrompts
with visual hooks, composition, character action, and environment — all incorporating 4B.

But `image.ts` throws it away:

1. `translateSceneForImage()` (line ~402) sends Hebrew text + Stage 4 imagePrompt to
   GPT-4o-mini, but explicitly says: **"Do NOT include camera angles or composition directions."**
   The rich visual hook, camera distance, angle, placement → all stripped.

2. `buildImagePrompt()` (promptBuilder.ts) assembles: textZone + translated scene +
   protagonistLock + entityLock + style. **No camera. No composition type. No placement.**

3. `COMPOSITION_ROTATION` (line ~587) defines 7 composition patterns with `promptDirective`
   strings, but `promptDirective` is **never injected into the Flux prompt** — only logged.

4. The per-page composition plan from Stage 4B (`PageComposition.cameraDistance`,
   `cameraAngle`, `compositionType`, `heroPlacement`, `entityPlacement`, `topTextAreaPlan`,
   `mainIllustrationZone`) reaches Stage 4's `imagePrompt` text but then gets stripped
   by scene translation.

5. Text-safe zone instruction ("top 20-30% calm") exists in Stage 4 prompts but never
   reaches Flux after translation.

## Fix Strategy

### 3f.1 — Inject composition directives into Flux prompt (HIGH IMPACT)

**File: `backend/providers/image.ts`**

After `translateSceneForImage` returns the scene description, append a composition
directive block BEFORE passing to `buildImagePrompt`. This block comes from two sources:

**Source A: Stage 4B composition plan** (already available as `page.composition` or
through `pageIntent`):
```
COMPOSITION: [cameraDistance] shot, [cameraAngle], [compositionType].
CHARACTER PLACEMENT: hero [heroPlacement], entity [entityPlacement].
ILLUSTRATION ZONE: [mainIllustrationZone].
TEXT-SAFE ZONE: top 20-30% of frame must be [topTextAreaPlan] — calm, uncluttered.
```

**Source B: COMPOSITION_ROTATION `promptDirective`** (fallback when Stage 4B data missing):
Already defined but unused. Wire `cv.promptDirective` into the prompt.

**Implementation:**
1. In `buildPromptParts()`, after `translateSceneForImage` returns `scene`:
   - Build a `compositionDirective` string from `input.composition` (Stage 4B data)
   - If no Stage 4B data, use `compositionVariation.promptDirective`
   - Prepend to `scene` before passing to `buildImagePrompt`

2. In `translateSceneForImage()`, REMOVE the instruction "Do NOT include camera angles
   or composition directions" — instead tell the LLM to PRESERVE any camera/composition
   cues from the existing scene description.

### 3f.2 — Fix scene translation to preserve Stage 4 visual hooks

**File: `backend/providers/image.ts`, function `translateSceneForImage`**

Current system prompt tells the LLM to strip camera/composition. Change to:

```
Rules:
- Translate the Hebrew story text into a vivid English scene description
- PRESERVE camera angle and composition cues from the existing scene description
- PRESERVE the visual hook (opening image) from the existing scene description
- Add concrete physical details: body language, facial expressions, spatial relationships
- Include magical/wonder elements appropriate to the story beat
- Keep the scene grounded in the SPECIFIC action described in the Hebrew text
- 80-120 words
- Do NOT add style instructions or "no text" suffixes
```

Also: increase weight of `fallback` (Stage 4 imagePrompt) in the user prompt.
Currently it's just appended as optional context. It should be the PRIMARY source
with Hebrew text as secondary guidance:

```
Existing illustration direction (follow this closely):
"[Stage 4 imagePrompt]"

Hebrew story text for this page:
"[Hebrew text]"

Rewrite the illustration direction as a vivid scene description.
Keep the camera angle, composition, and visual hook intact.
Add emotional detail from the Hebrew text.
```

### 3f.3 — Add text-safe zone enforcement to final prompt

**File: `lib/promptBuilder.ts`, function `buildImagePrompt`**

Add a mandatory text-safe zone sentence to `finalPrompt` assembly:

```typescript
const textSafeZone = 'The top 20-30% of the image must be a calm, uncluttered area ' +
  '(soft sky, gentle gradient, muted wall, open space) suitable for text overlay. ' +
  'No faces, hands, important objects, or detailed patterns in this zone.';
```

Insert this BEFORE the style sentence in the finalPrompt array.

### 3f.4 — Wire Stage 4B data through to image generation

**File: `backend/providers/image.ts`**

The `ImageInput` interface needs new optional fields:
```typescript
composition?: {
  cameraDistance: 'close' | 'medium' | 'wide';
  cameraAngle: string;
  compositionType: string;
  heroPlacement: string;
  entityPlacement: string;
  topTextAreaPlan: string;
  mainIllustrationZone: string;
};
```

In `generateAllPageImages` (the main orchestrator), pass `page.composition` through
to the `ImageInput` so `buildPromptParts` can access it.

Check: the `pageStoryboard` object already has these fields from the pipeline.
Verify the exact field names and wire them through.

## Verification

After implementation, generate one test book and check:
1. Console logs show different `cameraDistance` values across pages (not all "medium")
2. Final Flux prompts contain composition directives (grep for "COMPOSITION:" in logs)
3. Generated images show variety: at least one wide shot, one close-up, one medium
4. Text zone top area is visibly calmer than rest of image
5. Images visually relate to the Hebrew text on that page

## Files to modify

| File | Changes |
|------|---------|
| `backend/providers/image.ts` | Wire composition data to prompt, fix translateScene, add composition directive |
| `lib/promptBuilder.ts` | Add text-safe zone sentence to final prompt assembly |

## Priority

This is the HIGHEST priority fix. Without it, every other visual improvement
(LoRA, style consistency, reader polish) is building on a broken foundation.
The pipeline already does the hard work — we just need to stop throwing it away.

## Risk

LOW — all changes are in prompt assembly. No DB changes, no API changes, no reader changes.
The composition data already exists in the pipeline; we're just passing it through.
