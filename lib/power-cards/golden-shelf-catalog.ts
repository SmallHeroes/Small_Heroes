import type { GoldenShelfPowerCardSlug } from './shelf';

export type GoldenShelfDirection = 'bedtime' | 'adventure' | 'fantasy';

export type GoldenShelfStoryEntry = {
  slug: GoldenShelfPowerCardSlug;
  companionId: string;
  direction: GoldenShelfDirection;
  /** Hebrew display name — synced from lib/companions.ts (client-safe static copy). */
  displayName: string;
};

/** All 19 golden-shelf stories grouped by direction (7 + 6 + 6). */
export const GOLDEN_SHELF_CATALOG: Record<GoldenShelfDirection, GoldenShelfStoryEntry[]> = {
  bedtime: [
    { slug: 'owl_chacham_bedtime', companionId: 'owl_chacham', direction: 'bedtime', displayName: 'הינשוף בּוּבּוּ' },
    { slug: 'bat_lily_bedtime', companionId: 'bat_lily', direction: 'bedtime', displayName: 'העטלף לילי' },
    { slug: 'bee_ima_bedtime', companionId: 'bee_ima', direction: 'bedtime', displayName: 'הדבורה דְּבוֹרִי' },
    { slug: 'bolly_armadillo_bedtime', companionId: 'bolly_armadillo', direction: 'bedtime', displayName: 'בּוֹלִי' },
    { slug: 'song_whale_bedtime', companionId: 'song_whale', direction: 'bedtime', displayName: 'הלוויתן לוּלִי' },
    { slug: 'starfish_kokhavi_bedtime', companionId: 'starfish_kokhavi', direction: 'bedtime', displayName: 'כוכבי' },
    { slug: 'turtle_beiti_bedtime', companionId: 'turtle_beiti', direction: 'bedtime', displayName: 'הצב טוֹלִי' },
  ],
  adventure: [
    { slug: 'fox_uri_adventure', companionId: 'fox_uri', direction: 'adventure', displayName: 'השועל אוּרי' },
    { slug: 'dolphin_shahkan_adventure', companionId: 'dolphin_shahkan', direction: 'adventure', displayName: 'הדולפין דּוּדִי' },
    { slug: 'firefly_namit_adventure', companionId: 'firefly_namit', direction: 'adventure', displayName: 'הגחלילית נָמִית' },
    { slug: 'bear_cub_gahal_adventure', companionId: 'bear_cub_gahal', direction: 'adventure', displayName: 'הדוב דּוֹבִּי' },
    { slug: 'bear_mati_adventure', companionId: 'bear_mati', direction: 'adventure', displayName: 'המַנְצֵחַ מתי' },
    { slug: 'mongoose_zariz_adventure', companionId: 'mongoose_zariz', direction: 'adventure', displayName: 'הנמייה זוּמִי' },
  ],
  fantasy: [
    { slug: 'chameleon_koko_fantasy', companionId: 'chameleon_koko', direction: 'fantasy', displayName: 'הזיקית קִים' },
    { slug: 'dragon_dini_fantasy', companionId: 'dragon_dini', direction: 'fantasy', displayName: 'הדרקון דיני' },
    { slug: 'fawn_tzvi_fantasy', companionId: 'fawn_tzvi', direction: 'fantasy', displayName: 'העופר צְבִי' },
    { slug: 'butterfly_zohar_fantasy', companionId: 'butterfly_zohar', direction: 'fantasy', displayName: 'הפרפר זֹהַר' },
    { slug: 'bunny_ometz_fantasy', companionId: 'bunny_ometz', direction: 'fantasy', displayName: 'הארנבון בּוּנִי' },
    { slug: 'bear_mati_fantasy', companionId: 'bear_mati', direction: 'fantasy', displayName: 'המַנְצֵחַ מתי' },
  ],
};

export const GOLDEN_SHELF_PAGE_OPTIONS = [1, 2, 3, 5, 10] as const;

export type GoldenShelfPageOption = (typeof GOLDEN_SHELF_PAGE_OPTIONS)[number];

export const GOLDEN_SHELF_ALL_ENTRIES: GoldenShelfStoryEntry[] = [
  ...GOLDEN_SHELF_CATALOG.bedtime,
  ...GOLDEN_SHELF_CATALOG.adventure,
  ...GOLDEN_SHELF_CATALOG.fantasy,
];

export function goldenShelfStoryFile(slug: GoldenShelfPowerCardSlug): string {
  return `${slug}.md`;
}

export function goldenShelfCompanionLabel(entry: GoldenShelfStoryEntry): string {
  return `${entry.displayName} — ${entry.slug}`;
}

export const GOLDEN_SHELF_DIRECTION_LABELS: Record<GoldenShelfDirection, string> = {
  bedtime: 'Bedtime (7)',
  adventure: 'Adventure (6)',
  fantasy: 'Fantasy (6)',
};
