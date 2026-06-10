import type { ExperimentSpecV2 } from './types';

/** First controlled experiment — apples-to-apples with panda_anat event engine, different plot. */
export const PANDA_ANAT_V2_EXP1: ExperimentSpecV2 = {
  id: 'panda_anat_adv_social_v2_exp1',
  companionId: 'panda_anat',
  direction: 'adventure',
  pageCount: 12,
  resilienceTheme: 'social hesitation / joining group play from the edge',
  goldenDnaSourceId: 'panda_anat_adventure',

  setting: 'גן שעשועים — אזור ארגז החול (לא שער הכניסה ולא רכבת כיסאות)',
  gameOrPlayPattern: 'גשר חול — ילדים בונים גשר מדליות ודליי חול',
  keyObject: 'עלה יבש חלק (לא אבן השהייה)',
  entryMethod: 'תפקיד "מחזיק/ת הדלי" במקום "אחראי/ת על הגלגלים"',
  finalChildAction: 'מציע/ה לשפוך דלי אחד בקצב איטי לגשר',

  forbidPlotCopy: [
    'אבן השהייה / pause-stone',
    'קו צהוב ליד השער',
    'רכבת כיסאות',
    'תפקיד גלגלים',
    'שער כניסה למגרש כמרכז הסיפור',
    'ילד עם גלגל צעצוע בצד',
  ],
};

/** Final v2 spike — Dini fantasy, child-led, not golden egg plot. */
export const DRAGON_DINI_V2_EXP2: ExperimentSpecV2 = {
  id: 'dragon_dini_fantasy_v2_exp2',
  companionId: 'dragon_dini',
  direction: 'fantasy',
  pageCount: 16,
  resilienceTheme:
    'overprotecting vs letting someone try — child acts and changes the situation, not only calms',
  goldenDnaSourceId: 'dragon_dini_fantasy',

  setting:
    'עולם דרקונים — מדרגות אבן חמות מעל בריכת אדים (לא גבעות כתומות ולא ארגז צעצועים)',
  gameOrPlayPattern:
    'משחק "מסלול ניצוץ" — קפיצות מטבעת אבן לטבעת; תינוק-דרקון רוצה לנסות קפיצה ראשונה',
  keyObject: 'אבן ניצוץ קטנה שמאירה כשמחזיקים אותה בכף פתוחה (לא ביצה)',
  entryMethod:
    'הילד רוצה להראות שהמסלול בטוח — אבל נופל לתפוס את התינוק לפני שהוא מגיע לקצה',
  finalChildAction:
    'הילד משחרר יד אחת, מדגים קפיצה קטנה בעצמו, ומשאיר פתח שהתינוק בוחר לקפוץ דרכו',

  forbidPlotCopy: [
    'ביצה ירוקה בנקודודים / שמירה על ביצה שלא בקעה',
    'עטיפת ביצה / ארגז צעצועים כפורטל',
    'סרט כסף / שמיכה צהובה',
    'גבעות כתומות עם רקיע סגול מהגולדן',
    'כרטיס החיבוק / חיבוק עם פתח כמילות מפתח',
    'התינוק-דרקון הוא הגיבור במקום הילד',
    'דיני פותרת בכוח דרקון',
    'עמודי אווירה בלי שינוי אירוע',
  ],
};
