# CODEX RE-GATE (round 6) — delivery fence: the COMPLETE transition set + funnel guard + executed PG proof

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only static audit + tx/concurrency reasoning; cite `files:lines`.
- **Branch:** `feat/chunked-generation`. **Diff range `5d9b4068..HEAD`**; this round adds `bb806ecb`, `af7de417`, `c7a166d4`, `37a445c4`, `eae56583` on top of `ee670a17`.
- **Gate: [CODEX-GATE] + DECISION GATE** — the production delivery path, the funnel refactor, and a schema change.

## 2. ORIGIN / CONTEXT
Your round-5 verdict was NO-GO: the fence primitive was ACCEPTED and the ship CAS PASSED, but authority writes **bumped** the fence without **binding** it, the legacy (production) path was entirely unfenced, the receipt ignored the fence, and the harness was dangerous. Round 5 also named the meta-defect: *"סמכות ה־fence עדיין אינה משותפת לכל המעברים."* This round targets the **complete set**, not the named instances.

**The transition table — every Order authority write:**

| Transition | Path | mechanism | binds | bumps | never-overwrites |
|---|---|---|---|---|---|
| ship → ready | readiness (flag-on) | `executeReadinessShipCas` | ✅ | (release) | ✅ fence+marker+case |
| ship → ready | **legacy (flag-off = PRODUCTION)** | `executeReadinessShipCas` | ✅ | — | ✅ + **email gated on the win** |
| hold/park | readiness | `writeOrderHoldFenced` | ✅ | ✅ | ✅ precedence |
| park (legacy) | package-delivery | `writeOrderHoldFenced` | ✅ | ✅ | ✅ |
| safety park | package-delivery | `writeOrderHoldFenced` (rank 3) | ✅ | ✅ | ✅ |
| safety/contract park | exception-processor | `writeOrderHoldFenced` | ✅ | ✅ | ✅ |
| payment fence ×3 | payme / fake-payment | `writeOrderHoldFenced` (rank 1) | ✅ | ✅ | ✅ yields to safety |
| release | anchor-release (flag-off) | `executeAnchorReleaseCas` | ✅ marker+case | ✅ | ✅ |
| input invalidation | `withDeliveryInputMutation` | barrier — bumps `inputVersion` | n/a | — | **reported allowance** |

All ship/hold/release CAS now live in the single funnel `lib/generation-pipeline/order-authority.ts`.
**Cowork verified independently:** the production email is gated — `shipped = rows === 1`, and `if (!shipped)` withholds the send (`package-delivery.ts:212`, `:243`).

## 3. VERIFY (cite files:lines)
1. **The table is true and complete** — every listed transition genuinely binds the observed fence in its `WHERE`, bumps it, and refuses to overwrite on 0 rows. **And: is any Order authority write missing from the table entirely?** That is the failure mode of the last four rounds.
2. **P0-2 closed on the production path** — legacy cannot ship past a hold that landed mid-flight and **cannot email** when its CAS lost. Confirm there is no residual path to `sendBookReadyEmail` when `shipped === false`.
3. **Marker precedence** — `markerRank` (safety > contract_world > else) is correct and applied uniformly; a weak hold can never clobber a safety marker, so the case sync always observes the strongest.
4. **⚠️ Unit 3 — the receipt idempotency argument (please scrutinise).** CC folded the **load-time** `deliveryFenceVersion` into the receipt `operationKey`, arguing this closes stale replay while preserving HOLD idempotency: a P2028 retry reuses the pre-computed key and replays; a fresh call reads the post-bump fence and derives a new key. The brief authorised CC to STOP if the dual constraint proved unresolvable — it did not stop. **Rule on whether both constraints actually hold**, including for a HOLD that bumps its own fence and is then retried.
5. **⚠️ Unit 4 — the funnel guard and its ONE allowance.** A new structural test fails the build on any `deliveryHoldReason`/`manualReviewRequired` write (Prisma or raw SQL) outside `order-authority.ts`. The single exemption is `withDeliveryInputMutation` (sets `base_book_integrity:inputs_changed`), justified as protected by `inputVersion`, which the ship CAS binds. **Rule on: (a) is that allowance safe, or can the barrier clobber a stronger marker? (b) is the guard's detection robust** — it recognises the barrier by `base_book_integrity` + `staleReason` tokens, which is textual matching and could be spoofed or drift.
6. **Outbox fence** — `DeliveryOutbox.deliveryFenceVersion` (new migration) is carried at enqueue and re-verified in the send-time CAS; the link is now explicit rather than incidental.
7. **No regression** — money/coupon math and hold DECISION functions byte-unchanged; tsc 0; vitest 2065 passed / 42 skipped / 0 failed.

## 4. THE REAL-POSTGRES PROOF (executed this round)
Run against a dedicated throwaway `postgres:16` (DB `fence`): **17/17 passed**, exercising the shared exported CAS functions — no guard/proof drift. Covers the original interleave and the three positive controls, plus this round's additions: **HOLD-vs-HOLD precedence** (a weak marker cannot clobber a safety hold; the case sync then sees the safety marker), **release**, and the **Outbox fence predicate**. The harness's fail-closed guard was also verified to **refuse** a non-throwaway DB name (`postgres`) and run nothing — closing your round-5 P0-tooling finding. **Please assess whether these 17 cover the classes you flagged as unproven in round 5** (HOLD-vs-HOLD, legacy, receipt replay, Outbox rollback) — Cowork's read is that receipt replay and Outbox rollback are still argued statically rather than proven at the DB.

## 5. MIGRATION / DATA
Two additive migrations in range: `20260719_delivery_fence_version` (Order) and `20260719_zz_outbox_delivery_fence` (DeliveryOutbox). **All pending migrations — including `20260718_human_qa_review_case` — have now been applied to STAGING and recorded in `_prisma_migrations` with correct checksums (verified 2026-07-18).** Migration-before-code still binds for any further environment. Separately: **production has no `_prisma_migrations` table at all** — a distinct cutover consult is open.

## 6. NO-REGRESSION
Hold DECISION functions, money/coupon math, the board engine, Stage-1 safety semantics, `ExceptionCase` — behaviourally unchanged.

## 7. PROOF BOUNDARY
Static re-gate plus the executed PG run above. Not provable here: the scheduled reconciler firing in a deployed environment (**Vercel Preview crons do not run**), and a real held order producing case → notification → `under_review` on staging. Note `READINESS_MANIFEST_ENABLED=true` on **Preview only** — production runs the legacy path, which is why Unit 1 is the highest-stakes item in this range.

## 8. OUTPUT
Verdict **GO / NO-GO to deploy to staging**, P0/P1/P2 as `files:lines`, plus explicit rulings on §3.1 (is the table complete), §3.4 (receipt idempotency), §3.5 (the funnel allowance + guard robustness), and §4 (does the PG proof now cover the classes you named).
