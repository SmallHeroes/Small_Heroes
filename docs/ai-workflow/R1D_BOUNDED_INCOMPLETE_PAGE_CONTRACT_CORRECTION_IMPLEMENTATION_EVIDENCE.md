# R1D bounded incomplete PageContract correction — implementation evidence

**Date:** 2026-08-18
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `ee7cdbf1bff442ab5e41a11067e5bc81739239ab`

## Outcome

The compiler uses the remaining standard repair slot when, and only when, the
first `page_contract_patch` response is rejected with exact sanitized identity
`page_contract_repair_patch_set_incomplete`.

The PageContract applier checks the complete expected cardinality before it
clones or applies any page, so the provider response cannot leak partial state.
The correction iteration therefore starts from the same draft and derives the
same exact affected-page authority. A second incomplete response is terminal.
No fourth call, transport retry or fallback exists.

## Causal evidence

The consumed root
`outputs/r1d-recurring-lifecycle-fresh-ee7cdbf1-20260818T133535132Z`
contains receipt v41
`f34d6267f4ee231edc1d04dfb9f5d1b41585a2514b4ed732a4d3cb41138b4a5b`.
It proves the prior lifecycle identity is absent and records exact terminal
identity `page_contract_repair_patch_set_incomplete` on repair attempt 2. The
provider completed both calls; attempt 2 emitted 13,698 tokens against its
32,000 cap. Candidate and downstream authority are absent.

## Validation

- incomplete nonempty subset followed by the exact complete set reaches a
  Candidate in 3 calls / 2 repairs;
- two consecutive incomplete nonempty subsets stop at 3 calls / 2 repairs with
  the exact terminal identity and no fourth call;
- both repair calls decode to the same PageContract authority;
- PageContract unit: 63/63 PASS;
- compiler repair loop: 36/36 PASS;
- source-authority lifecycle: 94/94 PASS;
- combined: 3 files / 193 tests PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

PageContract schema/prompt/input versions, the complete authority requirement,
authoring and downstream artifact versions, policy, model/tier/reasoning,
budgets, retries/fallback, hard `$5`, Candidate v9, Wizard and renderer are all
unchanged.

No credential, provider, Fresh Readiness, live authoring, image, render,
storage, deployment or production operation occurred during implementation.
