/** Client-safe, single source for the final launch offer (Guy, 2026-11-04, round 3). */
export const ENGINE_SITE_LAUNCH_OFFER = Object.freeze({
  id: 'personal-book-8-inclusive-v1', currency: 'ILS' as const,
  priceAgorot: 5900, narrativePages: 8, cover: true,
  narration: true, pdf: true, addonsPriceAgorot: 0,
  imageQuality: 'low' as const,
});

export function engineSitePriceIls() { return ENGINE_SITE_LAUNCH_OFFER.priceAgorot / 100; }
