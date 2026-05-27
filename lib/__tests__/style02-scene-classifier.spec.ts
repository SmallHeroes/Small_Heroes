import { describe, expect, it } from 'vitest';
import { classifyStyle02SceneClass } from '../style02-gptimage';

/** Previous short-book run — Hebrew bedroom prose + English imageDirections. */
const BOLLY_BEDTIME_PAGES: Array<{ bookPageText: string; imagePrompt: string }> = [
  {
    bookPageText:
      'מיכל שוכבת במיטה, האור העמום מהמסדרון משאיר פס רך על הקיר. על המדף מחכה מדחום קטן.',
    imagePrompt:
      'evening bedroom, soft night light, small thermometer resting on a shelf by the bed',
  },
  {
    bookPageText: 'מיכל מושכת את השמיכה סביב רגליה.',
    imagePrompt: 'close-up bed and pillow, Bolly mid small roll, blanket detail',
  },
  {
    bookPageText: 'עיניה גולשות אל המדחום שעל המדף.',
    imagePrompt: 'child in bed, eyes drifting toward the small thermometer on the shelf, then away',
  },
  {
    bookPageText: 'המחשבה על מחר גורמת לכתפיים שלה לעלות מעט.',
    imagePrompt: "close-up child's shoulders rising slightly, hand half-closing, in bed",
  },
  {
    bookPageText: 'בּוֹלִי מתקרב אליה ונעצר.',
    imagePrompt: 'close-up Bolly curled into a small ball on the blanket beside the child',
  },
  {
    bookPageText: 'היא מסתכלת ביד שלה. היד נסגרת לאגרוף קטן ואז נפתחת לאט לאט.',
    imagePrompt: 'close-up small hand closing to a fist then opening slowly, on the blanket',
  },
  {
    bookPageText: 'היא מושיטה אצבע קטנה ונוגעת בבּוֹלִי בעדינות.',
    imagePrompt: "close-up child's finger gently touching Bolly, one small plate open",
  },
  {
    bookPageText: 'המדחום עדיין על המדף, באותו מקום.',
    imagePrompt: 'child looking calmly at the thermometer still resting on the shelf, body relaxed',
  },
  {
    bookPageText: 'מיכל מחייכת חיוך שקט.',
    imagePrompt: "close-up Bolly nudging the pillow, child's small quiet smile, body soft in bed",
  },
  {
    bookPageText: 'היא ישנה בשקט, נשימה רגועה.',
    imagePrompt:
      'close-up bedside warm light, child asleep, thermometer still small on the shelf, Bolly snug',
  },
];

describe('classifyStyle02SceneClass — bolly bedtime', () => {
  it('classifies all 10 bedroom pages as night-bedroom (not forest-outdoor)', () => {
    const classes = BOLLY_BEDTIME_PAGES.map((p) =>
      classifyStyle02SceneClass({
        imagePrompt: p.imagePrompt,
        bookPageText: p.bookPageText,
      })
    );
    expect(classes.every((c) => c === 'night-bedroom')).toBe(true);
    expect(classes.filter((c) => c === 'forest-outdoor-environment')).toHaveLength(0);
  });
});
