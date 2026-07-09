import type { Companion } from '@/lib/companions';

/**
 * (Power Card redesign) The card's full-body hero image — the companion's OWN art, best quality first:
 * the hi-res style-01 card sheet (`cardImage`) when authored, else the full-body reference (`image`). Both are
 * per-companion full-body sources; there is deliberately NO shared/default fallback (that was the "everyone gets
 * bolly" bug at resolve-from-order). Pure + client-safe (Companion is a type-only import, erased at build).
 */
export function resolveCompanionHeroUrl(companion: Companion): string {
  return companion.cardImage ?? companion.image;
}
