# Phase 3e.4 — Magical scene prompts + image-based text color

## Context
Two problems:
1. Scene translations are technically accurate but lack magic, wonder, and emotional expressiveness. The book is supposed to feel enchanted.
2. Text color is derived from `lighting` (a storyboard field) — but this is a guess from the prompt, not from the actual generated image. Result: sometimes wrong color on wrong background.

## Tasks

### T1 — Enhance scene translation for magic + expressions

In `backend/providers/image.ts`, the `translateSceneForImage` function (around line 438).

**Update the system prompt rules.** Replace the existing rules array with:

```typescript
const systemPrompt = [
  "You are an illustration director for a magical children's picture book. Given a page of Hebrew story text and context about the characters, produce a vivid English scene description for an image generation model.",
  '',
  'Rules:',
  '- Describe the VISUAL SCENE with wonder and enchantment — this is a magical storybook, not a documentary',
  '- EMPHASIZE facial expressions and body language: wide eyes for wonder, bright smile for joy, furrowed brow for worry, hands reaching out in excitement',
  '- Include magical visual elements: glowing particles, sparkles, ethereal light, enchanted objects, dreamlike atmosphere',
  '- Describe the physical environment with rich sensory detail: textures, colors, lighting, shadows, reflections',
  '- Name the characters by name (e.g. "Maya" not "the child")',
  '- Describe the companion creature by its visual appearance if present — give it personality through pose and expression',
  '- Be concrete and cinematic — "Maya gazes up with wide sparkling eyes as golden fireflies swirl around her outstretched fingers, the bedroom walls glowing with projected constellations" not "the girl looks at lights in her room"',
  '- Make every scene feel like a painting you want to stare at — rich in detail, emotion, and atmosphere',
  '- Do NOT include style instructions, camera angles, or composition directions',
  '- Do NOT include any text about "no text" or "pure illustration"',
  '- Output ONLY the scene description, nothing else',
  '- 80-120 words',
].join('\n');
```

Key changes: "magical", "enchantment", "facial expressions", "body language", "magical visual elements", "cinematic", "painting you want to stare at".

### T2 — Image-based text color detection (replace lighting-based guess)

After each page image is generated and stored, analyze the actual image pixels in the text zone area to determine if the background is light or dark. Store the result as `textColorScheme` on BookPage.

**Step 1: Add column**

In `backend/schema.prisma`, add to BookPage:
```prisma
model BookPage {
  // ... existing fields ...
  textZone         String?
  lighting         String?
  textColorScheme  String?   // 'light' | 'dark' — derived from actual image luminance
}
```

Run `npx prisma db push` then `npx prisma generate`.

**Step 2: Create luminance analysis function**

Create a new file `backend/providers/image-analysis.ts`:

```typescript
import sharp from 'sharp';

/**
 * Analyze the luminance of a specific zone (top or bottom 35%) of an image.
 * Returns 'light' or 'dark' based on average brightness.
 * 
 * - If the zone is bright → text should be dark → return 'dark'
 * - If the zone is dim → text should be light → return 'light'
 */
export async function analyzeTextZoneLuminance(
  imageUrl: string,
  textZone: 'top_clear' | 'bottom_clear' | string,
): Promise<'light' | 'dark'> {
  try {
    // Fetch image
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`fetch_failed_${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width ?? 800;
    const height = metadata.height ?? 1200;

    // Define the zone to sample (top or bottom 35%)
    const zoneHeight = Math.round(height * 0.35);
    const top = textZone === 'top_clear' ? 0 : height - zoneHeight;

    // Extract zone and get average color
    const { channels } = await sharp(buffer)
      .extract({ left: 0, top, width, height: zoneHeight })
      .resize(50, 50, { fit: 'fill' }) // downsample for speed
      .raw()
      .toBuffer({ resolveWithObject: true });

    // channels is [r,g,b,r,g,b,...] or [r,g,b,a,...]
    const pixelCount = 50 * 50;
    const channelCount = channels;
    const pixels = await sharp(buffer)
      .extract({ left: 0, top, width, height: zoneHeight })
      .resize(50, 50, { fit: 'fill' })
      .raw()
      .toBuffer();

    let totalLuminance = 0;
    for (let i = 0; i < pixels.length; i += channelCount) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // Perceived luminance (ITU-R BT.709)
      totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const avgLuminance = totalLuminance / pixelCount;

    // Threshold: 0-255 scale. Below 128 = dark background → light text
    const scheme = avgLuminance < 128 ? 'light' : 'dark';

    console.log(
      `[text_color_analysis] zone=${textZone} avgLuminance=${avgLuminance.toFixed(1)} scheme=${scheme}`
    );

    return scheme;
  } catch (error) {
    console.warn(
      `[text_color_analysis_fallback] error=${error instanceof Error ? error.message : String(error)}`
    );
    // Fallback: derive from lighting field if available
    return 'dark'; // safe default — dark text on assumed light background
  }
}
```

**Step 3: Call analysis after each image is stored**

In `app/api/generate/route.ts`, right after the `imageAsset.create` call (around line 882-894), add:

```typescript
// Analyze actual image luminance for text color
try {
  const imageUrlForAnalysis = presentationUrl || image.url;
  const textZoneForPage = /* get from the textZones map */ textZones.get(page.pageNumber) ?? 'bottom_clear';
  const { analyzeTextZoneLuminance } = await import('@/backend/providers/image-analysis');
  const textColorScheme = await analyzeTextZoneLuminance(imageUrlForAnalysis, textZoneForPage);
  await prisma.bookPage.update({
    where: { id: page.id },
    data: { textColorScheme },
  });
} catch (analysisErr) {
  console.warn('[text_color_analysis] failed, keeping default', analysisErr);
}
```

**Step 4: Return textColorScheme from orders API**

In `app/api/orders/[orderId]/route.ts`, add `textColorScheme: true` to the page select, and add `textColorScheme: p.textColorScheme ?? null` to contentPages.

**Step 5: Use real textColorScheme in reader**

In `reader-v2.tsx`, the `deriveTextColorScheme` function currently guesses from lighting. Update it to prefer the DB value:

```typescript
function deriveTextColorScheme(
  textColorScheme: string | null | undefined,
  lighting: string | null | undefined,
): TextColorScheme {
  // Prefer image-analysis result if available
  if (textColorScheme === 'light' || textColorScheme === 'dark') return textColorScheme;
  // Fallback to lighting-based guess
  const darkLightingModes = ['moonlit', 'dramatic_soft'];
  if (lighting && darkLightingModes.includes(lighting)) return 'light';
  return 'dark';
}
```

Update the `BookPage` type to include `textColorScheme`:
```typescript
type BookPage = {
  // ... existing ...
  textColorScheme?: string | null;
};
```

Update `normalizeReaderPages` to pass both:
```typescript
textColorScheme: deriveTextColorScheme(page.textColorScheme, page.lighting),
```

### T3 — Enhance protagonist lock with expression guidance

In `backend/providers/image.ts`, the `buildCompactProtagonistLock` function (around line 1053), at the end before the return:

Change the compact sentence to include expression guidance:

After the existing `compact` variable is built, add:
```typescript
const withExpression = `${compact}. Expressive face — show clear emotions matching the scene.`;
```

Return `withExpression` instead of `compact`.

## Safety
- `npx prisma db push` needed for new `textColorScheme` column
- T1 only changes prompt text — no pipeline changes
- T2 runs AFTER image is stored, so it can't break image generation — it's a separate analysis step. If it fails, falls back to lighting-based guess.
- T3 adds one sentence to the protagonist lock — minimal prompt length impact
- sharp is already in dependencies
- `npm run build` must pass

## Acceptance criteria
- `npm run build` passes
- Generate a new book with night scenes (e.g. bedtime theme)
- Check logs for `[text_color_analysis]` — should show luminance values and scheme per page
- Check logs for `[scene_translate_text]` — scenes should mention expressions, magical elements
- In reader: dark background pages should have light text, light background pages should have dark text — based on actual image analysis, not guessing
- `[protagonist_lock_compact]` log should end with expression guidance

## Verification
1. Generate a new book
2. Check DB: `textColorScheme` populated per page
3. Open in reader — verify text color matches actual background
4. Check scene translation logs — should be more vivid and magical than before
5. Compare with previous generation — scenes should feel more enchanted

## Return format
- **GO / NO-GO**
- **Files changed**
- **DB migration** — confirm db push ran
- **Sample `[text_color_analysis]` log** — paste 3-4 lines showing luminance values
- **Sample `[scene_translate_text]` log** — paste 2-3 translated scenes (should show magical language)
- **Sample `[protagonist_lock_compact]` log** — should include expression line

## Git commit (after GO)
```
phase 3e.4: magical scene prompts + image-based text color

T1: scene translation prompt enhanced — emphasize magic, expressions, cinematic detail
T2: text color derived from actual image luminance (sharp pixel sampling in text zone)
    replaces lighting-based guess — now accurate per page
T3: protagonist lock includes expression guidance
```

Stage:
```powershell
git add backend/schema.prisma backend/providers/image.ts backend/providers/image-analysis.ts app/api/generate/route.ts app/api/orders/[orderId]/route.ts app/book/[id]/read-v2/reader-v2.tsx
git diff --cached --stat
```
