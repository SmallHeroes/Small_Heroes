import type { Finding, StoryValidator } from '../types';
import { excerptAround, finding, stripNikud } from '../utils';

/**
 * v0.3.2 — BLOCKING: time line contradiction within a story.
 *
 * Background: bedtime batch v0.3.1 produced this contradiction:
 *   page 2: "אמא אמרה: 'מחר בבוקר יש בדיקה.'"   (exam is tomorrow)
 *   page 10: "זוכרת את הבדיקה שעברה בשלווה"     (exam already happened)
 *
 * This isn't a literary issue — it's a logical error. A parent reading aloud
 * stops cold. The fix is to refuse the story until the timeline is consistent.
 */

const FUTURE_ANCHORS = [
  'מחר בבוקר',
  'מחר יש בדיקה',
  'מחר',
  'יש בדיקה',
  'הבדיקה תהיה',
];

const PAST_REFERENCES_TO_EXAM = [
  'הבדיקה שעברה',
  'הבדיקה שהייתה',
  'הבדיקה שהיתה',
  'הבדיקה שעבר',
  'הבדיקה כבר עברה',
  'הבדיקה כבר נגמרה',
  'זוכרת את הבדיקה',
  'זוכר את הבדיקה',
  'מהיום ההוא',
  'אחרי הבדיקה',
];

const EXAM_OCCURRED_MARKERS = [
  'הרופאה נגעה',
  'הרופא נגע',
  'הרופאה הדביקה',
  'הרופא הדביק',
  'במרפאה הרופא',
  'במרפאה הרופאה',
  'עלתה על הכיסא',
  'עלה על הכיסא',
  'הבדיקה הייתה קצרה',
  'הבדיקה היתה קצרה',
];

interface HitResult {
  hit: boolean;
  phrase?: string;
  index?: number;
}

function hasAny(haystack: string, needles: string[]): HitResult {
  for (const needle of needles) {
    const idx = haystack.indexOf(needle);
    if (idx !== -1) return { hit: true, phrase: needle, index: idx };
  }
  return { hit: false };
}

export const temporalContradictionValidator: StoryValidator = {
  id: 'temporalContradiction',
  run({ parsed }) {
    const findings: Finding[] = [];
    if (parsed.pages.length < 3) return findings;

    const total = parsed.pages.length;
    const earlyCutoff = Math.max(1, Math.floor(total * 0.3));
    const earlyPages = parsed.pages.filter((p) => p.pageNumber <= earlyCutoff);

    let futureAnchor: { page: number; phrase: string } | null = null;
    for (const page of earlyPages) {
      const naked = stripNikud(page.text);
      const r = hasAny(naked, FUTURE_ANCHORS);
      if (r.hit && r.phrase) {
        futureAnchor = { page: page.pageNumber, phrase: r.phrase };
        break;
      }
    }
    if (!futureAnchor) return findings;

    const examOccurredOnPage = parsed.pages.find((p) => {
      if (p.pageNumber <= futureAnchor!.page) return false;
      const naked = stripNikud(p.text);
      return hasAny(naked, EXAM_OCCURRED_MARKERS).hit;
    });

    if (examOccurredOnPage) {
      for (const page of parsed.pages) {
        if (page.pageNumber <= futureAnchor.page) continue;
        if (page.pageNumber >= examOccurredOnPage.pageNumber) break;
        const naked = stripNikud(page.text);
        const r = hasAny(naked, PAST_REFERENCES_TO_EXAM);
        if (r.hit && r.phrase) {
          findings.push(
            finding(
              'temporalContradiction',
              'BLOCKING',
              `סתירת ציר זמן: עמוד ${futureAnchor.page} אומר "${futureAnchor.phrase}" (עתיד), אבל עמוד ${page.pageNumber} מתייחס לבדיקה כעבר ("${r.phrase}") — לפני שהבדיקה הוצגה בעמוד ${examOccurredOnPage.pageNumber}.`,
              {
                page: page.pageNumber,
                excerpt: excerptAround(naked, r.index ?? 0, 40),
                suggestion: 'הסר את ההתייחסות לעבר עד אחרי העמוד שמציג את הבדיקה.',
              }
            )
          );
        }
      }
      return findings;
    }

    for (const page of parsed.pages) {
      if (page.pageNumber <= futureAnchor.page) continue;
      const naked = stripNikud(page.text);
      const r = hasAny(naked, PAST_REFERENCES_TO_EXAM);
      if (r.hit && r.phrase) {
        findings.push(
          finding(
            'temporalContradiction',
            'BLOCKING',
            `סתירת ציר זמן: עמוד ${futureAnchor.page} אומר "${futureAnchor.phrase}" (עתיד), אבל עמוד ${page.pageNumber} כותב "${r.phrase}" כאילו הבדיקה כבר הייתה — בשום עמוד לא הצגנו את הבדיקה עצמה.`,
            {
              page: page.pageNumber,
              excerpt: excerptAround(naked, r.index ?? 0, 40),
              suggestion: 'או הצג את הבדיקה בעמוד ביניים, או החלף את הציטוט בתיאור פיזי של הרגע הנוכחי.',
            }
          )
        );
      }
    }

    return findings;
  },
};
