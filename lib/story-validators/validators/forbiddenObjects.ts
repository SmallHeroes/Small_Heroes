import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { excerptAround, finding, normalizeCompanionId, normalizeForMatch } from '../utils';

/**
 * Is the forbidden term used in a simile context ("כמו X")?
 * E.g., "מדבקה נוצצת כמו כוכב" — sticker shining LIKE a star — not actual stars.
 * E.g., "זרועות פתוחות כמו כנפיים" — arms open LIKE wings — not actual wings.
 *
 * Looks back up to 12 chars for "כמו" or "כאילו".
 */
function isSimileContext(text: string, termStartIdx: number): boolean {
  const lookback = text.slice(Math.max(0, termStartIdx - 15), termStartIdx);
  return /\b(כמו|כאילו)\s*$/.test(lookback);
}

/** BLOCKING (or WARNING if simile): companion-specific forbidden objects. */
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
          // v1.1: Check simile — "כמו X" is metaphor, not contamination
          const isSimile = isSimileContext(hay, idx);
          findings.push(
            finding(
              'forbiddenObjects',
              isSimile ? 'WARNING' : 'BLOCKING',
              `חפץ אסור "${term}" לדמות ${bible.nameClean} בעמוד ${page.pageNumber}${isSimile ? ' (simile — נבדק)' : ''}`,
              { page: page.pageNumber, excerpt: excerptAround(page.text, idx) }
            )
          );
        }
      }
    }
    return findings;
  },
};
