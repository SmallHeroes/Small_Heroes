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

export function HeroDoodles() {
  return (
    <div className="hero-doodles" aria-hidden="true">
      {render(DESKTOP, 'desktop')}
      {render(MOBILE, 'mobile')}
    </div>
  );
}
