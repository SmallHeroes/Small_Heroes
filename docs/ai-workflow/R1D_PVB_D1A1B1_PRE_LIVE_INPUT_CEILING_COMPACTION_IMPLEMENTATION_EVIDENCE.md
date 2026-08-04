# Implementation Evidence — R1D-PVB-D1A1B1-PRE-LIVE-INPUT-CEILING-COMPACTION

**Status:** Local implementation complete; ready for independent Claude Code read-only adversarial QA. Codex does not self-award technical PASS.
**Date:** 2026-08-04
**Exact base:** `b6155df9b3e142c9e667bba7f1dc395b50f45a82`
**Branch:** `codex/r1d-pvb-d1a1b1-pre-live-input-ceiling-compaction`
**Worktree:** `C:\Users\guyna\.codex\worktrees\c327\Small_Heroes`
**Commit 1:** `276fc8a96c1986af6558a25fdf8cc04660d291a3` — compact prompt authority tables and direct/corpus regressions.
**Commit 2:** lifecycle/current-authority bindings, validation-resume inventory correction, current state, and this evidence record.
**External state/cost:** none / `$0`.

## Verified starting condition

The task started from exact base `b6155df9b3e142c9e667bba7f1dc395b50f45a82` on a uniquely owned branch/worktree with no upstream or same-name local remote-tracking ref. The pre-change Fox conservative UTF-8-byte upper bound was exactly:

- system prompt: `10,313`
- user prompt: `36,627`
- serialized schema: `13,060`
- protocol/framing allowance: `4,096`
- separators: `2`
- total: `64,098`
- headroom against `64,000`: `-98`

No credential, provider, canonical preflight, live-authoring, or render boundary was reached. Historical Fresh Readiness failure evidence was not used as implementation authority.

## Implementation

- Added deterministic exported Source Evidence and Action Semantic JSON tuple-table serializers with explicit ordered field-name headers.
- Preserved every canonical value and catalog ordering. Arrays remain arrays and `lateralityAllowed` remains a boolean; no field is omitted or inferred.
- Reused the exact Source Evidence serializer for initial user prompts and relevant full-draft repair catalog entries. Production inspection found no divergent manual Source Evidence row formatter remaining in compiler or visual-package paths.
- Bumped only `TEMPLATE_PROMPT_VERSION` to `vc-template-prompt/v9`, `TEMPLATE_USER_PROMPT_VERSION` to `vc-template-user-prompt/v9`, and `REPAIR_USER_PROMPT_VERSION` to `vc-repair-user-prompt/v9`. `REPAIR_PROMPT_VERSION` remains `vc-repair-prompt/v8`.
- Kept `vc-draft-schema/v12`, schema bytes/digest, request/evidence shapes, model, Responses API, service tier, estimator, `64,000` ceiling, `4,096` allowance, budgets, timeout, retry, fallback, and cost ceilings unchanged.
- Added current-authority lifecycle/materialization/verifier regressions for v9/v9 initial and v8/v9 repair authority, including recomputed-content-address stale-v8 rejection before provider reachability.
- The only validation-resume change updates the workload inventory assertions to canonical inventory `284`, ordinary `265`, and unchanged resource-intensive `19`.
- Production changes contain no story-, page-, character-, excerpt-, or phrase-specific optimization.

## Losslessness and deterministic projection evidence

Direct tests reconstruct the complete canonical Source Evidence and Action Semantic projections from their headers and rows. They cover deterministic ordering, Unicode, punctuation, duplicate excerpts, quotes, backslashes, tabs/newlines, nested string arrays, booleans, and JSON escaping. Initial and full-draft repair prompts are asserted to contain the exact shared Source Evidence projection.

`TEMPLATE_DRAFT_JSON_SCHEMA` remains `13,060` serialized UTF-8 bytes with SHA-256 digest `d14c625bec2f6018182bf328ca663d0ed2b8fcf08e06a4f9147d0c2acf66bad9`, unchanged from the exact base.

## Measured input results

- Source Evidence table saving for Fox: exactly `4,361` upper-bound units.
- Action Semantic table saving: exactly `2,060` upper-bound units.
- Fox after compaction: system `8,253`, user `32,266`, schema `13,060`, framing `4,096`, separators `2`; total `57,677`; headroom `6,323`.
- All 18 approved v3 Story Sources traversed the same production request-construction path and remained at or below `64,000`.
- Worst case: `lion_shaket_fantasy` at `62,683`, with minimum corpus headroom `1,317`.
- Some 16-page fantasy sources still encounter their separate existing page/cost gates; none encounters the input ceiling. No policy was changed to mask those independent gates.
- A valid genuinely over-budget synthetic 12-page input still fails closed on the input ceiling before provider reachability.

## Focused validation

- Direct prompt-table compaction: **1 file / 6 tests passed**.
- Compiler/catalog/repair/lifecycle matrix: **7 files / 95 tests passed**.
- Updated live-authoring assertion: **1 file / 16 tests passed**, included in the matrix above.
- Source-authority lifecycle plus compaction: **2 files / 38 tests passed**.
- Exact live-request verifier: **1 file / 43 tests passed**.
- Materialization/verifier/readiness/execution resource batch: **5 files / 240 tests passed**.
- Validation-resume workload classifier: **1 file / 7 tests passed**.
- Deterministic repository-local `npx.cmd --no-install tsc --noEmit`: passed before each authorized full-check boundary.
- `git diff --check`: passed before commit 1 and is required again over the final immutable range.

Provider sentinels remained unreachable throughout all relevant tests.

## Literal repository check and validation resume

The first literal `npm run check` ran exactly once under the original authorization and was not rerun. It exposed one new assertion in `vitest-workload-classifier.spec.ts`: the new canonical compaction spec increased inventory `283 -> 284` and ordinary files `264 -> 265`. The task stopped fail-closed and returned to Lead without creating commit 2.

Guy explicitly authorized a narrow validation resume in the same task, branch, and worktree. Only the two stale inventory counts changed; resource-intensive remained `19`. The focused classifier passed **1 file / 7 tests**, and deterministic TypeScript passed. Guy then authorized exactly one fresh literal `npm run check`; it was not rerun.

Fresh check outcome:

- TypeScript phase: passed.
- Canonical inventory: `284` files.
- Ordinary phase: `265` files at four workers; **244 passed / 5 failed / 16 skipped files** and **2,801 passed / 6 failed / 65 skipped tests**. The six failures are exactly the established missing ignored-fixture baseline in:
  - `lib/__tests__/child-lexicon-ages-5-8.spec.ts` — 1
  - `lib/__tests__/momentum-gate-koko.spec.ts` — 1
  - `lib/__tests__/page-entity-qa.spec.ts` — 1
  - `lib/__tests__/set-appearance-ref-budget.spec.ts` — 1
  - `lib/__tests__/story-read-back-validation.spec.ts` — 2
- Resource-intensive phase: **19/19 files and 544/544 tests passed** at two workers.
- Ordinary diagnostic: `31,560ms`, exit `1`, no signal, no launch error, `diagnosticProtocolOk=true`, one record, class only `signal_or_exit_failure` from the six assertions.
- Resource diagnostic: `94,308ms`, exit `0`, no signal, no launch error, `diagnosticProtocolOk=true`, one record, no failure class.
- Supervisor summary: canonical `284`, ordinary `265`, resource-intensive `19`; literal command exit `1` at the accepted fixture baseline.
- No seventh assertion and no timeout, RPC/IPC, reporter, launch, signal, protocol, termination, or teardown failure appeared.

The repository gate remains truthfully non-green/HOLD because the six fixture assertions still fail. This milestone does not waive or conceal them.

## Changed-file scope

Commit 1:

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/__tests__/visual-contract-prompt-table-compaction.spec.ts`
- `lib/__tests__/visual-contract-live-authoring.spec.ts`

Commit 2:

- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`
- `lib/visual-package/__tests__/live-request-materialization.spec.ts`
- `lib/visual-package/__tests__/live-request-verification.spec.ts`
- `lib/__tests__/vitest-workload-classifier.spec.ts`
- `CURRENT.md`
- `docs/ai-workflow/R1D_PVB_D1A1B1_PRE_LIVE_INPUT_CEILING_COMPACTION_DECISION_GATE.md`
- `docs/ai-workflow/R1D_PVB_D1A1B1_PRE_LIVE_INPUT_CEILING_COMPACTION_IMPLEMENTATION_EVIDENCE.md`

No dependency or lockfile changed.

## Explicitly absent actions

No real B0 materialization, Fresh Readiness, canonical preflight, credential check/read/load, pricing/network/provider/model call, live authoring, render, image/Vision/audio, storage/database/Supabase, Board, Semantic Reconciliation, approval, candidate/Blueprint/package publication, promotion, production activation, deployment, PR, push, branch cleanup, Story Source edit, or external spend occurred.

The temporary local `node_modules` junction used for deterministic validation pointed to a sibling dependency tree with the identical `package-lock.json` SHA-256 `bf7932428ac1bc2cb8885e83a21f231486f35ea36820381b7d1763a77ba03d59`. It must be removed without traversing or modifying its target before final handoff. Current-run ignored test scratch and the local diagnostic log must also be removed by exact path.

## Rollback

Revert the two focused local commits. No external state requires rollback.

## Independent QA falsification targets

1. Reconcile exact base, head, two-commit range, sole-writer worktree, clean status, and unpushed/no-upstream facts.
2. Recompute both tuple tables and prove complete lossless canonical reconstruction, deterministic ordering, Unicode/punctuation, duplicates, and escaping.
3. Search for omitted/inferred fields, divergent repair Source Evidence formatting, or story/page/excerpt-specific production literals.
4. Recompute exact Fox savings, component bytes, total/headroom, and all-18-source worst case/minimum headroom through the production path.
5. Recompute schema serialized bytes/digest and prove schema, request/evidence shapes, model, budgets, retries, fallback, timeout, and cost boundaries did not change.
6. Verify exact prompt authority tuple v9/v9 initial and v8/v9 repair, plus fail-closed stale-v8 rejection after canonical redigesting.
7. Confirm provider sentinels remain unreachable and the synthetic genuinely over-budget input still fails closed.
8. Verify the workload correction changes only inventory `283 -> 284` and ordinary `264 -> 265`, with resource-intensive `19` and all worker/runtime policy unchanged.
9. Validate the literal check record as six established fixture assertions only, with clean diagnostic protocol and no infrastructure-class failure.
10. Confirm no excluded external action, dependency/lockfile change, publication, deployment, or push occurred.

Independent QA must return PASS/HOLD and findings; this record is implementation evidence, not an independent verdict.
