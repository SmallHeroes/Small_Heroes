/**
 * (dev Creator audition) Pure helpers for the "render the first N page images" cost-control mode.
 *
 * The FULL authored story + visual contract are ALWAYS loaded and finalized — `expectedPageCount`
 * equals the finalized page count and the text-finalization guard is satisfied truthfully. These
 * helpers only decide how many PAGE IMAGES to generate; the narrative is never truncated, so
 * location/continuity tests stay real. Shared by the dev story-bank route (resolves the cache value)
 * and the chunk-runner (applies it), so the count can never be re-derived inconsistently.
 */

/**
 * Resolve the cache value from a request's requested render count. `requestedRenderPages <= 0` or
 * `>= authoredPageCount` means "render the whole book" → `undefined`. Otherwise render the first N.
 */
export function resolveRenderImagePageLimit(
  requestedRenderPages: number,
  authoredPageCount: number,
): number | undefined {
  return requestedRenderPages > 0 && requestedRenderPages < authoredPageCount
    ? requestedRenderPages
    : undefined;
}

/**
 * The set of page numbers whose images an audition renders — the FIRST `limit` pages by order.
 * `orderedPageNumbers` MUST already be sorted ascending. Returns `null` (render every page) when there
 * is no limit or the limit covers the whole book.
 */
export function selectAuditionPageNumbers(
  orderedPageNumbers: number[],
  limit: number | undefined | null,
): Set<number> | null {
  return limit != null && limit > 0 && limit < orderedPageNumbers.length
    ? new Set(orderedPageNumbers.slice(0, limit))
    : null;
}
