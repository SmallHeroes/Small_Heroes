(function () {
  const ROUTES = globalThis.SH_ROUTES || { myBooks: '/my-books' };

  // ── Elements ────────────────────────────────
  const stepEmail   = document.getElementById('stepEmail');
  const stepCode    = document.getElementById('stepCode');
  const emailForm   = document.getElementById('emailForm');
  const codeForm    = document.getElementById('codeForm');
  const emailInput  = document.getElementById('loginEmail');
  const sentToEl    = document.getElementById('sentToEmail');
  const stayInput   = document.getElementById('stayLoggedIn');
  const emailError  = document.getElementById('emailError');
  const codeError   = document.getElementById('codeError');
  const sendBtn     = document.getElementById('sendCodeBtn');
  const sendText    = document.getElementById('sendBtnText');
  const sendLoader  = document.getElementById('sendBtnLoader');
  const verifyBtn   = document.getElementById('verifyCodeBtn');
  const verifyText  = document.getElementById('verifyBtnText');
  const verifyLoader = document.getElementById('verifyBtnLoader');
  const resendBtn   = document.getElementById('resendBtn');
  const resendTimer = document.getElementById('resendTimer');
  const backBtn     = document.getElementById('backToEmail');
  const otpInputs   = document.querySelectorAll('.otp-input');

  let email = '';
  let resendInterval = null;

  // ── Already logged in? ──────────────────────
  fetch('/api/auth/me', { credentials: 'include' })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.user) window.location.replace(ROUTES.myBooks || '/my-books'); })
    .catch(() => {});

  // ── Step 1: Send code ───────────────────────
  emailForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    emailError.textContent = '';
    email = String(emailInput?.value || '').trim().toLowerCase();
    if (!email) { emailError.textContent = 'נא להזין כתובת אימייל.'; return; }

    setLoading(sendBtn, sendText, sendLoader, true);

    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null);

    setLoading(sendBtn, sendText, sendLoader, false);

    if (!res || !res.ok) {
      emailError.textContent = 'לא הצלחנו לשלוח קוד. נסו שוב.';
      return;
    }

    showCodeStep();
  });

  // ── Step 2: Verify code ─────────────────────
  codeForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    codeError.textContent = '';
    const code = getOtpValue();
    if (code.length < 6) {
      codeError.textContent = 'נא להזין את כל 6 הספרות.';
      otpInputs.forEach(i => i.classList.add('error'));
      setTimeout(() => otpInputs.forEach(i => i.classList.remove('error')), 400);
      return;
    }

    setLoading(verifyBtn, verifyText, verifyLoader, true);

    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        code,
        stayLoggedIn: Boolean(stayInput?.checked),
      }),
    }).catch(() => null);

    setLoading(verifyBtn, verifyText, verifyLoader, false);

    if (!res || !res.ok) {
      codeError.textContent = 'הקוד לא תקין או שפג תוקפו.';
      otpInputs.forEach(i => i.classList.add('error'));
      setTimeout(() => otpInputs.forEach(i => i.classList.remove('error')), 400);
      clearOtp();
      return;
    }

    window.location.replace(ROUTES.myBooks || '/my-books');
  });

  // ── Resend ──────────────────────────────────
  resendBtn?.addEventListener('click', async () => {
    codeError.textContent = '';
    resendBtn.disabled = true;

    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null);

    if (!res || !res.ok) {
      codeError.textContent = 'לא הצלחנו לשלוח שוב. נסו מאוחר יותר.';
      resendBtn.disabled = false;
      return;
    }

    codeError.textContent = '';
    startResendCooldown();
    clearOtp();
    otpInputs[0]?.focus();
  });

  // ── Back to email ───────────────────────────
  backBtn?.addEventListener('click', () => {
    stepCode.hidden = true;
    stepEmail.hidden = false;
    if (resendInterval) clearInterval(resendInterval);
    emailInput?.focus();
  });

  // ── OTP box behavior ────────────────────────
  otpInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(0, 1);
      e.target.classList.toggle('filled', val.length > 0);

      if (val && idx < otpInputs.length - 1) {
        otpInputs[idx + 1].focus();
      }

      // Auto-submit when all 6 filled
      if (getOtpValue().length === 6) {
        codeForm?.requestSubmit();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        otpInputs[idx - 1].focus();
        otpInputs[idx - 1].value = '';
        otpInputs[idx - 1].classList.remove('filled');
      }
    });

    // Handle paste — distribute digits across boxes
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      pasted.split('').forEach((ch, i) => {
        if (otpInputs[i]) {
          otpInputs[i].value = ch;
          otpInputs[i].classList.add('filled');
        }
      });
      const focusIdx = Math.min(pasted.length, otpInputs.length - 1);
      otpInputs[focusIdx]?.focus();
      if (pasted.length === 6) codeForm?.requestSubmit();
    });
  });

  // ── Helpers ─────────────────────────────────
  function showCodeStep() {
    stepEmail.hidden = true;
    stepCode.hidden = false;
    sentToEl.textContent = email;
    clearOtp();
    startResendCooldown();
    setTimeout(() => otpInputs[0]?.focus(), 100);
  }

  function getOtpValue() {
    return Array.from(otpInputs).map(i => i.value).join('');
  }

  function clearOtp() {
    otpInputs.forEach(i => { i.value = ''; i.classList.remove('filled', 'error'); });
  }

  function setLoading(btn, textEl, loaderEl, loading) {
    if (btn) btn.disabled = loading;
    if (textEl) textEl.hidden = loading;
    if (loaderEl) loaderEl.hidden = !loading;
  }

  function startResendCooldown() {
    let seconds = 60;
    resendBtn.disabled = true;
    resendTimer.textContent = seconds;

    if (resendInterval) clearInterval(resendInterval);
    resendInterval = setInterval(() => {
      seconds--;
      resendTimer.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(resendInterval);
        resendBtn.disabled = false;
        resendBtn.innerHTML = 'שלחו שוב';
      }
    }, 1000);
  }
})();
