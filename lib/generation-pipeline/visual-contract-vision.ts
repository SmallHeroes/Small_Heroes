/**
 * gpt-4o vision caller for runPageContractGate on the LIVE path — sends the rendered image URL + the
 * gate's instruction, returns the raw model text (which interpretVisionJson parses). Mirrors the
 * existing page-world-qa vision call (model + image_url detail:'low'); the image URL is passed directly
 * (public Supabase URL), no base64 round-trip.
 */
import type { ContractGateVision } from './visual-contract-gate';

export const callVisualContractVision: ContractGateVision = async (imageUrl, instruction) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing — visual-contract vision gate unavailable');
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
            { type: 'text', text: instruction },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`visual-contract vision HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
};
