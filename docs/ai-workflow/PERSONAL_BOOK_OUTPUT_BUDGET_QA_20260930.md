# Claude Code re-gate: personal book output budgets

## Original requirement, reviewed finding and immutable boundary

Guy wants approved voice/form details -> a personal, humorous, adventurous,
age-appropriate story -> whole-book storyboard with continuing physical state,
chosen companion, child agency and source fidelity. Codex implements; Claude
independently reviews. This correction addresses ONLY Claude's output-budget P2
and HOLD on `07d3c8d3..bcd8a226`. No live insufficiency was observed by either party.

Worktree `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`,
branch `codex/personal-book-storyboard-bridge`, corrective base
`bcd8a226b16023270dbfa6d368bee29816178eae`. Freeze the successor SHA supplied in the
post-commit handoff. First pass read-only, no provider/key/render/push/deployment.
Please re-check the whole runner as requested, not only its arithmetic.
Base writer `45b9e754` and bridge `45b9e754..07d3c8d3` still need their own review;
this correction does not extend a PASS to either. Claude's HOLD stays open until
this re-gate, not self-closed by Codex's test results.

## Claims to falsify

1. `personalBookOutputLimits` requires exactly 8/12/16 narrative spreads, includes
   the cover, derives review count from existing schema category arrays. Author:
   max(32k, 3k/frame). Review: max(32k, 16k + 512/check), rounded UP to 1k.
   This is conservative initial headroom, not a live adequacy or worst-case proof.
2. Prepared approved length determines both caps AND full four-stage reservation
   before the ledger/key/provider factory. The same policy controls actual SDK
   payloads; stale, smaller, larger or another length's cap is rejected before
   SDK dispatch. Required length argument replaces the old flat reservation API.
3. Real GET returns three length-specific rows (spreads, display pages, caps,
   reserve, fitsConfiguredTotalBudget), not a misleading single quote. This is
   comparison to TOTAL configured budget, NOT remaining money or provider access.
   GET still reads no credential and reports availability unverified.
4. Keep $10 configuration ceiling. Long Astra needs $10.989 with EXISTING rate
   cards and must return `book_budget_exhausted` before key/factory/attempt/job
   consumption. Never silently shrink caps, raise budget or switch model.
5. Medium reasoning, all 7 book checks and 4/frame, 1,200-character observation
   validation bound, complete arrays, no retries/repair/fallback, held reports,
   usage/null accounting, cancellation/timeouts and runtime-ineligibility persist.

| Narrative spreads | Frames/checks | Storyboard/review caps | Sol reserve | Astra reserve |
| --- | --- | --- | --- | --- |
| 8 | 9 / 43 | 32,000 / 39,000 | $1.8128 | $9.064 |
| 12 | 13 / 59 | 39,000 / 47,000 | $1.9778 | $9.889 |
| 16 | 17 / 75 | 51,000 / 55,000 | $2.1978 | $10.989 |

These are full-job reservations, NOT expected charges or invoices. Both configured
model cards document max output 128k, above each cap. Existing rate cards were not
changed or freshly attested; no token estimate is inferred from JSON byte length.
The 16k review reasoning allowance and 512/check are engineering starting values,
not official guarantees. Official initial guidance of >=25k reasoning+output:
https://developers.openai.com/api/docs/guides/reasoning#allocating-space-for-reasoning
Models: https://developers.openai.com/api/docs/models/gpt-6-sol and
https://developers.openai.com/api/docs/models/gpt-6-astra .

## Scope and tests

Four production files: book-config, runner, adapter and isolated local route.
Two existing specs amended: runner 45 -> 65; route 28 -> 32. Existing behaviors
and assertions remain; old one-length real-SDK test expanded to three lengths.
No test timeout, worker or classification change. No new spec inventory entry.

Reproduce:

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run lib/personal-wizard lib/__tests__/local-book-sequence.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts lib/__tests__/style01-prompt-assembly-child-presence.spec.ts lib/__tests__/style01-child-expression-style-fidelity.spec.ts --maxWorkers 1
npm run check
```

Final native exits, full-check results and preservation are recorded in the
separate `PERSONAL_BOOK_OUTPUT_BUDGET_VERIFICATION_20260930.json` (not overwritten
prior results). tsc native 0; focused **486/486 in 21 files**, native 0. Full check
native 1: ordinary 373 files, 10 failed/5218 passed/73 skipped; resource 20 files,
635/635 passed with three unhandled onTaskUpdate RPC errors, native 1. Gate RED.
Sorted failure names match the prior recorded base; no untouched-base run proves
causal independence. Local verifier exits 0 (report integrity, NOT green gate):
all log hashes match, code stable, 22 prior raw files retain hash/size/mtime and
seven unchanged writer/bridge files match frozen Git after EOL normalization.
Local pure-policy probe loads the full `lib/personal-wizard/book-config.ts` at
`bcd8a226` using `git show`
into memory: nine base negative controls and eight invalid-length rejections;
no checkout/revert or source rewrite. It is Codex's offline evidence, not your
independent QA. Tests execute real route handlers and real SDK payload assembly
with fake responses, not real auth/provider availability or visual output.

Raw root `outputs/personal-book-output-budget-20260930/` is ignored, untracked,
local-only with no verified off-machine backup; push will not preserve it.
Previous `personal-book-runner-20260930/` and `personal-storyboard-bridge-20260930/`
remain intact. No live key load, provider/image/audio, browser/dev server or cost.

## Remaining risks and exclusions

No successful live whole book or output-token measurement. Base writer's separate
5k/12k limits are unchanged, still subject to its own unreviewed range and live
calibration. Input bytes (104k runner/128k complete payload) and 180s stage timeout
also remain uncalibrated against a real long book. No claim that every legal
maximum-length observation can fit; concise review still required. No omission
of checks to make it fit. Incomplete responses still fail closed with billed
reported usage retained and no retry.

No writer, bridge, schema, manuscript, visual prompt, site/UI, order/database,
anchor, renderer/QA threshold, narration or release cutover. No independent PASS
claimed and no product acceptance. Full gate and prior unreviewed code remain
open. After independent technical review, the next evidence is a separately
bounded live text diagnostic and creative review, not immediate paid images.
