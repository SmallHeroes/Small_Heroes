import type { StoryDirection, StoryValidator } from '../types';
import { finding, normalizeForMatch } from '../utils';

const MOMENT_WINDOWS: Record<StoryDirection, [number, number]> = {
  bedtime: [5, 7],
  adventure: [8, 11],
  fantasy: [12, 15],
};

const PHYSICAL_VERBS = [
  'נגע',
  'לחץ',
  'חיבק',
  'פתח',
  'סגר',
  'הרים',
  'הוריד',
  'התקפל',
  'נשם',
  'נושם',
  'נושמת',
  'נוגע',
  'נוגעת',
  'לחש',
  'החזיק',
  'שם',
  'לקח',
  'הסתובב',
  'הלך',
  'רץ',
  'קפץ',
  'שכב',
  'ישב',
  'עמד',
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
