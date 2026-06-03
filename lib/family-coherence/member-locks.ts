import type { FamilyContext } from '@/backend/providers/story';
import type {
  FamilyCoherenceProfile,
  FamilyMemberRole,
  FamilyMemberVisualLocks,
  HairColorFamily,
  HairTextureFamily,
} from './types';

const HAIR_TEXTURE_WORD: Record<HairTextureFamily, string> = {
  curly: 'curly',
  coily: 'coily',
  wavy: 'wavy',
  straight: 'straight',
  mixed: 'naturally textured',
};

const HAIR_COLOR_WORD: Record<HairColorFamily, string> = {
  black: 'dark black',
  'dark-brown': 'dark brown',
  'medium-brown': 'medium brown',
  'light-brown': 'light brown',
  blonde: 'warm blonde',
  red: 'warm auburn-red',
  'mixed-dark': 'dark brown to black',
};

function parentHairLine(profile: FamilyCoherenceProfile, shareTrait: boolean): string {
  const texture = shareTrait
    ? HAIR_TEXTURE_WORD[profile.hairTextureFamily]
    : profile.hairTextureFamily === 'straight'
      ? 'wavy'
      : 'straight';
  const color = shareTrait
    ? HAIR_COLOR_WORD[profile.hairColorFamily]
    : profile.hairColorFamily === 'blonde'
      ? 'dark brown'
      : HAIR_COLOR_WORD[profile.hairColorFamily];
  return `${texture} ${color} hair`;
}

function glassesNote(profile: FamilyCoherenceProfile, role: 'mother' | 'father'): string {
  if (!profile.glasses) return '';
  if (role === 'mother') {
    return ' May wear simple round glasses (optional — only if it reads natural; not on every parent).';
  }
  return '';
}

export function buildMotherVisualLock(
  profile: FamilyCoherenceProfile,
  overrideDescription?: string
): string {
  if (overrideDescription?.trim()) {
    return [
      'FAMILY MEMBER CONTINUITY LOCK — MOTHER (same woman every page):',
      overrideDescription.trim(),
      `Skin tone within hero family band: ${profile.skinTonePrompt}.`,
      'Adult woman, illustrated storybook style. NOT the hero child’s face. Natural variation from the child.',
      'Visual coherence with the hero — same family world, not a clone.',
    ].join('\n');
  }
  return [
    'FAMILY MEMBER CONTINUITY LOCK — MOTHER (same woman on p2, p20, and every page she appears):',
    `Skin: ${profile.skinTonePrompt}.`,
    `Hair: ${parentHairLine(profile, true)}.`,
    `Facial world: ${profile.broadFeatures}.`,
    'Adult woman, tired-but-loving or gentle parent energy when scene calls for it.',
    'NEVER default to a different ethnicity/world than the hero. NEVER copy the hero child’s exact face onto the mother.',
    glassesNote(profile, 'mother'),
    'Mixed/adoptive families allowed — coherence, not biological cloning.',
  ].join('\n');
}

export function buildFatherVisualLock(
  profile: FamilyCoherenceProfile,
  overrideDescription?: string
): string {
  if (overrideDescription?.trim()) {
    return [
      'FAMILY MEMBER CONTINUITY LOCK — FATHER (same man every page):',
      overrideDescription.trim(),
      `Skin tone within hero family band: ${profile.skinTonePrompt}.`,
      'Adult man, illustrated storybook style. NOT the hero child’s face.',
    ].join('\n');
  }
  return [
    'FAMILY MEMBER CONTINUITY LOCK — FATHER (same man on p20 and every page he appears):',
    `Skin: ${profile.skinTonePrompt}.`,
    `Hair: ${parentHairLine(profile, false)} — natural variation from mother/hero.`,
    `Facial world: ${profile.broadFeatures} (adult male proportions).`,
    'Warm, proud parent presence when in doorway scenes.',
    'NEVER default pale/pink if hero is medium/deep tone. NEVER clone the hero child face.',
    profile.glasses ? ' May wear simple glasses if natural.' : '',
  ].join('\n');
}

/** Human newborn in crib — NOT baby_dragon. */
export function buildBabySiblingVisualLock(profile: FamilyCoherenceProfile): string {
  return [
    'RECURRING ENTITY LOCK — BABY SISTER (newborn human sibling in crib):',
    'The same newborn human baby sister whenever shown — especially pages 2 and 20.',
    '',
    'Distinctive visual signature:',
    '- Newborn human baby, approximately 0–3 months in appearance.',
    '- Head: small and round, mostly BALD with maybe a faint wisp of soft fuzz.',
    `- Skin: ${profile.skinTonePrompt}. Gentle newborn warmth/blush is OK but MUST stay within this family skin-tone band.`,
    '- FORBIDDEN: default pale-pink newborn flush unrelated to the hero’s family tone.',
    '- Eyes: usually closed sleeping or partly squinted; when open, dark and unfocused.',
    '- Mouth: small but capable of a surprisingly loud cry when story calls for it.',
    '- Body: very small, wrapped in pale fabric or covered with the yellow blanket.',
    '- GREEN socks: when feet are visible, socks are SOFT GREEN (NOT pink).',
    '- Always inside the crib unless staging explicitly says otherwise; protagonist watches or tucks blanket — not holding the newborn.',
    '',
    'NEVER a toddler. NEVER walking or sitting up. NEVER the moss-green baby dragon.',
    'NEVER copy the hero child’s face onto the newborn.',
  ].join('\n');
}

export function buildSiblingVisualLock(profile: FamilyCoherenceProfile): string {
  return [
    'FAMILY MEMBER CONTINUITY LOCK — OLDER SIBLING:',
    `Skin: ${profile.skinTonePrompt}. Hair family: ${HAIR_TEXTURE_WORD[profile.hairTextureFamily]} ${HAIR_COLOR_WORD[profile.hairColorFamily]}.`,
    'Child age above the hero; same illustrated family world; NOT a clone of the hero face.',
  ].join('\n');
}

export function buildGrandparentVisualLock(profile: FamilyCoherenceProfile): string {
  return [
    'FAMILY MEMBER CONTINUITY LOCK — GRANDPARENT:',
    `Skin: ${profile.skinTonePrompt}. Hair may be graying or ${HAIR_COLOR_WORD[profile.hairColorFamily]}.`,
    'Warm elder proportions; same family visual world as the hero.',
  ].join('\n');
}

export function buildFamilyMemberVisualLocks(
  profile: FamilyCoherenceProfile,
  familyContext?: FamilyContext | null
): FamilyMemberVisualLocks {
  return {
    mother: buildMotherVisualLock(profile, familyContext?.parent1?.description),
    parent_1: buildMotherVisualLock(profile, familyContext?.parent1?.description),
    father: buildFatherVisualLock(profile, familyContext?.parent2?.description),
    parent_2: buildFatherVisualLock(profile, familyContext?.parent2?.description),
    baby_sibling: buildBabySiblingVisualLock(profile),
    sibling: buildSiblingVisualLock(profile),
    grandparent: buildGrandparentVisualLock(profile),
  };
}

export function lockTextForRole(
  locks: FamilyMemberVisualLocks,
  role: FamilyMemberRole
): string {
  return locks[role]?.trim() ?? locks.mother?.trim() ?? '';
}
