import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { excerptAround, finding, normalizeCompanionId, normalizeForMatch } from '../utils';

/**
 * v1.1: Simile guard — "זרועות פתוחות כמו כנפיים" (arms open LIKE wings) is metaphor,
 * not anatomical contamination. Lower to WARNING when "כמו" precedes the term.
 */
function isSimileContext(text: string, termStartIdx: number): boolean {
  const lookback = text.slice(Math.max(0, termStartIdx - 15), termStartIdx);
  return /\b(כמו|כאילו)\s*$/.test(lookback);
}

/** BLOCKING (or WARNING if simile): companion-specific forbidden anatomy. */
export const forbiddenAnatomyValidator: StoryValidator = {
  id: 'forbiddenAnatomy',
  run({ parsed, input }) {
    const bible = getCompanionBible(normalizeCompanionId(input.context.companionId));
    if (!bible?.forbiddenAnatomy.length) return [];

    const findings = [];
    for (const page of parsed.pages) {
      const hay = normalizeForMatch(page.text);
      for (const term of bible.forbiddenAnatomy) {
        const needle = normalizeForMatch(term);
        if (needle.length < 2) continue;
        const idx = hay.indexOf(needle);
        if (idx !== -1) {
          const isSimile = isSimileContext(hay, idx);
          findings.push(
            finding(
              'forbiddenAnatomy',
              isSimile ? 'WARNING' : 'BLOCKING',
              `אנטומיה אסורה "${term}" לדמות ${bible.nameClean} בעמוד ${page.pageNumber}${isSimile ? ' (simile — נבדק)' : ''}`,
              { page: page.pageNumber, excerpt: excerptAround(page.text, idx) }
            )
          );
        }
      }
    }
    return findings;
  },
};
