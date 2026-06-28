/**
 * REAL child-identity check for the reroll gate — a vision-LLM "same child?" judgment. The palette-
 * histogram (resemblance-core) cannot gauge identity on watercolor / busy scenes; a vision model can.
 * Sends the CANONICAL child anchor (image 1) + the candidate page (image 2) and asks gpt-4o whether it
 * is the SAME child — judging face / hair / age / skin only, ignoring pose, background, style, and other
 * characters. Returns a 3-state-friendly verdict.
 *
 * NOT a render — one text+vision call, invoked only on the reroll path (gated). The HTTP seam mirrors
 * callVisualContractVision so it's unit-testable by stubbing global.fetch.
 */
export interface ChildIdentityVerdict {
  /** same → confident match · different → confident mismatch · uncertain → can't tell (small/turned/occluded). */
  sameChild: 'same' | 'different' | 'uncertain';
  /** Model self-reported confidence, clamped to [0,1]. */
  confidence: number;
  reason: string;
}

export type ChildIdentityVision = (
  anchorImageUrl: string,
  candidateImageUrl: string
) => Promise<ChildIdentityVerdict>;

/**
 * Gate the (paid) vision identity check. OFF by default — Fix B must be CALIBRATED on labelled
 * positive/negative pairs and Codex-approved before this is turned on in any real render.
 */
export function isChildIdentityVisionEnabled(): boolean {
  return process.env.VISUAL_CONTRACT_IDENTITY_VISION === 'true';
}

export const CHILD_IDENTITY_INSTRUCTION = [
  'You verify child-character identity across two illustrations from the SAME picture book.',
  'IMAGE 1 is the CANONICAL reference of the child. IMAGE 2 is a new page.',
  'Decide whether the child in IMAGE 2 is the SAME child as IMAGE 1. Judge ONLY: face shape/features,',
  'HAIR (colour, length, texture), apparent AGE, and SKIN TONE.',
  'IGNORE: pose, expression, camera angle, background, other characters/adults, clothing, and the',
  'painting/illustration style (both are stylised art — do not penalise style differences).',
  'If the child in IMAGE 2 is small, turned away, occluded, or not clearly visible enough to compare',
  'the face/hair, answer "uncertain". If there are multiple children, judge the most prominent one.',
  'Return ONLY compact JSON: {"sameChild":"same|different|uncertain","confidence":0.0-1.0,"reason":"<=12 words"}',
].join(' ');

/** Tolerant parse of the model's JSON — never throws; unknown/garbage → uncertain @ 0. */
export function parseChildIdentityVerdict(raw: string): ChildIdentityVerdict {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const j = (match ? JSON.parse(match[0]) : {}) as {
      sameChild?: unknown;
      confidence?: unknown;
      reason?: unknown;
    };
    const s = j.sameChild;
    const sameChild = s === 'same' || s === 'different' || s === 'uncertain' ? s : 'uncertain';
    const confidence =
      typeof j.confidence === 'number' && Number.isFinite(j.confidence)
        ? Math.max(0, Math.min(1, j.confidence))
        : 0;
    const reason = typeof j.reason === 'string' ? j.reason.slice(0, 160) : '';
    // A 'same'/'different' claim with 0 confidence is untrustworthy → treat as uncertain.
    if ((sameChild === 'same' || sameChild === 'different') && confidence <= 0) {
      return { sameChild: 'uncertain', confidence: 0, reason: reason || 'no confidence reported' };
    }
    return { sameChild, confidence, reason };
  } catch {
    return { sameChild: 'uncertain', confidence: 0, reason: 'unparseable vision response' };
  }
}

export const checkChildIdentityViaVision: ChildIdentityVision = async (anchorImageUrl, candidateImageUrl) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing — child-identity vision unavailable');
  const model = process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CHILD_IDENTITY_INSTRUCTION },
            { type: 'text', text: 'IMAGE 1 (canonical child reference):' },
            { type: 'image_url', image_url: { url: anchorImageUrl, detail: 'low' } },
            { type: 'text', text: 'IMAGE 2 (new page to verify):' },
            { type: 'image_url', image_url: { url: candidateImageUrl, detail: 'low' } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`child-identity vision HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseChildIdentityVerdict(data.choices?.[0]?.message?.content ?? '');
};
