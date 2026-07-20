# BRIEF (CC) — LAUNCH BLOCKER #1b: close the same-order coupon checkout race (Codex NO-GO fix)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target branch:** `feat/chunked-generation` (HEAD `02074a23`).
- **Gate status:** **[CODEX-GATE]** — money + concurrency. Do NOT self-certify. Commit locally; STOP for Guy→Codex re-gate.
- **Parallelism:** the SINGLE CC session in `sh-wt-style01`. Branch pre-check FIRST: `git branch --show-current` == `feat/chunked-generation`, HEAD `02074a23`.
- **Origin:** Codex re-gate of `02074a23` = **NO-GO to activate FIRST100**. Port/pricing/refund-amount all PASS; one real P0 same-order checkout race breaks the global "≤100 discounted PAID sales" guarantee and permits two PayMe sales for one order. Coupon stays INACTIVE (safe) until this lands + a staging run passes.

## 2. SCOPE
Make the global invariant **"at most 100 discounted PAID sales, and at most one PayMe sale per order"** true under concurrency. Root cause (Codex, verified): two concurrent `/api/checkout` on the same order both read `draft`/`pending_payment` before either claims it — no atomic owner transition before PayMe sale creation (`checkout/route.ts:164,:276`); the second reuses the first's order-level reservation (`coupon-service.ts:100`); a failed attempt releases the **shared** hold by `orderId` (`checkout:310,:374`, `coupon-service:260`); the other's confirmation then sees `released` → `noop` (`coupon-service:193`) → a genuinely paid discounted order never increments `confirmedCount`.

Fix exactly Codex's five required items — nothing broader:
1. **Atomic per-order checkout-attempt owner / CAS** before coupon reservation AND before PayMe sale creation — a second concurrent attempt on the same order cannot proceed to reserve/charge.
2. **Bind reservation release to a unique checkout-attempt token**, not `orderId` — a failed attempt releases only ITS OWN reservation, never a sibling attempt's.
3. **Fail closed:** if an order carries a coupon snapshot but confirmation returns `noop` → `needs_human_qa` (never let a discounted paid order continue uncounted).
4. **Test:** add the same-order concurrent checkout scenario (one succeeds, one fails-and-releases) to the real-Postgres suite, then run all 8 existing cap tests.
5. **Migration:** verify history on staging (`prisma migrate status`) before any deploy.

## 3. FILES / AREAS
- `app/api/checkout/route.ts` (owner/CAS claim before reserve + PayMe create; token-bound release at :310/:374).
- `lib/coupon/coupon-service.ts` (reservation keyed by attempt token not orderId :100/:260; the `released→noop` path :193 → fail-closed).
- Possibly a schema field for the checkout-attempt owner/token (additive; do NOT touch safety columns).
- `lib/coupon/__tests__/coupon-cap.staging.spec.ts` (add the same-order-race test).
- Do NOT touch the Stage-1 safety track or the visual-contract compiler. Do NOT reintroduce add-on charges (the pricing path is Codex-verified correct).

## 4. ACCEPTANCE CRITERIA
- Two concurrent `/api/checkout` on one order → **exactly one** proceeds to create a PayMe sale; the other is cleanly rejected. Never two discounted sales for one order.
- A failed/aborted attempt releases **only its own** token-bound reservation; a sibling's active reservation is untouched.
- An order with a coupon snapshot whose confirmation returns `noop` → `needs_human_qa` (fail-closed), never silently continues.
- Global invariant holds: **at most 100 discounted PAID sales** (not merely `confirmedCount ≤ 100`), proven by the new same-order-race test + the 8 existing tests on real Postgres.
- No regression: charged==displayed (₪59/79/99, add-ons 0), the site-password gate, and the Stage-1 safety track all still hold. `npm run check` green (baseline 1700).

## 5. TESTS
- New (staging/Postgres): same-order concurrent checkout — one success + one failure-release → assert single sale, correct counter, no counter slip, token-bound release, and `noop`→`needs_human_qa` fail-close.
- The 8 existing cap tests green on real Postgres (they gate on `RUN`/staging — document how to run them).
- `npm run check` green in CI (the concurrency proof is the staging run, not CI).

## 6. WHAT NOT TO TOUCH
- Stage-1 safety track (`quality-*`, `readiness-manifest`, `page-visual-qa`, `package-delivery`, `chunk-runner`).
- The visual-contract compiler.
- The pricing/charged==displayed path (Codex-verified) — do not reintroduce add-ons.
- P2 UX (coupon rejection reason messages `wizard.js:3103`) is a SEPARATE follow-up — out of scope here to keep the gate tight.

## 7. GIT HYGIENE
Explicit pathspecs only; NEVER `git add -A`. Commit locally on `feat/chunked-generation`; **Guy pushes**.

## 8. FINAL VERIFICATION
- `npm run check` green; report the owner/CAS mechanism, the token-bound release, the fail-closed `noop` path, the new test, and confirm zero edits to safety/compiler/pricing. Then **STOP for Guy→Codex re-gate** — money+concurrency, do not self-certify.
- **Operator gate (Guy, after Codex PASS):** run the same-order-race test + all 8 cap tests on staging Postgres; `prisma migrate status` on staging; only THEN activate FIRST100.
