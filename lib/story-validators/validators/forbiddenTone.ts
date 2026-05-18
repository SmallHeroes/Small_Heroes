import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { excerptAround, finding, normalizeCompanionId, normalizeForMatch } from '../utils';

/** WARNING: companion-specific tone patterns (heuristic). */
export const forbiddenToneValidator: StoryValidator = {
  id: 'forbiddenTone',
  run({ parsed, input }) {
    const bible = getCompanionBible(normalizeCompanionId(input.context.companionId));
    if (!bible?.forbiddenTone.length) return [];

    const findings = [];
    const full = parsed.pages.map((p) => p.text).join('\n');
    const hay = normalizeForMatch(full);

    for (const pattern of bible.forbiddenTone) {
      const needle = normalizeForMatch(pattern);
      const idx = hay.indexOf(needle);
      if (idx !== -1) {
        findings.push(
          finding(
            'forbiddenTone',
            'WARNING',
            `טון אסור אפשרי לדמות ${bible.nameClean}: "${pattern}"`,
            { excerpt: excerptAround(full, idx) }
          )
        );
      }
    }

    return findings;
  },
};
