/**
 * Fail-closed source-prose guard (shared by the OFFLINE extractor AND the template compiler).
 *
 * The visual-contract compiler authors a full relational contract from the story PROSE. If a story reaches it with
 * empty or negligible prose — e.g. a parser drop that leaves markers-only pages, or a source built from a story whose
 * text never survived extraction — the authoring LLM HALLUCINATES a fully-valid contract from nothing (the observed
 * "hallucinated fox mint from an empty source" bug). That contract passes every downstream validator because it is
 * internally consistent; it is simply invented. This guard REFUSES that input at BOTH seams: the extractor (before it
 * writes a `.source.json`) and the compiler (before the LLM call). It is a UNIVERSAL safety rule — it protects EVERY
 * story, not one.
 *
 * Thresholds are calibrated against the UNION of the two production banks (story-bank/v3-approved ∪
 * story-bank/v5-fixed-v2 — both are on the golden path), measured with the fixed parser + WORD_COUNT-trailer strip:
 * the thinnest real page is 13 letters (a legitimate one-line "quiet beat") and the thinnest real story averages
 * 42.3 letters/page. The floors below sit under those with margin, so they catch genuinely empty/near-empty pages
 * (the hallucination signal is ~0 prose letters) without fail-closing on legitimate terse prose. Tunable.
 */

export interface SourceProsePage {
  pageNumber: number;
  text: string;
}

/** A single page below this many LETTERS is empty/negligible — never real story prose. Union bank min page = 13. */
export const MIN_PAGE_PROSE_LETTERS = 8;
/** A whole story averaging below this many letters/page is too thin to author from. Union bank min avg = 42.3. */
export const MIN_AVG_PROSE_LETTERS_PER_PAGE = 30;

/** Count LETTER characters (Hebrew, Latin, any script). Punctuation, whitespace, digits, and page markers do NOT
 *  count, so "--- Page 3 ---" or "…" alone reads as zero prose. */
export function countProseLetters(s: string): number {
  return (s.match(/\p{L}/gu) ?? []).length;
}

/**
 * Throw if the parsed source carries empty/negligible prose — belt-and-suspenders across two seams. `where` names the
 * caller (extractor vs compiler) so a failure is traceable to its origin. NEVER authors a contract from empty/thin
 * source: an empty/near-empty page OR a whole story below the average floor is refused.
 */
export function assertSourceHasRealProse(storyKey: string, pages: SourceProsePage[], where: string): void {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error(`${where}: ${storyKey} has no pages — refusing to author a contract from empty source (fail-closed).`);
  }
  const perPage = pages.map((p) => ({ pageNumber: p.pageNumber, letters: countProseLetters(p?.text ?? '') }));
  const thin = perPage.filter((p) => p.letters < MIN_PAGE_PROSE_LETTERS);
  if (thin.length > 0) {
    throw new Error(
      `${where}: ${storyKey} has empty/negligible prose on page(s) ` +
        `${thin.map((p) => `${p.pageNumber}(${p.letters}L)`).join(', ')} — every page needs >= ` +
        `${MIN_PAGE_PROSE_LETTERS} letters. Refusing to author a contract from empty source (fail-closed; ` +
        `likely a parser drop or a markers-only story).`,
    );
  }
  const total = perPage.reduce((sum, p) => sum + p.letters, 0);
  const avg = total / perPage.length;
  if (avg < MIN_AVG_PROSE_LETTERS_PER_PAGE) {
    throw new Error(
      `${where}: ${storyKey} prose is too thin (avg ${avg.toFixed(1)} letters/page over ${perPage.length} pages, ` +
        `floor ${MIN_AVG_PROSE_LETTERS_PER_PAGE}) — refusing to author a contract from thin source (fail-closed).`,
    );
  }
}
