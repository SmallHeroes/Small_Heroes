import type { Finding, StoryValidator } from '../types';
import { excerptAround, finding, normalizeForMatch, stripNikud } from '../utils';

/**
 * Like normalizeForMatch but WITHOUT trimming the edges.
 *
 * mustNotInclude typo-guards rely on edge whitespace to anchor a word
 * boundary — e.g. "הכר " (with a trailing space) is meant to catch the
 * standalone typo "הכר" while NOT matching the legitimate word "הכרית"
 * (where הכר is only a prefix). normalizeForMatch's .trim() destroys that
 * trailing space and turns the guard into a false-positive machine.
 *
 * Internal whitespace is still collapsed; niqqud still stripped.
 */
function normalizeNeedleKeepEdges(s: string): string {
  return stripNikud(s).replace(/\s+/g, ' ').toLowerCase();
}

/**
 * v0.5a #177 — Recipe contract validator.
 *
 * Enforces the three Recipe-level contracts that the Author prompt alone
 * could not be trusted to obey (proven in #169 smoke runs):
 *
 *   1. forbiddenPatterns  — global. Any match anywhere → BLOCKING.
 *   2. mustNotInclude     — per page. Any match on that page → BLOCKING.
 *   3. mustInclude        — per page. A missing token is:
 *                             - BLOCKING if it is a CRITICAL ANCHOR
 *                               (the physical objects/companions the
 *                               resilience arc structurally depends on)
 *                             - WARNING otherwise (nice-to-have texture)
 *
 * No-op when the story is not recipe-mode (input.context.recipe absent),
 * so legacy stories are unaffected.
 *
 * All matching is niqqud-tolerant via normalizeForMatch — the Recipe may
 * store tokens without niqqud while the prose carries partial niqqud.
 */

/**
 * Tokens whose absence is structurally fatal to the resilience arc.
 * Missing one of these → BLOCKING. Everything else in mustInclude is
 * texture and downgrades to WARNING.
 *
 * Stored without niqqud; compared after normalizeForMatch.
 */
const CRITICAL_ANCHOR_TOKENS = ['מדחום', 'יד', 'מדבקה', 'טומפ', 'בולי'];

export const recipeContractValidator: StoryValidator = {
  id: 'recipeContract',
  run({ parsed, input }) {
    const recipe = input.context.recipe;
    if (!recipe) return []; // not a recipe-mode story — nothing to enforce

    const findings: Finding[] = [];
    const normalizedCriticalAnchors = CRITICAL_ANCHOR_TOKENS.map((t) =>
      normalizeForMatch(t)
    );

    // ── 1. Global forbiddenPatterns ──────────────────────────────────
    for (const page of parsed.pages) {
      const hay = normalizeForMatch(page.text);
      for (const pattern of recipe.forbiddenPatterns) {
        const needle = normalizeForMatch(pattern);
        if (!needle) continue;
        const idx = hay.indexOf(needle);
        if (idx !== -1) {
          findings.push(
            finding(
              'recipeContract',
              'BLOCKING',
              `דפוס אסור מה-Recipe: "${pattern}" בעמוד ${page.pageNumber}`,
              {
                page: page.pageNumber,
                excerpt: excerptAround(page.text, idx),
                suggestion: 'החליפו בניסוח גופני וקונקרטי — הדפוס הזה אסור ב-Recipe.',
              }
            )
          );
        }
      }
    }

    // ── 2 + 3. Per-page mustNotInclude / mustInclude ─────────────────
    const pageByNum = new Map(parsed.pages.map((p) => [p.pageNumber, p]));
    for (const card of recipe.pages) {
      const page = pageByNum.get(card.page);
      if (!page) continue; // page-mismatch is reported by other validators
      const hay = normalizeForMatch(page.text);

      // 2. mustNotInclude → BLOCKING
      // Uses edge-preserving normalization so typo-guards like "הכר "
      // (trailing space) anchor a word boundary and don't false-match the
      // legitimate word "הכרית".
      for (const token of card.mustNotInclude) {
        const needle = normalizeNeedleKeepEdges(token);
        if (!needle.trim()) continue;
        const idx = hay.indexOf(needle);
        if (idx !== -1) {
          findings.push(
            finding(
              'recipeContract',
              'BLOCKING',
              `עמוד ${card.page}: ביטוי mustNotInclude הופיע — "${token}"`,
              {
                page: card.page,
                excerpt: excerptAround(page.text, idx),
                suggestion: 'הסירו את הביטוי — ה-Recipe אוסר אותו בעמוד הזה.',
              }
            )
          );
        }
      }

      // 3. mustInclude → BLOCKING for critical anchors, WARNING otherwise
      for (const token of card.mustInclude) {
        const needle = normalizeForMatch(token);
        if (!needle) continue;
        if (hay.includes(needle)) continue; // present — fine

        const isCritical = normalizedCriticalAnchors.includes(needle);
        findings.push(
          finding(
            'recipeContract',
            isCritical ? 'BLOCKING' : 'WARNING',
            `עמוד ${card.page}: חסר mustInclude — "${token}"${
              isCritical ? ' (עוגן קריטי)' : ''
            }`,
            {
              page: card.page,
              suggestion: isCritical
                ? 'העוגן הזה נושא את קשת החוסן — חובה שיופיע בעמוד.'
                : 'מומלץ לשלב את הביטוי, אך לא חוסם.',
            }
          )
        );
      }
    }

    return findings;
  },
};
