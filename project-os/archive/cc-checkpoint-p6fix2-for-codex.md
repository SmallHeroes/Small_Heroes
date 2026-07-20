# #6-fix-2 checkpoint — regen-rescue real teeth (redrive needs_human_qa). For Codex gate → #7-a CLOSED.

**Branch:** `feat/chunked-generation`. **Commit:** `7a66a6c2` (1 commit, green). **Flag:** `READINESS_MANIFEST_ENABLED` OFF. **Renders:** 0.
**Gate:** `npm run check` = **1042 pass / 3 skip (staging), tsc clean, exit 0**. Migrations: none (no schema change).

## The bug (Claude re-verify P1, from #6-fix)
The #6-fix regen-rescue (`handleRecoveryRetry`: clear failed page/cover asset → `redriveGeneration`) was a **silent no-op**.
`startChunkedGeneration` (start.ts) rejected `needs_human_qa` orders with `'Already completed'` (`started:false`) — no
`exception_case_recovery` carve-out. So the rescue **deleted** a failed asset but **never re-rendered** it; the 5b durable
budget was never consumed; and the case only reached refund after ~3 no-op recovery ticks hit
`EXCEPTION_MAX_RECOVERY_ATTEMPTS=3` (the attempts cap, NOT the intended budget path). Cursor had found + fixed the
start.ts half (uncommitted) but it was never integrated into #6-fix.

## The fix (3 parts, all in `7a66a6c2`)

1. **start.ts carve-out** (integrated from Cursor's uncommitted change + spec):
   - `RECOVERY_REDRIVE_REASON = 'exception_case_recovery'` — the exact literal `defaultDeps.redriveGeneration` passes.
   - `needs_human_qa` is claimable **ONLY** under that reason: guard is `(status === 'needs_human_qa' && !recoveryRedrive)`
     so **normal starts still return `'Already completed'`** and touch neither the job nor the order; `claimableStatuses`
     adds `'needs_human_qa'` only when `recoveryRedrive`. `ready`/`partial` stay blocked unconditionally.
   - `computeRegenResumeJobPatch(orderId)` derives `imagesDone = hasCover && allPagesRendered` from **surviving** assets
     (cover=`coverImageUrl?.trim()`; pages=`pages.every(p => p.imageAsset != null)`). A cleared page/cover forces
     `imagesDone:false` + `packaged:false` + `completedAt:null`, so the resumed worker re-renders **exactly** the cleared
     artifact while intact assets are skipped. Job reset also clears `lockedBy`/`leaseExpiresAt`; order claim is a fenced
     `updateMany WHERE status IN claimableStatuses → generating`.

2. **exception-processor — `started:false` handled distinctly**: a non-started redrive is surfaced with a distinct
   reason `quality_regen_rescue_redrive_not_started` + non-null `lastError` (falls back to `'redrive_not_started'`), so a
   no-op is **never** masqueraded as a successful rescue (which sets `lastError` null). Clear-then-redrive ordering: the
   asset is cleared BEFORE redrive; a `started:false` leaves the asset cleared but the case surfaced (retry_scheduled,
   bounded to refund by the attempts cap — no stuck/blank deliverable).

3. **Integration test proves real teeth end-to-end** (`exception-processor.spec.ts`, `describe('#6-fix-2 …')`): stateful
   `regenCount`; each started redrive increments it. tick 1 (regenCount 0→1) rescues, tick 2 (1→2) rescues, tick 3
   (regenCount 2 = budget) → NO rescue → `recommitReadiness` → BUDGET-driven `quality_failed` refund. Asserts
   `redriveGeneration` called **2×**, `recommitReadiness` **1×** — budget consumed, not the attempts-cap no-op. Plus the
   FIX-#2 test (non-started redrive → `lastError === 'Already completed'`, distinct from a successful rescue's null).
   New spec `start-recovery-redrive.spec.ts` (3 tests): normal start rejects needs_human_qa; recovery redrive claims
   needs_human_qa→generating + imagesDone:false; cover-cleared → imagesDone:false.

## Files (4)
`lib/generation-chunked/start.ts` · `lib/generation-chunked/exception-processor.ts` ·
`lib/generation-chunked/__tests__/start-recovery-redrive.spec.ts` (new) · `lib/__tests__/exception-processor.spec.ts`.

## Adversarial re-verify (ultracode, 4 lenses × refute-by-default, 15 agents) — CLEAN
11 candidates → **9 CONFIRMED (all info-level POSITIVE confirmations), 2 refuted, 0 uncertain, 0 actionable defects.**
Every lens confirmed against exact source: reason matches exactly + no leak to normal starts; rescue has real teeth
(clears + redrives for regenCount<2, skips ≥2 → recommit); durable budget monotonic + bounded at 2 (reserver bound
flag-on cover chunk-runner:855-856 / page :1210-1212, conditional increment); refund budget-driven and reached BEFORE
the attempts cap; `started:false` surfaced distinctly; clear-then-redrive safe; no stuck/blank deliverable.

## For Codex to weigh (NOT a #6-fix-2 regression — surfaced by the audit)
- **Recovery-reason spoofing (authenticated, low):** `/api/generate/start/route.ts` forwards a caller-supplied `reason`
  verbatim, so a holder of `GENERATION_SECRET` could pass `'exception_case_recovery'` to invoke the carve-out on a
  `needs_human_qa` order directly. This is authenticated spoofing of the recovery path, NOT a leak to a non-recovery
  reason. Consider restricting the recovery reason to the internal processor call site (reject it at the public route).
- **Backlog / confirm-with-Codex (blocker-1 residual, carried from #6-fix, my re-verify ruled acceptable/fail-closed):**
  persist `qaContext` BEFORE the asset so the missing-row window can't strip context.

## Order
integrate → Claude re-verify (DONE, clean) → **Codex gate** → #7-a CLOSED. Flag stays OFF. Push from your terminal.
