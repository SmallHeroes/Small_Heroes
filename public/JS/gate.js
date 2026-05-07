/**
 * gate.js — Client-side QA password gate
 *
 * Include this script BEFORE any other JS in protected pages.
 * If the user hasn't entered the correct password, shows a
 * fullscreen overlay and blocks interaction.
 *
 * Password is validated server-side via /api/gate.
 * Cookie `sh_access` persists for 30 days.
 */
(function () {
  // Skip gate on localhost / dev
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return;

  // Check cookie first — if valid, do nothing
  var cookies = document.cookie.split(';');
  for (var i = 0; i < cookies.length; i++) {
    if (cookies[i].trim().indexOf('sh_access=') === 0) return;
  }

  // No cookie — block page and show gate
  document.documentElement.style.overflow = 'hidden';

  var overlay = document.createElement('div');
  overlay.id = 'sh-gate-overlay';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:20px;padding:48px 40px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(124,77,255,.1);text-align:center">' +
    '<h1 style="font-size:1.5rem;margin:0 0 8px;color:#7c4dff">Small Heroes</h1>' +
    '<p style="font-size:.95rem;color:#666;margin:0 0 24px">האתר בשלב QA — הכניסו סיסמה</p>' +
    '<input id="sh-gate-pw" type="password" placeholder="סיסמה" autocomplete="off" autofocus ' +
    'style="width:100%;padding:14px 16px;border:2px solid #e0d6f5;border-radius:12px;font-size:1.1rem;text-align:center;outline:none;font-family:inherit" />' +
    '<button id="sh-gate-btn" style="width:100%;padding:14px;margin-top:16px;background:#7c4dff;color:#fff;border:none;border-radius:12px;font-size:1.1rem;font-weight:600;cursor:pointer;font-family:inherit">כניסה</button>' +
    '<div id="sh-gate-err" style="color:#e53935;font-size:.9rem;margin-top:12px;display:none">סיסמה שגויה</div>' +
    '</div>';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;' +
    'background:linear-gradient(135deg,#f8f6ff 0%,#f0e8ff 100%);font-family:Heebo,Arial,sans-serif';

  // Insert as soon as body exists
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
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            overlay.remove();
            document.documentElement.style.overflow = '';
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
  }

  mount();
})();
