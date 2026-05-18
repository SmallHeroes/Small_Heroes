import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { excerptAround, finding, normalizeCompanionId, normalizeForMatch } from '../utils';

/** BLOCKING: companion-specific forbidden objects in Hebrew prose. */
export const forbiddenObjectsValidator: StoryValidator = {
  id: 'forbiddenObjects',
  run({ parsed, input }) {
    const bible = getCompanionBible(normalizeCompanionId(input.context.companionId));
    if (!bible?.forbiddenObjects.length) return [];

    const findings = [];
    for (const page of parsed.pages) {
      const hay = normalizeForMatch(page.text);
      for (const term of bible.forbiddenObjects) {
        const needle = normalizeForMatch(term);
        if (needle.length < 2) continue;
        const idx = hay.indexOf(needle);
        if (idx !== -1) {
          findings.push(
            finding(
              'forbiddenObjects',
              'BLOCKING',
              `חפץ אסור "${term}" לדמות ${bible.nameClean} בעמוד ${page.pageNumber}`,
              { page: page.pageNumber, excerpt: excerptAround(page.text, idx) }
            )
          );
        }
      }
    }
    return findings;
  },
};
