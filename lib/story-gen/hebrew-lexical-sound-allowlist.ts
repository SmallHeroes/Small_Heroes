/**
 * Curated sound-word allowlists — global onomatopoeia + companion-scoped belly sounds.
 * Companion-scoped entries are NOT universal Hebrew words (Step 4.5).
 */

/** Global onomatopoeia — any companion may use. */
export const ONOMATOPOEIA_ALLOWLIST = [
  'פּוּף',
  'פוף',
  'טַף־טַף',
  'טף־טַף',
  'טַף',
  'קְלָק',
  'קלק',
  'דִּינג',
  'דינג',
  'בּוּם',
  'בום',
  'פְּססס',
  'פססס',
  'פְּלוּפּ',
  'פלופ',
  'קליק',
  'קְלִיק',
  'טִיק',
  'טָאק',
  'תִּקְתּוּק',
  'פיפס',
  'פִּפְּס',
] as const;

/**
 * Tubi / baby_elephant belly-body sound family (בְּרוּם, רְרוּם).
 * Not allowed for other companions — prevents escape in unrelated stories.
 */
export const COMPANION_SCOPED_SOUND_WORDS: Readonly<
  Record<string, readonly string[]>
> = {
  baby_elephant: ['בְּרוּם', 'ברום', 'רְרוּם', 'ררום'],
};

export function resolveSoundWordsForCompanion(
  companionId: string | null
): readonly string[] {
  const scoped = companionId
    ? (COMPANION_SCOPED_SOUND_WORDS[companionId] ?? [])
    : [];
  return [...ONOMATOPOEIA_ALLOWLIST, ...scoped];
}

export function formatSoundAllowlistForPrompt(companionId: string | null): string {
  const global = ONOMATOPOEIA_ALLOWLIST.join(', ');
  const scoped = companionId
    ? (COMPANION_SCOPED_SOUND_WORDS[companionId] ?? [])
    : [];
  if (!scoped.length) return global;
  return `${global}; companion-only (${companionId}): ${scoped.join(', ')}`;
}
