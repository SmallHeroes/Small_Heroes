# R1D-PVB-D1A1B1-PAGE-CONTRACT-REPAIR-INPUT-COMPACTION — Implementation Evidence

**Base:** `48e9e29cafdfee8906ce0855dfde182e6109e538`

**Implementation commit:** `4b3fed8a512cb40346d5890cc5ff3363a8f887d0`

**Branch:** `codex/r1d-pvb-d1a1b1-page-contract-repair-input-compaction`

**Independent QA:** Claude Code cloud ultrareview completed with no findings for exact immutable range `48e9e29cafdfee8906ce0855dfde182e6109e538..15b0a2287c5949ce74d56a585af9889208e1a59d`

## Consumed live-attempt evidence

The immediately preceding bounded attempt created Fresh Readiness v14 digest `986fcd4c4152262a71cb036513a5c11e0befcc915f9584106dbd879a76ddab8b` and Execution Request v14 digest `88b04321eee0bf4fd306da9562a0fb54f4ceead488017a7e667315d55957a23c` at immutable HEAD `48e9e29cafdfee8906ce0855dfde182e6109e538`. Canonical preflight and Supervisor verify passed once. The Supervisor live child then exited nonzero after one initial response and one repair response.

- Logical provider calls: `2`; repairs: `1`; transport retries: `0`; fallback used: `false` at the attempt level.
- Usage: input `18,161`, cache-write input `17,399`, cached input `0`, output `22,428`, reasoning `1,229`, total `40,589` tokens.
- Nominal cost: `$0.785394`; conservative accounting: `$0.864982`.
- The initial draft emitted four closed page-spatial reference issues on pages 1, 2 and 4. `page_spatial_reference_patch` resolved all four.
- Complete validation after that repair emitted exactly twelve current unique `draft_contract/final_structural_invariant_invalid/page/final_structure` issues, one for every page 1–12.
- The planned third `page_contract_patch` was rejected before provider reachability as `input_token_ceiling_exceeded`; terminal classification was `input_limit_violation/provider_admission/ineligible/input_limit_not_repairable`.
- Receipt v20 digest: `54cc9db09541ee9a24856f3a68cec4943c866f381ff33d9133c563c659aab921`; readiness v18 digest: `ef9e04be40037e49bf7ba7b5d281b8ee084dc44f6bc2f7e53becde5a96d5a604`.
- Candidate, Semantic Reconciliation, Blueprint, Wizard, image and render authority remained absent.

Claude Code independently audited that sanitized post-live record and returned PASS with zero blocking finding. Its advisory note was that top-level execution attestation remained `injected_adapter_unattested`; the per-attempt records carried the exact retry/fallback truth. This evidence does not reuse the exhausted readiness or authorize another invocation.

## Root cause

The approved `page_contract_patch` semantics, strict output schema, parser, local apply and complete revalidation were already correct. Its user prompt serialized every complete affected page as ordinary repeated-key JSON. Twelve pages repeated page-contract field names, nested object shapes and authority strings until the unchanged admission calculation — system prompt + user prompt + strict output schema + 4,096 fixed allowance — exceeded 64,000 before the third provider call.

Full-draft repair, increasing the ceiling, increasing spend/calls or dropping page authority were rejected. They either resend more data, change approved budgets, or weaken the fail-closed contract.

## Implemented result

- Added `page-contract-repair-input-encoding/v1`, a deterministic JSON-domain codec used only by the provider-facing page-repair input.
- Object keys are stored once in lexicographically ordered shape tables. Arrays use `['a', ...]`, objects use `['o', shapeIndex, ...values]`, and only repeated strings with provably positive byte savings use `['s', dictionaryIndex]`.
- The encoder canonicalizes keys/Unicode through the existing repository authority, rejects non-finite/non-JSON/cyclic data, and emits stable bytes independent of input object-key order.
- The strict local decoder rejects extra/missing envelope keys, duplicate or unsorted dictionaries/shapes, invalid indexes, malformed tags and arity drift.
- Prompt construction decodes the exact produced envelope and compares canonical payload equality before returning bytes. Any divergence fails closed.
- System instructions define the closed decode grammar. Provider output remains the unchanged complete `PageContractRepairPatches` v1 schema; response parsing/application and full candidate validation did not change.
- Prompt authority advanced from v4 to v5. B0/Fresh Readiness will bind the new prompt digests on the next rematerialization. Existing artifacts are untouched and legacy-only.

## Measurements

For a checked-in 12-page Fox-shaped authority:

- ordinary JSON user payload: `20,231` bytes;
- compact canonical user payload: `15,372` bytes;
- savings: `4,859` bytes (`24.0%`);
- conservative system + compact user + output schema + fixed allowance upper bound: `26,345` bytes;
- remaining headroom under 64,000: `37,655` bytes.

The production lifecycle fixture carrying twelve complete action-semantic page contracts also passed the unchanged admission check with at least 4,096 bytes of headroom, then completed the fake-provider three-call route and candidate validation.

## Validation

- Direct codec/page repair, compiler repair loop, Structured Outputs compatibility and source-authority lifecycle: **4 files / 156 tests PASS**.
- Canonical live boundary, materialization writer, Fresh Readiness, Execution Request materialization, Supervisor, request materialization and verifier: **7 files / 296 tests PASS** at the repository's bounded resource worker policy.
- Deterministic TypeScript: PASS.
- `git diff --check`: PASS.
- Literal `npm run check`: TypeScript PASS; ordinary phase `270` files with exactly the six established missing ignored-output fixture failures; resource-intensive phase `19` files PASS, diagnostics protocol valid, zero timeout/RPC/IPC/reporter/launch/signal/teardown class. Canonical inventory remained `289`.

The six known failures are `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two `story-read-back-validation.spec.ts` cases. They remain a separate release HOLD and are not waived for launch.

## Boundaries and rollback

- Model `gpt-5.6-sol`, Responses API, default service tier, 64K input ceiling, 36K output ceiling, one initial call plus at most two repairs, zero transport retry, no fallback, timeout and `$4.884/$5.00` ceilings are unchanged.
- No raw prompt/response/provider message, stack or secret is persisted by this milestone.
- No credential access, provider/network call, B0/Fresh Readiness, canonical preflight, live authoring, candidate, reconciliation, Blueprint/Wizard, render/image/Vision, storage/database, publication, deployment or production action occurred. Cost is `$0`.
- Rollback is a revert of implementation commit `4b3fed8a512cb40346d5890cc5ff3363a8f887d0`; it restores prompt v4 and the prior oversized input behavior without changing historical artifacts.
- Independent Claude Code QA was required before rematerialization. The branch was pushed only to create the isolated Draft PR required by Claude ultrareview after the local Claude wrappers repeatedly timed out. A QA PASS is technical only and grants no candidate, visual, render, product or release acceptance.

## Independent QA closeout

Local Claude Code print-mode review was attempted three times, but each process reached its outer wrapper timeout without returning a verdict or modifying the repository. The local background daemon also failed before review with a control-pipe error. These are tool limitations, not review results.

After the exact head was pushed for review, Draft PR [#41](https://github.com/SmallHeroes/Small_Heroes/pull/41) targeted the exact presentation-repair base branch. Claude Code cloud ultrareview completed its independent review with **no findings** (`0 found, 0 verified, 0 refuted`). The reviewed range remained clean and immutable. Codex records this independent no-findings technical PASS; it does not self-award it.

The PASS grants no candidate, Semantic Reconciliation, Blueprint, Wizard, image, render, product, production, deployment or release acceptance. The six missing ignored-output fixtures remain a separate repository/release HOLD.
