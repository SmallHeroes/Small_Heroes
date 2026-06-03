/** Broad visual bands — never ethnic/racial labels in prompts. */
export type SkinToneBand =
  | 'deep-warm'
  | 'medium-deep-warm'
  | 'medium-warm'
  | 'light-warm'
  | 'light-neutral';

export type HairTextureFamily = 'curly' | 'coily' | 'wavy' | 'straight' | 'mixed';

export type HairColorFamily =
  | 'black'
  | 'dark-brown'
  | 'medium-brown'
  | 'light-brown'
  | 'blonde'
  | 'red'
  | 'mixed-dark';

export type FamilyMemberRole =
  | 'mother'
  | 'father'
  | 'parent_1'
  | 'parent_2'
  | 'baby_sibling'
  | 'sibling'
  | 'grandparent';

export type FamilyCoherenceProfile = {
  skinToneBand: SkinToneBand;
  skinTonePrompt: string;
  hairTextureFamily: HairTextureFamily;
  hairColorFamily: HairColorFamily;
  glasses: boolean;
  broadFeatures: string;
  variationAllowed: true;
  derivedFrom: 'photo_dna_and_anchor';
  derivedAt: string;
};

export type FamilyMemberVisualLocks = Partial<Record<FamilyMemberRole, string>>;

export type FamilyCoherenceBundle = {
  profile: FamilyCoherenceProfile;
  memberLocks: FamilyMemberVisualLocks;
};

export const FAMILY_COHERENCE_JSON_KEY = '_familyCoherence' as const;
