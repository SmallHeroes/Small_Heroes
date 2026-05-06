# Phase 5a: GPT Image Integration — Full Pipeline

## TL;DR

Replace Flux+LoRA with GPT Image API (`gpt-image-1`) for **Style 01** image generation.
This includes: book page illustrations, cover image, AND the 3 direction preview cards.
Style 02 stays on Replicate+LoRA — untouched.

**The approved style prompt (v5 — cartoon-realistic hybrid)** was tested across 5 rounds of iteration and approved by Guy. It produces warm, Pixar-like watercolor illustrations with 40% open top for text.

---

## 1. `lib/env.ts` — Add `gpt-image` provider

**File:** `lib/env.ts`

### 1a. Add type
```typescript
// Line 4: change from
type ImageProvider = 'replicate' | 'dall-e-3';
// to
type ImageProvider = 'replicate' | 'dall-e-3' | 'gpt-image';
```

### 1b. Update normalizer
```typescript
// ~Line 52: change normalizeImageProvider to recognize 'gpt-image'
function normalizeImageProvider(value: string | undefined): ImageProvider {
  const raw = (value ?? 'replicate').trim().toLowerCase();
  if (raw === 'dall-e-3') return 'dall-e-3';
  if (raw === 'gpt-image') return 'gpt-image';
  return 'replicate';
}
```

### 1c. Add validation
```typescript
// ~Line 111: add after the dall-e-3 check
if (!imageGenerationDisabled && IMAGE_PROVIDER === 'gpt-image' && !OPENAI_API_KEY) {
  errors.push('OPENAI_API_KEY is required when IMAGE_PROVIDER=gpt-image');
}
```

---

## 2. `lib/image-storage.ts` — Add `storeImageFromBuffer()`

GPT Image returns base64, not a URL. Add this new export:

```typescript
export interface StoreBufferInput {
  buffer: Buffer;
  orderId?: string;
  pageNumber: number;
  assetType?: 'page' | 'cover';
  contentType?: string; // default: 'image/png'
}

export async function storeImageFromBuffer(input: StoreBufferInput): Promise<string> {
  const { url, bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();

  const contentType = input.contentType || 'image/png';
  const ext = extensionFromContentType(contentType);
  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key =
    input.assetType === 'cover'
      ? `${folder}/cover/cover-${Date.now()}.${ext}`
      : `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-${Date.now()}.${ext}`;

  const uploadResult = await supabase.storage.from(bucket).upload(key, input.buffer, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  });

  if (uploadResult.error) {
    throw new Error(`Supabase buffer upload failed: ${uploadResult.error.message}`);
  }

  return buildPublicUrl(url, bucket, key);
}
```

This is nearly identical to `storePresentationBuffer` but accepts any content type and supports cover/page path logic.

---

## 3. `lib/generate-image.ts` — Add `generateGPTImage()`

Add alongside the existing `generateReplicateImage`:

```typescript
import OpenAI from 'openai';

export interface GenerateGPTImageInput {
  finalPrompt: string;
  negativePrompt?: string;
  referenceImageUrl?: string;   // Child's photo URL from Supabase
  size?: '1024x1536' | '1024x1024';
  quality?: 'low' | 'medium' | 'high';
}

export interface GenerateGPTImageResult {
  buffer: Buffer;           // Raw PNG buffer (base64-decoded)
  model: string;
  finalPrompt: string;
  hasReferencePhoto: boolean;
  durationMs: number;
}

export async function generateGPTImage(input: GenerateGPTImageInput): Promise<GenerateGPTImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY for GPT Image generation');

  const openai = new OpenAI({ apiKey });
  const size = input.size || '1024x1536';
  const quality = input.quality || (process.env.GPT_IMAGE_QUALITY as 'low' | 'medium' | 'high') || 'high';

  // Build full prompt with negative constraints
  let fullPrompt = input.finalPrompt;
  if (input.negativePrompt) {
    fullPrompt += `\n\nAvoid: ${input.negativePrompt}`;
  }

  const startMs = Date.now();
  let b64: string | undefined;

  if (input.referenceImageUrl) {
    // ── Photo-to-illustration: use images.edit endpoint ──
    console.info(`[GPTImage] Using edit endpoint with reference photo, size=${size} quality=${quality}`);
    const photoRes = await fetch(input.referenceImageUrl);
    if (!photoRes.ok) {
      console.warn(`[GPTImage] Failed to download reference photo (${photoRes.status}), falling back to text-only`);
      // Fall through to text-only generation below
    } else {
      const photoBuffer = await photoRes.arrayBuffer();
      const photoFile = new File([photoBuffer], 'reference.png', { type: 'image/png' });
      const response = await openai.images.edit({
        model: 'gpt-image-1',
        image: photoFile,
        prompt: fullPrompt,
        size: size as any,
        quality: quality as any,
      });
      b64 = response.data?.[0]?.b64_json ?? undefined;
    }
  }

  if (!b64) {
    // ── Text-only generation ──
    console.info(`[GPTImage] Using generate endpoint (text-only), size=${size} quality=${quality}`);
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: fullPrompt,
      size: size as any,
      quality: quality as any,
      n: 1,
    });
    b64 = response.data?.[0]?.b64_json ?? undefined;
  }

  if (!b64) throw new Error('GPT Image API returned no image data');

  const buffer = Buffer.from(b64, 'base64');
  const durationMs = Date.now() - startMs;

  console.info(`[GPTImage] Done in ${durationMs}ms, buffer=${Math.round(buffer.length / 1024)}KB, hasRef=${!!input.referenceImageUrl}`);

  return {
    buffer,
    model: 'gpt-image-1',
    finalPrompt: fullPrompt,
    hasReferencePhoto: !!input.referenceImageUrl,
    durationMs,
  };
}
```

---

## 4. `backend/providers/image.ts` — The Big One

### 4a. Add the GPT Image style prompt constant

Add near the top of the file (after imports), the **approved v5 style prompt**:

```typescript
// ── GPT Image Style Prompt (v5 — cartoon-realistic hybrid, approved 2026-05-04) ──
const GPT_IMAGE_STYLE_PROMPT = `Children's storybook illustration — cartoon-realistic style:
- Warm, inviting illustrated style for a children's book — like a modern Pixar concept art painting
- Characters have realistic human proportions but with a gentle, approachable softness
- Natural-looking children — real hair, real skin tones, expressive faces — but rendered softly, not photorealistic
- Smooth, clean rendering — NOT heavy oil painting brushstrokes, NOT thick impasto texture
- The look should feel like a high-quality animated film still, painted with warmth
- Warm cheerful lighting — golden and inviting, not dark or somber
- The mood should feel happy, safe, and magical — like a beautiful children's book
- Natural color palette with gentle variety — soft greens, warm blues, natural earth tones, cozy warm light
- Colors should feel natural and harmonious, not oversaturated or neon
- Background dissolves into soft warm watercolor washes — cream, gentle peach, warm ivory tones
- Only partial environmental details visible near the characters — the rest fades to warm washes
- TOP 40% of the image MUST be open warm watercolor space — reserved for text overlay, NO character heads or important details in this zone
- Characters positioned in the LOWER 60% of the image, filling about 40-50% of image height
- Characters should be slightly smaller and pushed toward the bottom — leave generous open space above
- Warm palette — soft golds, gentle greens, warm skin tones with healthy rosy cheeks
- Shadows should be warm and soft, not cold or heavy
- No dark somber mood, no cold shadows, no desaturated tones
- No heavy visible brushstrokes, no thick oil paint texture, no impasto
- No anime eyes, no chibi proportions, no flat cartoon style
- No hard borders, no picture frame, no fully detailed edge-to-edge backgrounds
- No text, no letters, no UI elements`;

// Same style but for SQUARE direction preview cards (1024x1024)
// Key difference: no text zone requirement, character can be centered
const GPT_IMAGE_DIRECTION_STYLE_PROMPT = `Children's storybook illustration — cartoon-realistic style:
- Warm, inviting illustrated style for a children's book — like a modern Pixar concept art painting
- Characters have realistic human proportions but with a gentle, approachable softness
- Natural-looking children — real hair, real skin tones, expressive faces — but rendered softly, not photorealistic
- Smooth, clean rendering — NOT heavy oil painting brushstrokes, NOT thick impasto texture
- The look should feel like a high-quality animated film still, painted with warmth
- Warm cheerful lighting — golden and inviting, not dark or somber
- The mood should feel happy, safe, and magical — like a beautiful children's book
- Natural color palette with gentle variety — soft greens, warm blues, natural earth tones, cozy warm light
- Colors should feel natural and harmonious, not oversaturated or neon
- Background dissolves into soft warm watercolor washes — cream, gentle peach, warm ivory tones
- Only partial environmental details visible near the characters — the rest fades to warm washes
- Character centered in the image, filling about 60-70% of the frame
- Warm palette — soft golds, gentle greens, warm skin tones with healthy rosy cheeks
- Shadows should be warm and soft, not cold or heavy
- Square composition, cozy intimate framing
- No dark somber mood, no cold shadows, no desaturated tones
- No heavy visible brushstrokes, no thick oil paint texture, no impasto
- No anime eyes, no chibi proportions, no flat cartoon style
- No hard borders, no picture frame, no fully detailed edge-to-edge backgrounds
- No text, no letters, no UI elements`;
```

### 4b. Add `buildGPTImagePrompt()` function

This replaces the complex Flux prompt builder for GPT Image. Natural language, no LoRA triggers, no STYLE_LOCK blocks:

```typescript
function buildGPTImagePrompt(input: ImageInput): string {
  const isPreview = !!input.isDirectionPreview;
  const stylePrompt = isPreview ? GPT_IMAGE_DIRECTION_STYLE_PROMPT : GPT_IMAGE_STYLE_PROMPT;

  // 1. Scene description (primary content)
  const sceneDesc = input.pagePrompt || input.bookPageText || '';

  // 2. Character identity
  const charParts: string[] = [];
  if (input.childDescription) {
    charParts.push(`Main character: ${input.childDescription}`);
  }
  if (input.companion) {
    const comp = input.companion;
    const compDesc = [comp.species, comp.color, comp.size, comp.personalityTrait]
      .filter(Boolean).join(', ');
    charParts.push(`Companion: ${comp.name || 'companion'} — ${compDesc}`);
  }
  const characterBlock = charParts.length > 0 ? charParts.join('\n') : '';

  // 3. Reference photo instruction
  const hasRef = input.referenceImages && input.referenceImages.length > 0;
  const refInstruction = hasRef
    ? 'Using the child from the reference photo as the main character — preserve their face, hair, and likeness exactly.'
    : '';

  // 4. Assemble prompt
  const parts = [
    refInstruction,
    `Scene: ${sceneDesc}`,
    characterBlock,
    `\nStyle:\n${stylePrompt}`,
  ].filter(Boolean);

  return parts.join('\n\n');
}
```

### 4c. Add `generateWithGPTImage()` function

```typescript
import { generateGPTImage } from '@/lib/generate-image';
import { storeImageFromBuffer } from '@/lib/image-storage';

async function generateWithGPTImage(input: ImageInput): Promise<GeneratedImage> {
  const isPreview = !!input.isDirectionPreview;
  const size = isPreview ? '1024x1024' : '1024x1536';

  // For direction previews, use medium quality (smaller cards, save cost)
  const quality = isPreview ? 'medium' : (process.env.GPT_IMAGE_QUALITY as 'low' | 'medium' | 'high' || 'high');

  // Build the prompt
  const prompt = buildGPTImagePrompt(input);

  console.log(`[gpt_image_prompt] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} isPreview=${isPreview} size=${size} quality=${quality} promptLen=${prompt.length}`);

  // Get reference image URL (first one)
  const referenceImageUrl = input.referenceImages?.[0] ?? undefined;

  // Generate with retry
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await generateGPTImage({
        finalPrompt: prompt,
        negativePrompt: 'text, letters, words, numbers, watermark, signature, frame, border',
        referenceImageUrl,
        size: size as '1024x1024' | '1024x1536',
        quality,
      });

      // Upload buffer to Supabase
      const durableUrl = await storeImageFromBuffer({
        buffer: result.buffer,
        orderId: input.orderId,
        pageNumber: input.pageNumber,
        assetType: input.assetType === 'cover' ? 'cover' : 'page',
        contentType: 'image/png',
      });

      console.log(
        `[gpt_image_done] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
        `duration=${result.durationMs}ms hasRef=${result.hasReferencePhoto} url=${durableUrl.slice(0, 80)}...`
      );

      return {
        url: durableUrl,
        rawUrl: durableUrl,
        width: isPreview ? 1024 : 1024,
        height: isPreview ? 1024 : 1536,
        provider: 'gpt-image-1',
        prompt,
      };
    } catch (error: any) {
      lastError = error;
      const errMsg = error?.message || String(error);

      // Content policy violation — don't retry
      if (errMsg.includes('content_policy_violation') || errMsg.includes('safety')) {
        console.warn(`[GPTImage] Content policy violation, not retrying: ${errMsg.slice(0, 200)}`);
        break;
      }

      // Rate limit — exponential backoff
      if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
        const waitMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(`[GPTImage] Rate limited, waiting ${waitMs}ms before retry ${attempt}/3`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // Auth error — don't retry
      if (errMsg.includes('401') || errMsg.includes('invalid_api_key')) {
        console.error(`[GPTImage] Auth error, not retrying: ${errMsg.slice(0, 200)}`);
        break;
      }

      // Other errors — retry once
      if (attempt < 3) {
        console.warn(`[GPTImage] Error attempt ${attempt}/3: ${errMsg.slice(0, 200)}`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    }
  }

  throw lastError || new Error('GPT Image generation failed after retries');
}
```

### 4d. Update the switch statement

At line ~1792:
```typescript
switch (provider) {
  case 'replicate': return generateWithReplicate(input);
  case 'gpt-image':  return generateWithGPTImage(input);
  case 'dall-e-3':
  default:           return generateWithDallE(input);
}
```

### 4e. Fix the dall-e-3 reference image guard

Line ~1781 — make sure `gpt-image` is NOT blocked:
```typescript
// ONLY dall-e-3 can't handle reference images. gpt-image CAN.
if (provider === 'dall-e-3' && input.referenceImages && input.referenceImages.length > 0) {
  throw new Error('DALL-E cannot be used when child reference images are provided');
}
```
This is already correct — just verify it says `provider === 'dall-e-3'` and not something broader.

### 4f. Remove development mode guard for gpt-image

Lines ~1785-1790: The current guard forces `replicate` in dev mode. Update to allow `gpt-image` too:
```typescript
if (modelMode === 'development' && provider !== 'replicate' && provider !== 'gpt-image') {
  // ... existing error
}
```

---

## 5. `.env.local` — Switch provider

```env
IMAGE_PROVIDER=gpt-image
GPT_IMAGE_QUALITY=high
```

Make sure `OPENAI_API_KEY` is set (it should already be — we use it for story generation).

---

## 6. `.env.example` — Document new vars

Add:
```env
# Image provider: 'replicate' | 'gpt-image' | 'dall-e-3'
IMAGE_PROVIDER=gpt-image

# GPT Image quality (only used when IMAGE_PROVIDER=gpt-image): 'low' | 'medium' | 'high'
GPT_IMAGE_QUALITY=high
```

---

## Direction Preview Cards — GPT Image at Lower Cost

The 3 direction preview cards currently go through `generateImage()` with `isDirectionPreview: true`. The GPT Image path handles this automatically:

- **Size:** `1024x1024` (square) instead of `1024x1536`
- **Quality:** `medium` instead of `high` — saves ~75% cost per card ($0.05 vs $0.20)
- **Style:** Uses `GPT_IMAGE_DIRECTION_STYLE_PROMPT` — same aesthetic but no 40% text zone requirement, character can be centered and larger
- **No other changes needed** — the existing `story-directions.ts` calls `generateImage()` the same way, just with `isDirectionPreview: true`

---

## Files to Modify (Summary)

| # | File | What |
|---|------|------|
| 1 | `lib/env.ts` | Add `'gpt-image'` type + normalizer + validation |
| 2 | `lib/image-storage.ts` | Add `storeImageFromBuffer()` |
| 3 | `lib/generate-image.ts` | Add `generateGPTImage()` + types |
| 4 | `backend/providers/image.ts` | Add style constants + `buildGPTImagePrompt()` + `generateWithGPTImage()` + switch case + fix guards |
| 5 | `.env.local` | Set `IMAGE_PROVIDER=gpt-image`, `GPT_IMAGE_QUALITY=high` |
| 6 | `.env.example` | Document new vars |

## Files NOT to Modify

- `lib/styles.ts` — Style profiles stay. GPT Image ignores LoRA config but Style 02 still uses it.
- `lib/promptBuilder.ts` — GPT Image has its own prompt builder.
- `lib/visualDirector.ts` — Already disabled for previews and covers; GPT Image path doesn't use it.
- `backend/providers/story-directions.ts` — No changes needed. It calls `generateImage()` which routes to GPT Image automatically.
- Style 02 pipeline — Untouched. `IMAGE_PROVIDER=replicate` still works for Style 02 testing.
- Wizard — No changes. Photo upload already stores to Supabase, URL flows to `input.referenceImages`.

---

## Testing Checklist

1. Set `IMAGE_PROVIDER=gpt-image` in `.env.local`
2. Generate a new book with Style 01 (no reference photo)
   - Verify: warm cartoon-realistic style, watercolor dissolution, 40% open top, character in lower 60%
3. Generate a book WITH reference photo uploaded in wizard
   - Verify: child's likeness preserved, same style
4. Check direction preview cards generate correctly (square, centered character)
5. Check cover generates correctly
6. Set `IMAGE_PROVIDER=replicate` — verify Style 02 still works unchanged
7. Check Supabase storage — images stored as PNG under `orders/{id}/pages/`

---

## Cost Estimate

| Asset | Count | Quality | Cost/image | Total |
|-------|-------|---------|------------|-------|
| Direction previews | 3 | medium | ~$0.05 | ~$0.15 |
| Book pages | 12 | high | ~$0.167 | ~$2.00 |
| Cover | 1 | high | ~$0.167 | ~$0.17 |
| **Total per book** | | | | **~$2.32** |

vs Flux+LoRA: ~$0.40 per book. The quality improvement justifies the 6x cost increase for a paid product.

---

## Error Handling

- `content_policy_violation` → log warning, do NOT retry, throw (let pipeline handle fallback)
- Rate limit (429) → exponential backoff: 2s, 4s, 8s, max 3 retries
- Auth error (401) → fail fast, clear error message
- Reference photo download fails → fall back to text-only generation (no crash)
- Log every generation: model, quality, size, promptLength, hasReferencePhoto, durationMs

---

## Reference Test Scripts

Working implementations for reference:
- `scripts/test-gpt-image.ts` — cartoon-realistic + photo modes
- `scripts/test-gpt-image-realistic.ts` — v5 approved prompt (the one to use)

Key API patterns:
```typescript
// Text-only
const response = await openai.images.generate({
  model: 'gpt-image-1',
  prompt: fullPrompt,
  size: '1024x1536',  // or '1024x1024' for previews
  quality: 'high',     // or 'medium' for previews
  n: 1,
});
const b64 = response.data[0].b64_json;
const buffer = Buffer.from(b64, 'base64');

// Photo-to-illustration
const photoBuffer = await fetch(referenceUrl).then(r => r.arrayBuffer());
const photoFile = new File([photoBuffer], 'reference.png', { type: 'image/png' });
const response = await openai.images.edit({
  model: 'gpt-image-1',
  image: photoFile,
  prompt: fullPrompt,
  size: '1024x1536',
  quality: 'high',
});
```

---

## Phase 5b (LATER — do NOT implement now)

Per-style provider routing: Style 01 → GPT Image, Style 02 → Replicate automatically based on `StylePipelineProfile.imageProvider`. For now, `IMAGE_PROVIDER` is global.
