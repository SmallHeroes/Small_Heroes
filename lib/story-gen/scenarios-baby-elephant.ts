import type { PhaseBScenario } from './story-generation-types';

/** Required on every Tubi scenario — child chooses one sound, not "hear less." */
export const TUBI_QA_LINE =
  'הילד/ה לא לומד/ת לשמוע פחות — {הילד/ה|הילד/ה} לומד/ת לבחור קול אחד.';

const COMPANION_ID = 'baby_elephant';
const CATEGORY = 'NOISE_FEAR';

/** S1 — היריד (adventure, 12) */
export const TUBI_S1_HA_YARID: PhaseBScenario = {
  id: 'tubi_s1_ha_yarid_adv',
  companionId: COMPANION_ID,
  direction: 'adventure',
  category: CATEGORY,
  beatCount: 12,
  status: 'active',
  titleHe: 'היריד',
  titleSeed: '{{childName}} וטוּבִּי בוחרים קול אחד ביריד',
  qaLine: TUBI_QA_LINE,
  trigger:
    'יריד ערב עמוס — קריאות, גלגלים, מוזיקה, צחוק בבת אחת בכניסה',
  childProblem:
    'מוצף/ת ליד השער; לא מצליח/ה להגיע למשחק היחיד ש{בא|בא} בשבילו',
  misread: 'אם אכנס, הכול ייכנס בבת אחת.',
  companionEntry:
    'טוּבִּי תקוע מאחורי דוכן כרטיסים קטן מדי, אוזניים פרושות כמו וילונות שתופסות הכול; הרגל שלו עושה בּוּם שמבהיל אותו.',
  engineUse: 'טוּבִּי מקפל אוזניים לחצי, בוחר את פעמון המשחק.',
  childAgency:
    'הילד/ה בוחר/ת קול שהם עושים/שלהם — קליק של הנעליים שלהם על הלוחות, או ספירה שקטה על כף יד של ההורה — ועוקב/ת אחרי החוט הזה בין האנשים. לא רק הולך/ת אחרי הורה.',
  comicBeat:
    '"אני רגוע לגמרי" — בזמן שהאוזניים שלו מרפרפות כמו שני וילונות בסערה; אוזן אחת עדיין רודפת אחרי עגלה רחוקה ("אני שומע רק קול אחד" — והאוזן בורחת).',
  imagery:
    'וילונות-אוזניים בחצי; "שביל של קול אחד" דק בתוך ים של צורות-קול.',
  climax: 'מגיעים למשחק בעקבות החוט שהילד/ה בחר/ה — לא בעקבות כל הרעש.',
  residue:
    'היריד נשאר רועש; הילד/ה שומר/ת את הקול שבחר/ה, השאר "גשם מעבר לחלון."',
  whyThisIsFresh:
    'קהל נע + קול נע שהילד/ה מחזיק/ה = ניווט; שונה מהגדרות סטטיות.',
  setting: 'יריד ערב — שער כניסה, דוכנים, מוזיקה וצחוק מכל עבר',
  incitingIncident:
    'בכניסה ליריד — כל הקולות בבת אחת; הילד/ה {קופא|קופאת} ולא מצליח/ה להגיע למשחק ש{בא|בא} בשבילו',
  emotionalCore: 'מוצף/ת מרעש רצוי — לא פחד ממקום, פחד שהכול ייכנס בבת אחת',
  companionRole:
    'טוּבִּי מדגים/ה אוזניים בחצי וקול אחד (פעמון); גוף קומי — בּוּם מהרגל, וילונות בסערה',
  agencyTransfer:
    'הילד/ה בוחר/ת קול משלהם (נעליים / ספירה) ועוקב/ת אחריו דרך הקהל',
  climaxShape: 'מגיעים למשחק בזכות החוט שהילד/ה בחר/ה',
  endingResidue: 'היריד רועש; הקול שנבחר נשאר קרוב, השאר מעבר לחלון',
  distinctnessNotes:
    'ניווט בקהל נע + קול שהילד/ה מחזיק/ה; comicBeat: "אני רגוע לגמרי" + אוזן בורחת',
};

/** S2 — הבית בלילה (bedtime, 8) — validation pick #2 */
export const TUBI_S2_HA_BAYIT: PhaseBScenario = {
  id: 'tubi_s2_ha_bayit_bed',
  companionId: COMPANION_ID,
  direction: 'bedtime',
  category: CATEGORY,
  beatCount: 8,
  status: 'active',
  validationOrder: 2,
  titleHe: 'הבית בלילה',
  titleSeed: '{{childName}} וטוּבִּי בוחרים קול אחד בלילה',
  qaLine: TUBI_QA_LINE,
  trigger:
    'בית בלילה — זמזום מקרר, רוח, מכונית רחוקה, קריקת מסדרון',
  childProblem:
    'לא מצליח/ה לישון; כל קול קטן מושך תשומת לב; החושך גורם לאוזניים להרגיש ענקיות',
  misread: 'אם אקשיב אשמע משהו רע; אם אסגור אפספס את אמא.',
  companionEntry:
    'טוּבִּי מתחת למיטה, אוזניים סגורות כמו וילונות כבדים — כל כך סגור שלא שומע את הילד/ה אומר/ת שלום (כשלון too-SHUT מוביל לכאן).',
  engineUse:
    'טוּבִּי מוריד את וילונות-האוזניים לאמצע, בוחר קול קטן וטוב — תקתוק איטי של השעון.',
  childAgency:
    'הילד/ה בוחר/ת קול קטן משלהם — תקתוק / הד של צעדים איטיים / ספירה שקטה של טוּבִּי — חצי-אוזן, לא סגור.',
  comicBeat:
    '"הבטן שלי שמעה את זה לפניי" — אחרי שבטנו של טוּבִּי מרעמת מהמקרר.',
  imagery: 'וילונות-אוזניים בחצי; קול רך אחד זוהר קטן בחדר חשוך.',
  climax: 'הלילה הרועש נהיה רקע; קול אחד נבחר נשאר קרוב.',
  residue: 'הבית עדיין מזמזם; הילד/ה שומר/ת קול קטן אחד ו{נרדם|נרדמת}.',
  whyThisIsFresh:
    'בחירת מנוחה/הרגעה; כשלון too-SHUT מוביל (מול too-open במקומות אחרים).',
  antiPatternNotes:
    'anti-fawn: אוזניים / קול / בחירה — לא "נשימה רכה / דבר רך להחזיק" (fawn_tzvi).',
  forbiddenPatterns: [
    'נשימה רכה ככלי',
    'דבר רך להחזיק',
    'texture soothing instead of sound choice',
  ],
  setting: 'חדר שינה בלילה — בית חי עם קולות קטנים',
  incitingIncident:
    'כל קול קטן מושך; החושך מגדיל את האוזניים; הילד/ה {לא מצליח|לא מצליחה} לישון',
  emotionalCore: 'פחד לפספס / לשמוע רע — לא רעש אחד גדול, אלא הרבה קטנים',
  companionRole:
    'טוּבִּי too-SHUT → אמצע; מדגים/ה תקתוק שעון; קומדיה בטן לפני האוזניים',
  agencyTransfer: 'הילד/ה בוחר/ת קול קטן משלהם — חצי, לא סגור',
  climaxShape: 'רקע רועש; קול נבחר נשאר קרוב',
  endingResidue: 'הבית מזמזם; קול אחד קטן; שינה',
  distinctnessNotes:
    'too-SHUT failure; anti-fawn guard; comicBeat: בטן שמעה לפני האוזניים',
};

/** S3 — האולם הגדול — RESERVE (do not use in first validation) */
export const TUBI_S3_HA_OLAM_RESERVE: PhaseBScenario = {
  id: 'tubi_s3_ha_olam_reserve',
  companionId: COMPANION_ID,
  direction: 'adventure',
  category: CATEGORY,
  beatCount: 12,
  status: 'reserve',
  titleHe: 'האולם הגדול',
  titleSeed: '{{childName}} וטוּבִּי — אולם גדול (reserve)',
  qaLine: TUBI_QA_LINE,
  trigger: 'אולם / מגרש / מקום ציבורי רועש — סף כניסה',
  childProblem: 'מוצף/ת בכניסה; צריך/ה קול עוגן אחד כדי "להיכנס"',
  misread: 'אם אכנס, הכול ייכנס בבת אחת.',
  companionEntry: 'טוּבִּי בפתח — אוזניים פרושות, מחפש/ת קול אחד.',
  engineUse: 'אוזניים בחצי; קול עוגן אחד לכניסה.',
  childAgency: 'הילד/ה בוחר/ת קול עוגן משלהם לחצות את הסף.',
  comicBeat: '(reserve — refine when promoted)',
  imagery: 'סף רועש; חוט קול אחד.',
  climax: 'נכנסים עם הקול שנבחר.',
  residue: 'האולם נשאר רועש; הקול נשאר.',
  whyThisIsFresh:
    'RESERVE — חופף מבנית ל-S1 (סף ציבורי + קול עוגן). S1 חזק יותר לניווט.',
  setting: 'אולם גדול / מגרש — כניסה רועשת',
  incitingIncident: 'סף כניסה — רעש מציף',
  emotionalCore: 'חופף S1 — שמור לגרסת בית-ספר/חדר כושר',
  companionRole: 'טוּבִּי — אוזניים בחצי, קול עוגן',
  agencyTransfer: 'קול עוגן שהילד/ה בוחר/ת',
  climaxShape: 'כניסה עם קול אחד',
  endingResidue: 'רעש נשאר; קול נשאר',
  distinctnessNotes: 'RESERVE — overlap with S1; do not use in first validation',
};

/** S4 — הרעם (bedtime, 8) — validate SECOND (whale-proximity) */
export const TUBI_S4_HA_RAAM: PhaseBScenario = {
  id: 'tubi_s4_ha_raam_bed',
  companionId: COMPANION_ID,
  direction: 'bedtime',
  category: CATEGORY,
  beatCount: 8,
  status: 'active',
  validationOrder: 3,
  titleHe: 'הרעם',
  titleSeed: '{{childName}} וטוּבִּי בוחרים את הגשם בין הרעמים',
  qaLine: TUBI_QA_LINE,
  trigger: 'סערת רעמים בלילה — קרקועים שלא ניתן לחזות או לעצור',
  childProblem: 'חוסר אונים מול מקור שלא בשליטה',
  misread: 'אם אני לא יכול לעצור את זה, אני חסר אונים.',
  companionEntry:
    'אוזני טוּבִּי נפתחות בקרקע הראשון; הוא תופס את כל הסערה בבת אחת, עיניים ענקיות, בטן רְרוּם.',
  engineUse:
    'במקום הרעם — טוּבִּי בוחר את טַף־טַף של הגשם ואת הרווח השקט בין הקרקועים.',
  childAgency:
    'לא שולט/ת ברעם — בוחר/ת במה להאזין: טַף־טַף / הרווח השקט. שליטה איפה האוזניים נחות, לא בתוצאה.',
  comicBeat:
    '"כף אחת עשתה בּוּם, וטוּבִּי קפץ מהבּוּם של עצמו" — לא מבדיל בין מכת ידו לרעם.',
  imagery: 'רעם נשאר רעם; טַף־טַף מתחת; רווחים בין בּוּמים.',
  climax:
    'קרקוע גדול — הילד/ה כבר בחר/ה את הגשם מתחתיו; הבּוּם עובר "מעבר לחלון."',
  residue: 'הסערה ממשיכה; הילד/ה מחזיק/ה את קול הגשם + הרווחים.',
  whyThisIsFresh:
    'מקור לא בשליטה — פחד = חוסר אונים; סוכנות = בחירת מיקוד, לא תוצאה. קרוב ל-whale — validate after engine proven.',
  forbiddenPatterns: [
    'מממ / humming',
    'lullaby / melody',
    'turning thunder into rhythm or pleasant sound',
    'every big sound has a song',
    'הרעם הופך לשיר',
  ],
  antiPatternNotes:
    'anti-whale HARD: הרעם נשאר רעם. כלי: "הרעם קיים. אני בוחר את טַף־טַף של הגשם בין הבּוּמים."',
  setting: 'לילה — סערה; חדר עם חלון',
  incitingIncident: 'קרקוע ראשון — אוזניים נפתחות; חוסר אונים',
  emotionalCore: 'לא שליטה על המקור — שליטה על המיקוד',
  companionRole:
    'טוּבִּי תופס הכול → בוחר טַף־טַף + רווח; קומדיה: בּוּם של כף vs רעם',
  agencyTransfer: 'בחירת גשם / רווח — לא שליטה ברעם',
  climaxShape: 'קרקוע גדול עובר מעבר לחלון; הגשם נשאר',
  endingResidue: 'סערה ממשיכה; גשם + רווחים',
  distinctnessNotes:
    'uncontrollable source; anti-whale forbidden list; validate AFTER S5+S2',
};

/** S5 — הזיקוקים (adventure, 12) — validation pick #1 */
export const TUBI_S5_HA_ZIKUKIM: PhaseBScenario = {
  id: 'tubi_s5_ha_zikukim_adv',
  companionId: COMPANION_ID,
  direction: 'adventure',
  category: CATEGORY,
  beatCount: 12,
  status: 'active',
  validationOrder: 1,
  titleHe: 'הזיקוקים',
  titleSeed: '{{childName}} וטוּבִּי רואים זיקוקים בלי להציף',
  qaLine: TUBI_QA_LINE,
  trigger:
    'זיקוקים / מופע יום העצמאות / מצעד שהילד/ה באמת {רוצה|רוצה} לראות — אבל הבּוּמים גדולים מדי',
  childProblem: 'רצון מול הצפה — לא רק פחד',
  misread: 'או שאני נהנה ומוצף, או שאני בורח ומפספס.',
  companionEntry:
    'טוּבִּי מכסה בטעות את העיניים במקום האוזניים, ואז פותח אוזניים רחב בבּוּם הראשון.',
  engineUse:
    'טוּבִּי שומר עיניים על הצבעים, אוזניים בחצי — הבּוּמים "מעבר לחלון" בזמן שהוא צופה.',
  childAgency:
    'הילד/ה מחליט/ה איפה לעמוד, מתי להסתכל, ומה להכניס לאוזניים — עיניים על האור, אוזניים בחצי. במה אקטיבי, לא רק "נשאר/ת".',
  comicBeat:
    '"האוזניים שלי פתחו את כל הדלתות" — בדיוק כש{התכוון|התכוונה} לשמור על חצי.',
  imagery:
    'וילונות-אוזניים בחצי מול צבעים מתפוצצים; בּוּמים כצורות בצד רחוק של החלון.',
  climax:
    'הבּוּם הכי גדול + הצבע הכי בהיר — הילד/ה צופה, אוזניים בחצי, שומר/ת את הרגע.',
  residue:
    'המופע נגמר; הילד/ה שמר/ה דבר רצוי בלי להציף ממנו.',
  whyThisIsFresh:
    'הרעש הוא רצוי — רצון מול הצפה, לא פחד. הכי resonant למוצר → validation #1.',
  setting: 'מצעד / מופע זיקוקים — עיניים על האור, אוזניים בחצי',
  incitingIncident: 'רצון לראות + בּוּמים גדולים — דילמה, לא בריחה',
  emotionalCore: 'רצון מול הצפה — לא pure fear',
  companionRole:
    'טוּבִּי עיניים על צבעים, אוזניים חצי; קומדיה: מכסה עיניים בטעות, "פתחו את כל הדלתות"',
  agencyTransfer:
    'הילד/ה בוחר/ת מיקום, תזמון מבט, ומה נכנס לאוזניים',
  climaxShape: 'בּוּם + צבע — צופים, אוזניים חצי',
  endingResidue: 'מופע נגמר; רצון נשמר בלי הצפה',
  distinctnessNotes:
    'desired loud thing; product-resonant; validation pick #1',
};

/** S6 — השקט שנשבר (bedtime, 8) */
export const TUBI_S6_HA_SHEKET: PhaseBScenario = {
  id: 'tubi_s6_ha_sheket_bed',
  companionId: COMPANION_ID,
  direction: 'bedtime',
  category: CATEGORY,
  beatCount: 8,
  status: 'active',
  titleHe: 'השקט שנשבר',
  titleSeed: '{{childName}} וטוּבִּי חוזרים לחצי אחרי הפתעה',
  qaLine: TUBI_QA_LINE,
  trigger:
    'בית שקט מדי אחרי שכולם נרדמו — ואז צעצוע נופל / דלת נסגרת / שיעול במסדרון שובר את הדממה',
  childProblem:
    'בדממה — מוכן/ה לקול הפתאומי; כשהוא בא, אוזניים נפתחות והצפה',
  misread: 'בשקט הגדול, כל קול פתאומי הוא ענק.',
  companionEntry:
    'טוּבִּי עוצר/ת נשימה כדי להיות שקט/ה — והחדק שלו עושה פּוּף קטן ומביך בדממה.',
  engineUse:
    'אחרי הקול הפתאומי — טוּבִּי מקפל/ת מחדש לחצי במקום להישאר פתוח/ה, בוחר/ת קול יציב (שעון, ספירת נשימות).',
  childAgency:
    'הילד/ה מתאושש/ת — אחרי ההלם, בוחר/ת לקפל לחצי ולבחור קול רגוע, במקום להישאר מוצף/ת/מוכן/ה.',
  comicBeat: '"החדק שלי עשה פּוּף בלי לשאול אותי."',
  imagery:
    'וילונות-אוזניים נפתחים ואז נמשכים חזרה לחצי; צורת-קול פתאומית שקטנה כשמשחררים.',
  climax:
    'קול פתאומי שני — הפעם הילד/ה מקפל/ת מהר ונשאר/ת יציב/ה.',
  residue:
    'השקט חוזר; הילד/ה יודע/ת לחזור לחצי אחרי הפתעה.',
  whyThisIsFresh:
    'INVERSION — שקט לא רועש; בעיה = קול בודד + התאוששות (re-fold, לא manage-continuous).',
  setting: 'בית בלילה — שקט גדול, ואז הפתעה',
  incitingIncident: 'שקט → קול פתאומי → הצפה',
  emotionalCore: 'הפתעה בשקט — לא רעש מתמשך',
  companionRole:
    'טוּבִּי פּוּף בדממה → re-fold לחצי; מנגנון recovery',
  agencyTransfer: 'אחרי startle — re-fold + קול רגוע',
  climaxShape: 'הפתעה שנייה — re-fold מהיר, יציבות',
  endingResidue: 'שקט חוזר; יודע/ת לחזור לחצי',
  distinctnessNotes:
    'inversion quiet→startle→recovery; comicBeat: חדק פּוּף בלי רשות',
};

export const BABY_ELEPHANT_SCENARIOS: PhaseBScenario[] = [
  TUBI_S1_HA_YARID,
  TUBI_S2_HA_BAYIT,
  TUBI_S3_HA_OLAM_RESERVE,
  TUBI_S4_HA_RAAM,
  TUBI_S5_HA_ZIKUKIM,
  TUBI_S6_HA_SHEKET,
];

export const BABY_ELEPHANT_ACTIVE_SCENARIOS = BABY_ELEPHANT_SCENARIOS.filter(
  (s) => s.status === 'active'
);

export const BABY_ELEPHANT_RESERVE_SCENARIOS = BABY_ELEPHANT_SCENARIOS.filter(
  (s) => s.status === 'reserve'
);

/** Phase B first validation: S5 then S2 (NOT S4 first). */
export const BABY_ELEPHANT_VALIDATION_SCENARIOS: PhaseBScenario[] = [
  TUBI_S5_HA_ZIKUKIM,
  TUBI_S2_HA_BAYIT,
];

/** S4 — run after engine proven (whale-proximity). */
export const BABY_ELEPHANT_SECOND_WAVE_SCENARIOS: PhaseBScenario[] = [TUBI_S4_HA_RAAM];

export function getBabyElephantScenario(id: string): PhaseBScenario | undefined {
  return BABY_ELEPHANT_SCENARIOS.find((s) => s.id === id);
}
