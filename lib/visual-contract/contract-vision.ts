/**
 * Hard contract vision gate — turns a rendered page image into a PageVisionObservation
 * by asking a vision model the contract's questions for that page (scene, one illustrated
 * child, companion small-cub, each critical object present at correct scale/state and not
 * confused with another, mustShow depicted, mustNotShow violated). The structured result
 * feeds the deterministic verdict in gate.ts across all three failure classes.
 */

import type { BookVisualContract, PageContract } from './types';
import type { PageVisionObservation, ObservedObject } from './gate';

const KNOWN_SCENES = new Set(['bedroom', 'fantasy_exterior', 'gate_area', 'return']);

/** Pure: map a vision JSON blob to a PageVisionObservation for the given page contract. */
export function interpretVisionJson(raw: unknown, pc: PageContract): PageVisionObservation {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const requiredObjectIds = pc.mustShow.filter((m) => m.startsWith('object:')).map((m) => m.slice('object:'.length));

  const objects: Record<string, ObservedObject> = {};
  const rawObjects = (r.objects && typeof r.objects === 'object' ? r.objects : {}) as Record<string, unknown>;
  for (const oid of requiredObjectIds) {
    const o = (rawObjects[oid] && typeof rawObjects[oid] === 'object' ? rawObjects[oid] : {}) as Record<string, unknown>;
    const confused = typeof o.confused_with === 'string' && o.confused_with && o.confused_with !== 'null' ? o.confused_with : null;
    objects[oid] = {
      present: o.present === true,
      correctScale: o.correct_scale === false ? false : true,
      correctState: o.correct_state === false ? false : true,
      confusedWith: confused,
    };
  }

  const companionRaw = (r.companion && typeof r.companion === 'object' ? r.companion : null) as Record<string, unknown> | null;
  const childCount = typeof r.child_count === 'number' ? r.child_count : null;

  // mustShow satisfaction for non-object clauses.
  const mustShowSatisfied: string[] = [];
  const msRaw = (r.must_show && typeof r.must_show === 'object' ? r.must_show : {}) as Record<string, unknown>;
  for (const clause of pc.mustShow) {
    if (clause.startsWith('object:')) continue;
    if (clause.startsWith('protagonist:')) {
      if (childCount == null || childCount >= 1) mustShowSatisfied.push(clause);
      continue;
    }
    if (clause.startsWith('companion:')) {
      if (companionRaw?.present === true) mustShowSatisfied.push(clause);
      continue;
    }
    if (msRaw[clause] === true) mustShowSatisfied.push(clause);
  }

  const violations = Array.isArray(r.must_not_show_violations)
    ? (r.must_not_show_violations as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  const sceneRaw = typeof r.scene === 'string' ? r.scene : null;
  return {
    sceneId: sceneRaw && KNOWN_SCENES.has(sceneRaw) ? sceneRaw : sceneRaw,
    childCount,
    photoreal: typeof r.photoreal === 'boolean' ? r.photoreal : null,
    companion: companionRaw
      ? {
          present: companionRaw.present === true,
          smallCub: typeof companionRaw.small_cub === 'boolean' ? companionRaw.small_cub : null,
          species: typeof companionRaw.species === 'string' ? companionRaw.species : null,
        }
      : null,
    objects,
    mustShowSatisfied,
    mustNotShowViolations: violations,
  };
}

function buildVisionPrompt(contract: BookVisualContract, pc: PageContract): string {
  const requiredObjects = pc.mustShow
    .filter((m) => m.startsWith('object:'))
    .map((m) => m.slice('object:'.length))
    .map((oid) => {
      const o = contract.criticalObjects.find((x) => x.objectId === oid);
      const state = o?.stateTimeline.find((s) => s.page === pc.page)?.state;
      return `- ${oid}: ${o?.canonicalDescription ?? oid}${state ? ` (expected state: ${state})` : ''}; scale: ${o?.scaleLock ?? '?'}`;
    });
  const nonObjectMustShow = pc.mustShow.filter((m) => !m.startsWith('object:'));

  return [
    'You are a strict visual-contract QA checker for a children’s book page. Answer ONLY about what is visibly depicted. Return JSON.',
    `Expected scene for this page: "${pc.sceneId}". Allowed scenes: bedroom, fantasy_exterior, gate_area, return.`,
    'Required critical objects (check each for presence, correct scale, correct state, and whether it was confused with a different object):',
    ...(requiredObjects.length ? requiredObjects : ['- (none)']),
    `Companion expected on this page: ${pc.companion.present ? `YES — must be a SMALL LION CUB (${pc.companion.scale})` : 'NO'}.`,
    'Must-show clauses (is each clearly depicted?):',
    ...nonObjectMustShow.map((m) => `- "${m}"`),
    'Must-NOT-show (list any that ARE present):',
    ...pc.mustNotShow.map((m) => `- "${m}"`),
    '',
    'Respond with JSON exactly:',
    '{',
    '  "scene": "bedroom|fantasy_exterior|gate_area|return|other",',
    '  "child_count": <integer>,',
    '  "photoreal": <true|false>,',
    '  "companion": { "present": <bool>, "small_cub": <bool>, "species": "<string>" },',
    '  "objects": { "<objectId>": { "present": <bool>, "correct_scale": <bool>, "correct_state": <bool>, "confused_with": "<objectId|null>" } },',
    '  "must_show": { "<clause text>": <bool> },',
    '  "must_not_show_violations": ["<clause text>"]',
    '}',
  ].join('\n');
}

/** Live: render image (URL or data: URL) → PageVisionObservation via vision model. */
export async function observePageForContract(
  imageUrl: string,
  contract: BookVisualContract,
  page: number
): Promise<PageVisionObservation> {
  const pc = contract.pageContracts.find((p) => p.page === page);
  if (!pc) throw new Error(`observePageForContract: no pageContract for page ${page}`);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const model = process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildVisionPrompt(contract, pc) },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`vision QA failed: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '{}';
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  return interpretVisionJson(parsed, pc);
}
