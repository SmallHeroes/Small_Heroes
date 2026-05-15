# Phase 9a — Story Bank v2 Cleanup

## Overview
Prepare the codebase for Story Bank v2 by removing the additional characters feature, renaming direction archetypes, adding a dedication system, and switching to static direction cards.

**Priority**: This MUST be done before any new story writing begins.

---

## Task 1: Remove Additional Characters Feature

The "additional characters" feature (wizard step 7, up to 2 extra characters) is being removed. It doesn't work with the new companion-specific story architecture.

### Files to modify:

**`public/JS/wizard.js`**
- Delete `MAX_EXTRA_CHARACTERS` constant (line ~135)
- Delete `EXTRA_CHARACTER_RELATIONS` array (lines ~146-153)
- Delete `createEmptyExtraCharacter()` function (line ~199)
- Delete `state.extraCharacters: []` from initial state (line ~292)
- Delete `additionalCharacters` mapping in payload assembly (lines ~344-362)
- Delete step init code that pushes empty character + calls `renderExtraCharacters()` (lines ~750-775)
- Delete validation/trim on step advance (lines ~1117-1118)
- Delete entire `renderExtraCharacters()` function (lines ~1469-1656)
- Delete `additionalCharacters` array building in final submission payload (lines ~2606-2648)
- **Renumber all steps after step 7** — step 7 is removed, so step 8 becomes 7, etc.

**`public/HTML/wizard.html`**
- Delete entire `<div id="step-7">` block (lines ~162-170) — the family context step with `#character-cards`
- Renumber all subsequent step divs (step-8 → step-7, step-9 → step-8, etc.)

**`public/CSS/wizard.css`**
- Delete `.char-step-shell`, `.char-grid` and related classes (lines ~1933+)
- Delete responsive breakpoints for char grid (lines ~2234, 2240)

**`public/JS/content.js`**
- Delete step 7 content strings (line ~248) — title, subtitle, labels for additional characters
- Renumber subsequent step content keys

**`app/api/orders/route.ts`**
- Delete `ExtraCharacterInput` type (line ~21)
- Delete photo upload logic for `references/additional-character-{n}` (lines ~87, 105)
- Delete extraction/trimming/persistence of `additionalCharacters` from familyContext (lines ~180-224)
- Keep the rest of familyContext normalization intact

**`app/api/generate/route.ts`**
- Delete the `additionalCharacterIds` Set and all additional characters normalization (lines ~571-813 area)
- Delete the `additionalCharacters` param being passed to story-bank-loader
- Keep companion resolution and all other generation logic intact

**`backend/providers/story-bank-loader.ts`**
- Delete `AdditionalCharacterDNA` type (lines ~396+)
- Delete `fetchAdditionalCharactersDNA()` function (~240 lines, lines ~396-634)
- Delete `fallbackAdditionalRow()` function
- Delete `additionalCharacters?` param from function signatures
- Delete conditional DNA fetch and merge logic
- Keep the rest of `loadStoryFromBank` and `generateStoryBankCharacterDNA` intact (they'll be further simplified in a later phase)

**`backend/providers/pipeline.ts`**
- Delete `additionalCharacters?` field from pipeline input type (line ~23)
- Delete additional characters log line (lines ~790-791)
- Delete additional character description string building (lines ~3532-3533)

**`backend/providers/story-directions.ts`**
- Delete the `additionalCharacters` reading from source and injection into direction prompt (lines ~115-119)

**`lib/image-storage.ts`**
- Update comment referencing extra-character previews (line ~241) — just a comment fix

**`app/api/upload-photo/route.ts`**
- Update comment referencing extra-character upload (line ~2) — route is still needed for protagonist photo

### Verification:
After removal, grep the entire codebase for `additionalCharacter`, `extraCharacter`, `extra-character`, `EXTRA_CHARACTER` — should return ZERO results (except in briefs/ documentation).

---

## Task 2: Rename Direction Archetypes

Rename: `connection` → `bedtime`, `courage` → `fantasy`. Keep `adventure` as-is.

### Type definition changes:

**`backend/providers/story-directions.ts`**
- Line 10: `export type StoryDirectionArchetype = 'bedtime' | 'adventure' | 'fantasy';`
- Update ALL conditional logic throughout the file (~20 occurrences):
  - `'connection'` → `'bedtime'`
  - `'courage'` → `'fantasy'`
- Update `parentFacingCardSummary()` — rewrite card text for bedtime and fantasy:
  - bedtime: "סיפור חם ורגוע לפני השינה שבו {{hero}} מרגיש/ה בטחון וקרבה {{companionBit}}. מתאים לרגעים שקטים ושלווים."
  - fantasy: "{{hero}} נכנס/ת לעולם בדיוני מלא הפתעות ודמיון {{companionBit}}. סיפור עם קסם, אבסורד וחופש."
- Update `environmentSnippetForPreview()` — add fantasy environment variants:
  - fantasy: floating islands, upside-down rooms, candy-colored alien landscapes, underwater kingdoms with impossible physics
- Update `getPreviewIntent()` — add fantasy intent:
  - fantasy: `type: 'world_scene'`, `camera: 'wide'`, `emotion: 'wonder'`
  - Composition: "Fantastical wide scene: impossible physics, vibrant saturated colors, dreamlike setting with child exploring the absurd"

**`backend/providers/pipeline.ts`**
- Line 63: Update type
- All conditional checks on archetype strings (~7 occurrences)

**`backend/providers/image.ts`**
- Update type annotations for `directionArchetype` (~4 occurrences)

**`lib/categoryBranching.ts`**
- Line 28: Update type
- All `flavor: 'connection'` → `flavor: 'bedtime'` (~20 occurrences across all categories)
- All `flavor: 'courage'` → `flavor: 'fantasy'` (~20 occurrences)
- **Note**: Use find-and-replace. Every category definition has exactly 3 flavors.

**`public/JS/directions.js`**
- Line 34: `ARCHETYPE_ORDER = ['bedtime', 'adventure', 'fantasy']`
- Update any label/display text for the archetypes

**`app/api/story-directions/route.ts`**
- Line 52: Update `ARCHETYPE_ORDER` constant

### Database Migration:

**Create migration: `20260511_rename_direction_archetypes`**
```sql
-- Rename enum values
ALTER TYPE "StoryDirectionArchetype" RENAME VALUE 'connection' TO 'bedtime';
ALTER TYPE "StoryDirectionArchetype" RENAME VALUE 'courage' TO 'fantasy';

-- Update existing rows (if any have stored archetype values)
UPDATE "StoryDirection" SET archetype = 'bedtime' WHERE archetype = 'connection';
UPDATE "StoryDirection" SET archetype = 'fantasy' WHERE archetype = 'courage';
```

**Update Prisma schema** (`prisma/schema.prisma`):
- Update the enum definition to match new values

### Verification:
Grep for `'connection'` and `'courage'` — should return ZERO in TypeScript/JavaScript files (may still appear in old migration files, that's OK).

---

## Task 3: Add Dedication Field

### Database:
Add `dedication` field to Order model:
```prisma
dedication String? @db.VarChar(300)
```

Create migration: `20260511_add_dedication_field`
```sql
ALTER TABLE "Order" ADD COLUMN "dedication" VARCHAR(300);
```

### Wizard:
**New wizard step** (after current "Package" step, before "Summary"):

In `wizard.html` — add new step div:
```html
<div id="step-N" class="wizard-step">
  <!-- Book Name -->
  <h2>שם הספר</h2>
  <input type="text" id="bookNameInput" placeholder="שם הספר שלך..." />
  
  <!-- Dedication (optional) -->
  <h3>הקדשה <span class="optional-badge">אופציונלי</span></h3>
  <p class="step-hint">הקדשה אישית שתופיע בדף הראשון של הספר</p>
  <textarea id="dedicationInput" maxlength="300" placeholder="לדוגמה: הספר הזה מוקדש לסבתא רות ולדוד יוסי, שתמיד שומרים על יואב"></textarea>
  <div class="char-count"><span id="dedicationCount">0</span>/300</div>
</div>
```

In `wizard.js`:
- Add `state.dedication` field (default: '')
- Move `bookNameInput` from summary step to new step
- Add char counter logic for dedication
- Include `dedication` in final payload

In `content.js`:
- Add step content strings for book name + dedication step

### Payload:
In `app/api/orders/route.ts`:
- Accept `dedication` from payload
- Persist to Order

### Reader:
- If `dedication` exists, render a dedication page before page 1
- Simple centered text on warm background
- Include in PDF and video export

**Note**: Reader dedication page implementation can be a follow-up task. The critical path is: DB field + wizard step + payload persistence.

---

## Task 4: Static Direction Cards

Replace the expensive LLM-generated direction preview images with static images.

### Create 3 static images:
- `public/directions/bedtime.jpg` — Warm indoor scene, soft lamp, cozy bed/reading corner
- `public/directions/adventure.jpg` — Outdoor trail, golden hour, open path
- `public/directions/fantasy.jpg` — Fantastical scene, floating islands, impossible physics, vibrant colors

**Generate using GPT Image** (same Style 01 as companions, 512x512). I'll prepare the generation script separately.

### Modify direction card rendering:

**`public/JS/directions.js`**
- Instead of waiting for server-generated preview images, use static images immediately
- Map archetype → static image path:
  ```javascript
  const DIRECTION_IMAGES = {
    bedtime: '/directions/bedtime.jpg',
    adventure: '/directions/adventure.jpg',
    fantasy: '/directions/fantasy.jpg'
  };
  ```

**`backend/providers/story-directions.ts`**
- `generateStoryDirectionsIncrementally()` can skip image generation entirely
- Still generate the text content (title, summary, storyPremise) for the pipeline
- The `previewImageUrl` becomes the static path

### Update card labels:

| Archetype | Hebrew Title | Emoji | Label |
|-----------|-------------|-------|-------|
| bedtime | סיפור לפני השינה | 🌙 | שקט וחם |
| adventure | הרפתקה | 🗺️ | פעולה וגילוי |
| fantasy | סיפור בדיוני | ✨ | דמיון ללא גבולות |

---

## Execution Order

1. **Task 1 first** — Remove additional characters (biggest change, most files)
2. **Task 2 second** — Rename archetypes (touches many of the same files)
3. **Task 3 third** — Add dedication (new feature, independent)
4. **Task 4 fourth** — Static direction cards (depends on renamed archetypes)

After all 4 tasks: full build + deploy + verify wizard flow end-to-end.

---

## What NOT to change yet

- `story-bank-index.ts` story selection logic — will be rewritten when new stories are ready
- `story-bank-loader.ts` {{companionName}} replacement — will be removed when new stories are wired
- Direction card generation pipeline — simplify but don't delete (needed until static cards are ready)
- Old story files in `story-bank/raw/` — keep until new stories replace them
