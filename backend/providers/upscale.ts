/**
 * Print pipeline — upscale interior/cover raster art with Real-ESRGAN via Replicate, then persist to Supabase.
 */

import { getReplicateClient } from '@/lib/replicate';
import { uploadOrderSubpathAsset } from '@/lib/image-storage';

/** Default model slug; pin with `owner/model:version` via `REPLICATE_REAL_ESRGAN_MODEL` for stability. */
const MODEL = process.env.REPLICATE_REAL_ESRGAN_MODEL?.trim() || 'nightmareai/real-esrgan';

/** Default 2× — ~180 DPI interiors land near print plate expectations when combined with 1536px sources. */
const UPSCALE_FACTOR = Number.parseInt(process.env.PRINT_UPSCALE_FACTOR ?? '2', 10);
const SCALE = Number.isFinite(UPSCALE_FACTOR) && UPSCALE_FACTOR > 0 ? UPSCALE_FACTOR : 2;

function isUpscaleGloballyDisabled(): boolean {
  return process.env.ENABLE_PRINT_IMAGE_UPSCALE === 'false';
}

function coerceOutputUrl(output: unknown): string | null {
  if (typeof output === 'string' && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0]!;
  return null;
}

/**
 * Upscale one raster via Real-ESRGAN, upload PNG to Supabase, return public HTTPS URL.
 */
export async function upscaleImage(
  imageUrl: string,
  storage: { orderId: string; pageNumber: number }
): Promise<string> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is required for print image upscale.');
  }
  const replicate = getReplicateClient();
  const raw = await replicate.run(MODEL as `${string}/${string}`, {
    input: {
      image: imageUrl,
      scale: SCALE,
    },
  });

  const outUrl = coerceOutputUrl(raw);
  if (!outUrl) {
    throw new Error(`Replicate Real-ESRGAN returned unrecognized output shape: ${JSON.stringify(raw).slice(0, 200)}`);
  }

  const res = await fetch(outUrl);
  if (!res.ok) {
    throw new Error(`Upscale fetch failed (${res.status}): ${outUrl}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const padded = String(storage.pageNumber).padStart(3, '0');
  const key = `print-upscale/page-${padded}.png`;

  return uploadOrderSubpathAsset({
    orderId: storage.orderId,
    subpath: key,
    buffer,
    contentType: 'image/png',
  });
}

export async function upscaleImagesForPrint(
  pages: Array<{ pageNumber: number; imageUrl: string }>,
  orderId: string
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!process.env.REPLICATE_API_TOKEN?.trim()) {
    console.warn('[print-upscale] REPLICATE_API_TOKEN missing — upscale skipped (PDF still uses hi-res GPT sources)');
    return map;
  }
  if (!orderId || isUpscaleGloballyDisabled()) {
    if (!isUpscaleGloballyDisabled()) {
      console.warn('[print-upscale] skipped: missing orderId');
    } else {
      console.warn('[print-upscale] disabled via ENABLE_PRINT_IMAGE_UPSCALE=false');
    }
    return map;
  }

  await Promise.all(
    pages.map(async ({ pageNumber, imageUrl }) => {
      try {
        const hi = await upscaleImage(imageUrl, { orderId, pageNumber });
        map.set(pageNumber, hi);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(
          `[print-upscale] page ${pageNumber} failed (keeping base image for PDF): ${msg.slice(0, 240)}`
        );
      }
    })
  );

  return map;
}
