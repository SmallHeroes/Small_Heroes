/**
 * EXPERIMENT — dev-only sample content for the page-flip prototype.
 * Prose: real approved bank story (bunny_ometz medical, story-bank v3-approved →
 * outputs/story-gen-v3-runs/confidence_bunny_ometz_medical-stop3), with the
 * {{childName}} token substituted exactly as production does at order time.
 * Illustrations: real product gallery pages (public/Images/gallery).
 * This file is NOT wired into the production reader.
 */

export const SAMPLE_CHILD_NAME = 'נועה';

export type SampleSpread = {
  id: string;
  /** Left-half illustration (real product asset). */
  imageUrl: string;
  /** Right-half Hebrew prose (real bank text, name substituted). */
  text: string;
  /** Optional real narration sample (public/voice-samples) for the audio-coupling demo. */
  audioUrl?: string;
};

export const SAMPLE_BOOK_TITLE = 'הסיפור של נועה ובּוּנִי־אומץ';

export const SAMPLE_SPREADS: SampleSpread[] = [
  {
    id: 'p1',
    imageUrl: '/Images/gallery/gallery-1.jpg',
    text:
      'בּאני־אומץ יושב על השולחן, והאוזניים שלו קופצות מעצמן בדיוק כשהאחות נכנסת.\n' +
      'נועה יושבת ישר, מנסה שהלב לא ידפוק בקול רם מדי.\n' +
      '"שֶׁקֶט עכשיו!" היא לוחשת, אבל האוזניים של בוּנִי מזדקפות גבוה־גבוה.',
    audioUrl: '/voice-samples/4RZ84U1b4WCqpu57LvIq.mp3',
  },
  {
    id: 'p2',
    imageUrl: '/Images/gallery/gallery-2.jpg',
    text:
      'נועה מחליטה לשחק – "פסל אוזניים! מי שזז מפסיד!"\n' +
      'היא מחזיקה את האוזניים הדמיוניות שלה בשתי ידיים.\n' +
      'בוּנִי מתיישר לידה, פרצוף של גיבור־על, אוזניים מתוחות כמו חבלים.',
  },
  {
    id: 'p3',
    imageUrl: '/Images/gallery/gallery-3.jpg',
    text:
      'הראשונות שמוותרות הן של בוּנִי.\n' +
      'נועה מנסה לעזור, מיישרת לו אותן בעדינות.\n' +
      'אבל בדיוק אז – "אפּצ\'י!" – האוזניים קופצות למעלה כמו טרמפולינה.\n' +
      'היא צוחקת בשקט, והוא מתעטש שוב בכוונה.',
  },
  {
    id: 'p4',
    imageUrl: '/Images/gallery/gallery-4.jpg',
    text:
      'עכשיו תור נועה. הידיים שלה רועדות קצת כמו ג\'לי.\n' +
      'בוּנִי מתקרב ולוחש תרגילי אומץ בקול רם מדי:\n' +
      '"א... א... אמיץ אני," לחש. "לא, רגע."\n' +
      'נועה משתעלת מצחוק, מנסה לא לזוז.',
  },
  {
    id: 'p5',
    imageUrl: '/Images/gallery/gallery-5.jpg',
    text:
      'נועה נושמת חם דרך האף, מסתכלת במראה הקטנה.\n' +
      'היא מנענעת בכוונה את הידיים כאילו היו אוזניים.\n' +
      'בוּנִי מחקה אותה, מופתע שזה באמת עובד.\n' +
      'כשהם מזיזים אותן בעצמם – הרעד נהיה משחק מצחיק.',
  },
  {
    id: 'p6',
    imageUrl: '/Images/gallery/gallery-6.jpg',
    text:
      'האוזניים של בוּנִי שוב קופצות, הפעם נועה לא נבהלת.\n' +
      'היא מרימה גבה ואומרת בחיוך קטן,\n' +
      '"גם הידיים שלי קצת רועדות."\n' +
      'בוּנִי מנענע אותן בקצב מצחיק, כמו ריקוד קטן.',
  },
];
