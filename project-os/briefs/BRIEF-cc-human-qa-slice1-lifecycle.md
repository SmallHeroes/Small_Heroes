# BRIEF (CC) — Human-QA hold, Slice 1: lifecycle foundation (stop silent holds) — HARDENED

## 1. ROUTING + GATE
- **Executor:** Claude Code (CC). **Target:** `feat/chunked-generation` (`sh-wt-style01`). Branch pre-check first; single session.
- **Gate: [CODEX-GATE].** This slice touches the **safety parking, payment fences, public status auth, outbox delivery, and the existing anchor-release endpoint**. It must NOT change any hold **decision** function — only ADD case+notification around already-made decisions. Commit locally; STOP for Guy→Codex re-gate. Operator ACTIONS (release / re-render / cancel-refund) are **Slice 4 — NOT here.**
- **Origin:** Codex human-QA ruling + `FLOW-human-qa-hold-review.md` + Guy's slice-1 refinements. Today a held book parks SILENTLY (proven: cmrnuhsva railing safety-hold sat silently). This slice makes eligible holds VISIBLE without creating stuck cases.

## 2. ELIGIBLE HOLDS (do NOT create a case for everything)
`needs_human_qa` is also used by auto-recovery paths. Create a `HumanQaReviewCase` ONLY for **terminal manual holds**: `safety | contract_world | anchor | payment_integrity`. **Do NOT** create a case for recoverable `base_book_integrity` / infra / quality paths governed by `ExceptionCase` (they can auto-recover).

## 3. DO NOT EXTEND `HardHoldKind`
`HardHoldKind` belongs to the quality evaluator and encodes safety **precedence** (`quality-evidence.ts:40`); extending it to `anchor` is dangerous because existing code reads any non-safety as contract-world. Create a **separate** type:
```
type HumanQaHoldKind = 'safety' | 'contract_world' | 'anchor' | 'payment_integrity';
```

## 4. DATA INVARIANTS
- `HumanQaReviewCase`: `activeKey` nullable UNIQUE; `orderId+scope+revision` unique. Active statuses REQUIRE `activeKey`; terminal statuses REQUIRE `activeKey=NULL` (DB CHECK). Immutable `holdFingerprint` + evidence snapshot (kind, raw+human reason, source manifest, `inputVersion`, contract hash, artifact URLs/SHAs, revision, decision/actor/timestamps).
- **Same fingerprint = idempotent** (returns the same case + same outbox). **New fingerprint supersedes** the prior active case atomically (old snapshot stays immutable, becomes `superseded`, a new revision is created).
- `base_book` precedence: `safety > contract_world > anchor` — a weaker hold never replaces safety.
- `OperatorNotificationOutbox`: unique `dedupeKey`, `payloadHash`, `claimVersion`/lease, `sendAttempted`, `firstSendAttemptAt`, `providerMessageId`, `nextAttemptAt`, `lastError`. (Separate table — NOT `DeliveryOutbox`. Do NOT reuse `ExceptionCase`.)

## 5. ATOMIC WIRING — `recordHumanQaHoldInTx(tx, args)`
Implement one helper that **never decides whether to hold and never parses quality evidence** — it takes an already-made decision and adds case+outbox inside the SAME transaction as the existing Order write. Call it alongside the existing Order transition in ALL SEVEN seams:
1. readiness hard hold (`readiness-manifest.ts:810` — already atomic)
2. readiness-independent safety (`package-delivery.ts:126` — already in a tx)
3. quality-recovery hard park
4. anchor hold — readiness ON **and** OFF (legacy anchor: **wrap its two existing writes in a transaction**)
5. PayMe webhook coupon fence (`webhooks/payme/route.ts:210`)
6. PayMe return coupon fence (`payme/return/route.ts:113`)
7. fake-payment coupon fence (`fake-payment/confirm/route.ts:126`)
(5–7 = `payment_integrity`. Additive, same transaction — money outcomes unchanged.)

## 6. EXISTING ANCHOR-RELEASE ENDPOINT
`anchor-hold-release/route.ts:69` already releases an anchor hold → ready. It must, **in the same transaction that releases the Order**, close the active anchor review case and suppress its unsent notification. **Do NOT broaden what the endpoint is allowed to release.** (Without this, the Order releases but the case stays `open` forever.)

## 7. CUSTOMER STATUS
`/api/generate/status` must require `orderId+accessKey` and return **404 on mismatch** (it currently doesn't validate a key and even returns `lastError` — `status/route.ts:109`). For held orders return an **allowlisted** body only:
```
{ status: 'under_review', childName }
```
Do NOT return `lastError`, `deliveryHoldReason`, hazard data, artifact evidence, or `readUrl`. Update BOTH generating clients (`generating-client.tsx:42` React + `generating.js:113` legacy — neither sends the key today) and every dev/status caller. Poll `under_review` slowly, without overlapping requests.

## 8. OPERATOR SEND
Send only after an atomic CAS proves: outbox scheduled + case still active/open + Order still `needs_human_qa` + case fingerprint still matches the active hold. Known pre-send failures retry; ambiguous provider sends never blind-retry. Recipient = `HUMAN_QA_OPERATOR_EMAIL`; **missing config never releases the hold** (it just fails to notify, fail-closed). Payload has an admin deep link with **no customer access keys**.

## 9. DEEP-LINK TARGET
A link to a 404 is not "visible lifecycle." Either add a **minimal read-only admin-auth detail** in this slice, OR omit the deep link until Slice 2 builds the console. Do NOT ship a link to a non-existent page.

## 10. MIGRATION / RECONCILIATION
Migration alone won't create cases for already-held orders. Add an **idempotent backfill/reconciler** for existing terminal `needs_human_qa` orders without an active case (**including cmrnuhsva**, the order that proved the gap). Unknown legacy reasons → `kind=legacy_unknown` or reported for explicit operator handling.

## 11. WHAT NOT TO TOUCH
Any hold **decision** function (safety/readiness/anchor/payment outcomes must be byte-unchanged); money/coupon math; the board engine; `DeliveryOutbox`; `ExceptionCase`. No operator action endpoints (Slice 4).

## 12. GIT HYGIENE
Explicit pathspecs; NEVER `git add -A`. Commit per coherent unit on `feat/chunked-generation`; Guy pushes. **Run adversarial self-review, then STOP for Guy→Codex re-gate.**

## 13. TESTS
- Every eligible seam: Order hold + case + outbox commit-or-rollback together.
- Identical replay AND concurrent replay → exactly one case/outbox.
- Changed fingerprint supersedes; a weaker hold cannot replace safety.
- The existing anchor release resolves (closes) the case + suppresses its unsent notification.
- Payment fences create `payment_integrity` cases WITHOUT changing money outcomes.
- Send-time CAS suppresses released/superseded cases.
- Valid/invalid `accessKey`; minimal `under_review` payload (no evidence leak).
- Legacy reconciliation is idempotent.
- **Pure safety/readiness/anchor decision outputs are unchanged vs today** (the key regression proof).

## 14. FINAL VERIFICATION
- `npm run check` green (tsc via node; full vitest). Report the models/migration, the 7 wired seams, the release-endpoint hook, the `under_review` + accessKey changes, the reconciler, and confirm all hold-decision outputs are unchanged. Then STOP for Codex re-gate.
- Next: Slice 2 (read-only review console), Slice 3 (durable re-render), Slice 4 ([CODEX-GATE] actions).
