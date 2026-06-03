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
      'can be switched off or on; when lit gives a soft warm glow on the ground; secret-path keeper mood',
    accessoryRequiredWhenVisible: true,
    forbiddenAlternatives: ['scarf', 'neck scarf', 'chest star', 'star on chest', 'lantern on chest'],
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
      'Do NOT show a contradictory accessory (no scarf, no chest star).',
      'The canonical lantern need NOT be visible when only a tail tip, paw, or distant clue appears.',
      forbid,
    ].join('\n');
  }

  if (!companionPresenceShowsAccessory(input.companionPresence)) return undefined;

  return [
    `COMPANION ACCESSORY LOCK — ${name}:`,
    `ALWAYS ${profile.canonicalAccessory} at ${profile.accessoryLocation}. ${profile.accessoryBehavior}.`,
    'When the companion body/face is clearly visible, the neck lantern MUST be present and correct.',
    forbid,
  ].join('\n');
}
