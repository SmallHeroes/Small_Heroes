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

  // ── Book history strip ────────────────────────────────────────────────────────
  setText('bookHistoryLabel', L.historyLabel);
  const clearBtnEl = document.getElementById('bookHistoryClear');
  if (clearBtnEl) clearBtnEl.setAttribute('aria-label', L.historyClearAriaLabel);

  // ── Hero ──────────────────────────────────────────────────────────────────────
  setText('heroBadge',        L.hero.badge);
  setText('heroH1',           L.hero.h1);
  setText('heroSub',          L.hero.sub);
  setText('heroBody',         L.hero.body);
  setText('heroCtaPrimary',   L.hero.ctaPrimary);
  setText('heroCtaSecondary', L.hero.ctaSecondary);
  setText('heroSocialProof',  L.hero.socialProof);
  L.hero.bullets.forEach((b, i) => setText('heroBullet' + i, b));

  // ── Gallery ───────────────────────────────────────────────────────────────────
  if (L.gallery) {
    setText('galleryH2',  L.gallery.h2);
    setText('gallerySub', L.gallery.sub);
    setText('galleryCta', L.gallery.cta);
  }

  // ── Gallery style toggle (crossfade between illustrated / realistic) ────────
  (function initGalleryToggle() {
    const btnIllustrated = document.getElementById('toggleIllustrated');
    const btnRealistic   = document.getElementById('toggleRealistic');
    const pill           = document.getElementById('togglePill');
    const layerIllu      = document.getElementById('galleryTrackIllustrated');
    const layerReal      = document.getElementById('galleryTrackRealistic');
    if (!btnIllustrated || !btnRealistic || !pill || !layerIllu || !layerReal) return;

    // Position pill initially on the active button
    function positionPill(btn) {
      pill.style.left  = btn.offsetLeft + 'px';
      pill.style.width = btn.offsetWidth + 'px';
    }
    positionPill(btnIllustrated);

    function switchTo(style) {
      const isIllustrated = style === 'illustrated';
      const activeBtn     = isIllustrated ? btnIllustrated : btnRealistic;
      const inactiveBtn   = isIllustrated ? btnRealistic : btnIllustrated;
      const showLayer     = isIllustrated ? layerIllu : layerReal;
      const hideLayer     = isIllustrated ? layerReal : layerIllu;

      activeBtn.classList.add('is-active');
      inactiveBtn.classList.remove('is-active');
      positionPill(activeBtn);

      showLayer.classList.add('is-visible');
      hideLayer.classList.remove('is-visible');
    }

    btnIllustrated.addEventListener('click', () => switchTo('illustrated'));
    btnRealistic.addEventListener('click',   () => switchTo('realistic'));

    // Recalculate pill position on resize
    window.addEventListener('resize', () => {
      const activeBtn = btnIllustrated.classList.contains('is-active') ? btnIllustrated : btnRealistic;
      positionPill(activeBtn);
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
  setText('sampleP1',     L.sample.p1);
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

// ─── Book history strip ───────────────────────────────────────────────────────
(function () {
  try {
    const history = getBookHistory();
    if (!history.length) return;

    const section  = document.getElementById('bookHistorySection');
    const listEl   = document.getElementById('bookHistoryList');
    const clearBtn = document.getElementById('bookHistoryClear');
    if (!section || !listEl || !clearBtn) return;

    function renderChips() {
      listEl.innerHTML = '';
      const entries = getBookHistory();

      entries.forEach(({ orderId, childName, title, accessKey }) => {
        const label = title || (childName
          ? L.bookByChild.replace('{name}', childName)
          : L.bookUnnamed);
        const keyParam = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
        const href  = `${ROUTES.ready}?orderId=${encodeURIComponent(orderId)}${keyParam}`;

        const chip = document.createElement('div');
        chip.className = 'book-history-chip';

        const link = document.createElement('a');
        link.href        = href;
        link.className   = 'book-history-chip-link';
        link.textContent = label;
        link.addEventListener('click', function () {
          track('book_reopened', { orderId });
        });

        const remove = document.createElement('button');
        remove.type      = 'button';
        remove.className = 'book-history-chip-remove';
        remove.setAttribute('aria-label', L.bookRemoveAriaLabel.replace('{label}', label));
        remove.textContent = '×';

        remove.addEventListener('click', (e) => {
          e.preventDefault();
          removeBookFromHistory(orderId);
          const remaining = getBookHistory();
          if (remaining.length === 0) {
            section.hidden = true;
          } else {
            renderChips();
          }
        });

        chip.appendChild(link);
        chip.appendChild(remove);
        listEl.appendChild(chip);
      });
    }

    renderChips();
    section.hidden = false;

    clearBtn.addEventListener('click', () => {
      clearBookHistory();
      section.hidden = true;
    });

  } catch (_) {}
})();

// ─── Boot ─────────────────────────────────────────────────────────────────────
initLandingContent();
syncAuthNavState();
