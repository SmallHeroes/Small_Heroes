/**
 * Post-render HARD entity QA — duplicate child/companion, presence, species.
 * Fail-closed: errors/skips never return passed:true.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

import { getCompanionById } from '../companions';

export type PageEntityQaFailure =
  | 'duplicate_child'
  | 'duplicate_companion'
  | 'companion_missing'
  | 'wrong_companion_species'
  | 'companion_wrong_identity';

export type PageEntityQaStatus = 'pass' | 'fail' | 'error';

export type PageEntityQaResult = {
  status: PageEntityQaStatus;
  /** True only when status === 'pass'. */
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
  "companionCount": number of distinct companion creatures of the expected species (0 if none),
  "singleCompanionOnly": true if at most ONE companion creature (no duplicate/clone/multiple copies of the companion),
  "duplicateChildCount": number of distinct human child protagonists (0 if none),
  "notes": "one short sentence"
}

HARD FAIL duplicate_child if singleChildOnly is false OR duplicateChildCount > 1 when a child is expected.
HARD FAIL duplicate_companion if expectsCompanion and (singleCompanionOnly is false OR companionCount > 1).
HARD FAIL companion_missing if expectsCompanion and companionPresentOk is false.
HARD FAIL wrong_companion_species if expectsCompanion and companionSpeciesOk is false.
HARD FAIL companion_wrong_identity if expectsCompanion and companionIdentityOk is false.`;
}

/** Local PNG path → base64 data URL so vision can read rendered page bytes. */
export function resolveEntityQaVisionDataUrl(imagePathOrUrl: string): string {
  const trimmed = imagePathOrUrl.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  const abs = path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed);
  if (!existsSync(abs)) {
    throw new Error(`entity QA image not found: ${abs}`);
  }
  const buf = readFileSync(abs);
  const ext = abs.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

function errorResult(notes: string, raw?: Record<string, unknown>): PageEntityQaResult {
  return {
    status: 'error',
    passed: false,
    hardFailures: [],
    notes,
    raw,
  };
}

function isIncompleteEntityQaRaw(
  raw: Record<string, unknown>,
  input: { expectsChild: boolean; expectsCompanion: boolean }
): boolean {
  if (!raw || Object.keys(raw).length === 0) return true;
  if (input.expectsChild && raw.singleChildOnly === undefined) return true;
  if (input.expectsCompanion) {
    if (raw.companionPresentOk === undefined) return true;
    if (raw.singleCompanionOnly === undefined) return true;
    if (raw.companionCount === undefined) return true;
  }
  return false;
}

export function evaluateEntityQaFromRaw(input: {
  expectsChild: boolean;
  expectsCompanion: boolean;
  raw: Record<string, unknown>;
}): PageEntityQaResult {
  if (isIncompleteEntityQaRaw(input.raw, input)) {
    return errorResult('incomplete vision JSON — entity QA unverified', input.raw);
  }

  const hardFailures: PageEntityQaFailure[] = [];

  if (input.expectsChild && input.raw.singleChildOnly === false) {
    hardFailures.push('duplicate_child');
  }
  if (
    input.expectsChild &&
    typeof input.raw.duplicateChildCount === 'number' &&
    input.raw.duplicateChildCount > 1
  ) {
    if (!hardFailures.includes('duplicate_child')) hardFailures.push('duplicate_child');
  }
  if (input.expectsCompanion && input.raw.singleCompanionOnly === false) {
    hardFailures.push('duplicate_companion');
  }
  if (
    input.expectsCompanion &&
    typeof input.raw.companionCount === 'number' &&
    input.raw.companionCount > 1
  ) {
    if (!hardFailures.includes('duplicate_companion')) hardFailures.push('duplicate_companion');
  }
  if (input.expectsCompanion && input.raw.companionPresentOk === false) {
    hardFailures.push('companion_missing');
  }
  if (input.expectsCompanion && input.raw.companionSpeciesOk === false) {
    hardFailures.push('wrong_companion_species');
  }
  if (input.expectsCompanion && input.raw.companionIdentityOk === false) {
    hardFailures.push('companion_wrong_identity');
  }

  const status: PageEntityQaStatus = hardFailures.length > 0 ? 'fail' : 'pass';
  return {
    status,
    passed: status === 'pass',
    hardFailures,
    notes: typeof input.raw.notes === 'string' ? input.raw.notes : '',
    raw: input.raw,
  };
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
    return errorResult('OPENAI_API_KEY missing — entity QA unverified');
  }

  const speciesLabel = companionSpeciesLabel(input.companionId);
  const prompt = buildEntityQaPrompt({
    expectsChild: input.expectsChild,
    expectsCompanion: input.expectsCompanion,
    speciesLabel,
    companionName: input.companionName,
  });

  let visionDataUrl: string;
  try {
    visionDataUrl = resolveEntityQaVisionDataUrl(input.imageUrl);
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : String(e));
  }

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
              { type: 'image_url', image_url: { url: visionDataUrl, detail: 'low' } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return errorResult(`vision HTTP ${res.status} — entity QA unverified`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return errorResult('empty vision response — entity QA unverified');
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return errorResult('vision JSON parse failed — entity QA unverified');
    }

    return evaluateEntityQaFromRaw({
      expectsChild: input.expectsChild,
      expectsCompanion: input.expectsCompanion,
      raw,
    });
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}

export function entityQaHardFailSummary(result: PageEntityQaResult): string {
  if (result.status === 'error') return `error: ${result.notes}`;
  return result.hardFailures.join(', ') || result.notes || 'ok';
}

export function isEntityQaVerifiedPass(result: PageEntityQaResult): boolean {
  return result.status === 'pass' && result.passed;
}
