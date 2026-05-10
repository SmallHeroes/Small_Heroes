# Phase 9a — Style 03 "עולם קסום מפורט" — DB Migration + UI Wiring

## Context

A third illustration style has been added to `lib/styles.ts` and `lib/visualDirector.ts`.
- Style ID: `detailed_whimsical_world`
- DB value: `detailed_whimsical_world`
- Hebrew label: "עולם קסום מפורט"

The style contract, rendering descriptions, imageNudge, optionBlock, all rules, and visualDirector sentence are **already complete**. This brief covers the remaining plumbing to make it work end-to-end.

## What's Already Done (DO NOT TOUCH)

- `lib/styles.ts` — full StyleContract added, STYLE_IDS updated, WIZARD_STYLE_ORDER updated, all maps updated
- `lib/visualDirector.ts` — resolveStyleSentence case added

## Tasks for Cursor

### 1. Prisma Schema — Add Enum Value

**File:** `backend/schema.prisma`

Add `detailed_whimsical_world` to the `IllustrationStyle` enum:

```prisma
enum IllustrationStyle {
  pencil_watercolor
  realistic_illustrated
  whimsical_comic_fantasy
  detailed_whimsical_world
}
```

Then run migration:
```bash
npx prisma migrate dev --name add-detailed-whimsical-world-style
```

And regenerate client:
```bash
npx prisma generate
```

### 2. Wizard Style Picker — Support 3 Cards

**Current state:** The wizard style picker shows 2 style cards side by side.
**Required:** Show 3 style cards. Layout should adapt — either 3 columns on desktop or a scrollable row.

**Files to check:**
- `public/wizard.html` — the style picker step
- `public/css/wizard.css` — style card layout
- `public/js/wizard.js` — style selection logic

**Rules:**
- Each card needs a preview image at `/images/style-preview-03.webp` (placeholder OK for now — can use any detailed illustration image temporarily)
- The card should show the Hebrew label "עולם קסום מפורט" and the wizardBlurb from the style contract
- Selected state should work the same as the existing cards
- Grid should NOT break on mobile — use responsive layout (3 cols on desktop, stack or scroll on mobile)

### 3. Style Preview Image

A preview image is needed at `/images/style-preview-03.webp`.

For now: create a placeholder by copying one of the existing preview images. The actual preview will be generated separately via GPT Image with the Style 03 prompt.

### 4. Landing Page Gallery — Add Style 03 Toggle

**Current state:** Gallery toggles between Style 01 and Style 02.
**Required:** Add Style 03 as a third toggle option.

**Files:**
- `public/js/landing.js` — gallery toggle logic
- `public/js/content.js` — gallery content/labels

**Note:** Gallery images for Style 03 don't exist yet. For now, the toggle can show a "coming soon" state or reuse Style 01 images as placeholder. The actual gallery images will be generated separately.

### 5. Verify Build

After all changes:
```bash
npm run build
```

Must pass without errors. The new enum value in Prisma must match the TypeScript type.

## What NOT to Do

- Do NOT modify `lib/styles.ts` or `lib/visualDirector.ts` — these are complete
- Do NOT change the style contract content, renderingDescription, or optionBlock
- Do NOT reorder the styles in WIZARD_STYLE_ORDER
- Do NOT remove any existing style or legacy mapping

## Testing

After implementation:
1. `npm run build` passes
2. Wizard shows 3 style cards
3. Selecting Style 03 sets `illustrationStyle` to `detailed_whimsical_world` in the order
4. Book generation with Style 03 should use the correct prompts (verify via console logs)
