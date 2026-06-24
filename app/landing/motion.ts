const R = '[data-reveal]';
const H = '[data-reveal="hero"]';
const P = '[data-parallax="hero-img"]';

export function initLandingMotion(root?: HTMLElement | null): void {
  const el = root ?? document.querySelector<HTMLElement>('[data-motion="on"]');
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const nodes = el.querySelectorAll<HTMLElement>(R);
  const heroes = new Set(el.querySelectorAll(H));
  const show = (n: Element) => n.classList.add('is-visible');

  nodes.forEach((n) => {
    const d = n.getAttribute('data-reveal-delay');
    if (d) n.style.transitionDelay = `${Number(d)}ms`;
  });

  el.classList.add('motion-ready');
  requestAnimationFrame(() => heroes.forEach(show));

  const io = new IntersectionObserver(
    (es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      });
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.1 }
  );
  nodes.forEach((n) => {
    if (!heroes.has(n)) io.observe(n);
  });

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
