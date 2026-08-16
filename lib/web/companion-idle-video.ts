/**
 * Companion idle videos (public/Videos, Guy's exports) keyed by the
 * companion slug inside `companion.image` ('/companions/<slug>/...').
 * Marketing-surface asset only — served from the CDN, never bundled into
 * render functions (public/Videos is outside every tracing include).
 */
const COMPANION_IDLE_VIDEO: Record<string, string> = {
  fox_uri: 'Fox_Idle',
  bunny_ometz: 'Rabbit_Idle',
  panda_anat: 'Panda_Idle',
  dragon_dini: 'Dragon_Idle',
  chameleon_koko: 'Chameleon_Idle',
  lion_shaket: 'Lion_Idle',
};

/** CDN path of the idle video for this companion, or null when none exists. */
export function companionIdleVideoSrc(companionImage: string): string | null {
  const slug = companionImage.split('/')[2] ?? '';
  const name = COMPANION_IDLE_VIDEO[slug];
  return name ? `/Videos/${name}.mp4` : null;
}
