# Phase 9a — Wire Story Bank into Production + Reader Text Fix

## Goal
Replace dynamic LLM story generation with pre-written story-bank stories in production.
Fix reader text overlay to remove gradient/shadow — text should feel part of the page.

---

## Part 1: Wire Story Bank into Production

### Context
Currently, `/api/generate` (route.ts) calls `generateStory(storyInput)` which runs the full LLM pipeline (`runStoryPipeline()` in `pipeline.ts`). This is slow, expensive, and produces inconsistent quality.

We have 66 pre-written, QA'd, nikud-adorned stories in `story-bank/raw/` covering 11 categories. A new `story-bank-index.ts` file has been created that maps wizard `challengeCategory` → story bank files.

### What to Change

#### File: `app/api/generate/route.ts`

**Add imports:**
```typescript
import { loadStoryFromBank } from '../../../backend/providers/story-bank-loader';
import { selectStoryFromBank } from '../../../backend/providers/story-bank-index';
import path from 'path';
```

**Replace Stage 1 (Story Text)** — lines ~435-473.

Replace:
```typescript
const story = await generateStory(storyInput);
```

With:
```typescript
// ── Select story from bank ──────────────────────────
const challengeCategory = wizardMeta.challengeCategory ?? order.topic ?? 'GENERAL_FEARS';
const storyLength = (order.storyLength as 'short' | 'medium' | 'long') ?? 'medium';
const companionName = resolvedCompanion?.name ?? 'צפרדע';

const selection = selectStoryFromBank(challengeCategory, storyLength);
if (!selection) {
  throw new Error(`No story-bank story found for category=${challengeCategory}`);
}

generationLogger.info('Story bank selection', {
  orderId,
  filename: selection.filename,
  base: selection.base,
  title: selection.title,
  bankCategory: selection.bankCategory,
  challengeCategory,
  storyLength,
});

const storyFilePath = path.join(process.cwd(), 'story-bank', 'raw', selection.filename);
const story = await loadStoryFromBank(storyFilePath, order.childName, companionName);
```

**Keep everything after the `story` variable unchanged** — the `compositionByPage`, `assignedTemplates`, `templateByPageNumber`, etc. all work the same since `loadStoryFromBank` returns the same `GeneratedStory` shape.

**Remove the `storyInput` block** (lines 439-471) — it's no longer needed since we don't call `generateStory()`. BUT keep the `selectedDirection` variable and the `resolvedCompanion` logic above it — those are still used for image generation.

**Important:** The `StoryInput` import and `generateStory` import can be removed from the top of the file since they're no longer used. Keep `FamilyContext` if it's used elsewhere.

#### File: `backend/providers/story-bank-index.ts`
Already created — no changes needed. This file exports `selectStoryFromBank()`.

#### File: `backend/providers/story-bank-loader.ts`
No changes needed — `loadStoryFromBank()` already handles `{{childName}}` and `{{companionName}}` replacement.

### Fallback Safety
If `selectStoryFromBank` returns `null` (shouldn't happen for known categories), throw an error. Don't silently fall back to dynamic generation — we want to know if the bank is missing coverage.

### Title Replacement
The story titles in the bank contain `{{childName}}` in some cases. `loadStoryFromBank` already handles this in page text but check if the title also gets childName replacement. If not, add it:
```typescript
// In story-bank-loader.ts, after extracting title:
const title = (titleMatch?.[1]?.trim() ?? 'סיפור מהבנק')
  .replace(/\{\{childName\}\}/g, childName)
  .replace(/\{\{companionName\}\}/g, companionName);
```

---

## Part 2: Reader Text Overlay — Remove Gradient and Shadow

### Current State (reader.css)
The `image_full_overlay_text` layout has:
- Dark gradient overlay on prose container: `rgba(18, 14, 10, 0.9)` → transparent
- White text: `color: #fff9f0`
- Text shadow: `text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45)`

### What the User Wants
Text should feel like part of the page — no gradient, no shadow. The images already have a light/calm top zone (via `textSafeZone` directive in prompt). So we should:
- Move text to the TOP of the page (not bottom)
- Use dark text color (not white)
- Remove the gradient background entirely
- Remove text-shadow entirely

### CSS Changes in `public/CSS/reader.css`

**Change `.reader-page-canvas[data-layout="image_full_overlay_text"] .reader-page-prose`** (~line 352):
```css
.reader-page-canvas[data-layout="image_full_overlay_text"] .reader-page-prose {
  order: unset;
  position: relative;
  z-index: 1;
  margin-top: 0;           /* was: auto (pushed to bottom) → now: top */
  margin-bottom: auto;     /* push remaining space below */
  width: 100%;
  max-width: none;
  background: none;        /* was: dark gradient → now: transparent */
  border: none;
  padding: 24px 22px 16px;
}
```

**Change `.reader-page-canvas[data-layout="image_full_overlay_text"] .reader-text`** (~line 370):
```css
.reader-page-canvas[data-layout="image_full_overlay_text"] .reader-text {
  color: #2e2a22;          /* was: #fff9f0 → now: dark brown, same as standard prose */
  text-shadow: none;       /* was: 0 1px 3px rgba(0,0,0,0.45) → removed */
  max-width: 34em;
}
```

**Also check the mobile override** (~line 551) and apply same changes:
```css
.reader-page-canvas[data-layout="image_full_overlay_text"] .reader-page-prose {
  padding: 16px 14px 12px;  /* keep compact mobile padding, remove gradient */
  background: none;
}
```

### Important: Don't Touch
- Cover page styling — cover hides prose already (`display: none`)
- `art_top_text_bottom` layout — already has dark text, no gradient
- `character_vignette_text` layout — already has appropriate styling

---

## Part 3: Verify Text Zone in Image Prompts

### Already in Place
The `textSafeZone` directive in `lib/promptBuilder.ts` (line 66-68) instructs GPT Image to keep the top 25% calm/light. This is already wired into `buildGPTImagePrompt()`.

### No Code Change Needed
Just verify by checking a rendered book that images have a clear/light top area. If they don't, the textSafeZone instruction may need strengthening — but that's a separate issue.

---

## Testing

1. Start dev server: `npm run dev`
2. Go to wizard, fill in details with any category (e.g. NIGHT_FEAR)
3. Complete order flow → trigger generation
4. Verify:
   - Story text has nikud (vowel marks)
   - Story is from the bank (check logs for "Story bank selection")
   - Child's name appears correctly throughout
   - Companion name appears correctly
   - Images generate normally (pipeline unchanged)
   - Reader shows text at TOP of page, dark color, NO gradient, NO shadow
   - Text feels like part of the illustration page

---

## Files to Modify
1. `app/api/generate/route.ts` — swap generateStory → loadStoryFromBank
2. `public/CSS/reader.css` — text overlay fixes
3. `backend/providers/story-bank-loader.ts` — title name replacement (if missing)

## Files NOT to Modify
- `backend/providers/story-bank-index.ts` — already done
- `backend/providers/pipeline.ts` — leave intact (dev route still uses it)
- `lib/promptBuilder.ts` — textSafeZone already correct
