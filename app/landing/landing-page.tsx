'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COMMON } from '@/content';
import type { LandingContent } from '@/content/landing';
import { ROUTES } from '@/lib/routes';

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

const FOX_URI_PREVIEW = [
  { src: '/marketing/fox-uri-preview/cover.png', alt: 'כריכת ספר לדוגמה — אוּרי' },
  { src: '/marketing/fox-uri-preview/p5.png', alt: 'עמוד מהספר — רגע בדרך' },
  { src: '/marketing/fox-uri-preview/p10.png', alt: 'עמוד מהספר — משחק' },
  { src: '/marketing/fox-uri-preview/p12.png', alt: 'עמוד מהספר — סיום' },
] as const;

type LandingPageProps = {
  content: LandingContent;
  startHref: string;
};

export default function LandingPage({ content: L, startHref }: LandingPageProps) {
  const [galleryStyle, setGalleryStyle] = useState<GalleryStyle>('style02');
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
                <div className="hero-glow" />
                <img
                  src="/Images/HeroIllustrated.png"
                  alt="ילד גיבור"
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
              <div className="why-grid helps-grid">
                {L.helps.cards.map((card) => (
                  <article key={card.topicId} className="why-card helps-card">
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
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

            <div className="wrap gallery-cta-wrap">
              <a href={startHref} className="btn-primary" data-event="landing_start_click">
                {L.gallery.cta}
              </a>
            </div>
          </section>

          <section className="section sample-section" id="sample">
            <div className="wrap sample-wrap">
              <div className="sample-text">
                <div className="sample-kicker">{L.sample.kicker}</div>
                <h2 className="sample-h2">{L.sample.h2}</h2>
                <p className="sample-p">{L.sample.p1}</p>
                <p className="sample-p">{L.sample.p2}</p>
                <p className="sample-quote">{L.sample.quote}</p>
                <a href={startHref} className="btn-primary" data-event="landing_start_click">
                  {L.sample.cta}
                </a>
              </div>

              <div className="sample-img-wrap sample-preview-wrap">
                <p className="sample-kicker">הצצה מספר לדוגמה</p>
                <p className="sample-p sample-preview-note">
                  כך נראה ספר אחד שיצרנו — כל ספר נבנה מחדש לפי הילד/ה שלכם.
                </p>
                <div className="gallery-track sample-preview-track">
                  {FOX_URI_PREVIEW.map((frame) => (
                    <div key={frame.src} className="gallery-card">
                      <img src={frame.src} alt={frame.alt} loading="lazy" />
                    </div>
                  ))}
                </div>
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

          <section className="trust-band" id="trust">
            <div className="wrap trust-band__inner">
              <header className="trust-band__header">
                <h2 className="trust-band__h2">{L.trust.h2}</h2>
                <p className="trust-band__sub">{L.trust.sub}</p>
              </header>
              <div className="trust-points">
                <div className="trust-point">
                  <span className="trust-point__icon" aria-hidden="true">
                    📷
                  </span>
                  <h3 className="trust-point__title">{L.trust.photoTitle}</h3>
                  <p className="trust-point__text">{L.trust.photoBody}</p>
                </div>
                <div className="trust-point">
                  <span className="trust-point__icon" aria-hidden="true">
                    ✨
                  </span>
                  <h3 className="trust-point__title">{L.trust.qcTitle}</h3>
                  <p className="trust-point__text">{L.trust.qcBody}</p>
                </div>
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
