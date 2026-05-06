# Story Flow Fix Brief — Two Post-Generation Killers

**Priority: CRITICAL — the prompt is good now but two mechanisms destroy the story after generation**

---

## Problem Summary

The clean prompt (tested in `test-pipeline-story.mjs`) produces excellent stories.
But by the time the text reaches the reader, it's flat descriptive paragraphs.

Two mechanisms are responsible:

### Killer 1: The retry in `generateRawStory()` replaces good stories with flat ones

**Location:** `backend/providers/pipeline.ts`, `generateRawStory()` (~line 1365-1419)

The function has `MIN_WORDS = 400`. Few-shot stories with 8 pages × 50-55 words can
be 380-440 total words. When under 400, the retry fires and appends:

```
הסיפור הקודם היה קצר מדי. כתוב סצנות ארוכות ומפורטות יותר — 70-90 מילים לכל סצנה.
```

"ארוכות ומפורטות יותר" tells the model to write LONGER, MORE DESCRIPTIVE text — the
exact opposite of the punchy few-shot style. The retry output has more words, so it
REPLACES the good first attempt (because `bestWordCount` selects the longest).

### Killer 2: The `join('\n\n')` → `split('\n\n')` roundtrip fragments scenes

**Location:** `backend/providers/pipeline.ts`:
- `generateRawStory()` line ~1400: `text = scenes.map(s => s.text).join('\n\n')`
- `generateProse()` line ~1884: `const paragraphs = rawStory.split('\n\n')`

The model returns structured JSON with 8 scenes. Each scene's text has internal `\n`
for line breaks (the punchy rhythm style). `generateRawStory` joins them with `\n\n`.

But if any scene text contains `\n\n` internally (empty line between stanzas — natural
in the few-shot style), `split('\n\n')` in `generateProse` breaks that scene into
multiple fragments. Result: 12-15 fragments instead of 8 scenes.

Short fragments (< 25 Hebrew words) trigger 3D repair, which rewrites them as flat
descriptive paragraphs using a completely different LLM prompt.

---

## Fix

### Change 1: Return parsed scenes directly from `generateRawStory`

Instead of joining scenes into a string and re-splitting, return the structured scenes.

**Current return type and logic (~line 1380, 1396-1400, 1418):**
```ts
export async function generateRawStory(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): Promise<{ rawStory: string; tokens: number }> {
```

**Replace with:**
```ts
export async function generateRawStory(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): Promise<{ rawStory: string; scenes: Array<{ page: number; text: string }>; tokens: number }> {
```

**Current JSON parsing block (~line 1396-1401):**
```ts
    let text = '';
    try {
      const parsed = parseJSON<{ scenes?: Array<{ page: number; text: string }> }>(result.text, `Prose-3A(${attempt})`);
      const scenes = parsed.scenes ?? (Array.isArray(parsed) ? parsed as Array<{ page: number; text: string }> : []);
      text = scenes.map(s => s.text ?? '').join('\n\n').trim();
      console.log(`[Pipeline][Prose-3A] Attempt ${attempt}: ${scenes.length} scenes parsed`);
```

**Replace with:**
```ts
    let text = '';
    let parsedScenes: Array<{ page: number; text: string }> = [];
    try {
      const parsed = parseJSON<{ scenes?: Array<{ page: number; text: string }> }>(result.text, `Prose-3A(${attempt})`);
      parsedScenes = parsed.scenes ?? (Array.isArray(parsed) ? parsed as Array<{ page: number; text: string }> : []);
      text = parsedScenes.map(s => s.text ?? '').join('\n\n').trim();
      console.log(`[Pipeline][Prose-3A] Attempt ${attempt}: ${parsedScenes.length} scenes parsed`);
```

**Current best-tracking and return (~line 1408-1418):**
```ts
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    console.log(`[Pipeline][Prose-3A] Attempt ${attempt}: ${wordCount} words`);

    if (wordCount > bestWordCount) {
      bestText = text;
      bestWordCount = wordCount;
    }
    if (wordCount >= MIN_WORDS) break;
  }

  if (!bestText) throw new Error('[Pipeline][Prose-3A] All attempts failed');
  return { rawStory: bestText, tokens: totalTokens };
```

**Replace with:**
```ts
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    console.log(`[Pipeline][Prose-3A] Attempt ${attempt}: ${wordCount} words, ${parsedScenes.length} scenes`);

    if (wordCount > bestWordCount) {
      bestText = text;
      bestScenes = parsedScenes;
      bestWordCount = wordCount;
    }
    if (wordCount >= MIN_WORDS) break;
  }

  if (!bestText) throw new Error('[Pipeline][Prose-3A] All attempts failed');
  return { rawStory: bestText, scenes: bestScenes, tokens: totalTokens };
```

Add `let bestScenes: Array<{ page: number; text: string }> = [];` next to `let bestText = '';` at the top of the function.

### Change 2: Use parsed scenes in `generateProse` (skip split)

**Current code (~line 1878-1910):**
```ts
async function generateProse(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): Promise<{ prose: PageProse[]; rawStory: string; tokens: number }> {
  console.log(`[Pipeline][Prose] USE_FEWSHOT=${USE_FEWSHOT}, pageCount=${pageCount}`);
  console.log('[Pipeline][Prose-3A] Few-shot story generation...');
  const { rawStory, tokens: t3a } = await generateRawStory(brain, outline, input, pageCount);

  if (USE_FEWSHOT) {
    const paragraphs = rawStory.split('\n\n').filter(p => p.trim());
    console.log(`[Pipeline][Prose] Raw paragraphs from 3A: ${paragraphs.length}`);
    paragraphs.forEach((p, i) => {
      const words = p.trim().split(/\s+/).filter(Boolean).length;
      console.log(`[Pipeline][Prose] Scene ${i + 1}: ${words} words, starts: "${p.trim().substring(0, 60)}..."`);
    });
    const prose: PageProse[] = paragraphs.map((text, i) => ({
      pageNumber: i + 1,
      text: text.trim(),
    }));
```

**Replace with:**
```ts
async function generateProse(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): Promise<{ prose: PageProse[]; rawStory: string; tokens: number }> {
  console.log(`[Pipeline][Prose] USE_FEWSHOT=${USE_FEWSHOT}, pageCount=${pageCount}`);
  console.log('[Pipeline][Prose-3A] Few-shot story generation...');
  const { rawStory, scenes, tokens: t3a } = await generateRawStory(brain, outline, input, pageCount);

  if (USE_FEWSHOT) {
    // Use parsed JSON scenes directly — DO NOT split by \n\n (destroys rhythm)
    console.log(`[Pipeline][Prose] Scenes from 3A JSON: ${scenes.length}`);
    scenes.forEach((s, i) => {
      const words = countHebrewWords(s.text ?? '');
      console.log(`[Pipeline][Prose] Scene ${i + 1}: ${words} Hebrew words, starts: "${(s.text ?? '').trim().substring(0, 60)}..."`);
    });
    const prose: PageProse[] = scenes.map((s, i) => ({
      pageNumber: s.page ?? (i + 1),
      text: (s.text ?? '').trim(),
    }));
```

The rest of the function (padding/trimming to pageCount, 3D repair check) stays the same.

### Change 3: Lower `MIN_WORDS` and fix retry message

**Current (~line 1368-1386):**
```ts
  const MIN_WORDS    = 400;
  const MAX_ATTEMPTS = 2;

  ...

    const prompt = attempt === 1
      ? userPrompt
      : userPrompt + '\n\nהסיפור הקודם היה קצר מדי. כתוב סצנות ארוכות ומפורטות יותר — 70-90 מילים לכל סצנה.';
```

**Replace with:**
```ts
  const MIN_WORDS    = 320; // 8 pages × 40 words minimum
  const MAX_ATTEMPTS = 2;

  ...

    const prompt = attempt === 1
      ? userPrompt
      : userPrompt + '\n\nהסיפור הקודם היה קצר מדי. שמור על הקצב והסגנון אבל הוסף עוד שורות ופרטים קטנים בתוך כל סצנה — יעד: 60-80 מילים לסצנה.';
```

Key changes:
- `MIN_WORDS` lowered from 400 to 320 (8 × 40 word minimum)
- Retry message says "keep the rhythm and style" instead of "write longer and more detailed"

### Change 4: Raise 3D repair threshold awareness for few-shot

The 3D repair uses `PAGE_HEBREW_WORDS_MIN = 25` as the threshold. With properly parsed
scenes (not fragmented), each scene should be 40-70 Hebrew words, well above 25.
No change needed here IF Change 2 is applied (scenes won't be fragmented).

However, as extra safety, add a log in the 3D check:

**After the shortPages filter (~line 1902):**
```ts
    const shortPages = prose.filter(p => countHebrewWords(p.text ?? '') < PAGE_HEBREW_WORDS_MIN);
    if (shortPages.length > 0) {
      console.log(`[Pipeline][Prose-3D] ${shortPages.length} short pages, running repair...`);
      shortPages.forEach(p => {
        const hw = countHebrewWords(p.text ?? '');
        console.log(`[Pipeline][Prose-3D] Page ${p.pageNumber}: ${hw} Hebrew words (min: ${PAGE_HEBREW_WORDS_MIN})`);
        console.log(`[Pipeline][Prose-3D] Text preview: "${(p.text ?? '').substring(0, 80)}..."`);
      });
```

---

## Update caller in `runStoryPipeline`

**Current (~line 3225):**
```ts
  const { prose, rawStory, tokens: t3 } = await generateProse(brain, outline, input, pageCount);
```

No change needed — `generateProse` still returns `{ prose, rawStory, tokens }`.

---

## Verification

After making changes:

1. Restart dev server
2. Generate a book (NIGHT_FEAR, 8 pages)
3. Check logs for:
   - `[Pipeline][Prose] Scenes from 3A JSON: 8` (NOT "Raw paragraphs")
   - `[Pipeline][Prose-3A] Attempt 1: X words, 8 scenes`
   - NO `[Pipeline][Prose-3D]` repair messages (scenes should all be > 25 words)
4. Read the story text — verify punchy lines, dialogue, companion, humor

---

## Files changed
- `backend/providers/pipeline.ts` — `generateRawStory()` and `generateProse()` only

## What NOT to change
- `buildRawStoryPrompt()` — already fixed, do not touch
- `buildProse3ASystem()` — correct
- `EXAMPLE_STORY` — do not touch
- `callLLM()` / `callLLMOnce()` — correct
- `enforcePageMinimumLength()` — keep as safety net, just won't fire if scenes are proper length
- Legacy pipeline path — unchanged
