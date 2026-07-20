# BRIEF (CC) — fence round-5 CONTINUATION: the production send path + the funnel + the guard

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC, **fresh session** (the prior session correctly stopped before this work — it touches the customer email send path).
- **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first; HEAD should be `ee670a17`. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**.
- **Gate: [CODEX-GATE] + DECISION GATE.** Commit locally per unit; STOP for the Codex re-gate.

## 2. SCOPE (what + why now)
Continues `BRIEF-cc-fence-all-authority-transitions.md`. **Already done and verified** (Cowork re-checked both against the files): `7355e2f1` fail-closed PG harness (guard throws at module scope before any DDL; dedicated schema; `public` never touched) and `ee670a17` readiness HOLD write now genuinely BINDS the fence (`WHERE … AND "deliveryFenceVersion" = <observed>`) with `markerRank` precedence.

**Remaining, in this order — highest stakes first:**

**Unit 1 — P0-2, the PRODUCTION delivery path.** `package-delivery.ts:181` writes `ready` unconditionally then direct-sends at `:221`. Production runs `READINESS_MANIFEST_ENABLED=false`, so this is the live customer path. Route the legacy ready write through `executeReadinessShipCas` (read fence + inputVersion first) and the legacy park through `writeOrderHoldFenced`. **The email must be gated on the CAS winning — 0 rows ⇒ no send, no exceptions.** Land this alone and verify it before touching anything else.

**Unit 2 — the funnel.** Convert the remaining authority writes to `writeOrderHoldFenced`: the `package-delivery` safety park, the `exception-processor` safety/contract park, and the three payment fences (safety = rank 3, always wins; payment sets `manualReviewRequired`).

**Unit 3 — P1 receipt + Outbox.** Add `deliveryFenceVersion` to the receipt `operationKey`/`payloadHash` **while preserving HOLD idempotency** (a HOLD that bumps its own fence must still replay correctly — this is the subtle part; if you cannot preserve both, STOP and report rather than guessing). Carry the fence explicitly into the Outbox row and its send-time CAS (`readiness-manifest.ts:1072`).

**Unit 4 — the structural guard (Codex: MANDATORY).** ⚠️ **Simplification worth taking:** once every authority write goes through `order-authority.ts`, the guard does not need general per-statement analysis of arbitrary writes. Make the funnel **the only legal path** and have the guard fail the build on *any* write to `status`/`deliveryHoldReason`/`manualReviewRequired` that originates outside `order-authority.ts`. That is simpler, stricter and far more durable than extending the current field-set/whole-file-exemption approach (`delivery-input-writer-coverage.spec.ts:8`, `:289`). If some site genuinely cannot use the funnel, report it rather than adding a blanket exemption.

**Unit 5 — extended real-PG tests:** HOLD-vs-HOLD (a weak marker cannot clobber a safety hold; the case sync then sees the safety marker), legacy-loses-CAS (not shipped, **no email**), receipt replay after a fence bump, Outbox bound to a stale fence.

## 3. FILES / AREAS
`lib/generation-pipeline/package-delivery.ts` (Units 1–2) · `lib/generation-chunked/exception-processor.ts` + `app/api/webhooks/payme/route.ts` + `app/api/payme/return/route.ts` + `app/api/dev/fake-payment/confirm/route.ts` (Unit 2) · `lib/generation-pipeline/readiness-manifest.ts` receipt key + Outbox (Unit 3) · `lib/__tests__/delivery-input-writer-coverage.spec.ts` or a new guard spec (Unit 4) · `lib/generation-chunked/__tests__/delivery-fence.pg.spec.ts` (Unit 5) · `lib/generation-pipeline/order-authority.ts` (shared funnel, extend as needed).

## 4. ACCEPTANCE CRITERIA
- **Update and include the transition table** — every Order authority write (ready / hold / fail / park / release, both flag states) shown as binds + bumps + never-overwrites, with no row left as "remaining". The complete set is the deliverable; the prior five rounds each fixed only the named instance.
- Legacy (readiness OFF) cannot ship past a hold that landed mid-flight and **cannot send the email when its CAS lost**.
- A weak hold can never overwrite a stronger marker anywhere; the case sync always sees the strongest.
- A ship after a fence bump cannot be satisfied by an older receipt replay; HOLD idempotency preserved.
- The build FAILS if any authority write bypasses the funnel.
- `npm run check` green; money/coupon math and hold DECISION functions byte-unchanged.

## 5. TESTS
Per Unit 5 above, plus keep the existing 11 PG tests (including the three positive controls) green and the full mocked suite green. Each unit will break batches of mocked tests asserting the old Prisma write shapes — adapt them the same way as in `ee670a17`.
**Real-PG run:** Docker is available on Guy's machine (`postgres:16` on port 55432, DB `fence`) — request the run rather than assuming; the harness is now fail-closed and refuses anything that is not a dedicated local throwaway.

## 6. WHAT NOT TO TOUCH
Hold DECISION functions; money/coupon math; the board engine; Stage-1 safety semantics; the reconciler cron. No operator ACTION endpoints (Slice 4). The "legacy writes stay bare / byte-unchanged" constraint remains **LIFTED**.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; **no force-push, no rebase**; **one commit per unit** on `feat/chunked-generation`; commit locally, **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green. Report the completed transition table, the funnel-guard design, the receipt/Outbox idempotency reasoning, and the extended PG output. **If Unit 3's dual constraint (fence in the key + HOLD idempotency) proves unresolvable, STOP and report — do not guess.** Then STOP for the Codex re-gate.
