# BRIEF (CC) — Human-QA Slice 1: close Codex re-gate round 2 (2 P0 + 1 P1 + 1 P2)

## 1. ROUTING + GATE
- **Executor:** CC. **Target:** `feat/chunked-generation` (`sh-wt-style01`). Branch pre-check first (HEAD `5d9b4068`); single session.
- **Gate: [CODEX-GATE]** — hold-release authorization + the repair net that the whole slice's promise now rests on. Commit locally; STOP for Guy→Codex re-gate.
- **Origin:** Codex re-gate round 2 = NO-GO. Cowork independently re-verified all four findings against the files — they are correct, no push-back.

## 2. [P0-A] The release guard was added to ONLY ONE of two flag-gated paths
`anchor-hold-release/route.ts:96` — when `READINESS_MANIFEST_ENABLED=true` the handler calls `commitBaseBookReadiness` and **RETURNS** (`:127`), before the `FOR UPDATE`, the active-case guards, and the CAS that round 2 added. Everything below that branch is the readiness-OFF path only. So on readiness-ON:
- the exact `skip_weaker` divergence the round-1 P0 was about (safety/payment case ACTIVE while the marker still reads `anchor_low_confidence:`) **still releases**;
- a hold that changed after the pre-tx read is overwritten — `readiness-manifest.ts:787`,`:810` CAS on `id + inputVersion` only, and safety/payment updates do NOT bump `inputVersion`, so that CAS does not protect against them;
- **no `syncHumanQaHoldCasePostCommit`** on this path → even a legitimate release leaves the case open forever.
**Required fix:** ONE release-authorization routine, **flag-independent**, used by BOTH paths: lock the Order (`FOR UPDATE`), require the exact unchanged anchor marker, reject any active non-anchor base case or any active payment case (**409**), release via status+marker CAS, then call `syncHumanQaHoldCasePostCommit` after commit. The readiness branch must pass through it — not around it.
**⚠️ FIRST, REPORT THE FLAG VALUE** on staging and prod (`READINESS_MANIFEST_ENABLED`). Cowork could not read Vercel env from here. If it is `true` in the deployed envs, then round 2 hardened the path that does NOT run and the original P0 is fully open in the live config — say so explicitly. Either way the fix is the same: neither path may depend on a flag for its safety.

## 3. [P0-B] The "guaranteed repair" does not exist
- `sync-hold-case.ts:168` — the post-commit hook is a **bare `catch {}`**: no log, no metric, no counter. A failed case write is silent.
- `scripts/reconcile-human-qa-holds.ts` is a MANUAL script whose own header says it "Runs on Guy's machine against the STAGING DB", and `assertEnvSeparation()` (`:94`) **HARD-REFUSES prod**. It can never be the production repair net.
- `vercel.json:26` runs four crons — sweep, outbox, exceptions, **operator-notifications every 2 min** — and **no reconciler**. We automated SENDING the notification while the thing that CREATES the case it sends is a manual script. That asymmetry is the bug.
So the in-code claim "the reconciler is the guaranteed repair" is false, and a crash in the post-commit window leaves a **silent hold** — precisely what Slice 1 exists to eliminate.
**Required fix (Codex ruling, binding):**
1. A **scheduled reconciler runtime** — a cron endpoint alongside the existing four, same `CRON_SECRET` gate, `*/2 * * * *`, **flag-independent** (it must run even with `HUMAN_QA_NOTIFY_ENABLED=off`).
2. It must run in **production** → extract the shared reconcile core so the runtime does NOT inherit the script's `assertEnvSeparation()` staging-only guard. The manual script keeps its guard; the cron must not.
3. **SLA ≤ 5 minutes** from hold to case. Emit a metric for reconciler lag and the **age of the oldest hold missing a case**, with an alert.
4. Replace the bare `catch {}` with a logged + counted failure (it still must never throw into the seam).
5. **Preview/Staging: Vercel preview crons do not run** → an external scheduler (or a documented manual cadence) is required for the staging proof. State which you wired.

## 4. [P1] TOCTOU inside `syncHumanQaHoldCase`
It reads the Order (`:93`) and the ExceptionCase outside the write tx, classifies, then opens the case in a SEPARATE tx (`:140`) without re-reading the Order. A concurrent release flipping the Order to `ready` in between → an anchor case is opened on an ALREADY-RELEASED order. The send CAS suppresses the email, but the case stays open, and the reconciler scans only `needs_human_qa` (`:102`) so it never cleans it up.
**Required fix:** classify **and** record inside ONE transaction that re-reads/locks the Order, so the status the decision was made on is the status it is written against.

## 5. [P2] Doc/behaviour mismatch
`classifyHoldForCase` deliberately (and correctly) prioritises a terminal marker over an active recovery case (`sync-hold-case.ts:50`, `reconcile-derive.spec.ts:131`), but the script header claims active recovery is ALWAYS skipped. Fix the comment to match the code — behaviour stays.

## 6. ACCEPTANCE CRITERIA
- Anchor release runs the identical lock + exact-marker + active-case guards + CAS + post-commit case sync on **both** readiness ON and OFF; no safety/contract_world/payment hold is releasable on either; a legitimate release closes the case on both.
- A scheduled, flag-independent, prod-capable reconciler exists; the post-commit failure path is logged and counted; reconciler lag + oldest-missing-case age are observable.
- Classify+record happen under one tx with an Order re-read; no case can be opened against a released order.
- `npm run check` green (tsc via node; full vitest). Hold DECISION outputs and money math still byte-unchanged.

## 7. TESTS
- **Mirror every adversarial release test for readiness ON and OFF** — the existing suite is explicitly `flag-off` (`anchor-hold-release-isolation.spec.ts:116`) and that is exactly how this shipped half-fixed. Same assertions, both flag states: stronger hold mid-flight → 409; safety case active while marker reads anchor → 409; legitimate release → released AND case closed.
- Post-commit write fails → hold committed, failure logged/counted, scheduled reconciler creates the case within the SLA.
- Concurrent release during `syncHumanQaHoldCase` → no case opened on a `ready` order.
- Reconciler cron: CRON_SECRET-gated, idempotent, runs with notify flag off.

## 8. WHAT NOT TO TOUCH
Hold DECISION functions, money math, the board engine, Stage-1 safety semantics, `DeliveryOutbox`, `ExceptionCase`. No operator ACTION endpoints (Slice 4).

## 9. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; commit per fix unit on `feat/chunked-generation`; Guy pushes.

## 10. FINAL VERIFICATION
`npm run check` green. Report: the flag value on staging+prod (§2), the unified release routine with both paths proven, the cron path/schedule/metrics, and the byte-unchanged proof. **Then STOP for Codex re-gate.**
**Deploy note (unchanged, binding):** the migration must deploy **BEFORE** the code; run `prisma migrate status` on staging first (back-dated coupon migration). `HUMAN_QA_NOTIFY_ENABLED=off` disables only the SENDER.
