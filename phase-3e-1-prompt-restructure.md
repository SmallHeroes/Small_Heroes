# Phase 3e.1 — Prompt Restructure: scene-first, text-zone-aware, compact

## Principle
Flux reads ~200 words from the prompt. Today the actual scene description lands around word 500+, buried under STYLE_CONTRACT (~300 words), CHARACTER_RESEMBLANCE_GUIDANCE (~200 words), and boilerplate. The text zone directive is appended at the very end (~word 1500). The model literally never sees what the image should depict or where to leave space for text.

This phase inverts the prompt: scene and text zone go first, character lock second, style hint last. Total prompt stays under 400 words. No new LLM calls — pure restructure of existing assembly code.

## Goal
After this phase, the first 200 words Flux reads contain: (1) what is happening in the scene, (2) where text overlay will go, (3) what the main character looks like. Style and composition become lightweight suffixes.

## Scope

### In scope
- `backend/providers/image.ts` — `buildPromptParts`, `generateWithReplicate` post-assembly (strictDirectiveBlock, textZoneDirective append, consistencyReinforcement)
- `lib/promptBuilder.ts` — `buildImagePrompt` (complete rewrite of prompt assembly order + trimming)
- `backend/providers/image.ts` — `extractSceneCore` (remove entirely — no longer needed after T4)
- `backend/providers/image.ts` — `textZoneDirective` (stays, but moves from end-append to inline in prompt)
- `backend/providers/image.ts` — `buildCoverPrompt` (align to use same builder)

### Out of scope — DO NOT TOUCH
- `backend/providers/pipeline.ts` — no changes to story/storyboard generation
- LLM calls — no new LLM translation step (that's Phase 3e.2)
- `lib/styles.ts` — style registry stays as-is
- `lib/visualDirector.ts` — VD path stays off, untouched
- Reader CSS, layout templates, fonts
- Resemblance pipeline, anchor election
- LoRA, wizard, payment, audio

## Current Prompt Assembly Chain (for orientation)

Today, for a legacy-path interior page, the prompt is built in 4 layers:

**Layer 1 — pipeline.ts** Stage 4C produces `page.imagePrompt` which often contains PROMPT_CONTRACT pollution (800+ chars of boilerplate injected by `applyStage4PromptContract`).

**Layer 2 — image.ts `buildPromptParts`** (line ~1123):
- Calls `extractSceneCore(input.pagePrompt)` which strips "no text..." suffix using greedy regex (can return empty string)
- Builds `sceneParts[]` array with 10+ items: scene core, direction tone, page intent, composition rules, composition variation, reference priority, warning lock, portrait contract, template composition, style nudge, continuity, generic children's book line
- Joins all with `, ` into one mega-string → this becomes `pageSceneIntent`
- Passes to `buildImagePrompt` as the scene field

**Layer 3 — promptBuilder.ts `buildImagePrompt`** (line ~38):
- Assembles final prompt in this order:
  1. `STYLE_CONTRACT:` + full style block (~300 words)
  2. `CHARACTER_RESEMBLANCE_GUIDANCE:` + character block (~200 words)
  3. `PAGE_SCENE_INTENT:` + the mega-string from Layer 2
  4. `BOOK_ILLUSTRATION_PLACEMENT:` + placement guidance
  5. `GLOBAL_NEGATIVE_CONSTRAINTS:` + no-text list

**Layer 4 — image.ts `generateWithReplicate`** (line ~1464):
- Wraps result with `withConsistencyReinforcement` (~30 more lines)
- Appends `strictDirectiveBlock` with `buildProtagonistVisualLock` + MANDATORY RENDER CONSTRAINTS (~15 lines)
- Appends `textZoneDirective` at the very end

Total: ~1500 words. Scene description is at word ~500. Text zone is at word ~1500.

## Tasks

### T1 — Rewrite `buildImagePrompt` in `lib/promptBuilder.ts`: scene-first, compact

Replace the current `buildImagePrompt` function. The new prompt order must be:

```
1. TEXT ZONE (from textZoneDirective — 1–2 sentences)
2. SCENE (the actual scene description — this is the most important part)
3. CHARACTER (protagonist visual lock — compact, one line)
4. ENTITY (companion visual lock — compact, one line, if present)
5. STYLE (one sentence style hint, not the full STYLE_CONTRACT)
6. NEGATIVE (kept as separate negativePrompt, NOT in the main prompt body)
```

New function signature — add parameters for text zone and entity lock:

```typescript
export interface BuildPromptInput {
  styleIdInput: string;
  sceneDescription: string;      // clean scene text (no boilerplate)
  textZoneDirective: string;     // output of textZoneDirective() — can be empty
  protagonistLock: string;       // compact character description (1 line)
  entityLock: string;            // compact entity description (1 line, can be empty)
  globalNegativeConstraints?: string[];
}
```

The `finalPrompt` must follow this template (target: 250–400 words total):

```
[textZoneDirective, if non-empty — 2 sentences max]

[sceneDescription — this is the heart of the prompt, 50-150 words]

Main character: [protagonistLock — one dense sentence, 20-40 words]
[entityLock if present — one dense sentence, 20-40 words]

Style: [single sentence from resolveStyleSentence() in visualDirector.ts — ~20 words]. Full-bleed illustration for a children's picture book page, portrait 2:3.
```

Do NOT include any of the following in the main prompt body (they bloat without benefit for Flux):
- `STYLE_CONTRACT` / `STYLE_SELECTION_SYSTEM` (the full multi-paragraph style block)
- `CHARACTER_RESEMBLANCE_GUIDANCE` header
- `BOOK_ILLUSTRATION_PLACEMENT` block
- `REFERENCE_RESEMBLANCE_GUIDELINE` block
- `CHARACTER_CONSISTENCY_GUIDELINE` block
- `compositionVariation` structured block (cameraDistance, cameraAngle, etc.)
- `portrait page composition contract` block
- `MANDATORY RENDER CONSTRAINTS` block
- `STRICT_TEXT_EXCLUSION_BLOCK` (keep in negative prompt only)

The negative prompt stays as-is (style negatives + no-text constraints).

Import `resolveStyleSentence` from `lib/visualDirector.ts` for the single-line style hint. That function already exists and produces a compact one-sentence style description.

### T2 — Rewrite `buildPromptParts` in `image.ts`: clean assembly, no multi-layer wrapping

Replace the current `buildPromptParts` function (line ~1123). The new version:

1. Extract scene: `const scene = extractSceneCore(input.pagePrompt)` — still needed for now since pipeline.ts still pollutes. Will be removed in 3e.2 when pipeline is cleaned.

2. Build protagonist lock as ONE sentence (not the structured `faceShape=X; hair=Y` format):
   ```typescript
   const protagonistLock = buildCompactProtagonistLock({
     childName: input.childFirstName,
     heroVisualLock: input.heroVisualLock,
     childDescription: input.childDescription,
   });
   // Target output: "Maya, a 4-year-old girl with curly dark brown hair, warm brown skin, round face, large dark eyes, wearing a purple dress"
   ```

3. Build entity lock as ONE sentence:
   ```typescript
   const entityLock = input.entityVisualLock
     ? `Companion: ${input.entityVisualLock.shape}, ${input.entityVisualLock.color}, ${input.entityVisualLock.proportions} proportions, ${input.entityVisualLock.expressiveStyle} expression style`
     : '';
   ```

4. Get text zone directive: `const zone = textZoneDirective(input.textZone, normalizedOverlayTextLength(input.bookPageText))`

5. Call the new `buildImagePrompt`:
   ```typescript
   return buildImagePrompt({
     styleIdInput: input.illustrationStyle,
     sceneDescription: scene,
     textZoneDirective: zone,
     protagonistLock,
     entityLock,
     globalNegativeConstraints: [NO_TEXT_LOCK],
   });
   ```

### T3 — New function `buildCompactProtagonistLock` in `image.ts`

Replace the current `buildProtagonistVisualLock` (line ~873) with a new function that produces a SINGLE natural-language sentence instead of the current structured format.

Current output (bad — structured, ~120 words):
```
MAIN CHARACTER LOCK: Maya is the same girl in every image. Age impression: young child around 4-5 years old. Hair: natural age-appropriate hair, consistent across pages. Skin tone: natural skin tone, consistent across pages. Facial features: natural child facial features, consistent across pages. Eyes: natural expressive eyes, consistent shape and color. Clothing: clothing should remain consistent across pages. Keep the same child across all pages with no identity drift.
```

New output (good — one sentence, ~30 words):
```
Maya, a 4-year-old girl with [hair from heroVisualLock.hair], [skinTone from heroVisualLock.skinTone], [faceShape], [eyes], wearing [clothing]
```

Rules:
- If `heroVisualLock` fields contain actual visual data (not just "natural age-appropriate..."), use them
- If a field is empty or contains only the vague fallback text (check for "consistent across pages", "natural", "age-appropriate" — these are the default fallbacks from `extractVisualPhrase`), SKIP that field entirely rather than including vague text
- Always include child name and age (from `ageImpression` or `childDescription`)
- Always include gender (inferred via existing `inferGenderFromText`)
- Keep the existing `extractVisualPhrase` helper and `inferGenderFromText` — just change how results are assembled
- Log the compact lock: `[protagonist_lock_compact] orderId=X page=Y lock="<the sentence>"`

### T4 — Clean up `generateWithReplicate` post-assembly

In `generateWithReplicate` (line ~1464), the post-assembly currently appends 3 blocks AFTER `buildImagePrompt` returns:

1. `withConsistencyReinforcement` (line 1493) — **REMOVE**. Character lock is now in the prompt from T1.
2. `strictDirectiveBlock` with `buildProtagonistVisualLock` + MANDATORY RENDER CONSTRAINTS (line 1499-1516) — **REMOVE**. Protagonist lock is now in the prompt from T2/T3. The "mandatory render constraints" are generic text that Flux ignores at word 1500.
3. `textZoneDirective` append (line 1546-1548) — **REMOVE**. Text zone is now passed to `buildImagePrompt` in T2.

After this cleanup, `generateWithReplicate` should look like:

```typescript
// Legacy path
const parts = buildPromptParts(input);
let finalPromptForReplicate = parts.finalPrompt;
let negativePromptForReplicate = parts.negativePrompt;

// Direction preview prefix stays (line 1520-1521)
if (input.isDirectionPreview) {
  const previewStyleLockPrefix = buildDirectionPreviewStyleLockPrefix(input.illustrationStyle);
  finalPromptForReplicate = `${previewStyleLockPrefix}\n${finalPromptForReplicate}`;
}

// Log and proceed to Replicate call
```

Keep ALL existing logging. Just remove the 3 append blocks.

### T5 — Align `buildCoverPrompt` to new structure

`buildCoverPrompt` (line ~1641) currently builds its own prompt from scratch, producing a different aesthetic. Rewrite it to use the same `buildImagePrompt` function with cover-specific parameters:

```typescript
function buildCoverPrompt(input: CoverImageInput): string {
  const protagonistLock = buildCompactProtagonistLock({
    childName: input.childName,
    heroVisualLock: input.heroVisualLock,
    childDescription: input.childDescription,
  });

  const entityLock = input.entityVisualLock
    ? `Companion: ${input.entityVisualLock.shape}, ${input.entityVisualLock.color}, ${input.entityVisualLock.proportions}`
    : '';

  const coverScene = [
    `Book cover scene: ${input.storyTitle}.`,
    input.coverText ? `Story hook: ${input.coverText}.` : '',
    `Topic: ${input.topicLabel}.`,
    'Opening moment of the story. Warm, inviting, emotionally readable.',
  ].filter(Boolean).join(' ');

  const coverTextZone = 'Reserve the top 25-35% of the frame as a calm, low-detail area for title overlay. No faces, hands, or focal elements in this zone.';

  const result = buildImagePrompt({
    styleIdInput: input.illustrationStyle,
    sceneDescription: coverScene,
    textZoneDirective: coverTextZone,
    protagonistLock,
    entityLock,
    globalNegativeConstraints: [NO_TEXT_LOCK],
  });

  return result.finalPrompt;
}
```

Keep the existing `buildImageStoryDirectionLine` call and append it to `coverScene` if it returns non-empty.

### T6 — Prompt length validation log

Add a log line right after `buildImagePrompt` returns in `buildPromptParts`:

```typescript
const wordCount = result.finalPrompt.split(/\s+/).length;
console.log(
  `[prompt_compact] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} words=${wordCount} chars=${result.finalPrompt.length} sceneWords=${scene.split(/\s+/).length} textZonePresent=${Boolean(zone)}`
);
if (wordCount > 450) {
  console.warn(`[prompt_compact_warning] Prompt exceeds 450 words (${wordCount}). Scene may be truncated by Flux.`);
}
```

Same for cover:
```typescript
const coverWords = coverPrompt.split(/\s+/).length;
console.log(`[cover_prompt_compact] orderId=${input.orderId} words=${coverWords} chars=${coverPrompt.length}`);
```

## Safety
- No changes to pipeline.ts — story generation is untouched
- No changes to reader CSS or layout
- No changes to DB schema
- Visual Director path untouched (still off by default)
- `extractSceneCore` stays for now (pipeline still pollutes) — removal is Phase 3e.2
- Existing negative prompt content preserved
- Direction preview path preserved (just uses compact prompt as base)
- `npm run build` must pass

## Acceptance criteria
- `npm run build` passes
- New prompt for a test generation is **under 400 words** (log: `[prompt_compact] ... words=<N>`)
- First 200 characters of prompt contain text zone OR scene description (NOT `STYLE_CONTRACT` or `STYLE_SELECTION_SYSTEM`)
- Cover prompt uses the same `buildImagePrompt` function as interior pages
- Cover prompt word count is under 400 (log: `[cover_prompt_compact]`)
- No `STYLE_CONTRACT:`, `CHARACTER_RESEMBLANCE_GUIDANCE:`, `BOOK_ILLUSTRATION_PLACEMENT:`, `MANDATORY RENDER CONSTRAINTS:` headers in the final prompt
- `textZoneDirective` text appears in the FIRST 3 lines of the prompt (not appended at end)
- `withConsistencyReinforcement` and `strictDirectiveBlock` are no longer appended in `generateWithReplicate`
- Protagonist lock is one natural sentence, not the structured `faceShape=X; hair=Y` format

## Verification
Run one full book generation and capture logs. Report:
1. `[prompt_compact]` log for pages 1-8 — confirm all under 400 words
2. `[cover_prompt_compact]` log — confirm under 400 words
3. Full text of page 1 prompt and cover prompt — paste in return report
4. Confirm first 200 chars of page 1 prompt (what does Flux actually "see first"?)

## Return format
- **GO / NO-GO**
- **Files changed** (with line ranges)
- **Before/After** — paste full page-1 prompt BEFORE (current) and AFTER (new) for comparison
- **Cover Before/After** — same for cover
- **Word counts** — old vs new for page-1 and cover
- **`[prompt_compact]` logs** for all pages
- **Risks / open questions**
- **What's left for 3e.2** — confirm pipeline.ts PROMPT_CONTRACT cleanup + LLM translation step are NOT in this phase

## Git commit (after GO)
```
phase 3e.1: prompt restructure — scene-first, text-zone-aware, compact

T1: buildImagePrompt rewritten — scene+textZone first, character second, style hint last
T2: buildPromptParts simplified — clean assembly, no multi-layer wrapping
T3: buildCompactProtagonistLock — one natural sentence instead of structured format
T4: generateWithReplicate cleaned — removed 3 post-assembly append blocks
T5: buildCoverPrompt unified — uses same builder as interior pages
T6: prompt length validation logging
```

Stage files:
```powershell
git add lib/promptBuilder.ts backend/providers/image.ts
git diff --cached --stat
```
