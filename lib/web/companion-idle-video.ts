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

/* ── Warm-start cache (per Guy: the popup must show ONLY the video, and it
   must start instantly — no image-then-video flash). After the landing page
   settles we quietly download each idle clip once and hold it as a blob URL;
   when a spotlight opens, its <video> reads from memory and paints its first
   frame in milliseconds instead of hitting the network. ~2.8MB total across
   six clips, fetched sequentially at idle priority so the hero image and
   fonts always win the bandwidth race. */

const warmedUrls = new Map<string, string>();
let warmStarted = false;

/** Kick off the idle-video warm-up (client only; call once, e.g. on mount). */
export function warmCompanionIdleVideos(companionImages: string[]): void {
  if (warmStarted || typeof window === 'undefined') return;
  warmStarted = true;
  // Respect users who asked for stillness or metered data: they either never
  // see the video (reduced motion) or should not pay for a silent prefetch.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;

  const srcs = Array.from(
    new Set(
      companionImages
        .map((image) => companionIdleVideoSrc(image))
        .filter((src): src is string => Boolean(src)),
    ),
  );
  if (srcs.length === 0) return;

  const warm = () => {
    // Sequential chain: one clip in flight at a time keeps the network calm.
    let chain: Promise<void> = Promise.resolve();
    for (const src of srcs) {
      chain = chain.then(() =>
        fetch(src)
          .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
          .then((blob) => {
            warmedUrls.set(src, URL.createObjectURL(blob));
          })
          // A failed warm-up is invisible: the popup just streams normally.
          .catch(() => {}),
      );
    }
  };

  type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(warm, { timeout: 3500 });
  } else {
    window.setTimeout(warm, 1200);
  }
}

/** The in-memory blob URL for this clip when warmed, else the network src. */
export function warmedIdleVideoSrc(src: string): string {
  return warmedUrls.get(src) ?? src;
}
