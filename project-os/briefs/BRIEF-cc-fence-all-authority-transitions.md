# BRIEF (CC) — bind the fence to EVERY Order authority transition (Codex round-5: 2 P0 + P1 + P0-tooling)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first. Single session, ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**. New commits on top of `23b99e0e`.
- **Gate: [CODEX-GATE] + DECISION GATE.** The production delivery path (readiness OFF) is in scope. Commit locally; STOP for the Codex re-gate.
- **Origin:** Codex round-5 = NO-GO. The ship CAS **PASSED**; the dedicated `deliveryFenceVersion` was **ACCEPTED**. The defect is coverage of transitions, not the primitive.

## 2. SCOPE (what + why now)
**The conceptual error to correct, stated once:** the fence is currently **bumped** by hold writes but **not bound** by them. A write that increments the fence without also matching it in its `WHERE` provides no protection. *Bump ≠ bind.* Every Order authority write needs both.

**P0-1 — the readiness HOLD write can overwrite a stronger hold.** `readiness-manifest.ts:948` writes a new marker under `where: { id, inputVersion }` only. Legal race: readiness reads fence=0 → a safety park writes `safety_hold:` and bumps to 1 (`exception-processor.ts:170`) → the Human-QA case is created later in a separate tx → readiness writes a WEAK hold (anchor / base-integrity), **overwriting the safety marker** and bumping to 2 → the case sync then reads the weak marker and never opens a safety case (`sync-hold-case.ts:127`) → a later ship CAS sees no terminal marker and no strong case → **it ships.** This is also why P0-2 from round 4 is not fully closed.

**P0-2 — the legacy (readiness OFF) path is entirely unfenced.** `package-delivery.ts:181` does an **unconditional** `prisma.order.update({ where: { id } })` to `ready`, then direct-sends at `:221`. A payment/safety hold arriving after `safetyGate` is read and before that update is silently overwritten. **Production runs `READINESS_MANIFEST_ENABLED=false` — so this is the PRODUCTION delivery path, not a legacy curiosity.** Note the in-code comment says these writes "stay bare … byte-unchanged": that constraint came from an earlier Cowork brief and is now **explicitly lifted** — it is preserving the bug.

**P1 — receipt and Outbox do not carry the fence.** The receipt key includes `inputVersion`, `inputsHash`, anchor and capability but **not** `deliveryFenceVersion` (`readiness-manifest.ts:543`), so a ship call after a fence bump can be satisfied by an older replay without running the CAS. Outbox send-time checks only `inputVersion` + status (`:1072`); its link to the fence is currently incidental (same transaction) rather than explicit.

**P0-tooling — the PG harness is dangerous.** It unconditionally drops `"Order"` and `"HumanQaReviewCase"` (`delivery-fence.pg.spec.ts:32`). Two wrong env vars destroy staging. **`assertEnvSeparation()` is NOT a suitable guard here — it self-disables on Vercel Production (`env-separation-guard.ts:61`).**

**The rule to implement (apply uniformly, do not special-case):** every write that changes `Order.status`, `deliveryHoldReason` or `manualReviewRequired` must (a) **bind** the observed `deliveryFenceVersion` in its `WHERE`, (b) **bump** it in its `data`, and (c) on 0 rows **never overwrite** — leave the existing hold in place and re-evaluate/abort. Additionally, a **weaker hold must never overwrite a stronger marker** (safety > contract_world > anchor/integrity), independent of the fence.

## 3. FILES / AREAS
- `lib/generation-pipeline/readiness-manifest.ts` — the HOLD/FAIL branch (`:948`) binds + bumps + never-overwrites; add the fence to the receipt `operationKey`/`payloadHash` (`:543`) **without breaking idempotency of a HOLD that bumps the fence itself**; carry the fence explicitly into the Outbox and its send-time check (`:1072`).
- `lib/generation-pipeline/package-delivery.ts` — the legacy ready write (`:181`) and the legacy park become fence-bound CAS writes; **no delivery on 0 rows** (the direct send at `:221` must be unreachable when the CAS did not win).
- `lib/generation-chunked/exception-processor.ts`, the three payment fences, and any other Order authority write — audit each for bind-and-bump + hold precedence.
- `lib/__tests__/delivery-input-writer-coverage.spec.ts` — extend into the **structural fence guard** (§4).
- `lib/generation-chunked/__tests__/delivery-fence.pg.spec.ts` — the dedicated fail-closed guard (§4).

## 4. ACCEPTANCE CRITERIA
- **Enumerate every Order authority transition in the report** (ready / hold / fail / park / release, both flag states) and show, per transition, that it binds + bumps + refuses to overwrite on 0 rows. Codex's finding is that we keep fixing these one at a time — the deliverable is the complete set, not the two named.
- A weak hold can never overwrite a stronger marker; the case sync therefore always sees the strongest marker.
- Legacy (readiness OFF) cannot ship past a hold that landed mid-flight, and cannot send the email when its CAS lost.
- A ship call after a fence bump can never be satisfied by an older receipt replay; HOLD idempotency is preserved.
- **Structural writer guard (Codex: MANDATORY):** the build FAILS if any write touches `status`/`deliveryHoldReason`/`manualReviewRequired` without binding+bumping the fence. The current guard is insufficient — those fields are absent from its field set (`:8`) and raw SQL is exempted **per whole file** (`:289`). Move to per-statement analysis; no blanket file exemptions.
- **PG harness guard (Codex: MANDATORY before CI or any further run):** dedicated, fail-closed, allowing only a local/CI database with a dedicated name; **prefer a temporary schema over dropping public tables**. Do not rely on `assertEnvSeparation()`.
- `npm run check` green; money/coupon math and hold DECISION functions byte-unchanged.

## 5. TESTS
Extend the real-PG harness (Codex: the current proof is good but partial — it does not cover these):
- **HOLD vs HOLD** — a safety park lands, readiness then writes a weak hold bound to the stale fence → 0 rows, the safety marker **survives**, the case sync opens a safety case.
- **Legacy path** — a hold lands mid-flight → the legacy CAS loses → not shipped, **no email sent**.
- **Receipt replay** — a ship after a fence bump cannot be satisfied by the older receipt; a HOLD re-run stays idempotent.
- **Outbox** — an enqueue bound to a stale fence does not survive / is not sent.
- Keep the existing 11 (including the three positive controls) green.

## 6. WHAT NOT TO TOUCH
Hold DECISION functions (what constitutes a hold); money/coupon math; the board engine; Stage-1 safety semantics; the reconciler cron. No operator ACTION endpoints (Slice 4).
**The "legacy writes stay bare / byte-unchanged" constraint from the earlier brief is LIFTED** — it is the direct cause of P0-2.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; **no force-push, no rebase**; commit per coherent unit on `feat/chunked-generation`; commit locally, **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green. Report: the complete transition table from §4, the guard's per-statement analysis approach, the harness guard design, and the extended PG run output. **Then STOP for the Codex re-gate.**
