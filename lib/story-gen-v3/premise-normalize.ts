/**
 * Normalize LLM premise output to canonical StoryPremiseCandidate fields.
 * Creative arc fields are NEVER back-filled from companion defaults (fail-closed).
 */

import type { StoryPremiseCandidate } from './types';

export type PremiseNormalizeInput = Partial<StoryPremiseCandidate> &
  Record<string, unknown> & {
    hook?: string;
    opening?: string;
    play?: string;
    tryFail?: string;
    hiddenResilience?: string;
    objects?: string[];
    keyObject?: string[];
  };

/** MVP matrix + confidence-batch companions with cosmetic fallbacks only. */
export const KNOWN_PREMISE_COMPANION_IDS = [
  'fox_uri',
  'panda_anat',
  'bunny_ometz',
  'dragon_dini',
  'chameleon_koko',
  'lion_shaket',
  'turtle_beiti',
] as const;

export type KnownPremiseCompanionId = (typeof KNOWN_PREMISE_COMPANION_IDS)[number];

/** Never defaulted — missing in raw → gate missing_creative_fields. */
export const CREATIVE_PREMISE_FIELDS = [
  'companionComicEngineUsed',
  'companionWrongHelp',
  'escalation',
  'childDiscovery',
] as const satisfies readonly (keyof StoryPremiseCandidate)[];

const OBJECT_HINTS =
  /שמיכה|גרב|סל|כביסה|פופקורן|כיס|דלי|מגבת|כפתור|קופס|מדבקה|ענן|כרית|נעל|חול|ביצה|תינוק|שבלול|פחם|סנדוויץ/i;

/** Exact collapse-template phrases from removed Dini defaults — not any Dini mention. */
const DINI_COLLAPSE_TEMPLATE_RE =
  /הגנה דרקונית מוגזמת|עוטפת\/סוגרת\/בונה הגנה יותר מדי|יותר עטיפה, יותר בלאגן, פחות מקום לנשום|הבעיה היא לא הסכנה אלא העטיפה\/החזקה מדי/;

function pickString(raw: PremiseNormalizeInput, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function inferKeyObjects(raw: PremiseNormalizeInput): string[] {
  if (Array.isArray(raw.keyObjects) && raw.keyObjects.length) {
    return raw.keyObjects.map(String);
  }
  if (Array.isArray(raw.objects) && raw.objects.length) {
    return raw.objects.map(String);
  }
  const blob = [
    raw.opening,
    raw.play,
    raw.playSystem,
    raw.oneLineHook,
    raw.hook,
    raw.openingWeirdEvent,
  ]
    .filter(Boolean)
    .join(' ');
  const found = new Set<string>();
  for (const m of blob.match(/[\u0590-\u05FF]+/g) ?? []) {
    if (OBJECT_HINTS.test(m) && m.length >= 2) found.add(m);
  }
  return [...found].slice(0, 5);
}

const COMPANION_COSMETIC_DEFAULTS: Record<
  KnownPremiseCompanionId,
  { titleFallback: string; mattersSuffix: string }
> = {
  fox_uri: {
    titleFallback: '{{childName}} ואוּרי',
    mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לשועל.',
  },
  panda_anat: {
    titleFallback: '{{childName}} ועֲנָת',
    mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לפנדה.',
  },
  bunny_ometz: {
    titleFallback: '{{childName}} ובוּנִי',
    mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לארנב.',
  },
  dragon_dini: {
    titleFallback: '{{childName}} ודִּינִי',
    mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לדרקונית.',
  },
  chameleon_koko: {
    titleFallback: '{{childName}} וקִים',
    mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לזיקית.',
  },
  lion_shaket: {
    titleFallback: '{{childName}} ולֵיוֹ',
    mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לאריה.',
  },
  turtle_beiti: {
    titleFallback: '{{childName}} וטוֹלִי',
    mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לצב.',
  },
};

export function companionCosmeticDefaults(companionId: string): {
  titleFallback: string;
  mattersSuffix: string;
} {
  const defs = COMPANION_COSMETIC_DEFAULTS[companionId as KnownPremiseCompanionId];
  if (!defs) {
    throw new Error(
      `[premise-normalize] unknown companionId "${companionId}" — add cosmetic defaults or fix spec`
    );
  }
  return defs;
}

export function missingCreativePremiseFields(candidate: StoryPremiseCandidate): string[] {
  const missing: string[] = [];
  for (const field of CREATIVE_PREMISE_FIELDS) {
    const v = candidate[field];
    if (typeof v !== 'string' || v.trim().length < 12) {
      missing.push(field);
    }
  }
  return missing;
}

export function hasDiniCollapseResidue(candidate: StoryPremiseCandidate): boolean {
  const blob = CREATIVE_PREMISE_FIELDS.map((f) => candidate[f] ?? '').join(' ');
  return DINI_COLLAPSE_TEMPLATE_RE.test(blob);
}

export function normalizePremiseCandidate(
  raw: PremiseNormalizeInput,
  fallbackTheme: string,
  companionId: string
): StoryPremiseCandidate {
  const defs = companionCosmeticDefaults(companionId);
  const tryFailBlob = pickString(raw, 'tryFail', 'firstTry');
  const hook = pickString(raw, 'oneLineHook', 'hook');
  const opening = pickString(raw, 'openingWeirdEvent', 'opening') || hook;
  const childWant = pickString(raw, 'childWant');
  const play = pickString(raw, 'playSystem', 'play');
  const hidden = pickString(raw, 'hiddenResilienceTool', 'hiddenResilience');

  return {
    id: String(raw.id ?? 'premise_unknown'),
    titleSeed: pickString(raw, 'titleSeed') || defs.titleFallback,
    resilienceTheme: pickString(raw, 'resilienceTheme') || fallbackTheme,
    hiddenResilienceTool: hidden || 'גבול רך — קרוב מספיק, פתוח מספיק',
    oneLineHook: hook,
    openingWeirdEvent: opening,
    childWant,
    whyItMattersToChild:
      pickString(raw, 'whyItMattersToChild') ||
      (childWant ? `${childWant} — ${defs.mattersSuffix}` : ''),
    physicalProblem:
      pickString(raw, 'physicalProblem') || play || opening || 'משהו פיזי בבית נתקע או משתגע',
    playSystem: play,
    keyObjects: inferKeyObjects(raw),
    companionComicEngineUsed: pickString(raw, 'companionComicEngineUsed'),
    companionWrongHelp: pickString(raw, 'companionWrongHelp'),
    firstTry: pickString(raw, 'firstTry') || tryFailBlob.split(';')[0]?.trim() || tryFailBlob,
    whyFirstTryFails:
      pickString(raw, 'whyFirstTryFails') ||
      tryFailBlob.split(';')[1]?.trim() ||
      tryFailBlob ||
      'הניסיון הראשון נכשל בגלל תגובת יתר או תפיסה צמודה מדי',
    funnyFailureImage:
      pickString(raw, 'funnyFailureImage') ||
      tryFailBlob ||
      opening ||
      'בלאגן פיזי קטן שאפשר לצייר',
    escalation: pickString(raw, 'escalation'),
    childDiscovery: pickString(raw, 'childDiscovery'),
    braveChildAction:
      pickString(raw, 'braveChildAction') || 'הילד עושה פעולה קטנה וברורה שמשנה את המצב',
    bigReleasePayoff: pickString(raw, 'bigReleasePayoff'),
    oneResilienceLineMax:
      pickString(raw, 'oneResilienceLineMax') ||
      hidden ||
      (companionId === 'chameleon_koko' ? 'משהו מוכר נשאר — גם כשהמקום חדש.' : 'קרוב מספיק לעזור.'),
    whyChildWillCare:
      pickString(raw, 'whyChildWillCare') ||
      'יש בלאגן מצחיק ודמות קטנה שרוצה משהו פשוט',
    whyParentWillCare:
      pickString(raw, 'whyParentWillCare') ||
      'גבול רך בלי מסר מטיפי — דרך משחק פיזי',
    whyNotTherapeuticFable: pickString(raw, 'whyNotTherapeuticFable'),
    whyNotGoldenCopy: pickString(raw, 'whyNotGoldenCopy'),
    premiseFamily: raw.premiseFamily,
  };
}
