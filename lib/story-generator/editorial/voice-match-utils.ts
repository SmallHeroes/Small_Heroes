/**
 * Fuzzy Hebrew text matching for calibration (not exact-only).
 * Normalizes whitespace, niqqud, maqaf, and gershayim before overlap checks.
 */
export function normalizeHebrewForMatch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[\u05BE\u2013\u2014-]/g, ' ')
    .replace(/["'`\u05F3\u05F4]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when normalized strings share a substantial substring or token overlap. */
export function quoteOverlaps(findingText: string, expectedSeed: string): boolean {
  const a = normalizeHebrewForMatch(findingText);
  const b = normalizeHebrewForMatch(expectedSeed);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;

  const tokensA = a.split(' ').filter((t) => t.length >= 2);
  const tokensB = new Set(b.split(' ').filter((t) => t.length >= 2));
  if (tokensA.length === 0 || tokensB.size === 0) return false;

  const shared = tokensA.filter((t) => tokensB.has(t)).length;
  const ratio = shared / Math.min(tokensA.length, tokensB.size);
  return ratio >= 0.4;
}
