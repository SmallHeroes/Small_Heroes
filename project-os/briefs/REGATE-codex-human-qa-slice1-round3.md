# CODEX RE-GATE (round 3) — Human-QA Slice 1: round-2 NO-GO fixes + the anchor-release forward fix

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only static audit + tx/concurrency reasoning; cite `files:lines`.
- **Branch:** `feat/chunked-generation`. **Diff range `5d9b4068..HEAD`.** Commits: `17d1dd0e` (P1 + P0-B), `8f7d254f` (P0-B cron + P2), `519b89f4` (P0-A authorization), `b1d14a91` (forward fix: authorization vs delivery). Also in range but orthogonal: `037a1e8c`, `194babea`, `2ada0d4a` (docs + a front-end consolidation cherry-pick; touch no human-qa/money file).
- **Gate: [CODEX-GATE]** — hold-release authorization, delivery integrity (double-send to a paying customer), and the repair net the slice's promise rests on. Verdict decides whether Slice 1 may deploy to staging.
- ⚠️ `519b89f4` is **already pushed and deployed to QA**; `b1d14a91` is a forward fix on top (no force-push). Judge the **net effect** of the range.

## 2. ORIGIN / CONTEXT
Your round-2 verdict was NO-GO (2 P0 + 1 P1 + 1 P2). Cowork independently re-verified every finding against the files and did not push back. What changed:
- **P0-A** — the release guard existed only on the readiness-OFF path (an early `if (isReadinessManifestEnabled()) { … return }` sat above it). `519b89f4` removed the flag branch so both states shared one authorization routine — **but it also deleted the flag-on Manifest/Outbox delivery**, violating the stated invariant at `package-delivery.ts:104` ("flag-on: Manifest + readiness + Outbox only; never a direct email") and losing effectively-once delivery, the `OutboxReconciliationError`→409 guard, and the staleness re-eval. That regression came from ambiguous wording in Cowork's brief. `b1d14a91` re-splits it: **authorization** flag-independent, **delivery** flag-dispatched.
- **P0-B** — the "guaranteed repair" did not exist (bare `catch {}`; manual script that hard-refuses prod; no cron). Now: logged+counted failure, extracted prod-capable `lib/human-qa/reconcile-core.ts` (no `assertEnvSeparation`; the manual script keeps it), and `GET /api/generate/cron/human-qa-reconcile` at `*/2 * * * *`, CRON_SECRET-gated, flag-independent, emitting `oldestMissingCaseAgeMs` + `slaBreached` (5-min SLA per your ruling).
- **P1** — `syncHumanQaHoldCase` now re-reads the Order under `FOR UPDATE` and classifies+records in one tx.
- **P2** — reconciler header comment corrected.
- `READINESS_MANIFEST_ENABLED` **exists** in the Vercel env; its value could not be read from either agent session. Both paths are therefore built to be safe regardless.

## 3. VERIFY (cite files:lines)
1. **Authorization is genuinely flag-independent** — no path reaches delivery without the `FOR UPDATE` re-read, the exact-unchanged-marker check, and the active non-anchor-base / active-payment case rejections (409). Confirm no early return, on either flag state, skips it (this is the exact defect class of round 2).
2. **Flag-ON delivery integrity restored** — delivery goes through `commitBaseBookReadiness`/Outbox only; **no** direct `sendBookReadyEmail`; `OutboxReconciliationError` → 409; `viaOutbox` shape; the `package-delivery.ts:104` invariant holds. A customer cannot be emailed the same book twice on **either** flag state.
3. **Flag-OFF unchanged** — the `519b89f4` behaviour (status+marker CAS, in-tx case close, one direct send).
4. **P0-B repair net** — the cron is registered, CRON_SECRET-gated, flag-independent (runs with `HUMAN_QA_NOTIFY_ENABLED=off`), prod-capable, idempotent; the post-commit failure is logged+counted and still never throws into the seam; the SLA/lag metrics are actually emitted.
5. **P1** — no case can be opened against an order that concurrently reached `ready`; the pure `classifyHoldForCase` body is byte-unchanged (only call-sites moved).
6. **No regression** — hold DECISION outputs and money/coupon math byte-unchanged; tsc 0; vitest 2053 passed / 25 skipped / 0 failed (baseline 2029).

## 4. ⚠️ JUDGMENT CALL — Cowork's open concern, please rule
**On flag-ON the authorization tx commits and RELEASES ITS LOCK, then `commitBaseBookReadiness` runs in a SEPARATE transaction.** In that cross-transaction window a stronger hold (safety / payment_integrity) can land. Your round-2 finding established that `commitBaseBookReadiness` updates the Order on **`id + inputVersion` only**, and that safety/payment updates do **not** bump `inputVersion` — so its CAS would not catch such a hold.
CC's in-code defence is that the guard "has already rejected any stronger PRE-EXISTING hold, so a stale re-park is the only thing readiness can do." Cowork's concern: *pre-existing* is doing the work in that sentence — the guard cannot see a hold that arrives after it runs. The window is much narrower than the round-2 defect, but it appears to be the same gap in a smaller form.
**Rule on:** is this window a real P0/P1, or adequately mitigated (e.g. does `commitBaseBookReadiness` independently re-evaluate the safety marker and re-park, given Stage-1 safety is readiness-INDEPENDENT)? If it is real, what is the correct close — extending the readiness Order-update CAS to include `status` + `deliveryHoldReason`, an authorization intent marker the readiness path must honour, or holding the lock across delivery? Cowork deliberately does **not** self-certify this; it is delivery-under-race, the category where its verification has repeatedly under-called.

## 5. MIGRATION / DATA
No new migration in this range (all code). The original Slice-1 migration `20260718_human_qa_review_case` still binds: **deploy the migration BEFORE the code** (`HUMAN_QA_NOTIFY_ENABLED=off` disables only the SENDER — case/outbox writes and the new status behaviour are active regardless), and run `prisma migrate status` on staging first because of the back-dated coupon migration.

## 6. NO-REGRESSION
Hold DECISION functions, money/coupon math, the board engine, Stage-1 safety semantics, `DeliveryOutbox`, `ExceptionCase` — all must be behaviourally unchanged.

## 7. PROOF BOUNDARY
Static re-gate. Not provable in CI: the scheduled reconciler actually firing in a deployed env (**Vercel Preview crons do not run** → the staging proof needs an external scheduler or a manual CRON_SECRET `curl`), and a real held order producing case → notification → `under_review`.

## 8. OUTPUT
Verdict **GO / NO-GO to deploy Slice 1 to staging**, P0/P1/P2 as `files:lines`, plus an explicit ruling on §4. Focus scrutiny on §3.1 (no path skips authorization on either flag), §3.2 (no double-send), §4 (the cross-transaction window), and §3.4 (the repair net is real).
