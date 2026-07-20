# BRIEF (CC) — delivery fence: make hold authority SHARED, not opt-in (Codex round-4 P0 ×2 + P1)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first. Single session, ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**. New commits on top of `d52e0126`.
- **Gate: [CODEX-GATE] + DECISION GATE.** Schema change + the core delivery path + every hold-writing seam. Commit locally; STOP for the Codex re-gate.
- **Origin:** Codex round-4 verdict = NO-GO. The §4 carried-forward question was correct and the answer is worse than the anchor case: **the normal delivery path can clobber a safety/payment hold and ship the book.** Every book in Preview traverses it (`READINESS_MANIFEST_ENABLED=true`).

## 2. SCOPE (what + why now)
**P0-1 — general force-ship on the golden path.** The package stage reads safety state once (`chunk-runner.ts:1981`) then calls readiness without `requireHold` (`package-delivery.ts:159`). Inside readiness: the last transactional fingerprint check is at `readiness-manifest.ts:707`, the Outbox + `ready` intent at `:819`, and the plain CAS matches **`id + inputVersion` only** (`:851`). `status`, `deliveryHoldReason` and `manualReviewRequired` are in neither `OrderTruth`, the fingerprint, nor the select (`:302`, `:543`, `:563`). Meanwhile safety recovery writes `safety_hold:` **without bumping `inputVersion`** (`exception-processor.ts:159`) and may then CLOSE the ExceptionCase (`:556`), so readiness's `activeException` check (`:776`) no longer sees it. Under PostgreSQL `READ COMMITTED` this interleaving is legal: readiness reads clean → safety parks → readiness CAS still matches `inputVersion` → the hold is overwritten to `ready` and the Outbox persists. **Real force-ship of an unsafe book.**

**P0-2 — anchor release still open in one combination.** The strong-case check runs in a separate authorization tx (`anchor-hold-release/route.ts:120`); the later CAS checks the marker and the payment flag but **not an active `HumanQaReviewCase`**. An unprotected normal path can overwrite `safety_hold:` back to an anchor marker while `skip_weaker` leaves the safety case active (`record-hold.ts:161`) → `requireHold` matches again → releases. Derived directly from P0-1.

**P1 — the atomic receipt ignores `requireHold`.** It is absent from the operation key and payload hash (`readiness-manifest.ts:505`), and an existing receipt short-circuits before the mutation and the CAS ever run (`atomic-operation.ts:183`). So a guarded call can collide with an older same-payload receipt and return a recorded result **without enforcing the precondition at all**.

**The fix (Codex-prescribed — implement as an architecture, not a patch):**
1. **Every** safety write, payment fence and hold write atomically bumps a monotonic delivery fence together with the evidence/hold write.
2. **Every** `ready` transition and every Outbox enqueue binds to that fence value.
3. The final CAS additionally blocks `manualReviewRequired`, any terminal marker, and any active strong Human-QA case.
4. `requireHold` remains a precise admin capability and is included in the receipt key/hash.
5. Real PostgreSQL tests (see §5) — mocked unit tests cannot prove `READ COMMITTED` interleavings.

**⚠️ Design judgment to make explicitly and report (Codex offered both):** bump `inputVersion` itself, or add a dedicated `deliveryFenceVersion`. **Cowork recommends the dedicated field**, because `inputVersion` already drives readiness invalidation, receipt identity and the TOCTOU retry loop — bumping it on every safety park would fire those side effects and widen the blast radius well beyond this fix. Confirm or refute with reasons; the re-gate will ask Codex to ratify the choice.

**Why now:** this is a P0 on the path every book takes. It is not currently reaching customers only because production cannot yet run this code at all (its DB is missing 11 tables — separate cutover consult). It **must** be closed before any production cutover.

## 3. FILES / AREAS
- `prisma/schema.prisma` + a new migration — the monotonic fence column on `Order`.
- `lib/generation-chunked/exception-processor.ts` (`:159`, `:556`) — safety park bumps the fence atomically with the hold write.
- `lib/human-qa/record-hold.ts` — hold/supersede writes bump the fence.
- Payment fences: `app/api/webhooks/payme/route.ts`, `app/api/payme/return/route.ts`, `app/api/dev/fake-payment/confirm/route.ts`.
- `lib/generation-pipeline/readiness-manifest.ts` — carry the fence in `OrderTruth` / select / fingerprint (`:302`, `:543`, `:563`, `:707`); bind the Outbox + `ready` to it (`:819`); tighten the final CAS (`:851`) with fence + `manualReviewRequired` + terminal marker + active strong case; include the capability + exact marker in the receipt key/hash (`:505`).
- `lib/generation-pipeline/atomic-operation.ts` (`:183`) — a differing capability/marker must not hit an older receipt.
- `app/api/admin/anchor-hold-release/route.ts` — the CAS also rejects an active strong `HumanQaReviewCase`.
- Test harness for real Postgres (§5).

## 4. ACCEPTANCE CRITERIA
- A safety park landing at ANY point during a normal readiness commit → the commit aborts; the order stays held; **no `ready`, no Outbox row survives**.
- Same for a payment fence.
- The anchor path cannot release while a strong Human-QA case is active, even when the marker reads anchor (the `skip_weaker` divergence).
- A guarded call can never be satisfied by a receipt recorded under a different capability or marker.
- Delivery authority is **shared** — no delivery path depends on a caller opting in.
- `npm run check` green (tsc via node; full vitest, ≥2059). Money/coupon math and hold DECISION outputs byte-unchanged.

## 5. TESTS
**Real PostgreSQL required** (mocked tests cannot express `READ COMMITTED` interleavings). Stand up a real-PG integration harness — testcontainers or a dedicated throwaway schema — and report which you used and how it runs in CI.
- `normal readiness × safety park` — interleaved at the window Codex describes → no ship.
- `normal readiness × payment fence` → no ship.
- `inputVersion change × requireHold` → converges to `ReleasePreconditionError`, never retried into a ship.
- Anchor release × active safety case with an anchor marker → 409.
- Receipt replay under a different capability/marker → precondition still enforced.
- Existing suites stay green.

## 6. WHAT NOT TO TOUCH
Hold DECISION functions (what constitutes a hold); money/coupon math; the board engine; Stage-1 safety semantics; the P0-B reconciler cron/core. No operator ACTION endpoints (Slice 4).
**Note:** the previous brief's "golden path byte-unchanged" constraint is now **explicitly lifted** for the delivery CAS — Codex observed that preserving it preserved the hole. Preserve *behaviour* for legitimate deliveries; the CAS itself must change.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`** (CRLF churn landmine); **no force-push, no rebase**; commit per coherent unit on `feat/chunked-generation`; commit locally, **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green. Report: the §2 fence-field decision with reasons, the fence-bump call sites (proving no hold write is missed), the final CAS shape, the receipt key/hash change, the real-PG harness, and the interleaving test output. **Then STOP for the Codex re-gate.**
