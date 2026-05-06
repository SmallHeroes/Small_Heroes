# Story Pipeline Debug Brief

**Priority: CRITICAL — story quality is broken in production**

The few-shot story generation (Phase 4a) was wired in but the last generated book
produced a terrible, flat, repetitive story — zero humor, zero rhythm, no companion
character activity, literal shadows-on-wall for 9 pages. This reads like the OLD
pipeline output, not GPT-5.3 + few-shot.

---

## Step 1: Add diagnostic logging (DO FIRST)

In `backend/providers/pipeline.ts`, add logging to verify what's actually running.

### A. In `generateRawStory()` (~line 1370), add at top of function:
```ts
console.log(`[Pipeline][Prose-3A] USE_FEWSHOT=${USE_FEWSHOT}`);
console.log(`[Pipeline][Prose-3A] STORY_MODEL=${process.env.STORY_MODEL || '(not set)'}`);
console.log(`[Pipeline][Prose-3A] systemPrompt length=${buildProse3ASystem(input.childAge).length} chars`);
console.log(`[Pipeline][Prose-3A] userPrompt length=${buildRawStoryPrompt(brain, outline, input, pageCount).length} chars`);
```

### B. In `callLLMOnce()` (~line 524), add after model is resolved:
```ts
console.log(`[Pipeline][${stage}] model=${model}, provider=${provider}, jsonMode=${jsonMode}`);
```

### C. In `generateProse()` (~line 1875), add:
```ts
console.log(`[Pipeline][Prose] USE_FEWSHOT=${USE_FEWSHOT}, pageCount=${pageCount}`);
```

### D. In the `USE_FEWSHOT` branch (~line 1886), after splitting paragraphs:
```ts
console.log(`[Pipeline][Prose] Raw paragraphs from 3A: ${paragraphs.length}`);
paragraphs.forEach((p, i) => {
  const words = p.trim().split(/\s+/).filter(Boolean).length;
  console.log(`[Pipeline][Prose] Scene ${i+1}: ${words} words, starts: "${p.trim().substring(0, 60)}..."`);
});
```

---

## Step 2: Fix bugs

### Bug A: Hardcoded "10 scenes" in system prompt

**File:** `backend/providers/pipeline.ts`
**Function:** `buildProse3ASystem()` (~line 1268)

The system prompt on line 1304 says:
```
אורך: כל סצנה חייבת להיות 60-90 מילים בעברית. פחות מ-60 = נכשלת. סה"כ 10 סצנות.
```

This is hardcoded to 10, but the actual pageCount varies (8, 10, 12 depending on
book length selection). If the book has 8 pages, the model writes 10 scenes and 2
get trimmed — possibly losing the best ending.

**Fix:** Change `buildProse3ASystem` to accept `pageCount` as a second parameter:

```ts
function buildProse3ASystem(childAge: number | null | undefined, pageCount: number): string {
```

Then replace the hardcoded line:
```
אורך: כל סצנה חייבת להיות 60-90 מילים בעברית. פחות מ-60 = נכשלת. סה"כ ${pageCount} סצנות.
```

Update the caller in `generateRawStory()` (~line 1380):
```ts
const systemPrompt = buildProse3ASystem(input.childAge, pageCount);
```

### Bug B: User prompt doesn't mention pageCount either

**Function:** `buildRawStoryPrompt()` (~line 1327)

Add pageCount as a visible instruction in the user prompt. At the end of the
return string (~line 1367), change the last bullet:
```
- כל סצנה = רגע ויזואלי אחד שאפשר לצייר. 60-90 מילים.
```
→
```
- בדיוק ${pageCount} סצנות. כל סצנה = רגע ויזואלי אחד שאפשר לצייר. 60-90 מילים.
```

### Bug C: Brain's centralMetaphor can override the model's creativity

**Function:** `buildRawStoryPrompt()` (~line 1352)

The brain stage generates a `centralMetaphor` (e.g. "shadows stretching on the
wall"), and the user prompt passes it as hard instruction:
```
מטאפורה מרכזית מהתכנון: [whatever brain said]
```

The problem: the brain was written for the OLD pipeline where it controlled
everything. With few-shot, the EXAMPLE_STORY already teaches the model what a
good metaphor looks like. Passing the brain's literal metaphor forces the model
to use it even if it's weak (like "shadows on wall" — literal, not metaphorical).

**Fix:** Change the brainContext line to a suggestion, not a command:

```ts
const brainContext = brain.narrativeCore?.centralMetaphor
  ? `\nרמז (אל תשתמש ליטרלית — תמצא מטאפורה מקורית): ${brain.narrativeCore.centralMetaphor.metaphor}`
  : '';
```

### Bug D: 3D repair stage may destroy few-shot rhythm

The few-shot style uses short punchy lines with line breaks. When `enforcePageMinimumLength`
counts Hebrew words, a scene with great rhythm might count as <25 words, triggering
"repair" that replaces the punchy text with generic expanded prose.

**File:** `backend/providers/pipeline.ts`, in the `USE_FEWSHOT` branch of
`generateProse()` (~line 1899)

**Fix:** Skip 3D entirely for few-shot, OR raise the awareness. Simplest fix —
skip 3D when few-shot is on and scenes are reasonably long:

Replace:
```ts
console.log('[Pipeline][Prose-3D] Enforcing minimum page length...');
const { prose: final, tokens: t3d } = await enforcePageMinimumLength(prose, pageCount);
return { prose: final, rawStory, tokens: t3a + t3d };
```

With:
```ts
// Check if 3D repair is actually needed — few-shot produces longer scenes
const shortPages = prose.filter(p => countHebrewWords(p.text ?? '') < PAGE_HEBREW_WORDS_MIN);
if (shortPages.length > 0) {
  console.log(`[Pipeline][Prose-3D] ${shortPages.length} short pages, running repair...`);
  const { prose: final, tokens: t3d } = await enforcePageMinimumLength(prose, pageCount);
  return { prose: final, rawStory, tokens: t3a + t3d };
} else {
  console.log('[Pipeline][Prose-3D] All pages meet minimum, skipping repair.');
  return { prose, rawStory, tokens: t3a };
}
```

---

## Step 3: Verify with a test generation

After making the fixes above:

1. **Restart the dev server** (`npm run dev`)
2. Generate a new book through the wizard with:
   - Topic: פחד מחושך / צללים (night fear)
   - Any companion
   - Short book (8 pages)
3. Check the terminal logs for:
   - `[Pipeline][Prose-3A] USE_FEWSHOT=true`
   - `[Pipeline][Prose-3A] STORY_MODEL=gpt-5.3-chat-latest`
   - `[Pipeline][Prose-3A] model=gpt-5.3-chat-latest`
   - `[Pipeline][Prose] Raw paragraphs from 3A: 8` (should match pageCount)
   - Each scene should start differently (not all "יובל שכבה...")
4. Read the actual story text in logs — verify it has:
   - Companion character doing funny things
   - Short punchy lines (not flat paragraphs)
   - A real metaphor (not literal shadows)
   - Humor, rhythm, personality

---

## Files changed
- `backend/providers/pipeline.ts` — all changes are in this file

## What NOT to change
- Do NOT touch the `EXAMPLE_STORY` constant
- Do NOT change `callLLMOnce()` logic (GPT-5.3 handling is correct)
- Do NOT change the legacy pipeline path (the `else` branch in `generateProse`)
- Do NOT change the brain/outline stages
