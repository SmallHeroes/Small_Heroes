# CODEX RE-GATE (round 5) — the shared delivery fence, with an EXECUTED real-Postgres proof

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only static audit + tx/concurrency reasoning; cite `files:lines`.
- **Branch:** `feat/chunked-generation`. **Diff range `5d9b4068..HEAD`**; this round adds `24688e61` (fence architecture) and `23b99e0e` (real-PG harness + shared-CAS extraction) on top of `d52e0126`.
- **Gate: [CODEX-GATE] + DECISION GATE** — schema change, the core delivery path, every hold-writing seam.

## 2. ORIGIN / CONTEXT
Your round-4 verdict was NO-GO on two P0s and a P1: (a) the **normal** delivery path could clobber a safety/payment hold and ship, because the CAS matched `id + inputVersion` only while a safety park bumps neither; (b) anchor release still ignored an active `HumanQaReviewCase`; (c) the atomic receipt ignored `requireHold`, so a guarded call could replay an unguarded receipt and skip the precondition entirely. Your prescription — make delivery authority **shared, not opt-in** — was implemented as specified:
1. A dedicated monotonic **`Order.deliveryFenceVersion`** (migration `20260719_delivery_fence_version`, additive `INTEGER NOT NULL DEFAULT 0`), bumped atomically by every hold write.
2. Every `ready` transition and Outbox enqueue binds to the observed fence.
3. The final CAS additionally blocks `manualReviewRequired`, terminal markers, and any active strong Human-QA case (`NOT EXISTS`).
4. `requireHold` remains a precise admin capability and is folded into the receipt `operationKey`/`payloadHash`.
5. Real-Postgres interleaving tests — **executed, see §4**.

**Fence-field choice (please ratify):** dedicated field rather than bumping `inputVersion`, because `inputVersion` already drives readiness invalidation, receipt identity and the TOCTOU retry loop — bumping it on every park would fire all three (spurious invalidation, receipt churn, retry storms). The fence is orthogonal: only the ship CAS binds to it.

**Cowork's independent coverage sweep:** every production site that SETS a hold marker carries a fence bump — safety/contract park (`exception-processor.ts`), the three payment coupon fences, `package-delivery.ts` (safety hard-hold + legacy park), and readiness's own hold outcomes. Sites that touch `deliveryHoldReason` without setting a hold were checked and correctly excluded: `start.ts` reads only; `coupon-service.ts` returns the marker string (its callers do the write and are fenced); `record-hold.ts`/`sync-hold-case.ts` write the CASE, never the Order; `anchor-hold-release` only CLEARS to NULL on release.

## 3. VERIFY (cite files:lines)
1. **P0-1 closed on the golden path** — the normal (`requireHold`-less) delivery commit can no longer overwrite a hold that landed after readiness read its state. Confirm the fence is genuinely carried through `OrderTruth`/select/fingerprint and that the ship CAS binds the observed value.
2. **Fence coverage is exhaustive** — independently confirm no Order hold-write anywhere bumps the marker without bumping the fence (including raw SQL and any admin path). A single missed site reopens the hole.
3. **P0-2 closed** — the anchor-release flag-off release CAS itself rejects an active strong Human-QA case, so the `skip_weaker` divergence (safety case active while the marker reads anchor) cannot release.
4. **P1 closed** — a guarded call can never be satisfied by a receipt recorded under a different capability/marker at the atomic fence's short-circuit (`atomic-operation.ts:183`), so the precondition CAS always runs.
5. **Error classification** — 0 rows correctly separates `inputVersion` drift (retry) from a competing hold (never retried: `ReleasePreconditionError` → 409 on the admin path; `DeliveryFenceError` → held, not shipped, on the normal path). Confirm no path converts a fence rejection into a ship.
6. **No regression** — money/coupon math and hold DECISION functions byte-unchanged; tsc 0; vitest 2061 passed / 36 skipped / 0 failed.

## 4. THE REAL-POSTGRES PROOF (executed 2026-07-18 — not merely written)
`lib/generation-chunked/__tests__/delivery-fence.pg.spec.ts`, run against a throwaway `postgres:16`, exercising the **shared exported `executeReadinessShipCas`** — the same SQL production runs, so there is no guard/proof drift. **11 passed / 11.** Notably it includes **positive controls**, so a blanket-blocking CAS could not masquerade as a pass:
- `a clean order (no hold, fence unchanged) → SHIPS (1 row, status→ready)` ✅
- `an active ANCHOR case does NOT block (anchor is releasable) → SHIPS` ✅
- `THE FENCE ISOLATED — bound to the stale fence → 0 rows; bound to the current fence → 1 row (ships)` ✅
And the crux, via a **second connection** committing the park:
- `THE INTERLEAVE — readiness reads fence=0, a safety park bumps it, the ship CAS bound to 0 → 0 rows (no ship)` ✅
Plus every hold form blocking (safety marker, contract_world marker, payment fence, active safety case under an anchor marker, active payment_integrity case) and both `requireHold` drifts.
**Please assess whether this harness proves what it claims** — in particular whether its minimal DDL faithfully represents the production columns the CAS depends on, and whether the seeded interleave is the real one you described in round 4.

## 5. ⚠️ GAP COWORK FOUND IN THE HARNESS ITSELF
The spec runs `DROP TABLE IF EXISTS "Order" CASCADE` against whatever `DELIVERY_FENCE_PG_URL` points at, with **no environment guard**. One wrong env var destroys staging. The repo already has `assertEnvSeparation()` for exactly this class. **Recommend requiring an equivalent guard (refuse any URL that resolves to a known staging/prod host) before this file is allowed into CI.** Please rule on whether that is mandatory for GO.

## 6. MIGRATION / DATA
Two migrations are now pending and **neither has been applied anywhere, including staging**: `20260718_human_qa_review_case` and `20260719_delivery_fence_version`. Both must deploy **before** the code (the `coverSafetyVerified` crash on QA was this exact failure mode). Run `prisma migrate status` on staging first (back-dated coupon migration). Note separately: **production has no `_prisma_migrations` table at all** — a distinct cutover consult is open.

## 7. PROOF BOUNDARY / DURABILITY QUESTION
The fence's correctness now depends on every FUTURE hold write remembering to bump it. The repo already ships a static writer-coverage guard (`delivery-input-writer-coverage`) that CC had to update for this change. **Should an equivalent structural guard be required — one that FAILS the build if a write sets `deliveryHoldReason` without bumping `deliveryFenceVersion`?** Cowork's view: yes, otherwise this regresses the first time someone adds a hold path. Please rule.

## 8. OUTPUT
Verdict **GO / NO-GO to deploy to staging**, P0/P1/P2 as `files:lines`, plus explicit rulings on: the fence-field choice (§2), the harness's evidentiary value (§4), the missing env guard (§5), and the structural writer guard (§7).
