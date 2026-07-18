# BRIEF (CC) — Human-QA Slice 1: close the Codex NO-GO (2 P0 + 2 P1 + 3 P2)

## 1. ROUTING + GATE
- **Executor:** CC. **Target:** `feat/chunked-generation` (`sh-wt-style01`). Branch pre-check first (HEAD `e0f808eb`); single session.
- **Gate: [CODEX-GATE]** — money-transaction isolation + a hold-release authorization hole. Commit locally; STOP for Guy→Codex re-gate.
- **Origin:** Codex re-gate of `e0f808eb` = NO-GO. Architecture is sound and most of the slice is wired correctly; two critical promises are not met in code.

## 2. [P0-1] The case write can still ABORT the money transaction
`ON CONFLICT DO NOTHING` correctly prevents a unique conflict from poisoning the tx — **that part PASSES**. But `recordHumanQaHoldInTx` also performs reads, updates, and an explicit `throw` when a competing case is no longer active (`record-hold.ts:279`, `:294`), and the payment seams `await` it INSIDE the money tx (`webhooks/payme:219`, `payme/return:120`, `fake-payment`). **Any** rejection rolls back the paid transition + `PaymentRecord` + coupon confirmation. The money `where/data` are unchanged, but the FAILURE SURFACE changed.
**Required fix (Codex):** the money transaction must commit with `needs_human_qa` + the marker ONLY. Create the case/outbox in a **separate transaction immediately AFTER commit**, with the reconciler as the automatic repair for a failed post-commit write. (Alternative: a real DB savepoint/subtransaction that swallows the lifecycle failure.)
**⚠️ Cowork extension — apply the same rule to ALL 7 seams, not just payment:** a `throw` inside the readiness/safety/recovery/anchor park tx would roll back the HOLD ITSELF (an unheld order = a safety regression). **Never create the case inside any hold or money transaction.** This deliberately trades case-atomicity for hold/money integrity — the (fixed) reconciler is the guaranteed safety net that closes the window.

## 3. [P0-2] The anchor-release endpoint can release a safety/contract/payment hold
The marker is checked BEFORE the transaction (`anchor-hold-release:89`), but inside the tx `order.update` runs with **no CAS** on status or marker (`:122`). If a stronger hold arrived meanwhile — or the active case is `safety` while the Order was rewritten as anchor (possible via `skip_weaker`: the safety case stays active while the writer already replaced `deliveryHoldReason` with anchor, `record-hold.ts:161`, `:366`) — the resolver merely returns `null` (`record-hold.ts:437`) while the Order still becomes `ready` **and the email sends**.
**Required fix:** inside the release transaction, LOCK and RE-READ the Order and its cases; require the identical marker AND an active base case of kind `anchor` ONLY; perform the release as an `updateMany` CAS. Any active `safety`/`contract_world`/`payment_integrity` case → **409**, never released.

## 4. [P1-3] Reconciler "total classifier" — REJECTED as written
It takes every `needs_human_qa` (`reconcile-human-qa-holds.ts:96`) and maps unknown markers to `legacy_unknown` (`record-hold.ts:78`), so `base_book_integrity:*` — explicitly recoverable at the live seam (`hold-kind.ts:15`) — gets a case + a manual email; and if `ExceptionCase` repairs the order, the ready-branch closes only `anchor` (`readiness-manifest.ts:844`), leaving `legacy_unknown` active after delivery.
**Required fix:** skip `base_book_integrity`, `exception_case`, and orders with an active recovery case. Historical unknown/null markers require an explicit `--only` or `--include-unknown` — never automatic backfill.
**Also:** the reconciler is now LOAD-BEARING (it repairs failed post-commit case writes from §2) — it must reliably create cases for terminal MANUAL holds that lack one, while never creating one for recoverable holds.

## 5. [P1-4] Dev Creator poller broken for its own orders
`/api/generate/status` accepts only CUID (`status:30`), while Story Bank creates Orders with UUID (`story-bank:217`, `:333`) → poller #3 sends the correct key but gets 400 before auth. **Fix:** accept CUID **and** UUID (or stop replacing the Prisma id).

## 6. [P2] Three smaller fixes
1. Unauthenticated status requests trigger `sweepStaleGenerationJobs` (`status:121`) before the access-key check (`:180`) — no leak, but an expensive side effect without auth. Move auth first.
2. `no_operator_recipient` starts the 23h window before any provider call and then goes terminal `send_ambiguous`, so it will never send even after the env is fixed (`operator-notification-send.ts:229`, `:273`). A config failure must not consume the window or become terminal.
3. The send CAS checks `payloadHash` + case active + Order held but does **not** compare `holdFingerprint` as claimed (`:128`). Either compare it or drop the claim (prefer: compare it).

## 7. ACCEPTANCE CRITERIA
- No hold or money transaction can be aborted by case/outbox lifecycle logic — at ANY of the 7 seams. Money commits with hold+marker; the case is written post-commit in its own tx; a failed post-commit write is repaired by the reconciler.
- The anchor-release endpoint releases ONLY when, under lock/CAS, the marker is unchanged AND the sole active base case is `anchor`; any active safety/contract/payment case → 409, no release, no email.
- The reconciler skips recoverable holds and requires explicit opt-in for unknown markers; it reliably repairs missing cases for terminal manual holds.
- Status accepts CUID and UUID; auth runs before any expensive side effect.
- Notification config failure neither consumes the retry window nor goes terminal; the send CAS compares `holdFingerprint`.
- `npm run check` green (tsc via node; full vitest); all hold-DECISION outputs and money math still byte-unchanged.

## 8. TESTS
- A forced failure inside the case path at each seam leaves the money/hold write COMMITTED (the key regression: money+hold survive a case-write failure).
- The reconciler then creates the missing case (post-commit repair path).
- Anchor-release: stronger hold arriving mid-flight → 409, no release; safety case active while marker says anchor → 409.
- Reconciler skips `base_book_integrity`/`exception_case`/active recovery; `--include-unknown` required for unknown markers.
- Status: UUID order id works; auth precedes the sweep.
- Notification: missing recipient does not consume the window or become terminal; CAS rejects a fingerprint mismatch.

## 9. WHAT NOT TO TOUCH
Hold DECISION functions, money math, the board engine, Stage-1 safety semantics. No operator ACTION endpoints (Slice 4).

## 10. GIT + FINAL VERIFICATION
Explicit pathspecs; NEVER `git add -A`; commit per fix unit on `feat/chunked-generation`; Guy pushes. `npm run check` green; report each fix + the byte-unchanged proof. **Then STOP for Codex re-gate.**
**Deploy note (Codex):** `HUMAN_QA_NOTIFY_ENABLED=off` disables only the SENDER — case/outbox writes and the new status behavior are active regardless, so **the migration must be deployed BEFORE the code**, and run `prisma migrate status` on staging first (the back-dated coupon migration).
