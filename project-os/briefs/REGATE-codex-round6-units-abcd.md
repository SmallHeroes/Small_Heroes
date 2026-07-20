# CODEX RE-GATE (round 7) — round-6 Units A/B/C/D (legacy deliberately excluded)

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only static audit + tx/concurrency reasoning; cite `files:lines`.
- **Branch:** `feat/chunked-generation`. **Diff range `eae56583..db577a8b`** — commits `6ce13250` (Unit A), `f91eb9df` (Unit D), `2def69a7` (Unit C), `db577a8b` (Unit B).
- **Gate: [CODEX-GATE]** — delivery recovery paths, a cutover migration, receipt identity, and the structural guard.

## 2. ORIGIN / CONTEXT — and what is deliberately NOT here
Your round-6 verdict raised a P0 on the legacy direct-send path plus P1 ×2 and a P2. **Guy's product decision (19/07), which you subsequently endorsed: legacy is RETIRED, not hardened.** Production moves to readiness-only via the cutover; the legacy path is then deleted. So:
- **The legacy P0 is intentionally NOT fixed.** `lib/generation-pipeline/package-delivery.ts` is **byte-unchanged across all of round-6** (Cowork verified: `git diff eae56583..db577a8b` on that file is empty). Legacy is frozen pending deletion.
- The other three findings live on the readiness+Outbox path we are standardising on, so they were fixed. A fourth unit (D) addresses the migration-stranding risk you flagged.

**Unit A** — `deliveryFenceVersion` is now a **required** argument to `enqueueDelivery` (no `?? 0`), compile-forcing every caller; `reissueConfirmedFailedDelivery` loads and passes the Order's current fence; `repairInvalidPayloadDelivery` selects and refreshes it. Tests now exercise the **real `casClaimSendSlot`**, replacing the replicated `SELECT EXISTS` you flagged at `delivery-fence.pg.spec.ts:226`.
**Unit D** — new migration `20260720_outbox_fence_reconcile`: re-derives the fence for every unsent row from its Order, leaves terminal rows alone, and **RAISEs** if any unsent row bound to a `ready` Order still mismatches (a bad cutover aborts rather than silently stranding books). Idempotent; ordering-guarded.
**Unit C** — the load-time fence enters the receipt `operationKey` **only when the commit authorizes delivery** (`plan.orderStatus === 'ready'`); a plain HOLD gets a fence-independent `:holdfenceNA` segment. Rationale: a HOLD bumps its own fence, so a fresh cross-worker redrive derived a new key and re-applied the hold.
**Unit B** — the guard's claim is narrowed to what it enforces, and extended to prove **no non-funnel transition INTO `status='ready'`**, including indirect writes (`status: someVariable`) that the old inline-literal detector missed.

CC also ran its own adversarial review of B and C (two skeptics tasked to break them) which returned zero defects — **please go deeper rather than duplicate that pass.**

## 3. VERIFY (cite files:lines)
1. **Unit A** — no enqueue/reissue/repair path can produce an Outbox row with a stale or defaulted fence; no delivery can be silently stranded. Confirm the mandatory-arg change actually closes every caller, including any path you can reach that CC did not enumerate.
2. **Unit D** — the reconcile is idempotent, correctly scoped (unsent only; terminal rows untouched), and its RAISE cannot fire spuriously mid-cutover or, worse, fail to fire on a genuine mismatch. Confirm the ordering guard makes it impossible to run before the column exists.
3. **⚠️ Unit C — the CHANGED test assertions (please scrutinise).** Two pre-existing round-5 assertions were **changed, not added**: `hold.operationKey === soft.operationKey` became `not.toBe`, because a plain hold is now fence-independent while its soft-deliver ship stays fence-bound. CC documents this as a consequence of the fix. **Rule on: (a) is the new distinctness correct; (b) was the PREVIOUS shared key ever exploitable** — i.e. could a recorded hold receipt have short-circuited a later soft-ship (or vice versa) at the atomic fence, making this a latent-bug fix rather than merely a keying change; (c) does the round-5 P1 (a stale ship cannot replay after a competing hold moved the world) still hold.
4. **⚠️ Unit B — the two allowances.** The guard exempts (i) the inputs barrier (demote-to-`generating` only) and (ii) `app/api/dev/story-bank/route.ts`, which **can write `ready`**, justified as dev-only, 404'd in production by two fail-closed gates, and mutating only fresh $0 dev orders. **Rule on whether allowlisting a `ready`-capable path is acceptable** in a guard whose entire purpose is preventing exactly that, or whether the dev route should be changed so no allowlist is needed. Also assess the `inputsBarrier` exemption's **source-token heuristic** — CC's own reviewer flagged it as a heuristic; you accepted the equivalent pattern in round 5, so confirm it still holds under the extended detector.
5. **The 29-site enumeration** — CC audited every non-funnel `Order.status` write and reports **zero paid-delivery leaks**, with the funnel (`order-authority.ts:75/108/136`) as the sole production author of `ready`. **Is that enumeration complete and correct?** Incompleteness of exactly this kind was the defect in rounds 2–6.
6. **No regression** — money/coupon math and hold DECISION functions byte-unchanged; marker precedence (your PASS) and the input barrier (your ACCEPT) intact; tsc 0; vitest 2072 passed / 45 skipped / 0 failed.

## 4. ⚠️ PROOF GAP COWORK IS FLAGGING
**Unit C's claim is about CROSS-WORKER idempotency, and it is proven only in mocked tests.** B and C add no real-PG coverage; the harness remains at 20/20 from Units A/D. In round 6 you flagged precisely this class — *"receipt fresh-redrive"* among the things the PG proof did not cover. A mocked test cannot express two workers redriving the same order at different fence values. **Rule on whether Unit C requires a real-PG proof before GO**, and if so, what the minimal decisive test is. Cowork does not consider Unit C proven.

## 5. MIGRATION / DATA
Round 6 adds `20260720_outbox_fence_reconcile`. All prior migrations are applied to **staging** and recorded. Production remains un-baselined (no `_prisma_migrations`) — handled by the separate cutover plan you issued, which is now the launch gate. Migration-before-code still binds.

## 6. NO-REGRESSION
Hold DECISION functions, money/coupon math, the board engine, Stage-1 safety semantics, marker precedence, the input barrier, and the **frozen legacy path** — all behaviourally unchanged.

## 7. PROOF BOUNDARY
Real-PG harness 20/20 (Units A/D, including the real `casClaimSendSlot` and the Unit-D reconcile). Not proven at the DB: Unit C cross-worker redrive (§4), and Outbox rollback under a real transaction abort. Vercel Preview crons do not run, so the scheduled reconciler still needs an external trigger for its staging proof.

## 8. OUTPUT
Verdict **GO / NO-GO to deploy to staging**, P0/P1/P2 as `files:lines`, plus explicit rulings on §3.3 (the changed assertions and whether the old shared key was exploitable), §3.4 (the `ready`-capable dev allowlist), §3.5 (is the enumeration complete), and §4 (does Unit C need a real-PG proof).
