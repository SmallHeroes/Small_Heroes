import type { CompanionPresence } from './image-entity-presence';

export type CompanionAccessoryProfile = {
  canonicalAccessory: string;
  accessoryLocation: string;
  accessoryBehavior: string;
  accessoryRequiredWhenVisible: boolean;
  forbiddenAlternatives: string[];
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
      'she places it as a ritual before trying to enter a social scene; may be absent on partial/small/silhouette views',
    accessoryRequiredWhenVisible: true,
    forbiddenAlternatives: [
      'held bouquet',
      'large prop in paws',
      'conflicting handheld object',
      'notebook',
      'umbrella',
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
}): string | undefined {
  const profile = resolveCompanionAccessoryProfile(input.companionId);
  if (!profile) return undefined;

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
