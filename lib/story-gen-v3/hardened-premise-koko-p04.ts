/**
 * Human-hardened koko_premise_04 — striped wall / TRANSITION (Scenario 2).
 * Sourced from STOP 1 tournament; repaired for Koko-specific arc (no Dini/popcorn collapse).
 */

import type { StoryPremiseCandidate } from './types';

export const HARDENED_KOKO_P04_ID = 'koko_premise_04';

export function buildHardenedPremiseKokoP04(): StoryPremiseCandidate {
  return {
    id: HARDENED_KOKO_P04_ID,
    titleSeed: '{{childName}} וקוֹקוֹ והקיר המפוספס',
    resilienceTheme: 'TRANSITION — stepping into unfamiliar place while carrying something familiar',
    hiddenResilienceTool: 'משהו מוכר (צבע/ציור) יכול לעזור לגשר בין ישן לחדש — underlayer only.',
    oneLineHook: 'קוֹקוֹ מנסה להתאים את עצמה לקיר מפוספס בחדר החדש — ונעלמת רק בחצי קו.',
    openingWeirdEvent:
      'הקיר מחולק לפסים צרים בצבעים שונים, וקוֹקוֹ חושבת שזה מושלם להסוואה — עד שהפס האמצעי נשאר ריק.',
    childWant:
      '{{childName}} רוצה לצבוע את הקיר מחדש כדי שהחדר ירגיש שלו/שלה, ולמצוא את קוֹקוֹ שלמה.',
    whyItMattersToChild:
      'זה החדר הראשון ש{{childName}} מסדר לבד — בלי שמישהו גדול יבוא אחרי ויתקן.',
    physicalProblem:
      'קוֹקוֹ נדבקת לפס אחד בקיר המפוספס ונעלמת רק בחצי — החצי השני בולט כמו פס זנב.',
    playSystem: 'צביעה, פסים, דוגמאות, בלגן צבעים שנוזלים זה לזה על הרצפה.',
    keyObjects: ['קיר מפוספס', 'מברשת צבע', 'דלי צבע', 'סולם קטן', 'ציור של {{childName}}'],
    companionComicEngineUsed: 'הסוואת צבעים — בוחרת את הפס הלא נכון, צבע בוגד לפני מילים',
    companionWrongHelp:
      'קוֹקוֹ מתחבאת על הפס האמצעי ואומרת "מצוין, אף אחד לא יראה" — בזמן שהזנב שלה בולט בפס הסגול.',
    firstTry:
      '{{childName}} מנסה לצבוע מעל הפסים כדי לאחד את הקיר — אבל כל מברשת מוסיפה פס חדש במקום למחוק.',
    whyFirstTryFails:
      'קוֹקוֹ מתאימה את עצמה לכל פס חדש בזריזות, והקיר נהיה עוד יותר מפוספס.',
    funnyFailureImage:
      'קוֹקוֹ מהבהבת כתום-פאניקה על פס ירוק, ואז סגול על פס כחול — "אני רגועה לגמרי," היא אומרת.',
    escalation:
      'הצבעים נוזלים מהדלי ויוצרים נחל קטן על הרצפה; קוֹקוֹ שוחה בו ויוצאת בגוון שלושה פסים בבת אחת.',
    childDiscovery:
      '{{childName}} שם לב שקוֹקוֹ לא נעלמת כי הפס האמצעי ריק — היא צריכה פס אחד שמחבר, לא עוד הסוואה.',
    braveChildAction:
      '{{childName}} מצייר פס רחב אחד שמחבר את כל הצבעים, ומזמין את קוֹקוֹ לשבת עליו כמו גשר.',
    bigReleasePayoff:
      'הצבעים נשפכים יחד לקיר אחד צבעוני, קוֹקוֹ שלמה על הגשר, והחדר נשמע בצחוק אחד גדול.',
    oneResilienceLineMax: 'פס אחד מחבר — גם כשהמקום חדש.',
    whyChildWillCare: 'צבעים בורחים, קוֹקוֹ נעלמת בחצי, קיר משתגע — בלאגן שאפשר לראות.',
    whyParentWillCare: 'מעבר לחדר חדש דרך משחק פיזי, בלי שיעור על אומץ.',
    whyNotTherapeuticFable:
      'זה לא "לקבל את עצמך" — זה דלי, מברשת, פס זנב בולט, ונחל צבע על הרצפה.',
    whyNotGoldenCopy:
      'לא קיר לבן ולא ארגז-פורטל; כאן הפס האמצעי הריק הוא הבעיה, לא זנב-עוגן על קרטון.',
    premiseFamily: 'companion_causes_comic_mess',
  };
}
