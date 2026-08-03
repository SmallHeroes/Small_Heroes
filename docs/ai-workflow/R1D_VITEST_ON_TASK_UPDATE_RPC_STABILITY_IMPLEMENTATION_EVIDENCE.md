# R1D-VITEST-ON-TASK-UPDATE-RPC-STABILITY Implementation Evidence

Status: **original implementation independently PASSed; MINOR-1 corrected pending read-only micro re-gate; targeted RPC event absent in the one full run; repository gate HOLD**

Date: `2026-08-03`

Base: `a65de8bc617da34c0db56bce48fd81299ca7d988`

Branch: `codex/r1d-vitest-on-task-update-rpc-stability`

Worktree: `C:\Users\guyna\.codex\worktrees\97a1\Small_Heroes`

Cost/external actions: `$0`; none

## Topology and environment

Before editing, Codex inspected every registered worktree, `git branch -vv`, all worktree statuses, target refs, and the required base. The dedicated worktree was clean and detached exactly at the required base; the target branch did not exist locally or remotely. It was created at that base with no upstream. Other dirty worktrees remained user-owned and untouched. This task was the sole writer.

The dedicated worktree initially had no dependencies. One `npm ci --offline --ignore-scripts --no-audit --no-fund` installed a real local, non-link dependency tree from cache. One local Prisma generation used `node node_modules/prisma/build/index.js generate --schema backend/schema.prisma` without database access. No install or generation retry occurred.

Locked runtime facts:

- Node `22.19.0`;
- npm `10.9.3`;
- Vitest `3.2.4`;
- Tinypool `1.1.1`;
- TypeScript `6.0.3`;
- Prisma / Prisma Client `6.19.3`;
- 24 available parallel slots;
- real local `node_modules`, no junction/link.

Package identities:

- pre-script-change `package.json` SHA-256: `ce94e69fdd50cd3a0983dbdf21111f168a1775f8ab9d6b238b869b77d00300d2`;
- final `package.json` SHA-256: `7df1d93bcd93e7ce577525627048584096a04c110fc3d0e9d21436242308993d`;
- unchanged `package-lock.json` SHA-256: `bf7932428ac1bc2cb8885e83a21f231486f35ea36820381b7d1763a77ba03d59`.

## Verified installed call path

The technical claim was checked against installed source rather than inferred from the error string:

- `node_modules/@vitest/runner/dist/chunk-hooks.js`: task packs are batched and outstanding update promises are awaited before the run finishes.
- `node_modules/vitest/dist/chunks/index.CwejwG0H.js`: the worker-side runner patch calls `rpc().onTaskUpdate(task, events)` and returns that promise.
- `node_modules/vitest/dist/chunks/utils.CAioKnHs.js`: fork transport uses `v8.serialize` / `v8.deserialize` and `process.send` / `process.on('message')`.
- `node_modules/vitest/dist/chunks/index.B521nVV-.js`: birpc's independent default timeout is `60,000ms`.
- `node_modules/vitest/dist/chunks/rpc.-pEldfrD.js`: the worker timeout becomes `[vitest-worker]: Timeout calling "onTaskUpdate"`.
- `node_modules/vitest/dist/chunks/coverage.DL5VHqXY.js`: main-process `onTaskUpdate` awaits `_testRun.updated`.
- `node_modules/vitest/dist/chunks/cli-api.BkDphVBG.js`: `_testRun.updated` updates state, awaits event reports, and then awaits reporter `onTaskUpdate`.
- the same installed defaults retain isolated `forks`, `5,000ms` tests, and `10,000ms` teardown.

The root-cause boundary remains causal uncertainty, not a falsely precise diagnosis.

## Independent QA and focused MINOR-1 correction

Claude Code independently reviewed exact immutable range `a65de8bc617da34c0db56bce48fd81299ca7d988..08100582e955ae67d660a6944ab665d1ac14436f` and returned technical **PASS** with **0 BLOCKER, 0 MAJOR, and 1 non-blocking MINOR**. It independently reproduced **4 files / 39 tests PASS**, TypeScript exit `0`, the exact **283 canonical / 264 ordinary / 19 resource-intensive** census, fourteen typed classifier negative controls, exact-once execution and bounded diagnostic behavior, and unchanged dependencies plus `test` / `test:watch`. This is Claude Code's verdict, not Codex self-awarding technical PASS.

**MINOR-1 - corrected; independent closure pending.** The defensive input `exitCode:null`, `signal:null`, and `launchErrorCode:null` previously added no process-outcome class and therefore could produce `gateStatus:passed`. The correction maps only that indeterminate state to the existing closed `signal_or_exit_failure` class. It does not add a taxonomy value or change the reporter protocol. Direct regression tests prove:

1. the indeterminate outcome fails with `signal_or_exit_failure`;
2. normal exit `0` still passes;
3. a signal, nonzero exit, launch failure, and diagnostic-protocol failure remain failures;
4. indeterminate evidence contains only closed fields/classes, excludes the hostile input text, and carries `gateStatus:failed`.

Focused correction validation passed **1 file / 21 tests**. Deterministic `npx --no-install tsc --noEmit` and `git diff --check` pass. The literal `npm run check` was not rerun because its one authorized run was already consumed. This correction remains pending a read-only Claude Code micro re-gate; Codex does not self-award its closure.

Claude Code's advisory limitations remain preserved:

- **N1 - include-surface boundary:** canonical includes are intentionally restricted to `lib/` and the classifier walks only `lib/`; a spec outside that shared Vitest/classifier surface is not discovered. This does not create divergence between the two consumers, which use the same policy.
- **N2 - reviewer self-disclosure:** Claude's first independent census helper contained a glob-to-regex bug and assumed manifest entries were strings. Claude corrected both before reporting; its final **283 / 264 / 19** result was independently confirmed by the repository classifier.
- **N3 - full-gate reproduction boundary:** Claude did not rerun or independently verify the recorded one literal `npm run check` exit `1`, by instruction. The six missing ignored-fixture failures remain a pre-existing, separate repository baseline.
- **N4 - inherited environment:** Vitest children receive the parent environment as normal test-runner behavior; no environment value enters the diagnostic evidence.

## Implementation

### Sanitized diagnostics

`test-infrastructure/vitest-diagnostics.mjs` owns the closed taxonomy. `test-infrastructure/vitest-diagnostic-reporter.mjs` inspects only bounded known error fields and writes only a closed summary over fd 3. The supervisor accepts at most 64 KiB and eight records, rejects unknown fields/classes/versions/phases, and requires exactly one run-end record. A malformed, missing, or overflowing diagnostic channel is gate-failing.

Vitest stdout/stderr use direct inherited handles. The supervisor never buffers or re-emits those bodies. Diagnostic evidence contains no task ID, test name, raw error, stack, path, environment value, prompt, response, credential, stdout, or stderr body.

### Deterministic inventory and manifest

`test-infrastructure/vitest-workload-policy.json` is consumed by both `vitest.config.ts` and the classifier. The classifier walks the canonical `lib` surface deterministically, rejects links/aliases, normalizes repository-relative POSIX paths, detects duplicate/case-colliding ownership, validates the explicit manifest, computes the ordinary complement, and revalidates union/disjointness before launch.

The final inventory contains 283 files:

- 264 ordinary;
- 19 resource-intensive;
- total 283, overlap 0, omission 0, duplicate 0.

The resource paths are:

1. `lib/__tests__/book-ready-email-reachability.spec.ts`
2. `lib/__tests__/delivery-input-writer-coverage.spec.ts`
3. `lib/__tests__/order-authority-guard.spec.ts`
4. `lib/__tests__/production-qa-escape-hatches.spec.ts`
5. `lib/generation-pipeline/__tests__/asset-safety-writer-coverage.spec.ts`
6. `lib/generation-pipeline/__tests__/safety-release-transition-caller.spec.ts`
7. `lib/set-identity-board/__tests__/mint-launcher.spec.ts`
8. `lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts`
9. `lib/visual-package/__tests__/canonical-live-authoring-launcher.spec.ts`
10. `lib/visual-package/__tests__/canonical-materialization-input.spec.ts`
11. `lib/visual-package/__tests__/canonical-pre-live-git-probe.spec.ts`
12. `lib/visual-package/__tests__/canonical-pre-live-readiness-launcher.spec.ts`
13. `lib/visual-package/__tests__/canonical-pre-live-readiness.spec.ts`
14. `lib/visual-package/__tests__/legacy-visual-contract-authoring-boundary.spec.ts`
15. `lib/visual-package/__tests__/live-execution-request-materialization.spec.ts`
16. `lib/visual-package/__tests__/live-execution-supervisor.spec.ts`
17. `lib/visual-package/__tests__/live-request-materialization.spec.ts`
18. `lib/visual-package/__tests__/live-request-verification.spec.ts`
19. `lib/visual-package/__tests__/release-check-cli.spec.ts`

Current-run cache evidence reinforced the classification: resource specs included roughly 49.2s Supervisor, 48.6s readiness, 36.1s execution-request materialization, 13.4s request verification, 11.3s canonical input, and 9.3s canonical boundary durations. The manifest was chosen before that run from prior measured scanner contention, the prior canonical-boundary full-load timeout, and repository-visible child-process call sites; the cache is corroboration rather than post hoc expansion.

### Exact-once supervisor and package contract

`scripts/run-vitest-check.mjs` accepts only one optional `--diagnostics` flag. `test-infrastructure/vitest-check-supervisor.mjs` uses fixed repository-owned paths and Node's `spawn` with `shell:false`, no eval, no npx, no network, and no fallback. Ordinary always runs first; resource-intensive always runs second even if ordinary fails. Each result is preserved in the final summary.

`package.json` changes only `check`:

```text
tsc --noEmit && node scripts/run-vitest-check.mjs --diagnostics
```

`test` remains `vitest run`, and `test:watch` remains `vitest`.

No timeout, dependency, lockfile, Node, pool, isolation, reporter visibility, retry, skip, or unhandled-error policy changed.

## Commit boundaries

1. `19d74225fe56ea376620ecbc1226fbafce3d0532` - `test: add sanitized Vitest failure diagnostics`
2. `f017090c3a333cfb152bf49a62bdd958c775f8e8` - `test: schedule Vitest workloads exactly once`
3. `08100582e955ae67d660a6944ab665d1ac14436f` - `docs: record Vitest RPC stability evidence`
4. This focused QA correction commit - fail-closed indeterminate process outcome, direct regression coverage, and independent-QA transcription

## Validation record

### Focused diagnostics milestone

The first 1-file diagnostics run exposed one birpc comma-matcher defect and one JS signature inference defect; it was not claimed green. After the narrow correction, the expanded final command passed:

- **2 files / 26 tests PASS**;
- repository-local TypeScript PASS;
- JS syntax/import smoke PASS;
- `git diff --check` PASS.

### Focused scheduler milestone

The classifier/supervisor/config/subprocess matrix passed:

- **4 files / 39 tests PASS**;
- exact-once ordinary/resource subprocess launch;
- ordinary nonzero still followed by resource;
- signal, launch, malformed diagnostic, missing diagnostic, hostile extra field, overlap, omission, missing target, duplicate, alias, noncanonical path, unsupported evidence, config, and package script cases all covered.

TypeScript then found only an inferred writable-stream type mismatch in the test seam. Explicit JSDoc narrowed the public seam; runtime code was unchanged. Final evidence:

- repository-local TypeScript PASS;
- real installed Vitest custom reporter / fd 3 integration: **1 file / 10 tests PASS**;
- JS syntax checks PASS;
- `git diff --check` PASS;
- lockfile hash unchanged.

### Single literal repository gate

Exact command:

```powershell
npm run check
```

It ran exactly once and was not rerun.

Outcome:

- command exit: `1`;
- tool-observed wall time: `155.9s`;
- TypeScript: PASS;
- canonical files: 283 total;
- aggregate file result from the current-run Vitest cache: 262 passed, 16 skipped, 5 failed;
- failing tests: 6 across those 5 files;
- targeted `onTaskUpdate` RPC event: absent;
- test-timeout, reporter/IPC, launch, signal, teardown, and diagnostic-protocol events beyond the ordinary nonzero exit class: absent.

Phase evidence:

| Phase | Files | Workers | Exit | Elapsed | Diagnostic record | Classes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| ordinary | 264 | 4 | 1 | 32,837ms | 1 record / 239 bytes / valid | `signal_or_exit_failure` |
| resource-intensive | 19 | 2 | 0 | 108,782ms | 1 record / 249 bytes / valid | none |

The ordinary failures are the established absent ignored-output baseline:

1. `child-lexicon-ages-5-8.spec.ts` - 1 absent historical story fixture;
2. `momentum-gate-koko.spec.ts` - 1 absent page-beats fixture;
3. `page-entity-qa.spec.ts` - 1 absent PNG fixture;
4. `set-appearance-ref-budget.spec.ts` - 1 absent appearance-board PNG fixture;
5. `story-read-back-validation.spec.ts` - 2 absent story fixtures.

The assertion-level pass/skip total was not included in the v1 bounded supervisor evidence and the tool transcript retained only the six failure details plus exact file totals. No later Vitest collection or rerun was performed to reconstruct it. This limitation is explicit rather than replaced with an estimate.

Both phases completed once. The resource phase was not hidden behind the ordinary failure. No fixture was copied, created to satisfy a failure, imported, skipped, quarantined, or retried.

### Ignored-artifact cleanup

Six current-run ignored files were identified by exact current-run timestamp/path and removed by exact path:

- two `outputs/qa-anchors/test_lion__fp__wardrobe` files;
- two `outputs/test-fixtures/story-read-back-regression` files;
- `tsconfig.tsbuildinfo`;
- the current `node_modules/.vite/vitest/.../results.json`.

No historical ignored fixture, tracked file, or other worktree was removed or changed.

## Limitations and HOLD boundary

- The one permitted full run did not reproduce the targeted RPC event. That is encouraging bounded evidence, not proof the nondeterministic underlying mechanism is eradicated.
- Root cause remains uncertain within the approved causal set.
- The repository gate remains HOLD because the six established fixture-dependent assertions still fail. The implementation does not reclassify them as acceptable.
- Diagnostic evidence v1 records exact file/phase/process totals but not assertion pass/skip totals.
- The resource manifest is intentionally explicit. Future additions require repository evidence and a separate reviewed change; new specs otherwise default to ordinary.
- Two Vitest startups and phase ordering add wall time and can expose previously hidden inter-file/order coupling.
- A future `onTaskUpdate` recurrence must stop with evidence and return for another Decision Gate. It does not authorize timeout inflation, a different pool, dependency changes, full serialization, retries, or skips.

## Rollback

There is no migration or external state.

1. Revert the focused QA correction commit to restore the original independently reviewed range and its documented MINOR-1.
2. Revert `08100582e955ae67d660a6944ab665d1ac14436f` to remove the original documentation/evidence milestone.
3. Revert `f017090c3a333cfb152bf49a62bdd958c775f8e8` to restore the original `npm run check` launcher/config and remove classifier/supervisor policy.
4. Revert `19d74225fe56ea376620ecbc1226fbafce3d0532` to remove diagnostic taxonomy/reporter/tests.

The ignored local dependency tree may then be removed only as a separate explicit cleanup action if desired.

## Original Claude Code first-pass QA brief - completed

Review mode: **read-only first pass**. Do not edit, push, rerun `npm run check`, copy/import ignored fixtures, or change dependency/pool/timeout policy.

Original requirement: stabilize the distinct Vitest worker-to-main `onTaskUpdate` RPC failure through sanitized diagnostics, an evidence-backed deterministic resource manifest, and two exact-once parallel phases while preserving the frozen Node/Vitest/Tinypool/forks/isolation/lockfile/timeouts and ordinary four-worker baseline.

Implementation claims to falsify:

1. The canonical inventory comes from the active config policy and every canonical spec appears exactly once across the two phases.
2. Missing targets, duplicate/case aliases, overlap, extras, omissions, invalid paths/evidence, and malformed policy fail before Vitest launch.
3. New specs default to ordinary.
4. Both phases launch once; resource still launches after ordinary assertion/nonzero failure; no retry or early concealment exists.
5. Production launch uses `process.execPath` plus local `node_modules/vitest/vitest.mjs`, `shell:false`, fixed flags, no npx/eval/network/fallback, isolated forks, and file parallelism at 4/2 ceilings.
6. Reporter output remains inherited and diagnostics cannot serialize raw task payloads, error bodies, stdout/stderr, environment values, prompts, responses, or credentials.
7. Assertion, RPC, IPC/reporter, test-timeout, launch, signal/exit, teardown, and diagnostic-protocol failures are gate-failing.
8. `npm test` and `npm run test:watch` are unchanged; package-lock/dependency versions and all relevant timeouts/pool/isolation are unchanged.
9. The single full-run evidence is transcribed accurately and is not mislabeled PASS.
10. The explicit manifest contains only repository-evidenced paths and no story-specific production workaround.

Changed surfaces:

- `test-infrastructure/vitest-diagnostics.mjs`
- `test-infrastructure/vitest-diagnostic-reporter.mjs`
- `test-infrastructure/vitest-workload-policy.json`
- `test-infrastructure/vitest-workload-classifier.mjs`
- `test-infrastructure/vitest-check-supervisor.mjs`
- `scripts/run-vitest-check.mjs`
- `vitest.config.ts`
- `package.json`
- `lib/__tests__/vitest-diagnostics.spec.ts`
- `lib/__tests__/vitest-workload-classifier.spec.ts`
- `lib/__tests__/vitest-check-supervisor.spec.ts`
- `lib/__tests__/fixtures/fake-vitest-entrypoint.mjs`
- `CURRENT.md`
- this Decision Gate/evidence pair

Focused evidence available to reproduce without the full gate:

```powershell
$repo = 'C:\Users\guyna\.codex\worktrees\97a1\Small_Heroes'
Set-Location $repo
git status --short --branch
git log --oneline --decorate -4
git diff --check a65de8bc617da34c0db56bce48fd81299ca7d988..HEAD
node node_modules/typescript/lib/tsc.js --noEmit --project tsconfig.json --incremental false
node node_modules/vitest/vitest.mjs run lib/__tests__/vitest-diagnostics.spec.ts lib/__tests__/vitest-execution-policy.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts lib/__tests__/vitest-check-supervisor.spec.ts --pool=forks --isolate --fileParallelism --maxWorkers=2 --reporter=verbose
```

The completed immutable first-pass range was `a65de8bc617da34c0db56bce48fd81299ca7d988..08100582e955ae67d660a6944ab665d1ac14436f`. Claude Code returned the independent PASS and one non-blocking MINOR recorded above. Any correction reviewer branch/HEAD mismatch must stop the micro re-gate and be reconciled first.

Codex does not self-award technical PASS. Guy retains product/priority authority; this milestone changes no customer-visible behavior.
