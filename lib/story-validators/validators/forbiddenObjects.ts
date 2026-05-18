import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { excerptAround, finding, normalizeCompanionId, normalizeForMatch } from '../utils';

/**
 * Is the forbidden term used in a simile context ("כמו X")?
 */
function isSimileContext(text: string, termStartIdx: number): boolean {
  const lookback = text.slice(Math.max(0, termStartIdx - 15), termStartIdx);
  return /\b(כמו|כאילו)\s*$/.test(lookback);
}

/**
 * v0.2.5.1 — Object-context check.
 * Some Hebrew words double as verbs: "מחברת" = (noun) notebook OR (verb) "connects/links".
 * Only flag when used as a noun (object). Heuristic: noun usage is marked by
 * determiners or possessives directly preceding ("ה", "ב", "ל", "מ", "של ה")
 * OR by a following adjective ("מחברת קטנה").
 * Verb usage typically: "מחברת X את Y" (links X to Y), "מחברת אותם" (links them).
 *
 * Returns true if the occurrence looks like a verb (NOT an object).
 */
function looksLikeVerbUsage(text: string, termStartIdx: number, term: string): boolean {
  // Only apply heuristic to specific known dual-use Hebrew words
  const dualUseWords = new Set(['מחברת', 'מחברות', 'ספר', 'ספרים', 'תופר', 'תופרת']);
  const termNoNikud = term.replace(/[֑-ׇ]/g, '');
  if (!dualUseWords.has(termNoNikud)) return false;

  // Look 25 chars ahead for verb signals
  const lookahead = text.slice(termStartIdx + term.length, termStartIdx + term.length + 30);
  // Direct-object marker "את" or "אותם/אותן/אותו/אותה" within next 15 chars → verb
  if (/^\s*(את\s|אותם|אותן|אותו|אותה|בין\s)/.test(lookahead)) {
    return true;
  }
  return false;
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
          // v0.2.5.1: Check verb usage — "מחברת אותם" is "connects them", not "a notebook"
          const isVerb = looksLikeVerbUsage(hay, idx, term);
          if (isVerb) {
            // Verb usage — not actual object contamination; skip entirely
            continue;
          }
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
