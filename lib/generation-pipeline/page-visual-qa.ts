/**
 * Bounded per-page visual QA (one vision call) — all Style 01 book pages.
 */
import {
  evaluateFamilyCoherenceFlags,
  FAMILY_COHERENCE_QA_PROMPT,
} from '../family-coherence/qa';
import { QUALITY_REGEN_BUDGET, type QualityVerdict } from './quality-evidence';

export type PageVisualQaReason =
  | 'ok'
  | 'anatomy_failed'
  | 'identity_drift'
  | 'style_realism_drift'
  | 'duplicate_child'
  | 'object_geometry_failed'
  | 'furniture_geometry_failed'
  | 'closed_crib_geometry_failed'
  | 'time_of_day_mismatch'
  | 'family_coherence_failed'
  | 'emotional_staging_failed'
  | 'vision_skipped'
  | 'vision_error'
  | 'vision_malformed';

export type PageVisualQaResult = {
  passed: boolean;
  /**
   * (#7-a) Durable-evidence verdict. Distinct from `passed`: when Vision is missing/errors the page is still
   * ACCEPTED by the render loop (`passed:true`, legacy behavior preserved), but the durable verdict is
   * `evidence_unknown` — a fail-closed signal so the readiness gate never delivers on un-QA'd bytes.
   */
  verdict: QualityVerdict;
  reason: PageVisualQaReason;
  details: string;
  flags: {
    anatomyOk: boolean;
    identityOk: boolean;
    styleOk: boolean;
    singleChildOk: boolean;
    objectGeometryOk: boolean;
    emotionalStagingOk: boolean;
    timeOfDayOk: boolean;
    companionSilhouetteOk: boolean;
  };
  raw?: Record<string, unknown>;
};

export type PageVisualQaConfig = {
  enabled: boolean;
  maxRegens: number;
};

export function resolvePageVisualQaConfig(): PageVisualQaConfig {
  const enabled = process.env.PAGE_VISUAL_QA_ENABLED !== 'false';
  // (#7-a) Hard cap 5 → QUALITY_REGEN_BUDGET (2): one candidate + at most two replacements. The env override
  // can only lower the budget, never raise it above the durable regen budget the readiness gate enforces.
  const maxRegens = Math.min(
    QUALITY_REGEN_BUDGET,
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

const QA_PROMPT_TIME_OF_DAY = `

TIME OF DAY — CHECK CAREFULLY (when story expects NIGHT or DUSK):
Also return:
{
  "timeOfDayOk": true ONLY if the scene reads as true night or dusk/twilight — NOT bright daylight,
  "readsAsDaylight": true if sunny, golden afternoon, bright pastoral garden, blue daytime sky, or general daylight feel even if sky is cropped,
  "readsAsNight": true if dark indigo/navy sky, moon/stars, or clear night-garden darkness with local warm light pools,
  "timeOfDayNotes": "one short sentence"
}

FAIL time_of_day if timeOfDayOk is false OR readsAsDaylight is true on a NIGHT/DUSK story page.
Detect "daylight feel", not only explicit sky color. Readable children's-book night is OK — do NOT require pitch black.`;

const QA_PROMPT_COMPANION_SILHOUETTE = `

COMPANION SILHOUETTE (when a companion creature is expected):
Also return:
{
  "companionSilhouetteOk": true if companion ears/tail/body proportions look consistent with a stable design (no suddenly longer/pointier ears, no major tail or body scale drift),
  "companionSilhouetteNotes": "one short sentence if drift noticed"
}
Track silhouette drift — do NOT fail overall pass solely for minor ear/tail drift unless extreme.`;

function defaultQaFlags(): PageVisualQaResult['flags'] {
  return {
    anatomyOk: true,
    identityOk: true,
    styleOk: true,
    singleChildOk: true,
    objectGeometryOk: true,
    emotionalStagingOk: true,
    timeOfDayOk: true,
    companionSilhouetteOk: true,
  };
}

// (#7-a-fix ITEM 1) The fields each active QA check REQUIRES present + boolean before a durable `passed` may
// be trusted. Validating a single sentinel is NOT enough: an omitted check would still default to PASS
// (`raw.X !== false` is true when X is absent) — that is the fail-open this closes. Reject anything else →
// evidence_unknown (vision_malformed), while preserving the legacy accept (passed:true).
const BASE_QA_FIELDS = [
  'anatomyOk', 'identityOk', 'styleOk', 'singleChildOk',
  'objectGeometryOk', 'emotionalStagingOk', 'uncannyNeck', 'blanketThroughRails',
] as const;
const CRIB_QA_FIELDS = [
  'closedCribOk', 'nearRailPresent', 'childOutsideCrib', 'blanketInsideRails',
  'babyInsideCrib', 'openFrontRail', 'childThroughRail', 'disconnectedRails',
] as const;
const TIME_QA_FIELDS = ['timeOfDayOk', 'readsAsDaylight', 'readsAsNight'] as const;
const COMPANION_QA_FIELDS = ['companionSilhouetteOk'] as const;
const FAMILY_QA_FIELDS = [
  'familyCoherenceOk', 'newbornNotDefaultPink', 'recurringParentConsistent',
  'noHeroFaceCloneOnParent', 'familyDefaultedWhite',
] as const;
const STRICT_CRIB_FIELDS = [
  'pass', 'openFrontRail', 'childThroughRail', 'blanketThroughRail', 'missingNearTopRail', 'babyInsideCrib',
] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function allBooleansPresent(raw: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((f) => f in raw && typeof raw[f] === 'boolean');
}
/**
 * CONTEXT-AWARE positive validation of a primary vision response. A durable `passed` requires a non-array
 * object with ALL base verdict fields present as booleans AND the conditional fields for every ACTIVE check
 * (crib/time/companion/family) present as booleans. Empty {}, null, array, primitive, missing field, or a
 * wrong-typed field → not valid.
 */
function qaResponseIsValid(
  parsed: unknown,
  ctx: { checkTimeOfDay: boolean; hasRailedBedOrCrib: boolean; expectsCompanion: boolean; hasHumanFamily: boolean },
): parsed is Record<string, unknown> {
  if (!isPlainObject(parsed)) return false;
  if (!allBooleansPresent(parsed, BASE_QA_FIELDS)) return false;
  if (ctx.hasRailedBedOrCrib && !allBooleansPresent(parsed, CRIB_QA_FIELDS)) return false;
  if (ctx.checkTimeOfDay && !allBooleansPresent(parsed, TIME_QA_FIELDS)) return false;
  if (ctx.expectsCompanion && !allBooleansPresent(parsed, COMPANION_QA_FIELDS)) return false;
  if (ctx.hasHumanFamily && !allBooleansPresent(parsed, FAMILY_QA_FIELDS)) return false;
  return true;
}

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

// (#7-a-fix ITEM 1b) The strict-crib check is REQUIRED (it runs after a primary PASS on crib pages). It must
// return passed|failed|evidence_unknown — NOT a fail-open `pass:true` on HTTP error / malformed body / throw,
// which would keep a durable PASS with the crib never actually validated. Uncertainty → evidence_unknown.
async function evaluateClosedCribStrictQa(imageUrl: string): Promise<{
  verdict: QualityVerdict;
  raw: Record<string, unknown>;
  details: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { verdict: 'evidence_unknown', raw: {}, details: 'OPENAI_API_KEY missing — strict crib unvalidated' };
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
      return { verdict: 'evidence_unknown', raw: {}, details: `strict crib HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? 'null');
    } catch {
      parsed = null;
    }
    if (!isPlainObject(parsed) || !allBooleansPresent(parsed, STRICT_CRIB_FIELDS)) {
      return {
        verdict: 'evidence_unknown',
        raw: isPlainObject(parsed) ? parsed : {},
        details: 'strict crib malformed or incomplete',
      };
    }
    const raw = parsed;
    const hardFail =
      raw.openFrontRail === true ||
      raw.childThroughRail === true ||
      raw.blanketThroughRail === true ||
      raw.missingNearTopRail === true ||
      raw.babyInsideCrib === false;
    const pass = raw.pass === true && !hardFail;
    const details =
      typeof raw.explanation === 'string' ? raw.explanation : pass ? 'strict crib ok' : 'strict crib fail';
    return { verdict: pass ? 'passed' : 'failed', raw, details };
  } catch (e) {
    return {
      verdict: 'evidence_unknown',
      raw: {},
      details: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function evaluatePageVisualQa(input: {
  imageUrl: string;
  expectsChild?: boolean;
  expectsCompanion?: boolean;
  expectedPageTimeOfDay?: import('../story-time-of-day').StoryTimeOfDay | null;
  isEmotionalClosing?: boolean;
  hasStructuredObjects?: boolean;
  hasRailedBedOrCrib?: boolean;
  hasHumanFamily?: boolean;
}): Promise<PageVisualQaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      passed: true,
      verdict: 'evidence_unknown',
      reason: 'vision_skipped',
      details: 'OPENAI_API_KEY missing',
      flags: defaultQaFlags(),
    };
  }

  const checkTimeOfDay =
    input.expectedPageTimeOfDay === 'night' || input.expectedPageTimeOfDay === 'dusk';

  const contextLines = [
    input.expectsChild ? 'A child protagonist is expected on this page.' : '',
    input.expectsCompanion ? 'A companion creature is expected on this page.' : '',
    checkTimeOfDay
      ? `STORY TIME OF DAY: ${input.expectedPageTimeOfDay?.toUpperCase()} — reject daylight/sunny/golden-afternoon feel.`
      : '',
    input.isEmotionalClosing ? 'This is an emotional closing / resolution page.' : '',
    input.hasStructuredObjects
      ? 'Structured furniture/objects (crib, bed, blanket, etc.) may appear — check geometry carefully.'
      : '',
    input.hasRailedBedOrCrib
      ? 'CRIB OR RAILED BED IS EXPECTED — apply CLOSED CRIB rules strictly. Reject open/missing front rail, arms through rails, blanket breaking rails.'
      : '',
    input.hasHumanFamily
      ? 'HUMAN FAMILY (mother/father/newborn sibling) expected — check family visual coherence with the child hero.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const qaPrompt =
    QA_PROMPT_BASE +
    (input.hasRailedBedOrCrib ? QA_PROMPT_CLOSED_CRIB : '') +
    (checkTimeOfDay ? QA_PROMPT_TIME_OF_DAY : '') +
    (input.expectsCompanion ? QA_PROMPT_COMPANION_SILHOUETTE : '') +
    (input.hasHumanFamily ? FAMILY_COHERENCE_QA_PROMPT : '');

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
        verdict: 'evidence_unknown',
        reason: 'vision_error',
        details: `HTTP ${res.status}`,
        flags: defaultQaFlags(),
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? 'null');
    } catch {
      parsed = null;
    }
    // (#7-a-fix ITEM 1) No durable `passed` on a malformed/incomplete response — even one that superficially
    // looks like a fail. Preserve the legacy accept (passed:true) but mark the durable verdict evidence_unknown.
    if (
      !qaResponseIsValid(parsed, {
        checkTimeOfDay,
        hasRailedBedOrCrib: !!input.hasRailedBedOrCrib,
        expectsCompanion: !!input.expectsCompanion,
        hasHumanFamily: !!input.hasHumanFamily,
      })
    ) {
      return {
        passed: true,
        verdict: 'evidence_unknown',
        reason: 'vision_malformed',
        details: 'malformed or incomplete vision response',
        flags: defaultQaFlags(),
      };
    }
    const raw: Record<string, unknown> = parsed;

    const closedCribOk = input.hasRailedBedOrCrib
      ? evaluateClosedCribFlags(raw)
      : true;
    const familyCoherenceOk = input.hasHumanFamily
      ? evaluateFamilyCoherenceFlags(raw)
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
      timeOfDayOk:
        !checkTimeOfDay ||
        (raw.timeOfDayOk !== false && raw.readsAsDaylight !== true),
      companionSilhouetteOk: !input.expectsCompanion || raw.companionSilhouetteOk !== false,
    };

    let reason: PageVisualQaReason = 'ok';
    if (!flags.anatomyOk) reason = 'anatomy_failed';
    else if (input.hasHumanFamily && !familyCoherenceOk) {
      reason = 'family_coherence_failed';
    } else if (checkTimeOfDay && !flags.timeOfDayOk) {
      reason = 'time_of_day_mismatch';
    } else if (input.hasRailedBedOrCrib && !closedCribOk) {
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
    if (!flags.companionSilhouetteOk && typeof raw.companionSilhouetteNotes === 'string') {
      details = `${details}; silhouette: ${raw.companionSilhouetteNotes}`;
    }
    if (checkTimeOfDay && !flags.timeOfDayOk && typeof raw.timeOfDayNotes === 'string') {
      details = `${details}; timeOfDay: ${raw.timeOfDayNotes}`;
    }

    let strictCribRaw: Record<string, unknown> | undefined;
    let strictCribUnknown = false;
    if (passed && input.hasRailedBedOrCrib) {
      const strict = await evaluateClosedCribStrictQa(input.imageUrl);
      strictCribRaw = strict.raw;
      if (strict.verdict === 'failed') {
        passed = false;
        reason = 'closed_crib_geometry_failed';
        details = `strict_crib: ${strict.details}`;
        flags.objectGeometryOk = false;
      } else if (strict.verdict === 'evidence_unknown') {
        // (#7-a-fix ITEM 1b) The required crib check could not be validated → never keep a durable `passed`.
        // Preserve the legacy accept (passed stays true) but downgrade the durable verdict.
        strictCribUnknown = true;
        details = `${details}; strict_crib_unknown: ${strict.details}`;
      }
    }

    const verdict: QualityVerdict = !passed ? 'failed' : strictCribUnknown ? 'evidence_unknown' : 'passed';
    return {
      passed,
      verdict,
      reason,
      details,
      flags,
      raw: strictCribRaw ? { ...raw, strictCrib: strictCribRaw } : raw,
    };
  } catch (e) {
    return {
      passed: true,
      verdict: 'evidence_unknown',
      reason: 'vision_error',
      details: e instanceof Error ? e.message : String(e),
      flags: defaultQaFlags(),
    };
  }
}
