# Phase 3e.2 — LLM Scene Translation + Pipeline Cleanup

## Principle
After 3e.1, prompts are compact and scene-first — but `sceneWords=7` on every page. The scene description is just the scraps that survive `extractSceneCore` after stripping PROMPT_CONTRACT pollution. Seven words of scene is not enough for Flux to produce a meaningful illustration.

This phase adds a cheap, fast LLM call that translates the Hebrew page text + available context into a proper English scene description (~80-120 words). It also cleans up the PROMPT_CONTRACT pollution at the source in pipeline.ts so the original `imagePrompt` from Stage 4C is clean.

## Goal
After this phase, every page prompt contains a rich, specific, English scene description of 80-120 words that describes what is actually happening in that page of the story — the setting, the action, the characters present, their poses, the mood, and the environment.

## Scope

### In scope
- `backend/providers/image.ts` — add `translateSceneForImage` LLM call, integrate into `buildPromptParts`
- `backend/providers/pipeline.ts` — clean up `applyStage4PromptContract` to stop polluting `imagePrompt`
- `backend/providers/image.ts` — simplify `extractSceneCore` (less to strip after pipeline cleanup)

### Out of scope — DO NOT TOUCH
- `lib/promptBuilder.ts` — no changes (3e.1 structure stays)
- Reader CSS, layout, fonts
- LoRA, wizard, payment, audio
- Visual Director path (still off)
- Cover prompt (cover already has a good scene from `buildCoverPrompt`)
- Resemblance pipeline, anchor election

## Tasks

### T1 — Add `translateSceneForImage` function in `image.ts`

Create a new async function that calls an LLM to produce an English scene description from the Hebrew page text and available context. This is a cheap, fast call — NOT the main story LLM.

```typescript
async function translateSceneForImage(input: {
  bookPageText: string;          // Hebrew text of this page
  pagePrompt: string;            // Stage 4C imagePrompt (may still have some pollution, used as fallback context)
  pageNumber: number;
  totalPages: number;
  childName?: string | null;
  entityName?: string | null;    // from concept.centralEntity.name
  entityVisual?: string | null;  // from entityVisualLock or concept
  heroVisualLock?: HeroVisualLock | null;
  textZone?: string | null;      // 'top_clear' | 'bottom_clear' etc.
  orderId?: string;
}): Promise<string> {
```

**LLM call details:**
- Model: `gpt-4o-mini` (hardcoded — this is a translation/formatting task, not creative writing). Use env var `SCENE_TRANSLATE_MODEL` with default `gpt-4o-mini`.
- Temperature: 0.3 (low — we want consistent, concrete descriptions, not creative variation)
- Max tokens: 300
- Provider: OpenAI only (fast, cheap — no need for Anthropic path here)

**System prompt:**
```
You are an illustration director for a children's picture book. Given a page of Hebrew story text and context about the characters, produce an English scene description for an image generation model.

Rules:
- Describe the VISUAL SCENE: what is visible, where it happens, what the characters are doing, their poses and expressions
- Include the physical environment: indoor/outdoor, time of day, specific objects, colors, atmosphere
- Name the characters by name (e.g. "Maya" not "the child")
- Describe the companion creature by its visual appearance if present
- Be concrete and specific — "a moonlit bedroom with star-patterned curtains and a nightlight on the dresser" not "a room at night"
- Do NOT include style instructions, camera angles, or composition directions
- Do NOT include any text about "no text" or "pure illustration" — that is handled separately
- Output ONLY the scene description, nothing else
- 80-120 words
```

**User prompt:**
```
Page ${pageNumber} of ${totalPages}.

Hebrew text: "${bookPageText}"

Characters in scene:
- Main character: ${childName ?? 'the protagonist'}${heroVisualLock ? ` (${heroVisualLock.ageImpression}, ${heroVisualLock.hair}, ${heroVisualLock.clothing})` : ''}
${entityName ? `- Companion: ${entityName}${entityVisual ? ` (${entityVisual})` : ''}` : ''}

Text overlay will be placed at the ${textZone === 'top_clear' ? 'top' : textZone === 'bottom_clear' ? 'bottom' : textZone ?? 'bottom'} of the image.

${extractSceneCore(pagePrompt) || ''}

Describe the visual scene for this page in English (80-120 words):
```

**Fallback:** If the LLM call fails (network, timeout, rate limit), fall back to `extractSceneCore(input.pagePrompt)` — the current behavior. Log the failure but do NOT throw. Image generation must not be blocked by a translation failure.

**Logging:**
```
[scene_translate] orderId=X page=Y words=Z model=gpt-4o-mini latency=Nms
[scene_translate_fallback] orderId=X page=Y reason="error message"
```

**Timeout:** 8 seconds. If the call takes longer, abort and use fallback.

### T2 — Integrate `translateSceneForImage` into `buildPromptParts`

Make `buildPromptParts` async. Change its signature:

```typescript
async function buildPromptParts(input: ImageInput): Promise<{
  finalPrompt: string;
  negativePrompt: string;
  styleId: string;
  compositionVariation: CompositionVariation;
}>
```

Replace the current scene extraction:
```typescript
// OLD:
const scene = extractSceneCore(input.pagePrompt);

// NEW:
const scene = input.bookPageText
  ? await translateSceneForImage({
      bookPageText: input.bookPageText,
      pagePrompt: input.pagePrompt,
      pageNumber: input.pageNumber,
      totalPages: input.totalPages,
      childName: input.childFirstName,
      entityName: input.concept?.centralEntity?.name ?? null,
      entityVisual: input.entityVisualLock
        ? `${input.entityVisualLock.shape}, ${input.entityVisualLock.color}`
        : input.concept?.centralEntity?.visualDescription ?? null,
      heroVisualLock: input.heroVisualLock ?? null,
      textZone: input.textZone ?? null,
      orderId: input.orderId,
    })
  : extractSceneCore(input.pagePrompt); // fallback when no Hebrew text available
```

**Propagate async:** `buildPromptParts` is called from `generateWithReplicate` (line ~1359). That function is already async, so just add `await`:
```typescript
const parts = useVd ? null : await buildPromptParts(input);
```

### T3 — Clean up `applyStage4PromptContract` in `pipeline.ts`

The current function (line ~2604) wraps every shot's `imagePrompt` with a massive `buildPromptContractPrefix` that contains JSON-serialized locks, composition rules, scene phase blocks, and constraint instructions. This is the root source of pollution — the shot's own `imagePrompt` (which Stage 4C LLM produced as a decent English scene description) gets buried under 400+ words of prefix.

**Change:** Stop injecting the prefix into `imagePrompt`. Instead, keep the shot's original `imagePrompt` clean and pass the structured data as SEPARATE fields on the `IllustrationShot` object.

Modify `applyStage4PromptContract` to:

```typescript
function applyStage4PromptContract(
  shots: IllustrationShot[],
  compositionPlan: PageComposition[],
  visualBible: VisualBible | null,
  worldAnchor: string,
  prose: PageProse[],
  categoryIllustrationMood?: string | null,
  directionContext?: { ... },
): IllustrationShot[] {
  const compByPage = new Map(compositionPlan.map((c) => [c.pageNumber, c]));
  const moodSuffix = categoryIllustrationMood?.trim()
    ? ` Mood: ${categoryIllustrationMood.trim()}.`
    : '';

  return shots.map((shot) => {
    const renderBrief = buildVisualRenderBrief(shot, compByPage.get(shot.pageNumber), visualBible);
    // Keep imagePrompt clean — just append mood and render brief, NO prefix
    return {
      ...shot,
      imagePrompt: `${shot.imagePrompt}${moodSuffix ? moodSuffix : ''} ${renderBrief}`.trim(),
    };
  });
}
```

**What gets removed from the imagePrompt:**
- `PROMPT_CONTRACT_PAGE_N:` header
- `CRITICAL_IMAGE_RULE:` block (the no-text instruction — already in negative prompt)
- `heroVisualLock=JSON` (already passed as separate field)
- `entityVisualLock=JSON` (already passed as separate field)
- `styleLock=JSON` (already passed as separate field)
- `pageIntent=JSON` (already passed as separate field)
- `compositionRules=JSON` (already passed as separate field)
- `visualRhythm=JSON`
- `environmentContinuity=JSON`
- `scenePhaseBlock`
- All the `*Constraint=` lines

**What stays (in the render brief):** `buildVisualRenderBrief` output — this is a compact scene-level instruction that adds value. Keep it. Also keep the mood suffix.

**IMPORTANT:** Verify that `buildVisualRenderBrief` does NOT also inject huge blocks. Read it and report its typical output length.

### T4 — Simplify `extractSceneCore` in `image.ts`

After T3, the `imagePrompt` from pipeline is much cleaner. Simplify `extractSceneCore` accordingly:

```typescript
function extractSceneCore(pagePrompt: string): string {
  if (!pagePrompt) return '';
  return pagePrompt
    .replace(/,?\s*no text[\s\S]*$/i, '')
    .replace(/,?\s*pure illustration[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Remove `stripPromptContractPreamble` (no longer needed — the contract is no longer injected). Remove the heavy regex chains that were stripping STYLE LOCK, MAIN CHARACTER LOCK, etc. — those are no longer in the imagePrompt.

Keep the function itself (it's still called as fallback in T2 when `bookPageText` is missing), just simplify it.

### T5 — Pass `concept` through to image generation

Verify that `input.concept` is available in `ImageInput` when `buildPromptParts` is called. Check the data flow:

1. `route.ts` line ~708: `concept: story.concept` is passed to `generateAllPageImages`
2. `generateAllPageImages` must propagate `concept` to each page's `ImageInput`
3. `buildPromptParts` reads `input.concept?.centralEntity?.name` for the entity name in translation

If `concept` is NOT being propagated to individual `ImageInput` objects in `generateAllPageImages`, add it. Check:

```typescript
// In generateAllPageImages, where individual page ImageInput is built:
concept: sharedInput.concept,
```

Report whether this was already wired or needed to be added.

### T6 — Logging and validation

Add comprehensive logging for the new translation step:

```
[scene_translate_input] orderId=X page=Y hebrewLen=N existingSceneLen=M
[scene_translate] orderId=X page=Y words=Z model=gpt-4o-mini latency=Nms
[scene_translate_fallback] orderId=X page=Y reason="..."
[prompt_compact] orderId=X page=Y words=Z chars=N sceneWords=M textZonePresent=true
```

The `[prompt_compact]` log already exists from 3e.1. After this phase, `sceneWords` should be 80-120 (was 7).

## Safety
- Translation failure falls back to existing behavior (extractSceneCore) — no regression
- pipeline.ts changes only affect `applyStage4PromptContract` — story generation, prose, outline are untouched
- LLM call uses gpt-4o-mini with 8s timeout — cost is ~$0.001 per page, ~$0.008 per book
- `npm run build` must pass
- Cover path is unchanged (already has good scene from `buildCoverPrompt`)

## Acceptance criteria
- `npm run build` passes
- `[scene_translate]` log appears for all 8 pages with `words=80-120`
- `[prompt_compact]` now shows `sceneWords=80-120` (was `sceneWords=7`)
- Total prompt word count stays under 400 (scene is longer but boilerplate is gone from pipeline)
- `imagePrompt` from pipeline.ts no longer contains `PROMPT_CONTRACT_PAGE_`, `CRITICAL_IMAGE_RULE`, or JSON-serialized lock blocks
- Fallback works: temporarily break the OpenAI call (bad API key) → `[scene_translate_fallback]` logs, images still generate with extractSceneCore scene

## Verification
Run one full book generation and capture logs. Report:
1. `[scene_translate]` logs for all 8 pages — show the translated scene text
2. `[prompt_compact]` logs — confirm sceneWords is now 80-120
3. Full text of page 1 final prompt — paste it
4. Compare to 3e.1 output — show the improvement
5. Confirm `imagePrompt` from pipeline is clean (paste one raw `imagePrompt` from Stage 4C output)

## Return format
- **GO / NO-GO**
- **Files changed** (with line ranges)
- **Sample translated scene** — paste the English scene description for page 1
- **Full page-1 prompt** — the complete prompt sent to Flux
- **Raw imagePrompt from pipeline** — one sample showing it's clean now
- **Fallback test** — confirm fallback works
- **`[prompt_compact]` logs** for all pages
- **Latency** — `[scene_translate]` latency for all pages
- **Risks / open questions**

## Git commit (after GO)
```
phase 3e.2: LLM scene translation + pipeline cleanup

T1: translateSceneForImage — Hebrew page text → 80-120 word English scene via gpt-4o-mini
T2: buildPromptParts now async, calls scene translation with Hebrew text
T3: applyStage4PromptContract cleaned — no more PROMPT_CONTRACT prefix pollution
T4: extractSceneCore simplified — heavy regex chains removed
T5: concept propagation verified through to ImageInput
T6: scene translation logging + validation

Scene words per page: 7 → 80-120. Pipeline imagePrompt is now clean.
```

Stage files:
```powershell
git add backend/providers/image.ts backend/providers/pipeline.ts
git diff --cached --stat
```
