/* SmallHeroes showcase — minimal vanilla interactions.
   Everything here is progressive enhancement: with JS disabled the page
   stays fully readable (reveals default to visible, demos show a static state). */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var body = document.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Motion switch ─────────────────────────────────────────── */
  var motionSwitch = document.getElementById('motionSwitch');
  if (reduced) {
    body.setAttribute('data-motion', 'off');
    if (motionSwitch) motionSwitch.setAttribute('aria-pressed', 'false');
  }
  if (motionSwitch) {
    motionSwitch.addEventListener('click', function () {
      var on = body.getAttribute('data-motion') !== 'off';
      body.setAttribute('data-motion', on ? 'off' : 'on');
      motionSwitch.setAttribute('aria-pressed', String(!on));
    });
  }

  /* ── Reveal on scroll ──────────────────────────────────────── */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ── Scrollspy for chapter nav ─────────────────────────────── */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.topbar-nav a'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          navLinks.forEach(function (a) {
            a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id);
          });
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ── Motion token demos ────────────────────────────────────── */
  var DEMO_MS = { fast: 140, base: 200, slow: 280, page: 400 };
  document.querySelectorAll('[data-motion-demo]').forEach(function (card) {
    card.addEventListener('click', function () {
      var ms = DEMO_MS[card.getAttribute('data-motion-demo')] || 200;
      card.style.setProperty('--demo-dur', ms + 'ms');
      card.classList.remove('play');
      void card.offsetWidth; /* restart animation */
      card.classList.add('play');
    });
  });

  /* ── Mini wizard demo (step transition + pills) ────────────── */
  var wd = document.getElementById('wizardDemo');
  if (wd) {
    var step = 1;
    var stepLabel = wd.querySelector('.wd-step');
    var pills = wd.querySelectorAll('.wd-pill');
    var panels = [wd.querySelector('.wd-panel--1'), wd.querySelector('.wd-panel--2')];
    var back = document.getElementById('wdBack');
    var next = document.getElementById('wdNext');
    var render = function () {
      stepLabel.textContent = String(step);
      panels[0].hidden = step !== 1;
      panels[1].hidden = step !== 2;
      pills.forEach(function (p, i) {
        p.className = 'wd-pill' + (i + 1 < step ? ' done' : i + 1 === step ? ' act' : '');
      });
      back.disabled = step === 1;
      next.textContent = step === 2 ? 'סיימנו ✓' : 'ממשיכים';
    };
    next.addEventListener('click', function () {
      step = step === 1 ? 2 : 1; /* loop the demo */
      render();
    });
    back.addEventListener('click', function () {
      if (step > 1) { step -= 1; render(); }
    });
    wd.addEventListener('click', function (e) {
      var opt = e.target.closest('.wd-opt');
      if (!opt) return;
      opt.parentElement.querySelectorAll('.wd-opt').forEach(function (o) { o.classList.remove('selected'); });
      opt.classList.add('selected');
    });
    render();
  }

  /* ── AI personalization demo (name → title, topic → companion) ─ */
  var aiName = document.getElementById('aiName');
  var aiTitle = document.getElementById('aiBookTitle');
  var aiSub = document.getElementById('aiBookSub');
  var aiCompanion = document.getElementById('aiCompanion');
  var aiBook = document.querySelector('#aiDemo .ai-book');
  if (aiName && aiTitle) {
    var TOPICS = {
      night: { title: 'הלילה של {name}', companion: 'השועל אוּרי', img: 'assets/companion-uri.webp' },
      social: { title: 'החברים של {name}', companion: 'הפנדה עֲנָת', img: 'assets/companion-anat.webp' },
    };
    var DIRS = {
      bedtime: { label: 'סיפור לפני שינה', pages: 16 },
      adventure: { label: 'הרפתקה', pages: 24 },
    };
    var update = function () {
      var name = (aiName.value || '').trim() || 'הגיבור/ה';
      var topicEl = document.querySelector('input[name="aiTopic"]:checked');
      var dirEl = document.querySelector('input[name="aiDir"]:checked');
      var topic = TOPICS[topicEl ? topicEl.value : 'night'];
      var dir = DIRS[dirEl ? dirEl.value : 'bedtime'];
      aiTitle.textContent = topic.title.replace('{name}', name);
      aiSub.textContent = dir.label + ' עם ' + topic.companion + ' · ' + dir.pages + ' עמודים';
      if (aiCompanion.getAttribute('src') !== topic.img) aiCompanion.setAttribute('src', topic.img);
      if (aiBook) {
        aiBook.classList.remove('swap');
        void aiBook.offsetWidth;
        aiBook.classList.add('swap');
      }
    };
    aiName.addEventListener('input', update);
    document.querySelectorAll('input[name="aiTopic"], input[name="aiDir"]').forEach(function (r) {
      r.addEventListener('change', update);
    });
  }

  /* ── Signature 2: speaking validation demo ─────────────────── */
  var valDemo = document.getElementById('valDemo');
  if (valDemo) {
    var valInput = document.getElementById('valName');
    var valMsg = document.getElementById('valMsg');
    valDemo.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valInput.value.trim()) {
        valMsg.hidden = false;
        valInput.setAttribute('aria-invalid', 'true');
        valInput.classList.add('has-error');
        if (body.getAttribute('data-motion') !== 'off') {
          valInput.classList.remove('shake');
          void valInput.offsetWidth;
          valInput.classList.add('shake');
        }
        valInput.focus();
      } else {
        valMsg.hidden = true;
        valInput.classList.remove('has-error');
        valInput.removeAttribute('aria-invalid');
        valDemo.reset();
      }
    });
    valInput.addEventListener('input', function () {
      valMsg.hidden = true;
      valInput.classList.remove('has-error', 'shake');
      valInput.removeAttribute('aria-invalid');
    });
  }

  /* ── Signature 3: price follows choice ─────────────────────── */
  var pdbAmount = document.getElementById('pdbAmount');
  if (pdbAmount) {
    document.querySelectorAll('input[name="sigPrice"]').forEach(function (r) {
      r.addEventListener('change', function () {
        pdbAmount.textContent = '₪' + r.value;
        pdbAmount.classList.remove('tick');
        void pdbAmount.offsetWidth;
        pdbAmount.classList.add('tick');
      });
    });
  }
})();
