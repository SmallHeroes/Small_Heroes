# Phase 8c — Wire Page-Length Variants into Story-Bank Loader

## Problem

All 66 story-bank stories are 15 pages. The wizard offers 10/15/20 page options.  
When a user orders a 10 or 20-page book, the story-bank path doesn't know what to do.

## Solution

Story-bank now has variant files:
- `batch-01_1a.md` → 15 pages (original)
- `batch-01_1a_10p.md` → 10 pages (retelling for ages 3-4)
- `batch-01_1a_20p.md` → 20 pages (retelling for ages 6-7)

The loader must select the correct variant based on `storyLength`.

## Changes Required

### 1. Update story-bank-loader.ts — variant file selection

**File:** `backend/providers/story-bank-loader.ts`

In the function that loads a story file (likely `loadStoryFromBank` or similar), add variant resolution:

```ts
function resolveStoryFilename(baseFilename: string, storyLength: 'short' | 'medium' | 'long'): string {
  if (storyLength === 'medium') return baseFilename; // 15 pages = original
  
  const suffix = storyLength === 'short' ? '_10p' : '_20p';
  const variantFilename = baseFilename.replace('.md', `${suffix}.md`);
  
  // Check if variant exists, fallback to original
  const variantPath = path.join(RAW_DIR, variantFilename);
  if (fs.existsSync(variantPath)) return variantFilename;
  
  console.warn(`Variant ${variantFilename} not found, falling back to ${baseFilename}`);
  return baseFilename;
}
```

### 2. Pass storyLength through to the loader

**File:** `app/api/generate/route.ts` (or wherever story-bank selection happens)

Ensure the `storyLength` from the order reaches the story-bank loader:

```ts
const storyFile = resolveStoryFilename(selectedStoryFile, order.storyLength || 'medium');
```

### 3. Update story-bank dev route

**File:** `app/api/dev/story-bank/route.ts`

The dev route should also support length selection. Add a `length` query param:

```ts
const storyLength = (searchParams.get('length') || 'medium') as 'short' | 'medium' | 'long';
```

### 4. Update story-bank index (if applicable)

If there's a story index file (`story-bank/index.ts` or similar), it should list available variants per story so the selector knows what's available.

## Files to Edit

1. `backend/providers/story-bank-loader.ts` — add variant resolution
2. `app/api/generate/route.ts` — pass storyLength to loader
3. `app/api/dev/story-bank/route.ts` — support length in dev UI

## Fallback Behavior

If a variant file doesn't exist for a given story+length combo, **use the 15-page original**.  
This is important during the transition period while we generate all variants.

## Testing

1. Order a 10-page book → should get 10-page story with 10 illustrations
2. Order a 15-page book → should get original 15-page story
3. Order a 20-page book → should get 20-page story with 20 illustrations
4. Order a 10-page book for a story without a 10p variant → should fallback to 15-page
