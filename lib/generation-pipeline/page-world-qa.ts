/**
 * Post-render HARD world QA (brief 0078 Phase D) — the world-lock analogue of entity QA.
 * Per page: is the SETTING the expected scene/zone? is each locked recurring object present in its
 * expected STATE (not redesigned / wrong state)? is any FORBIDDEN setting/scene shown?
 * Fail-closed: errors/skips never return passed:true. Vision-driven, general (bible-fed, no literals).
 */
import { resolveEntityQaVisionDataUrl } from './page-entity-qa';

export type PageWorldQaFailure = 'wrong_zone' | 'object_state_drift' | 'forbidden_scene';

export type PageWorldQaStatus = 'pass' | 'fail' | 'error';

export type PageWorldQaObjectExpectation = {
  label: string;
  /** Expected state on this page, or null when only presence/identity matters. */
  state: string | null;
};

export type PageWorldQaResult = {
  status: PageWorldQaStatus;
  passed: boolean;
  hardFailures: PageWorldQaFailure[];
  driftObjects: string[];
  notes: string;
  raw?: Record<string, unknown>;
};

function errorResult(notes: string, raw?: Record<string, unknown>): PageWorldQaResult {
  return { status: 'error', passed: false, hardFailures: [], driftObjects: [], notes, raw };
}

export function buildWorldQaPrompt(input: {
  zoneDescription: string;
  objects: PageWorldQaObjectExpectation[];
  forbiddenScenes: string[];
}): string {
  const objLines = input.objects.length
    ? input.objects
        .map(
          (o) =>
            `  - "${o.label}"${o.state ? ` — expected state: ${o.state}` : ' — expected: present, same design'}`
        )
        .join('\n')
    : '  (none)';
  const forbidden = input.forbiddenScenes.length
    ? input.forbiddenScenes.map((f) => `"${f}"`).join(', ')
    : '(none)';

  return `You are strict WORLD/SETTING QA for a children's picture-book page. Judge the SETTING and the
listed recurring objects ONLY. Ignore character counts/identity (a separate QA covers those).

Expected setting for this page: ${input.zoneDescription}

Expected recurring objects (identity must hold; only state may change):
${objLines}

Forbidden settings/scenes (must NOT be the page's location): ${forbidden}

Return ONLY JSON:
{
  "settingMatchesZone": true if the overall location/setting plausibly matches the expected setting above (same KIND of place; camera/angle may differ),
  "objects": [ { "label": "<label>", "presentInExpectedState": true if that object is visible AND its design/state is consistent with the expectation (not redesigned into a different object, not an obviously contradictory state) } ],
  "forbiddenScenePresent": true ONLY if the page's overall SETTING is one of the forbidden settings listed (e.g. an indoor room when an outdoor scene is expected, a clinic, daylight when night expected, a forest/stream). Ignore character/count issues.,
  "notes": "one short sentence"
}

Be lenient on camera angle, framing, and palette variation. HARD-fail only GROSS drift:
- wrong_zone if settingMatchesZone is false.
- object_state_drift if any listed object has presentInExpectedState false.
- forbidden_scene if forbiddenScenePresent is true.`;
}

function isIncompleteWorldQaRaw(raw: Record<string, unknown>): boolean {
  if (!raw || Object.keys(raw).length === 0) return true;
  if (raw.settingMatchesZone === undefined) return true;
  if (raw.forbiddenScenePresent === undefined) return true;
  return false;
}

export function evaluateWorldQaFromRaw(input: {
  objects: PageWorldQaObjectExpectation[];
  raw: Record<string, unknown>;
}): PageWorldQaResult {
  if (isIncompleteWorldQaRaw(input.raw)) {
    return errorResult('incomplete vision JSON — world QA unverified', input.raw);
  }

  const hardFailures: PageWorldQaFailure[] = [];
  const driftObjects: string[] = [];

  if (input.raw.settingMatchesZone === false) hardFailures.push('wrong_zone');

  const rawObjects = Array.isArray(input.raw.objects)
    ? (input.raw.objects as Array<Record<string, unknown>>)
    : [];
  for (const ro of rawObjects) {
    if (ro?.presentInExpectedState === false) {
      const label = typeof ro.label === 'string' ? ro.label : 'object';
      driftObjects.push(label);
    }
  }
  if (driftObjects.length) hardFailures.push('object_state_drift');

  if (input.raw.forbiddenScenePresent === true) hardFailures.push('forbidden_scene');

  const status: PageWorldQaStatus = hardFailures.length > 0 ? 'fail' : 'pass';
  return {
    status,
    passed: status === 'pass',
    hardFailures,
    driftObjects,
    notes: typeof input.raw.notes === 'string' ? input.raw.notes : '',
    raw: input.raw,
  };
}

export async function evaluatePageWorldQa(input: {
  imageUrl: string;
  zoneDescription: string;
  objects: PageWorldQaObjectExpectation[];
  forbiddenScenes: string[];
}): Promise<PageWorldQaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return errorResult('OPENAI_API_KEY missing — world QA unverified');
  if (!input.zoneDescription.trim()) return errorResult('no zone description — world QA unverified');

  const prompt = buildWorldQaPrompt(input);

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
        max_tokens: 400,
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
    if (!res.ok) return errorResult(`vision HTTP ${res.status} — world QA unverified`);

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return errorResult('empty vision response — world QA unverified');

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return errorResult('vision JSON parse failed — world QA unverified');
    }

    return evaluateWorldQaFromRaw({ objects: input.objects, raw });
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}

export function worldQaHardFailSummary(result: PageWorldQaResult): string {
  if (result.status === 'error') return `error: ${result.notes}`;
  const parts: string[] = [...result.hardFailures];
  if (result.driftObjects.length) parts.push(`drift:[${result.driftObjects.join(', ')}]`);
  return parts.join(', ') || result.notes || 'ok';
}
