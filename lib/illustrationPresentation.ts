/**
 * Post-processes raw page illustrations into reader/PDF-ready assets:
 * smart crop and directional paper fade integration (not CSS-only).
 *
 * Placement modes map from `lib/bookPageLayout.ts` reader layouts (see `placementModeFromReaderLayout`):
 * - character_vignette — text_top_image_bottom: character-aware crop + stronger top fade
 * - scene_soft_frame — image_top_text_bottom: balanced crop + medium asymmetric fades
 * - full_bleed_safe — image_full_overlay_text: gentle fades with subtle side feather
 */

import sharp from 'sharp';
import type { BookPageLayout, BookPageTemplate } from './bookPageLayout';
import { withRetry } from './retry';

export type PlacementMode = 'character_vignette' | 'scene_soft_frame' | 'full_bleed_safe';

const OUT_W = 1200;
const OUT_H = 1800;
const PAPER = { r: 253, g: 249, b: 244 };

export interface ImageSignalReport {
  width: number;
  height: number;
  dominant: { r: number; g: number; b: number };
  stdevMean: number;
  entropyMean: number;
  paperDistance: number;
  usable: boolean;
  reasons: string[];
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rgbDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function fetchImageBuffer(sourceUrl: string): Promise<Buffer> {
  // Retry + per-attempt timeout: Supabase storage / CDN fetches of render-path references and
  // page images occasionally abort transiently ("This operation was aborted"); a single blip must
  // not fail the page. A genuine 4xx (other than 429) is non-retryable.
  return withRetry(
    async (signal) => {
      const res = await fetch(sourceUrl, { signal });
      if (!res.ok) {
        const err = new Error(`Presentation: failed to fetch source image (${res.status})`);
        (err as { status?: number }).status = res.status;
        throw err;
      }
      return Buffer.from(await res.arrayBuffer());
    },
    {
      attempts: 4,
      baseDelayMs: 500,
      factor: 2,
      timeoutMs: 30000,
      label: 'fetchImageBuffer',
      shouldRetry: (e) => {
        const status = (e as { status?: number })?.status;
        return status === undefined || status === 429 || status >= 500;
      },
    }
  );
}

export async function evaluateImageSignal(
  buffer: Buffer,
  options?: { baseline?: ImageSignalReport }
): Promise<ImageSignalReport> {
  const image = sharp(buffer, { failOn: 'none' });
  const metadata = await image.metadata();
  const stats = await image.stats();
  const channels = stats.channels ?? [];
  const stdevMean = avg(channels.map((ch) => ch.stdev));
  const entropyMean = stats.entropy;
  const dominant = {
    r: stats.dominant?.r ?? Math.round(avg(channels.map((ch) => ch.mean))),
    g: stats.dominant?.g ?? Math.round(avg(channels.map((ch) => ch.mean))),
    b: stats.dominant?.b ?? Math.round(avg(channels.map((ch) => ch.mean))),
  };
  const paperDistance = rgbDistance(dominant, PAPER);

  const reasons: string[] = [];
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 320 || height < 240) {
    reasons.push('invalid_dimensions');
  }
  if (stdevMean < 2.2) {
    reasons.push('very_low_variance');
  }
  if (entropyMean < 1.2) {
    reasons.push('very_low_entropy');
  }
  if (paperDistance < 4.5) {
    reasons.push('dominant_too_close_to_paper');
  }

  const baseline = options?.baseline;
  if (baseline && baseline.stdevMean >= 10) {
    const varianceRatio = stdevMean / baseline.stdevMean;
    if (varianceRatio < 0.2) {
      reasons.push('variance_collapsed_vs_source');
    }
  }
  if (baseline && baseline.paperDistance >= 12 && paperDistance < 6) {
    reasons.push('paper_shift_vs_source');
  }

  return {
    width,
    height,
    dominant,
    stdevMean,
    entropyMean,
    paperDistance,
    usable: reasons.length === 0,
    reasons,
  };
}

/** Tie post-processing to the same layout enum the reader uses (no new layout types). */
export function placementModeFromReaderLayout(layout: BookPageLayout): PlacementMode {
  switch (layout) {
    case 'image_full_overlay_text':
      return 'full_bleed_safe';
    case 'text_top_image_bottom':
      return 'character_vignette';
    case 'image_top_text_bottom':
      return 'scene_soft_frame';
    default:
      return 'scene_soft_frame';
  }
}

/** Pipeline page templates (image composition) → presentation crop; aligned with `assignTemplatesForBook` / reader layout mapping. */
export function placementModeFromPageTemplate(template: BookPageTemplate): PlacementMode {
  switch (template) {
    case 'full_bleed_overlay':
      return 'full_bleed_safe';
    case 'art_top_text_bottom':
      return 'character_vignette';
    case 'character_vignette_text':
      return 'scene_soft_frame';
  }
}

/** Stable 0–1 jitter from page number (deterministic per page, varies across book). */
function pageJitter(pageNumber: number, salt: number): number {
  const x = Math.sin(pageNumber * 12.9898 + salt * 78.233 + 0.724) * 43758.5453;
  return x - Math.floor(x);
}

type CoverPosition = sharp.ResizeOptions['position'];

function pickCoverPosition(mode: PlacementMode, pageNumber: number): CoverPosition {
  const j = pageJitter(pageNumber, 1);
  if (mode === 'character_vignette') {
    // Keep enough top breathing room so character weight lands lower in frame.
    if (j < 0.72) return 'attention';
    if (j < 0.88) return 'entropy';
    return 'north';
  }
  if (mode === 'full_bleed_safe') {
    if (j < 0.55) return 'centre';
    if (j < 0.82) return 'attention';
    return 'entropy';
  }
  if (j < 0.78) return 'attention';
  return 'entropy';
}

/**
 * Zoom-out margin before final extract: combines Sharp saliency ("attention") with biased window
 * so the subject has breathing room and remains uncropped while maintaining lower-third weight.
 */
async function fitCoverWithBreathingAndBias(
  input: Buffer,
  position: CoverPosition,
  pageNumber: number,
  mode: PlacementMode
): Promise<Buffer> {
  const rotated = await sharp(input).rotate().toBuffer();
  const meta = await sharp(rotated).metadata();
  if (!meta.width || !meta.height) {
    return sharp(rotated).resize(OUT_W, OUT_H, { fit: 'cover', position }).png().toBuffer();
  }

  const j1 = pageJitter(pageNumber, 2);
  const j2 = pageJitter(pageNumber, 3);
  const breathing = 0.042 + j1 * 0.058;
  const ew = Math.ceil(OUT_W * (1 + breathing));
  const eh = Math.ceil(OUT_H * (1 + breathing));

  const scaled = await sharp(rotated).resize(ew, eh, { fit: 'cover', position }).toBuffer();
  const sm = await sharp(scaled).metadata();
  if (!sm.width || !sm.height || sm.width < OUT_W || sm.height < OUT_H) {
    return sharp(rotated).resize(OUT_W, OUT_H, { fit: 'cover', position }).png().toBuffer();
  }

  const slackX = sm.width - OUT_W;
  const slackY = sm.height - OUT_H;

  // Horizontal: stay near centre with small per-page drift (avoids identical crops).
  const horizT = 0.5 + (j2 - 0.5) * 0.22;

  // Vertical: keep more top breathing room for character pages (subject reads lower in frame).
  let vertT: number;
  if (mode === 'character_vignette') {
    vertT = 0.08 + j1 * 0.16;
  } else if (mode === 'scene_soft_frame') {
    vertT = 0.36 + (j1 - 0.5) * 0.18;
  } else {
    vertT = 0.42 + (j1 - 0.5) * 0.16;
  }

  const left = Math.max(0, Math.min(Math.round(slackX * horizT), slackX));
  const top = Math.max(0, Math.min(Math.round(slackY * vertT), slackY));

  return sharp(scaled).extract({ left, top, width: OUT_W, height: OUT_H }).png().toBuffer();
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function fadeProfile(mode: PlacementMode): {
  centerY: number;
  centerSpread: number;
  topFadeDepth: number;
  bottomFadeDepth: number;
  sideFadeDepth: number;
  sideStrength: number;
} {
  if (mode === 'character_vignette') {
    return {
      centerY: 0.68,
      centerSpread: 0.22,
      topFadeDepth: 0.52,
      bottomFadeDepth: 0.28,
      sideFadeDepth: 0.1,
      sideStrength: 0.18,
    };
  }
  if (mode === 'full_bleed_safe') {
    return {
      centerY: 0.58,
      centerSpread: 0.28,
      topFadeDepth: 0.42,
      bottomFadeDepth: 0.24,
      sideFadeDepth: 0.08,
      sideStrength: 0.14,
    };
  }
  return {
    centerY: 0.62,
    centerSpread: 0.26,
    topFadeDepth: 0.46,
    bottomFadeDepth: 0.25,
    sideFadeDepth: 0.09,
    sideStrength: 0.16,
  };
}

async function directionalAlphaMaskBuffer(mode: PlacementMode, pageNumber: number): Promise<Buffer> {
  const profile = fadeProfile(mode);
  const jitterTop = (pageJitter(pageNumber, 4) - 0.5) * 0.04;
  const jitterBottom = (pageJitter(pageNumber, 5) - 0.5) * 0.04;
  const topFadeDepth = Math.max(0.34, Math.min(0.66, profile.topFadeDepth + jitterTop));
  const bottomFadeDepth = Math.max(0.18, Math.min(0.4, profile.bottomFadeDepth + jitterBottom));

  const rgba = Buffer.allocUnsafe(OUT_W * OUT_H * 4);
  let idx = 0;
  for (let y = 0; y < OUT_H; y++) {
    const yNorm = OUT_H <= 1 ? 0 : y / (OUT_H - 1);
    const topAlpha = smoothstep(0, topFadeDepth, yNorm);
    const bottomAlpha = smoothstep(0, bottomFadeDepth, 1 - yNorm);
    const verticalAlpha = Math.min(topAlpha, bottomAlpha);
    const centerBoost =
      0.9 +
      0.16 *
        Math.exp(-Math.pow(yNorm - profile.centerY, 2) / (2 * Math.pow(profile.centerSpread, 2)));

    for (let x = 0; x < OUT_W; x++) {
      const xNorm = OUT_W <= 1 ? 0 : x / (OUT_W - 1);
      const leftAlpha = smoothstep(0, profile.sideFadeDepth, xNorm);
      const rightAlpha = smoothstep(0, profile.sideFadeDepth, 1 - xNorm);
      const sideAlpha = Math.min(leftAlpha, rightAlpha);
      const sideFactor = 1 - (1 - sideAlpha) * profile.sideStrength;
      const alpha = Math.max(0, Math.min(1, verticalAlpha * centerBoost * sideFactor));
      const alphaByte = Math.round(alpha * 255);

      rgba[idx++] = 255;
      rgba[idx++] = 255;
      rgba[idx++] = 255;
      rgba[idx++] = alphaByte;
    }
  }

  return sharp(rgba, { raw: { width: OUT_W, height: OUT_H, channels: 4 } }).png().toBuffer();
}

/**
 * Fetch stored page image, apply placement + edge integration, return WebP bytes.
 * @param pageNumber — drives deterministic per-page fade/crop variation (book rhythm).
 */
export async function buildPresentationWebp(
  sourceUrl: string,
  mode: PlacementMode,
  pageNumber: number = 1
): Promise<Buffer> {
  const input = await fetchImageBuffer(sourceUrl);
  return buildPresentationWebpFromBuffer(input, mode, pageNumber);
}

export async function buildPresentationWebpFromBuffer(
  input: Buffer,
  mode: PlacementMode,
  pageNumber: number = 1
): Promise<Buffer> {
  const position = pickCoverPosition(mode, pageNumber);
  let buf = await fitCoverWithBreathingAndBias(input, position, pageNumber, mode);

  const directionalMaskPng = await directionalAlphaMaskBuffer(mode, pageNumber);
  buf = await sharp(buf).composite([{ input: directionalMaskPng, blend: 'dest-in' }]).png().toBuffer();

  return sharp(buf)
    .flatten({ background: PAPER })
    .webp({ quality: 88, effort: 4, smartSubsample: true })
    .toBuffer();
}