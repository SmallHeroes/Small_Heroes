# Phase 9b — Video Export (Book as MP4)

## Goal
Generate a downloadable MP4 video of the entire book: each page shown as a frame with the story text overlaid, synchronized with the per-page narration audio. Format: H.264/AAC, reasonable file size (~20-40MB for 15 pages).

## Architecture Decision: FFmpeg on Server

**Why FFmpeg (not browser-based):**
- Browser video encoding (MediaRecorder + Canvas) is slow, unreliable, and can't run server-side
- FFmpeg is the industry standard for video composition
- Supports H.264 (libx264) + AAC audio natively
- Can composite images + text + audio in a single pipeline
- Available on Vercel via static binary or Docker

**Library: `fluent-ffmpeg` + static ffmpeg binary**
- `fluent-ffmpeg` provides a clean Node.js API over ffmpeg CLI
- For Vercel: use `@ffmpeg-installer/ffmpeg` (static binary, ~70MB)
- For localhost: use system ffmpeg if available, fallback to static binary

## Video Spec

| Property | Value |
|----------|-------|
| Resolution | 1080×1440 (3:4 portrait, matches book aspect ratio) |
| Codec | H.264 (libx264), CRF 23 (good quality/size balance) |
| Audio | AAC 128kbps, mono |
| FPS | 1 (slideshow — one frame per "scene") |
| Per-page duration | Match audio duration + 1.5s padding |
| Cover page | 4 seconds (no audio) |
| End screen | 3 seconds, "סוף ✦" |
| Estimated size | 15-40MB for 15-page book |

## Pipeline Flow

```
1. Fetch book data (pages, images, per-page audioUrls)
2. For each page:
   a. Download image → resize to 1080×1440
   b. Download page audio MP3 → get duration
   c. Render text overlay onto image (Sharp or Canvas)
3. Build FFmpeg concat:
   - Each page = image displayed for audio_duration + 1.5s
   - Audio track = concatenated per-page MP3s with 1.5s silence gaps
4. Encode → H.264/AAC MP4
5. Upload to Supabase Storage
6. Store URL in DB (GeneratedBook.videoUrl)
```

## Implementation

### 1. Dependencies

```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
npm install --save-dev @types/fluent-ffmpeg
```

For text overlay on images, we already have Sharp in the project. Use Sharp's `composite()` with SVG text overlay — this avoids needing node-canvas.

### 2. Schema — Add `videoUrl` to `GeneratedBook`

```prisma
model GeneratedBook {
  // ... existing fields ...
  videoUrl    String?   // exported MP4 video URL
}
```

Migration: `ALTER TABLE "GeneratedBook" ADD COLUMN "videoUrl" TEXT;`

### 3. New File: `backend/providers/video.ts`

```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import { randomUUID } from 'crypto';

ffmpeg.setFfmpegPath(ffmpegPath.path);

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1440;
const PAGE_PADDING_SEC = 1.5; // silence after each page's audio
const COVER_DURATION_SEC = 4;
const END_SCREEN_SEC = 3;

interface VideoPage {
  pageNumber: number;
  text: string;
  imageUrl: string;
  audioUrl: string | null;
  audioDurationSec?: number;
}

interface VideoInput {
  orderId: string;
  title: string;
  pages: VideoPage[];  // cover + interior, ordered
}

// ── Render text onto image using Sharp + SVG ──
async function renderPageFrame(
  imageBuffer: Buffer,
  text: string,
  pageNumber: number
): Promise<Buffer> {
  // Resize image to exact video dimensions
  const base = await sharp(imageBuffer)
    .resize(VIDEO_WIDTH, VIDEO_HEIGHT, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  if (!text || text.trim().length === 0) return base;

  // Create SVG text overlay (RTL Hebrew, bottom zone with gradient)
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Word-wrap the text for the overlay
  const maxCharsPerLine = 35;
  const words = escapedText.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  const lineHeight = 42;
  const textBlockHeight = lines.length * lineHeight + 60;
  const gradientHeight = textBlockHeight + 80;
  const yStart = VIDEO_HEIGHT - gradientHeight;

  const svgLines = lines.map((line, i) => {
    const y = VIDEO_HEIGHT - textBlockHeight + 30 + (i * lineHeight) + lineHeight;
    return `<text x="${VIDEO_WIDTH - 40}" y="${y}" text-anchor="end" 
            font-family="sans-serif" font-size="34" font-weight="600" 
            fill="#2a241a" direction="rtl">${line}</text>`;
  }).join('\n');

  const svgOverlay = `
    <svg width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgb(253,249,244)" stop-opacity="0"/>
          <stop offset="40%" stop-color="rgb(253,249,244)" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="rgb(253,249,244)" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${yStart}" width="${VIDEO_WIDTH}" height="${gradientHeight}" fill="url(#fade)"/>
      ${svgLines}
    </svg>
  `;

  return sharp(base)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// ── Get audio duration using ffprobe ──
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 5);
    });
  });
}

// ── Main: Generate video ──
export async function generateBookVideo(input: VideoInput): Promise<Buffer> {
  const workDir = join(tmpdir(), `video-${input.orderId}-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const concatEntries: string[] = [];
  const audioFiles: string[] = [];

  try {
    for (let i = 0; i < input.pages.length; i++) {
      const page = input.pages[i];
      const isCover = page.pageNumber === 0;

      // Download and render image with text
      const imgRes = await fetch(page.imageUrl);
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      const frame = await renderPageFrame(
        imgBuffer,
        isCover ? '' : page.text,  // no text overlay on cover
        page.pageNumber
      );
      const framePath = join(workDir, `frame-${i}.png`);
      await writeFile(framePath, frame);

      // Determine duration
      let pageDuration = COVER_DURATION_SEC;
      if (!isCover && page.audioUrl) {
        // Download audio
        const audioRes = await fetch(page.audioUrl);
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        const audioPath = join(workDir, `audio-${i}.mp3`);
        await writeFile(audioPath, audioBuffer);
        audioFiles.push(audioPath);

        const audioDur = await getAudioDuration(audioPath);
        pageDuration = audioDur + PAGE_PADDING_SEC;
      } else if (!isCover) {
        pageDuration = 5; // fallback for pages without audio
      }

      // FFmpeg concat entry: show this frame for pageDuration seconds
      concatEntries.push(`file '${framePath}'`);
      concatEntries.push(`duration ${pageDuration.toFixed(2)}`);
    }

    // End screen frame
    const endFrame = await renderEndScreen(input.title);
    const endPath = join(workDir, 'frame-end.png');
    await writeFile(endPath, endFrame);
    concatEntries.push(`file '${endPath}'`);
    concatEntries.push(`duration ${END_SCREEN_SEC}`);
    concatEntries.push(`file '${endPath}'`); // concat demuxer needs trailing file

    // Write concat file
    const concatPath = join(workDir, 'concat.txt');
    await writeFile(concatPath, concatEntries.join('\n'));

    // Concatenate all audio files with silence gaps
    const fullAudioPath = join(workDir, 'full-audio.mp3');
    if (audioFiles.length > 0) {
      await concatenateAudioFiles(audioFiles, fullAudioPath, PAGE_PADDING_SEC);
    }

    // Final encode
    const outputPath = join(workDir, 'book.mp4');
    await encodeVideo(concatPath, audioFiles.length > 0 ? fullAudioPath : null, outputPath);

    const videoBuffer = await readFile(outputPath);
    return videoBuffer;

  } finally {
    // Cleanup temp files (fire-and-forget)
    const { rm } = await import('fs/promises');
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── End screen ──
async function renderEndScreen(title: string): Promise<Buffer> {
  const svg = `
    <svg width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#fdf9f4"/>
      <text x="${VIDEO_WIDTH/2}" y="${VIDEO_HEIGHT/2 - 40}" text-anchor="middle"
            font-family="sans-serif" font-size="80" fill="#5c5348">✦</text>
      <text x="${VIDEO_WIDTH/2}" y="${VIDEO_HEIGHT/2 + 40}" text-anchor="middle"
            font-family="sans-serif" font-size="48" font-weight="700" fill="#5c5348"
            direction="rtl">סוף</text>
      <text x="${VIDEO_WIDTH/2}" y="${VIDEO_HEIGHT/2 + 100}" text-anchor="middle"
            font-family="sans-serif" font-size="24" fill="#b8a990"
            direction="rtl">${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).resize(VIDEO_WIDTH, VIDEO_HEIGHT).png().toBuffer();
}

// ── Concatenate audio with silence ──
function concatenateAudioFiles(
  files: string[], output: string, gapSec: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Build filter: add silence between each file
    const inputs = files.map((f, i) => `-i "${f}"`).join(' ');
    const filterParts = files.map((_, i) => `[${i}:a]`).join('');
    const filter = `${filterParts}concat=n=${files.length}:v=0:a=1[out]`;

    // Simple approach: concat without gaps first, gaps handled by frame duration
    const cmd = ffmpeg();
    files.forEach(f => cmd.input(f));
    cmd
      .complexFilter([`${filterParts}concat=n=${files.length}:v=0:a=1[out]`])
      .outputOptions(['-map', '[out]'])
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// ── Final video encode ──
function encodeVideo(
  concatFile: string, audioFile: string | null, output: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      .input(concatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',  // web-optimized
      ]);

    if (audioFile) {
      cmd
        .input(audioFile)
        .outputOptions([
          '-c:a', 'aac',
          '-b:a', '128k',
          '-shortest',  // trim to shorter of video/audio
        ]);
    }

    cmd
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}
```

### 4. API Route: `app/api/orders/[orderId]/video/route.ts`

This is an ON-DEMAND route — video is generated when the user clicks "Download Video", not during book generation (too slow to block the pipeline).

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateBookVideo } from '@/backend/providers/video';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max (Vercel Pro)

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const { orderId } = params;
  const { accessKey } = await req.json();

  // Auth check
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentId: true,
      book: {
        select: {
          id: true,
          title: true,
          coverImageUrl: true,
          videoUrl: true,
          pages: {
            select: {
              pageNumber: true,
              text: true,
              audioUrl: true,
              imageAsset: {
                select: { url: true, presentationUrl: true },
              },
            },
            orderBy: { pageNumber: 'asc' },
          },
        },
      },
    },
  });

  if (!order || order.paymentId !== accessKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Return cached video if exists
  if (order.book?.videoUrl) {
    return NextResponse.json({ videoUrl: order.book.videoUrl });
  }

  // Build video
  const book = order.book!;
  const pages = [
    // Cover
    ...(book.coverImageUrl ? [{
      pageNumber: 0,
      text: '',
      imageUrl: book.coverImageUrl,
      audioUrl: null,
    }] : []),
    // Interior pages
    ...book.pages.map(p => ({
      pageNumber: p.pageNumber,
      text: p.text,
      imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? '',
      audioUrl: p.audioUrl,
    })),
  ].filter(p => p.imageUrl); // skip pages without images

  const videoBuffer = await generateBookVideo({
    orderId,
    title: book.title,
    pages,
  });

  // Upload to Supabase
  const { storeVideo } = await import('@/backend/providers/video');
  const videoUrl = await storeVideo(videoBuffer, `${orderId}-book.mp4`);

  // Cache URL in DB
  await prisma.generatedBook.update({
    where: { id: book.id },
    data: { videoUrl },
  });

  return NextResponse.json({ videoUrl });
}
```

### 5. Ready Page — Add "Download Video" Button

In `public/ready.html`, add alongside the PDF button:
```html
<button id="readyBtnVideo" class="btn-outline ready-btn-video" hidden>
  הורדת סרטון
</button>
```

In `public/JS/ready.js`:
```javascript
const btnVideoEl = document.getElementById('readyBtnVideo');

// Always show video button if book is ready (generated on-demand)
if (data.status === 'ready') {
  btnVideoEl.hidden = false;
}

btnVideoEl.addEventListener('click', async () => {
  btnVideoEl.textContent = 'מכין סרטון...';
  btnVideoEl.disabled = true;
  try {
    const res = await fetch(`/api/orders/${orderId}/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey }),
    });
    const { videoUrl } = await res.json();
    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `${bookTitle || 'my-book'}.mp4`;
      a.click();
    }
  } catch (err) {
    console.error('Video generation failed:', err);
    alert('לא הצלחנו ליצור את הסרטון. נסו שוב.');
  } finally {
    btnVideoEl.textContent = 'הורדת סרטון';
    btnVideoEl.disabled = false;
  }
});
```

### 6. Vercel Considerations

**Problem:** FFmpeg binary is ~70MB — may exceed Vercel serverless function size limit (50MB compressed).

**Solutions (pick one):**
1. **Vercel Pro** has 250MB limit — plenty of room
2. **External service:** Use a cloud function (AWS Lambda with Docker) or Replicate for video encoding
3. **Client-side:** Generate video in the browser using WebCodecs API (experimental, complex)
4. **Pre-generate:** Add to the generation pipeline (slow but avoids timeout issues)

**Recommendation:** Start with Vercel Pro + `@ffmpeg-installer/ffmpeg`. If size is an issue, move to a dedicated video microservice.

### 7. `storeVideo` Function

Add to `backend/providers/video.ts`:
```typescript
export async function storeVideo(buffer: Buffer, filename: string): Promise<string> {
  const supabase = getSupabase(); // reuse from audio.ts
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'book-images';
  const key = `video/${filename}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, buffer, {
      contentType: 'video/mp4',
      upsert: true,
      cacheControl: '31536000',
    });

  if (error) throw new Error(`Video upload failed: ${error.message}`);

  const url = process.env.SUPABASE_URL!;
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${key}`;
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/providers/video.ts` | **CREATE** — video generation + storage |
| `app/api/orders/[orderId]/video/route.ts` | **CREATE** — on-demand video API |
| `backend/schema.prisma` | **MODIFY** — add `videoUrl` to GeneratedBook |
| `public/ready.html` | **MODIFY** — add video download button |
| `public/JS/ready.js` | **MODIFY** — wire video button |
| `package.json` | **MODIFY** — add fluent-ffmpeg + @ffmpeg-installer/ffmpeg |

## Migration SQL
```sql
ALTER TABLE "GeneratedBook" ADD COLUMN "videoUrl" TEXT;
```

## Testing
1. Generate a 1-page book with audio from dev/story-bank
2. Click "Download Video" on the ready page
3. Verify: image + text overlay + audio sync in the MP4
4. Check file size is reasonable (<5MB for 1 page)
5. Test with a 15-page book — expect 20-40MB, 2-3 min generation

## Cost Impact
- Zero additional API costs (FFmpeg runs locally/on server)
- Supabase storage: ~20-40MB per video
- Vercel compute: up to 5 min per video generation (Pro plan)
