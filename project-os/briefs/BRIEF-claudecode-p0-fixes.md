# BRIEF → Claude Code — P0 visual-contract fail-closed fixes (money-adjacent)

**Task title:** Close the 3 Codex-cited fail-open seams in the P0 visual-contract slice so it is genuinely fail-closed.
**Why now:** Codex round-2 = FAIL (2026-07-06). Atomic/hash mechanics PASS, but the slice can freeze/reuse an invalid Resolved contract. This is money-adjacent (changes the frozen/hashed payload). Blocks P1 (DEC-002 / OQ-T2).
**MVP category:** launch blocker (engine).
**Assigned agent:** Claude Code (deep specialist). Implementation permitted, narrow scope only. **NOT Cursor** (engine/money-adjacent, outside Cursor's lane).

**Context — Codex verdict is the spec.** Read `cc-checkpoint-p0-visual-contract-for-codex.md` + the FAIL verdict (Guy has it). Slice is already on `origin/feat/chunked-generation` @ `d3c0d0c8`. Fix with **narrow corrective commits on the same branch — no revert, no rebase, no render.**

**The 3 required fixes (each with a negative test):**
1. **Validate before freeze.** Call `validateResolvedBookVisualContract` on every materialized output BEFORE hashing/persisting. Seam: `lib/generation-pipeline/ensure-frozen-visual-contract.ts` (before :117 hash / :190 persist). Preferably also reject DEFERRAL_MARKERS in Template `explicit` values at `lib/visual-contract-compiler/validateTemplateContract.ts:92`.
2. **Harden dispatch.** `lib/visual-contract-compiler/readFrozenVisualContract.ts:21` must REJECT unknown `contractKind` and resolved-shaped values missing the discriminant (don't fall through to the legacy validator). Distinguish a genuine legacy shape from a damaged Resolved shape. Covers the matching-hash resume fast-path reuse (`ensure-frozen-visual-contract.ts:157`).
3. **Resolved validator preserves Template invariants.** `lib/visual-contract-compiler/validateResolvedContract.ts` (:41 origin extract, :107 mode-kind pairing) must do FULL typed-origin/binding validation: reject `family_profile` on non-relatives (doctor) and on garment colours; require garment colours be `explicit`; require origin payload completeness (`policy_default` needs `policyId`+`version`); assert deterministic-palette provenance version == actual palette version.

**Allowed files (edit only these + their tests):**
- `lib/visual-contract-compiler/validateResolvedContract.ts`, `validateTemplateContract.ts`, `readFrozenVisualContract.ts`, `materializeContract.ts` (only if needed for the above)
- `lib/generation-pipeline/ensure-frozen-visual-contract.ts`
- Test files under `lib/__tests__/` / `lib/visual-contract-compiler/__tests__/` — add negative tests for **every** counterexample above, including matching-hash resume behavior.

**Forbidden files/areas:**
- **`lib/visual-contract-compiler/contractRenderGuards.ts` — DO NOT TOUCH.** That's P1 (OQ-T5): `requireValidContractForRender` must be MODIFIED not wired, but only after this P0 re-gate passes.
- No changes to receipt/outbox/refund/readiness transaction machinery.
- No scope expansion, no revert, no rebase, no full render.

**Expected output:** narrow corrective commits on `feat/chunked-generation`; `npm run check` green (was 1327 pass / 15 skip — must stay green + new negative tests pass); report exact files + commits + test evidence; return the whole slice for Codex re-gate.

**Do not:** claim "verified/fail-closed" — that is Codex's word on money code; you produce the fix + evidence, Codex re-gates. Don't touch P1.

**Definition of done:** all 3 seams closed with passing negative tests; `npm run check` green; commits pushed to feat branch; slice handed back to Codex for re-review.
**QA required:** yes — `npm run check` + targeted negative tests.
**Codex review required:** YES — mandatory re-gate before P1.
**Owner approval required:** Guy authorizes P1 only after Codex PASS.
