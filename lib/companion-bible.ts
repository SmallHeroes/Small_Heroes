/**
 * Companion Bible loader — structured rules per companion for story validators.
 * Source of truth: docs/COMPANION_BIBLE_v1.md (fully bibled companions).
 */

export type CompanionGender = 'male' | 'female';

export interface CompanionBibleEntry {
  companionId: string;
  canonicalName: string;
  nameClean: string;
  gender: CompanionGender;
  forbiddenAnatomy: string[];
  forbiddenObjects: string[];
  forbiddenTone: string[];
  minimumPresence?: Partial<Record<'bedtime' | 'adventure' | 'fantasy', number>>;
  maxConsecutiveAbsent?: number;
  introByPage?: Partial<Record<'bedtime' | 'adventure' | 'fantasy', number>>;
}

const BIBLE: Record<string, CompanionBibleEntry> = {
  octopus_seara: {
    companionId: 'octopus_seara',
    canonicalName: 'התמנון זוּזִי',
    nameClean: 'זוּזִי',
    gender: 'male',
    forbiddenAnatomy: ['feet', 'legs', 'hands', 'hair', 'fur', 'feathers', 'shell', 'armor', 'רגליים', 'ידיים', 'נוצות', 'פרווה'],
    forbiddenObjects: ['books', 'stars', 'flashlight', 'ספר', 'כוכב', 'פנס'],
    forbiddenTone: ['הוא חשב על', 'כעס זה בסדר', 'calm-mentor', 'therapeutic'],
    minimumPresence: { bedtime: 0.7, adventure: 0.6, fantasy: 0.6 },
    maxConsecutiveAbsent: 2,
    introByPage: { bedtime: 3, adventure: 3, fantasy: 5 },
  },
  bat_lily: {
    companionId: 'bat_lily',
    canonicalName: 'העטלף לילי',
    nameClean: 'לִילִי',
    gender: 'female',
    forbiddenAnatomy: ['feathers', 'נוצות', 'hooves', 'פרסות', 'hands', 'ידיים', 'fur coat', 'shell'],
    forbiddenObjects: ['sword', 'חרב', 'stars as main motif', 'כוכבים'],
    forbiddenTone: ['bravery speech', 'הוא אמיץ', 'medical explanation'],
    minimumPresence: { bedtime: 0.7, adventure: 0.6, fantasy: 0.6 },
    maxConsecutiveAbsent: 2,
    introByPage: { bedtime: 3, adventure: 3, fantasy: 5 },
  },
  chameleon_koko: {
    companionId: 'chameleon_koko',
    canonicalName: 'הזיקית קִים',
    nameClean: 'קִים',
    gender: 'female',
    forbiddenAnatomy: ['shell', 'armor', 'שריון', 'feathers', 'נוצות', 'fur', 'פרווה', 'wings', 'כנפיים'],
    forbiddenObjects: ['mirror', 'מראה', 'notebook', 'מחברת', 'flashlight', 'פנס'],
    forbiddenTone: ['the old you stays inside', 'wise-mentor', 'camouflage philosophy'],
    minimumPresence: { bedtime: 0.6, adventure: 0.6, fantasy: 0.6 },
    maxConsecutiveAbsent: 2,
    introByPage: { bedtime: 3, adventure: 3, fantasy: 5 },
  },
  dolphin_shahkan: {
    companionId: 'dolphin_shahkan',
    canonicalName: 'הדולפין דּוּדִי',
    nameClean: 'דּוּדִי',
    gender: 'male',
    forbiddenAnatomy: ['feathers', 'נוצות', 'legs', 'רגליים', 'fur', 'shell'],
    forbiddenObjects: ['books', 'ספר', 'shell', 'clothes', 'בגד'],
    forbiddenTone: ['sit still', 'calm down', 'ADHD', 'lecturing'],
    maxConsecutiveAbsent: 2,
    introByPage: { bedtime: 3, adventure: 3, fantasy: 5 },
  },
  fawn_tzvi: {
    companionId: 'fawn_tzvi',
    canonicalName: 'העופר צבי',
    nameClean: 'צְבִי',
    gender: 'male',
    forbiddenAnatomy: ['shell', 'שריון', 'hands', 'ידיים', 'feathers', 'נוצות', 'antlers', 'קרניים'],
    forbiddenObjects: ['notebook', 'מחברת', 'flashlight', 'פנס', 'hat', 'כובע', 'drum', 'תוף'],
    forbiddenTone: ['toughen up', 'stop being so sensitive', 'exposure therapy'],
    maxConsecutiveAbsent: 2,
    introByPage: { bedtime: 3, adventure: 3, fantasy: 5 },
  },
  bolly_armadillo: {
    companionId: 'bolly_armadillo',
    canonicalName: 'בּוֹלִי',
    nameClean: 'בּוֹלִי',
    gender: 'male',
    forbiddenAnatomy: ['feathers', 'נוצות', 'fur covering shell', 'פרווה', 'wings', 'כנפיים', 'hooves', 'פרסות'],
    forbiddenObjects: ['flashlight', 'פנס', 'notebook', 'מחברת', 'sword', 'חרב', 'shield', 'מגן', 'stars', 'כוכב'],
    forbiddenTone: ['הוא אמיץ', 'bravery', 'הרופא לא יזיק', 'medical explanation', 'inspirational', 'גם בפנים יש כוח'],
    minimumPresence: { bedtime: 0.7, adventure: 0.6, fantasy: 0.6 },
    maxConsecutiveAbsent: 2,
    introByPage: { bedtime: 3, adventure: 3, fantasy: 5 },
  },
};

export function getCompanionBible(companionId: string): CompanionBibleEntry | null {
  const key = companionId.trim().toLowerCase().replace(/-/g, '_');
  return BIBLE[key] ?? null;
}

export function listKnownCompanionIds(): string[] {
  return Object.keys(BIBLE);
}
