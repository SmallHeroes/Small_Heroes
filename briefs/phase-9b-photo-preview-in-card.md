# Phase 9b — Show Uploaded Photo Preview in Character Card

## Problem

When a user uploads a photo for an additional character (step 7), the photo shows momentarily but disappears after any navigation or page refresh. This happens because `saveWizardState()` in `wizard.js` explicitly sets `photo: null` for extra characters (line ~349) to avoid hitting the sessionStorage quota.

The user expects to always see their uploaded photo in the square preview area of the character card.

## Root Cause

In `public/JS/wizard.js`, the `saveWizardState()` function strips `photo` from all extra characters before serializing to sessionStorage. The photo is a base64 data URL (often 1-5MB), which would blow the 5MB sessionStorage quota.

## Solution — Immediate Upload + Persist URL

Upload the photo to Supabase Storage immediately on selection (similar to how the main child photo works in the generation pipeline). Store the resulting public URL (not base64) in `state.extraCharacters[index].photo`. This URL is tiny and persists fine in sessionStorage.

### Implementation Steps

### 1. Create upload endpoint (if not exists)

Check if there's already a `/api/upload-photo` or similar endpoint. If not, create one:

**File:** `app/api/upload-photo/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type.split('/')[1] || 'jpg';
  const filename = `char-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET || 'book-images')
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '31536000',
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET || 'book-images'}/${filename}`;
  return NextResponse.json({ url });
}
```

### 2. Update wizard.js — upload on photo select

In the `photoInput?.addEventListener('change', ...)` handler (around line 1555), after `reader.onload` validates the photo quality:

```javascript
// After quality check passes and photo is valid:
state.extraCharacters[index].photo = result; // keep base64 for immediate display

// Upload to server in background
const blob = await fetch(result).then(r => r.blob());
const formData = new FormData();
formData.append('file', blob, `char-${index}-${Date.now()}.jpg`);

fetch('/api/upload-photo', { method: 'POST', body: formData })
  .then(r => r.json())
  .then(data => {
    if (data.url) {
      // Replace base64 with permanent URL
      state.extraCharacters[index].photo = data.url;
      queueWizardSave();
    }
  })
  .catch(() => { /* upload failed — base64 remains in memory, lost on refresh */ });
```

### 3. Update `saveWizardState()` — persist photo URL (not base64)

Change the extra character serialization (around line 344):

```javascript
const extra = (state.extraCharacters || []).map((ch) => ({
  relation: ch.relation || '',
  name: ch.name || '',
  description: ch.description || '',
  // Persist URL (small string) but NOT base64 (huge)
  photo: ch.photo && !ch.photo.startsWith('data:') ? ch.photo : null,
  photoQuality:
    ch.photoQuality && typeof ch.photoQuality === 'object'
      ? { ...ch.photoQuality }
      : null,
}));
```

This way:
- If `photo` is a Supabase URL → persist it (tiny string, ~100 chars)
- If `photo` is still base64 (upload not yet complete) → strip it (too large)

### 4. Verify the preview renders on restore

The `renderExtraCharacters()` function already handles this correctly (line ~1484):
```javascript
${hasPhoto
  ? `<img src="${character.photo}" ...`
  : `<span class="char-photo-plus">+</span>`}
```

Since `character.photo` will now be a URL after restore, the `<img>` tag will render correctly.

## Testing

1. Upload a photo for an additional character
2. Navigate to a different step and back → photo should still show
3. Refresh the page → photo should still show (within 30min session window)
4. Generate a book → the photo URL should be passed through to the generation pipeline (it already accepts URLs)

## Files to Modify

- `app/api/upload-photo/route.ts` — new file (or reuse existing upload endpoint)
- `public/JS/wizard.js` — lines ~349 (saveWizardState) and ~1580 (photo upload handler)

## Priority

HIGH — this is visible to every user who uploads a character photo. Currently feels broken.
