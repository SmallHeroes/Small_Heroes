import { THERAPY_WORDS } from '../data/therapy-words';
import type { StoryValidator } from '../types';
import { excerptAround, finding, normalizeForMatch } from '../utils';

/** WARNING: direct therapy / adult-mentor language. */
export const directTherapyLanguageValidator: StoryValidator = {
  id: 'directTherapyLanguage',
  run({ parsed }) {
    const findings = [];
    for (const page of parsed.pages) {
      const hay = normalizeForMatch(page.text);
      for (const word of THERAPY_WORDS) {
        const needle = normalizeForMatch(word);
        const idx = hay.indexOf(needle);
        if (idx !== -1) {
          findings.push(
            finding('directTherapyLanguage', 'WARNING', `שפה טיפולית אפשרית "${word}" בעמוד ${page.pageNumber}`, {
              page: page.pageNumber,
              excerpt: excerptAround(page.text, idx),
            })
          );
        }
      }
    }
    return findings;
  },
};
