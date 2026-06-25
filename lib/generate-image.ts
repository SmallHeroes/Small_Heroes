import OpenAI, { toFile } from 'openai';
import Replicate from 'replicate';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  getReplicateClient,
  isSdxlModelSlug,
  resolveReplicateImageModel,
  resolveReplicateImageModelForStyle,
} from './replicate';
import { normalizeReferenceImageBuffer } from './child-photo-normalize';
import { BoundedAsyncCache } from './image-buffer-cache';
import { withRetry } from './retry';

export interface GenerateImageInput {
  finalPrompt: string;
  negativePrompt?: string;
  referenceImages?: string[];
  modelOverride?: string;
  seed?: number;
  styleId?: string;

  /** When true, prompt already includes REALISTART01 + short style tag — skip duplicate LoRA prepend. */
  /**
   * Flux / non-SDXL Replicate models: `aspect_ratio` sent to the API (default portrait 2:3).
   * SDXL: maps to pixel dimensions (portrait 832×1216 vs square 1024×1024).
   */
  aspectRatio?: '1:1' | '2:3';
}

export interface GenerateImageResult {
  imageUrl: string;
  outputCount: number;
  model: string;
  finalPrompt: string;
  rawProviderResponse: unknown;
}

function normalizePromptPart(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function collectImageUrls(output: unknown): Promise<string[]> {
  const asUrlString = (value: unknown): string | null => {
    if (typeof value === 'string') return value;
    if (value instanceof URL) return value.toString();
    if (value && typeof value === 'object' && 'href' in value && typeof (value as { href: unknown }).href === 'string') {
      return (value as { href: string }).href;
    }
    return null;
  };
  const isHttpUrl = (value: string) => value.startsWith('http://') || value.startsWith('https://');

  const directUrl = asUrlString(output);
  if (directUrl) {
    if (isHttpUrl(directUrl)) return [directUrl];
    throw new Error('Replicate returned a non-URL string output.');
  }

  if (Array.isArray(output) && output.length > 0) {
    const urls: string[] = [];
    for (const item of output) {
      try {
        urls.push(...(await collectImageUrls(item)));
      } catch {
        // Keep scanning until a valid URL is found.
      }
    }
    if (urls.length === 0) {
      throw new Error('Replicate returned an array output without a URL.');
    }
    return urls;
  }

  if (output && typeof output === 'object') {
    const candidate = output as Record<string, unknown>;
    if (typeof candidate.url === 'function') {
      const maybeUrl = await (candidate.url as () => Promise<unknown>)();
      const urlString = asUrlString(maybeUrl);
      if (urlString && isHttpUrl(urlString)) {
        return [urlString];
      }
    }

    const urls: string[] = [];
    for (const key of ['url', 'image', 'output', 'images']) {
      const value = candidate[key];
      if (typeof value === 'string' && isHttpUrl(value)) {
        urls.push(value);
        continue;
      }
      if (value !== undefined) {
        try {
          urls.push(...(await collectImageUrls(value)));
        } catch {
          // Continue searching other keys.
        }
      }
    }

    for (const value of Object.values(candidate)) {
      try {
        urls.push(...(await collectImageUrls(value)));
      } catch {
        // Continue searching remaining values.
      }
    }

    if (urls.length > 0) {
      return urls;
    }
  }

  throw new Error('Replicate returned output without an image URL.');
}

/**
 * For private LoRA models on Replicate, `replicate.run("owner/model")` without
 * a version hash calls the "official models" endpoint which returns 404.
 * This helper fetches the latest version and returns a version-pinned slug.
 */
async function resolveVersionPinnedModel(
  replicate: Replicate,
  slug: string
): Promise<string> {
  // Already version-pinned (owner/model:hash) — pass through
  if (slug.includes(':')) return slug;

  const parts = slug.split('/');
  if (parts.length !== 2) return slug; // Not owner/model format

  const [owner, modelName] = parts;
  try {
    const modelInfo = await replicate.models.get(owner, modelName);
    const version = modelInfo.latest_version?.id;
    if (version) {
      const pinned = `${owner}/${modelName}:${version}`;
      return pinned;
    }
    return slug;
  } catch (err) {
    return slug;
  }
}

export async function generateReplicateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  let model: string = input.styleId
    ? resolveReplicateImageModelForStyle(input.styleId)
    : resolveReplicateImageModel(input.modelOverride);
  const override = process.env.IMAGE_MODEL_OVERRIDE?.trim() || 'none';
  console.log('[image_model]', model);
  console.log('[override]', override);
  let finalPrompt = normalizePromptPart(input.finalPrompt);

  // Prepend LoRA trigger word (+ optional style prefix) when using a LoRA model
  // LoRA prompt prefix removed — no active LoRA in the project

  const replicate = getReplicateClient();

  // For private LoRA models, auto-resolve version hash to avoid 404 on predictions endpoint
  // LoRA version-resolution removed

  const aspectRatio = input.aspectRatio ?? '2:3';
  const runInput: Record<string, unknown> = isSdxlModelSlug(model)
    ? {
        prompt: finalPrompt,
        ...(aspectRatio === '1:1'
          ? { width: 1024, height: 1024 }
          : { width: 832, height: 1216 }),
        num_inference_steps: 4,
        guidance_scale: 0.5,
      }
    : {
        prompt: finalPrompt,
        aspect_ratio: aspectRatio,
        output_format: 'jpg',
        num_outputs: 1,
        num_images: 1,
      };

  if (input.negativePrompt && input.negativePrompt.trim().length > 0) {
    runInput.negative_prompt = input.negativePrompt.trim();
  }

  if (input.referenceImages && input.referenceImages.length > 0) {
    if (isSdxlModelSlug(model)) {
      console.warn('[image_reference]', 'SDXL does not support reference images');
    } else {
      runInput.input_images = input.referenceImages;
    }
  }
  if (typeof input.seed === 'number' && Number.isFinite(input.seed)) {
    runInput.seed = Math.floor(input.seed);
  }

  const rawProviderResponse = await replicate.run(model as `${string}/${string}`, { input: runInput });
  let imageUrls: string[];
  try {
    imageUrls = await collectImageUrls(rawProviderResponse);
  } catch (error) {
    const preview = JSON.stringify(rawProviderResponse).slice(0, 500);
    throw new Error(
      `Replicate output parsing failed: ${error instanceof Error ? error.message : String(error)} | rawPreview=${preview}`
    );
  }
  const uniqueUrls = [...new Set(imageUrls)];
  if (uniqueUrls.length !== 1) {
    throw new Error(`Replicate returned ${uniqueUrls.length} images. Expected exactly 1.`);
  }

  return {
    imageUrl: uniqueUrls[0],
    outputCount: uniqueUrls.length,
    model,
    finalPrompt,
    rawProviderResponse,
  };
}

export type GPTImageReferenceMode =
  | 'identity'
  | 'companion_dual'
  | 'style'
  | 'style02_book'
  /** Stage 0 anchor: ref[0] = Style 01 child template base; style refs follow; no photo. */
  | 'anchor_template'
  /** Stage 0 anchor: template first, style refs, raw photo last (identity cue only). */
  | 'anchor_template_photo_last'
  /** Stage 0 experiment: raw photo first for identity; template + style refs follow (proportions/style). */
  | 'anchor_photo_template_middle'
  /** Stage 0 experiment: raw photo first; style refs only — no generic child template. */
  | 'anchor_photo_style_only'
  /** Per-order expression sheet: edit from approved canonical child anchor only. */
  | 'anchor_expression_from_canonical'
  /** Expression variant: canonical identity + optional direction ref (expression only, not anger identity). */
  | 'anchor_expression_with_direction'
  /** Companion sheet: Style 01 re-render from canonical companion jpg (front view). */
  | 'anchor_companion_from_jpg'
  /** Companion sheet: angle/expression variant from approved Style 01 front sheet view. */
  | 'anchor_companion_from_sheet_view'
  /** Zone object anchor: closer crop derived from approved zone set sheet — same assets/mood. */
  | 'zone_set_derived_object';

/** Default cap (gpt-image-1). Override via GPT_IMAGE_EDIT_MAX_REFERENCES for gpt-image-2 probes. */
export const GPT_IMAGE_EDIT_MAX_REFERENCES = 4;

export function resolveGPTImageEditMaxReferences(): number {
  const parsed = Number.parseInt(process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ?? String(GPT_IMAGE_EDIT_MAX_REFERENCES), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return GPT_IMAGE_EDIT_MAX_REFERENCES;
  return Math.min(parsed, 16);
}

export interface GenerateGPTImageInput {
  finalPrompt: string;
  negativePrompt?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1536';
  quality?: 'low' | 'medium' | 'high';
  /** Optional reference images (URLs) — when provided, generation switches
   *  from images.generate (text-only) to images.edit, which uses these
   *  images as IDENTITY anchors for the rendered character. */
  referenceImages?: string[];
  /** How reference images are interpreted when using images.edit. Default: identity. */
  referenceMode?: GPTImageReferenceMode;
  /** Fail if referenceImages were requested but images.edit cannot run. */
  requireReferenceEdit?: boolean;
  /** Override GPT_IMAGE_MODEL for this call (e.g. gpt-image-2). */
  modelOverride?: string;
}

export interface GenerateGPTImageResult {
  buffer: Buffer;
  model: string;
  finalPrompt: string;
  hasReferencePhoto: boolean;
  apiMode: 'images.generate' | 'images.edit';
  referenceCountRequested: number;
  referenceCountPassed: number;
  durationMs: number;
  /** OpenAI usage when returned by the API. */
  usage?: Record<string, unknown>;
  /** First image object fields when present (revised_prompt, etc.). */
  responseMeta?: Record<string, unknown>;
  fallbackUsed: boolean;
}

function resolveEnvGPTQuality(): 'low' | 'medium' | 'high' {
  const q = process.env.GPT_IMAGE_QUALITY?.trim().toLowerCase();
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  // Unset → LOW (cost-safe). Production must set GPT_IMAGE_QUALITY=high explicitly.
  return 'low';
}

/** Identity-preservation prefix prepended when a reference photo is provided.
 *  Tells gpt-image-1 to use the photo ONLY for face features, not for composition,
 *  background, lighting, or clothing. Without this the model tends to mimic the
 *  whole photo (the original reason images.edit was disabled in this codebase). */
const REFERENCE_PHOTO_PREFIX = (
  '[REFERENCE PHOTO USAGE - CRITICAL]\n' +
  'The attached photo shows the REAL child who is the protagonist of this storybook page. ' +
  'If more than one person appears in the photo, the protagonist is the most prominent / foreground child — ignore any background people or faces completely. ' +
  'Use the photo ONLY to anchor the child face: face shape, skin tone, hair color and length, ' +
  'eye shape and color, and any distinctive facial features (freckles, dimples, etc.). ' +
  'The rendered child MUST clearly look like the real child in the photo.\n' +
  'DO NOT copy from the photo: the background, lighting, pose, outfit, clothing colors, ' +
  'camera angle, or composition. The scene, outfit, and setting are described in [SCENE] below.\n' +
  'OUTFIT AND HAIRSTYLE come from the BOOK WARDROBE LOCK in the prompt — never from the photo.\n' +
  'Re-render the child as a cartoon/watercolor illustration in the storybook style - same face, new world.\n\n' +
  '[SCENE]\n'
);

const DUAL_REFERENCE_PREFIX = (
  '[REFERENCE IMAGES - CRITICAL]\n' +
  'Image 1: The REAL child protagonist. Use ONLY for face identity — face shape, skin tone, hair color/texture cues, eyes, distinctive features. ' +
  'If more than one person appears, anchor ONLY on the most prominent / foreground child and ignore background people. ' +
  'DO NOT copy pose, outfit, lighting, or background from the photo.\n' +
  'Image 2: BOLLY the armadillo companion — the canonical Bolly design. Match his shell plate pattern, proportions, tan-brown coloring, and pink belly exactly on every page.\n' +
  'OUTFIT AND HAIRSTYLE: defined in BOOK WARDROBE LOCK below — they override any clothing visible in Image 1.\n' +
  'Re-render both characters as soft children\'s picture-book illustrations in the scene below. Same child face + same Bolly design + same locked outfit every page.\n\n' +
  '[SCENE]\n'
);

export const STYLE_REFERENCE_PREFIX = (
  '[STYLE REFERENCES — VISUAL STYLE ONLY]\n' +
  'The attached reference images define VISUAL STYLE ONLY: linework, color, rendering, texture, lighting, environmental richness, character charm, and premium storybook feel.\n' +
  'DO NOT copy reference content. DO NOT copy reference characters. DO NOT copy reference animals. DO NOT copy reference creatures. DO NOT copy reference composition. DO NOT copy reference pose. DO NOT copy reference environment layout. DO NOT copy reference props unless explicitly requested in the target scene below.\n' +
  'References may contain owls, birds, puppies, armadillos, dragons, bats, lanterns, cottages, doorways, or other specific objects — none of those should appear unless the target scene explicitly asks for them.\n\n' +
  '[TARGET SCENE]\n'
);

export const STYLE02_BOOK_REFERENCE_PREFIX = (
  '[STYLE 02 BOOK — REFERENCE IMAGES]\n' +
  'Earlier attached images (if any) are Guy\'s Style 02 VISUAL STYLE references only — rendering, lighting, materials, density. Do NOT copy their creatures, text, signs, or compositions.\n' +
  'If a child photo is attached: IDENTITY ONLY — re-render as Style 02 illustrated child (semi-realistic storybook), not photoreal.\n' +
  'If a companion reference is attached: match canonical companion design only — not pose or background from the ref.\n\n' +
  '[TARGET SCENE]\n'
);

/** Stage 0 anchor — template is edit base; photo must NOT drive realism. */
export const STYLE01_ANCHOR_TEMPLATE_BASE_PREFIX = (
  '[STYLE 01 ANCHOR — TEMPLATE BASE]\n' +
  'Image 1 is the STYLE 01 CHILD CHARACTER TEMPLATE. Copy ONLY visual language from it: eye size, head/body proportions, softness, rounded simplified features, watercolor storybook rendering.\n' +
  'Do NOT copy the template child\'s specific face identity — personalize using CHILD VISUAL LOCK text below.\n' +
  'Later images (if any) are watercolor TECHNIQUE references only — linework, pigment, paper texture. Do NOT copy their scenes, creatures, or compositions.\n' +
  'OUTPUT: cute simplified hand-drawn watercolor storybook child — NOT photorealistic, NOT a photographic portrait, NOT semi-realistic.\n\n' +
  '[TARGET CHARACTER]\n'
);

export const STYLE01_ANCHOR_TEMPLATE_PHOTO_LAST_PREFIX = (
  '[STYLE 01 ANCHOR — TEMPLATE + PHOTO CUE]\n' +
  'Image 1: STYLE 01 CHILD TEMPLATE — base proportions, eye size, softness, watercolor rendering (visual language).\n' +
  'Middle images: watercolor technique references only.\n' +
  'Last image: REAL CHILD PHOTO — identity cues ONLY (hair color/length/texture, skin tone, eye color/shape, face structure, age). ' +
  'Do NOT copy photo realism, studio lighting, portrait framing, or photographic skin texture.\n' +
  'Personalize the template child to match identity cues + CHILD VISUAL LOCK. Stay cute simplified Style 01 watercolor.\n\n' +
  '[TARGET CHARACTER]\n'
);

export const STYLE01_ANCHOR_PHOTO_TEMPLATE_MIDDLE_PREFIX = (
  '[STYLE 01 ANCHOR — PHOTO-FIRST IDENTITY + TEMPLATE PROPORTIONS]\n' +
  'Image 1: REAL CHILD PHOTO — PRIMARY identity anchor (hair, skin tone, eye shape/color, face structure, age). ' +
  'Do NOT copy photo realism, beach/outdoor setting, shirtless/day clothes, or photographic skin texture.\n' +
  'Image 2: STYLE 01 CHILD TEMPLATE — proportions, eye size, softness, watercolor rendering ONLY (NOT face identity).\n' +
  'Later images: watercolor technique references only.\n' +
  'Render as cute simplified Style 01 watercolor child wearing BOOK WARDROBE LOCK pajamas — NOT photo clothing.\n\n' +
  '[TARGET CHARACTER]\n'
);

export const STYLE01_ANCHOR_PHOTO_STYLE_ONLY_PREFIX = (
  '[STYLE 01 ANCHOR — PHOTO-FIRST IDENTITY, NO TEMPLATE]\n' +
  'Image 1: REAL CHILD PHOTO — PRIMARY identity anchor (hair, skin tone, eye shape/color, face structure, age). ' +
  'Do NOT copy photo realism, beach/outdoor setting, shirtless/day clothes, or photographic skin texture.\n' +
  'Later images: watercolor technique/style references only — linework, pigment, paper texture, palette.\n' +
  'Render as cute simplified Style 01 watercolor child wearing BOOK WARDROBE LOCK pajamas — NOT photo clothing.\n\n' +
  '[TARGET CHARACTER]\n'
);

/** Expression mini-sheet: same child as canonical anchor; expression/pose variant only. */
export const STYLE01_ANCHOR_EXPRESSION_FROM_CANONICAL_PREFIX = (
  '[STYLE 01 EXPRESSION ANCHOR — CANONICAL BASE]\n' +
  'Image 1 is the APPROVED canonical child anchor for this order. Preserve EXACT face shape, eye size and placement, nose, cheeks, skin tone, age (5), long curly brown hair volume, bird-print pajamas, green left wrist bracelet, cute Style 01 watercolor rendering.\n' +
  'Change ONLY the facial expression and simple body pose as specified below. Clean near-empty warm cream background. NO props. NO companion. NO family. NO text.\n' +
  'Do NOT invent a new child. Do NOT make younger/baby-faced. Do NOT hide eyes behind expression. Do NOT shrink eyes for open mouth.\n\n' +
  '[TARGET EXPRESSION]\n'
);

export const STYLE01_ANCHOR_EXPRESSION_WITH_DIRECTION_PREFIX = (
  '[STYLE 01 EXPRESSION ANCHOR — CANONICAL + DIRECTION]\n' +
  'Image 1: APPROVED canonical child anchor — preserve EXACT Mia identity (face, eyes, nose, cheeks, hair volume, pajamas, bracelet, Style 01 watercolor).\n' +
  'Image 2 (if present): open-mouth DIRECTION ONLY — borrow mouth-open energy, NOT adult anger, NOT changed jaw/cheeks, NOT different child.\n' +
  'Output must match Image 1 identity with softer childlike expression per TARGET below. Clean cream background. NO props.\n\n' +
  '[TARGET EXPRESSION]\n'
);

/** Companion multi-angle sheet — identity from reference jpg, Style 01 watercolor. */
export const STYLE01_ANCHOR_COMPANION_FROM_JPG_PREFIX = (
  '[STYLE 01 COMPANION SHEET — REFERENCE PHOTO]\n' +
  'Image 1 is the canonical companion reference. Use ONLY for creature identity: species, colors, markings, proportions, accessories, silhouette.\n' +
  'Re-render as cute simplified hand-drawn watercolor storybook — NOT photoreal. Clean near-empty cream background. NO scene. NO child. NO humans.\n\n' +
  '[TARGET VIEW]\n'
);

/** Companion sheet variant — same creature as Image 1 front anchor; change angle/expression only. */
export const STYLE01_ANCHOR_COMPANION_FROM_SHEET_PREFIX = (
  '[STYLE 01 COMPANION SHEET — APPROVED FRONT ANCHOR]\n' +
  'Image 1 is the APPROVED Style 01 front view of this companion. Preserve EXACT species, colors, markings, proportions, and accessories.\n' +
  'Change ONLY camera angle / facing / expression per TARGET. NOT a new creature. Clean cream background. NO scene. NO child.\n\n' +
  '[TARGET VIEW]\n'
);

/** Object anchor sheet — same set assets as approved zone set reference; tighter crop only. */
export const STYLE01_ZONE_SET_DERIVED_OBJECT_PREFIX = (
  '[STYLE 01 ZONE SET — APPROVED SET REFERENCE]\n' +
  'Image 1 is the APPROVED zone set reference for this location. Preserve EXACT set geometry, mood, lighting, and object identity:\n' +
  'same warm window glow on the left, same stone/plaster window-ledge drip source, same terracotta floor tiles, same safe black metal-bar railing, same wooden chair scale cue on the right, same small galvanized metal bucket under the drip.\n' +
  'Match the SAME dark moonlit home-night mood — NO daylight, NO dusk, NO alternate furniture, NO alternate railing, NO faucet/downspout.\n' +
  'Change ONLY camera distance — compose CLOSER on the bucket + ledge drip while keeping the same continuous asset truth. ZERO characters. NO humans. NO creatures.\n\n' +
  '[TARGET OBJECT ANCHOR]\n'
);

function resolveReferencePrefix(
  mode: GPTImageReferenceMode,
  referenceCount: number
): string {
  if (mode === 'anchor_template') return STYLE01_ANCHOR_TEMPLATE_BASE_PREFIX;
  if (mode === 'anchor_template_photo_last') return STYLE01_ANCHOR_TEMPLATE_PHOTO_LAST_PREFIX;
  if (mode === 'anchor_photo_template_middle') return STYLE01_ANCHOR_PHOTO_TEMPLATE_MIDDLE_PREFIX;
  if (mode === 'anchor_photo_style_only') return STYLE01_ANCHOR_PHOTO_STYLE_ONLY_PREFIX;
  if (mode === 'anchor_expression_from_canonical') return STYLE01_ANCHOR_EXPRESSION_FROM_CANONICAL_PREFIX;
  if (mode === 'anchor_expression_with_direction') return STYLE01_ANCHOR_EXPRESSION_WITH_DIRECTION_PREFIX;
  if (mode === 'anchor_companion_from_jpg') return STYLE01_ANCHOR_COMPANION_FROM_JPG_PREFIX;
  if (mode === 'anchor_companion_from_sheet_view') return STYLE01_ANCHOR_COMPANION_FROM_SHEET_PREFIX;
  if (mode === 'zone_set_derived_object') return STYLE01_ZONE_SET_DERIVED_OBJECT_PREFIX;
  if (mode === 'style02_book') return STYLE02_BOOK_REFERENCE_PREFIX;
  if (mode === 'style') return STYLE_REFERENCE_PREFIX;
  if (mode === 'companion_dual' || referenceCount >= 2) return DUAL_REFERENCE_PREFIX;
  return REFERENCE_PHOTO_PREFIX;
}

function resolveReferenceSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (existsSync(trimmed)) {
    return trimmed;
  }
  const publicAbs = join(process.cwd(), 'public', trimmed.replace(/^\//, ''));
  if (existsSync(publicAbs)) {
    return publicAbs;
  }
  return trimmed;
}

/** Marks a reference fetch as non-retryable (genuine 4xx other than 429). */
class NonRetryableReferenceError extends Error {}

type NormalizedReference = { buffer: Buffer; ext: string; mime: string };

/**
 * Per-warm-worker cache of NORMALIZED reference bytes, keyed by resolved source. The
 * cover and every page pass the SAME references (child anchor + companion sheet) to
 * gpt-image; without this each render re-fetched + re-normalized them from Supabase,
 * and a single hung read was enough to overrun the 300s function ceiling and trigger
 * the cover regenerate-loop. Reference content is immutable per URL/path, so caching is
 * safe across calls within a warm worker.
 */
const referenceFileCache = new BoundedAsyncCache<NormalizedReference>();

/** Reset the reference cache — test-only seam. */
export function __resetReferenceFileCache(): void {
  referenceFileCache.clear();
}

async function loadNormalizedReference(
  resolved: string,
  indexHint: number
): Promise<NormalizedReference> {
  if (existsSync(resolved)) {
    const raw = readFileSync(resolved);
    return normalizeReferenceImageBuffer(raw, indexHint);
  }

  // Bound the remote read: a bare fetch here had NO timeout, so a slow/hanging Supabase
  // read consumed the whole render budget (the `[GPTImage] Done in 720321ms` symptom).
  // Few attempts + a short per-attempt timeout keep the cover/page render inside the
  // function ceiling; the cache above makes a remote read rare to begin with.
  const attempts = Math.max(
    1,
    Number.parseInt(process.env.REFERENCE_FETCH_MAX_ATTEMPTS ?? '3', 10) || 3
  );
  const timeoutMs = Math.max(
    1000,
    Number.parseInt(process.env.REFERENCE_FETCH_TIMEOUT_MS ?? '12000', 10) || 12000
  );
  const arrayBuf = await withRetry(
    async (signal) => {
      const res = await fetch(resolved, { signal });
      if (!res.ok) {
        const msg = `Reference image fetch failed: ${resolved} (HTTP ${res.status})`;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new NonRetryableReferenceError(msg);
        }
        throw new Error(msg);
      }
      return res.arrayBuffer();
    },
    {
      attempts,
      timeoutMs,
      baseDelayMs: 300,
      factor: 3,
      label: 'referenceFetch',
      shouldRetry: (err) => !(err instanceof NonRetryableReferenceError),
    }
  );
  return normalizeReferenceImageBuffer(Buffer.from(arrayBuf), indexHint);
}

/** Load a reference image from URL or local absolute /public path. */
async function referenceToOpenAIFile(
  source: string,
  indexHint: number
): Promise<Awaited<ReturnType<typeof toFile>>> {
  const resolved = resolveReferenceSource(source);
  const { buffer, ext, mime } = await referenceFileCache.getOrLoad(resolved, () =>
    loadNormalizedReference(resolved, indexHint)
  );
  // toFile consumes the buffer per call, so build a fresh File from the cached bytes.
  return toFile(buffer, `reference-${indexHint}.${ext}`, { type: mime });
}

/**
 * GPT Image (`gpt-image-1`).
 *
 * Two modes:
 *  - referenceImages empty -> images.generate (text-only, child looks generic)
 *  - referenceImages present -> images.edit with uploaded child photo as identity anchor.
 *    Produces a rendered child who actually looks like the user's real child.
 *
 * The images.edit path was previously disabled with the comment 'anchors composition
 * and hurts scene diversity' - but that was a prompt-engineering issue, not an API
 * limitation. The REFERENCE_PHOTO_PREFIX above tells the model to use ONLY face
 * features and re-imagine everything else. ChatGPT uses this same pattern.
 */
export async function generateGPTImage(input: GenerateGPTImageInput): Promise<GenerateGPTImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY for GPT Image generation');

  const openai = new OpenAI({ apiKey });
  const size = input.size || '1024x1536';
  const quality = input.quality ?? resolveEnvGPTQuality();

  const refs = (input.referenceImages || []).filter((u) => typeof u === 'string' && u.trim().length > 0);
  const referenceCountRequested = refs.length;
  const referenceMode: GPTImageReferenceMode = input.referenceMode ?? 'identity';
  const maxRefs = resolveGPTImageEditMaxReferences();
  const refsForApi = refs.slice(0, maxRefs);
  const hasReference = refsForApi.length > 0;

  if (input.requireReferenceEdit && referenceCountRequested > 0 && !hasReference) {
    throw new Error('Reference images were required but none could be loaded for images.edit.');
  }

  let fullPrompt = input.finalPrompt;
  if (hasReference) {
    fullPrompt = resolveReferencePrefix(referenceMode, refsForApi.length) + fullPrompt;
  }
  if (input.negativePrompt) {
    fullPrompt += `\n\n[AVOID]\n${input.negativePrompt}`;
    if (!/\btext\b/i.test(input.negativePrompt)) {
      fullPrompt += '\nNo text or letters in the image.';
    }
  }

  // Allow overriding the OpenAI image model via env var. Defaults to gpt-image-1.
  // Set GPT_IMAGE_MODEL=gpt-image-2 to switch to the newer agentic model (April 2026)
  // which plans composition before rendering — should obey our framing instructions.
  const imageModel = (input.modelOverride ?? process.env.GPT_IMAGE_MODEL ?? 'gpt-image-1').trim();
  const requestedModel = imageModel;

  const apiMode: 'images.generate' | 'images.edit' = hasReference ? 'images.edit' : 'images.generate';

  if (input.requireReferenceEdit && referenceCountRequested > 0 && apiMode !== 'images.edit') {
    throw new Error('Reference edit was required but API mode resolved to images.generate.');
  }

  const startMs = Date.now();
  console.info(
    `[GPTImage] model=${imageModel} quality=${quality} size=${size} promptLen=${fullPrompt.length} ` +
    `refMode=${referenceMode} refsRequested=${referenceCountRequested} refsPassed=${refsForApi.length} ` +
    `mode=${apiMode}`
  );

  let b64: string | undefined;
  let usage: Record<string, unknown> | undefined;
  let responseMeta: Record<string, unknown> | undefined;
  try {
    if (hasReference) {
      const files = await Promise.all(refsForApi.map((u, i) => referenceToOpenAIFile(u, i)));
      const imageArg = files.length === 1 ? files[0] : files;
      const response = await openai.images.edit({
        model: imageModel,
        image: imageArg,
        prompt: fullPrompt,
        size: size as never,
        quality: quality as never,
        n: 1,
      });
      b64 = response.data?.[0]?.b64_json ?? undefined;
      usage = (response as { usage?: Record<string, unknown> }).usage;
      const first = response.data?.[0] as Record<string, unknown> | undefined;
      if (first) {
        responseMeta = {
          revised_prompt: first.revised_prompt,
          ...Object.fromEntries(
            Object.entries(first).filter(([k]) => k !== 'b64_json' && k !== 'url')
          ),
        };
      }
    } else {
      const response = await openai.images.generate({
        model: imageModel,
        prompt: fullPrompt,
        size: size as never,
        quality: quality as never,
        n: 1,
      });
      b64 = response.data?.[0]?.b64_json ?? undefined;
      usage = (response as { usage?: Record<string, unknown> }).usage;
      const first = response.data?.[0] as Record<string, unknown> | undefined;
      if (first) {
        responseMeta = {
          revised_prompt: first.revised_prompt,
          ...Object.fromEntries(
            Object.entries(first).filter(([k]) => k !== 'b64_json' && k !== 'url')
          ),
        };
      }
    }
  } catch (err) {
    console.error(`[GPTImage] API call failed (mode=${hasReference ? 'images.edit' : 'images.generate'}):`, err);
    throw err;
  }

  if (!b64) throw new Error('GPT Image API returned no image data');

  const buffer = Buffer.from(b64, 'base64');
  const durationMs = Date.now() - startMs;
  console.info(
    `[GPTImage] Done in ${durationMs}ms, buffer=${Math.round(buffer.length / 1024)}KB, ` +
    `apiMode=${apiMode} refsPassed=${refsForApi.length}`
  );

  const fallbackUsed = requestedModel !== imageModel;

  return {
    buffer,
    model: imageModel,
    finalPrompt: fullPrompt,
    hasReferencePhoto: hasReference,
    apiMode,
    referenceCountRequested,
    referenceCountPassed: refsForApi.length,
    durationMs,
    usage,
    responseMeta,
    fallbackUsed,
  };
}
