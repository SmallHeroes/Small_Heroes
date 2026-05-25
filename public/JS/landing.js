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
  setText('heroSocialProof', L.hero.socialProof);
  setText('heroTrustBadge',  L.hero.trustBadge);
  setText('heroCtaNote',     L.hero.ctaNote);
  L.hero.bullets.forEach((b, i) => setText('heroBullet' + i, b));

  // ── Helps (מתי זה מתאים?) ───────────────────────────────────────────────────
  if (L.helps) {
    setText('helpsH2',  L.helps.h2);
    setText('helpsSub', L.helps.sub);
    const helpsGrid = document.getElementById('helpsGrid');
    if (helpsGrid && L.helps.cards) {
      helpsGrid.innerHTML = '';
      L.helps.cards.forEach((card) => {
        const article = document.createElement('article');
        article.className = 'why-card helps-card';
        const h3 = document.createElement('h3');
        h3.textContent = card.title;
        const p = document.createElement('p');
        p.textContent = card.body;
        article.appendChild(h3);
        article.appendChild(p);
        helpsGrid.appendChild(article);
      });
    }
  }

  // ── Trust & Privacy ─────────────────────────────────────────────────────────
  if (L.trust) {
    setText('trustH2',  L.trust.h2);
    setText('trustSub', L.trust.sub);
    setText('trustPhotoTitle',       L.trust.photoTitle);
    setText('trustPhotoBody',        L.trust.photoBody);
    setText('trustQcTitle',          L.trust.qcTitle);
    setText('trustQcBody',           L.trust.qcBody);
  }

  // ── Gallery ───────────────────────────────────────────────────────────────────
  if (L.gallery) {
    setText('galleryH2',  L.gallery.h2);
    setText('gallerySub', L.gallery.sub);
    setText('galleryCta', L.gallery.cta);
    if (L.gallery.toggleStyle01) setText('toggleStyle01', L.gallery.toggleStyle01);
    if (L.gallery.toggleStyle02) setText('toggleStyle02', L.gallery.toggleStyle02);
  }

  // ── Gallery style toggle (style01 / style02) ─────
  (function initGalleryToggle() {
    const btnStyle01 = document.getElementById('toggleStyle01');
    const btnStyle02 = document.getElementById('toggleStyle02');
    const pill       = document.getElementById('togglePill');
    const layer01    = document.getElementById('galleryTrackStyle01');
    const layer02    = document.getElementById('galleryTrackStyle02');
    if (!btnStyle01 || !btnStyle02 || !pill || !layer01 || !layer02) return;

    const layers = [layer01, layer02];

    function positionPill(btn) {
      pill.style.left  = btn.offsetLeft + 'px';
      pill.style.width = btn.offsetWidth + 'px';
    }
    positionPill(btnStyle02);

    function switchTo(style) {
      const map = {
        style01: btnStyle01,
        style02: btnStyle02,
      };
      const layerMap = {
        style01: layer01,
        style02: layer02,
      };
      const activeBtn = map[style] || btnStyle02;
      const showLayer = layerMap[style] || layer02;

      [btnStyle01, btnStyle02].forEach((b) => {
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

    btnStyle01.addEventListener('click', () => switchTo('style01'));
    btnStyle02.addEventListener('click', () => switchTo('style02'));

    window.addEventListener('resize', () => {
      const active =
        [btnStyle01, btnStyle02].find((b) => b.classList.contains('is-active')) || btnStyle02;
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
  const sampleP1 = document.getElementById('sampleP1');
  if (sampleP1 && L.sample.p1) setText('sampleP1', L.sample.p1);
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
