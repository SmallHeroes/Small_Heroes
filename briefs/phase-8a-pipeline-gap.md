# Phase 8a — Bridge Pipeline Gap: DNA + Props + Added Characters

## Problem

The story-bank dev route has all visual consistency features (Character DNA, Prop DNA, structured locks).  
The **production generate route** (`app/api/generate/route.ts`) has NONE of them.  
This causes:

1. **Added characters (e.g. "אמא גל") never appear** in images — their visual description is never injected into the GPT Image prompt
2. **Props look different every page** — no propDNA locking recurring objects
3. **Child character inconsistent** — no structured identity lock (face/hair/clothing)
4. **Companion inconsistent** — no structured companion lock

## What Already Works (story-bank route)

`app/api/dev/story-bank/route.ts` lines 206-274:
```ts
const dna = await generateStoryBankCharacterDNA({...});
// Then passes to generateAllPageImages:
childStructured: dna.childStructured,
companionStructured: dna.companionStructured,
propDNA: dna.propDNA,
```

`backend/providers/image.ts` lines 1746-1821 already handles:
- `childStructured` → CHARACTER IDENTITY LOCK block
- `companionStructured` → COMPANION IDENTITY LOCK block
- `propDNA` → matches objects in scene text and injects locked descriptions

## Changes Required

### 1. Generate Character DNA in main route

**File:** `app/api/generate/route.ts`

After the story is generated and storyboard is built (around line 680), add a DNA generation step:

```ts
import { generateStoryBankCharacterDNA } from '@/backend/providers/story-bank-loader';

// After story + storyboard are ready, before image generation:
const allStoryText = story.pages.map(p => p.text).join('\n');
const companionName = resolvedCompanion?.name || '';
const companionDescription = resolvedCompanion?.description || '';

const dna = await generateStoryBankCharacterDNA({
  childName: order.childName || '',
  childGender: order.childGender || 'girl',
  childAge: order.childAge || 4,
  companionName,
  companionKind: resolvedCompanion?.kind || companionName,
  storyText: allStoryText,
  illustrationStyle: order.illustrationStyle,
});
```

### 2. Pass DNA to generateAllPageImages config

**File:** `app/api/generate/route.ts` line 720+

Add these fields to the config object in `generateAllPageImages()`:

```ts
const imageOutcome = await generateAllPageImages(
  pagesForGeneration,
  {
    // ... existing fields ...
    childStructured: dna.childStructured,       // ADD
    companionStructured: dna.companionStructured, // ADD  
    propDNA: dna.propDNA,                        // ADD
    extraNegativeRules: dna.negativeRules,       // ADD
    // ... rest of existing fields ...
  }
);
```

### 3. Inject Added Characters into GPT Image Prompt — CRITICAL

**File:** `backend/providers/image.ts`, function `buildGPTImagePrompt` (around line 1744)

Currently the function builds `charParts` with only child + companion. It must also handle supporting/family characters.

**Step 3a:** Add a new field to `ImageInput` interface (or use existing `expectedCharacterNames` + `characterRegistry`):

```ts
// In the ImageInput type, add:
supportingCharacters?: Array<{
  name: string;
  description: string;
  relationship?: string; // e.g. "אמא", "אחות"
}>;
```

**Step 3b:** In `buildGPTImagePrompt`, after the companion block (~line 1800), add:

```ts
// Supporting characters (family members, added characters)
if (input.supportingCharacters?.length) {
  for (const sc of input.supportingCharacters) {
    const relLabel = sc.relationship ? ` (${sc.relationship})` : '';
    charParts.push(
      `SUPPORTING CHARACTER — ${sc.name}${relLabel}:\n` +
      `${sc.description}\n` +
      `This character MUST appear in this scene alongside the main child.`
    );
  }
}
```

**Step 3c:** In the generate route, when building `pagesForGeneration`, populate `supportingCharacters` from `anchorRegistry`:

For each page that has expected additional characters (from `expectedCharacterIds`), build the supporting characters array:

```ts
// When building each page for generation:
const pageSupportingChars = (page.expectedCharacterIds || [])
  .filter(id => id !== 'child' && id !== 'companion')
  .map(id => anchorRegistry[id])
  .filter(Boolean)
  .map(char => ({
    name: char.name,
    description: char.description,
    relationship: char.relationship || '',
  }));
```

Pass this through to `ImageInput.supportingCharacters`.

### 4. Also Pass DNA to Cover Generation

The cover also needs structured character data. In the `generateBookCover` call (~line 693), add the DNA fields.

## Files to Edit

1. `app/api/generate/route.ts` — add DNA generation step, pass DNA to config, build supportingCharacters
2. `backend/providers/image.ts` — add supportingCharacters to ImageInput, inject into buildGPTImagePrompt
3. No changes needed to story-bank-loader.ts (it already exports what we need)

## Testing

After implementing:
1. Create a book with an added character (e.g. "אמא גל")
2. Verify the character appears in generated images
3. Check character consistency across pages
4. Check prop consistency (mirror should look the same)

## Priority

CRITICAL — without this fix, added characters are invisible and visual quality is broken for all production books.
