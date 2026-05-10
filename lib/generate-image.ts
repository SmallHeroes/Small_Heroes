import OpenAI from 'openai';
import Replicate from 'replicate';
import {
  getReplicateClient,
  isSdxlModelSlug,
  resolveReplicateImageModel,
  resolveReplicateImageModelForStyle,
} from './replicate';

export interface GenerateImageInput {
  finalPrompt: string;
  negativePrompt?: string;
  referenceImages?: string[];
  modelOverride?: string;
  seed?: number;
  styleId?: string;
  loraTriggerWord?: string;
  loraStylePrefix?: string;
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
      console.log('[lora_version_resolve]', `${slug} → ${pinned.substring(0, 80)}...`);
      return pinned;
    }
    console.warn('[lora_version_resolve]', `No version found for ${slug}, using as-is`);
    return slug;
  } catch (err) {
    console.warn('[lora_version_resolve]', `Failed to resolve version for ${slug}:`, err instanceof Error ? err.message : err);
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
  if (input.loraTriggerWord && process.env.ENABLE_LORA === 'true') {
    const stylePrefix = input.loraStylePrefix ? ` ${input.loraStylePrefix}` : '';
    finalPrompt = `${input.loraTriggerWord} style,${stylePrefix} ${finalPrompt}`;
  }

  const replicate = getReplicateClient();

  // For private LoRA models, auto-resolve version hash to avoid 404 on predictions endpoint
  if (input.loraTriggerWord && process.env.ENABLE_LORA === 'true') {
    model = await resolveVersionPinnedModel(replicate, model);
  }

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

export interface GenerateGPTImageInput {
  finalPrompt: string;
  negativePrompt?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1536';
  quality?: 'low' | 'medium' | 'high';
}

export interface GenerateGPTImageResult {
  buffer: Buffer;
  model: string;
  finalPrompt: string;
  hasReferencePhoto: boolean;
  durationMs: number;
}

function resolveEnvGPTQuality(): 'low' | 'medium' | 'high' {
  const q = process.env.GPT_IMAGE_QUALITY?.trim().toLowerCase();
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return 'high';
}

/**
 * GPT Image (`gpt-image-1`) — returns raw PNG bytes (base64-decoded).
 * Always uses `images.generate` — `images.edit` anchors composition to reference photos and hurts scene diversity.
 */
export async function generateGPTImage(input: GenerateGPTImageInput): Promise<GenerateGPTImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY for GPT Image generation');

  const openai = new OpenAI({ apiKey });
  const size = input.size || '1024x1536';
  const quality = input.quality ?? resolveEnvGPTQuality();

  let fullPrompt = input.finalPrompt;
  if (input.negativePrompt) {
    fullPrompt += `\nNo text or letters in the image.`;
  }

  const startMs = Date.now();

  console.info(`[GPTImage] model=gpt-image-1 quality=${quality} size=${size} promptLen=${fullPrompt.length}`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: fullPrompt,
    size: size as never,
    quality: quality as never,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json ?? undefined;
  if (!b64) throw new Error('GPT Image API returned no image data');

  const buffer = Buffer.from(b64, 'base64');
  const durationMs = Date.now() - startMs;

  console.info(`[GPTImage] Done in ${durationMs}ms, buffer=${Math.round(buffer.length / 1024)}KB`);

  return {
    buffer,
    model: 'gpt-image-1',
    finalPrompt: fullPrompt,
    hasReferencePhoto: false,
    durationMs,
  };
}
