/**
 * HeroDoodles — the storybook sky behind the hero.
 *
 * Hand-drawn line icons from the book's own vocabulary (moon, open book,
 * star, cloud, lantern, heart, narration note, sparkles) drifting slowly in
 * the hero's QUIET zones only. Nothing is drawn over the illustration or the
 * copy — there the marks read as noise rather than atmosphere.
 *
 * Placement uses PHYSICAL left/right, not logical start/end: these are marks
 * anchored to the composition (art on the left, copy on the right), and in an
 * RTL document the logical properties mirror them onto exactly the elements
 * they must avoid.
 *
 * The zones were measured, not guessed. At 1440 the collage occupies
 * x 3-53% / y 10-90% and the copy x 55-97% / y 16-82%, which leaves the bands
 * above and below the content plus the outer margins. Phones stack the
 * layout, so they get their own four marks: the margins beside the art, one
 * in the top band and one below.
 *
 * Decorative and inert: aria-hidden, pointer-events none, and the drift is
 * dropped under prefers-reduced-motion (landing.css).
 */

type Doodle = {
  key: string;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  size: number;
  rotate: number;
  /** seconds — slow, and deliberately mismatched so they never pulse together */
  duration: number;
  delay: number;
  /** upward travel in px (default 13). The marks sitting in the narrow band
      under the collage get a shorter one: at 1280 that band is ~55px, and a
      full-length drift would carry them into the artwork. */
  drift?: number;
  tone?: 'gold';
  art: React.ReactNode;
};

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const MOON = (
  <svg viewBox="0 0 24 24" {...stroke}>
    <path d="M16.5 3.2A10 10 0 1 0 21.5 15.8 8.2 8.2 0 1 1 16.5 3.2Z" />
  </svg>
);

const BOOK = (
  <svg viewBox="0 0 24 20" {...stroke}>
    <path d="M2 3.6C6 1.6 10 1.7 12 3.8c2-2.1 6-2 10 0v12.6c-4-1.8-8-1.6-10 .4-2-2-6-2.2-10-.4Z" />
    <path d="M12 4.4V16" />
  </svg>
);

const STAR = (
  <svg viewBox="0 0 24 24" {...stroke}>
    <path d="M12 2.6l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.6l-5.6 3.2 1.3-6.3-4.8-4.3 6.4-.7Z" />
  </svg>
);

const CLOUD = (
  <svg viewBox="0 0 28 18" {...stroke}>
    <path d="M7.4 15.4h13a4.4 4.4 0 0 0 .5-8.8 6.2 6.2 0 0 0-11.6-1.9 4.5 4.5 0 0 0-1.9 10.7Z" />
  </svg>
);

const LANTERN = (
  <svg viewBox="0 0 20 24" {...stroke}>
    <path d="M10 2v2.2" />
    <path d="M5.4 6.6h9.2l1.2 10.8a2 2 0 0 1-2 2.2H6.2a2 2 0 0 1-2-2.2Z" />
    <path d="M10 10.4v5.2" />
  </svg>
);

const HEART = (
  <svg viewBox="0 0 24 22" {...stroke}>
    <path d="M12 19.5S2.8 14 2.8 7.9A4.9 4.9 0 0 1 12 5.4a4.9 4.9 0 0 1 9.2 2.5C21.2 14 12 19.5 12 19.5Z" />
  </svg>
);

/* every book we make is narrated — the note earns its place */
const NOTE = (
  <svg viewBox="0 0 20 24" {...stroke}>
    <path d="M7.4 17.6V4.8l9-1.8v12.6" />
    <circle cx="5" cy="18.4" r="2.6" />
    <circle cx="14" cy="16.6" r="2.6" />
  </svg>
);

/* the four-point sparkle is the one FILLED mark — it reads as light */
const SPARKLE = (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M12 1c1 6.5 4.5 10 11 11-6.5 1-10 4.5-11 11-1-6.5-4.5-10-11-11C7.5 11 11 7.5 12 1Z"
      fill="currentColor"
    />
  </svg>
);

/* Desktop: the bands above and below the content, and the outer margins. */
const DESKTOP: Doodle[] = [
  { key: 'moon', left: 1.2, top: 0.8, size: 26, rotate: -12, duration: 11, delay: 0, art: MOON },
  { key: 'cloud', left: 21, top: 0.6, size: 26, rotate: 0, duration: 15, delay: -3, art: CLOUD },
  { key: 'book', left: 6, bottom: 0.8, size: 26, rotate: 6, duration: 13, delay: -4, drift: 6, art: BOOK },
  { key: 'lantern', left: 30, bottom: 0.8, size: 22, rotate: 5, duration: 14, delay: -9, drift: 6, art: LANTERN },
  { key: 'spark-edge', left: 0.9, top: 45, size: 13, rotate: 12, duration: 9, delay: -8, tone: 'gold', art: SPARKLE },

  /* the flanks (per Guy: the hero's sides sat empty) - small marks in the
     outer gutters, clear of the collage and the copy column */
  { key: 'heart-flank', left: 0.8, top: 28, size: 18, rotate: -10, duration: 11, delay: -3, drift: 9, art: HEART },
  { key: 'star-flank', left: 1.1, top: 66, size: 20, rotate: 10, duration: 12, delay: -7, art: STAR },
  { key: 'note-flank', right: 0.7, top: 32, size: 16, rotate: 9, duration: 10, delay: -4, drift: 8, art: NOTE },
  { key: 'spark-flank', right: 1.0, top: 54, size: 12, rotate: -12, duration: 8, delay: -6, tone: 'gold', art: SPARKLE },
  { key: 'cloud-flank', right: 0.6, top: 73, size: 20, rotate: 0, duration: 14, delay: -9, drift: 7, art: CLOUD },

  { key: 'spark-gold', right: 6, top: 1.2, size: 20, rotate: 8, duration: 9, delay: -2, tone: 'gold', art: SPARKLE },
  { key: 'note', right: 30, top: 1.2, size: 20, rotate: -10, duration: 10, delay: -7, art: NOTE },
  { key: 'star', right: 1.2, bottom: 1.5, size: 22, rotate: -8, duration: 12, delay: -6, art: STAR },
  { key: 'heart', right: 13, bottom: 1, size: 22, rotate: 8, duration: 12, delay: -1, art: HEART },
  { key: 'spark-small', right: 41, bottom: 1.2, size: 14, rotate: -14, duration: 8, delay: -5, art: SPARKLE },
];

/* Phones: the layout stacks, so the quiet zones are the margins BESIDE the
   collage plus the thin bands at the very top and bottom. */
const MOBILE: Doodle[] = [
  { key: 'm-spark', right: 4, top: 1, size: 14, rotate: 8, duration: 9, delay: -2, tone: 'gold', art: SPARKLE },
  { key: 'm-moon', left: 1.5, top: 58, size: 22, rotate: -12, duration: 11, delay: 0, art: MOON },
  { key: 'm-star', right: 1.5, top: 71, size: 20, rotate: -8, duration: 12, delay: -6, art: STAR },
  { key: 'm-book', left: 1.5, bottom: 1, size: 20, rotate: 6, duration: 13, delay: -4, art: BOOK },
];

function render(list: Doodle[], scope: 'desktop' | 'mobile') {
  return list.map((d) => (
    <span
      key={d.key}
      className="hero-doodle"
      data-tone={d.tone ?? 'purple'}
      data-scope={scope}
      style={
        {
          '--x-left': d.left !== undefined ? `${d.left}%` : undefined,
          '--x-right': d.right !== undefined ? `${d.right}%` : undefined,
          '--y-top': d.top !== undefined ? `${d.top}%` : undefined,
          '--y-bottom': d.bottom !== undefined ? `${d.bottom}%` : undefined,
          '--size': `${d.size}px`,
          '--tilt': `${d.rotate}deg`,
          '--dur': `${d.duration}s`,
          '--delay': `${d.delay}s`,
          '--drift': `-${d.drift ?? 13}px`,
        } as React.CSSProperties
      }
    >
      {d.art}
    </span>
  ));
}

/* ── "מה מקבלים" carries the sky on ─────────────────────────────────────
   Per Guy: ending the field at the hero's edge read as a cut. The same
   vocabulary continues through the next section and only then fades out,
   so the two sections feel like one lit room. Quiet zones here are the
   outer margins beside the card grid (which is capped at 1000px) plus the
   thin bands above the heading and below the last row. */
const VALUE_DESKTOP: Doodle[] = [
  { key: 'v-star', left: 3, top: 13, size: 22, rotate: -8, duration: 12, delay: -2, art: STAR },
  { key: 'v-heart', left: 6.5, top: 44, size: 20, rotate: 8, duration: 13, delay: -7, art: HEART },
  { key: 'v-book', left: 2.5, bottom: 10, size: 24, rotate: 6, duration: 14, delay: -4, art: BOOK },
  { key: 'v-spark-l', left: 9, top: 74, size: 13, rotate: 12, duration: 9, delay: -9, tone: 'gold', art: SPARKLE },

  { key: 'v-cloud', right: 4, top: 9, size: 26, rotate: 0, duration: 15, delay: -5, art: CLOUD },
  { key: 'v-note', right: 8, top: 46, size: 20, rotate: -10, duration: 10, delay: -1, art: NOTE },
  { key: 'v-moon', right: 3, bottom: 12, size: 24, rotate: -12, duration: 11, delay: -6, art: MOON },
  { key: 'v-spark-r', right: 10, top: 24, size: 15, rotate: 8, duration: 8, delay: -3, tone: 'gold', art: SPARKLE },
];

/* Phones: the cards run x 4→96% from y 19% down to y 95%, so their flanks
   are far too narrow for a mark. The quiet ground is the band ABOVE the
   heading — where the centred copy leaves both margins free — and the strip
   below the last card. Measured, not guessed. */
const VALUE_MOBILE: Doodle[] = [
  { key: 'vm-star', left: 4, top: 5, size: 18, rotate: -8, duration: 12, delay: -2, art: STAR },
  { key: 'vm-moon', right: 5, top: 5.5, size: 20, rotate: -12, duration: 11, delay: 0, art: MOON },
  { key: 'vm-spark', right: 7, top: 13, size: 13, rotate: 8, duration: 9, delay: -5, tone: 'gold', art: SPARKLE },
  { key: 'vm-book', left: 4, bottom: 1, size: 20, rotate: 6, duration: 13, delay: -8, drift: 6, art: BOOK },
  { key: 'vm-spark2', right: 12, bottom: 1.4, size: 12, rotate: -12, duration: 8, delay: -3, tone: 'gold', drift: 6, art: SPARKLE },
];

export function ValueDoodles() {
  return (
    <div className="value-doodles" aria-hidden="true">
      {render(VALUE_DESKTOP, 'desktop')}
      {render(VALUE_MOBILE, 'mobile')}
    </div>
  );
}

/* ── "מה מעסיק אותו" is the last section under the sky ──────────────────
   Per Guy the field runs all the way to the dark section and hands over to
   it there. The companion row is SIX cards wide on desktop and fills the
   viewport from 3.3% to 96.7%, so there is no usable flank: the marks live
   in the band above the heading (whose ink is centred, leaving both sides
   free) and in the strip under the last row. Measured, not guessed. */
const HELPS_DESKTOP: Doodle[] = [
  { key: 'h-moon', left: 4, top: 5, size: 24, rotate: -12, duration: 12, delay: -3, art: MOON },
  { key: 'h-cloud', left: 20, top: 3, size: 26, rotate: 0, duration: 15, delay: -1, art: CLOUD },
  { key: 'h-spark-l', left: 12, top: 15, size: 14, rotate: 12, duration: 9, delay: -8, tone: 'gold', art: SPARKLE },
  { key: 'h-lantern', left: 8, bottom: 3, size: 22, rotate: 5, duration: 14, delay: -5, drift: 7, art: LANTERN },

  { key: 'h-star', right: 5, top: 4, size: 22, rotate: -8, duration: 11, delay: -9, art: STAR },
  { key: 'h-heart', right: 19, top: 3.5, size: 20, rotate: 8, duration: 13, delay: -6, art: HEART },
  { key: 'h-spark-r', right: 12, top: 14.5, size: 13, rotate: -14, duration: 8, delay: -4, tone: 'gold', art: SPARKLE },
  { key: 'h-spark-b', right: 10, bottom: 4, size: 14, rotate: 10, duration: 10, delay: -2, tone: 'gold', drift: 7, art: SPARKLE },
];

/* Phones: the 2-up grid fills the width, so the marks live in the band
   above the heading and the strip below the closing line. */
const HELPS_MOBILE: Doodle[] = [
  { key: 'hm-moon', left: 4, top: 3, size: 20, rotate: -12, duration: 12, delay: -3, art: MOON },
  { key: 'hm-spark', right: 5, top: 3.5, size: 13, rotate: 8, duration: 9, delay: -6, tone: 'gold', art: SPARKLE },
  { key: 'hm-star', left: 5, bottom: 1, size: 18, rotate: -8, duration: 11, delay: -1, drift: 6, art: STAR },
  { key: 'hm-heart', right: 6, bottom: 1.2, size: 18, rotate: 8, duration: 13, delay: -8, drift: 6, art: HEART },
];

export function HelpsDoodles() {
  return (
    <div className="helps-doodles" aria-hidden="true">
      {render(HELPS_DESKTOP, 'desktop')}
      {render(HELPS_MOBILE, 'mobile')}
    </div>
  );
}

export function HeroDoodles() {
  return (
    <div className="hero-doodles" aria-hidden="true">
      {render(DESKTOP, 'desktop')}
      {render(MOBILE, 'mobile')}
    </div>
  );
}
