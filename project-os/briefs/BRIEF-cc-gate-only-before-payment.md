# BRIEF (CC) — move the QA password gate to PAYMENT-ONLY (open browsing everywhere else)

**⚠️ TARGET BRANCH: `feat/chunked-generation`.**
**Intent (Guy):** the `gate.js` "האתר בשלב QA — הכניסו סיסמה" overlay currently blocks EVERY page (landing, reader, ready, my-books, wizard, …) → it interrupts QA. Change the model: **browsing/QA is OPEN (no popup anywhere); the site password is required ONLY at the moment of payment** (soft-launch: anyone can view the product, only password-holders can buy).

**Do NOT touch `middleware.ts`** — the `/dev` edge gate is already correct (QA browsing open, only the fake-payment trigger gated). This brief is only about the client-side `gate.js` overlay + a payment-time gate.

## Step 1 — remove the `gate.js` overlay from all browsing pages
Remove the `<script src="/JS/gate.js">` include from:
- `app/landing/landing-page.tsx:93`
- `public/HTML/index.html`, `login.html`, `wizard.html`, `generating.html`, `my-books.html`, `reader.html`, `ready.html`
Result: **no password popup on page load anywhere.** Keep `public/JS/gate.js`, `/api/gate`, and the `sh_access` cookie mechanism (reused in Step 2).

## Step 2 — gate ONLY the payment initiation
The password must appear **only when the user initiates payment** (the "pay"/checkout action in the wizard, right before the real PayMe payment):
- **Frontend (on-demand, NOT on page load):** on the pay/checkout click, if there's no valid `sh_access` cookie → show the gate overlay (reuse `gate.js`'s overlay + `/api/gate` validation); on success (cookie set) → proceed to payment. Never prompt on page load.
- **Backend (defense-in-depth — the real gate):** the payment/checkout-initiation endpoint (the PayMe checkout creation / the point where money is about to be taken — CC locate the exact seam on the golden path) must **require `sh_access === SITE_PASSWORD`**, else 401. So skipping the frontend can't bypass it.
- Leave `SITE_PASSWORD` / `/api/gate` / `sh_access` unchanged — just relocate WHERE the cookie is demanded.

## Acceptance
- **No password popup** on landing / reader / ready / my-books / wizard / generating / login / index at page load.
- Initiating **payment** without the cookie → the gate prompt appears; correct password → proceeds; wrong → blocked.
- The **real paid flow still works** end-to-end once the cookie is set (the added cookie-requirement does not break legitimate payment).
- `middleware.ts` unchanged; `contract`/generation flows unchanged.
- `npm run check` green. Explicit pathspecs, commit on **`feat/chunked-generation`**, no push. Guy visual-verifies: browse freely (no popup), then hit pay → prompt.

## Note
This intentionally opens the whole site to anonymous browsing (product visible to anyone); only purchase is gated. That's the desired soft-launch model per Guy. If a fuller "waitlist / invite" gate is wanted later, that's a separate decision.
