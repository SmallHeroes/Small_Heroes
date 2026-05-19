import type { Finding, StoryValidator } from '../types';
import { excerptAround, finding, stripNikud } from '../utils';

/**
 * v0.3.2 — BLOCKING: third-person narrator must not slip into first person.
 *
 * Background: bedtime batch v0.3.1 produced page 3 line:
 *   "מתחת למיטה שמעתי טוּמְפּ."
 * The narrator is supposed to be outside ("נועה שמעה..."). A 1st-person
 * verb in narration shatters the reading aloud experience.
 *
 * Approach: scan prose (NOT dialogue inside quotes) for a closed list of
 * common 1st-person past-tense verbs that are recognizable even without
 * niqqud. Dialogue is allowed — "אני מחכה" inside "..." is fine.
 */

const FIRST_PERSON_VERBS = [
  'שמעתי',
  'ראיתי',
  'הלכתי',
  'הרגשתי',
  'אמרתי',
  'רציתי',
  'הייתי',
  'חשבתי',
  'נגעתי',
  'הסתכלתי',
  'ישבתי',
  'עמדתי',
  'פתחתי',
  'סגרתי',
  'חיכיתי',
  'נשמתי',
  'נשארתי',
  'הרמתי',
  'לקחתי',
  'מצאתי',
  'הגעתי',
  'יצאתי',
  'נכנסתי',
  'הסתובבתי',
  'התקרבתי',
  'התרחקתי',
  'בכיתי',
  'צחקתי',
  'חיבקתי',
];

const THIRD_PERSON_SUGGESTIONS: Record<string, string> = {
  שמעתי: 'שמעה',
  ראיתי: 'ראתה',
  הלכתי: 'הלכה',
  הרגשתי: 'הרגישה',
  אמרתי: 'אמרה',
  רציתי: 'רצתה',
  הייתי: 'הייתה',
  חשבתי: 'חשבה',
  נגעתי: 'נגעה',
  הסתכלתי: 'הסתכלה',
  ישבתי: 'ישבה',
  עמדתי: 'עמדה',
  פתחתי: 'פתחה',
  סגרתי: 'סגרה',
  חיכיתי: 'חיכתה',
  נשמתי: 'נשמה',
  נשארתי: 'נשארה',
  הרמתי: 'הרימה',
  לקחתי: 'לקחה',
  מצאתי: 'מצאה',
  הגעתי: 'הגיעה',
  יצאתי: 'יצאה',
  נכנסתי: 'נכנסה',
  הסתובבתי: 'הסתובבה',
  התקרבתי: 'התקרבה',
  התרחקתי: 'התרחקה',
  בכיתי: 'בכתה',
  צחקתי: 'צחקה',
  חיבקתי: 'חיבקה',
};

function guessThirdPerson(firstPerson: string): string {
  return THIRD_PERSON_SUGGESTIONS[firstPerson] ?? 'פועל בגוף שלישי';
}

function stripDialogue(line: string): string {
  return line
    .replace(/"[^"\n]*"/g, ' ')
    .replace(/'[^'\n]*'/g, ' ');
}

export const narrativeVoiceConsistencyValidator: StoryValidator = {
  id: 'narrativeVoiceConsistency',
  run({ parsed }) {
    const findings: Finding[] = [];

    for (const page of parsed.pages) {
      const naked = stripNikud(page.text);
      const lines = naked.split('\n');
      for (const rawLine of lines) {
        const prose = stripDialogue(rawLine);
        for (const verb of FIRST_PERSON_VERBS) {
          const re = new RegExp(`(^|[^\\u0590-\\u05FF])${verb}([^\\u0590-\\u05FF]|$)`);
          if (re.test(prose)) {
            const idx = prose.indexOf(verb);
            findings.push(
              finding(
                'narrativeVoiceConsistency',
                'BLOCKING',
                `קול סיפורי לא עקבי בעמ' ${page.pageNumber}: הסיפור בגוף שלישי, אבל הפועל "${verb}" הוא גוף ראשון.`,
                {
                  page: page.pageNumber,
                  excerpt: excerptAround(prose, idx, 30),
                  suggestion: `החלף את "${verb}" ב"${guessThirdPerson(verb)}".`,
                }
              )
            );
            break;
          }
        }
      }
    }

    return findings;
  },
};
