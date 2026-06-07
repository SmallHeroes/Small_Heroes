import type { Scenario } from './story-generation-types';

/** Phase A kill-switch — bolly adventure (no golden in this direction). */
export const BOLLY_ADVENTURE_KILL_SWITCH_SCENARIO: Scenario = {
  id: 'bolly_adv_sand_gate_001',
  companionId: 'bolly_armadillo',
  direction: 'adventure',
  category: 'SELF_CONFIDENCE',
  beatCount: 12,
  titleSeed: '{{childName}} ובּוֹלִי פותחים שער חול',
  setting:
    'גינת משחקים ביום חם — ערימת חול עם שער כפול ומנהרה קטנה ש{{childName}} {בנה|בנתה} לבד/ה בבוקר',
  incitingIncident:
    'יובל מהכיתה מגיע/ה, מתלהב/ת מהשער, ושואל/ת שאלות: "איך פותחים? מה יש בפנים? אפשר לשבור?" — {{childName}} {קופא|קופאת} ו{רוצה|רוצה} שהשער יישאר סוד',
  emotionalCore:
    'גאווה על יצירה שלא מוכנים/ות לחשוף; לא איבוי — פחד שהסוד יימחק אם מישהו נכנס בלי הזמנה',
  companionRole:
    'בּוֹלִי מגיע/ה ככדור חם ליד הערימה, מדגים/ה רצף הצצה — אף, עין, צעד קטן — בלי למסור את מפתח הסוד',
  agencyTransfer:
    'עמוד 10 — {{childName}} {מזמין|מזמינה} "רק יד אחת, רק דרך הצד" — לא כל המנהרה, אבל לא נעלם/ת',
  climaxShape:
    'יובל משחק/ת חצי דרך; השער נשאר עם חלק סגור; {{childName}} {מרגיש|מרגישה} שעדיין {בעל|בעלת} הבית של הסוד',
  endingResidue:
    'המנהרה הקטנה עדיין לא נחשפה; אבל {{childName}} {ישב|ישבה} ליד הערימה בלי לברוח — הסוד קיים לצד חבר',
  distinctnessNotes:
    'לא ציור תחת כרית (fantasy golden), לא חדר לילה (bedtime recipe) — חוץ, חול, שחק חלקי, שאלות חבר',
};
