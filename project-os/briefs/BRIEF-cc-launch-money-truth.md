# BRIEF (CC) — LAUNCH BLOCKER #1: money truth (coupon port → addon removal → charged==displayed)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target branch:** `feat/chunked-generation` (HEAD `d63f036e`).
- **Gate status:** **[CODEX-GATE]** — money code. Do NOT self-certify. Commit locally; STOP for Guy→Codex re-gate before it counts as done.
- **Parallelism:** the SINGLE CC session in `sh-wt-style01`. Branch pre-check FIRST: `git branch --show-current` == `feat/chunked-generation`, HEAD `d63f036e`.
- **Origin:** Codex full-repo audit 2026-07-15 — two P0 money defects on the live customer path, verified by Cowork against the files.

## 2. SCOPE
Make **charged price == displayed price == promised inclusions**, and restore the coupon system, on the merged branch. Two forensic facts from Codex (do not re-derive blindly):
- `fix/remove-addon-charges@dff4681f` removes the ₪19/₪19/₪29/₪39 add-on charges — **NOT** merged into feat. Today `computePricing` (`backend/config/wizard.ts`) still adds them and `app/api/checkout/route.ts` charges them, while `public/JS/content.js` promises *"הכל כלול בכל חבילה — בלי תוספות."*
- `feat/coupon-code@e3b89173` holds 7 unique commits incl. the 3 concurrency fixes that already passed re-gate — **no coupon implementation exists in the current code at all.**
- The two branches **share 4 early commits then diverged** → do NOT merge either branch blindly. **Port order: coupon (`e3b89173`) FIRST, then addon-removal (`dff4681f`)**, resolving the shared commits without double-applying.

**Product-truth — CONFIRMED by Guy 2026-07-15:** base price by direction (₪59/79/99) **as displayed** is all-inclusive of book + audio narration; **remove the add-on line items** (`dff4681f`); video + print/Power Card are **post-MVP** (`ready.js` already hides them) → the copy must stop promising them as included. **Launch discount = a 50%-off coupon, capped at the first 100 redemptions** (a GLOBAL cap of 100 — this is the concurrency-critical part: the counter must be atomic so a race can never let a 101st order redeem). One shared launch code capped at 100 is the simplest shape; per-user single-use codes also fine — the hard INVARIANT is **≤100 discounted orders, concurrency-safe**.

## 3. FILES / AREAS
- **Money:** `backend/config/wizard.ts` (`computePricing`, `ADDON_PRICES`), `app/api/checkout/route.ts` (the charged amount), + the coupon modules from `e3b89173` (checkout coupon apply, validation, the 3 concurrency fixes).
- **Copy (same product-truth, so same brief):** `public/JS/content.js` FAQ "מה מקבלים בפועל" — remove the video + print promise + rephrase "בלי תוספות" to match the actual inclusive model; scan landing/checkout copy for the same claims.
- Do NOT touch the Stage-1 safety track or the visual-contract compiler.

## 4. ACCEPTANCE CRITERIA
- **No add-on charges**: a purchase at each direction charges exactly the displayed base (₪59/79/99) — no ₪19/29/39 added anywhere on the golden path.
- **Coupon = 50% off, capped at 100 redemptions (GLOBAL, atomic)**: a valid code takes exactly 50% off the charged amount; redemption #101 is rejected **even under concurrent checkout** (the 3 re-gated concurrency fixes from `e3b89173` must prove the cap holds under race — no over-redemption, no double-redeem by one user); invalid/expired rejected.
- **Refund exactly-once, both directions** (regression for the FIX-6 double-refund class): a refund of a couponed order returns the **actually-charged (discounted) amount**, once — never the full base.
- **Copy == money**: no surviving promise of "no add-ons" alongside add-on charges; no promise of video/print as included while `SHOW_*=false`.
- Port is clean — the 4 shared commits are not double-applied; `npm run check` green (baseline 1673).

## 5. TESTS
- Charged-amount test per direction (base only, no add-ons) on the checkout seam.
- Coupon apply/reject + double-redeem/concurrency regression (ported from `e3b89173`).
- Refund exactly-once (couponed + non-couponed), both directions.
- A copy/consistency assertion or manual note that content.js no longer promises add-ons/video/print as included.

## 6. WHAT NOT TO TOUCH
- Stage-1 safety track (`quality-*`, `readiness-manifest`, `page-visual-qa`, `package-delivery`, `chunk-runner`) — no edits.
- The visual-contract compiler — no edits.
- Do NOT merge `feat/coupon-code` or `fix/remove-addon-charges` wholesale — port the unique commits in order.

## 7. GIT HYGIENE
Explicit pathspecs only; NEVER `git add -A`. Commit locally on `feat/chunked-generation`; **Guy pushes**. Log which commits were ported from each branch (for the ledger).

## 8. FINAL VERIFICATION
- `npm run check` green; report: the ported commit list (coupon then addon), the charged==displayed proof per direction, the refund-exactly-once result, and the copy diff. Then **STOP for Guy→Codex re-gate** (money — do not self-certify).
- **Resolved (Guy 2026-07-15):** discount IS via coupon (50% off, first 100) → coupon port is launch-critical and stays in this brief. The 100-cap makes the concurrency fixes non-negotiable — Codex must specifically confirm the cap can't be raced past 100.
