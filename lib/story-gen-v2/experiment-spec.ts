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
