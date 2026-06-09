/**
 * Normalize LLM premise output to canonical StoryPremiseCandidate fields.
 */

import type { StoryPremiseCandidate } from './types';

type RawPremise = StoryPremiseCandidate &
  Record<string, unknown> & {
    hook?: string;
    opening?: string;
    play?: string;
    tryFail?: string;
    hiddenResilience?: string;
    objects?: string[];
    keyObject?: string[];
  };

const OBJECT_HINTS =
  /שמיכה|גרב|סל|כביסה|פופקורן|כיס|דלי|מגבת|כפתור|קופס|מדבקה|ענן|כרית|נעל|חול|דלי|ביצה|תינוק|שבלול|פחם|סנדוויץ/i;

function pickString(raw: RawPremise, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function inferKeyObjects(raw: RawPremise): string[] {
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

export function normalizePremiseCandidate(raw: RawPremise, fallbackTheme: string): StoryPremiseCandidate {
  const tryFailBlob = pickString(raw, 'tryFail', 'firstTry');
  const opening = pickString(raw, 'openingWeirdEvent', 'opening');
  const hook = pickString(raw, 'oneLineHook', 'hook');
  const childWant = pickString(raw, 'childWant');
  const play = pickString(raw, 'playSystem', 'play');
  const hidden = pickString(raw, 'hiddenResilienceTool', 'hiddenResilience');

  return {
    id: raw.id,
    titleSeed: pickString(raw, 'titleSeed') || '{{childName}} ודִּינִי',
    resilienceTheme: pickString(raw, 'resilienceTheme') || fallbackTheme,
    hiddenResilienceTool: hidden || 'גבול רך — קרוב מספיק, פתוח מספיק',
    oneLineHook: hook,
    openingWeirdEvent: opening,
    childWant,
    whyItMattersToChild:
      pickString(raw, 'whyItMattersToChild') ||
      (childWant ? `${childWant} — זה חשוב לו/לה עכשיו, לא רק לדרקון.` : ''),
    physicalProblem:
      pickString(raw, 'physicalProblem') ||
      opening ||
      'משהו פיזי בבית או במשחק נתקע/מתפזר/נופל',
    playSystem: play,
    keyObjects: inferKeyObjects(raw),
    companionComicEngineUsed:
      pickString(raw, 'companionComicEngineUsed') ||
      'הגנה דרקונית מוגזמת — כנף/זנב/קן במקום לא נכון',
    companionWrongHelp:
      pickString(raw, 'companionWrongHelp') ||
      'דִּינִי עוטפת/סוגרת/בונה הגנה יותר מדי במקום לתת לילד לנסות',
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
    escalation:
      pickString(raw, 'escalation') ||
      'המצב גדל — יותר עטיפה, יותר בלאגן, פחות מקום לנשום',
    childDiscovery:
      pickString(raw, 'childDiscovery') ||
      'הילד שם לב שהבעיה היא לא הסכנה אלא העטיפה/החזקה מדי',
    braveChildAction:
      pickString(raw, 'braveChildAction') ||
      pickString(raw, 'bigReleasePayoff') ||
      'הילד עושה פעולה קטנה וברורה שמשנה את המצב',
    bigReleasePayoff: pickString(raw, 'bigReleasePayoff'),
    oneResilienceLineMax:
      pickString(raw, 'oneResilienceLineMax') || hidden || 'קרוב, עם אוויר בפנים.',
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
