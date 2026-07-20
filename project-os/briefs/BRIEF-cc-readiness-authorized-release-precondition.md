# BRIEF (CC) — thread the authorized-release precondition into `commitBaseBookReadiness` (Codex round-3 P0 close)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first. Single session, ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**. One new commit on top of `b1d14a91`.
- **Gate: [CODEX-GATE] + DECISION GATE.** This touches `commitBaseBookReadiness` — a shared production function on the golden delivery path — which the previous brief explicitly fenced ("do not change its decision logic"). You were right to stop and ask rather than implement unilaterally. Commit locally; STOP for the Codex re-gate.
- **Origin:** Codex round-3 verdict = NO-GO on one blocker. §3.1–3.6 all PASS; the §4 flag-ON cross-transaction window is a **real force-ship path**.

## 2. SCOPE (what + why now)
**The defect (Codex-confirmed):** on flag-ON the authorization tx commits and releases its lock, then `commitBaseBookReadiness` runs in a separate tx. Its final Order write CASes on **`id + inputVersion` only** (`readiness-manifest.ts:813–815`), a safety hard-park does **not** bump `inputVersion` (`exception-processor.ts:170,172`), and `commitBaseBookReadiness` never re-reads `deliveryHoldReason`/`manualReviewRequired`. So a safety hold landing in that window is clobbered to `ready` and Outbox-enqueued → **an unsafe book ships to a paying customer.** Same defect class as round-2 P0-A in a smaller form, and precisely what Stage-1 safety must never permit.

**The close (Codex-prescribed, implement as specified):** thread the authorized release precondition into the flag-ON readiness commit. Its final Order write must require `status='needs_human_qa'` **AND** the exact authorized `deliveryHoldReason` **AND** no payment fence. On mismatch → abort → typed **409**, no Outbox delivery, nothing shipped.

**Explicitly rejected alternatives (do not implement):** holding the authorization lock across readiness; flipping to `ready` inside the authorization tx (both fight readiness's retry/manifest ownership); a broad `status`/`reason` CAS — it must compare against the **authorized anchor marker specifically**, or a reloaded readiness pass could re-observe and then clobber a newer stronger marker.

**Blast-radius requirement:** the precondition is **opt-in**. The normal post-generation caller passes nothing and its behaviour is byte-unchanged. Only the flag-ON anchor-release path supplies it.

**Why now:** exposure is inert unless `READINESS_MANIFEST_ENABLED === 'true'` on the deployed env (value still unconfirmed) and is admin break-glass only — but this is the last open blocker on Slice 1, and it is a safety-ship path.

## 3. FILES / AREAS
- `lib/generation-pipeline/readiness-manifest.ts` — **primary**: add the optional authorized-release precondition (e.g. `expectedHoldReason` / `requireHold`) and tighten the final Order CAS when it is supplied. Do **not** change decision logic for callers that omit it.
- `app/api/admin/anchor-hold-release/route.ts` — flag-ON branch passes the authorized `holdReason` through; map an aborted precondition to a typed 409 (distinct from `OutboxReconciliationError`).
- `lib/__tests__/anchor-hold-release-isolation.spec.ts` — add the mid-window adversarial test.
- Readiness specs — prove the no-precondition caller path is unchanged.

## 4. ACCEPTANCE CRITERIA
- Flag-ON: a safety (or payment) hold landing **between** the authorization commit and the readiness commit → readiness write aborts → typed 409 → **no Outbox enqueue, no `ready`, nothing shipped**.
- The precondition compares against the **exact authorized anchor marker**, not merely "some hold present".
- Callers that omit the precondition (the normal post-generation delivery path) are **behaviourally byte-unchanged** — proven by diff and by the existing readiness suite staying green.
- The round-3 authorization matrix and per-flag delivery assertions all still pass on both flag states.
- Hold DECISION outputs and money/coupon math byte-unchanged.

## 5. TESTS
- Flag-ON, safety park lands mid-window → 409, no Outbox, order still `needs_human_qa`.
- Flag-ON, payment fence lands mid-window → same.
- Flag-ON, clean path → releases via Outbox exactly as today.
- Flag-OFF → unchanged.
- Normal post-generation readiness commit (no precondition supplied) → unchanged, existing specs green.
- Repeated release calls still deliver exactly once on both flag states.

## 6. WHAT NOT TO TOUCH
`commitBaseBookReadiness`'s decision logic for callers that supply no precondition; the `b1d14a91` authorization routine; the P0-B reconciler cron/core; hold DECISION functions; money/coupon math; the board engine; Stage-1 safety semantics; `DeliveryOutbox`; `ExceptionCase`. No operator ACTION endpoints (Slice 4).

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`** (CRLF churn landmine); **no force-push, no rebase** — one new commit on top of `b1d14a91` on `feat/chunked-generation`; commit locally, **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green (tsc via node; full vitest, ≥2053). Report: the precondition's exact CAS shape, the typed-409 mapping, the byte-unchanged proof for the no-precondition caller, and the mid-window test output. **Then STOP for the Codex re-gate.**

**⚠️ Question to carry into that re-gate (do NOT resolve here):** if `commitBaseBookReadiness` can clobber a concurrent safety park when called from anchor-release, can the **normal post-generation caller** clobber one the same way — i.e. is this a general force-ship window on the golden path rather than an anchor-release-specific one? Out of scope for this commit; Codex should rule on it explicitly.
