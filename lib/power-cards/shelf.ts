/**
 * Golden shelf v1 — 19 shipped stories with committed powerCard frontmatter.
 * octopus_seara_adventure is queued (slot 20) and not included yet.
 */
export const GOLDEN_SHELF_POWER_CARD_SLUGS = [
  'owl_chacham_bedtime',
  'bat_lily_bedtime',
  'bee_ima_bedtime',
  'bolly_armadillo_bedtime',
  'song_whale_bedtime',
  'starfish_kokhavi_bedtime',
  'turtle_beiti_bedtime',
  'fox_uri_adventure',
  'dolphin_shahkan_adventure',
  'firefly_namit_adventure',
  'bear_cub_gahal_adventure',
  'bear_mati_adventure',
  'mongoose_zariz_adventure',
  'chameleon_koko_fantasy',
  'dragon_dini_fantasy',
  'fawn_tzvi_fantasy',
  'butterfly_zohar_fantasy',
  'bunny_ometz_fantasy',
  'bear_mati_fantasy',
] as const;

export type GoldenShelfPowerCardSlug = (typeof GOLDEN_SHELF_POWER_CARD_SLUGS)[number];

export const GOLDEN_SHELF_STORY_DIR = 'story-bank/v5-fixed-v2';

export function goldenShelfStoryFilename(slug: GoldenShelfPowerCardSlug): string {
  return `${slug}.md`;
}
