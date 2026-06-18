/**
 * Per-story wardrobe overrides — identity stays in child DNA; clothing is story-level.
 */

import type { StoryTimeOfDay } from './story-time-of-day';

/** dragon_dini_fantasy — gender-neutral bird pajama (same for every child on this story). */
export const DRAGON_DINI_FANTASY_WARDROBE_LOCK = `BOOK WARDROBE LOCK — STORY dragon_dini_fantasy (mandatory every page the child appears):
Soft two-piece pajamas. Base color pale dusty-blue (or warm cream), with a small, evenly-repeated all-over print of simple friendly little BIRDS in mixed WARM colors (mustard-yellow, soft coral, teal) — deliberately NOT green, so the pajama never reads as the moss-green baby dragon. The SAME single bird motif repeated on every page (do not vary the print or swap to other creatures between pages). Long-sleeve top + matching pajama pants. Small green wristband on the LEFT wrist (neutral continuity detail). Bare feet or soft cream slipper-socks. SAME pajamas on every page — home and dragon world. NEVER day clothes, NEVER a sky-blue sun t-shirt, NEVER denim shorts, NEVER red sneakers, NEVER dinosaur-print clothing.

CHILD IDENTITY vs WARDROBE: Use CHILD VISUAL LOCK + ANATOMICAL LOCK for face, hair, skin, age, gender only — NOT clothing from the child profile or photo.`;

export const LION_SHAKET_BEDTIME_WARDROBE_LOCK = `BOOK WARDROBE LOCK — STORY lion_shaket_bedtime (mandatory every page the child appears):
Soft two-piece pajamas, gender-neutral. Base color warm cream or soft sand-beige, with a small, evenly-repeated all-over print of simple tiny moons-and-dots in warm tones (mustard, soft coral) — NOT blue and NOT a star print, so the pajamas never blend into the child's blue star blanket ("פינת הרעם"). Long-sleeve top + matching pajama pants, identical on every page. Soft cream slipper-socks (preferred over bare feet — avoids foot-rendering glitches). The child is dressed for bed/night the ENTIRE book. SAME pajamas on every page. NEVER day clothes, NEVER a sky-blue sun t-shirt, NEVER denim shorts, NEVER red sneakers, NEVER outdoor shoes.

CHILD IDENTITY vs WARDROBE: Use CHILD VISUAL LOCK + ANATOMICAL LOCK for face, hair, skin, age, gender only — NOT clothing from the child profile or photo.`;

/**
 * Generic night-at-home wardrobe — any NIGHT_FEAR / night-time story without a story-file override.
 * Covers adventure-at-night slots (balcony, hallway, etc.) — child stays in pajamas entire book.
 */
export const GENERIC_NIGHT_STORY_WARDROBE_LOCK = `BOOK WARDROBE LOCK — NIGHT story (mandatory every page the child appears):
Soft two-piece pajamas, gender-neutral. Base color soft heather-gray or warm oat-beige, with a small evenly-repeated all-over print of simple tiny stars and dots in muted warm tones (soft gold, dusty rose) — NOT bright day colors. Long-sleeve top + matching pajama pants, identical on every page. Soft cream slipper-socks OR bare feet. The child is dressed for night at home the ENTIRE book — even on balcony, hallway, or window beats. SAME pajamas on every page. NEVER day clothes, NEVER a sky-blue sun t-shirt, NEVER denim shorts, NEVER red sneakers, NEVER outdoor shoes.

CHILD IDENTITY vs WARDROBE: Use CHILD VISUAL LOCK + ANATOMICAL LOCK for face, hair, skin, age, gender only — NOT clothing from the child profile or photo.`;

export type StoryWardrobeContext = {
  storyTimeOfDay?: StoryTimeOfDay | string | null;
  category?: string | null;
};

/** Story-file overrides take priority (lets one companion differ by direction). */
const WARDROBE_BY_STORY_FILE: Record<string, string> = {
  lion_shaket_bedtime: LION_SHAKET_BEDTIME_WARDROBE_LOCK,
};

const WARDROBE_BY_COMPANION_ID: Record<string, string> = {
  dragon_dini: DRAGON_DINI_FANTASY_WARDROBE_LOCK,
};

const NIGHT_CATEGORY_DEFAULTS = new Set(['NIGHT_FEAR']);

export function storyFileKeyFromPath(storyFile?: string | null): string | undefined {
  if (!storyFile?.trim()) return undefined;
  const base = storyFile.replace(/\\/g, '/').split('/').pop() ?? storyFile;
  return base.replace(/\.md$/i, '').trim() || undefined;
}

export function shouldUseGenericNightStoryWardrobe(
  ctx?: StoryWardrobeContext,
  storyFileKey?: string | null
): boolean {
  // Scene-time-aware: an explicit DAYTIME page wins (day clothes) even inside a bedtime story —
  // e.g. a daytime flashback scene. This `ctx.storyTimeOfDay` is the page's EFFECTIVE time-of-day.
  const tod = (ctx?.storyTimeOfDay ?? '').toString().trim().toLowerCase();
  if (tod === 'day') return false;
  if (tod === 'night' || tod === 'dusk') return true;
  // Otherwise a `_bedtime` story defaults to night (matches the prompt audit, which treats every
  // `_bedtime` story as night). Covers bedtime slots whose page time-of-day is untagged.
  if (storyFileKey && /_bedtime$/i.test(storyFileKey)) return true;
  const cat = ctx?.category?.trim().toUpperCase();
  return Boolean(cat && NIGHT_CATEGORY_DEFAULTS.has(cat));
}

export function resolveStyle01StoryWardrobeLock(
  companionId?: string | null,
  storyFile?: string | null,
  ctx?: StoryWardrobeContext
): string | undefined {
  const key = storyFileKeyFromPath(storyFile);
  if (key && WARDROBE_BY_STORY_FILE[key]) return WARDROBE_BY_STORY_FILE[key];
  if (companionId && WARDROBE_BY_COMPANION_ID[companionId]) return WARDROBE_BY_COMPANION_ID[companionId];
  if (shouldUseGenericNightStoryWardrobe(ctx, key)) return GENERIC_NIGHT_STORY_WARDROBE_LOCK;
  return undefined;
}
