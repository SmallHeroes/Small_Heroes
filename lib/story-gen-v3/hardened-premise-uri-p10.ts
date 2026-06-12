/**
 * Human-hardened uri_premise_10 — drip-tick night song (Sprint 11 slot #1).
 * Guy-approved 2026-06-12 from premise tournament; locked before spine/beats.
 */

import type { StoryPremiseCandidate } from './types';

export const HARDENED_URI_P10_ID = 'uri_premise_10';

export const FOX_URI_NIGHT_TONE_GUARD = [
  'Warm, silly, safe — night fear becomes inspectable in child-scale steps.',
  'Lantern = courage meter — tip-of-light only, never flood the dark.',
  'Uri proud-scout misread + slip; child corrects or steps closer.',
  'No horror escalation; no Uri solves climax alone.',
].join(' ');

export function buildHardenedPremiseUriP10(): StoryPremiseCandidate {
  return {
    id: HARDENED_URI_P10_ID,
    titleSeed: '{{childName}} ואוּרי במנגינת הטיפות',
    resilienceTheme: 'NIGHT_FEAR — fear becomes inspectable in child-scale night steps',
    hiddenResilienceTool: 'הקשבה פעילה — פחד מתגלה כמוזיקה (underlayer only).',
    oneLineHook: "צליל 'טִיק‑טָאק' בלילה הופך לשיר דליפה מצחיק.",
    openingWeirdEvent:
      'ממרפסת קצה החלון נשמע טִיק‑טָאק קבוע — אורי בטוח שמישהו דופק סודיות בקצב מתחת לחלון.',
    childWant: "{{childName}} רוצה לדעת מי 'מתופף' כדי להפסיק לפחד מהרעש.",
    whyItMattersToChild: 'הטפטוף מפריע לו להירדם.',
    physicalProblem: 'הרעש חוזר כל כמה שניות ממקום לא ברור מתחת למרפסת.',
    playSystem: 'פנס-מד-אומץ — מאירים טיפונת, עוקבים אחר הצליל עם דלי ויד פתוחה.',
    keyObjects: ['דלי פח', 'מים', 'טיפה', 'פנס-מד-אומץ', 'מרפסת'],
    companionComicEngineUsed:
      "Hidden-pattern — אורי מפרש את הקצב כאות חשאי, נעמד 'לשמירה' עם פנס מהבהב.",
    companionWrongHelp: 'הוא עושה תנועות שמירה דרמטיות שמכינות עוד רעשים.',
    firstTry: "{{childName}} דופק חזרה כדי 'לדבר' עם זה.",
    whyFirstTryFails: 'המים משפריצים החוצה והצליל מתבלבל.',
    funnyFailureImage: "אורי נרטב ומצהיר שזה 'גשם נקודתי אישי'.",
    escalation: 'הקצב נהיה מהיר יותר — שניהם בטוחים שמשהו עונה להם.',
    childDiscovery: '{{childName}} מגלה שהטפטוף פוגע בדלי פח ויוצר מנגינה.',
    braveChildAction: 'הוא מזיז את הדלי קצת — והצליל משתנה לשיר רך.',
    bigReleasePayoff: 'הם מנגנים יחד בטיפות עד שהלילה שקט.',
    oneResilienceLineMax: 'לפעמים הפחד רק מנגן אחרת.',
    whyChildWillCare: 'הרעשים של לילה נהיים מצחיקים וניתנים לשליטה.',
    whyParentWillCare: 'מציג דרך משחקית להפוך פחד לסקרנות.',
    whyNotTherapeuticFable: 'אין הסבר רגשי, רק גילוי מצחיק של מקור צליל.',
    whyNotGoldenCopy: 'לא צללים אלא צלילים; מנגנון חדש לגמרי.',
    premiseFamily: 'hidden_pattern',
  };
}
