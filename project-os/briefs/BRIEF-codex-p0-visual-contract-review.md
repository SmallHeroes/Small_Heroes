# BRIEF → Codex — P0 Visual-Contract Slice Review (round-2, whole-slice)

**Task title:** Gate the P0 visual-contract slice (Template → ResolvedBookVisualContract → hash/freeze/QA) before ANY P1.
**Why now:** Slice is implementation-complete, `npm run check` green (1321 pass / 15 skip), **UNPUSHED on `feat/chunked-generation`**, and it is **money-adjacent** — it changes what the atomic freeze HASHES. Per DEC-002 it must clear Codex before P1. This is the critical path to unblock push + P1 (OQ-T2).
**MVP category:** launch blocker (engine).
**Assigned agent:** Codex (technical gatekeeper). Implementation NOT permitted in this task — review only.

**Context:**
- Read the whole-slice package: `cc-checkpoint-p0-visual-contract-for-codex.md` (repo root, most recent). PART 2 = the round-2 ask.
- Round-1 verdict already recorded there: atomic mechanics PASS (resume-reuse, deterministic hash, `mutationPayload` 100%, no receipt/outbox/refund/readiness-txn change) + 3 fail-closed COMPLETENESS gaps. All 3 fixed in round-2.
- Design intent (DEC-002): recurring HUMANS only (mother/doctor/…) get one authoritative structured trait source, deterministically resolved per order; child + companion locks unchanged.

**Allowed files/areas (read + verify):**
- `lib/visual-contract-compiler/contractTemplateTypes.ts`
- `lib/**/validateTemplateContract.ts`, `validateResolvedContract.ts`, vNext validator it imports
- The materializer / palette (`f6e7bdf5`) + template loader / family adapter / materialize→freeze wiring (`4fb613d2`)
- Round-2 HOLD fixes: `7e45bcd9` (Fix 1), `d1b7b7b8` (Fix 2), `c5f28b20` (Fix 3)
- Review commits in order; round-1 slice = `git diff f69795b6..4fb613d2`; round-2 = `4fb613d2..c5f28b20`.

**Forbidden files/areas:** No edits anywhere. Do not push/rebase/merge. Do not run full renders. Do not expand scope into P1.

**Scope question to resolve first (Operator flag):** commit `e90e7078` ("reject collapsed palette seeds") landed on the branch AFTER `c5f28b20` and is palette/contract-adjacent. **Confirm whether it is IN-scope for this gate or a separate item** — state which, and if in-scope, include it in the verdict.

**Expected output:**
- Verdict: **PASS / PASS WITH REQUIRED CHANGES / FAIL**, evidence-based, cited `file:line`.
- Explicit confirmation on: deterministic hash stability; `mutationPayload` coverage; no change to receipt/outbox/refund/readiness txn; Resolved validator rejects a Template shape + all DEFERRAL_MARKERS; `family_profile` is relatives-only (doctor rejected); evidence-origin ↔ binding-mode coherence.
- Any residual fail-closed gap = defect-until-proven (do not bless a by-design residual window).
- Scope call on `e90e7078`.

**Do not:** certify anything you did not read at `file:line`; approve on green tests alone; treat "green" as "sellable".

**Definition of done:** Written verdict returned to Guy via Operator, with the go/no-go for pushing the slice + starting P1.
**QA required:** yes (this IS the QA gate G6-adjacent + G2 engine).
**Codex review required:** n/a (Codex is the reviewer).
**Owner approval required:** yes — Guy acts on the verdict (push + P1 authorization).
