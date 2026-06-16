import { readFileSync } from 'fs';

import type { BoardQaResult } from './types';

function imageToDataUrl(imagePath: string): string {
  const buf = readFileSync(imagePath);
  const ext = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

const CONTAMINATION_TERMS = [
  'tent',
  'canopy',
  'teepee',
  'arch',
  'opening',
  'roof',
  'tunnel',
  'fort',
  'pillow pile',
  'pillow cave',
  'pillow-cave',
  'scattered pillows',
  'blanket fold',
  'draped blanket',
  'upright drape',
  'fabric drape',
  'curtain',
  'curtains',
  'drape',
  'drapes',
  'valance',
  'swag',
  'tieback',
];

/**
 * Vision QA gate — reject boards that teach stateful/collapsible forms.
 * Fail closed when vision unavailable (no auto-approve).
 */
export async function qaSetAppearanceBoardImage(boardPath: string): Promise<BoardQaResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const visionEnabled = process.env.SET_APPEARANCE_BOARD_QA_ENABLED !== 'false';
  if (!apiKey || !visionEnabled) {
    return {
      passed: false,
      flags: [!apiKey ? 'OPENAI_API_KEY missing' : 'SET_APPEARANCE_BOARD_QA_ENABLED=false'],
      visionSkipped: true,
    };
  }

  const prompt = `You are QA for a FIXED-OBJECTS-ONLY children's book set appearance reference sheet.

The sheet should show ONLY isolated fixed bedroom objects on neutral cream paper:
bed/headboard style, bare window frame + glass (NO fabric), lamp/nightstand, wall shelf+books, rug, wall/floor palette swatches.

REJECT (contaminated=true) if the image shows ANY of:
- pillow pile, pillow cave, pillow fort, scattered pillow heap
- blanket, blanket fold, draped/upright fabric, fabric arch
- curtains, drapes, valances, swags, tiebacks, or ANY soft hanging fabric on or around windows
- tent, canopy, teepee, tunnel, roof, arch opening, fort structure
- any collapsible/stateful object form

ALLOWED (contaminated=false) — do NOT reject for these:
- bare rectangular window frame with clear glass panes (a visible window opening showing glass or night sky is CORRECT)
- empty window frame without any fabric — this is the intended design

When in doubt: if you see only wood/plastic frame + glass and NO hanging cloth → contaminated=false.

Return ONLY JSON:
{
  "contaminated": true|false,
  "flags": ["short reason", ...]
}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.SET_APPEARANCE_BOARD_QA_MODEL?.trim() || 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageToDataUrl(boardPath), detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      return { passed: false, flags: [`vision_http_${res.status}`], visionSkipped: false };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { contaminated?: boolean; flags?: string[] };
    const flags = [...(parsed.flags ?? [])];
    if (parsed.contaminated) {
      for (const term of CONTAMINATION_TERMS) {
        if (flags.some((f) => f.toLowerCase().includes(term))) continue;
      }
    }
    return {
      passed: parsed.contaminated !== true,
      flags: parsed.contaminated ? flags.length ? flags : ['contaminated'] : flags,
      visionSkipped: false,
    };
  } catch (err) {
    return {
      passed: false,
      flags: [`vision_error: ${err instanceof Error ? err.message : String(err)}`],
      visionSkipped: false,
    };
  }
}
