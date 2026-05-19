import type { Finding, StoryValidator } from '../types';
import { excerptAround, finding, stripNikud } from '../utils';

/**
 * v0.3.6 — BLOCKING: companion gives a speech / reassurance / explanation.
 *
 * Bolly's Companion Mechanic Contract: "FORBIDDEN: bravery speeches, 'הוא אמיץ',
 * Bolly speaking comfort". The contract says he is NOT an action hero and NOT
 * a comforting voice — he is a BODY model (closes/opens). Speeches contradict
 * the entire resilience mechanic.
 *
 * v0.3.5 adventure page 7 contained:
 *   "בולי חייך ואמר שזה רק כמו לשים מדבקה קטנה על כדור צבעוני עם בטן ורודה."
 * The editor gave 5/5 — confirming the editor cannot enforce this. Need code.
 *
 * Scope: only flags non-human companions. Human characters (mother, doctor)
 * are allowed to speak.
 */

const NON_HUMAN_COMPANION_IDS = new Set([
  'bolly_armadillo',
  'bat_lily',
  'chameleon_koko',
]);

/**
 * Verb patterns that indicate the companion is SPEAKING or EXPLAINING.
 * Each pattern is "<companion-name-stem> + verb" — we check against the
 * companion's canonical-name stem.
 *
 * The base stems for each companion in Hebrew (niqqud-stripped):
 *   bolly: "בולי"
 *   lily:  "לילי"
 *   kim/koko: "קים"  (the canonical name is קים, displayed)
 */
const SPEECH_VERBS = [
  'אמר',
  'אמרה',
  'הסביר',
  'הסבירה',
  'חייך ואמר',
  'חייכה ואמרה',
  'לחש',
  'לחשה',
  'הבטיח',
  'הבטיחה',
  'צעק',
  'צעקה',
  'קרא',
  'קראה',
  'שאל',
  'שאלה',
  'סיפר',
  'סיפרה',
  'ענה',
  'ענתה',
];

/** Phrases of comfort that, even without an explicit speech verb, indicate
 * the companion is acting as a verbal comforter — also forbidden. */
const COMFORT_PHRASES = [
  'אל תפחדי',
  'אל תפחד',
  'זה בסדר',
  'הכל יהיה בסדר',
  'אל תדאגי',
  'אל תדאג',
  'אני כאן',
];

function companionStems(companionId: string): string[] {
  // niqqud-stripped stems the model might write
  switch (companionId) {
    case 'bolly_armadillo':
      return ['בולי'];
    case 'bat_lily':
      return ['לילי'];
    case 'chameleon_koko':
      return ['קים', 'קוקו'];
    default:
      return [];
  }
}

export const companionSpeechViolationValidator: StoryValidator = {
  id: 'companionSpeechViolation',
  run({ parsed, input }) {
    const findings: Finding[] = [];

    if (!NON_HUMAN_COMPANION_IDS.has(input.context.companionId)) {
      return findings;
    }

    const stems = companionStems(input.context.companionId);
    if (stems.length === 0) return findings;

    for (const page of parsed.pages) {
      const naked = stripNikud(page.text);

      // Check for "<companion> + <speech-verb>" patterns within ~10 chars.
      for (const stem of stems) {
        let pos = 0;
        while (true) {
          const idx = naked.indexOf(stem, pos);
          if (idx === -1) break;
          // Look at the next 30 chars for a speech verb.
          const window = naked.slice(idx, idx + 30);
          const verb = SPEECH_VERBS.find((v) => window.includes(v));
          if (verb) {
            findings.push(
              finding(
                'companionSpeechViolation',
                'BLOCKING',
                `המלווה ${input.context.companionId} מדבר/נואם בעמוד ${page.pageNumber} ("${verb}"). זה אסור — המלווה מודל גוף, לא קול.`,
                {
                  page: page.pageNumber,
                  excerpt: excerptAround(naked, idx, 30),
                  suggestion: 'הסר את הציטוט והחלף בפעולה גופנית של המלווה (סגירה, פתיחה, התגלגלות, טוּמְפּ).',
                }
              )
            );
            break;
          }
          pos = idx + stem.length;
        }
      }

      // Also flag comfort phrases attributed to the companion via direct dialogue.
      // If a comfort phrase appears anywhere on a page with the companion as
      // a likely speaker (one of his stems appears within 40 chars before),
      // flag it.
      for (const phrase of COMFORT_PHRASES) {
        const phraseIdx = naked.indexOf(phrase);
        if (phraseIdx === -1) continue;
        const before = naked.slice(Math.max(0, phraseIdx - 40), phraseIdx);
        if (stems.some((s) => before.includes(s))) {
          findings.push(
            finding(
              'companionSpeechViolation',
              'BLOCKING',
              `המלווה נושא דברי הרגעה בעמוד ${page.pageNumber} ("${phrase}"). אסור — המלווה לא מרגיע במילים.`,
              {
                page: page.pageNumber,
                excerpt: excerptAround(naked, phraseIdx, 40),
                suggestion: 'החלף את ההרגעה המילולית בפעולה גופנית של המלווה.',
              }
            )
          );
        }
      }
    }

    return findings;
  },
};
