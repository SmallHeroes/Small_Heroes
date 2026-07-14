/**
 * gate.js — soft-launch site-password gate, ON-DEMAND (no auto-run on page load).
 *
 * Browsing/QA is OPEN everywhere — this overlay is shown ONLY when an action needs the site
 * password (currently: initiating payment in the wizard). It validates via POST /api/gate, which
 * sets the httpOnly `sh_access` cookie (30 days). Because that cookie is httpOnly it cannot be read
 * from JS — the REAL gate is server-side (the checkout endpoint requires `sh_access`); this overlay
 * just obtains the cookie on demand and resolves once the password is accepted.
 *
 * API:  window.ShGate.ensureAccess() → Promise<boolean>
 *   resolves true  = password accepted (cookie set) → caller may proceed
 *   resolves false = user dismissed (Esc / backdrop) → caller should abort quietly
 * Safe to call repeatedly; concurrent calls share the single in-flight overlay.
 *
 * Loaded on demand (dynamically, by the wizard's pay flow) — it is intentionally NOT included on any
 * page at load time, so no password popup ever appears while browsing.
 */
(function () {
  var OVERLAY_ID = 'sh-gate-overlay';
  var active = null; // in-flight promise → one overlay at a time

  function ensureAccess() {
    if (active) return active;

    active = new Promise(function (resolve) {
      var previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';

      var overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.innerHTML =
        '<div style="background:#fff;border-radius:20px;padding:48px 40px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(124,77,255,.1);text-align:center">' +
        '<h1 style="font-size:1.5rem;margin:0 0 8px;color:#7c4dff">Small Heroes</h1>' +
        '<p style="font-size:.95rem;color:#666;margin:0 0 24px">הזינו סיסמה כדי להמשיך לתשלום</p>' +
        '<input id="sh-gate-pw" type="password" placeholder="סיסמה" autocomplete="off" autofocus ' +
        'style="width:100%;padding:14px 16px;border:2px solid #e0d6f5;border-radius:12px;font-size:1.1rem;text-align:center;outline:none;font-family:inherit" />' +
        '<button id="sh-gate-btn" style="width:100%;padding:14px;margin-top:16px;background:#7c4dff;color:#fff;border:none;border-radius:12px;font-size:1.1rem;font-weight:600;cursor:pointer;font-family:inherit">כניסה</button>' +
        '<div id="sh-gate-err" style="color:#e53935;font-size:.9rem;margin-top:12px;display:none">סיסמה שגויה</div>' +
        '</div>';
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;' +
        'background:linear-gradient(135deg,#f8f6ff 0%,#f0e8ff 100%);font-family:Heebo,Arial,sans-serif';

      function cleanup(result) {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        document.documentElement.style.overflow = previousOverflow;
        active = null;
        resolve(result);
      }

      function onKey(e) {
        if (e.key === 'Escape') cleanup(false);
      }

      function mount() {
        if (!document.body) return setTimeout(mount, 10);
        document.body.appendChild(overlay);

        var pw = document.getElementById('sh-gate-pw');
        var btn = document.getElementById('sh-gate-btn');
        var err = document.getElementById('sh-gate-err');

        function submit() {
          err.style.display = 'none';
          btn.disabled = true;
          btn.textContent = '...';
          fetch('/api/gate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw.value }),
          })
            .then(function (r) {
              return r.json().catch(function () { return {}; });
            })
            .then(function (d) {
              if (d && d.ok) {
                cleanup(true);
              } else {
                err.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'כניסה';
                pw.value = '';
                pw.focus();
              }
            })
            .catch(function () {
              err.style.display = 'block';
              btn.disabled = false;
              btn.textContent = 'כניסה';
            });
        }

        btn.addEventListener('click', submit);
        pw.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') submit();
        });
        // Dismiss on backdrop (click outside the card) or Esc → resolve(false), caller aborts.
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) cleanup(false);
        });
        document.addEventListener('keydown', onKey);
        setTimeout(function () { try { pw.focus(); } catch (_) {} }, 30);
      }

      mount();
    });

    return active;
  }

  window.ShGate = { ensureAccess: ensureAccess };
})();
