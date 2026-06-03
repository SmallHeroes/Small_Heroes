/**
 * Bounded per-page visual QA (one vision call) — all Style 01 book pages.
 */

export type PageVisualQaReason =
  | 'ok'
  | 'anatomy_failed'
  | 'identity_drift'
  | 'style_realism_drift'
  | 'duplicate_child'
  | 'object_geometry_failed'
  | 'furniture_geometry_failed'
  | 'closed_crib_geometry_failed'
  | 'emotional_staging_failed'
  | 'vision_skipped'
  | 'vision_error';

export type PageVisualQaResult = {
  passed: boolean;
  reason: PageVisualQaReason;
  details: string;
  flags: {
    anatomyOk: boolean;
    identityOk: boolean;
    styleOk: boolean;
    singleChildOk: boolean;
    objectGeometryOk: boolean;
    emotionalStagingOk: boolean;
  };
  raw?: Record<string, unknown>;
};

export type PageVisualQaConfig = {
  enabled: boolean;
  maxRegens: number;
};

export function resolvePageVisualQaConfig(): PageVisualQaConfig {
  const enabled = process.env.PAGE_VISUAL_QA_ENABLED !== 'false';
  const maxRegens = Math.min(
    5,
    Math.max(0, Number.parseInt(process.env.PAGE_VISUAL_QA_MAX_REGENS ?? '2', 10) || 2)
  );
  return { enabled, maxRegens };
}

const QA_PROMPT_BASE = `You are strict QA for a children's picture-book illustration page.

Return ONLY JSON:
{
  "anatomyOk": true if head/neck/limbs look natural (no twisted neck, no impossible pose),
  "identityOk": true if child looks like consistent illustrated child (not photoreal portrait),
  "styleOk": true if cute watercolor storybook — NOT photorealistic,
  "singleChildOk": true if at most ONE child protagonist when a child is expected,
  "objectGeometryOk": true if furniture/objects have plausible geometry overall,
  "emotionalStagingOk": true if emotional scenes show characters looking at the relevant subject (not empty stare),
  "uncannyNeck": true ONLY if clear twisted/disconnected neck or pasted-face effect,
  "blanketThroughRails": true ONLY if blanket clearly intersects or breaks crib/bed rails,
  "notes": "one short sentence"
}

FAIL anatomy if anatomyOk is false OR uncannyNeck is true.
FAIL emotional_staging if emotionalStagingOk is false on emotional closing pages.
FAIL object_geometry if objectGeometryOk is false OR blanketThroughRails is true.`;

const QA_PROMPT_CLOSED_CRIB = `

CRIB / RAILED BED — CHECK CAREFULLY (fail any clear violation):
Also return:
{
  "closedCribOk": true ONLY if crib/cot/bassinet is a CLOSED box with four continuous sides,
  "nearRailPresent": true ONLY if the near/front rail is visible and continuous (NOT open, NOT missing, NOT drop-side gap),
  "childOutsideCrib": true ONLY if the child stays OUTSIDE — no arms/hands/body passing THROUGH rails or open front,
  "blanketInsideRails": true ONLY if blanket is inside the crib volume, over baby — NOT through/breaking rails,
  "babyInsideCrib": true ONLY if baby is clearly on mattress INSIDE the rails,
  "openFrontRail": true ONLY if front/near rail is missing, open, or disconnected,
  "childThroughRail": true ONLY if child limbs/arms intersect or pass through crib bars or open gap,
  "disconnectedRails": true ONLY if rails look like a broken fence/box
}

FAIL closed_crib_geometry if ANY: openFrontRail, childThroughRail, disconnectedRails, blanketThroughRails,
OR closedCribOk/nearRailPresent/childOutsideCrib/blanketInsideRails/babyInsideCrib is false.
Be STRICT on crib geometry — when in doubt on impossible rails, FAIL.`;

function evaluateClosedCribFlags(raw: Record<string, unknown>): boolean {
  const cribFieldsOk =
    raw.closedCribOk !== false &&
    raw.nearRailPresent !== false &&
    raw.childOutsideCrib !== false &&
    raw.blanketInsideRails !== false &&
    raw.babyInsideCrib !== false;
  const hardFails =
    raw.openFrontRail === true ||
    raw.childThroughRail === true ||
    raw.disconnectedRails === true ||
    raw.blanketThroughRails === true;
  return cribFieldsOk && !hardFails;
}

const STRICT_CRIB_QA_PROMPT = `CRIB GEOMETRY INSPECTOR — children's book page. Default FAIL if uncertain.

A correct crib page MUST show:
- A CLOSED rectangular crib with four sides; the NEAR/FRONT side has a continuous TOP horizontal rail (not open, not missing).
- Child stands OUTSIDE; hands reach OVER the top rail from above only — NEVER between bars or through an open front gap.
- Blanket and baby stay INSIDE the rail volume; blanket does NOT pass through slats or break the wall.

Return ONLY JSON:
{
  "pass": true ONLY if ALL problem flags below are false AND geometry is clearly correct,
  "openFrontRail": true if near/front top rail is missing, open, or has a large gap,
  "childThroughRail": true if child arm/hand/body passes through bars or open front,
  "blanketThroughRail": true if blanket intersects or exits through rails/slats impossibly,
  "missingNearTopRail": true if you cannot see a continuous top rail on the near side,
  "babyInsideCrib": false if baby not clearly on mattress inside rails,
  "explanation": "one sentence"
}

Be STRICT: if the near side looks like an open fence or the child reaches into the crib interior through the front, set pass=false.`;

async function evaluateClosedCribStrictQa(imageUrl: string): Promise<{
  pass: boolean;
  raw: Record<string, unknown>;
  details: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { pass: true, raw: {}, details: 'OPENAI_API_KEY missing — strict crib skipped' };
  }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
        max_tokens: 280,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
              { type: 'text', text: STRICT_CRIB_QA_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { pass: true, raw: {}, details: `strict crib HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>;
    const hardFail =
      raw.openFrontRail === true ||
      raw.childThroughRail === true ||
      raw.blanketThroughRail === true ||
      raw.missingNearTopRail === true ||
      raw.babyInsideCrib === false;
    const pass = raw.pass === true && !hardFail;
    const details =
      typeof raw.explanation === 'string' ? raw.explanation : pass ? 'strict crib ok' : 'strict crib fail';
    return { pass, raw, details };
  } catch (e) {
    return {
      pass: true,
      raw: {},
      details: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function evaluatePageVisualQa(input: {
  imageUrl: string;
  expectsChild?: boolean;
  isEmotionalClosing?: boolean;
  hasStructuredObjects?: boolean;
  hasRailedBedOrCrib?: boolean;
}): Promise<PageVisualQaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      passed: true,
      reason: 'vision_skipped',
      details: 'OPENAI_API_KEY missing',
      flags: {
        anatomyOk: true,
        identityOk: true,
        styleOk: true,
        singleChildOk: true,
        objectGeometryOk: true,
        emotionalStagingOk: true,
      },
    };
  }

  const contextLines = [
    input.expectsChild ? 'A child protagonist is expected on this page.' : '',
    input.isEmotionalClosing ? 'This is an emotional closing / resolution page.' : '',
    input.hasStructuredObjects
      ? 'Structured furniture/objects (crib, bed, blanket, etc.) may appear — check geometry carefully.'
      : '',
    input.hasRailedBedOrCrib
      ? 'CRIB OR RAILED BED IS EXPECTED — apply CLOSED CRIB rules strictly. Reject open/missing front rail, arms through rails, blanket breaking rails.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const qaPrompt =
    QA_PROMPT_BASE + (input.hasRailedBedOrCrib ? QA_PROMPT_CLOSED_CRIB : '');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
        max_tokens: 350,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: input.imageUrl, detail: 'high' } },
              { type: 'text', text: `${qaPrompt}\n\n${contextLines}` },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return {
        passed: true,
        reason: 'vision_error',
        details: `HTTP ${res.status}`,
        flags: {
          anatomyOk: true,
          identityOk: true,
          styleOk: true,
          singleChildOk: true,
          objectGeometryOk: true,
          emotionalStagingOk: true,
        },
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>;

    const closedCribOk = input.hasRailedBedOrCrib
      ? evaluateClosedCribFlags(raw)
      : true;

    const flags = {
      anatomyOk: raw.anatomyOk !== false && raw.uncannyNeck !== true,
      identityOk: raw.identityOk !== false,
      styleOk: raw.styleOk !== false,
      singleChildOk: raw.singleChildOk !== false,
      objectGeometryOk:
        raw.objectGeometryOk !== false &&
        raw.blanketThroughRails !== true &&
        closedCribOk,
      emotionalStagingOk:
        !input.isEmotionalClosing || raw.emotionalStagingOk !== false,
    };

    let reason: PageVisualQaReason = 'ok';
    if (!flags.anatomyOk) reason = 'anatomy_failed';
    else if (input.hasRailedBedOrCrib && !closedCribOk) {
      reason = 'closed_crib_geometry_failed';
    } else if (!flags.objectGeometryOk && input.hasStructuredObjects) {
      reason = raw.blanketThroughRails ? 'furniture_geometry_failed' : 'object_geometry_failed';
    } else if (!flags.emotionalStagingOk) reason = 'emotional_staging_failed';
    else if (!flags.singleChildOk) reason = 'duplicate_child';
    else if (!flags.identityOk) reason = 'identity_drift';
    else if (!flags.styleOk) reason = 'style_realism_drift';

    let passed = reason === 'ok';
    let details =
      typeof raw.notes === 'string'
        ? raw.notes
        : passed
          ? 'passed'
          : `failed checks: ${Object.entries(flags)
              .filter(([, v]) => !v)
              .map(([k]) => k)
              .join(', ')}`;

    let strictCribRaw: Record<string, unknown> | undefined;
    if (passed && input.hasRailedBedOrCrib) {
      const strict = await evaluateClosedCribStrictQa(input.imageUrl);
      strictCribRaw = strict.raw;
      if (!strict.pass) {
        passed = false;
        reason = 'closed_crib_geometry_failed';
        details = `strict_crib: ${strict.details}`;
        flags.objectGeometryOk = false;
      }
    }

    return {
      passed,
      reason,
      details,
      flags,
      raw: strictCribRaw ? { ...raw, strictCrib: strictCribRaw } : raw,
    };
  } catch (e) {
    return {
      passed: true,
      reason: 'vision_error',
      details: e instanceof Error ? e.message : String(e),
      flags: {
        anatomyOk: true,
        identityOk: true,
        styleOk: true,
        singleChildOk: true,
        objectGeometryOk: true,
        emotionalStagingOk: true,
      },
    };
  }
}
