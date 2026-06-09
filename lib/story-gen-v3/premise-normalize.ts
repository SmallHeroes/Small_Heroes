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

function companionDefaults(companionId: string): {
  titleFallback: string;
  comicEngine: string;
  wrongHelp: string;
  escalation: string;
  childDiscovery: string;
  mattersSuffix: string;
} {
  if (companionId === 'chameleon_koko') {
    return {
      titleFallback: '{{childName}} וקוֹקוֹ',
      comicEngine: 'הסוואת צבעים — מתאימה לדבר הלא נכון, צבע בוגד לפני מילים',
      wrongHelp: 'קוֹקוֹ מתחבאת/מתאימה צבע במקום הלא נכון ומסתירה את הבעיה האמיתית',
      escalation: 'המצב מסתבך — יותר צבעים, יותר הסוואה, פחות ברור איפה קוֹקוֹ',
      childDiscovery: 'הילד שם לב לדפוס פיזי קטן — לא לרגש, לא לשיעור',
      mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לקוֹקוֹ.',
    };
  }
  if (companionId === 'lion_shaket') {
    return {
      titleFallback: '{{childName}} ולֵיוֹ',
      comicEngine: 'קול עם משקל — שאגה/לחישה נופלת פיזית, זנב מכה ברצפה',
      wrongHelp: 'לֵיוֹ מנסה להיות שקט/גדול בדרך לא נכונה — הקול עושה נזק קומי',
      escalation: 'יותר רעש, יותר משקל — אבל לא רק הסלמה; צריך תור אמצע',
      childDiscovery: 'הילד מגלה איך קול קטן אמיתי עובד בעולם הזה',
      mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לאריה.',
    };
  }
  if (companionId === 'bunny_ometz') {
    return {
      titleFallback: '{{childName}} ובוּנִי',
      comicEngine: 'אוזניים מספרות אמת — משפט אמיץ יוצא הפוך, לחישה אמיתית',
      wrongHelp: 'בוּנִי מתרגל אומץ יותר מדי במקום לתת לילד לבחור רגע קטן',
      escalation: 'יותר "ואולי", יותר תרחישים — הפחד גדל בלי שקר',
      childDiscovery: 'הילד מוצא משהו קטן שהוא כן שולט בו — לא הבטחה רפואית',
      mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לארנב.',
    };
  }
  if (companionId === 'turtle_beiti') {
    return {
      titleFallback: '{{childName}} וטוֹלִי',
      comicEngine: 'בית על הגב — קונכייה, אריזה, נסיגה בזמן לא נכון',
      wrongHelp: 'טוֹלִי "כבר בבית" / נמשכת לקונכייה במקום לעזור לילד לבנות סימן פיזי',
      escalation: 'יותר דברים על הקונכייה, פחות רואים את המקום החדש',
      childDiscovery: 'הילד שם/מוצא חפץ או טקס שמעביר בית למקום החדש',
      mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לצב.',
    };
  }
  return {
    titleFallback: '{{childName}} ודִּינִי',
    comicEngine: 'הגנה דרקונית מוגזמת — כנף/זנב/קן במקום לא נכון',
    wrongHelp: 'דִּינִי עוטפת/סוגרת/בונה הגנה יותר מדי במקום לתת לילד לנסות',
    escalation: 'המצב גדל — יותר עטיפה, יותר בלאגן, פחות מקום לנשום',
    childDiscovery: 'הילד שם לב שהבעיה היא לא הסכנה אלא העטיפה/החזקה מדי',
    mattersSuffix: 'זה חשוב לו/לה עכשיו, לא רק לדרקון.',
  };
}

export function normalizePremiseCandidate(
  raw: RawPremise,
  fallbackTheme: string,
  companionId = 'dragon_dini'
): StoryPremiseCandidate {
  const defs = companionDefaults(companionId);
  const tryFailBlob = pickString(raw, 'tryFail', 'firstTry');
  const hook = pickString(raw, 'oneLineHook', 'hook');
  const opening = pickString(raw, 'openingWeirdEvent', 'opening') || hook;
  const childWant = pickString(raw, 'childWant');
  const play = pickString(raw, 'playSystem', 'play');
  const hidden = pickString(raw, 'hiddenResilienceTool', 'hiddenResilience');

  return {
    id: raw.id,
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
    companionComicEngineUsed: pickString(raw, 'companionComicEngineUsed') || defs.comicEngine,
    companionWrongHelp: pickString(raw, 'companionWrongHelp') || defs.wrongHelp,
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
    escalation: pickString(raw, 'escalation') || defs.escalation,
    childDiscovery: pickString(raw, 'childDiscovery') || defs.childDiscovery,
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
