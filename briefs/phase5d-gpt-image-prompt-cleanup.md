# Phase 5d — GPT Image Prompt Cleanup (Fix Identical Images)

## Problem

ALL book page images come out looking nearly identical — same composition, same pose, same framing, same camera angle. Despite completely different scene descriptions per page.

## Root Causes (confirmed by GPT Image API analysis)

| Cause | Impact | Description |
|---|---|---|
| `images.edit` with reference photo on every page | **70%** | The edit endpoint treats the reference as a compositional anchor — replicates pose, framing, angle, not just face. Designed for variations/transformations, NOT multi-scene storytelling. |
| Prompt bloat (~5000 chars, 70% identical boilerplate) | **20%** | Model gets "lazy" — optimizes for safe/generic output when overwhelmed. Sweet spot is ~1200-1500 chars. |
| Missing camera/composition instructions | **10%** | Scene descriptions say "what happens" but not "how it looks" — no camera angles, no shot types, no composition verbs. |

## Fix Plan — 5 Changes

### Fix 1: Kill `images.edit` entirely

**File: `lib/generate-image.ts`**

Replace the entire `generateGPTImage` function. Remove the `images.edit` path completely. ALWAYS use `images.generate`.

```typescript
export async function generateGPTImage(input: GenerateGPTImageInput): Promise<GenerateGPTImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY for GPT Image generation');

  const openai = new OpenAI({ apiKey });
  const size = input.size || '1024x1536';
  const quality = input.quality ?? resolveEnvGPTQuality();

  let fullPrompt = input.finalPrompt;
  if (input.negativePrompt) {
    fullPrompt += `\nNo text or letters in the image.`;
  }

  const startMs = Date.now();

  console.info(
    `[GPTImage] model=gpt-image-1 quality=${quality} size=${size} promptLen=${fullPrompt.length}`
  );

  // ALWAYS use images.generate — NEVER images.edit
  // images.edit anchors composition to reference photo, killing scene diversity
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: fullPrompt,
    size: size as never,
    quality: quality as never,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json ?? undefined;
  if (!b64) throw new Error('GPT Image API returned no image data');

  const buffer = Buffer.from(b64, 'base64');
  const durationMs = Date.now() - startMs;

  console.info(
    `[GPTImage] Done in ${durationMs}ms, buffer=${Math.round(buffer.length / 1024)}KB`
  );

  return {
    buffer,
    model: 'gpt-image-1',
    finalPrompt: fullPrompt,
    hasReferencePhoto: false,
    durationMs,
  };
}
```

**Also update the interface** — remove `referenceImageUrl` field from `GenerateGPTImageInput`:

```typescript
export interface GenerateGPTImageInput {
  finalPrompt: string;
  negativePrompt?: string;
  // referenceImageUrl REMOVED — we never use images.edit anymore
  size?: '1024x1024' | '1024x1536';
  quality?: 'low' | 'medium' | 'high';
}
```

**Update `generateWithGPTImage` in `image.ts`** — stop passing referenceImageUrl:

Find the call to `generateGPTImage` (around line 1730) and remove the `referenceImageUrl` param:

```typescript
const result = await generateGPTImage({
  finalPrompt: prompt,
  negativePrompt: 'text, letters, words, numbers, watermark, signature, frame, border',
  // referenceImageUrl REMOVED
  size: size as '1024x1024' | '1024x1536',
  quality,
});
```

**Why no reference at all?** `gpt-image-1` is good enough at character consistency through text description alone — especially with fixed clothing. The edit endpoint destroys scene diversity which is far more important than pixel-perfect face matching.

---

### Fix 2: Store raw scene separately in pipeline

**File: `backend/providers/pipeline.ts`**

**2a.** Add `rawScenePrompt` to `IllustrationShot` interface (around line 240):

```typescript
export interface IllustrationShot {
  pageNumber:   number;
  imageSubject: string;
  shotType:     ShotType;
  action:       string;
  mustExclude:  string[];
  imagePrompt:  string;
  rawScenePrompt?: string;  // clean LLM scene, no locks/renderBrief
}
```

**2b.** In `applyStage4PromptContract` (line ~2715), save raw scene BEFORE wrapping:

In the `return shots.map((shot) => { ... })` block, change:

```typescript
// BEFORE:
const base = `${consistencyLock}\n\n${shot.imagePrompt}${moodSuffix} ${renderBrief}`.trim();
return {
  ...shot,
  imagePrompt: base,
};
```

To:

```typescript
// AFTER: save raw scene before wrapping
const rawScene = shot.imagePrompt;  // clean 4-5 sentence scene from LLM
const base = `${consistencyLock}\n\n${shot.imagePrompt}${moodSuffix} ${renderBrief}`.trim();
return {
  ...shot,
  imagePrompt: base,        // wrapped version for Flux/Replicate (Style 02)
  rawScenePrompt: rawScene,  // clean version for GPT Image (Style 01)
};
```

**2c.** Pass `rawScenePrompt` through assembly.

Find the `StoryPage` type (or wherever pages are assembled, around line 2998) and add:

```typescript
rawScenePrompt: s?.rawScenePrompt ?? '',
```

---

### Fix 3: Rewrite `buildGPTImagePrompt` — scene-first, ~1200 chars total

**File: `backend/providers/image.ts`**

Replace the entire `buildGPTImagePrompt` function (line ~1644):

```typescript
function buildGPTImagePrompt(input: ImageInput): string {
  const isPreview = !!input.isDirectionPreview;

  // ── SCENE (first, most important — ~400-600 chars) ──
  const rawScene = (input.rawScenePrompt ?? '').trim();
  const stage4 = (input.stage4Prompt ?? '').trim();
  const fallbackScene = extractSceneCore(input.pagePrompt || '').trim();
  const sceneDesc = rawScene || stage4 || fallbackScene || (input.bookPageText ?? '').trim() || '';

  // Trim to max 600 chars — GPT Image works best with concise scenes
  const trimmedScene = sceneDesc.length > 600
    ? sceneDesc.slice(0, 597).replace(/\s\S*$/, '...')
    : sceneDesc;

  // ── CHARACTER DNA (once, short, ~150 chars) ──
  // Use EXACT same phrasing every page — consistency comes from repetition
  const charParts: string[] = [];
  if (input.childDescription) {
    charParts.push(`Main character: ${input.childDescription}`);
  }
  if (input.companion) {
    const comp = input.companion;
    charParts.push(`Companion: ${comp.name}, ${comp.visualDescription}`);
  }
  const characterBlock = charParts.length > 0 ? charParts.join('\n') : '';

  // ── COMPOSITION (critical for diversity — ~80 chars) ──
  const compParts: string[] = [];
  if (input.pageNumber && input.totalPages) {
    compParts.push(`Page ${input.pageNumber} of ${input.totalPages}. Use a unique composition, different camera angle, and different character pose.`);
  }
  if (input.textZone) {
    const tzMap: Record<string, string> = {
      top_clear: 'Top 40% must be open light space for text.',
      bottom_clear: 'Bottom 30% must be open for text.',
      left_clear: 'Left 30% open for text.',
      right_clear: 'Right 30% open for text.',
      center_clear: 'Center area open for text.',
    };
    const tzHint = tzMap[input.textZone];
    if (tzHint) compParts.push(tzHint);
  }
  const compositionBlock = compParts.join(' ');

  // ── STYLE (short — ~300 chars, NOT 1500) ──
  const styleBlock = isPreview
    ? 'Soft Pixar-style watercolor illustration, light cream background, gentle warm lighting, modern children\'s book. No text or letters.'
    : `Soft Pixar-style watercolor illustration for a children's book.
Natural-looking child with realistic proportions, rendered softly — not photorealistic.
Light cream/white watercolor background — NOT golden, NOT amber.
Soft natural lighting, cheerful and clear.
Characters in lower 60%, background fades to near-white washes.
No text, no letters, no UI elements.`;

  // ── ASSEMBLE: Scene → Character → Composition → Style ──
  const parts = [
    trimmedScene,
    characterBlock,
    compositionBlock,
    styleBlock,
  ].filter(Boolean);

  const fullPrompt = parts.join('\n\n');

  console.log(`[gpt_prompt_v3] page=${input.pageNumber} rawScene=${rawScene.length} stage4=${stage4.length} sceneUsed=${trimmedScene.length} final=${fullPrompt.length}`);
  console.log(`[gpt_scene] page=${input.pageNumber} "${trimmedScene.slice(0, 200)}"`);
  return fullPrompt;
}
```

**Key changes:**
- Scene FIRST (most important to GPT Image)
- Character DNA ~150 chars, ONCE, exact same string every page
- Style block ~300 chars (was ~1500) — 6 lines, not 25
- No locks, no render briefs, no repeated character descriptions
- Total: ~1000-1300 chars (was ~5000)

---

### Fix 4: Add `rawScenePrompt` to ImageInput and pass it through

**File: `backend/providers/image.ts`**

**4a.** Add to `ImageInput` interface (near line ~260):

```typescript
rawScenePrompt?: string | null;
```

**4b.** In the generation loop (around line 2470-2477), pass rawScenePrompt:

Find `visualDirectorPageFields` and change `stage4Prompt` to prefer rawScenePrompt:

```typescript
const visualDirectorPageFields = {
  bookPageText: page.bookPageText ?? null,
  stage4Prompt: page.rawScenePrompt || cleanedImagePrompt,  // prefer raw scene
  rawScenePrompt: page.rawScenePrompt || null,
  childFirstName: config.childName ?? null,
  expectedCharacterNames: pageExpectedDisplayNames,
};
```

**4c.** Also pass it in ALL `generateImage()` calls in the loop. Search for every `generateImage({` call in the generation function and add `rawScenePrompt`:

```typescript
rawScenePrompt: page.rawScenePrompt || null,
```

There are ~3-4 places where `generateImage` is called in the loop (anchor election, regular page, warning candidate, retry). Add it to all of them.

---

### Fix 5: Stop passing reference images to GPT Image path

**File: `backend/providers/image.ts`**

In `generateWithGPTImage` (around line 1725), stop reading referenceImages:

```typescript
// BEFORE:
const referenceImageUrl = input.referenceImages?.[0] ?? undefined;

// AFTER:
// Reference images no longer used — images.generate only
const referenceImageUrl = undefined;
```

OR simply remove the line and the variable entirely. The `generateGPTImage` function no longer accepts `referenceImageUrl` after Fix 1.

**NOTE:** The reference images are still used by the Replicate/Flux path (Style 02) — do NOT remove them from the main generation loop or from `generateImage()`. Only suppress them inside `generateWithGPTImage`.

---

## Character Consistency Strategy (replaces reference photo)

Since we're removing `images.edit`, character consistency now relies on text description. This works well with `gpt-image-1` IF we follow these rules:

### Rule 1: Exact same character string every page

The `childDescription` and companion description must be **identical strings** on every page. Never paraphrase. Never use "the girl" or "a child" — always the full description.

### Rule 2: Clothing is the strongest anchor

Clothing descriptions are MORE reliable than face descriptions for consistency. Ensure `childDescription` includes specific clothing:

**Current** (probably something like):
```
A 5-year-old girl with curly dark brown hair and big brown eyes
```

**Better**:
```
A 5-year-old girl with curly dark brown shoulder-length hair, olive skin, big brown eyes, wearing a yellow dress with white polka dots and red shoes
```

The clothing should be set once in the VisualBible/character creation stage and never changed.

**Where to change:** The `childDescription` is likely built in the pipeline or the generation config. Find where it's constructed and ensure it includes clothing.

Check these locations:
- `config.childDescription` in image.ts generation loop
- `heroVisualLock` in pipeline.ts — should include clothing
- `brain.visuals.heroVisual` — should include clothing

If clothing isn't currently included, add it. The VisualBible stage should lock clothing as part of the hero description.

---

## Execution Order

1. **Fix 1** — Kill `images.edit` in `lib/generate-image.ts` (biggest impact, safest change)
2. **Fix 5** — Stop passing reference images in `image.ts` `generateWithGPTImage`
3. **Fix 3** — Rewrite `buildGPTImagePrompt` (shorter, scene-first)
4. **Fix 2** — Store `rawScenePrompt` in pipeline
5. **Fix 4** — Wire `rawScenePrompt` through ImageInput
6. **Test** — generate a book and verify pages look different

Fixes 1+5+3 can be done FIRST as a quick test — they don't require pipeline changes. If scene diversity improves dramatically with just prompt cleanup + no edit, then Fixes 2+4 are a bonus.

## Files to Change

| File | Change | Risk |
|---|---|---|
| `lib/generate-image.ts` | Remove `images.edit` path, always use `images.generate` | Low — simpler code |
| `backend/providers/image.ts` | Rewrite `buildGPTImagePrompt`, stop passing referenceImageUrl, add rawScenePrompt | Medium — core prompt change |
| `backend/providers/pipeline.ts` | Save `rawScenePrompt` before wrapping with locks | Low — additive only |

## What NOT to Change

- `composeStoryboardDrivenPagePrompt()` — still needed for Flux/Replicate (Style 02)
- `applyStage4PromptContract` wrapping logic — still needed for Flux path
- Cover generation — separate flow, uses its own prompt builder
- Replicate/Flux generation path — `generateReplicateImage` unchanged
- Anchor election logic for Replicate — only affects GPT Image path

## Expected Result

| Metric | Before | After |
|---|---|---|
| Prompt length | ~5000 chars | ~1200 chars |
| Unique scene content | ~30% | ~80% |
| Character descriptions | 4x repeated | 1x |
| Reference photo | Every page (edit endpoint) | None (generate endpoint) |
| Style instructions | 25 bullet points (~1500 chars) | 6 lines (~300 chars) |
| API endpoint | `images.edit` | `images.generate` |

## Risk: Character Consistency

Without reference photos, character consistency relies on text only. Mitigations:
- Fixed clothing description ("yellow dress, red shoes") is the strongest anchor
- Exact same character string every page
- `gpt-image-1` is good at text-based consistency for children's illustrations
- If consistency is unacceptable, we can explore a character sheet approach later (generate one reference image, then describe it in text for subsequent pages)

## Cost Impact

Slightly cheaper — `images.generate` doesn't need to download reference photos. Same per-image API cost.
