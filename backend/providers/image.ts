/**
 * Image Provider — AI Image Generation
 * Supports DALL-E 3 and Replicate.
 * Each page gets one image generated from its imagePrompt.
 */

// ─── Types ────────────────────────────────────────────
export interface ImageInput {
  pagePrompt: string;          // from story generator
  illustrationStyle: string;   // soft | disney | classic | watercolor
  childDescription?: string;   // consistent character appearance
  pageNumber: number;
  totalPages: number;
}

export interface GeneratedImage {
  url: string;      // final stored URL
  rawUrl?: string;  // provider URL (may expire)
  width: number;
  height: number;
  provider: string;
  prompt: string;
}

// ─── Style Suffix Map ─────────────────────────────────
const STYLE_PROMPTS: Record<string, string> = {
  soft:       'soft watercolor children book illustration, gentle pastel colors, warm and cozy, rounded shapes, Hebrew children book style',
  disney:     'Disney-Pixar style soft children book illustration, vibrant but gentle colors, magical atmosphere, detailed but warm',
  classic:    'classic storybook illustration, ink and watercolor, vintage children book, warm muted tones',
  watercolor: '3D render children book style, soft lighting, warm colors, Pixar-like characters, cozy atmosphere',
};

function buildImagePrompt(input: ImageInput): string {
  const styleDesc = STYLE_PROMPTS[input.illustrationStyle] ?? STYLE_PROMPTS.soft;
  const childDesc = input.childDescription ? `Main character: ${input.childDescription}.` : '';

  return `${input.pagePrompt}. ${childDesc} Style: ${styleDesc}. Child-safe, emotionally warm, no text in image, full-bleed illustration for children book page.`;
}

// ─── Provider: DALL-E 3 ───────────────────────────────
async function generateWithDallE(input: ImageInput): Promise<GeneratedImage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const prompt = buildImagePrompt(input);

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard', // or 'hd'
      response_format: 'url',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DALL-E image error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const rawUrl = data.data[0].url;

  return {
    url: rawUrl, // TODO: download and store in your CDN/S3
    rawUrl,
    width: 1024,
    height: 1024,
    provider: 'dall-e-3',
    prompt,
  };
}

// ─── Provider: Replicate (Stable Diffusion / SDXL) ───
async function generateWithReplicate(input: ImageInput): Promise<GeneratedImage> {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) throw new Error('REPLICATE_API_KEY not set');

  const prompt = buildImagePrompt(input);

  // Using Replicate's SDXL model — swap model ID as needed
  const MODEL = 'stability-ai/sdxl:c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfbe27657189';

  // Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: MODEL.split(':')[1],
      input: {
        prompt,
        negative_prompt: 'text, watermark, ugly, deformed, violent, scary, adult content, realistic photo',
        width: 1024,
        height: 1024,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    }),
  });

  if (!createRes.ok) throw new Error(`Replicate create error: ${createRes.status}`);
  const prediction = await createRes.json();

  // Poll for result (up to 2 minutes)
  let result = prediction;
  let attempts = 0;
  while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 60) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    result = await pollRes.json();
    attempts++;
  }

  if (result.status !== 'succeeded') throw new Error(`Replicate failed: ${result.error}`);

  const rawUrl = result.output[0];
  return {
    url: rawUrl, // TODO: store in CDN
    rawUrl,
    width: 1024,
    height: 1024,
    provider: 'replicate',
    prompt,
  };
}

// ─── Main Entry Point ─────────────────────────────────
export async function generateImage(input: ImageInput): Promise<GeneratedImage> {
  const provider = process.env.IMAGE_PROVIDER || 'dall-e-3';

  switch (provider) {
    case 'replicate': return generateWithReplicate(input);
    case 'dall-e-3':
    default:          return generateWithDallE(input);
  }
}

/**
 * Generate all page images for a story.
 * Rate-limited to avoid API throttling.
 */
export async function generateAllPageImages(
  pages: { pageNumber: number; imagePrompt: string }[],
  config: { illustrationStyle: string; childDescription?: string }
): Promise<Map<number, GeneratedImage>> {
  const results = new Map<number, GeneratedImage>();

  // Process in batches of 3 to avoid rate limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(page =>
        generateImage({
          pagePrompt: page.imagePrompt,
          illustrationStyle: config.illustrationStyle,
          childDescription: config.childDescription,
          pageNumber: page.pageNumber,
          totalPages: pages.length,
        })
      )
    );

    batchResults.forEach((result, idx) => {
      const page = batch[idx];
      if (result.status === 'fulfilled') {
        results.set(page.pageNumber, result.value);
      } else {
        console.error(`Image generation failed for page ${page.pageNumber}:`, result.reason);
        // Don't throw — partial image set is acceptable
      }
    });

    // Rate limit pause between batches
    if (i + BATCH_SIZE < pages.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return results;
}
