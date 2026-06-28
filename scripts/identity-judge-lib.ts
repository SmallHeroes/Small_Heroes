/**
 * Flexible identity judge for the calibration experiment ONLY (production uses checkChildIdentityViaVision).
 * Supports BOTH endpoints (chat-completions for gpt-4o; responses for gpt-5.x), a chosen `detail`, and a
 * chosen instruction. Reuses the production-tolerant parser + thresholds — only the model/detail/prompt/
 * endpoint vary. gpt-5.x calls omit `temperature` (those snapshots reject non-1).
 */
import { parseChildIdentityVerdict, CHILD_IDENTITY_INSTRUCTION, type ChildIdentityVerdict } from '@/lib/generation-pipeline/child-identity-vision';

export { CHILD_IDENTITY_INSTRUCTION };

/** Discrimination-forcing prompt: enumerate features; "same" only if no meaningful difference; doubt → uncertain (NEVER guess "different"). */
export const DISCRIMINATION_INSTRUCTION = [
  'You compare a child character across two CROPPED HEAD images from the SAME picture book.',
  'IMAGE 1 = the canonical reference of the child. IMAGE 2 = a candidate head to verify.',
  'Compare ONLY identity features: face shape, eye shape/spacing/colour, eyebrows, nose, mouth, chin/jaw,',
  'hairline, hair colour + texture, apparent AGE, and skin tone. IGNORE style, lighting, pose, expression,',
  'and background. First note the key distinguishing features you actually observe, then decide:',
  '- "same": ONLY if there is NO meaningful identity difference across those features.',
  '- "different": ONLY if there is a CLEAR, specific identity contradiction (e.g. different eye colour, clearly',
  '  different face shape or hair texture, clearly different apparent age).',
  '- "uncertain": if unsure, features conflict only weakly, or the head is too small/blurred/occluded/turned.',
  'When in doubt choose "uncertain" — NEVER guess "different".',
  'Return ONLY compact JSON: {"sameChild":"same|different|uncertain","confidence":0.0-1.0,"reason":"<=20 words: name the deciding features"}',
].join(' ');

export type JudgeEndpoint = 'chat' | 'responses';
export interface JudgeOpts { model: string; detail: 'low' | 'high'; instruction: string; endpoint: JudgeEndpoint; }
export interface JudgeOut { verdict: ChildIdentityVerdict; modelVersion: string; endpoint: JudgeEndpoint; raw: string; }

/** Mirrors lib/story-generator/llm.ts extractOutputText for the /v1/responses shape. */
function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === 'string') return data.output_text;
  const output = data.output;
  if (!Array.isArray(output)) return '';
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { type?: string; content?: Array<{ type?: string; text?: string }> };
    if (row.type !== 'message' || !Array.isArray(row.content)) continue;
    for (const part of row.content) if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
  }
  return '';
}

export async function judgeIdentity(anchorUrl: string, pageUrl: string, o: JudgeOpts): Promise<JudgeOut> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };

  if (o.endpoint === 'chat') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({
        model: o.model, temperature: 0,
        messages: [{ role: 'user', content: [
          { type: 'text', text: o.instruction },
          { type: 'text', text: 'IMAGE 1 (canonical child reference):' },
          { type: 'image_url', image_url: { url: anchorUrl, detail: o.detail } },
          { type: 'text', text: 'IMAGE 2 (candidate):' },
          { type: 'image_url', image_url: { url: pageUrl, detail: o.detail } },
        ] }],
      }),
    });
    if (!res.ok) { const b = await res.text().catch(() => ''); throw new Error(`chat ${res.status}: ${b.slice(0, 300)}`); }
    const data = (await res.json()) as { model?: string; choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '';
    return { verdict: parseChildIdentityVerdict(raw), modelVersion: data.model ?? o.model, endpoint: 'chat', raw };
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers,
    body: JSON.stringify({
      model: o.model, max_output_tokens: 600,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: o.instruction },
        { type: 'input_text', text: 'IMAGE 1 (canonical child reference):' },
        { type: 'input_image', image_url: anchorUrl, detail: o.detail },
        { type: 'input_text', text: 'IMAGE 2 (candidate):' },
        { type: 'input_image', image_url: pageUrl, detail: o.detail },
      ] }],
    }),
  });
  if (!res.ok) { const b = await res.text().catch(() => ''); throw new Error(`responses ${res.status}: ${b.slice(0, 300)}`); }
  const data = (await res.json()) as Record<string, unknown>;
  const raw = extractOutputText(data);
  const modelVersion = typeof data.model === 'string' ? data.model : o.model;
  return { verdict: parseChildIdentityVerdict(raw), modelVersion, endpoint: 'responses', raw };
}
