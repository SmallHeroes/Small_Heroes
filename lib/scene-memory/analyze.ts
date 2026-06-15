import { readFileSync } from 'fs';

import type { ObservedSceneFacts, SceneMemory } from './types';

const VISION_CONFIDENCE_THRESHOLD = 0.55;

function imageToDataUrl(imagePathOrUrl: string): string {
  const trimmed = imagePathOrUrl.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('http')) return trimmed;
  const buf = readFileSync(trimmed);
  const ext = trimmed.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

function unknownObserved(memory: SceneMemory): ObservedSceneFacts {
  return {
    sceneId: memory.sceneId,
    facts: Object.keys(memory.stableFacts).map((factId) => ({
      factId,
      confidence: 0,
      visibility: 'uncertain' as const,
    })),
    unauthorizedProps: [],
    unknowns: Object.keys(memory.stableFacts),
    visionSkipped: true,
  };
}

/**
 * Dedicated scene-memory vision interface — evidence only, never sole judge.
 * On failure or low confidence → uncertain; no learning, no reroll.
 */
export async function analyzeSceneMemoryImage(
  image: string,
  expectedMemory?: SceneMemory | null
): Promise<ObservedSceneFacts> {
  if (!expectedMemory) {
    return {
      sceneId: 'unknown',
      facts: [],
      unauthorizedProps: [],
      unknowns: ['no_expected_memory'],
      visionSkipped: true,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const visionEnabled = process.env.SCENE_MEMORY_VISION_ENABLED !== 'false';
  if (!apiKey || !visionEnabled) {
    return {
      ...unknownObserved(expectedMemory),
      visionError: !apiKey ? 'OPENAI_API_KEY missing' : 'SCENE_MEMORY_VISION_ENABLED=false',
    };
  }

  const inventory = expectedMemory.inventory;
  const factIds = Object.keys(expectedMemory.stableFacts);

  const prompt = `Scene continuity evidence from a children's book illustration.

Return ONLY compact JSON (omit null fields; keep strings under 8 words):
{
  "facts": [{ "factId": "...", "position": "...", "confidence": 0-1, "visibility": "visible"|"uncertain"|"not_visible" }],
  "unauthorizedProps": [],
  "unknowns": []
}

Expected fact ids: ${factIds.join(', ')}
Inventory: ${inventory.join(', ')}

Rules:
- Include ONLY facts you can see or rule out; skip invisible facts (add id to unknowns).
- not_visible = cropped/occluded; uncertain = ambiguous (confidence <= 0.5).
- unauthorizedProps = visible items NOT in inventory.`;

  async function callVision(strictCompact: boolean): Promise<string> {
    const imageUrl = imageToDataUrl(image);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
        max_tokens: 1500,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: strictCompact
              ? `${prompt}\n\nRETRY: return valid minified JSON only — no markdown, no trailing commas.`
              : prompt,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this page image for scene memory facts.' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`vision_http_${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '{}';
  }

  try {
    let content = await callVision(false);
    let raw: {
      facts?: Array<{
        factId?: string;
        position?: string | null;
        appearance?: string | null;
        color?: string | null;
        state?: string | null;
        confidence?: number;
        visibility?: string;
      }>;
      unauthorizedProps?: string[];
      unknowns?: string[];
    };
    try {
      raw = JSON.parse(content) as typeof raw;
    } catch (parseErr) {
      try {
        content = await callVision(true);
        raw = JSON.parse(content) as typeof raw;
      } catch (retryErr) {
        const msg =
          retryErr instanceof Error ? retryErr.message : String(retryErr);
        const parseMsg =
          parseErr instanceof Error ? parseErr.message : String(parseErr);
        return {
          ...unknownObserved(expectedMemory),
          visionSkipped: true,
          visionError: `vision_json_parse: ${parseMsg}; retry: ${msg}`,
        };
      }
    }

    const facts = (raw.facts ?? []).map((f) => {
      const confidence = Math.max(0, Math.min(1, Number(f.confidence ?? 0)));
      let visibility = f.visibility as ObservedSceneFacts['facts'][0]['visibility'];
      if (!['visible', 'uncertain', 'not_visible'].includes(visibility ?? '')) {
        visibility = confidence >= VISION_CONFIDENCE_THRESHOLD ? 'visible' : 'uncertain';
      }
      if (visibility === 'not_visible' || confidence < VISION_CONFIDENCE_THRESHOLD) {
        visibility = visibility === 'not_visible' ? 'not_visible' : 'uncertain';
      }
      return {
        factId: String(f.factId ?? '').trim(),
        position: f.position != null ? String(f.position) : undefined,
        appearance: f.appearance != null ? String(f.appearance) : undefined,
        color: f.color != null ? String(f.color) : undefined,
        state: f.state != null ? String(f.state) : undefined,
        confidence: visibility === 'uncertain' || visibility === 'not_visible' ? Math.min(confidence, 0.5) : confidence,
        visibility,
      };
    }).filter((f) => f.factId);

    return {
      sceneId: expectedMemory.sceneId,
      facts,
      unauthorizedProps: (raw.unauthorizedProps ?? []).map(String).filter(Boolean),
      unknowns: (raw.unknowns ?? []).map(String).filter(Boolean),
      visionSkipped: false,
    };
  } catch (e) {
    return {
      ...unknownObserved(expectedMemory),
      visionSkipped: true,
      visionError: e instanceof Error ? e.message : String(e),
    };
  }
}

export { VISION_CONFIDENCE_THRESHOLD };
