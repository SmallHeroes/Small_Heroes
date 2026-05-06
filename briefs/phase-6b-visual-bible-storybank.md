# Phase 6b — Visual Bible for Story-Bank + Image Quality Fix

## Problem

Story-bank renders (Phase 6a) produce 15 images where:
1. The child looks completely different on every page (hair, clothes, face, proportions)
2. GPT Image writes Hebrew text on the character's clothing ("נעה", "נועה")
3. No rain/flooding despite imageDirection saying "rainy"
4. Child smiles in every scene, ignoring emotional arc
5. Cover shows wrong companion (fox instead of frog)

Root cause: the story-bank path skips Visual Bible generation, so `childDescription` is just "A girl named נועה, approximately 5 years old, warm and friendly appearance" — too vague for GPT Image to maintain consistency.

## Solution

Add a lightweight Visual Bible step to the story-bank path that generates a **Character DNA** string before image generation starts. This DNA is injected verbatim into every image prompt.

## Architecture

### What changes

**File: `backend/providers/story-bank-loader.ts`**
Add a new exported function:

```typescript
export async function generateStoryBankCharacterDNA(params: {
  childName: string;
  childGender: string;
  childAge: number;
  companionName: string;
  storyText: string;       // full concatenated story text (all pages)
  illustrationStyle: string;
}): Promise<{
  childDNA: string;        // 40-60 word locked character description
  companionDNA: string;    // 20-30 word locked companion description
  worldDNA: string;        // 20-30 word environment/weather description
  negativeRules: string[]; // things to NEVER do
}>
```

This calls a single LLM request (gpt-5.3-chat-latest via STORY_MODEL env, same model as story generation) with a focused prompt:

```
You are a children's book character designer. Read the story below and create LOCKED visual descriptions.

These descriptions will be copy-pasted VERBATIM into every illustration prompt for the book.
They MUST be in English. They MUST be specific enough that 15 different illustrators would draw the same character.

STORY TEXT:
{storyText}

CHARACTER:
- Name: {childName}
- Gender: {childGender}  
- Age: {childAge}

COMPANION:
- Name: {companionName} (appears as the child's friend/sidekick throughout the story)

RULES:
- Describe PHYSICAL appearance only — no personality, no emotions, no actions
- Include: hair (color, length, style), skin tone, eye shape/color, body build, EXACT outfit (one outfit for the whole book), one accessory
- The outfit MUST stay the same on every single page
- DO NOT include the character's name anywhere in the visual description
- DO NOT write any text, letters, or words on clothing
- For companion: exact species, size relative to child, color, distinguishing feature

WEATHER/ENVIRONMENT from the story:
- Read the story and identify the dominant weather and setting
- Describe in 20 words: weather, time of day, dominant colors, ground condition

Return JSON:
{
  "childDNA": "A 5-year-old girl with shoulder-length wavy brown hair, light olive skin, round dark brown eyes, wearing a bright yellow rain jacket with hood down, dark blue rain boots, denim shorts. Small red hair clip on left side.",
  "companionDNA": "A small bright green tree frog, size of a tennis ball, sitting upright, large round golden eyes, wide smiling mouth, smooth shiny skin with darker green spots on back.",
  "worldDNA": "Rainy garden in gray daylight, muddy ground with rising water, green hedges and a small tilting tree, overcast sky with heavy rain.",
  "negativeRules": [
    "NEVER put text, letters, words, or names on any clothing or surface",
    "NEVER change the character's outfit between pages",
    "NEVER show the character without rain gear in outdoor rain scenes",
    "NEVER make the frog larger than the child's hand-span"
  ]
}
```

### Where to inject

**File: `app/api/dev/story-bank/route.ts`**

After loading the story but BEFORE calling `generateAllPageImages`:

```typescript
// NEW: Generate character DNA
const allText = story.pages.map(p => p.text).join('\n');
const dna = await generateStoryBankCharacterDNA({
  childName,
  childGender,
  childAge,
  companionName,
  storyText: allText,
  illustrationStyle,
});

// Use DNA as childDescription instead of generic string
const childDesc = dna.childDNA;
```

Then in the `generateAllPageImages` call, change `childDescription` from the generic string to `dna.childDNA`.

### Negative rules injection

**File: `backend/providers/image.ts`** — in `buildGPTImagePrompt`

The existing `sceneRules` section (line ~1772) already has MANDATORY RULES. We need to add a way to pass extra negative rules.

**Option A (simpler):** Add a new field to `ImageInput`:
```typescript
extraNegativeRules?: string[];
```

Then in `buildGPTImagePrompt`, append these to `sceneRules`:
```typescript
const extraNeg = input.extraNegativeRules?.length
  ? input.extraNegativeRules.map(r => `- ${r}`).join('\n')
  : '';
```

**Option B (hardcode for now):** Just hardcode the critical rules in `buildGPTImagePrompt` for all GPT Image calls:
```
- DO NOT put any text, letters, numbers, or words on clothing, walls, or surfaces.
- DO NOT change the character's outfit, hair, or accessories between pages.
```

**Recommendation: Option B for speed.** These rules should ALWAYS apply to GPT Image, not just story-bank.

### Weather/mood enforcement

The `imageDirection` field in story-bank stories already contains weather hints like "rainy soft light", "dramatic rain", "heavier rain mood". But `parseImageDirection` in story-bank-loader.ts only extracts `lightingSource` from the end of the string.

**Fix in `parseImageDirection`:**
```typescript
// Extract weather keywords
const weatherMatch = dir.match(/(rain|storm|flood|overcast|gray|dark|wet|mud|snow|sunny|bright)/gi);
const weather = weatherMatch ? [...new Set(weatherMatch)].join(', ') : '';
```

Then add `weather` to the `ShotVisualDirection.environmentDetail` field so it gets picked up by `buildGPTImagePrompt`.

### Emotional expression enforcement

Currently `buildGPTImagePrompt` line 1777 says:
```
'- The child\'s expression MUST be happy, smiling, curious, or playful unless Expression field explicitly says otherwise.'
```

This is the problem — it forces happy/smiling even when the story describes struggle. 

**Fix:** Change to:
```
'- The child\'s expression should match the scene emotion. Use the Expression field if provided.'
```

And in `parseImageDirection`, extract emotion hints:
```typescript
// Extract emotion from context
const emotionKeywords = dir.match(/(dramatic|calm|gentle|tense|struggle|peaceful|sad|worried|determined|scared)/gi);
const emotion = emotionKeywords?.[0] ?? '';
```

Set `emotionVisual` in the returned `ShotVisualDirection` to this value.

### Cover companion fix

**File: `app/api/dev/story-bank/route.ts`**

When calling `generateBookCover`, pass the companion DNA:
```typescript
// In cover generation, include companion description
companionDescription: dna.companionDNA,
```

Currently the cover prompt doesn't know about the frog. The cover generation should include "Companion: {companionDNA}" in the prompt if companion is part of the story.

---

## Implementation Steps

### Step 1: Add `generateStoryBankCharacterDNA` to `story-bank-loader.ts`
- Single LLM call to gpt-5.3-chat-latest (same STORY_MODEL as pipeline)
- Returns childDNA, companionDNA, worldDNA, negativeRules
- Uses the same `callLLMOnce` from pipeline.ts (need to export it, or duplicate the fetch call)

### Step 2: Wire DNA into story-bank route
- Call `generateStoryBankCharacterDNA` after loading story, before image gen
- Pass `dna.childDNA` as `childDescription`
- Pass `dna.companionDNA` to companion description
- Pass `dna.worldDNA` as environment context

### Step 3: Hardcode anti-text and anti-drift rules in `buildGPTImagePrompt`
Add to MANDATORY RULES section:
```
- DO NOT put any text, letters, numbers, or words on clothing, walls, signs, or any surface in the image.
- DO NOT change the character's outfit, hair style, hair color, or accessories from what is described.
- The character's clothing described in the prompt is FINAL — do not add, remove, or modify any garment.
```

### Step 4: Fix the always-happy expression rule
Change line 1777 from forcing happy to respecting the Expression field.

### Step 5: Improve `parseImageDirection` weather/emotion extraction
- Extract weather keywords → `environmentDetail`
- Extract emotion keywords → `emotionVisual`

### Step 6: Fix cover to include companion
Pass companion info to cover generation.

---

## Testing

After implementation:
1. Go to `http://localhost:3000/dev/story-bank`
2. Generate story 15b again with same params (נועה, צפרדע, realistic_illustrated)
3. Compare side-by-side with previous render

**Success criteria:**
- Noa wears the SAME outfit on all 15 pages
- Frog looks the same size/color on all pages
- No Hebrew text on clothing
- Rain is visible in outdoor scenes
- Expression varies (worried in pages 8-12, calm in pages 14-15)
- Cover shows frog, not fox

---

## Commit
```
fix(story-bank): add Visual Bible character DNA + GPT Image quality rules

- generateStoryBankCharacterDNA — single LLM call to lock character/companion/world
- Wire DNA into story-bank route as childDescription
- Hardcode anti-text, anti-drift rules in buildGPTImagePrompt
- Fix always-happy expression to respect scene emotion
- Improve parseImageDirection weather/emotion extraction
- Fix cover to include companion description
```
