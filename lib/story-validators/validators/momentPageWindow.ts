import type { StoryDirection, StoryValidator } from '../types';
import { finding, normalizeForMatch } from '../utils';

const MOMENT_WINDOWS: Record<StoryDirection, [number, number]> = {
  bedtime: [5, 7],
  adventure: [8, 11],
  fantasy: [12, 15],
};

// v0.5.3 — markers of physical body action. Includes PRESENT-tense forms:
// the recipes narrate in present tense, and the old past-only list
// false-flagged moment pages ("סוגרת"/"פותחת" never matched "סגר"/"פתח").
// אגרוף / אצבע are strong hand-action markers.
const PHYSICAL_VERBS = [
  // past
  'נגע', 'לחץ', 'חיבק', 'פתח', 'סגר', 'הרים', 'הוריד', 'התקפל', 'נשם',
  'החזיק', 'שם', 'לקח', 'הסתובב', 'הלך', 'רץ', 'קפץ', 'שכב', 'ישב', 'עמד',
  'אספה', 'נסגרה', 'נפתחה',
  // present (the recipes narrate in present tense)
  'נושם', 'נושמת', 'נוגע', 'נוגעת', 'לוחש', 'לוחשת', 'פותח', 'פותחת',
  'סוגר', 'סוגרת', 'נסגר', 'נסגרת', 'נפתח', 'נפתחת', 'מרים', 'מרימה',
  'מורידה', 'מחזיק', 'מחזיקה', 'אוסף', 'אוספת', 'מניח', 'מניחה', 'שמה',
  'נשען', 'נשענת', 'זזה', 'נעה', 'מתכרבל', 'מתגלגל', 'מציץ', 'מציצה',
  'מתכופף', 'מתכופפת',
  // hand-action markers
  'אגרוף', 'אצבע', 'אצבעות',
];

/** BLOCKING: moment page in direction window with physical action on page. */
export const momentPageWindowValidator: StoryValidator = {
  id: 'momentPageWindow',
  run({ parsed, input }) {
    const findings = [];
    const moment = input.context.declared.moment;
    const [min, max] = MOMENT_WINDOWS[input.context.direction];

    if (moment.page < min || moment.page > max) {
      findings.push(
        finding(
          'momentPageWindow',
          'BLOCKING',
          `רגע מרכזי בעמוד ${moment.page} — חלון ${input.context.direction} הוא ${min}-${max}`
        )
      );
    }

    const page = parsed.pages.find((p) => p.pageNumber === moment.page);
    if (!page) {
      findings.push(finding('momentPageWindow', 'BLOCKING', `עמוד רגע ${moment.page} לא נמצא`));
      return findings;
    }

    const hay = normalizeForMatch(page.text);
    const hasPhysical =
      PHYSICAL_VERBS.some((v) => hay.includes(normalizeForMatch(v))) ||
      Boolean(moment.physicalAction && hay.includes(normalizeForMatch(moment.physicalAction)));

    if (!hasPhysical) {
      findings.push(
        finding(
          'momentPageWindow',
          'BLOCKING',
          `עמוד ${moment.page} (רגע מרכזי) חסר פעולה פיזית ברורה`,
          { page: moment.page, excerpt: page.text.slice(0, 80) }
        )
      );
    }

    if (moment.companionSignature) {
      const sig = normalizeForMatch(moment.companionSignature);
      if (!hay.includes(sig)) {
        findings.push(
          finding(
            'momentPageWindow',
            'WARNING',
            `חתימת דמות מוצהרת לא נמצאה בעמוד הרגע`,
            { page: moment.page }
          )
        );
      }
    }

    return findings;
  },
};
