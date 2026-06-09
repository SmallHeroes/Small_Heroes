/**
 * Human-hardened dini_premise_10 — popcorn arc (locked before spine/beats).
 */

import type { StoryPremiseCandidate } from './types';

export const HARDENED_P10_ID = 'dini_premise_10';

export const POPCORN_TONE_GUARD = [
  'Warm, silly, safe — popcorn yelling "אש!" is dramatic popcorn logic, not real danger.',
  'Dini heat = soft butter-warmth, warm breath, dragon excitement — never real flame or microwave hazard.',
  'No Dini inside/near active microwave. Use: קערה, סיר, שולחן, מגבת, קופסת קרטון, ערב סרט, גשם פופקורן.',
].join(' ');

export function buildHardenedPremiseP10(): StoryPremiseCandidate {
  return {
    id: HARDENED_P10_ID,
    titleSeed: '{{childName}} והפופקורן שקרא לדרקון',
    resilienceTheme: 'overprotection / letting a smaller creature try',
    hiddenResilienceTool:
      'I can try something a bit grown-up by myself — underlayer only, not headline.',
    oneLineHook:
      'גרעין פופקורן קופץ מהקערה וצועק "אש!", ודיני חושבת שקראו לה לשמור.',
    openingWeirdEvent:
      'דיני נוחתת ליד השולחן, שומעת "אש!" מהקערה, ומתחילה לבנות "קן פופקורן בטוח" מסירים קרים, מגבות, וקצה כנף גדול מדי.',
    childWant:
      '{{childName}} הבטיח להכין קערת פופקורן לאח/אחות קטן/ה לערב סרט, ורוצה להצליח לבד בפעם הראשונה.',
    whyItMattersToChild:
      'מישהו קטן מחכה לערב סרט — {{childName}} רוצה להוכיח שיכול/ה לעשות את זה בלי שמישהו גדול ייקח את הקערה.',
    physicalProblem:
      'גרעינים קופצים מהקערה; דיני חושבת שכל "אש!" הוא גור אש קטן שצריך הצלה.',
    playSystem:
      'קפיצות פופקורן, מגבת-מפרש, מנהרת רוח מעל השולחן, גשם פופקורן לקערה.',
    keyObjects: ['קערה', 'מגבת', 'סיר', 'גרעין פופקורן', 'קופסת קרטון', 'שולחן'],
    companionComicEngineUsed:
      'protective dragon logic — too big for a small kitchen problem; tail/wing before thought',
    companionWrongHelp:
      'דיני חושבת שכל גרעין שצועק "אש!" הוא "גור אש קטן" שצריך להציל, ומתחילה לבנות "קן פופקורן בטוח" מסירים קרים, מגבות, וקצה כנף גדול מדי.',
    firstTry:
      '{{childName}} מנסה לכסות את הקערה כדי שהגרעינים יפסיקו לקפוץ — אבל המכסה רועד, נפתח, וענן פופקורן עף ישר אל הכנף של דיני.',
    whyFirstTryFails:
      'דיני מנסה "לעזור" עם נשיפה חמימה מדי (חמאה-חום רך, לא אש), והגרעינים קופצים עוד יותר כאילו הם מוחאים כפיים.',
    funnyFailureImage:
      'מכסה רועד, ענן פופקורן עף לכנף, גרעינים מוחאים כפיים אחרי נשיפה חמימה מדי.',
    escalation:
      '{{childName}} מנסה להעביר את הקערה לשולחן, אבל דיני פורשת כנף כמו גג בטיחות. הפופקורן נתקע מתחת לכנף, מתגלגל החוצה בצד השני, וגרעין אחד נוחת לדיני על האף.',
    childDiscovery:
      'כשהמגבת מתנפנפת בטעות, כמה גרעינים מפסיקים לקפוץ ונוחתים בשקט. {{childName}} שם לב שהקערה צריכה רוח קטנה, לא כנף כבדה.',
    braveChildAction:
      '{{childName}} הופך מגבת למפרש קטן, מסדר שדיני תנשוף רק מתחתיה, ומוביל את הפופקורן דרך "מנהרת רוח" מצחיקה אל הקערה.',
    bigReleasePayoff:
      'הפופקורן קופץ בקשת לבנה מעל השולחן, נוחת בקערה כמו גשם חמאה, דיני מקבלת גרעין אחד על האף, וכולם צועקים: "עוד סרט!"',
    oneResilienceLineMax: 'קרוב מספיק לעזור — רוח קטנה, לא כנף כבדה.',
    whyChildWillCare: 'ערב סרט, פופקורן קופץ, דרקונית על האף — בלאגן טעים.',
    whyParentWillCare: 'גבול רך דרך משחק מטבח — בלי מסר מטיפי.',
    whyNotTherapeuticFable:
      'זה לא משל על שליטה או שחרור — זו קערה, מגבת, גרעין על אף דרקון, וגשם פופקורן. ההבנה באה מפיזיקה של פופקורן.',
    whyNotGoldenCopy:
      'מטבח ופופקורן — לא ביצה, לא קן גבוה, לא ארגז צעצועים. דיני בטעות דרקונית על אף, לא מטיפה.',
    premiseFamily: 'object_creature_absurdity',
  };
}

export function hardenedPremiseToSpineFields(
  premise: StoryPremiseCandidate
): import('./types').StorySpineV3 {
  return {
    premiseId: premise.id,
    titleSeed: premise.titleSeed,
    oneLineHook: premise.oneLineHook,
    childWant: premise.childWant,
    hiddenResilienceTool: premise.hiddenResilienceTool,
    physicalProblem: premise.physicalProblem,
    playSystem: premise.playSystem,
    keyObjects: premise.keyObjects,
    companionWrongHelp: premise.companionWrongHelp,
    firstTryFail: `${premise.firstTry} ${premise.whyFirstTryFails}`,
    diniOverHelpAfterFirstFail: premise.whyFirstTryFails,
    secondTryFail: premise.escalation,
    childDiscovery: premise.childDiscovery,
    braveChildAction: premise.braveChildAction,
    bigReleasePayoff: premise.bigReleasePayoff,
    toneGuard: POPCORN_TONE_GUARD,
    oneSentenceEventChain: [
      premise.oneLineHook,
      premise.childWant,
      premise.firstTry,
      premise.escalation,
      premise.childDiscovery,
      premise.braveChildAction,
      premise.bigReleasePayoff,
    ].join(' → '),
  };
}
