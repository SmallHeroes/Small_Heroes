import type { Finding, StoryValidator, StoryDirection } from '../types';
import { excerptAround, finding, stripNikud } from '../utils';

/**
 * v0.3.5 — BLOCKING: procedure beats must be spread across pages.
 *
 * In v0.3.3 batch, fantasy page 13 contained "גשר אור" + "כבל דק" + "עמק כריות"
 * — three beats compressed into one paragraph. The 6-beat structure exists in
 * the prompt but the model occasionally collapses it.
 *
 * This validator detects compression by counting how many beat keywords from
 * the 6 known beats appear on the SAME page. >= 4 beats on one page = BLOCKING.
 *
 * Phase-aware: only runs when the story is a procedure direction
 * (adventure or fantasy). Bedtime has no procedure, so skipped.
 */

const PROCEDURE_DIRECTIONS = new Set<StoryDirection>(['adventure', 'fantasy']);

/**
 * For each of the 6 procedure beats, a closed list of Hebrew keyword
 * signatures. A page "contains" a beat if ANY of its keywords appears on
 * that page (niqqud-stripped).
 */
const BEAT_KEYWORDS: Record<string, string[]> = {
  'medical-object-appears': [
    'הוציאה מדחום',
    'הוציא מדחום',
    'מדחום קטן',
    'הוציאה מכשיר',
    'מכשיר קטן',
    'הוציאה אור',
    'אור קטן',
    'הוציאה צמיד',
    'הוציאה את',
    'עמוד אבן',
    'עמוד האבן',
  ],
  'child-body-resists': [
    'משכה את היד',
    'משך את היד',
    'משכה אותה',
    'הכתפיים עלו',
    'הכתפיים שלה עלו',
    'אצבעות נסגרו',
    'יד נסוגה',
    'יד נמשכה',
    'רצתה לסגת',
    'נסוגה אחורה',
    'נסוג אחורה',
    'התרחקה מהר',
  ],
  'companion-closes': [
    'נסגר בכיס',
    'נסגר לכדור',
    'נסגרה בכיס',
    'בולי נסגר',
    'בּוֹלִי נסגר',
    'כדור קטן וחם',
    'טוּמְפּ',
    'טומפ',
  ],
  'child-mirrors': [
    'סגרה את היד',
    'סגר את היד',
    'אגרוף קטן',
    'פתחה אותה לאט',
    'פתח אותה לאט',
    'פתחה את היד',
    'נשמה לאט',
  ],
  'procedure-happens': [
    'הרופאה נגעה',
    'הרופא נגע',
    'נגעה ביד',
    'נגע ביד',
    'קר וקצר',
    'נשארה על הכיסא',
    'נשאר על הכיסא',
    'הניחה את היד',
  ],
  'sticker-closes': [
    'הדביקה מדבקה',
    'הדביק מדבקה',
    'הדביקה לה',
    'מדבקה צבעונית',
    'מדבקה על היד',
    'בּוֹלִי פתח',
    'בולי פתח',
    'בּוֹלִי נפתח',
    'בולי נפתח',
    'הבטן ורודה',
  ],
};

const SPREAD_THRESHOLD = 4; // 4+ beats on one page = collapsed procedure

export const procedureMomentSpreadValidator: StoryValidator = {
  id: 'procedureMomentSpread',
  run({ parsed, input }) {
    const findings: Finding[] = [];

    // Phase-aware: only enforce on procedure-mode directions.
    if (!PROCEDURE_DIRECTIONS.has(input.context.direction)) {
      return findings;
    }

    for (const page of parsed.pages) {
      const naked = stripNikud(page.text);
      const matchedBeats: string[] = [];
      for (const [beatId, keywords] of Object.entries(BEAT_KEYWORDS)) {
        if (keywords.some((k) => naked.includes(k))) {
          matchedBeats.push(beatId);
        }
      }
      if (matchedBeats.length >= SPREAD_THRESHOLD) {
        findings.push(
          finding(
            'procedureMomentSpread',
            'BLOCKING',
            `עמוד ${page.pageNumber} דוחס ${matchedBeats.length} פעימות פרוצדורה לאותו עמוד: ${matchedBeats.join(', ')}. כל פעימה חייבת להיות בעמוד נפרד.`,
            {
              page: page.pageNumber,
              excerpt: excerptAround(naked, 0, 60),
              suggestion: `פצל את עמוד ${page.pageNumber} לפעימה אחת לעמוד. כל אחת מהפעימות (${matchedBeats.length}) ראויה לעמוד משלה.`,
            }
          )
        );
      }
    }

    return findings;
  },
};
