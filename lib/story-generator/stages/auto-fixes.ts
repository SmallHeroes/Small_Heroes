/**
 * v0.2.2: Deterministic post-draft fixes.
 *
 * Some failures (especially name mutations like "שולי" instead of "בּוֹלִי") are
 * deterministic typos that the LLM produces sporadically. Asking the LLM to
 * "repair" them in REPAIR MODE is expensive AND risks the model rewriting
 * adjacent prose. Fix them in code first.
 *
 * Pipeline placement: between Draft and first Validate (or between failed
 * Validate and LLM Repair) — see orchestrate.ts.
 */
import { getCompanionBible } from '@/lib/companion-bible';
import type { ValidationReport } from '@/lib/story-validators';

/** Per-companion known name mutations (deterministic find/replace). */
const KNOWN_NAME_MUTATIONS: Record<string, string[]> = {
  bolly_armadillo: [
    'שולי', 'בולו', 'בולא', 'בולה', 'בובו', 'בובה',
    'בקול', 'בחול', 'בועה', 'בוקר', 'בוקע', 'בשולי', 'בשתי',
  ],
  bat_lily: [
    'ליליל', 'לִיללִי', 'לילית', 'ליליה', 'ליליי',
  ],
  chameleon_koko: [
    'קימה', 'קימו', 'קומי', 'קימי', 'קמים',
  ],
};

/**
 * Escapes regex special chars for safe use in a RegExp constructor.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace standalone Hebrew tokens that match known mutations.
 * Token boundary = start-of-string OR non-Hebrew char (preserves Hebrew prefixes
 * like ה/ב/ל/ו from being treated as boundaries — they're already part of the word).
 *
 * Returns the fixed story + count of replacements (for logging).
 */
export function autoFixCompanionMutations(
  storyMarkdown: string,
  companionId: string
): { storyMarkdown: string; replacementCount: number; replacedTokens: string[] } {
  const bible = getCompanionBible(companionId);
  const mutations = KNOWN_NAME_MUTATIONS[companionId];
  if (!bible || !mutations || mutations.length === 0) {
    return { storyMarkdown, replacementCount: 0, replacedTokens: [] };
  }

  const canonical = bible.nameClean;
  let fixed = storyMarkdown;
  let replacementCount = 0;
  const replacedTokens: string[] = [];

  for (const mutation of mutations) {
    // Standalone token boundary: surrounded by non-Hebrew chars or start/end of string.
    // Crucially: Hebrew prefix letters (ה, ו, ב, ל, מ, ש, כ) are PART of a word — we do
    // NOT want to match "השולי" as "שולי" + prefix, because that's likely intentional.
    // We match the token only when it's at a true word boundary.
    const pattern = new RegExp(
      `(^|[\\s.,;:!?"'״׳—\\-()\\[\\]])${escapeRegex(mutation)}([\\s.,;:!?"'״׳—\\-()\\[\\]]|$)`,
      'g'
    );
    fixed = fixed.replace(pattern, (_, before, after) => {
      replacementCount++;
      if (!replacedTokens.includes(mutation)) replacedTokens.push(mutation);
      return `${before}${canonical}${after}`;
    });
  }

  return { storyMarkdown: fixed, replacementCount, replacedTokens };
}

/**
 * Smart auto-fix: extract suspicious tokens from a validation report's
 * companionName findings, and ONLY replace tokens that the validator actually
 * flagged. This is safer than blanket mutation lists because it's reactive,
 * not preemptive.
 *
 * Use case: after first validate fails with companionName BLOCKING — try this
 * before paying for LLM repair.
 */
export function tryAutoNameFixFromReport(
  storyMarkdown: string,
  report: ValidationReport,
  companionId: string
): { storyMarkdown: string; fixed: boolean; replacedTokens: string[] } {
  const bible = getCompanionBible(companionId);
  if (!bible) return { storyMarkdown, fixed: false, replacedTokens: [] };

  // Collect every suspicious token from companionName BLOCKING findings
  const suspiciousTokens = new Set<string>();
  for (const f of report.findings) {
    if (f.validator !== 'companionName') continue;
    if (f.severity !== 'BLOCKING') continue;
    if (f.excerpt) suspiciousTokens.add(f.excerpt.trim());
  }
  if (suspiciousTokens.size === 0) {
    return { storyMarkdown, fixed: false, replacedTokens: [] };
  }

  const canonical = bible.nameClean;
  let fixed = storyMarkdown;
  const replacedTokens: string[] = [];

  for (const token of suspiciousTokens) {
    if (token === canonical) continue; // safety: don't replace canonical
    const pattern = new RegExp(
      `(^|[\\s.,;:!?"'״׳—\\-()\\[\\]])${escapeRegex(token)}([\\s.,;:!?"'״׳—\\-()\\[\\]]|$)`,
      'g'
    );
    const before = fixed;
    fixed = fixed.replace(pattern, (_match, b, a) => `${b}${canonical}${a}`);
    if (fixed !== before) replacedTokens.push(token);
  }

  return { storyMarkdown: fixed, fixed: fixed !== storyMarkdown, replacedTokens };
}
