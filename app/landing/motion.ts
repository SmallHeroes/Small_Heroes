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

  window.setTimeout(() => {
    nodes.forEach((n) => {
      if (!n.classList.contains('is-visible')) revealNode(n, io);
    });
  }, SAFETY_REVEAL_MS);

  if (!window.matchMedia('(pointer: fine)').matches) return;
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
