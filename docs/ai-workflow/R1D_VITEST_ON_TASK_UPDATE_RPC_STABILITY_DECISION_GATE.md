# R1D-VITEST-ON-TASK-UPDATE-RPC-STABILITY Decision Gate

Status: **approved by Guy; implemented locally; repository gate HOLD pending independent QA**

Date: `2026-08-03`

Approved base: `a65de8bc617da34c0db56bce48fd81299ca7d988`

Branch: `codex/r1d-vitest-on-task-update-rpc-stability`

Worktree: `C:\Users\guyna\.codex\worktrees\97a1\Small_Heroes`

## 1. Proposed change

Make the repository's `npm run check` contract execute the canonical Vitest surface in two deterministic exact-once phases, with a bounded evidence-backed resource manifest and sanitized opt-in diagnostics for worker RPC and adjacent process failures.

## 2. Why now?

Passing assertions can still end with `[vitest-worker]: Timeout calling "onTaskUpdate"`. The event has recurred in full and focused parallel aggregates and was independently reproduced with a real local dependency tree, falsifying the earlier junction-only explanation. Until the infrastructure boundary is explicit, `npm run check` cannot reliably distinguish assertion correctness from worker-to-main reporting failure.

## 3. Scope

This is a general test-infrastructure change. It is not story-, child-, companion-, page-, render-, provider-, database-, or deployment-specific.

In scope:

- repository-owned failure taxonomy and bounded diagnostic evidence;
- canonical spec inventory and deterministic partition validation;
- one ordinary and one resource-intensive Vitest phase;
- aggregate gate semantics and focused tests;
- `npm run check` wiring and durable evidence.

Out of scope:

- product/runtime behavior;
- dependency, Node, pool, isolation, lockfile, test timeout, teardown timeout, or RPC timeout changes;
- retries, skips, quarantine, ignored unhandled errors, full-suite serialization, fixture manufacture, or node_modules patching.

## 4. Approved architectural decisions

1. Treat `onTaskUpdate` as a distinct fail-closed reporter/IPC failure.
2. Freeze Node `22.19.0`, Vitest `3.2.4`, Tinypool `1.1.1`, forks, isolation, the lockfile, and the ordinary four-worker baseline.
3. Add bounded, sanitized, opt-in diagnostics without payload or credential capture and without changing the 60-second RPC timeout.
4. Add a measured resource-intensive manifest plus a computed ordinary complement; classification is deterministic, total, disjoint, and fail-closed.
5. Run ordinary and resource-intensive phases exactly once each and aggregate their exits; no retry, skip, concealment, or duplicate execution.
6. Preserve file parallelism: ordinary up to four workers; only evidence-backed resource specs up to two.
7. Preserve reporter visibility and make assertion, RPC, IPC, reporter, launch, teardown, signal, and exit failures gate-failing.
8. Permit one literal `npm run check` only after focused validation and TypeScript; never rerun it in this task.
9. If selective scheduling does not resolve the event, stop with evidence and return for a separate decision. Do not serialize the full suite, raise timeouts, change pool, or change dependencies.

## 5. Verified source path and causal boundary

Installed locked package source establishes:

1. `@vitest/runner` batches task packs and tracks outstanding task-update promises.
2. Vitest patches the runner so `onTaskUpdate` calls the worker RPC and returns its promise.
3. Fork RPC serializes through Node V8 and sends through the child-process IPC channel.
4. Bundled birpc starts its independent default `60,000ms` acknowledgement timer.
5. Main-process `onTaskUpdate` applies state, reports task events, and awaits reporter `onTaskUpdate` hooks before returning the acknowledgement.

The event is therefore distinct from the default `5,000ms` test timeout and `10,000ms` teardown timeout. Available evidence does not resolve whether the delayed acknowledgement comes from main-loop starvation, IPC backlog, reporter/output pressure, serialization volume, or correlated subprocess/filesystem load.

## 6. Workload evidence

The manifest may contain only these closed evidence categories:

- `measured_repository_scan_contention`: seven specs that share repository snapshots over previously measured 630–1,151-file inventories;
- `direct_child_process_load`: specs with repository-visible direct spawn/exec call sites;
- `measured_full_load_timeout`: the canonical live-authoring boundary previously exceeded its test budget under full load.

The 19-path manifest is durable in `test-infrastructure/vitest-workload-policy.json`. New canonical specs remain visible and default to ordinary unless a later evidence-backed decision deliberately classifies them.

## 7. Expected behavior

- Classification fails before Vitest on a missing target, duplicate, path alias, ambiguous case, overlap, extra, omission, malformed policy, or unsupported evidence.
- Ordinary and resource-intensive are a total disjoint partition of the canonical include surface.
- Each phase launches once through Node and the installed local Vitest entrypoint with `shell:false`.
- The resource phase runs even when ordinary fails.
- Original reporter output is inherited unchanged.
- Sanitized diagnostics record only schema, phase, bounded counts, exit/signal class, diagnostic classes, and elapsed time.
- Any failed phase makes the final command fail.

## 8. Validation plan and run budget

- focused taxonomy/reporter tests, including hostile raw data;
- classifier positive and fail-closed negative matrix;
- real subprocess tests for exact-once, nonzero, signal, launch, and diagnostic-channel failures;
- active config and package-script wiring checks;
- real installed Vitest custom-reporter integration;
- repository-local TypeScript and `git diff --check`;
- one literal `npm run check`, never rerun.

## 9. Cost impact

External cost is `$0`. No image, audio, provider, model, network, database, storage, deployment, or render action is permitted.

## 10. Rollback

Revert the documentation/evidence commit, then revert the scheduler/supervisor commit, then revert the diagnostic commit. This restores the original single-process `vitest run` package script and active config. There is no external state or migration to unwind.

## 11. Stop-check

- General system fix: yes.
- Cross-story/product risk: none; test execution only.
- Production behavior: unchanged.
- Spend: `$0`.
- Smallest proof: focused local tests plus the one approved full gate.
- Product decision: all nine decisions were explicitly approved by Guy.
- Independent QA target: partition completeness, exact once, failure aggregation, sanitized evidence, fixed dependency/timeouts/pool, and unchanged test/watch behavior.
- Claude Cowork/product eyeball: not applicable.

No unresolved product decision remained before implementation.
