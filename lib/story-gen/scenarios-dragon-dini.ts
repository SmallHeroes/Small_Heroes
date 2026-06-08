import type { PhaseBScenario } from './story-generation-types';

const COMPANION_ID = 'dragon_dini';
const CATEGORY = 'NEW_SIBLING';

/** Dini QA line — positive engine (no chip; QA line, not prose). */
export const DINI_QA_LINE =
  'הילד/ה עוזר/ת לדיני להשאיר אוויר בתוך החיבוק: קרוב מספיק להגן, פתוח מספיק לתת לקטן לנסות.';

/** F1 — הטיסה הראשונה (fantasy) — Step 5 generalization probe */
export const DINI_F1_HATISA_HARISHONA: PhaseBScenario = {
  id: 'dini_f1_hatisa_harishona_fantasy',
  companionId: COMPANION_ID,
  direction: 'fantasy',
  category: CATEGORY,
  beatCount: 16,
  status: 'active',
  titleHe: 'הטיסה הראשונה',
  titleSeed: '{{childName}} ודיני נותנים לטיסה הראשונה מקום',
  qaLine: DINI_QA_LINE,
  trigger:
    'בוקר על שפת הקן הגבוה — התינוק-דרקון רוצה לנסות לפרוש כנפיים בפעם הראשונה',
  childProblem:
    'רוצה שהקטן ינסה — אבל ברגע שהוא מתנדנד, משהו בו/בה רוצה לתפוס ולא לתת; אותו לחץ של "הוא קטן מדי, מה אם ייפול"',
  misread: 'אם אחזיק מספיק קרוב — הקטן לא ייפול.',
  companionEntry:
    'דיני על שפת הקן, כנף אחת כבר זקופה כמו קיר לפני שהתינוק בכלל זז — ההגנה הופיעה בגוף לפני שהיא החליטה.',
  engineUse:
    'דיני מנמיכה את הכנף-קיר לכנף-עם-פתח: מספיק קרוב לתפוס, מספיק פתוח לתת לקטן לנסות.',
  childAgency:
    'הילד/ה שם/ה לב שהכנף של דיני סוגרת מדי, ומדגים/ה בגוף פתח קטן — פורש/ת זרועות ומשאיר/ה רווח, או מזיז/ה יד אחת הצידה — ומראה לדיני "קרוב, אבל לא לסגור את כל השמיים." מדגים/ה בגוף, לא מסביר/ה.',
  comicBeat:
    'דיני מכריזה ברצינות: "כלל ראשון — נותנים מקום לנסות." ומיד הזנב שלה עושה מעגל סביב הקטן בלי לשאול ("הזנב שלי החליט לפני הלב").',
  imagery:
    'כנף שנפתחת מקיר לגשר; פתח של שמיים בין הכנף לקן; מעגל-זנב רך שמשתחרר לחצי.',
  climax:
    'התינוק-דרקון מתנדנד, נופל רך אל הכנף-גשר, ומנסה שוב — דרך הפתח שדיני השאירה.',
  residue:
    'דיני עדיין נושמת מהר כשהקטן קופץ — אבל הכנף שלה כבר לא קיר, היא פתח. "קרוב, עם אוויר בפנים."',
  whyThisIsFresh:
    'מנוע גבול-רך על תעופה/לתת-לנסות — לא על שמירת ביצה שלא בקעה (הגולדן). כאן: לתת לקטן לנסות, לא לעטוף את מה שעוד לא זז.',
  antiPatternNotes:
    'anti-egg-golden: כנף/פתח/תעופה — לא ביצה/עטיפה/אותו payoff. דיני = כנף/זנב/גבול, לא Bolly-עם-כנפיים ולא Tubi-עם-קן.',
  forbiddenPatterns: [
    'ביצה / עטיפת ביצה / שמירה על מה שלא בקע (הגולדן)',
    'דיני מרצה/מטיפה על "לשחרר"',
    'קסם נוצץ גנרי / לב אמיץ / אור פנימי ריק',
    'התינוק-דרקון הופך לגיבור במקום הילד',
    'דיני כדרקון-מגן אפי / קול דרקון עתיק',
    'דיני בירוק או התינוק בנחושת (ישויות נפרדות)',
  ],
  setting: 'עולם דרקונים — קן גבוה על צוק, בוקר, שפת הקן פתוחה לשמיים',
  incitingIncident:
    'התינוק-דרקון מטפס לשפת הקן לנסות לעוף; כנף דיני קופצת כקיר לפני שהוא מתנדנד',
  emotionalCore:
    'המתח בין להגן לבין לתת לנסות — אהבה שצריכה מקום לנשום; לא "לעזוב"',
  companionRole:
    'דיני מדגימה כלל רגוע ואז הגוף (זנב/כנף) מפר אותו מיד; לומדת כנף-עם-פתח',
  agencyTransfer:
    'הילד/ה מדגים/ה בגוף פתח קטן ומראה לדיני קרוב-אך-לא-סוגר',
  climaxShape: 'הקטן מנסה → נופל רך → מנסה שוב, דרך הפתח שנשאר',
  endingResidue: 'דיני עדיין דואגת; הכנף פתח ולא קיר; "קרוב, עם אוויר בפנים"',
  distinctnessNotes:
    'גבול-רך על תעופה/לתת-לנסות; comicBeat: "כלל ראשון — נותנים מקום" + הזנב מקיף מיד; מובחן מהביצה-גולדן ומ-Tubi/Bolly',
};

export const DRAGON_DINI_SCENARIOS: PhaseBScenario[] = [DINI_F1_HATISA_HARISHONA];

export function getDragonDiniScenario(id: string): PhaseBScenario | undefined {
  return DRAGON_DINI_SCENARIOS.find((s) => s.id === id);
}
