/**
 * Post-render HARD entity QA — duplicate child, companion presence/identity.
 */
import { getCompanionById } from '../companions';

export type PageEntityQaFailure =
  | 'duplicate_child'
  | 'companion_missing'
  | 'wrong_companion_species'
  | 'companion_wrong_identity';

export type PageEntityQaResult = {
  passed: boolean;
  hardFailures: PageEntityQaFailure[];
  notes: string;
  raw?: Record<string, unknown>;
};

function companionSpeciesLabel(companionId?: string | null): string {
  const companion = getCompanionById(companionId ?? '');
  if (!companion) return 'companion';
  const desc = companion.visualDescription ?? '';
  const m = desc.match(/^A\s+(?:small\s+)?(?:[\w-]+\s+){0,3}?([\w-]+)/i);
  if (m?.[1]) return m[1].toLowerCase();
  if (companionId === 'chameleon_koko') return 'chameleon';
  if (companionId === 'lion_shaket') return 'lion';
  if (companionId === 'fox_uri') return 'fox';
  if (companionId === 'dragon_dini') return 'dragon';
  return 'companion';
}

function buildEntityQaPrompt(input: {
  expectsChild: boolean;
  expectsCompanion: boolean;
  speciesLabel: string;
  companionName?: string | null;
}): string {
  const companionName = input.companionName?.trim() || 'companion';
  return `You are strict entity QA for a children's picture-book page.

Return ONLY JSON:
{
  "singleChildOnly": true if at most ONE human child protagonist (no duplicate/copy/clone children),
  "companionPresentOk": true if ${input.expectsCompanion ? `the ${input.speciesLabel} companion (${companionName}) is clearly visible` : 'no companion creature is required OR none is wrongly dominant'},
  "companionSpeciesOk": true if ${input.expectsCompanion ? `the companion reads as a ${input.speciesLabel} (not a dragon, bear, fox, or other species)` : 'true when no companion expected'},
  "companionIdentityOk": true if ${input.expectsCompanion ? `companion matches ${input.speciesLabel} design — no scarf, no random morph into human child colors` : 'true when no companion expected'},
  "duplicateChildCount": number of distinct human child protagonists (0 if none),
  "notes": "one short sentence"
}

HARD FAIL duplicate_child if singleChildOnly is false OR duplicateChildCount > 1 when a child is expected.
HARD FAIL companion_missing if expectsCompanion and companionPresentOk is false.
HARD FAIL wrong_companion_species if expectsCompanion and companionSpeciesOk is false (e.g. dragon when chameleon expected).
HARD FAIL companion_wrong_identity if expectsCompanion and companionIdentityOk is false.`;
}

export async function evaluatePageEntityQa(input: {
  imageUrl: string;
  companionId?: string | null;
  companionName?: string | null;
  expectsCompanion: boolean;
  expectsChild: boolean;
}): Promise<PageEntityQaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { passed: true, hardFailures: [], notes: 'OPENAI_API_KEY missing — entity QA skipped' };
  }

  const speciesLabel = companionSpeciesLabel(input.companionId);
  const prompt = buildEntityQaPrompt({
    expectsChild: input.expectsChild,
    expectsCompanion: input.expectsCompanion,
    speciesLabel,
    companionName: input.companionName,
  });

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
        max_tokens: 300,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: input.imageUrl, detail: 'high' } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { passed: true, hardFailures: [], notes: `vision HTTP ${res.status} — entity QA skipped` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>;
    const hardFailures: PageEntityQaFailure[] = [];

    if (input.expectsChild && raw.singleChildOnly === false) {
      hardFailures.push('duplicate_child');
    }
    if (input.expectsChild && typeof raw.duplicateChildCount === 'number' && raw.duplicateChildCount > 1) {
      if (!hardFailures.includes('duplicate_child')) hardFailures.push('duplicate_child');
    }
    if (input.expectsCompanion && raw.companionPresentOk === false) {
      hardFailures.push('companion_missing');
    }
    if (input.expectsCompanion && raw.companionSpeciesOk === false) {
      hardFailures.push('wrong_companion_species');
    }
    if (input.expectsCompanion && raw.companionIdentityOk === false) {
      hardFailures.push('companion_wrong_identity');
    }

    return {
      passed: hardFailures.length === 0,
      hardFailures,
      notes: typeof raw.notes === 'string' ? raw.notes : '',
      raw,
    };
  } catch (e) {
    return {
      passed: true,
      hardFailures: [],
      notes: e instanceof Error ? e.message : String(e),
    };
  }
}

export function entityQaHardFailSummary(result: PageEntityQaResult): string {
  return result.hardFailures.join(', ') || result.notes || 'ok';
}
