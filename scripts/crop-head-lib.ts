/**
 * FAIR head detector + cropper for the identity-calibration crop experiment (Codex spec).
 *
 * Detector: a vision-LLM that sees ONE image only (NEVER the reference) and returns the PROTAGONIST
 * child's head box + pose + eyes + confidence. Because it is blind to the reference it physically cannot
 * pick the face that yields the highest match — it picks by prominence/position, which is exactly the
 * anti-laundering property Codex required. Ambiguity / failure → detected:false → the pair is
 * not_measurable (the caller must NEVER fall back to whole-scene auto-pass).
 *
 * Cropper: square head crop (hair + ears + chin) via sharp; optional eye-leveling alignment ONLY when the
 * pose is frontal, both eyes are visible, and the roll is in a trustworthy band (never force-distorts a
 * profile). Output is an in-memory PNG buffer (caller passes it to the judge as a base64 data URL — no
 * upload, no staging pollution).
 */
import sharp from 'sharp';

export const CROP_DETECTOR_PROMPT_VERSION = 'head-detect-v1';
/** Below this detector confidence the head is treated as undetected → not_measurable. */
export const DETECT_CONFIDENCE_FLOOR = 0.55;
/** Pad factor around the head box so hair/ears/chin are included. */
const CROP_PAD = 1.5;
/** Eye-leveling only inside this roll band (deg): below = no need, above = unreliable. */
const ALIGN_MIN_DEG = 3;
const ALIGN_MAX_DEG = 18;

export type HeadPose = 'frontal' | 'three_quarter' | 'profile' | 'occluded' | 'not_visible' | 'unknown';

export interface HeadDetection {
  detected: boolean;
  bbox: { x: number; y: number; w: number; h: number } | null; // normalized 0..1, origin top-left
  pose: HeadPose;
  eyes: { left: [number, number]; right: [number, number] } | null; // normalized centers
  confidence: number; // 0..1
  reason: string;
}

const DETECT_INSTRUCTION = [
  'You locate the SINGLE protagonist child\'s HEAD in one illustrated children\'s-book page, for cropping.',
  'You have NO reference image — judge prominence ONLY, never resemblance to anyone.',
  'If multiple children/people: pick the PROTAGONIST by PROMINENCE — largest head, most foreground, most',
  'central. If it is genuinely ambiguous which child is the protagonist, set detected=false.',
  'The head box MUST include ALL of: hair (top), both ears (sides, if visible), and chin (bottom).',
  'pose: "frontal" | "three_quarter" | "profile" | "occluded" | "not_visible".',
  'eyes: normalized [x,y] centers of the left and right eye ONLY if BOTH are clearly visible, else null.',
  'If the head is too small (height < ~8% of the image), heavily occluded, turned away, or not clearly a',
  'single head, set detected=false.',
  'Coordinates are normalized 0..1 with origin TOP-LEFT; bbox x,y = top-left corner, w,h = size.',
  'Return ONLY compact JSON: {"detected":true|false,"bbox":{"x":0..1,"y":0..1,"w":0..1,"h":0..1},',
  '"pose":"frontal","eyes":{"left":[x,y],"right":[x,y]}|null,"confidence":0.0-1.0,"reason":"<=12 words"}',
].join(' ');

const num01 = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
const pt = (v: unknown): [number, number] | null => {
  if (!Array.isArray(v) || v.length < 2) return null;
  const a = num01(v[0]);
  const b = num01(v[1]);
  return a !== null && b !== null ? [a, b] : null;
};

/** Tolerant parse — never throws; garbage / out-of-range → detected:false. */
export function parseHeadDetection(raw: string): HeadDetection {
  const fail = (reason: string): HeadDetection => ({ detected: false, bbox: null, pose: 'unknown', eyes: null, confidence: 0, reason });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fail('no json');
    const j = JSON.parse(match[0]) as Record<string, unknown>;
    const confidence = typeof j.confidence === 'number' && Number.isFinite(j.confidence) ? Math.max(0, Math.min(1, j.confidence)) : 0;
    const reason = typeof j.reason === 'string' ? j.reason.slice(0, 160) : '';
    const poseRaw = typeof j.pose === 'string' ? j.pose : 'unknown';
    const POSES: readonly string[] = ['frontal', 'three_quarter', 'profile', 'occluded', 'not_visible'];
    const pose: HeadPose = POSES.includes(poseRaw) ? (poseRaw as HeadPose) : 'unknown';
    if (j.detected !== true) return { detected: false, bbox: null, pose, eyes: null, confidence, reason: reason || 'detected=false' };
    const b = (j.bbox ?? {}) as Record<string, unknown>;
    const x = num01(b.x), y = num01(b.y), w = num01(b.w), h = num01(b.h);
    if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) return fail(reason || 'bad bbox');
    const e = j.eyes;
    let eyes: HeadDetection['eyes'] = null;
    if (e && typeof e === 'object') {
      const l = pt((e as Record<string, unknown>).left);
      const r = pt((e as Record<string, unknown>).right);
      if (l && r) eyes = { left: l, right: r };
    }
    return { detected: true, bbox: { x, y, w, h }, pose, eyes, confidence, reason };
  } catch {
    return fail('unparseable detection');
  }
}

/** One vision call, ONE image, detail low, temp 0 — mirrors the child-identity-vision HTTP seam. */
export async function detectChildHead(imageUrl: string, model: string): Promise<HeadDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing — head detector unavailable');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: DETECT_INSTRUCTION },
        { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
      ] }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`head detector HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseHeadDetection(data.choices?.[0]?.message?.content ?? '');
}

export interface CropResult {
  buffer: Buffer;
  aligned: boolean;
  pose: HeadPose;
  confidence: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Square head crop (+ optional eye-leveling). Returns null when not measurable (low conf / no bbox). */
export async function cropToHead(imageBuffer: Buffer, det: HeadDetection): Promise<CropResult | null> {
  if (!det.detected || !det.bbox || det.confidence < DETECT_CONFIDENCE_FLOOR) return null;
  const meta = await sharp(imageBuffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (W < 16 || H < 16) return null;

  const bw = det.bbox.w * W;
  const bh = det.bbox.h * H;
  const side = Math.min(Math.max(bw, bh) * CROP_PAD, W, H);

  // Decide alignment + crop center. Align ONLY for a frontal pose with both eyes in a trustworthy roll band.
  let aligned = false;
  let rollDeg = 0;
  let cx = det.bbox.x * W + bw / 2;
  let cy = det.bbox.y * H + bh / 2;
  if (det.pose === 'frontal' && det.eyes) {
    const lx = det.eyes.left[0] * W, ly = det.eyes.left[1] * H;
    const rx = det.eyes.right[0] * W, ry = det.eyes.right[1] * H;
    rollDeg = (Math.atan2(ry - ly, rx - lx) * 180) / Math.PI;
    if (Math.abs(rollDeg) >= ALIGN_MIN_DEG && Math.abs(rollDeg) <= ALIGN_MAX_DEG) {
      aligned = true;
      cx = (lx + rx) / 2;
      cy = (ly + ry) / 2;
    }
  }

  // Square extract fully inside the image (clamp the center so the box never leaves bounds).
  const s = Math.round(side);
  const left = Math.round(clamp(cx - s / 2, 0, W - s));
  const top = Math.round(clamp(cy - s / 2, 0, H - s));
  let img = sharp(imageBuffer).extract({ left, top, width: s, height: s });

  if (aligned) {
    // Rotate to level the eyes, then drop the rotation corners with a centered re-extract.
    const rotated = await img.png().rotate(-rollDeg, { background: '#ffffff' }).toBuffer();
    const rm = await sharp(rotated).metadata();
    const rs = Math.round(Math.min(rm.width ?? s, rm.height ?? s) * 0.8);
    const rl = Math.round(((rm.width ?? rs) - rs) / 2);
    const rt = Math.round(((rm.height ?? rs) - rs) / 2);
    img = sharp(rotated).extract({ left: rl, top: rt, width: rs, height: rs });
  }

  const buffer = await img.resize(512, 512, { fit: 'cover' }).png().toBuffer();
  return { buffer, aligned, pose: det.pose, confidence: det.confidence };
}
