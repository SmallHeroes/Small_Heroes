'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COMMON } from '@/content';
import type { LandingContent } from '@/content/landing';
import { CategoryChallengeCard } from '@/app/category-challenge-card';
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';
import { initLandingMotion } from './motion';
import { SiteHeader } from '@/app/components/SiteHeader';
import { AboutSection } from './about-section';
import { HeroDoodles, ValueDoodles, HelpsDoodles } from './hero-doodles';
import { HeroCollage } from './hero-collage';
import { CompanionSpotlight } from '@/app/components/CompanionSpotlight';
import { warmCompanionIdleVideos } from '@/lib/web/companion-idle-video';

type SpotlightState = {
  slot: MvpMatrixCategoryPayload;
  originRect: { x: number; y: number; width: number; height: number };
  originEl: HTMLElement | null;
};

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

/* A curved seam where the page changes world: the PREVIOUS section's colour
   dips into this one, so the handover reads as a page turn, not a band. */
function SectionWave({ fill }: { fill: string }) {
  return (
    <svg
      className="section-wave"
      viewBox="0 0 1440 56"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0,26 C180,52 360,4 640,18 C920,32 1120,6 1440,30 L1440,0 L0,0 Z" fill={fill} />
    </svg>
  );
}

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
  /* Companion Spotlight - home cards open the companion dialog instead of navigating. */
  const [spotlight, setSpotlight] = useState<SpotlightState | null>(null);

  const closeSpotlight = useCallback(() => {
    setSpotlight((current) => {
      current?.originEl?.focus?.();
      return null;
    });
  }, []);

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

  useEffect(() => initLandingMotion(), []);

  /* Warm the six idle clips at idle priority so a spotlight's video paints
     instantly (per Guy: only the video, no image-then-video flash). */
  useEffect(() => {
    warmCompanionIdleVideos(matrixCategories.map((slot) => slot.companion.image));
  }, [matrixCategories]);

  return (
    <>
      <div className="landing-body" data-motion="on">
        {/* 2026: thin scroll-progress bar — pure CSS scroll-timeline, no JS (falls back to hidden) */}
        <div className="scroll-progress" aria-hidden="true" />
        <SiteHeader variant="full" />

        <main>
          <section className="hero">
            <HeroDoodles />
            <div className="wrap hero-wrap">
              <div className="hero-text">
                <div className="hero-badge" data-reveal="hero" data-reveal-delay="0">{L.hero.badge}</div>
                <h1 className="hero-h1" data-reveal="hero" data-reveal-delay="60">
                  <span className="hero-h1-line">{L.hero.h1Line1}</span>{' '}
                  <span className="hero-h1-line hero-h1-line--accent">{L.hero.h1Line2}</span>
                </h1>
                <p className="hero-sub2" data-reveal="hero" data-reveal-delay="120">{L.hero.sub}</p>

                <div className="hero-btns" data-reveal="hero" data-reveal-delay="180">
                  <a
                    href={startHref}
                    className="btn-primary"
                    data-event="landing_start_click"
                  >
                    {L.hero.ctaPrimary}
                  </a>
                  {/* lands on the sample section — the book itself (a video of
                      it, once Guy's clip exists). The gallery is a look, not a
                      sample, so it is no longer the destination. */}
                  <a href="#sample" className="btn-light">
                    {L.hero.ctaSecondary}
                  </a>
                </div>

                {/* three short reassurances, dot-separated on one line (they
                    wrap to two on a phone rather than shrinking) */}
                <ul className="hero-cta-notes" data-reveal="hero" data-reveal-delay="240">
                  {L.hero.ctaNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>

              <div className="hero-img-wrap" data-reveal="scale" data-reveal-delay="120" data-tilt="hero">
                {/* Guy's three story beats, now separate files, so the collage
                    is composed in CSS and the beats can arrive IN ORDER —
                    fear, then the friend, then walking out. Desktop keeps the
                    3D cursor tilt (motion.ts, hover+fine-pointer only):
                    rotation lives on .hero-float, so it never fights the
                    per-panel reveal transforms. */}
                <div className="hero-float">
                  <HeroCollage />
                </div>
              </div>
            </div>
          </section>

          {/* מה מקבלים — the concrete promise, straight after the hero */}
          {/* the storybook sky continues here and fades out inside this
              section, so the field never stops at a seam (per Guy) */}
          <section className="section value-section" id="value">
            <ValueDoodles />
            <div className="wrap">
              <h2 className="section-h2" data-reveal="up">{L.value.h2}</h2>
              <p className="section-lede" data-reveal="up" data-reveal-delay="60">{L.value.lede}</p>

              <div className="value-grid">
                {L.value.items.map((item, index) => (
                  <article
                    key={item.title}
                    className="value-card"
                    data-reveal="up"
                    data-reveal-delay={String(100 + index * 70)}
                  >
                    <span className="value-card-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 12.5l4.5 4.5 10.5-11" />
                      </svg>
                    </span>
                    <h3 className="value-card-title">{item.title}</h3>
                    <p className="value-card-body">{item.body}</p>
                  </article>
                ))}
              </div>

            </div>
          </section>

          {/* the last section under the sky: the field runs on to here, and
              the dark room below takes over from it (per Guy) */}
          <section className="section helps-section" id="helps">
            <HelpsDoodles />
            <div className="wrap">
              <h2 className="section-h2" data-reveal="up">{L.helps.h2}</h2>
              <p className="section-lede" data-reveal="up" data-reveal-delay="50">{L.helps.lede}</p>
              <div className="mvp-challenge-grid mvp-challenge-grid--landing">
                {matrixCategories.map((slot, index) => {
                  {/* Landing-side marketing copy per category; the wizard keeps
                      the matrix source untouched. */}
                  {/* one short emotional line per card; the grey description
                      paragraph was dropped per Guy (people don't read it) */}
                  const marketing = L.helps.cards[slot.category];
                  const displaySlot = { ...slot, oneLiner: '' };
                  return (
                    <CategoryChallengeCard
                      key={slot.category}
                      slot={displaySlot}
                      lead={marketing?.lead}
                      as="button"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setSpotlight({
                          slot: displaySlot,
                          originRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                          originEl: event.currentTarget,
                        });
                      }}
                      data-event="landing_companion_spotlight_open"
                      data-category={slot.category}
                      data-reveal="up"
                      data-reveal-delay={String(80 + index * 55)}
                    />
                  );
                })}
              </div>
              <p className="helps-closing" data-reveal="fade" data-reveal-delay="380">{L.helps.closing}</p>
            </div>
          </section>

          {/* TRIAL per Guy: the charcoal "reading room" break in the page's
              brightness — drop the --dark modifier to go back to white */}
          <section className="section sample-section sample-section--dark" id="sample">
            <SectionWave fill="#fff" />
            <div className="wrap sample-wrap">
              <div className="sample-text">
                <div className="sample-kicker" data-reveal="up">{L.sample.kicker}</div>
                <h2 className="sample-h2" data-reveal="up" data-reveal-delay="60">
                  {L.sample.h2Line1}
                  <br />
                  <span className="mk-sweep">{L.sample.h2Line2}</span>
                </h2>
                <p className="sample-p" data-reveal="up" data-reveal-delay="120">{L.sample.p1}</p>
                <p className="sample-p sample-p--soft" data-reveal="up" data-reveal-delay="160">{L.sample.p2}</p>

                {/* The CTA that pointed at the gallery is gone (per Guy: the
                    gallery is show, not a sample). The sample IS this section —
                    the book below, and a video of it once Guy's clip lands. */}
              </div>

              <div className="sample-img-wrap sample-preview-wrap" data-reveal="scale" data-reveal-delay="120">
                {/* TODO: temporary placeholder — replace with a real generated book sample. */}
                <figure className="sample-book-illustration">
                  <img
                    src="/Images/Book.webp"
                    alt="המחשה - דוגמה לספר מותאם אישית"
                    loading="lazy"
                  />
                </figure>
              </div>
            </div>
          </section>

          <section className="gallery-section" id="gallery">
            <SectionWave fill="#2b2b31" />
            <div className="wrap">
              <h2 className="gallery-h2" data-reveal="up">{L.gallery.h2}</h2>
              <p className="gallery-sub" data-reveal="up" data-reveal-delay="60">{L.gallery.sub}</p>

              <div
                className="gallery-toggle"
                role="tablist"
                aria-label="סגנון איור בגלריה"
                data-reveal="fade"
                data-reveal-delay="120"
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

            <div className="gallery-layers" data-reveal="fade" data-reveal-delay="180">
              <div
                className={
                  'gallery-track gallery-layer' +
                  (galleryStyle === 'style01' ? ' is-visible' : '')
                }
                aria-hidden={galleryStyle !== 'style01'}
              >
                {GALLERY_STYLE01.map((src) => (
                  <div key={src} className="gallery-card">
                    <img src={src} alt="עמוד מתוך ספר - מאוייר" loading="lazy" />
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
                    <img src={src} alt="עמוד מתוך ספר - ריאליסטי" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>

            {galleryStyle === 'style02' ? (
              <p className="gallery-style02-preview-note">{L.gallery.style02PreviewNote}</p>
            ) : null}

            <div className="wrap gallery-cta-wrap" data-reveal="up" data-reveal-delay="200">
              <a href={startHref} className="btn-primary" data-event="landing_start_click">
                {L.gallery.cta}
              </a>
            </div>
          </section>


          <section className="how-it-works-section how-section" id="how">
            <div className="wrap">
              <h2 className="section-h2" data-reveal="up">{L.how.h2}</h2>
              <p className="section-lede" data-reveal="up" data-reveal-delay="60">{L.how.lede}</p>

              <div className="steps-row">
                {/* the dashed trail that turns three cards into one journey */}
                <svg
                  className="how-trail"
                  viewBox="0 0 1000 60"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M6,50 C280,2 720,2 994,50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray="0.5 13"
                  />
                </svg>
                {L.how.steps.map((step, index) => {
                  /* presentation only: the "N. " prefix in the copy becomes a
                     number chip; the content file stays untouched */
                  const numbered = step.title.match(/^(\d+)\.\s*(.*)$/);
                  return (
                    <article key={step.title} className="how-card" data-reveal="up" data-reveal-delay={String(100 + index * 90)}>
                      <div className="how-step">
                        <span className="how-step-num" aria-hidden="true">{numbered ? numbered[1] : index + 1}</span>
                        <div className="landing-card-title">{numbered ? numbered[2] : step.title}</div>
                        <p className="landing-card-body">{step.body}</p>
                        {'emphasis' in step && step.emphasis ? (
                          <p className="how-step-emphasis">{step.emphasis}</p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="how-foot" data-reveal="up" data-reveal-delay="300">
                <p className="how-closing">{L.how.closing}</p>
                <a href={startHref} className="btn-primary" data-event="landing_start_click">
                  {L.how.cta}
                </a>
              </div>
            </div>
          </section>

          {/* למה הסיפורים שלנו עובדים אחרת — the story-craft argument */}
          <section className="section why-section" id="why">
            <div className="wrap">
              <h2 className="section-h2" data-reveal="up">{L.why.h2}</h2>
              <p className="section-lede" data-reveal="up" data-reveal-delay="50">{L.why.lede}</p>
              <p className="why-sub" data-reveal="up" data-reveal-delay="80">{L.why.sub}</p>

              <div className="why-grid">
                {L.why.cards.map((card, index) => (
                  <article
                    key={card.title}
                    className="why-card"
                    data-reveal="up"
                    data-reveal-delay={String(120 + index * 80)}
                  >
                    <span className="why-card-index" aria-hidden="true">{index + 1}</span>
                    <h3 className="why-card-title">{card.title}</h3>
                    <p className="why-card-body">{card.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="trust-band" id="trust">
            <div className="wrap trust-band__inner">
              <header className="trust-band__header">
                <h2 className="trust-band__h2" data-reveal="up">{L.trust.h2}</h2>
                <p className="section-lede" data-reveal="up" data-reveal-delay="50">{L.trust.lede}</p>
                <p className="trust-band__sub" data-reveal="up" data-reveal-delay="80">{L.trust.sub}</p>
              </header>
              <div className="trust-points">
                {L.trust.pillars.map((pillar, i) => (
                  <article key={pillar.title} className="trust-point" data-reveal="up" data-reveal-delay={String(80 + i * 80)}>
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

          {/* מי מאחורי זה + הגישה שלנו — אחרי אמון-המוצר, לפני המחירים */}
          <AboutSection about={L.about} />

          <section className="early-stage-band" aria-label="הודעת השקה">
            <div className="wrap early-stage-band__inner">
              <p className="early-stage-band__line" data-reveal="fade">{L.earlyStage.line}</p>
            </div>
          </section>

          <section className="section pricing-section" id="pricing">
            <div className="wrap">
              <div className="pricing-eyebrow" data-reveal="up">{L.pricing.kicker}</div>
              <h2 className="section-h2" data-reveal="up" data-reveal-delay="40">{L.pricing.h2}</h2>
              <p className="section-sub pricing-sub" data-reveal="up" data-reveal-delay="80">{L.pricing.sub}</p>

              <div className="pricing-grid">
                {/* Each card opens the flow (per Guy, laying the ground for
                    production). The direction rides along in the URL so the
                    handoff is already correct the day the wizard honours it —
                    today wizard.js deliberately clears it and the reader picks
                    the direction actively in step 8. */}
                {L.pricing.cards.map((card, index) => (
                  <article
                    key={card.direction}
                    className={'price-card' + (card.featured ? ' price-card--mid' : '')}
                    data-reveal="scale"
                    data-reveal-delay={String(100 + index * 90)}
                  >
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
                      <span className="price-now">
                        ₪<span className="price-now-digits">{card.price}</span>
                      </span>
                    </div>

                    <a
                      className="btn-primary price-cta"
                      href={`${startHref}${startHref.includes('?') ? '&' : '?'}direction=${card.direction}`}
                      data-event="landing_pricing_cta"
                      data-direction={card.direction}
                    >
                      {card.cta}
                    </a>
                  </article>
                ))}
              </div>


              <div className="pricing-note" data-reveal="fade" data-reveal-delay="360">{L.pricing.note}</div>
            </div>
          </section>

          <section className="section faq-section">
            <div className="wrap faq-wrap">
              <h2 className="section-h2" data-reveal="up">{L.faq.h2}</h2>
              <p className="section-sub faq-sub" data-reveal="up" data-reveal-delay="60">{L.faq.sub}</p>

              <div className="faq-list">
                {L.faq.items.map((item, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div
                      key={item.q}
                      // className stays CONSTANT so React never overwrites the imperatively-added `.is-visible`
                      // reveal class (motion.ts) on the open-toggle re-render — that overwrite made the answer open
                      // then vanish. Open state rides on a data attribute React can toggle without touching className.
                      className="faq-item"
                      data-open={isOpen ? '' : undefined}
                      data-reveal="up"
                      data-reveal-delay={String(60 + index * 40)}
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
            <SectionWave fill="#f7f2fe" />
            <div className="wrap footer-inner">
              <h2 className="footer-h2" data-reveal="up">
                {L.footer.h2Line1}
                <br />
                <span className="mk-sweep">{L.footer.h2Line2}</span>
              </h2>
              <p className="footer-sub" data-reveal="up" data-reveal-delay="80">{L.footer.sub}</p>

              <a href={startHref} className="btn-primary footer-cta" data-event="landing_start_click" data-reveal="up" data-reveal-delay="160">
                {L.footer.cta}
              </a>
            </div>
          </footer>
        </main>
        {spotlight ? (
          <CompanionSpotlight
            slot={spotlight.slot}
            originRect={spotlight.originRect}
            onClose={closeSpotlight}
          />
        ) : null}
      </div>
    </>
  );
}
