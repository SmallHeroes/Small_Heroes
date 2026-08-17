/**
 * HeroCollage — the three story beats, told in order.
 *
 * The hero used to be one flat export, so its three panels could only ever
 * arrive together. Guy supplied them separately, which lets the composition
 * DO what it depicts: the beats fade up one after another — the waiting
 * room, then meeting the friend, then walking out — so the arc reads without
 * a single caption.
 *
 * That ordering matters here beyond taste. The panels run left-to-right
 * while Hebrew reads right-to-left, so a still collage is entered at the
 * outcome and travelled backwards to the fear. Motion overrides reading
 * direction — the eye follows what appears — so the reveal is what makes the
 * sequence legible at all, and at rest the composition still leads with the
 * outcome as its largest, frontmost card.
 *
 * Motion is deliberately ONE thing: the whole collage tilts with the cursor
 * as a single object (initHeroTilt in motion.ts, on .hero-float). A round of
 * per-panel sparks, a light sweep, a star trail and a per-panel hover lift
 * were all tried and cut per Guy — each pulled attention off the pictures,
 * and two hover behaviours on one object fought each other.
 *
 * Layout is CSS, not a baked image: each beat is positioned as a percentage
 * of the frame, with a separate arrangement for phones. Under
 * prefers-reduced-motion the beats are simply present (landing.css).
 */

const BEATS = [
  {
    key: 'beat-1',
    src: '/Images/hero-beat-1.webp',
    alt: 'ילדה ממתינה במרפאה עם אמא, מוטרדת ממה שעומד לקרות',
  },
  {
    key: 'beat-2',
    src: '/Images/hero-beat-2.webp',
    alt: 'הילדה פוגשת את הארנב, החבר המלווה שלה בסיפור',
  },
  {
    key: 'beat-3',
    src: '/Images/hero-beat-3.webp',
    alt: 'הילדה יוצאת מהמרפאה גאה, עם פלסטר על הזרוע והארנב לצדה',
  },
];

export function HeroCollage() {
  return (
    /* data-parallax is the scroll-drift hook motion.ts looks for; it moved
       here from the old single <img> when the collage replaced it */
    <div className="hero-collage" data-parallax="hero-img">
      {BEATS.map((beat, i) => (
        <span key={beat.key} className="hero-beat" data-beat={i + 1}>
          <img
            className="hero-beat-img"
            src={beat.src}
            alt={beat.alt}
            /* the hero is the LCP element: the beats must not wait */
            loading="eager"
            decoding="async"
            fetchPriority={i === 2 ? 'high' : 'auto'}
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden';
            }}
          />
        </span>
      ))}
    </div>
  );
}
