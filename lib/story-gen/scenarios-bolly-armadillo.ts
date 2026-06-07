import type { PhaseBScenario } from './story-generation-types';

/** Locked engine — shell as home; one peek counts. */
export const BOLLY_ENGINE =
  'come out of your shell — one peek counts. Shell = HOME you can leave AND return to (never get rid of). Confidence = peeking out a bit more each time, on your OWN terms. Signature: roll/curl, קליק, nose→eye→step peek, deadpan-brave from inside the ball.';

export const BOLLY_REFRAINS = [
  'הצצה אחת נחשבת',
  'לא כל בולי בבת אחת',
  'אני רועד קטן',
  'אפשר לחזור לקליפה — זה לא מוחק את ההצצה',
] as const;

/** Required on every Bolly scenario — small exposure, step back allowed, no role reversal. */
export const BOLLY_QA_LINE =
  'הילד/ה בוחר/ת חשיפה קטנה בעצמו/ה, יכול/ה לחזור אחורה, וחזרה לא מוחקת את הניסיון.';

export const BOLLY_QA_FAIL_PATTERNS = [
  'someone pushes the child forward',
  'child cured all at once',
  'shell shown as something to get rid of',
  'child coaxes Bolly out (role-reversal)',
] as const;

const COMPANION_ID = 'bolly_armadillo';
const CATEGORY = 'SELF_CONFIDENCE';

/** B1 — להצטרף למשחק (adventure, 12) — validation pick #1 */
export const BOLLY_B1_LAHITRAF: PhaseBScenario = {
  id: 'bolly_b1_lahitraf_adv',
  companionId: COMPANION_ID,
  direction: 'adventure',
  category: CATEGORY,
  beatCount: 12,
  status: 'active',
  validationOrder: 1,
  titleHe: 'להצטרף למשחק',
  titleSeed: '{{childName}} ובּוֹלִי מצטרפים למשחק בצעד קטן',
  qaLine: BOLLY_QA_LINE,
  trigger: 'קבוצת ילדים כבר משחקת; הילד/ה {רוצה|רוצה} להצטרף אבל {קופא|קופאת} בשוליים',
  childProblem: 'רוצה/ה בפנים — לא יכול/ה לזוז מהשול',
  misread: 'אם אתקרב, כולם יסתכלו עליי בבת אחת.',
  companionEntry:
    'בּוֹלִי מתגלגל/ת, נוגע/ת בנעל של הילד/ה — "הגעתי במצב עגול" — מספר/ת בגבורה מתוך הכדור.',
  engineUse: 'אף (צופה מרחוק) → עין (צעד קרוב) → רגל (עומד/ת בשוליים).',
  childAgency:
    'הילד/ה נותן/ת לעצמו/ה להיראות בשולי המשחק בלי להיבלע במבט של כולם — ויכול/ה לצעוד אחורה ושוב פנימה. שיא: שואל/ת ילד/ה אחד/ת, לא את כל הקבוצה — "אפשר גם אני?" = לא כל הילד בבת אחת. לא "נכנס/ת לאט" (panda rhythm); לא panda "הקצב שלי יוצר מקום".',
  comicBeat:
    'בּוֹלִי מתגלגל/ת אורך גוף אחד לכיוון הקבוצה, ואז חזרה לנקודת ההתחלה — "התקדמות עגולה היא גם התקדמות"; הרגל רועדת, "אני רועד קטן."',
  imagery:
    'הכדור זוחל לשול; אף→עין→צעד; הילד/ה בשול ואז צעד אחד פנימה.',
  climax: '"אפשר גם אני?" — לילד/ה אחד/ת, לא לכל הקבוצה.',
  residue:
    'הילד/ה במשחק ויכול/ה לצאת/להיכנס שוב — "הצצה אחת נחשבת."',
  whyThisIsFresh:
    'כניסה חברתית בין שווים, בלי הורה, בלי אובייקט/יצירה — רחוק מה-golden של חשיפת ציור בודד.',
  antiPatternNotes:
    'distinct from panda_anat: panda = הקצב שלי יוצר מקום; Bolly = נראה/ת קצת, נכנס/ת קצת, חוזר/ת אם צריך.',
  forbiddenPatterns: [...BOLLY_QA_FAIL_PATTERNS, 'enter slowly as sole agency', 'panda rhythm makes space'],
  setting: 'חצר / גינה — משחק "חישוקים" סביב כדור צבעוני במעגל; הילד/ה בשוליים',
  incitingIncident:
    'הכדור עובר בין הילדים במעגל — מי שבמרכז תופס; הילד/ה {רוצה|רוצה} להצטרף אבל {קופא|קופאת} בשול',
  emotionalCore: 'פחד ממבט של כולם בבת אחת — לא פחד מהמשחק עצמו',
  companionRole:
    'בּוֹלִי nose→eye→step; קומדיה: התקדמות עגולה, רגל רועדת, "הגעתי במצב עגול"',
  agencyTransfer:
    'נראה/ת בשול, צעד קטן פנימה, שאלה לילד/ה אחד/ת — חזרה מותרת',
  climaxShape: '"אפשר גם אני?" — לא כל הילד בבת אחת',
  endingResidue: 'במשחק; יכול/ה לצאת ולחזור; הצצה אחת נחשבת',
  distinctnessNotes:
    'social entry; anti-panda; validation #1; comicBeat: התקדמות עגולה + אני רועד קטן',
};

/** B2 — המילה שלי (adventure, 12) — public voice */
export const BOLLY_B2_HAMILA: PhaseBScenario = {
  id: 'bolly_b2_hamila_adv',
  companionId: COMPANION_ID,
  direction: 'adventure',
  category: CATEGORY,
  beatCount: 12,
  status: 'active',
  titleHe: 'המילה שלי',
  titleSeed: '{{childName}} ובּוֹלִי אומרים את המילה שלהם',
  qaLine: BOLLY_QA_LINE,
  trigger:
    'לילד/ה יש שורה / שיר קצר / שם לומר מול אחרים',
  childProblem: 'הקול ייצא רועד וכולם יראו',
  misread: 'אם אדבר, הקול ייצא רועד וכולם יראו.',
  companionEntry:
    'בּוֹלִי מכורכ/ת, מתרגל/ת את השורה מתוך הכדור בקול קטן ואמיץ — "אני מוכן לגמרי" (עדיין מגולגל/ת).',
  engineUse:
    'פה סגור → מילה אחת → משפט קטן → אפשר לחזור לקליפה. הפחד = קול רועד, לא ordeal רפואי/פיזי.',
  childAgency:
    'הילד/ה אומר/ת בצעדי הצצה משלהם — מקרק/ת בשפתיים, מילה אחת בקול, ואז השורה הקטנה — הקול שלהם, הקצב שלהם.',
  comicBeat:
    'בּוֹלִי מסיים/ה את השורה מושלם מתוך הקליפה; כשמגיע תורו בקול — יוצא רק "קְליק" — "הקול שלי עוד מתחמם."',
  imagery:
    'כדור עם סדק-פה; מילה אחת כצורה קטנה יוצאת; תשומת לב עדינה בחדר.',
  climax: 'הילד/ה אומר/ת את החלק — שקט אבל ברור — על תנאיו/ה.',
  residue:
    'הילד/ה אמר/ה את החלק; בפעם הבאה מילה נוספת — "לא כל בולי בבת אחת."',
  whyThisIsFresh:
    'להישמע (קול), לא להיראות עם אובייקט. לא validation pick (B1+B4 נותנים כיסוי רחב יותר).',
  antiPatternNotes:
    'guard vs bunny_ometz / generic courage — לא ordeal רפואי; הפחד = קול רועד.',
  forbiddenPatterns: [...BOLLY_QA_FAIL_PATTERNS, 'medical ordeal framing', 'generic bravery lecture'],
  setting: 'כיתה / חוג / מעגל — רגע לומר משהו מול אחרים',
  incitingIncident: 'תור להגיד שורה / שם / שיר קצר',
  emotionalCore: 'פחד שהקול ירעד וכולם יראו',
  companionRole:
    'בּוֹלִי מתרגל/ת בכדור; קומדיה: שורה מושלמת בפנים, קליק בחוץ',
  agencyTransfer: 'שפתיים → מילה → שורה קטנה; חזרה לקליפה מותרת',
  climaxShape: 'אומר/ת את החלק — שקט וברור',
  endingResidue: 'נאמר; בפעם הבאה עוד מילה',
  distinctnessNotes:
    'public voice exposure; not validation pick; anti-bunny ordeal',
};

/** B3 — מה שאני אוהב — RESERVE */
export const BOLLY_B3_MA_SHEANI_RESERVE: PhaseBScenario = {
  id: 'bolly_b3_ma_sheani_reserve',
  companionId: COMPANION_ID,
  direction: 'fantasy',
  category: CATEGORY,
  beatCount: 16,
  status: 'reserve',
  titleHe: 'מה שאני אוהב',
  titleSeed: '{{childName}} ובּוֹלִי — מה שאני אוהב (reserve)',
  qaLine: BOLLY_QA_LINE,
  trigger: 'ילד/ה רוצה/ה לחשוף משהו שמייצג אותם/ן',
  childProblem: 'פחד לחשוף "מי אני" מול אחרים',
  misread: 'אם יראו, יצחקו / לא יבינו.',
  companionEntry: 'בּוֹלִי מכורכ/ת — מדגים/ה הצצה קטנה.',
  engineUse: 'הצצה — אם מוחזר: identity-as-ACTION not object.',
  childAgency:
    'RESERVE — אם מוחזר: בחירה התנהגותית/סגנונית (ריקוד בדרך שלי / שם לקבוצה / "אני אוהב דינוזאורים נוצצים"), לא אובייקט מוצג.',
  comicBeat: '(reserve — refine when promoted)',
  imagery: 'זהות כפעולה, לא כחפץ.',
  climax: '(reserve)',
  residue: '(reserve)',
  whyThisIsFresh:
    'RESERVE — קרוב מדי ל-fantasy golden (דבר שמייצג אותי ≈ חשיפת ציור). לא validation ראשון.',
  antiPatternNotes:
    'If revived: identity-as-action, NOT identity-as-object shown to others.',
  forbiddenPatterns: [...BOLLY_QA_FAIL_PATTERNS, 'drawing reveal shape', 'shown object as identity'],
  setting: 'RESERVE — fantasy frame too close to golden',
  incitingIncident: 'RESERVE — object-reveal shape',
  emotionalCore: 'RESERVE — overlap with bolly_armadillo_fantasy golden',
  companionRole: 'RESERVE',
  agencyTransfer: 'RESERVE — behavioral choice if revived',
  climaxShape: 'RESERVE',
  endingResidue: 'RESERVE',
  distinctnessNotes:
    'RESERVE — closest to golden; do not use in first validation',
};

/** B4 — החדר שלי בלילה (bedtime, 8) — validation pick #2 */
export const BOLLY_B4_HACHEDER: PhaseBScenario = {
  id: 'bolly_b4_hacheder_bed',
  companionId: COMPANION_ID,
  direction: 'bedtime',
  category: CATEGORY,
  beatCount: 8,
  status: 'active',
  validationOrder: 2,
  titleHe: 'החדר שלי בלילה',
  titleSeed: '{{childName}} ובּוֹלִי נשארים בחדר בצעדים קטנים',
  qaLine: BOLLY_QA_LINE,
  trigger:
    'הילד/ה {רוצה|רוצה} להיות "גדול/ה" ולהירדם במרחב שלו/ה בלילה, אבל {מרגיש|מרגישה} קטן/ה בחושך — ביטחון בלי קהל',
  childProblem: 'קטן/ה בחושך כשאין מי שרואה',
  misread: 'אם אני לבד, אני קטן.',
  companionEntry:
    'בּוֹלִי מתכרבל/ת נוח על המיטה — "הקליפה היא בית, לא מחבוא" — מדגים/ה שהקליפה היא בית שאפשר לעזוב ולחזור.',
  engineUse:
    'בּוֹלִי מציץ/ה לחדר החשוך, ואז חוזר/ת — עוד קצת החוצה — יציאה וחזרה מותרות.',
  childAgency:
    'ניסיון קטן משלו/ה — נשאר/ת במיטה שלו/ה כמה דקות, מציץ/ה לחושך, דלת פתוחה, יודע/ת שאפשר לחזור / לקרוא להורה ושחזרה לא מוחקת. לא "לבד כל הלילה".',
  comicBeat:
    '"אני ישֵן באומץ מלא," ואז מציץ/ה עין אחת לבדוק שהחדר עדיין שם — "העולם עדיין שם. טוב"; מנסה "יד אמיצה" — עדיין בתוך הכדור.',
  imagery:
    'כדור נוח על המיטה; הצצה לחושך וחזרה; ילד/ה נרגע/ת במקום, שמיכה חצי, דלת פתוחה עם אור מסדרון.',
  climax:
    'הילד/ה {נרגע|נרגעת} במרחב שלו/ה על תנאיו/ה — צעדים קטנים, חזרה מותרת.',
  residue:
    'נשאר/ה במרחב; "אפשר לחזור לקליפה — זה לא מוחק את ההצצה."',
  whyThisIsFresh:
    'ביטחון בלי קהל, בלי אובייקט, בלי "הצגה" — המבחן הנקי ביותר למנוע. הכי רחוק מה-golden.',
  forbiddenPatterns: [
    ...BOLLY_QA_FAIL_PATTERNS,
    'alone all night as requirement',
    'shell as hiding to escape forever',
  ],
  setting: 'חדר הילד/ה בלילה — חושך, דלת פתוחה',
  incitingIncident: 'רוצה/ה להיות גדול/ה במרחב שלו/ה — מרגיש/ה קטן/ה בחושך',
  emotionalCore: 'ביטחון בלי שמישהו רואה',
  companionRole:
    'בּוֹלִי "קליפה = בית"; peek out and back; קומדיה: ישן באומץ + עין בודקת + יד בכדור',
  agencyTransfer:
    'דקות במיטה, הצצה, דלת פתוחה — חזרה/קריאה להורה מותרת',
  climaxShape: 'נרגע/ת במרחב — צעדים קטנים',
  endingResidue: 'נשאר/ה במרחב; חזרה לקליפה לא מוחקת',
  distinctnessNotes:
    'confidence without audience; validation #2; furthest from golden',
};

/** B5 — המשפט הקטן שלי (bedtime, 8) — private voice */
export const BOLLY_B5_HAMISHPAT: PhaseBScenario = {
  id: 'bolly_b5_hamishpat_bed',
  companionId: COMPANION_ID,
  direction: 'bedtime',
  category: CATEGORY,
  beatCount: 8,
  status: 'active',
  titleHe: 'המשפט הקטן שלי',
  titleSeed: '{{childName}} ובּוֹלִי אומרים משפט קטן',
  qaLine: BOLLY_QA_LINE,
  trigger:
    'הילד/ה מחזיק/ה בפנים רצון/רגש קטן ומפחד/ת לומר אפילו להורה',
  childProblem: 'מפחד/ת שיישמע קטן/מטופש',
  misread: 'אם אגיד, זה יישמע קטן/מטופש.',
  companionEntry:
    'בּוֹלִי לוחש/ת את הגרסה האמיצה מתוך הכדור — "אני אגיד את זה ברגע" — נשאר/ת מגולגל/ת.',
  engineUse: 'המילים מציצות בעדינות — חצי-אמירה → אמירה.',
  childAgency:
    'משפט אישי קטן מאוד, כמעט-נלחץ: "אפשר להשאיר פס אור?" / "אני רוצה שתחכה עוד רגע." / "אני קצת מפחד." — לא נאום קטן.',
  comicBeat:
    'בּוֹלִי מתרגל/ת נאום גדול בפנים, בקול אומר/ת רק "...כן." וגאה מאוד — "התחלה מצוינת"; "אני לגמרי בחוץ" רק עם האף.',
  imagery:
    'כדור עם סדק-קול קטן; חצי-משפט כצורה רכה; ילד/ה והורה קרובים.',
  climax: 'הילד/ה אומר/ת את הדבר הקטן והאמיתי להורה — ונפגש/ת בעדינות.',
  residue: 'נאמר הדבר הקטן; בפעם הבאה, מילה נוספת.',
  whyThisIsFresh:
    'קול אינטימי פרטי להורה (מול B2 חשיפה ציבורית) — ביטחון לא רק לקהל. B2/B5 זוג קרוב; שניהם נשמרים, לא validation.',
  forbiddenPatterns: [...BOLLY_QA_FAIL_PATTERNS, 'little speech / monologue', 'grand confession'],
  setting: 'לילה — חדר, רגע קרוב עם הורה',
  incitingIncident: 'רצון/פחד קטן שלא נאמר',
  emotionalCore: 'פחד שהדבר יישמע קטן מדי',
  companionRole:
    'בּוֹלִי לוחש/ת בכדור; קומדיה: נאום גדול בפנים, "...כן" בחוץ, אף בלבד "לגמרי בחוץ"',
  agencyTransfer: 'חצי-אמירה → משפט קטן אינטימי',
  climaxShape: 'אומר/ת את האמת הקטנה — נפגש/ת בעדינות',
  endingResidue: 'נאמר; בפעם הבאה עוד מילה',
  distinctnessNotes:
    'private voice vs B2 public; not validation pick',
};

export const BOLLY_ARMADILLO_SCENARIOS: PhaseBScenario[] = [
  BOLLY_B1_LAHITRAF,
  BOLLY_B2_HAMILA,
  BOLLY_B3_MA_SHEANI_RESERVE,
  BOLLY_B4_HACHEDER,
  BOLLY_B5_HAMISHPAT,
];

export const BOLLY_ARMADILLO_ACTIVE_SCENARIOS = BOLLY_ARMADILLO_SCENARIOS.filter(
  (s) => s.status === 'active'
);

export const BOLLY_ARMADILLO_RESERVE_SCENARIOS = BOLLY_ARMADILLO_SCENARIOS.filter(
  (s) => s.status === 'reserve'
);

/** Phase B validation: B1 adventure (social entry) + B4 bedtime (brave alone). */
export const BOLLY_ARMADILLO_VALIDATION_SCENARIOS: PhaseBScenario[] = [
  BOLLY_B1_LAHITRAF,
  BOLLY_B4_HACHEDER,
];

export function getBollyArmadilloScenario(id: string): PhaseBScenario | undefined {
  return BOLLY_ARMADILLO_SCENARIOS.find((s) => s.id === id);
}
