/**
 * v0.3.5 — Category anchors with phase awareness.
 *
 * Bolly is MEDICAL_PROCEDURE. But "MEDICAL_PROCEDURE" splits into two phases:
 *
 *   anticipation (bedtime) — exam is TOMORROW. No procedure tonight.
 *                            Mother does NOT touch the child medically.
 *                            Thermometer stays on the shelf. Story is about
 *                            meeting the OBJECT, not the procedure.
 *
 *   procedure (adventure / fantasy) — the procedure happens on-page.
 *                            6 ordered beats. >= 30% of pages.
 *
 * v0.3.5 changes vs v0.3.3:
 *   - Added phase field
 *   - Removed [bracket-id] prefixes from arc examples (the model copied them)
 *   - Bedtime gets its own anticipation-mode prompt block
 *   - formatAnchorsForPrompt branches on phase
 */
import type { MvpCompanionId } from '../types';

export type Phase = 'anticipation' | 'procedure';

export interface ProcedureBeat {
  /** Internal id for plan/validator only. NEVER printed in arc examples. */
  id: string;
  description: string;
}

export interface CategoryAnchors {
  category: string;
  phase: Phase;
  anchorObjects: string[];
  forbiddenAsBackdrop: string[];
  /** Procedure beats — present only when phase === 'procedure'. */
  procedureMoment?: ProcedureBeat[];
  procedurePagesShare?: number;
  /** Anticipation-specific guardrails — present only when phase === 'anticipation'. */
  anticipationRules?: string[];
  arcExample: string;
}

const BOLLY_PROCEDURE_BEATS: ProcedureBeat[] = [
  { id: 'medical-object-appears', description: 'The doctor brings out a small medical instrument (thermometer, light, finger device). The instrument is physically present, not implied.' },
  { id: 'child-body-resists', description: 'The child shows a tiny body refusal — pulls hand back, shoulders rise, fingers tighten, eyes look away. ONE body signal, concrete.' },
  { id: 'companion-closes', description: "Bolly closes to a ball in the child's pocket / lap / hand. He doesn't fight the doctor — he models the closing." },
  { id: 'child-mirrors', description: "The child copies Bolly's body: closes her hand to a small fist, holds it, then opens it slowly. This is the heart of the book." },
  { id: 'procedure-happens', description: 'The instrument touches the child. Briefly. Cold. The narrator stays IN the moment — does not skip it.' },
  { id: 'sticker-closes', description: "The doctor places a sticker / mark on the child's body. Bolly opens slightly. The body relaxes." },
];

const BOLLY_BEDTIME: CategoryAnchors = {
  category: 'MEDICAL_PROCEDURE',
  phase: 'anticipation',
  anchorObjects: [
    'מדחום (the medical instrument — stays on the shelf, no one uses it tonight)',
    'מדבקה (the sticker the child will get tomorrow — appears as a future promise)',
    'מחר בבוקר / מחר (the exam is in the FUTURE)',
    'בדיקה (referenced as upcoming, never as happening tonight)',
  ],
  forbiddenAsBackdrop: ['pure dream sequences', 'starry skies as primary visual', 'fantasy worlds', 'magical forests'],
  anticipationRules: [
    'The exam is TOMORROW. No procedure happens tonight.',
    'The mother does NOT touch the child medically. She speaks about the exam — that is all.',
    'The thermometer STAYS on the shelf. It is observed, not used.',
    'The child meets the medical OBJECT (sees, touches, holds). Not the procedure.',
    'Bolly practices his mechanic (closes, opens) — the child watches and copies, NOT during an exam.',
    'No clinic, no doctor, no procedure tonight. They are tomorrow.',
  ],
  arcExample: [
    'Bedtime is anticipation: the exam is tomorrow morning. Tonight, the child',
    'meets the medical object without undergoing the procedure.',
    '',
    '1. מחר יש בדיקה. המדחום על המדף.',
    '2. נועה מסתכלת עליו. היא לא נוגעת.',
    '3. בּוֹלִי מתגלגל אל המיטה. טוּמְפּ.',
    '4. הוא נסגר לכדור קטן וקשה.',
    '5. נועה נוגעת בשריון. השריון קר.',
    '6. בּוֹלִי נפתח קצת. לוח אחד עולה. בפנים היה חם.',
    '7. נועה מחזיקה את השמיכה סביב עצמה. גם היא יכולה.',
    '8. היא מושיטה יד למדבקה הריקה. המדבקה דביקה ורכה.',
    '9. המדחום עוד על המדף. היד שלה כבר לא לוחצת.',
    '10. בּוֹלִי ישן ליד המיטה. המדבקה על הכרית.',
    '',
    'CORE BEDTIME PATTERN:',
    '  The thermometer is OBSERVED, never used. No one measures temperature tonight.',
    "  Bolly's closing/opening is the model — the child copies it in bed, not in a clinic.",
    '  Ending: the medical object remains in place, the child rests. The exam is still tomorrow.',
  ].join('\n'),
};

const BOLLY_ADVENTURE: CategoryAnchors = {
  category: 'MEDICAL_PROCEDURE',
  phase: 'procedure',
  anchorObjects: [
    'הליכה אל המרפאה / הכנה למרפאה',
    'תיק/תרמיל עם פריט רפואי (מדבקה, צמיד, צעצוע מרגיע)',
    'דלת המרפאה / כיסא הבדיקה',
    'הרופא/ה — דמות אמיתית, לא קסומה',
    'המדחום / המכשיר הקטן שנוגע ביד',
    'המדבקה הסופית',
  ],
  forbiddenAsBackdrop: ['adventures unrelated to medical context', 'pure outdoor play'],
  procedureMoment: BOLLY_PROCEDURE_BEATS,
  procedurePagesShare: 40,
  arcExample: [
    'PAGE BUDGET (15 pages total):',
    '  pre-clinic (home + walk):       4 pages   (~27%)',
    '  in-clinic, pre-touch:           2 pages   (~13%)',
    '  THE PROCEDURE (6 beats):        6 pages   (40%)    -- the heart',
    '  post-procedure (sticker, home): 3 pages   (20%)',
    '',
    'Pre-clinic (pages 1-4):',
    '1. הבוקר. נועה לא רוצה לקום.',
    '2. בּוֹלִי מתגלגל אליה. טוּמְפּ. תרמיל קטן על השולחן.',
    '3. בדרך: נועה עוצרת. בּוֹלִי נסגר. נועה חיכתה.',
    '4. בּוֹלִי נפתח. הם ממשיכים.',
    '',
    'In-clinic, pre-touch (pages 5-6):',
    '5. במרפאה: הרופאה חיכתה. נועה עלתה על הכיסא. בּוֹלִי בכיס.',
    '6. החדר היה לבן. כיסא ארוך. רחש קטן של מכשיר.',
    '',
    'The procedure (pages 7-12) -- each page is ONE step. Do NOT collapse:',
    '7. הרופאה הוציאה מדחום קטן.',
    '8. נועה משכה את היד אחורה. הכתפיים שלה עלו.',
    '9. בּוֹלִי נסגר בכיס. טוּמְפּ. כדור קטן וחם.',
    '10. נועה סגרה את היד שלה. אגרוף קטן. אחר כך פתחה אותה לאט.',
    '11. הרופאה נגעה ביד. זה היה קר וקצר. נועה נשארה על הכיסא.',
    '12. הרופאה הדביקה מדבקה. בּוֹלִי פתח עין קטנה.',
    '',
    'Post-procedure (pages 13-15):',
    '13. בדרך הביתה: בּוֹלִי על הכתף.',
    '14. הוא היה כבד ונעים.',
    '15. בבית: המדבקה על היד. בפנים היה חם.',
    '',
    'CORE RULE -- each of the 6 procedure steps is its own page. The narrator',
    'stays IN the moment of the touch. The instrument is concrete (מדחום,',
    'אור קטן, מכשיר קטן). The resistance is one tiny body signal',
    '(יד נמשכת אחורה / כתפיים עולות / אצבעות נסגרות). Bolly DOES NOT fight',
    'the doctor. He closes, and the child copies him.',
  ].join('\n'),
};

const BOLLY_FANTASY: CategoryAnchors = {
  category: 'MEDICAL_PROCEDURE',
  phase: 'procedure',
  anchorObjects: [
    'מדחום -> עמוד אבן/הר',
    'מיטת בדיקה -> עמק כריות',
    'צינור/מכשור -> גשר/כבל ענק',
    'מדבקה -> אבן זוהרת / טבעת קטנה',
  ],
  forbiddenAsBackdrop: ['generic enchanted forests with no medical metaphor'],
  procedureMoment: [
    { id: 'medical-object-appears', description: 'The transformed medical object stands tall (stone pillar = thermometer). The child sees it.' },
    { id: 'child-body-resists', description: 'The child wants to step back / pulls hand away. One body signal.' },
    { id: 'companion-closes', description: 'Bolly closes to a ball NEXT TO the pillar. Not against it.' },
    { id: 'child-mirrors', description: 'The child copies Bolly: hand closes, breath slows. She stays beside the pillar.' },
    { id: 'procedure-happens', description: 'The child touches the pillar / steps next to it. Cold. Brief. She holds.' },
    { id: 'sticker-closes', description: 'The pillar fades / shrinks back into the room thermometer. A small glowing stone (= sticker) is left in her hand.' },
  ],
  procedurePagesShare: 35,
  arcExample: [
    'Setup (pages 1-6):',
    '1. המדחום על המדף. הוא נראה כמו עמוד אבן.',
    '2. נועה הסתכלה עליו. הוא היה גדול.',
    '3. בּוֹלִי הגיע. טוּמְפּ.',
    '4. הקיר הפך לסלע. הסלע הפך להר.',
    '5. במעלה ההר: עמוד האבן חיכה.',
    '6. נועה התקרבה. הקור עולה ממנו.',
    '',
    'Approach (pages 7-8):',
    '7. בּוֹלִי התגלגל לאט לתחתית ההר.',
    '8. נועה הלכה אחריו.',
    '',
    'The procedure (pages 9-15) -- each page is ONE step:',
    '9.  מעליהם עמד עמוד האבן. קר ממנו יצא.',
    '10. נועה רצתה לסגת. היד שלה נמשכה אחורה.',
    '11. בּוֹלִי נסגר לכדור ליד העמוד. טוּמְפּ.',
    '12. נועה סגרה את היד שלה. אחר כך פתחה אותה לאט.',
    '13. נועה שמה יד על העמוד. הוא היה חלק וקר. היא נשארה.',
    '14. נשימה אחת. נשימה שתיים.',
    '15. בּוֹלִי נפתח. בפנים היה חם. אבן קטנה זוהרת נשארה ביד נועה.',
    '',
    'Return (pages 16-20):',
    '16. העמוד נעלם לאט.',
    '17. הסלע חזר לקיר.',
    '18. החדר חזר.',
    '19. המדחום על המדף. לא הר -- רק מדחום.',
    '20. בּוֹלִי ישן. האבן הזוהרת הפכה למדבקה על היד.',
    '',
    'CORE RESILIENCE PATTERN:',
    '  Bolly does NOT push, fight, or remove obstacles.',
    '  The medical object STAYS until the child has met it body-to-body.',
    '  Then it shrinks back to the room thermometer.',
  ].join('\n'),
};

const GENERIC_BEDTIME: CategoryAnchors = {
  category: 'GENERIC',
  phase: 'anticipation',
  anchorObjects: ['the bedroom setting', 'a small comfort object', 'one quiet moment'],
  forbiddenAsBackdrop: [],
  arcExample: '(no template -- write simply per Companion Card)',
};

const ANCHORS: Record<MvpCompanionId, Record<'bedtime' | 'adventure' | 'fantasy', CategoryAnchors>> = {
  bolly_armadillo: {
    bedtime: BOLLY_BEDTIME,
    adventure: BOLLY_ADVENTURE,
    fantasy: BOLLY_FANTASY,
  },
  chameleon_koko: {
    bedtime: GENERIC_BEDTIME,
    adventure: GENERIC_BEDTIME,
    fantasy: GENERIC_BEDTIME,
  },
  bat_lily: {
    bedtime: GENERIC_BEDTIME,
    adventure: GENERIC_BEDTIME,
    fantasy: GENERIC_BEDTIME,
  },
};

export function getCategoryAnchors(
  companionId: MvpCompanionId,
  direction: 'bedtime' | 'adventure' | 'fantasy'
): CategoryAnchors {
  return ANCHORS[companionId]?.[direction] ?? GENERIC_BEDTIME;
}

export function formatAnchorsForPrompt(anchors: CategoryAnchors): string {
  const sections: string[] = [
    `Category: ${anchors.category}`,
    `Phase: ${anchors.phase}`,
    '',
    'ANCHOR OBJECTS -- these must DRIVE the plot, not decorate:',
    ...anchors.anchorObjects.map((o) => `  - ${o}`),
    '',
  ];

  if (anchors.forbiddenAsBackdrop.length) {
    sections.push(`Forbidden as primary backdrop:\n${anchors.forbiddenAsBackdrop.map((f) => `  X ${f}`).join('\n')}\n`);
  }

  if (anchors.phase === 'anticipation' && anchors.anticipationRules?.length) {
    sections.push(
      'BEDTIME ANTICIPATION MODE -- read carefully:',
      'This story is about WAITING for tomorrow, not undergoing anything tonight.',
      ...anchors.anticipationRules.map((r) => `  ! ${r}`),
      '',
      'Contrast example:',
      "  WRONG: 'אמא לקחה את המדחום והדביקה את המדבקה.'  (procedure happens -- forbidden)",
      "  RIGHT: 'המדחום נשאר על המדף. נועה הסתכלה עליו.'   (object observed only)",
      ''
    );
  }

  if (anchors.phase === 'procedure' && anchors.procedureMoment?.length) {
    sections.push(
      `PROCEDURE MOMENT -- these ${anchors.procedureMoment.length} beats are the HEART of the book.`,
      `Each beat = its OWN page. Do NOT collapse them.`,
      `The procedure phase must consume at least ${anchors.procedurePagesShare ?? 30}% of all pages.`,
      '',
      'Beats (in order):'
    );
    anchors.procedureMoment.forEach((b, i) => {
      // v0.3.5: NO bracket prefix -- those leaked into prose. Plain numbered list.
      sections.push(`  ${i + 1}. ${b.description}`);
    });
    sections.push(
      '',
      'CRITICAL: the beat numbers above are PLANNING NOTES only. NEVER copy any',
      'bracketed identifier or numbered prefix into the Hebrew story prose.',
      'The story text must contain only natural Hebrew sentences.',
      ''
    );
  }

  sections.push('ARC EXAMPLE -- this is how a good story looks:', anchors.arcExample);
  return sections.filter(Boolean).join('\n');
}
