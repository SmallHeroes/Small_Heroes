import type { CompanionPresence } from './image-entity-presence';

export type CompanionAccessoryContext = 'story_page' | 'character_sheet';

export type CompanionAccessoryProfile = {
  canonicalAccessory: string;
  accessoryLocation: string;
  accessoryBehavior: string;
  accessoryRequiredWhenVisible: boolean;
  forbiddenAlternatives: string[];
  /** When false, ritual/story props are omitted on multi-angle character sheets. */
  showOnCharacterSheet?: boolean;
  /** Override accessory text for character sheets (e.g. sweater patch only, no ground ritual prop). */
  characterSheetAccessory?: string;
  characterSheetAccessoryLocation?: string;
  characterSheetAccessoryBehavior?: string;
};

/** Canonical story accessories — one per companion when defined. */
export const COMPANION_ACCESSORY_PROFILES: Partial<Record<string, CompanionAccessoryProfile>> = {
  fox_uri: {
    canonicalAccessory: 'small glowing neck lantern',
    accessoryLocation: 'around the neck (collar lantern)',
    accessoryBehavior:
      'can be switched off or on; when lit gives a soft warm glow on the ground; secret-path keeper mood; brightness = courage meter (flickers/shrinks with fear)',
    accessoryRequiredWhenVisible: true,
    forbiddenAlternatives: ['scarf', 'neck scarf', 'chest star', 'star on chest', 'lantern on chest'],
  },
  panda_anat: {
    canonicalAccessory: 'small pause-stone / leaf she sets down before entering',
    accessoryLocation: 'on the ground before her (pause marker ritual)',
    accessoryBehavior:
      'appears during her pause ritual before entering a social scene; NOT mandatory whenever visible',
    accessoryRequiredWhenVisible: false,
    showOnCharacterSheet: false,
    characterSheetAccessory: 'small music-note patch on a soft sweater',
    characterSheetAccessoryLocation: 'on the chest of her sweater',
    characterSheetAccessoryBehavior:
      'same simple note patch every time; sweater/back visible on back views — quiet social calm marker; NO ground props on character sheets',
    forbiddenAlternatives: [
      'held bouquet',
      'large prop in paws',
      'conflicting handheld object',
      'notebook',
      'umbrella',
      'pause-stone on ground',
      'leaf on ground',
      'stone prop',
      'leaf prop',
    ],
  },
  chameleon_koko: {
    canonicalAccessory: 'tiny fabric shoulder satchel in warm mustard',
    accessoryLocation: 'one shoulder — small soft travel bag strap',
    accessoryBehavior:
      'her little travel bag ("a piece of home travels with her"); visibly SMALLER and fabric-soft vs any dragon guardian bag — compact satchel silhouette only',
    accessoryRequiredWhenVisible: true,
    forbiddenAlternatives: [
      'scarf',
      'striped scarf',
      'neck scarf',
      'patchwork',
      'multicolor patches',
      'pink spots',
      'large knapsack',
      'big backpack',
      'dragon-sized bag',
      'terracotta sash',
    ],
  },
  dragon_dini: {
    canonicalAccessory: 'terracotta sash (diagonal across body)',
    accessoryLocation: 'diagonal across torso (terracotta sash)',
    accessoryBehavior:
      'warm guardian sash; visible when body clearly shown; may be absent on partial/offscreen/small views',
    accessoryRequiredWhenVisible: true,
    forbiddenAlternatives: ['scarf', 'necklace', 'cape', 'chest star', 'neck scarf'],
  },
};

export function resolveCompanionAccessoryProfile(
  companionId?: string | null
): CompanionAccessoryProfile | null {
  if (!companionId?.trim()) return null;
  return COMPANION_ACCESSORY_PROFILES[companionId.trim()] ?? null;
}

export function companionPresenceShowsAccessory(companionPresence: CompanionPresence): boolean {
  return companionPresence === 'present';
}

export function buildCompanionAccessoryLockBlock(input: {
  companionId?: string | null;
  companionName?: string | null;
  companionPresence: CompanionPresence;
  context?: CompanionAccessoryContext;
}): string | undefined {
  const profile = resolveCompanionAccessoryProfile(input.companionId);
  if (!profile) return undefined;

  const context = input.context ?? 'story_page';
  if (context === 'character_sheet' && profile.showOnCharacterSheet === false) {
    if (!profile.characterSheetAccessory) return undefined;
    const name = input.companionName?.trim() || input.companionId || 'companion';
    const forbid = profile.forbiddenAlternatives.map((f) => `NEVER ${f}`).join('; ');
    if (input.companionPresence === 'partial' || input.companionPresence === 'offscreen_hint') {
      return [
        `COMPANION ACCESSORY (partial/offscreen — ${name}):`,
        `On character sheets the canonical visible accessory is ${profile.characterSheetAccessory} at ${profile.characterSheetAccessoryLocation ?? 'on body'}.`,
        forbid,
      ].join('\n');
    }
    if (!companionPresenceShowsAccessory(input.companionPresence)) return undefined;
    return [
      `COMPANION ACCESSORY LOCK — ${name} (character sheet):`,
      `ALWAYS ${profile.characterSheetAccessory} at ${profile.characterSheetAccessoryLocation ?? 'on body'}. ${profile.characterSheetAccessoryBehavior ?? ''}.`,
      'NO pause-stone, NO leaf, NO ground ritual props on character sheets.',
      forbid,
    ].join('\n');
  }

  const name = input.companionName?.trim() || input.companionId || 'companion';
  const forbid = profile.forbiddenAlternatives.map((f) => `NEVER ${f}`).join('; ');

  if (input.companionPresence === 'partial' || input.companionPresence === 'offscreen_hint') {
    return [
      `COMPANION ACCESSORY (partial/offscreen — ${name}):`,
      `Canonical accessory is ${profile.canonicalAccessory} at ${profile.accessoryLocation}.`,
      'Do NOT show a contradictory accessory.',
      `The canonical accessory (${profile.canonicalAccessory}) need NOT be visible when only a tail tip, paw, or distant clue appears.`,
      forbid,
    ].join('\n');
  }

  if (!companionPresenceShowsAccessory(input.companionPresence)) return undefined;

  return [
    `COMPANION ACCESSORY LOCK — ${name}:`,
    `ALWAYS ${profile.canonicalAccessory} at ${profile.accessoryLocation}. ${profile.accessoryBehavior}.`,
    `When the companion body/face is clearly visible, ${profile.canonicalAccessory} MUST be present and correct.`,
    forbid,
  ].join('\n');
}
