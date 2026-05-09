# Phase 9a — Per-Page Audio (ElevenLabs)

## Goal
Replace the current single-file-for-entire-book audio with **per-page audio files** that auto-play when each page is displayed in the reader.

## Current State
- `generateAudio()` in `backend/providers/audio.ts` concatenates ALL page narration texts into one string via `buildNarrationScript()`, sends one API call to ElevenLabs, stores one MP3 file
- `AudioAsset` model is linked to `GeneratedBook` (one audio per book)
- Reader (`reader-v2.tsx`) has a single `<audio>` element with one `audioUrl`, manual play/pause button
- API response (`/api/orders/[orderId]`) returns `book.audioUrl` as a single URL

## Target State
- Each page gets its own MP3 file generated independently
- Reader auto-plays the current page's audio 1 second after page transition
- Smooth experience: user flips page → short pause → narration begins

## Architecture Changes

### 1. Schema — Add `audioUrl` to `BookPage`

```prisma
model BookPage {
  // ... existing fields ...
  audioUrl    String?   // per-page narration MP3 URL
}
```

Run: `npx prisma migrate dev --name add-page-audio-url`

Keep the existing `AudioAsset` model for now (backward compat). New books will use per-page audio; old books still have the single-file fallback.

### 2. Backend — `backend/providers/audio.ts`

**Add new function** `generatePageAudio()`:

```typescript
export async function generatePageAudio(input: {
  narrationText: string;
  voiceId: string;
  sleepMode: boolean;
  orderId: string;
  pageNumber: number;
}): Promise<{ url: string }> {
  const voice = getVoiceById(input.voiceId);
  if (!voice) throw new Error(`Unknown voice: ${input.voiceId}`);

  // Apply pacing to this single page's text
  let text = input.narrationText;
  if (input.sleepMode) {
    text = text.replace(/\./g, '......... ').replace(/,/g, ',...  ');
  } else {
    text = text.replace(/\./g, '... ').replace(/,/g, ',  ');
  }

  // Call ElevenLabs (no voice_settings — use stored defaults)
  const audioBuffer = await callElevenLabs(text, voice.elevenlabsVoiceId);

  const filename = `${input.orderId}-page${input.pageNumber}${input.sleepMode ? '-sleep' : ''}.mp3`;
  const url = await storeAudio(audioBuffer, filename);
  return { url };
}
```

**Keep** existing `generateAudio()` and `buildNarrationScript()` — they're still used for the single-file fallback.

**Make `callElevenLabs` and `storeAudio` exportable** (they're currently module-private). Either export them or keep `generatePageAudio` in the same file.

### 3. Generation Route — `app/api/generate/route.ts`

Replace the audio generation block (lines ~1129-1179) with per-page generation:

```typescript
// ── Stage 3: Audio (optional) ─────────────────────
if (order.audioEnabled && order.selectedVoice) {
  await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'running' } });

  try {
    // Generate audio for each page in parallel (batch of 3 to avoid rate limits)
    const pageChunks = chunkArray(story.pages, 3); // helper: split array into chunks of N
    for (const chunk of pageChunks) {
      await Promise.all(
        chunk.map(async (page) => {
          if (!page.narrationText) return;
          try {
            const result = await generatePageAudio({
              narrationText: page.narrationText,
              voiceId: order.selectedVoice,
              sleepMode: order.sleepMode,
              orderId,
              pageNumber: page.pageNumber,
            });
            // Update BookPage with audioUrl
            await prisma.bookPage.updateMany({
              where: { bookId: book.id, pageNumber: page.pageNumber },
              data: { audioUrl: result.url },
            });
          } catch (err) {
            console.warn(`[Audio] Page ${page.pageNumber} audio failed:`, err);
            // Non-fatal — page just won't have audio
          }
        })
      );
    }

    await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'done' } });
  } catch (audioErr) {
    // ... existing error handling ...
  }
}
```

**Add helper** at top of file or in a utils module:
```typescript
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
```

### 4. API Response — `app/api/orders/[orderId]/route.ts`

Add `narrationText` field to BookPage select (needed for page audio), and include `audioUrl` per page:

In the Prisma select for book pages (~line 126), add:
```typescript
narrationText: true,
audioUrl: true,
```

In the page mapping (~line 185), include:
```typescript
audioUrl: p.audioUrl ?? null,
```

The top-level `book.audioUrl` (from AudioAsset) stays as fallback.

### 5. Reader — `reader-v2.tsx`

**A. Add `audioUrl` to page types:**

```typescript
type BookPage = {
  // ... existing fields ...
  audioUrl?: string | null;
};

type ReaderPage = {
  // ... existing fields ...
  audioUrl: string | null;
};
```

In `normalizeReaderPages`, carry through:
```typescript
audioUrl: page.audioUrl ?? null,
```

**B. Replace single-audio with per-page auto-play:**

Remove the old `audioUrl` state (single book-level URL).

Add per-page audio effect:
```typescript
// Auto-play page audio 1 second after page changes
useEffect(() => {
  const audio = audioRef.current;
  if (!audio || !currentPage?.audioUrl) return;

  // Stop any currently playing audio
  audio.pause();
  audio.currentTime = 0;
  audio.src = currentPage.audioUrl;
  audio.load();

  const timer = setTimeout(async () => {
    try {
      await audio.play();
    } catch {
      // Auto-play blocked by browser — user must interact first
      console.log('[read-v2] auto-play blocked, user interaction required');
    }
  }, 1000);

  return () => clearTimeout(timer);
}, [currentPageIndex, currentPage?.audioUrl]);
```

**C. Update controls:**

The audio button stays but works per-page:
- If current page has `audioUrl` → show play/pause button
- If no audio for this page → hide button
- Toggle function uses `audioRef.current` which is already set to the current page's audio

**D. Browser auto-play policy:**

Browsers block auto-play until the user has interacted with the page. Since the user clicks "הבא" (next) to navigate, that counts as interaction — so auto-play on subsequent pages will work. For the FIRST page (cover), auto-play may be blocked. That's fine — the cover usually has no narration. The first interior page will auto-play after the user clicks "הבא" from the cover.

### 6. Story Bank Dev Route — `app/api/dev/story-bank/route.ts`

The dev route currently sets `audioStatus: 'done'` but doesn't generate audio. For testing per-page audio, add an optional `generateAudio` flag to the dev UI:

In the request body type, add:
```typescript
generateAudio?: boolean;
```

After image generation is complete and before marking order as ready, if `generateAudio` is true:
```typescript
if (generateAudio && story.pages.length > 0) {
  const { generatePageAudio } = await import('@/backend/providers/audio');
  for (const page of story.pages) {
    if (!page.narrationText) continue;
    try {
      const result = await generatePageAudio({
        narrationText: page.narrationText,
        voiceId: 'mom', // default voice for dev testing
        sleepMode: false,
        orderId: order.id,
        pageNumber: page.pageNumber,
      });
      await prisma.bookPage.updateMany({
        where: { bookId: book.id, pageNumber: page.pageNumber },
        data: { audioUrl: result.url },
      });
    } catch (err) {
      console.warn(`[StoryBank] Audio failed for page ${page.pageNumber}:`, err);
    }
  }
}
```

Also add a checkbox to the dev UI page (`app/dev/story-bank/page.tsx`):
```tsx
const [generateAudio, setGenerateAudio] = useState(false);
// ... add to request body JSON
// ... add checkbox UI
```

## Cost Impact
- No change. Total characters sent to ElevenLabs is the same whether we send one big request or 15 small ones.
- 15-page book: ~2,400 chars × $0.12/1K = ~$0.29 per book
- Parallel batches of 3 keep latency reasonable (~5 API calls instead of 15 sequential)

## Migration
- Old books with `AudioAsset` but no per-page `audioUrl` continue to work — reader falls back to `book.audioUrl`
- New books get per-page audio. No data migration needed.

## Files to Change
1. `backend/schema.prisma` — add `audioUrl` to BookPage
2. `backend/providers/audio.ts` — add `generatePageAudio()` function
3. `app/api/generate/route.ts` — replace single audio generation with per-page loop
4. `app/api/orders/[orderId]/route.ts` — include `audioUrl` in page response
5. `app/book/[id]/read-v2/reader-v2.tsx` — per-page audio + auto-play + controls
6. `app/api/dev/story-bank/route.ts` — optional audio generation in dev route
7. `app/dev/story-bank/page.tsx` — add "Generate Audio" checkbox

## Testing
1. Run `npx prisma migrate dev --name add-page-audio-url`
2. Go to `/dev/story-bank`, select 1 page + skip cover + generate audio
3. Open the book → verify audio auto-plays after 1 second
4. Navigate pages → verify each page plays its own audio
5. Test play/pause button works per-page
6. Test a book with NO audio → verify no errors, button hidden
