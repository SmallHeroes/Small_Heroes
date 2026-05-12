# Phase 11 — Wire Companion-Based Story Selection (v2/v3 Story Bank)

## Context

We have 5 companions with handcrafted v3 stories in `story-bank/v3/`:
- `octopus_seara` (ANGER_FRUSTRATION)
- `bat_lily` (NIGHT_FEAR)
- `chameleon_koko` (SENSITIVITY_OVERWHELM)
- `dolphin_shahkan` (SOCIAL)
- `fawn_tzvi` (TRANSITION)

Each has 3 stories: `{companionId}_bedtime.md`, `{companionId}_adventure.md`, `{companionId}_fantasy.md`

Currently, **all story selection goes through v1** (category-based random selection from `story-bank/raw/`). We need to add a **companion-first path**: if the user's selected companion has a v3 story for their chosen direction, use it. Otherwise fall back to v1.

## What to Change

### 1. `backend/providers/story-bank-index.ts`

Add a new function `selectCompanionStory()` that checks for v3 stories:

```typescript
const V3_COMPANIONS = new Set([
  'octopus_seara',
  'bat_lily', 
  'chameleon_koko',
  'dolphin_shahkan',
  'fawn_tzvi',
]);

// Direction type matching the order.storyDirection field
type StoryDirection = 'bedtime' | 'adventure' | 'fantasy';

const V3_STORY_DIR = join(process.cwd(), 'story-bank', 'v3');

/**
 * Try to select a companion-specific v3 story.
 * Returns null if companion has no v3 story for this direction.
 */
export function selectCompanionStory(
  companionId: string | null | undefined,
  direction: string | null | undefined,
): StoryBankSelection | null {
  if (!companionId || !direction) return null;
  if (!V3_COMPANIONS.has(companionId)) return null;
  
  const dir = direction.trim().toLowerCase();
  if (dir !== 'bedtime' && dir !== 'adventure' && dir !== 'fantasy') return null;
  
  const filename = `${companionId}_${dir}.md`;
  const fullPath = join(V3_STORY_DIR, filename);
  
  if (!existsSync(fullPath)) {
    console.warn(`[story-bank] v3 file missing: ${filename}`);
    return null;
  }
  
  return {
    filename,
    base: `${companionId}_${dir}`,
    title: `v3 companion story`,
    bankCategory: 'GENERAL_FEARS' as any, // not relevant for v3 path
  };
}
```

### 2. `app/api/generate/route.ts` — Stage 1 (Story Text)

Change the story selection logic (around line 447) to try companion-first:

**Before:**
```typescript
const selection = selectStoryFromBank(challengeCategory, storyLength);
```

**After:**
```typescript
// Try companion-specific v3 story first
const direction = order.storyDirection ?? null;
let selection = selectCompanionStory(resolvedCompanion?.id, direction);
let storyBankVersion: 'v3' | 'v1' = 'v3';

if (!selection) {
  // Fall back to v1 category-based selection
  selection = selectStoryFromBank(challengeCategory, storyLength);
  storyBankVersion = 'v1';
}

if (!selection) {
  throw new Error(`No story-bank story found for category=${challengeCategory}`);
}
```

And change the file path resolution (around line 462):

**Before:**
```typescript
const storyFilePath = path.join(process.cwd(), 'story-bank', 'raw', selection.filename);
```

**After:**
```typescript
const storyDir = storyBankVersion === 'v3' ? 'v3' : 'raw';
const storyFilePath = path.join(process.cwd(), 'story-bank', storyDir, selection.filename);
```

Add `storyBankVersion` to the generation log:
```typescript
generationLogger.info('Story bank selection', {
  orderId,
  filename: selection.filename,
  storyBankVersion,
  // ... rest of existing fields
});
```

### 3. Import the new function

In `app/api/generate/route.ts`, update the import:

```typescript
import { selectStoryFromBank, selectCompanionStory } from '../../../backend/providers/story-bank-index';
```

### 4. Minor cleanup in story-bank-index.ts

Also remove the `StoryDirection` and `StoryDirectionSet` models from `backend/schema.prisma` — we deleted all rows from the database, and these models are no longer used. Remove both model blocks and the `StoryDirectionArchetype` enum. Then run `npx prisma generate` (NOT db push — we already cleaned the DB).

Remove `LORA_MODEL_STYLE_03` reference from `lib/styles.ts` if it exists (Style 03 was dropped).

## What NOT to Change

- Don't modify `loadStoryFromBank()` — it works the same regardless of v1/v3
- Don't modify the v1 pool or category mapping — it stays as fallback
- Don't change the wizard or order creation flow
- Don't rename HTML IDs (length-btns etc.) — cosmetic, not worth the risk

## Testing

1. Pick companion `octopus_seara` in wizard
2. Choose direction `adventure` (15 pages — matches v3 story exactly)
3. Generate — should log `storyBankVersion: 'v3'`
4. Pick a companion NOT in the v3 set (e.g. any of the other 31)
5. Generate — should log `storyBankVersion: 'v1'` and use old category-based selection

## Commit Message

```
Phase 11: companion-based v3 story selection + schema cleanup
```
