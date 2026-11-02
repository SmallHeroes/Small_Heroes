import 'server-only';

/** Draft fields whose values are verbatim quotes of the book's page text. */
const QUOTE_KEYS = new Set(['quote', 'evidence', 'storyEvidence', 'sceneChangeEvidence']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A planner quote that differs from the page text ONLY in whitespace (for example two adjacent sentences joined by a space where the
 * page breaks the line) is resolved to the page's exact span; every exact quote gate downstream then sees source bytes. Nothing else is
 * normalized (no punctuation, niqqud, case or quote-mark folding). An exact quote, a quote with no whitespace-equivalent span, or one
 * whose whitespace-equivalent spans differ is left untouched, so those gates refuse it exactly as before. A NUL placeholder becomes null.
 * Returns a new value; the
 * caller's draft (the saved model answer) is never modified.
 */
export function resolveSourceQuotes<T>(draft: T, texts: readonly string[]): T {
  const resolve = (quote: string): string | null => {
    // A NUL placeholder (raw or JSON-escaped) is never page text: models emit it for "no quote". It becomes null, and the schema still
    // decides whether null is allowed there (a non-nullable quote refuses exactly as before).
    if (quote === '\u0000' || quote === '\\u0000') return null;
    if (texts.some(t => t.includes(quote))) return quote;
    const words = quote.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return quote;
    // A lookahead enumerates every start (overlapping candidates included); group 1 is the exact source span.
    const pattern = new RegExp('(?=(' + words.map(escape).join('\\s+') + '))', 'g'), spans = new Set<string>();
    for (const text of texts) for (const m of text.matchAll(pattern)) spans.add(m[1]);
    return spans.size === 1 ? [...spans][0] : quote;
  };
  const walk = (value: unknown, key: string | null): unknown => {
    if (typeof value === 'string') return key !== null && QUOTE_KEYS.has(key) ? resolve(value) : value;
    if (Array.isArray(value)) return value.map(v => walk(v, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
    return value;
  };
  return walk(draft, null) as T;
}
