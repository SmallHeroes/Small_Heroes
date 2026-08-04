# R1D-PVB-D1A1B1 Terminal Validation Classification and Repair Observability Hardening - Implementation Evidence

Date: `2026-08-04`

Status: **independent technical PASS; MINOR-1 and MINOR-2 independently closed; repository gate remains HOLD at the six-fixture baseline**

Decision Gate: `docs/ai-workflow/R1D_PVB_D1A1B1_TERMINAL_VALIDATION_CLASSIFICATION_AND_REPAIR_OBSERVABILITY_HARDENING_DECISION_GATE.md`

Implementation branch: `codex/r1d-pvb-d1a1b1-terminal-validation-observability`

Exact implementation base: `f66a5dd6877aedaa5174b6b4f51a679c049f0883`

Implementation worktree: `C:\Users\guyna\.codex\worktrees\112a\Small_Heroes`

Cost: `$0`

## 1. Outcome

The general authoring terminal-classification boundary no longer uses validation exhaustion as an exception catch-all. Visual Contract and production Blueprint authoring now emit a closed, story-neutral, sanitized failure contract. True draft validation/repair exhaustion requires positive proof that the exact three-call/two-repair budget was consumed. Initial provider-output decode failures, unusable completed repair responses, draft authority/reference-domain failures, Action Semantic capability gaps, post-compile authority failures, and unexpected local failures remain distinct.

The canonical OpenAI Responses adapter now records observed execution facts at the guarded transport boundary. Visual Contract receipt v9 and readiness v7 carry the same terminal classification and execution attestation, and readiness validates and copies that evidence rather than rebuilding counters.

No prompt, schema, model, endpoint, service tier, token ceiling, output ceiling, call/repair budget, timeout, retry, fallback, pricing, reservation, hard ceiling, candidate schema, Blueprint output, feasibility, Wizard, or render behavior changed.

## 2. Root cause proved against the repository

- `runVisualContractAuthoring` previously used `validation_exhausted` as its residual catch result. Initial JSON decode errors occur before the repair loop, so a completed one-call/zero-repair response could be falsely recorded as exhaustion.
- `TemplateRepairExhaustedError` previously represented both actual full-budget invalid drafts and a completed repair response that could not become the next usable draft.
- Attempt receipts persisted exact validator prose, and Action Semantic capability diagnostics included exact source phrases.
- OpenAI authoring evidence v2 did not attest guarded transport dispatches, retry count, fallback use, or canonical route/model confirmation.
- `productionAuthoringRunner` contained the same residual exhaustion fallback.

## 3. Implementation

### Closed sanitized terminal foundation

`lib/visual-package/authoringTerminalDiagnostics.ts` defines:

- the closed terminal code, phase, error-class, repair-eligibility, repair-reason, and diagnostic-code domains;
- fixed terminal messages with no exception/provider/draft material;
- bounded diagnostic projection: maximum 128 observations and 16 closed diagnostic codes;
- bounded code-only issues; no validator prose crosses the persistence boundary;
- strict runtime validation for current terminal classifications and execution attestations;
- `not_run`, `canonical_adapter_observed`, and `injected_adapter_unattested` execution evidence plus deterministic aggregation.

Unknown exceptions map only to `local_processing_failed`. No exception message, stack, raw draft, raw prompt, raw response, provider message/body, or Action Semantic source phrase is persisted.

### Compiler and lifecycle classification

- `TemplateRepairOutputInvalidError` distinguishes an unusable completed repair response from true `TemplateRepairExhaustedError`. Repair routing, repair mode selection, and the two-repair budget are unchanged.
- Visual Contract exhaustion requires the exact approved 3/2 policy, three indexed completed attempt receipts, two repairs, and a nonempty validation trail for all three attempts.
- A completed provider response is counted as one logical call even if later local response-evidence inspection throws.
- Initial decode, unusable repair, authority/reference-domain, Action Semantic capability, post-compile authority, and local-processing failures carry distinct fixed classifications.
- Production Blueprint exhaustion has the equivalent positive full-budget proof and no residual exhaustion fallback. Existing production provider, budget, feasibility, Wizard, and output behavior remains unchanged.

### Observed canonical execution evidence

- The guarded OpenAI fetch increments `transportDispatchCount` only at the transport boundary and confirms the canonical route there.
- Canonical model confirmation is observed from the exact built request body.
- Retry count is derived post hoc from observed dispatches versus the single logical call. The adapter retains `maxRetries: 0`, one guarded endpoint, and `fallbackUsed: false`.
- Canonical completed evidence requires one logical call, one transport dispatch, zero transport retries, no fallback, and confirmed route/model.
- Provider failure evidence v2 and successful OpenAI evidence v3 carry the same execution-attestation shape.

### Receipt/readiness integrity and version cutover

Current versions are:

- Visual Contract receipt `visual-contract-authoring-receipt/v9`;
- Visual Contract readiness `visual-contract-authoring-readiness/v7`;
- OpenAI authoring evidence `openai-responses-authoring-evidence/v3`;
- provider-call-failure evidence `provider-call-failure-evidence/v2`;
- production Blueprint authoring receipt `production-blueprint-authoring-receipt/v4`.

The immediately prior v8/v6/v2/v1/v3 artifacts are explicit immutable legacy evidence. Request v9, prompt/schema authorities, and candidate v6 are unchanged. Readiness rejects old versions even after canonical redigest. It also rejects a redigested current receipt with an open-ended terminal code, malformed execution evidence, counter drift, or receipt/attempt aggregation mismatch.

## 4. Direct regression evidence

All commands were repository-local and used the existing locked dependency tree. No credential, provider, network, pricing, B0/Fresh Readiness, live-authoring, render, image/Vision, database/storage, Board, publication, deployment, or push boundary was reached.

- Primary classification/adapter/provider/Blueprint matrix: **4 files / 233 tests PASS**.
- Adjacent compiler, launcher, materialization, verifier, and Blueprint-authoring matrix: **5 files / 128 tests PASS**.
- Canonical pre-live readiness and external-boundary sentinels: **1 file / 11 tests PASS**.
- `npx --no-install tsc --noEmit`: **PASS**.
- `git diff --check`: **PASS** before documentation and again before commit.

The direct matrix proves:

- successful initial authoring still produces a candidate;
- initial decode failure is one logical call, zero repairs, repair-ineligible, distinct, and sanitized;
- true exhaustion is exactly three calls/two repairs with bounded diagnostic codes;
- an unusable completed repair response is `repair_output_invalid` after two calls/one repair, not exhaustion;
- authority/reference-domain and Action Semantic capability failures remain terminal and non-repairable;
- post-compile authority remains distinct;
- unexpected request and completed-response local failures are sanitized and preserve the correct call count;
- receipt and readiness carry byte-equivalent classification and execution attestation;
- canonical success and failure attest dispatch/retry/fallback/route/model observations;
- legacy versions cannot become current authority after redigest;
- production Blueprint has no exhaustion catch default;
- raw secret/prompt/response/provider/error/stack/source-phrase scans are clean;
- provider, credential, network, render, and downstream sentinels remain unreachable.

## 5. Literal repository gate

The first launch was terminated by its command wrapper after five seconds before any repository-gate result existed. Its child processes later exited without a capturable result. Guy explicitly authorized one replacement literal launch, defining it as a replacement rather than a retry of a completed gate.

The authorized replacement `npm run check` ran once and was not rerun. It completed in `150.8s`:

- TypeScript: **PASS**.
- Canonical inventory: **284 files**.
- Ordinary phase: **265 files** at four workers, **244 passed / 5 failed / 16 skipped files**; **2,812 passed / 6 failed / 65 skipped tests**; elapsed `35,103ms`; exit `1` only for the six established fixture failures.
- Resource-intensive phase: **19/19 files / 544/544 tests PASS** at two workers; elapsed `110,298ms`; exit `0`.
- Both phase diagnostic protocols were valid with one bounded record each. There was no timeout, RPC/IPC, reporter, launch, signal, termination, teardown, or diagnostic-protocol failure. The ordinary closed diagnostic class `signal_or_exit_failure` reflects its expected nonzero assertion exit; the resource phase had no failure class.

The six failures are exactly the established absent ignored-output fixtures in the five unchanged files:

1. `lib/__tests__/child-lexicon-ages-5-8.spec.ts`;
2. `lib/__tests__/momentum-gate-koko.spec.ts`;
3. `lib/__tests__/page-entity-qa.spec.ts`;
4. `lib/__tests__/set-appearance-ref-budget.spec.ts`;
5. two cases in `lib/__tests__/story-read-back-validation.spec.ts`.

No seventh assertion or execution-protocol failure occurred. The literal command therefore exited `1`, and the repository gate remains truthfully HOLD only at the documented historical-fixture baseline. No missing fixture was copied, fabricated, or imported. Four exact ignored scratch artifacts produced by the run (two QA-anchor files and two story-read-back files) were removed after timestamp/path verification.

## 6. Boundaries and limitations

- Claude Code independently passed the original implementation range and raised two MINOR findings, then independently passed the focused correction range and closed both findings with no new finding. Codex records those verdicts; it does not self-award them.
- No real provider execution was authorized; guarded transport observations are proved with deterministic injected transport tests and sentinels.
- No prior live-attempt artifact or historical evidence version was modified.
- No dependency, package manifest, lockfile, worker policy, timeout, retry, skip, or assertion was changed.
- The six ignored-fixture failures remain repository-gate HOLD items outside this milestone.
- This work grants no product, visual, Fresh Readiness, authoring, candidate approval, reconciliation, Blueprint, Wizard, render, publication, release, deployment, or push authority.

## 7. Independent QA falsification targets

Claude Code should review the immutable base-to-head range read-only and try to falsify:

1. any residual catch default or unknown error that can claim repair exhaustion;
2. any path that emits `draft_validation_repair_exhausted` without exact 3/2 proof;
3. decode versus repair-output versus domain/capability/post-compile/local separation;
4. raw draft, validator, prompt, response, provider, exception, stack, source-phrase, or secret persistence;
5. undercounting a completed logical call when local response inspection throws;
6. adapter evidence restating request policy instead of observing guarded dispatches;
7. transport dispatch/retry/fallback/route/model facts on success and failure;
8. receipt/readiness classification or counter drift after redigest;
9. legacy v8/v6/v2/v1/v3 evidence becoming current authority;
10. production Blueprint using exhaustion as a residual fallback or changing output/Wizard semantics;
11. any prompt/schema/model/endpoint/tier/token/budget/timeout/retry/fallback/pricing/candidate/dependency/lockfile drift;
12. any story, page, character, companion, phrase, or live-attempt special case.

## 8. Independent QA and focused QA fix

Claude Code independently reviewed exact immutable range `f66a5dd6877aedaa5174b6b4f51a679c049f0883..463575ba63d7e5c6d764e358051b5c36e2c2c00c` read-only and returned technical **PASS** with two MINOR findings. Claude did not execute Vitest or TypeScript because `node_modules` was absent in its review worktree; its verdict is an independent static falsification result supported, but not independently reproduced, by Codex's recorded executable evidence.

- **MINOR-1:** `call_budget_invariant_failed` was declared and admitted but unreachable. The actual `attempt > maxCalls` invariant breach fell through the `local_processing_failed` definition to `unexpected_local_error`.
- **MINOR-2:** readiness checked internally consistent counters but did not bind an exhaustion classification to the complete three-call/two-repair budget, so self-consistent redigested one-call/zero-repair exhaustion evidence could pass the boundary.
- **NOTE-1:** a pre-existing, out-of-range canonical-import-preflight path still uses bounded errors rather than a safe issue-code field, while its feed emits closed snake-case codes. Claude did not charge this to the reviewed range.
- **NOTE-2:** the remediation fixes the terminal-classification defect class but does not establish the original runtime cause of the historical one-call/zero-repair receipt. Under the hardened fallback, an equivalent unknown local failure records `local_processing_failed` rather than false exhaustion.

Guy authorized `R1D-PVB-D1A1B1-TERMINAL-VALIDATION-OBSERVABILITY-QA-FIX` at exact base `463575ba63d7e5c6d764e358051b5c36e2c2c00c`, limited to those two findings. The focused correction:

- wires the exact `attempt > maxCalls` breach to the existing closed `call_budget_invariant_failed` diagnostic while retaining the closed terminal code `local_processing_failed`;
- adds one shared fail-closed predicate requiring either exhaustion claim--terminal code or repair eligibility--to be jointly present and bound to exactly three observed logical provider calls and two repairs;
- applies that predicate at Visual Contract receipt persistence and readiness validation;
- adds a direct invariant-breach regression plus self-consistent redigested receipt-persistence and readiness tamper regressions.

QA-fix validation, using only the existing locked local dependency tree:

- `npx --no-install vitest run lib/visual-package/__tests__/source-authority-lifecycle.spec.ts lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts lib/visual-package/__tests__/production-lifecycle-foundation.spec.ts lib/visual-package/__tests__/provider-failure-diagnostics.spec.ts --maxWorkers=1`: **4 files / 236 tests PASS**;
- `npx --no-install tsc --noEmit`: **PASS**;
- `git diff --check`: **PASS**.

Per authorization, `npm run check` was not rerun. No credential read/check/load, provider or network call, real B0/readiness, live authoring, render, deployment, or push occurred. No taxonomy member, budget, repair route, provider behavior, schema, model, timeout, retry, fallback, dependency, lockfile, or policy changed.

### Independent correction micro re-gate

Claude Code independently reviewed exact immutable range `463575ba63d7e5c6d764e358051b5c36e2c2c00c..cf26fba3ebda1005142bb5d732e31304ad1b95f2` read-only and returned **PASS** with zero BLOCKER, zero MAJOR, zero MINOR, and no new finding. It verified one commit, zero merges, exactly five declared files, a clean unpushed branch with no upstream or same-name origin ref, no package/lockfile change, and correction-range `git diff --check` exit `0`.

- **MINOR-1 independently closed:** the real `attempt > maxCalls` breach emits only the existing `call_budget_invariant_failed` diagnostic while retaining `local_processing_failed`. The override is restricted at runtime to that one terminal code and one closed diagnostic literal; every other terminal class retains its prior definition-pinned diagnostic.
- **MINOR-2 independently closed:** the shared predicate rejects either one-sided exhaustion claim, rejects every logical-call/repair count other than exact 3/2, accepts genuine joint 3/2 exhaustion, leaves non-exhaustion results unconstrained, and cannot be bypassed by redigesting forged evidence because persistence and readiness enforce the binding before authority is accepted.
- **N1 advisory:** the QA-fix validation record says it used the existing locked local dependency tree but does not itself state that dependency access was through the temporary junction later removed. Claude found no false statement or residue and did not charge this as a finding; it limits reproduction from this document alone.
- **NOTE-1 carried unchanged:** the pre-existing, out-of-range canonical-import-preflight path still uses bounded errors rather than a safe issue-code field while its feed emits closed snake-case codes.
- **NOTE-2 carried unchanged:** the remediation fixes the defect class but does not establish the historical runtime cause of the one-call/zero-repair receipt; an equivalent unknown local failure now records `local_processing_failed` rather than false exhaustion.

`node_modules` was absent during the micro re-gate and installation was prohibited, so Claude executed no Vitest and no TypeScript. The focused **4 files / 236 tests**, TypeScript PASS, and three direct regressions remain Codex's executable evidence; Claude independently verified their presence and properties and awarded closure through static falsification of the fully decidable predicate and override logic. The six ignored-fixture failures remain a separate repository-gate HOLD outside the correction and were not charged against it.

No further Claude Code round is required unless a factual discrepancy is found. This independent technical PASS and both closures grant no product, visual, candidate, Blueprint, Wizard, Fresh Readiness, provider, live-authoring, render, spend, publication, release, deployment, or push authority.
