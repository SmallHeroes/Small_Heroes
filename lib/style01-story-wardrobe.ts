/**
 * Per-story wardrobe overrides — identity stays in child DNA; clothing is story-level.
 */

/** dragon_dini_fantasy — gender-neutral bird pajama (same for every child on this story). */
export const DRAGON_DINI_FANTASY_WARDROBE_LOCK = `BOOK WARDROBE LOCK — STORY dragon_dini_fantasy (mandatory every page the child appears):
Soft two-piece pajamas. Base color pale dusty-blue (or warm cream), with a small, evenly-repeated all-over print of simple friendly little BIRDS in mixed WARM colors (mustard-yellow, soft coral, teal) — deliberately NOT green, so the pajama never reads as the moss-green baby dragon. The SAME single bird motif repeated on every page (do not vary the print or swap to other creatures between pages). Long-sleeve top + matching pajama pants. Small green wristband on the LEFT wrist (neutral continuity detail). Bare feet or soft cream slipper-socks. SAME pajamas on every page — home and dragon world. NEVER day clothes, NEVER a sky-blue sun t-shirt, NEVER denim shorts, NEVER red sneakers, NEVER dinosaur-print clothing.

CHILD IDENTITY vs WARDROBE: Use CHILD VISUAL LOCK + ANATOMICAL LOCK for face, hair, skin, age, gender only — NOT clothing from the child profile or photo.`;

const WARDROBE_BY_COMPANION_ID: Record<string, string> = {
  dragon_dini: DRAGON_DINI_FANTASY_WARDROBE_LOCK,
};

export function resolveStyle01StoryWardrobeLock(companionId?: string | null): string | undefined {
  if (!companionId) return undefined;
  return WARDROBE_BY_COMPANION_ID[companionId];
}
