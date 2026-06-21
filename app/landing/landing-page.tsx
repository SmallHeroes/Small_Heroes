'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COMMON } from '@/content';
import type { LandingContent } from '@/content/landing';
import { CategoryChallengeCard } from '@/app/category-challenge-card';
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';
import { ROUTES } from '@/lib/routes';

/* Trust-band line icons (order matches L.trust.pillars: privacy · human review · Hebrew/age) */
const TRUST_ICONS = [
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
      <path d="M8.8 12.2l2.1 2.1 4.3-4.3" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.2 12S5.6 5.6 12 5.6 21.8 12 21.8 12 18.4 18.4 12 18.4 2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.2C10.1 5 7.8 4.4 5.2 4.4c-.9 0-1.4.3-1.4 1V18c0 .6.4.9 1.1.8 2.4-.4 4.6 0 7.1 1.5" />
      <path d="M12 6.2C13.9 5 16.2 4.4 18.8 4.4c.9 0 1.4.3 1.4 1V18c0 .6-.4.9-1.1.8-2.4-.4-4.6 0-7.1 1.5" />
      <path d="M12 6.2V21" />
    </svg>
  ),
];

type GalleryStyle = 'style01' | 'style02';

const GALLERY_STYLE01 = [
  '/Images/gallery/gallery-1.jpg',
  '/Images/gallery/gallery-2.jpg',
  '/Images/gallery/gallery-3.jpg',
  '/Images/gallery/gallery-4.jpg',
  '/Images/gallery/gallery-5.jpg',
  '/Images/gallery/gallery-6.jpg',
];

const GALLERY_STYLE02 = [
  '/Images/gallery/gallery-r-1.jpg',
  '/Images/gallery/gallery-r-2.jpg',
  '/Images/gallery/gallery-r-3.jpg',
  '/Images/gallery/gallery-r-4.jpg',
  '/Images/gallery/gallery-r-5.jpg',
  '/Images/gallery/gallery-r-6.jpg',
];

type LandingPageProps = {
  content: LandingContent;
  startHref: string;
  matrixCategories: MvpMatrixCategoryPayload[];
};

export default function LandingPage({ content: L, startHref, matrixCategories }: LandingPageProps) {
  const [galleryStyle, setGalleryStyle] = useState<GalleryStyle>('style01');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [navCtaHref, setNavCtaHref] = useState<string>(startHref);
  const [navCtaText, setNavCtaText] = useState(COMMON.navCta);

  const btnStyle01Ref = useRef<HTMLButtonElement>(null);
  const btnStyle02Ref = useRef<HTMLButtonElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const positionPill = useCallback((active: GalleryStyle) => {
    const pill = pillRef.current;
    const btn = active === 'style01' ? btnStyle01Ref.current : btnStyle02Ref.current;
    if (!pill || !btn) return;
    pill.style.left = `${btn.offsetLeft}px`;
    pill.style.width = `${btn.offsetWidth}px`;
  }, []);

  useEffect(() => {
    positionPill(galleryStyle);
  }, [galleryStyle, positionPill]);

  useEffect(() => {
    const onResize = () => positionPill(galleryStyle);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [galleryStyle, positionPill]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.user && !cancelled) {
          setNavCtaText('החשבון שלי');
          setNavCtaHref(ROUTES.myBooks);
        }
      } catch {
        /* auth optional on landing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Script src="/JS/gate.js" strategy="beforeInteractive" />

      <div className="landing-body">
        <header className="navbar">
          <div className="wrap">
            <Link href="/" className="logo" aria-label="גיבורים קטנים">
              <div className="logo-icon">
                <div className="logo-icon-sq" />
                <div className="logo-icon-dot" />
              </div>
              <div className="logo-text">
                <span className="logo-brand">{COMMON.brand}</span>
                <span className="logo-tagline">{COMMON.tagline}</span>
              </div>
            </Link>

            <nav className="nav-links">
              <a href="#how">איך זה עובד</a>
              <a href="#pricing">מחירים</a>
              <a href={ROUTES.myBooks}>הספרים שלי</a>
            </nav>

            <a href={navCtaHref} className="nav-cta" data-event="landing_start_click">
              {navCtaText}
            </a>
          </div>
        </header>

        <main>
          <section className="hero">
            <div className="wrap hero-wrap">
              <div className="hero-text">
                <div className="hero-badge">{L.hero.badge}</div>
                <h1 className="hero-h1">{L.hero.h1}</h1>
                <p className="hero-sub2">{L.hero.sub}</p>

                <ul className="hero-bullets">
                  {L.hero.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>

                <div className="hero-btns">
                  <a
                    href={startHref}
                    className="btn-primary"
                    data-event="landing_start_click"
                  >
                    {L.hero.ctaPrimary}
                  </a>
                  <a href="#sample" className="btn-light">
                    {L.hero.ctaSecondary}
                  </a>
                </div>

                <p className="hero-cta-note">{L.hero.ctaNote}</p>
              </div>

              <div className="hero-img-wrap">
                <div className="hero-glow" aria-hidden="true" />
                <img
                  src="/Images/hero-child-fox.png"
                  alt="ילד וחבר הסיפור"
                  className="hero-img"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          </section>

          <section className="section helps-section" id="helps">
            <div className="wrap">
              <h2 className="section-h2">{L.helps.h2}</h2>
              <p className="section-sub">{L.helps.sub}</p>
              <div className="mvp-challenge-grid mvp-challenge-grid--landing">
                {matrixCategories.map((slot) => (
                  <CategoryChallengeCard
                    key={slot.category}
                    slot={slot}
                    data-event="landing_challenge_view"
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="section sample-section" id="sample">
            <div className="wrap sample-wrap">
              <div className="sample-text">
                <div className="sample-kicker">{L.sample.kicker}</div>
                <h2 className="sample-h2">{L.sample.h2}</h2>
                <p className="sample-p">{L.sample.p1}</p>
                <p className="sample-caption">{L.sample.caption}</p>
                <a href={startHref} className="btn-primary" data-event="landing_start_click">
                  {L.sample.cta}
                </a>
              </div>

              <div className="sample-img-wrap sample-preview-wrap">
                {/* TODO: temporary placeholder — replace with a real generated book sample. */}
                <figure className="sample-book-illustration">
                  <img
                    src="/Images/Book.webp"
                    alt="המחשה — דוגמה לספר מותאם אישית"
                    loading="lazy"
                  />
                </figure>
              </div>
            </div>
          </section>

          <section className="section why-section">
            <div className="wrap">
              <h2 className="section-h2">{L.why.h2}</h2>
              <p className="section-sub">{L.why.sub}</p>

              <div className="why-grid">
                {L.why.cards.map((card) => (
                  <article key={card.title} className="why-card">
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="how-it-works-section how-section" id="how">
            <div className="wrap">
              <h2 className="section-h2">{L.how.h2}</h2>

              <div className="steps-row">
                {L.how.steps.map((step) => (
                  <article key={step.title} className="how-card">
                    <div className="how-step">
                      <div className="how-num">{step.title}</div>
                      <p>{step.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="gallery-section">
            <div className="wrap">
              <h2 className="gallery-h2">{L.gallery.h2}</h2>
              <p className="gallery-sub">{L.gallery.sub}</p>

              <div
                className="gallery-toggle"
                role="tablist"
                aria-label="סגנון איור בגלריה"
              >
                <button
                  ref={btnStyle01Ref}
                  type="button"
                  className={
                    'gallery-toggle-btn' + (galleryStyle === 'style01' ? ' is-active' : '')
                  }
                  role="tab"
                  aria-selected={galleryStyle === 'style01'}
                  onClick={() => setGalleryStyle('style01')}
                >
                  {L.gallery.toggleStyle01}
                </button>
                <button
                  ref={btnStyle02Ref}
                  type="button"
                  className={
                    'gallery-toggle-btn' + (galleryStyle === 'style02' ? ' is-active' : '')
                  }
                  role="tab"
                  aria-selected={galleryStyle === 'style02'}
                  onClick={() => setGalleryStyle('style02')}
                >
                  {L.gallery.toggleStyle02}
                </button>
                <span className="gallery-toggle-pill" ref={pillRef} />
              </div>
            </div>

            <div className="gallery-layers">
              <div
                className={
                  'gallery-track gallery-layer' +
                  (galleryStyle === 'style01' ? ' is-visible' : '')
                }
                aria-hidden={galleryStyle !== 'style01'}
              >
                {GALLERY_STYLE01.map((src) => (
                  <div key={src} className="gallery-card">
                    <img src={src} alt="עמוד מתוך ספר — מאוייר" loading="lazy" />
                  </div>
                ))}
              </div>

              <div
                className={
                  'gallery-track gallery-layer' +
                  (galleryStyle === 'style02' ? ' is-visible' : '')
                }
                aria-hidden={galleryStyle !== 'style02'}
              >
                {GALLERY_STYLE02.map((src) => (
                  <div key={src} className="gallery-card">
                    <img src={src} alt="עמוד מתוך ספר — ריאליסטי" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>

            {galleryStyle === 'style02' ? (
              <p className="gallery-style02-preview-note">{L.gallery.style02PreviewNote}</p>
            ) : null}

            <div className="wrap gallery-cta-wrap">
              <a href={startHref} className="btn-primary" data-event="landing_start_click">
                {L.gallery.cta}
              </a>
            </div>
          </section>

          <section className="trust-band" id="trust">
            <div className="wrap trust-band__inner">
              <header className="trust-band__header">
                <h2 className="trust-band__h2">{L.trust.h2}</h2>
              </header>
              <div className="trust-points">
                {L.trust.pillars.map((pillar, i) => (
                  <article key={pillar.title} className="trust-point">
                    <span className="trust-point__icon" aria-hidden="true">
                      {TRUST_ICONS[i] ?? pillar.icon}
                    </span>
                    <h3 className="trust-point__title">{pillar.title}</h3>
                    <p className="trust-point__text">{pillar.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="section pricing-section" id="pricing">
            <div className="wrap">
              <h2 className="section-h2">{L.pricing.h2}</h2>
              <p className="section-sub pricing-sub">{L.pricing.sub}</p>

              <div className="pricing-grid">
                {L.pricing.cards.map((card, index) => (
                  <article
                    key={card.direction}
                    className={'price-card' + (card.featured ? ' price-card--mid' : '')}
                  >
                    {'badge' in card && card.badge ? (
                      <div className="price-badge-floating">{card.badge}</div>
                    ) : null}
                    <div className="price-kicker">{card.kicker}</div>
                    <div className="price-name">{card.name}</div>
                    <div className="price-pages">{card.pages}</div>
                    <div className="price-desc">{card.desc}</div>
                    <ul className="price-features">
                      {card.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                    <div className="price-num">
                      ₪<span>{card.price}</span>
                    </div>
                    <a
                      href={startHref}
                      className={
                        (index === 1 ? 'btn-primary' : 'btn-outline') + ' price-btn'
                      }
                      data-event="landing_start_click"
                    >
                      {card.cta}
                    </a>
                  </article>
                ))}
              </div>

              <div className="pricing-note">{L.pricing.note}</div>
            </div>
          </section>

          <section className="section faq-section">
            <div className="wrap faq-wrap">
              <h2 className="section-h2">{L.faq.h2}</h2>
              <p className="section-sub faq-sub">{L.faq.sub}</p>

              <div className="faq-list">
                {L.faq.items.map((item, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div
                      key={item.q}
                      className={'faq-item' + (isOpen ? ' open' : '')}
                    >
                      <button
                        className="faq-q"
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      >
                        <span>{item.q}</span>
                        <span className="faq-arrow">▾</span>
                      </button>
                      <div className="faq-a">
                        <p>{item.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <footer className="footer footer--warm">
            <div className="wrap footer-inner">
              <h2 className="footer-h2">
                {L.footer.h2Line1}
                <br />
                {L.footer.h2Line2}
              </h2>
              <p className="footer-sub">{L.footer.sub}</p>

              <a href={startHref} className="btn-primary footer-cta" data-event="landing_start_click">
                {L.footer.cta}
              </a>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
