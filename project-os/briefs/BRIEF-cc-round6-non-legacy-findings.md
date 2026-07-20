# BRIEF (CC) — Codex round-6 findings that SURVIVE the legacy-retirement decision (P1 ×2 + P2)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first; HEAD `eae56583`. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**.
- **Gate: [CODEX-GATE]** — delivery recovery paths and the structural guard. Commit locally per unit; STOP for the re-gate.

## 2. SCOPE (what + why now)
**Product decision (Guy, 2026-07-19): the legacy direct-send path will be RETIRED, not hardened.** Production will be migrated (cutover), `READINESS_MANIFEST_ENABLED` turned ON there, and the legacy path deleted. Codex's round-6 **P0** (legacy send is not a one-shot claim; the email can go out after a HOLD commits in the window) is therefore **out of scope — do NOT fix it, do NOT extend the legacy path.** Treat legacy as **FROZEN**: it must keep working exactly as-is until the cutover, then it gets deleted.

**These three findings are NOT legacy-specific — they live on the readiness+Outbox path we are standardising on, so they must be fixed regardless:**

**Unit A — [P1] the Outbox fence is missing across recovery paths.** `enqueueDelivery` leaves `deliveryFenceVersion` optional and coerces absence to `0` (`delivery-outbox.ts:105`); `reissueConfirmedFailedDelivery` neither loads nor passes the fence (`exception-case.ts:354`, `:461`); the `invalid_payload` repair does not refresh it (`delivery-outbox.ts:384`, `:434`). After a hold/release an Order with fence > 0 gets an Outbox row carrying 0, which the send CAS then blocks (`readiness-manifest.ts:1073`). Fail-closed, but it **strands deliveries** — a paid customer's book silently never sends.
**Required:** make the field **mandatory** (no defaulting to 0) and thread the current fence through **every** enqueue / reissue / repair.

**Unit B — [P1] the structural guard does not prove "every Order authority write".** It scans only `.ts`, matches only a direct `.order.update*` call with an inline object literal, and recognises the input barrier by two textual tokens (`order-authority-guard.spec.ts:26`, `:39`, `:78`). It **explicitly permits `status:'ready'` outside the funnel** (`:135`) — and such writes exist: the dev story-bank route writes `ready`/`partial` (`app/api/dev/story-bank/route.ts:692`), and `failed` is written outside the funnel (`sweeper.ts:74`, `chain-worker.ts:44`). Those are not paid-delivery leaks today, but the guard's claim of completeness is false.
**Required:** either extend the guard to cover **all** `Order.status` writes (with each non-funnel write explicitly justified and enumerated), or narrow its stated claim to exactly what it proves. Do not leave an overclaiming guard — a guard people trust wrongly is worse than none.

**Unit C — [P2] receipt idempotency holds only within one retry.** The same `operationKey` survives an in-call P2028 retry (`atomic-operation.ts:141`), but a HOLD bumps the fence, so a fresh redrive loads N+1 and derives a new key (`readiness-manifest.ts:546`, `:959`) — the HOLD can be applied twice. Delivery-safe, but not exactly-once across workers.
**Required (Codex's prescription):** bind the fence to **SHIP/release identity only**, not to a plain HOLD.

**Unit D — migration backfill.** `20260719_zz_outbox_delivery_fence` defaults existing rows to `0`; any **unsent** Outbox row whose Order has fence > 0 is now permanently blocked by the send CAS. **Required:** a reconciliation/backfill for unsent rows (align the row's fence with its Order, or re-derive), plus a check that no unsent row is left stranded. This matters directly at cutover.

## 3. FILES / AREAS
`lib/generation-chunked/delivery-outbox.ts` · `lib/generation-chunked/exception-case.ts` · `lib/generation-pipeline/readiness-manifest.ts` (send CAS + receipt key) · `lib/generation-pipeline/atomic-operation.ts` · `lib/__tests__/order-authority-guard.spec.ts` · `lib/generation-chunked/sweeper.ts`, `chain-worker.ts`, `app/api/dev/story-bank/route.ts` (enumerate/justify, do not necessarily change) · a backfill script for Unit D.
**Do NOT touch** `lib/generation-pipeline/package-delivery.ts`'s legacy branch.

## 4. ACCEPTANCE CRITERIA
- No enqueue / reissue / repair path can produce an Outbox row with a stale or defaulted fence; no delivery can be silently stranded.
- The guard's claim matches exactly what it enforces; every `Order.status` write outside the funnel is enumerated and justified in the report.
- A HOLD cannot be applied twice by a fresh redrive; SHIP/release identity carries the fence.
- No unsent Outbox row is left blocked by the fence default.
- The legacy branch is **byte-unchanged** (it is frozen pending deletion).
- `npm run check` green; money/coupon math and hold DECISION functions byte-unchanged.

## 5. TESTS
- Extend the **real-PG** harness (Docker on Guy's machine: `postgres:16`, port 55432, DB `fence` — request the run): Outbox **reissue** carries the current fence; a stale-fence row is repaired rather than stranded; the send CAS is exercised through the **real `casClaimSendSlot`**, not a replicated `SELECT EXISTS` (Codex flagged this gap at `delivery-fence.pg.spec.ts:226`).
- Receipt: a fresh redrive after a HOLD does not re-apply the HOLD.
- Guard: a deliberately added non-funnel authority write fails the build.
- Backfill: an unsent row with a stale fence is corrected and then sends.

## 6. WHAT NOT TO TOUCH
The legacy direct-send path (frozen); hold DECISION functions; money/coupon math; the board engine; Stage-1 safety semantics; marker precedence (Codex: PASS) and the input barrier (Codex: ACCEPT).

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; one commit per unit on `feat/chunked-generation`; commit locally, **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green. Report: the fence-threading call sites, the enumerated non-funnel `Order.status` writes with justifications, the receipt identity change, the backfill result, and the extended real-PG output. **Then STOP for the Codex re-gate.**
