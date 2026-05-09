# Phase 8d — Additional Characters: Visual DNA + Illustration Presence

## Problem

When a user adds an additional character in the wizard (e.g., "אמא גל" — Mom Gal), that character:
1. **Has no visual DNA** — `generateStoryBankCharacterDNA` only generates structured descriptions for child + companion. Additional characters get whatever free-text description the user typed (often empty).
2. **Is often not detected on pages** — `detectExpectedCharactersForPage` does exact substring matching. If the story says "אמא" but the character is registered as "אמא גל", she's missed.
3. **Gets pushed out by companion priority** — each page allows only ONE non-child character. The companion always wins, so additional characters only appear on pages where the companion is absent.
4. **Reference photo has no visual effect** — the photo URL reaches `anchorCharacters` and is embedded as text in the prompt, but GPT Image API is called text-only (no image inputs). The photo does nothing.

The result: a user adds their mom/dad/sibling with a photo and a name, and that character is invisible in the book.

---

## Root Cause Analysis

### Gap 1: No Visual DNA for Additional Characters

**File:** `backend/providers/story-bank-loader.ts`, function `generateStoryBankCharacterDNA` (~line 232)

This function generates structured visual descriptions (hair, skin, clothing, expression, etc.) for child and companion only. It receives `storyText`, `childName`, `companionName`, `illustrationStyle` — no parameter for additional characters.

**File:** `app/api/generate/route.ts`, lines 699-706

The call to `generateStoryBankCharacterDNA` doesn't pass any additional character info.

**Result:** `anchorRegistry[characterId].description` falls back to `member.description ?? "${name} recurring family member"` (line 550) — useless for visual generation.

### Gap 2: Fragile Name Detection

**File:** `app/api/generate/route.ts`, function `detectExpectedCharactersForPage` (~line 160)

Uses `normalizeToken` + exact substring match. Character "אמא גל" is registered with aliases derived from the name. But if the story text just says "אמא" (without "גל"), no match.

### Gap 3: Single Non-Child Slot Per Page

**File:** `app/api/generate/route.ts`, lines 606-640

`boundedPagesWithCharacters` allows at most ONE non-child character per page. Companion always takes priority (line 609-611). Additional characters can only appear if the companion is absent from that page.

There IS a fallback (lines 625-639) that guarantees at least ONE page includes each additional character, but it's weak.

### Gap 4: Reference Photo Not Sent to API

**File:** `lib/generate-image.ts`, function `generateGPTImage` (~line 223)

Uses `openai.images.generate()` — text-only. No image inputs. The reference URL is embedded in the prompt text but GPT Image doesn't fetch external URLs.

**Note:** `images.edit` (multipart with image input) was intentionally avoided to preserve scene diversity. This is an architectural constraint, not a bug.

---

## Implementation Plan

### Step 1: Generate Visual DNA for Additional Characters

**File:** `backend/providers/story-bank-loader.ts`

Extend `generateStoryBankCharacterDNA` to accept an optional `additionalCharacters: Array<{ name, relationship, description }>` parameter.

Add a second LLM call (or extend the existing one) that generates structured visual DNA for each additional character:
```typescript
interface AdditionalCharacterDNA {
  name: string;
  relationship: string;
  physicalDescription: string;  // "tall woman, light brown skin, shoulder-length dark curly hair, warm brown eyes"
  clothingDefault: string;      // "cream knit sweater, olive canvas pants, brown leather sandals"
  signatureDetail: string;      // "small gold hoop earrings, warm dimpled smile"
  ageRange: string;             // "early 30s"
}
```

Use the **story text** as context — the character's name appears in the story, so the LLM can infer context about who they are.

If the user provided a `description` in the wizard, use it as a strong hint. If empty, generate purely from story context + relationship.

**Return:** Add `additionalCharactersDNA: AdditionalCharacterDNA[]` to the DNA result.

### Step 2: Wire DNA Into Anchor Registry

**File:** `app/api/generate/route.ts`

After calling `generateStoryBankCharacterDNA` (line 699-706), read `dna.additionalCharactersDNA` and update each `anchorRegistry[characterId].description` with the structured physical description.

Replace:
```typescript
description: member.description ?? `${member.name} recurring family member`
```
With:
```typescript
description: matchedDNA?.physicalDescription 
  ? `${matchedDNA.physicalDescription}. ${matchedDNA.clothingDefault}. ${matchedDNA.signatureDetail}`
  : member.description ?? `${member.name} recurring family member`
```

### Step 3: Fix Name Detection — Add Word Aliases

**File:** `app/api/generate/route.ts`, around `detectExpectedCharactersForPage`

When building aliases for a multi-word name like "אמא גל":
- Keep the full name as primary alias: `"אמא גל"`
- Also add individual words that are NOT common Hebrew words: `"גל"`
- For role-names, add the role: `"אמא"` (if relationship is "mother")

```typescript
// In the familyMembers.forEach block (~line 530)
const nameWords = member.name.split(/\s+/);
const aliases = [member.name, ...nameWords.filter(w => w.length > 1)];
if (member.relationship) {
  // Map relationship to Hebrew role names
  const roleAliases = {
    mother: ['אמא', 'אימא'],
    father: ['אבא', 'אַבָּא'],
    grandmother: ['סבתא'],
    grandfather: ['סבא'],
    sister: ['אחות'],
    brother: ['אח'],
  };
  const extras = roleAliases[member.relationship.toLowerCase()] || [];
  aliases.push(...extras);
}
```

### Step 4: Allow 2 Non-Child Characters When Additional Characters Exist

**File:** `app/api/generate/route.ts`, `boundedPagesWithCharacters` logic (~line 606)

When `familyContext.additionalCharacters` is non-empty, allow UP TO 2 non-child characters per page (companion + 1 additional). This lets the mom appear alongside the fox.

```typescript
const maxNonChild = (familyMembers.length > 0) ? 2 : 1;
```

Keep the existing priority: companion first, then additional characters by order.

### Step 5: Strengthen Supporting Character Block in Image Prompt

**File:** `backend/providers/image.ts`, around lines 1809-1826

The current `SUPPORTING CHARACTER` block only says:
```
SUPPORTING CHARACTER - [name] ([relationship]): [description]. This character MUST appear in this scene alongside the main child.
```

Replace with structured block using the DNA:
```
SUPPORTING CHARACTER - אמא גל (mother):
Physical: tall woman, light brown skin, shoulder-length dark curly hair, warm brown eyes
Clothing: cream knit sweater, olive canvas pants, brown leather sandals
Signature: small gold hoop earrings, warm dimpled smile
Age: early 30s
This character MUST appear in this scene alongside the main child. Render with the SAME level of detail and consistency as the protagonist.
```

---

## What NOT To Do

- **Do NOT try to pass reference photos as image inputs to GPT Image API.** The current architecture uses `images.generate` (text-only) intentionally. Switching to `images.edit` would break scene diversity and require major refactoring. The structured DNA approach gives 80% of the benefit.
- **Do NOT remove companion priority entirely.** The companion is the story's main supporting character. Additional characters are secondary. The fix is allowing 2 non-child chars, not removing priority.

---

## Files to Change

1. `backend/providers/story-bank-loader.ts` — extend `generateStoryBankCharacterDNA`
2. `app/api/generate/route.ts` — wire DNA, fix aliases, fix bounding
3. `backend/providers/image.ts` — upgrade supporting character prompt block

## Testing

1. Create a book with "אמא גל" as additional character
2. Verify she appears in at least 3-4 pages of a 15-page book
3. Verify her visual description is consistent across pages
4. Verify companion (fox/cat) still appears on most pages
5. Check Vercel logs for the DNA generation output
