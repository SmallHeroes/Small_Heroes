const R = '[data-reveal]';
const P = '[data-parallax="hero-img"]';
const MAX_STAGGER_MS = 320;
const SAFETY_REVEAL_MS = 1200;

/** Cap stagger so long sibling lists never lag behind scroll. */
export function capRevealDelay(ms: number): number {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_STAGGER_MS);
}

function revealNode(n: HTMLElement, io?: IntersectionObserver): void {
  if (n.classList.contains('is-visible')) return;
  n.classList.add('is-visible');
  io?.unobserve(n);
}

function isRoughlyInView(n: Element): boolean {
  const r = n.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return r.top < vh * 0.92 && r.bottom > 0;
}

function onRevealTransitionEnd(e: TransitionEvent): void {
  const t = e.target;
  if (!(t instanceof HTMLElement) || !t.matches(R)) return;
  if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
    t.style.willChange = '';
  }
}

export function initLandingMotion(root?: HTMLElement | null): void {
  const el = root ?? document.querySelector<HTMLElement>('[data-motion="on"]');
  if (!el) return;

  const nodes = el.querySelectorAll<HTMLElement>(R);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach((n) => n.classList.add('is-visible'));
    return;
  }

  document.documentElement.classList.add('js-reveal');

  nodes.forEach((n) => {
    const raw = n.getAttribute('data-reveal-delay');
    const delayMs = capRevealDelay(raw ? Number(raw) : 0);
    n.style.transitionDelay = `${delayMs}ms`;
    n.addEventListener('transitionend', onRevealTransitionEnd);
  });

  el.classList.add('motion-ready');

  const io = new IntersectionObserver(
    (es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        revealNode(e.target as HTMLElement, io);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  );

  // Above-the-fold: reveal synchronously so hero/first screen never flashes blank.
  nodes.forEach((n) => {
    if (isRoughlyInView(n)) revealNode(n, io);
  });

  nodes.forEach((n) => {
    if (!n.classList.contains('is-visible')) io.observe(n);
  });

  // Fail-safe, NEAR-VIEWPORT ONLY (2026 fix): the old timer revealed EVERYTHING after 1.2s, so by the time the
  // user scrolled, every section below the fold was already visible — scroll reveals never played. Now the timer
  // only rescues nodes within ~1.5 screens (nothing near the fold can ever stay stuck hidden); distant sections
  // keep their IntersectionObserver-driven reveal, so scrolling actually animates.
  window.setTimeout(() => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    nodes.forEach((n) => {
      if (n.classList.contains('is-visible')) return;
      if (n.getBoundingClientRect().top < vh * 1.5) revealNode(n, io);
    });
  }, SAFETY_REVEAL_MS);

  // Scroll rescue (all pointers): anything actually ON screen must never stay hidden. The IO trims the bottom
  // 12% of the viewport, which can strand the LAST elements near the page end (e.g. the footer CTA — visible,
  // clickable, but opacity:0 forever). rAF-throttled sweep of the remaining hidden nodes.
  let rescueRaf = 0;
  const rescueOnScreen = () => {
    if (rescueRaf) return;
    rescueRaf = requestAnimationFrame(() => {
      rescueRaf = 0;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      nodes.forEach((n) => {
        if (n.classList.contains('is-visible')) return;
        const r = n.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) revealNode(n, io);
      });
    });
  };
  addEventListener('scroll', rescueOnScreen, { passive: true });

  if (!window.matchMedia('(pointer: fine)').matches) return;

  /* The tilt is set up BEFORE the parallax, and deliberately so: it used to
     sit after the `if (!img) return` below, which meant the whole hero lean
     silently died the day the single hero image was replaced by the CSS
     collage and the parallax hook went with it. The two effects are
     independent, so neither may gate the other. */
  initHeroTilt(el);

  const img = el.querySelector<HTMLElement>(P);
  if (!img) return;
  let t = 0;
  const onScroll = () => {
    if (t) return;
    t = requestAnimationFrame(() => {
      t = 0;
      img.style.transform = `translate3d(0,${Math.min(scrollY * 0.06, 28)}px,0)`;
    });
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

/**
 * The hero WOW beat: the story strip is a held card that leans toward the
 * cursor (max ~4.5deg) and breathes a gentle bob when the cursor is away.
 * Desktop-only (hover + fine pointer; reduced-motion never reaches here).
 * Rotation lives on .hero-float; the CSS float animation is retired in its
 * favor so the two never fight over one transform.
 */
function initHeroTilt(el: HTMLElement): void {
  if (!window.matchMedia('(hover: hover)').matches) return;
  const wrap = el.querySelector<HTMLElement>('[data-tilt="hero"]');
  const card = wrap?.querySelector<HTMLElement>('.hero-float');
  if (!wrap || !card) return;

  card.style.animation = 'none';
  card.style.willChange = 'transform';

  const MAX_DEG = 4.5;
  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  let curBob = 0;
  let hovering = false;
  let bobPhase = 0;

  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;   // -0.5..0.5
    const ny = (e.clientY - r.top) / r.height - 0.5;
    hovering = true;
    targetY = nx * MAX_DEG * 2;    // rotateY follows horizontal travel
    targetX = -ny * MAX_DEG * 2;   // rotateX follows vertical travel
  });
  wrap.addEventListener('pointerleave', () => {
    hovering = false;
    targetX = 0;
    targetY = 0;
  });

  const tick = () => {
    bobPhase += 1 / 60;
    const idleBob = hovering ? 0 : Math.sin(bobPhase * 0.9) * 5;
    const idleSway = hovering ? 0 : Math.sin(bobPhase * 0.55) * 0.5;
    curX += (targetX - curX) * 0.085;
    curY += (targetY + idleSway - curY) * 0.085;
    curBob += (idleBob - curBob) * 0.06;
    card.style.transform = `rotateX(${curX.toFixed(3)}deg) rotateY(${curY.toFixed(3)}deg) translate3d(0, ${curBob.toFixed(2)}px, 0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
