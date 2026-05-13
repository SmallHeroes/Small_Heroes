/**
 * landing.js — Small Heroes landing page
 *
 * Binds CONTENT.he.landing text to the pre-existing HTML structure.
 * No rendering — structure lives in HTML. JS only sets textContent.
 *
 * Depends on: content.js (loaded first), bookHistory.js, analytics.js
 *
 * File: JS/landing.js
 */

// ─── Content alias ────────────────────────────────────────────────────────────
const L = CONTENT.he.landing;
const ROUTES = globalThis.SH_ROUTES || {
  home: '/',
  wizard: '/wizard',
  ready: '/ready',
};

// ─── Helper ───────────────────────────────────────────────────────────────────
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─── Content binding ──────────────────────────────────────────────────────────
function initLandingContent() {

  // ── Nav ──────────────────────────────────────────────────────────────────────
  setText('navBrand',   CONTENT.he.common.brand);
  setText('navTagline', CONTENT.he.common.tagline);
  setText('navCta',     CONTENT.he.common.navCta);

  // ── Hero ──────────────────────────────────────────────────────────────────────
  setText('heroBadge',        L.hero.badge);
  setText('heroH1',           L.hero.h1);
  setText('heroSub',          L.hero.sub);
  setText('heroBody',         L.hero.body);
  setText('heroCtaPrimary',   L.hero.ctaPrimary);
  setText('heroCtaSecondary', L.hero.ctaSecondary);
  L.hero.bullets.forEach((b, i) => setText('heroBullet' + i, b));

  // ── Gallery ───────────────────────────────────────────────────────────────────
  if (L.gallery) {
    setText('galleryH2',  L.gallery.h2);
    setText('gallerySub', L.gallery.sub);
    setText('galleryCta', L.gallery.cta);
    if (L.gallery.toggleIllustrated) setText('toggleIllustrated', L.gallery.toggleIllustrated);
    if (L.gallery.toggleRealistic) setText('toggleRealistic', L.gallery.toggleRealistic);
  }

  // ── Gallery style toggle (illustrated / watercolor) ─────
  (function initGalleryToggle() {
    const btnIllustrated = document.getElementById('toggleIllustrated');
    const btnRealistic   = document.getElementById('toggleRealistic');
    const pill           = document.getElementById('togglePill');
    const layerIllu      = document.getElementById('galleryTrackIllustrated');
    const layerReal      = document.getElementById('galleryTrackRealistic');
    if (!btnIllustrated || !btnRealistic || !pill || !layerIllu || !layerReal) return;

    const layers = [layerIllu, layerReal];

    function positionPill(btn) {
      pill.style.left  = btn.offsetLeft + 'px';
      pill.style.width = btn.offsetWidth + 'px';
    }
    positionPill(btnRealistic);

    function switchTo(style) {
      const map = {
        illustrated: btnIllustrated,
        realistic: btnRealistic,
      };
      const layerMap = {
        illustrated: layerIllu,
        realistic: layerReal,
      };
      const activeBtn = map[style] || btnRealistic;
      const showLayer = layerMap[style] || layerReal;

      [btnIllustrated, btnRealistic].forEach((b) => {
        const on = b === activeBtn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      positionPill(activeBtn);

      layers.forEach((layer) => {
        const visible = layer === showLayer;
        layer.classList.toggle('is-visible', visible);
        layer.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
    }

    btnIllustrated.addEventListener('click', () => switchTo('illustrated'));
    btnRealistic.addEventListener('click', () => switchTo('realistic'));

    window.addEventListener('resize', () => {
      const active =
        [btnIllustrated, btnRealistic].find((b) => b.classList.contains('is-active')) || btnRealistic;
      positionPill(active);
    });
  })();

  // ── Why ───────────────────────────────────────────────────────────────────────
  setText('whyH2',  L.why.h2);
  setText('whySub', L.why.sub);
  L.why.cards.forEach((c, i) => {
    setText('whyCard' + i + 'Title', c.title);
    setText('whyCard' + i + 'Body',  c.body);
  });

  // ── Sample ────────────────────────────────────────────────────────────────────
  setText('sampleKicker', L.sample.kicker);
  setText('sampleH2',     L.sample.h2);
  setText('sampleP2',     L.sample.p2);
  setText('sampleCta',    L.sample.cta);
  setText('sampleQuote',  L.sample.quote);

  // ── How ───────────────────────────────────────────────────────────────────────
  setText('howH2', L.how.h2);
  L.how.steps.forEach((s, i) => {
    setText('howStep' + i + 'Title', s.title);
    setText('howStep' + i + 'Body',  s.body);
  });

  // ── Pricing ───────────────────────────────────────────────────────────────────
  setText('pricingH2',   L.pricing.h2);
  setText('pricingSub',  L.pricing.sub);
  setText('pricingNote', L.pricing.note);
  L.pricing.cards.forEach((c, i) => {
    if (c.badge) setText('pricingCard' + i + 'Badge',  c.badge);
    setText('pricingCard' + i + 'Kicker',  c.kicker);
    setText('pricingCard' + i + 'Name',    c.name);
    setText('pricingCard' + i + 'Pages',   c.pages);
    setText('pricingCard' + i + 'Desc',    c.desc);
    setText('pricingCard' + i + 'Price',   c.price);
    setText('pricingCard' + i + 'Cta',     c.cta);
    c.features.forEach((f, j) => setText('pricingCard' + i + 'Feature' + j, f));
    const ctaEl = document.getElementById('pricingCard' + i + 'Cta');
    if (ctaEl) {
      const directionByCard = ['bedtime', 'adventure', 'fantasy'];
      const direction = directionByCard[i];
      if (direction) {
        ctaEl.setAttribute('href', `${ROUTES.wizard}?direction=${direction}`);
      }
    }
  });

  // ── FAQ ───────────────────────────────────────────────────────────────────────
  setText('faqH2',  L.faq.h2);
  setText('faqSub', L.faq.sub);
  L.faq.items.forEach((item, i) => {
    setText('faqItem' + i + 'Q', item.q);
    setText('faqItem' + i + 'A', item.a);
  });

  // FAQ toggle — event delegation (replaces removed inline onclick)
  const faqListEl = document.getElementById('faqList');
  if (faqListEl) {
    faqListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.faq-q');
      if (!btn) return;
      const faqItem = btn.closest('.faq-item');
      const isOpen  = faqItem.classList.contains('open');
      faqListEl.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
      if (!isOpen) faqItem.classList.add('open');
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  // h2 has two lines — split on the stored newline, bind each span separately
  const [h2Line1, h2Line2 = ''] = L.footer.h2.split('\n');
  setText('footerH2Line1',       h2Line1);
  setText('footerH2Line2',       h2Line2);
  setText('footerSub',           L.footer.sub);
  setText('footerCta',           L.footer.cta);
}

async function syncAuthNavState() {
  const navCtaEl = document.getElementById('navCta');
  if (!navCtaEl) return;
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.user) {
      navCtaEl.textContent = 'החשבון שלי';
      navCtaEl.setAttribute('href', ROUTES.myBooks || '/my-books');
      return;
    }
  } catch (_) {}
  navCtaEl.setAttribute('href', ROUTES.wizard || '/wizard');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initLandingContent();
syncAuthNavState();
