import 'server-only';

import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { withRetry } from '@/lib/retry';

export type ResemblanceStatus = 'pass' | 'soft_fail';
export type ResemblanceConfidence = 'high' | 'medium' | 'low';
export type InputPhotoStrength = 'strong' | 'adequate' | 'weak';

export type ResemblanceThresholdConfig = {
  baseThreshold: number;
  styleAdjustments?: Record<string, number>;
  minAcceptableScore: number;
  softFailBand: number;
  extremeMargin: number;
};

export type ResemblanceSanityFlags = {
  embeddingMismatch: boolean;
  colorMismatch: boolean;
  geometryWeird: boolean;
};

export type ResemblanceCandidate = {
  candidateIndex: number;
  imageUrl: string;
  resemblanceScore: number;
  faceDetectConfidence: number;
  faceAreaRatio: number;
  sanityFlags: ResemblanceSanityFlags;
  candidateEmbedding?: number[];
};

export type AnchorSelectionResult = {
  selectedIndex: number;
  scores: number[];
  confidence: ResemblanceConfidence;
  reason: string;
  selectionGap: number | null;
  resemblanceStatus: ResemblanceStatus;
  reasonCodes: string[];
  sanityDisagreement: boolean;
  lowDiversity: boolean;
  extremeMismatch: boolean;
};

type ImageStats = {
  embedding: number[];
  brightness: number;
  sharpness: number;
  normalizedSharpness: number;
  faceCount: number;
  faceAreaRatio: number;
  /** All detected face-blob area ratios, sorted descending. */
  faceRatios: number[];
  faceDetectConfidence: number;
  width: number;
  height: number;
};

export type PhotoQualityStatus = 'good' | 'warning' | 'blocked';

/** Real face detector spike — see outputs/cursor-brief-photo-gate-fairness.md Step 4. */
export const PHOTO_FACE_DETECTOR_V2_FLAG = 'PHOTO_FACE_DETECTOR_V2';

export type PhotoGuidanceResult = {
  /** False only for corrupt/invalid/unreadable files (thrown before guidance). */
  canContinue: boolean;
  warnings: string[];
  /** @deprecated use warnings — kept for logging compat */
  reasons: string[];
  /** @deprecated quality never blocks valid images — mirrors canContinue */
  passed: boolean;
  inputStrength: InputPhotoStrength;
  faceCount: number;
  faceAreaRatio: number;
  sharpness: number;
  brightness: number;
  normalizedSharpness: number;
};

export type PhotoAnalysisResult = {
  faceCount: number;
  dominantFaceRatio: number;
  sharpness: number;
  brightness: number;
  normalizedSharpness: number;
  status: PhotoQualityStatus;
  reasonCodes: string[];
  warnings: string[];
  canContinue: boolean;
};

const DEFAULT_THRESHOLD_CONFIG: ResemblanceThresholdConfig = {
  baseThreshold: 0.72,
  minAcceptableScore: 0.55,
  softFailBand: 0.06,
  extremeMargin: 0.1,
  styleAdjustments: {
    whimsical_comic_fantasy: -0.03,
    pencil_watercolor: -0.02,
    realistic_illustrated: 0,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number {
  const m = mean(values);
  return mean(values.map((v) => (v - m) * (v - m)));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    an += a[i] * a[i];
    bn += b[i] * b[i];
  }
  if (an <= 0 || bn <= 0) return 0;
  return clamp(dot / (Math.sqrt(an) * Math.sqrt(bn)), 0, 1);
}

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function resolveResemblanceThresholdConfig(): ResemblanceThresholdConfig {
  const cfg: ResemblanceThresholdConfig = {
    baseThreshold: parseNumberEnv('RESEMBLANCE_BASE_THRESHOLD', DEFAULT_THRESHOLD_CONFIG.baseThreshold),
    minAcceptableScore: parseNumberEnv('RESEMBLANCE_MIN_ACCEPTABLE_SCORE', DEFAULT_THRESHOLD_CONFIG.minAcceptableScore),
    softFailBand: parseNumberEnv('RESEMBLANCE_SOFT_FAIL_BAND', DEFAULT_THRESHOLD_CONFIG.softFailBand),
    extremeMargin: parseNumberEnv('RESEMBLANCE_EXTREME_MARGIN', DEFAULT_THRESHOLD_CONFIG.extremeMargin),
    styleAdjustments: DEFAULT_THRESHOLD_CONFIG.styleAdjustments,
  };
  validateThresholdConfig(cfg);
  return cfg;
}

export function validateThresholdConfig(config: ResemblanceThresholdConfig): void {
  if (config.baseThreshold > 0.9) throw new Error('RESEMBLANCE_BASE_THRESHOLD must be <= 0.9');
  if (config.baseThreshold < 0.5) throw new Error('RESEMBLANCE_BASE_THRESHOLD must be >= 0.5');
  if (config.minAcceptableScore < 0.35) throw new Error('RESEMBLANCE_MIN_ACCEPTABLE_SCORE must be >= 0.35');
  if (config.softFailBand <= 0 || config.softFailBand > 0.15) {
    throw new Error('RESEMBLANCE_SOFT_FAIL_BAND must be in (0, 0.15]');
  }
  if (config.extremeMargin <= 0 || config.extremeMargin > 0.25) {
    throw new Error('RESEMBLANCE_EXTREME_MARGIN must be in (0, 0.25]');
  }
  const styleAdjustments = config.styleAdjustments ?? {};
  for (const [styleId, delta] of Object.entries(styleAdjustments)) {
    if (delta < -0.08 || delta > 0.08) {
      throw new Error(`Style threshold adjustment out of bounds for ${styleId}`);
    }
  }
}

export function resolveEffectiveThreshold(
  styleId: string,
  config: ResemblanceThresholdConfig
): number {
  const delta = config.styleAdjustments?.[styleId] ?? 0;
  const threshold = clamp(config.baseThreshold + delta, 0.5, 0.9);
  const minRequired = config.minAcceptableScore + config.softFailBand;
  if (threshold < minRequired) {
    throw new Error(
      `Invalid threshold for style=${styleId}. threshold must be >= minAcceptableScore + softFailBand`
    );
  }
  return threshold;
}

/** Marks a fetch failure as non-retryable (genuine 4xx other than 429). */
class NonRetryableFetchError extends Error {}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  // resolveReferenceImageSource may return an absolute local filesystem path
  // (when the public asset exists on disk). Node's fetch rejects bare paths
  // with "unknown scheme" — read them directly.
  const isHttpUrl = /^https?:\/\//i.test(url);
  const isDataUrl = /^data:/i.test(url);
  if (!isHttpUrl && !isDataUrl) {
    return readFile(url);
  }
  // Supabase storage / Replicate CDN occasionally fail transiently ("fetch failed",
  // ECONNRESET mid-stream, or a slow read that overruns the per-attempt timeout —
  // both Stage-0 anchor failures on 2026-06-23). Retry with exponential backoff and a
  // sane per-attempt timeout; only a genuine 4xx (not 429) fails fast.
  const attempts = Math.max(1, Number.parseInt(process.env.IMAGE_FETCH_MAX_ATTEMPTS ?? '4', 10) || 4);
  const timeoutMs = Math.max(1000, Number.parseInt(process.env.IMAGE_FETCH_TIMEOUT_MS ?? '30000', 10) || 30000);
  return withRetry(
    async (signal) => {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        const msg = `Failed fetching image for resemblance: ${res.status}`;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new NonRetryableFetchError(msg);
        }
        throw new Error(msg);
      }
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    },
    {
      attempts,
      timeoutMs,
      baseDelayMs: 300,
      factor: 3,
      label: 'fetchImageBuffer',
      shouldRetry: (err) => !(err instanceof NonRetryableFetchError),
    }
  );
}

function rgbToY(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isLikelySkinPixel(r: number, g: number, b: number): boolean {
  return r > 80 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10;
}

function detectFaceLikeBlobs(
  rgb: Buffer,
  width: number,
  height: number
): { faceCount: number; largestRatio: number; ratios: number[] } {
  const area = width * height;
  const minBlobArea = Math.max(40, Math.floor(area * 0.01));
  const mask = new Uint8Array(area);
  for (let i = 0; i < area; i++) {
    const base = i * 3;
    if (isLikelySkinPixel(rgb[base], rgb[base + 1], rgb[base + 2])) {
      mask[i] = 1;
    }
  }
  const visited = new Uint8Array(area);
  const queue = new Int32Array(area);
  let components = 0;
  let largest = 0;
  const blobAreas: number[] = [];
  for (let start = 0; start < area; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let count = 0;
    while (head < tail) {
      const idx = queue[head++];
      count++;
      const x = idx % width;
      const y = Math.floor(idx / width);
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (!mask[nIdx] || visited[nIdx]) continue;
        visited[nIdx] = 1;
        queue[tail++] = nIdx;
      }
    }
    if (count >= minBlobArea) {
      components++;
      blobAreas.push(count);
      if (count > largest) largest = count;
    }
  }
  return {
    faceCount: components,
    largestRatio: largest / area,
    ratios: blobAreas.map((count) => count / area).sort((a, b) => b - a),
  };
}

function detectFaceLikeBlobRatios(rgb: Buffer, width: number, height: number): number[] {
  const area = width * height;
  const minBlobArea = Math.max(40, Math.floor(area * 0.006));
  const mask = new Uint8Array(area);
  for (let i = 0; i < area; i++) {
    const base = i * 3;
    if (isLikelySkinPixel(rgb[base], rgb[base + 1], rgb[base + 2])) mask[i] = 1;
  }
  const visited = new Uint8Array(area);
  const queue = new Int32Array(area);
  const ratios: number[] = [];
  for (let start = 0; start < area; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let count = 0;
    while (head < tail) {
      const idx = queue[head++];
      count++;
      const x = idx % width;
      const y = Math.floor(idx / width);
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (!mask[nIdx] || visited[nIdx]) continue;
        visited[nIdx] = 1;
        queue[tail++] = nIdx;
      }
    }
    if (count >= minBlobArea) ratios.push(count / area);
  }
  return ratios.sort((a, b) => b - a);
}

function buildEmbedding(rgb: Buffer): number[] {
  const bins = 16;
  const histR = new Array<number>(bins).fill(0);
  const histG = new Array<number>(bins).fill(0);
  const histB = new Array<number>(bins).fill(0);
  const pixels = rgb.length / 3;
  for (let i = 0; i < pixels; i++) {
    const base = i * 3;
    const r = rgb[base];
    const g = rgb[base + 1];
    const b = rgb[base + 2];
    histR[Math.floor((r / 256) * bins)]++;
    histG[Math.floor((g / 256) * bins)]++;
    histB[Math.floor((b / 256) * bins)]++;
  }
  const emb = [...histR, ...histG, ...histB].map((v) => v / pixels);
  const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
  if (norm <= 0) return emb;
  return emb.map((v) => v / norm);
}

function computeSharpness(gray: number[], width: number, height: number): number {
  const lap: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const center = gray[idx];
      const val =
        Math.abs(4 * center - gray[idx - 1] - gray[idx + 1] - gray[idx - width] - gray[idx + width]);
      lap.push(val);
    }
  }
  return variance(lap);
}

/** Laplacian variance normalized by image contrast — fair for darker/smooth skin tones. */
function normalizedSharpnessScore(gray: number[], width: number, height: number): number {
  const raw = computeSharpness(gray, width, height);
  const contrast = Math.max(1, variance(gray));
  return raw / contrast;
}

/**
 * Generation-tier hint — collapsed to a single tier so adequate/strong never diverge
 * in anchor selection or downstream quality (tone-fair; see PhotoGuidance brief).
 */
function resolveFairInputPhotoStrength(
  _dominantFaceRatio: number,
  _normalizedSharpness: number
): InputPhotoStrength {
  return 'adequate';
}

export function resolvePhotoGuidanceFromMetrics(params: {
  faceRatios: number[];
  sharpness: number;
  brightness: number;
  normalizedSharpness: number;
}): PhotoGuidanceResult {
  const { faceCount, dominantFaceRatio, hasDominant } = resolveEffectiveFace(params.faceRatios);
  const warnings: string[] = [];

  if (faceCount === 0) warnings.push('no_face_detected');
  else if (!hasDominant) warnings.push('multiple_faces_no_dominant');

  if (dominantFaceRatio > 0 && dominantFaceRatio < 0.06) warnings.push('face_area_too_small');
  else if (dominantFaceRatio > 0 && dominantFaceRatio < 0.12) warnings.push('face_borderline_size');

  if (params.normalizedSharpness < 0.12) warnings.push('sharpness_too_low');
  if (params.brightness < 18) warnings.push('low_brightness');
  if (params.brightness > 245) warnings.push('brightness_out_of_range');

  const inputStrength = resolveFairInputPhotoStrength(dominantFaceRatio, params.normalizedSharpness);

  return {
    canContinue: true,
    warnings,
    reasons: warnings,
    passed: true,
    inputStrength,
    faceCount,
    faceAreaRatio: dominantFaceRatio,
    sharpness: params.sharpness,
    brightness: params.brightness,
    normalizedSharpness: params.normalizedSharpness,
  };
}

async function computeImageStats(url: string): Promise<ImageStats> {
  const source = await fetchImageBuffer(url);
  const resized = await sharp(source)
    .resize(160, 160, { fit: 'cover', position: 'centre' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = resized.data;
  const width = resized.info.width;
  const height = resized.info.height;
  const pixels = width * height;
  const gray = new Array<number>(pixels);
  for (let i = 0; i < pixels; i++) {
    const base = i * 3;
    gray[i] = rgbToY(rgb[base], rgb[base + 1], rgb[base + 2]);
  }
  const brightness = mean(gray);
  const sharpness = computeSharpness(gray, width, height);
  const normalizedSharpness = normalizedSharpnessScore(gray, width, height);
  const faceBlobs = detectFaceLikeBlobs(rgb, width, height);
  const faceDetectConfidence = clamp(faceBlobs.largestRatio * 6, 0, 1);
  return {
    embedding: buildEmbedding(rgb),
    brightness,
    sharpness,
    normalizedSharpness,
    faceCount: faceBlobs.faceCount,
    faceAreaRatio: faceBlobs.largestRatio,
    faceRatios: faceBlobs.ratios,
    faceDetectConfidence,
    width,
    height,
  };
}

/**
 * Shared dominant-face rule — ONE rule for the upload analyzer AND the
 * checkout gate. A photo passes the face-count check when there is one
 * clearly dominant face; small/background faces are invisible to the user.
 *
 * Thresholds (owner-locked 2026-06-10, do not tune silently):
 *  - counted face: ratio ≥ 0.012 of image
 *  - comparable secondary: ratio ≥ 0.02
 *  - dominance: dominant ≥ 0.04 AND dominant/secondary ≥ 1.45
 */
export function resolveEffectiveFace(faceRatios: number[]): {
  faceCount: number;
  dominantFaceRatio: number;
  secondaryComparableRatio: number;
  hasDominant: boolean;
} {
  const minCountedFaceRatio = 0.012;
  const minSecondaryComparableRatio = 0.02;
  const dominantRatioMin = 1.45;
  const counted = faceRatios
    .filter((ratio) => ratio >= minCountedFaceRatio)
    .sort((a, b) => b - a);
  const dominantFaceRatio = counted[0] ?? 0;
  const secondaryComparableRatio =
    counted.find((ratio, idx) => idx > 0 && ratio >= minSecondaryComparableRatio) ?? 0;
  const faceCount = counted.length;
  const hasDominant =
    faceCount <= 1 ||
    secondaryComparableRatio <= 0 ||
    (dominantFaceRatio >= 0.04 && dominantFaceRatio / secondaryComparableRatio >= dominantRatioMin);
  return { faceCount, dominantFaceRatio, secondaryComparableRatio, hasDominant };
}

/** PhotoGuidance — advisory only; never blocks checkout/generation on quality. */
export async function evaluatePhotoGate(photoUrl: string): Promise<PhotoGuidanceResult> {
  const stats = await computeImageStats(photoUrl);
  return resolvePhotoGuidanceFromMetrics({
    faceRatios: stats.faceRatios,
    sharpness: stats.sharpness,
    brightness: stats.brightness,
    normalizedSharpness: stats.normalizedSharpness,
  });
}

export async function evaluateImageFaceSignal(imageUrl: string): Promise<{
  faceCount: number;
  faceAreaRatio: number;
  faceDetectConfidence: number;
}> {
  const stats = await computeImageStats(imageUrl);
  return {
    faceCount: stats.faceCount,
    faceAreaRatio: stats.faceAreaRatio,
    faceDetectConfidence: stats.faceDetectConfidence,
  };
}

function classifyPhotoFromMetrics(params: {
  faceRatios: number[];
  sharpness: number;
  brightness: number;
  normalizedSharpness: number;
}): PhotoAnalysisResult {
  const guidance = resolvePhotoGuidanceFromMetrics(params);
  const { faceCount, dominantFaceRatio } = resolveEffectiveFace(params.faceRatios);
  const warnings = guidance.warnings;
  return {
    faceCount,
    dominantFaceRatio,
    sharpness: params.sharpness,
    brightness: params.brightness,
    normalizedSharpness: params.normalizedSharpness,
    status: warnings.length > 0 ? 'warning' : 'good',
    reasonCodes: warnings,
    warnings,
    canContinue: true,
  };
}

function parseImageDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(dataUrl.trim());
  if (!match) throw new Error('invalid_image_data_url');
  return Buffer.from(match[1], 'base64');
}

export async function analyzePhotoDataUrl(dataUrl: string): Promise<PhotoAnalysisResult> {
  const source = parseImageDataUrl(dataUrl);
  const resized = await sharp(source)
    .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = resized.data;
  const width = resized.info.width;
  const height = resized.info.height;
  const pixels = width * height;
  const gray = new Array<number>(pixels);
  for (let i = 0; i < pixels; i++) {
    const base = i * 3;
    gray[i] = rgbToY(rgb[base], rgb[base + 1], rgb[base + 2]);
  }
  const brightness = mean(gray);
  const sharpnessRaw = computeSharpness(gray, width, height);
  const sharpness = Math.max(0, Math.sqrt(sharpnessRaw) / 2);
  const normalizedSharpness = normalizedSharpnessScore(gray, width, height);
  const faceRatios = detectFaceLikeBlobRatios(rgb, width, height);
  return classifyPhotoFromMetrics({ faceRatios, sharpness, brightness, normalizedSharpness });
}

export async function scoreResemblanceAgainstReference(params: {
  referenceImageUrl: string;
  candidateImageUrl: string;
  effectiveThreshold: number;
  minAcceptableScore: number;
}): Promise<{
  resemblanceScore: number;
  faceDetectConfidence: number;
  faceAreaRatio: number;
  sanityFlags: ResemblanceSanityFlags;
  candidateEmbedding: number[];
}> {
  const [ref, cand] = await Promise.all([
    computeImageStats(params.referenceImageUrl),
    computeImageStats(params.candidateImageUrl),
  ]);
  const resemblanceScore = cosineSimilarity(ref.embedding, cand.embedding);
  const colorMismatch = Math.abs(ref.brightness - cand.brightness) > 55;
  const geometryWeird = cand.faceCount !== 1 || cand.faceAreaRatio < 0.05;
  const embeddingMismatch = resemblanceScore < Math.max(0.25, params.minAcceptableScore - 0.12);
  return {
    resemblanceScore,
    faceDetectConfidence: cand.faceDetectConfidence,
    faceAreaRatio: cand.faceAreaRatio,
    sanityFlags: {
      embeddingMismatch,
      colorMismatch,
      geometryWeird,
    },
    candidateEmbedding: cand.embedding,
  };
}

function computeBaseConfidence(params: {
  selectedScore: number;
  effectiveThreshold: number;
  selectionGap: number | null;
}): ResemblanceConfidence {
  const delta = params.selectedScore - params.effectiveThreshold;
  if (delta >= 0.05 && (params.selectionGap === null || params.selectionGap >= 0.02)) return 'high';
  if (delta >= 0) return 'medium';
  return 'low';
}

function downgrade(confidence: ResemblanceConfidence): ResemblanceConfidence {
  if (confidence === 'high') return 'medium';
  return 'low';
}

export function selectResemblanceAnchor(params: {
  candidates: ResemblanceCandidate[];
  effectiveThreshold: number;
  minAcceptableScore: number;
  softFailBand: number;
  extremeMargin: number;
  inputStrength: InputPhotoStrength;
}): AnchorSelectionResult {
  const sorted = [...params.candidates].sort((a, b) => b.resemblanceScore - a.resemblanceScore);
  const top = sorted[0];
  const second = sorted[1];
  const selectionGap = second ? top.resemblanceScore - second.resemblanceScore : null;
  const scores = sorted.map((c) => c.resemblanceScore);
  const maxScore = top.resemblanceScore;
  const minScore = Math.min(...scores);
  const scoreSpread = maxScore - minScore;
  const softPassFloor = params.effectiveThreshold - params.softFailBand;
  const extremeMismatch = maxScore < params.minAcceptableScore - params.extremeMargin;
  const sanityDisagreement =
    top.sanityFlags.embeddingMismatch || top.sanityFlags.colorMismatch || top.sanityFlags.geometryWeird;

  let resemblanceStatus: ResemblanceStatus = 'soft_fail';
  const reasonCodes: string[] = [];
  if (maxScore >= softPassFloor) resemblanceStatus = 'pass';
  if (maxScore < softPassFloor) reasonCodes.push('soft_fail_band');

  if (extremeMismatch) {
    resemblanceStatus = 'soft_fail';
    reasonCodes.push('extreme_mismatch');
  }

  let lowDiversity = false;
  const closeByScore = scoreSpread < 0.02 && (selectionGap ?? 0) < 0.012;
  if (closeByScore) lowDiversity = true;
  if (!lowDiversity && sorted.length > 1 && top.candidateEmbedding && second?.candidateEmbedding) {
    const sim = cosineSimilarity(top.candidateEmbedding, second.candidateEmbedding);
    if (sim > 0.995) lowDiversity = true;
  }
  if (lowDiversity) reasonCodes.push('low_diversity');
  if (sanityDisagreement) reasonCodes.push('sanity_disagreement');

  let confidence = computeBaseConfidence({
    selectedScore: maxScore,
    effectiveThreshold: params.effectiveThreshold,
    selectionGap,
  });
  if (sanityDisagreement) confidence = downgrade(confidence);
  if (lowDiversity) confidence = downgrade(confidence);
  if (top.faceDetectConfidence < 0.35) confidence = 'low';
  // inputStrength kept for audit metadata only — weak tier no longer assigned by PhotoGuidance.
  if (params.inputStrength === 'weak') confidence = downgrade(confidence);
  if (extremeMismatch) confidence = 'low';

  const reason = reasonCodes.length > 0 ? reasonCodes.join('|') : 'strong_resemblance';
  return {
    selectedIndex: top.candidateIndex,
    scores,
    confidence,
    reason,
    selectionGap,
    resemblanceStatus,
    reasonCodes,
    sanityDisagreement,
    lowDiversity,
    extremeMismatch,
  };
}
