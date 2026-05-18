import { KILL_PHRASES } from '../data/kill-phrases';
import type { StoryValidator } from '../types';
import { excerptAround, finding, normalizeForMatch } from '../utils';

/** BLOCKING: STORY_ENGINE kill phrases in Hebrew prose. */
export const killPhrasesValidator: StoryValidator = {
  id: 'killPhrases',
  run({ parsed }) {
    const findings = [];
    for (const page of parsed.pages) {
      const hay = normalizeForMatch(page.text);
      for (const phrase of KILL_PHRASES) {
        const needle = normalizeForMatch(phrase);
        const idx = hay.indexOf(needle);
        if (idx !== -1) {
          findings.push(
            finding('killPhrases', 'BLOCKING', `ביטוי אסור: "${phrase}" בעמוד ${page.pageNumber}`, {
              page: page.pageNumber,
              excerpt: excerptAround(page.text, idx),
              suggestion: 'החליפו בפעולה פיזית — לא בהסבר.',
            })
          );
        }
      }
    }
    return findings;
  },
};
