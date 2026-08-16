# R1D Page-Contract Repair Scope-Correction Budget — Implementation Evidence

## Topology and scope

- Worktree: `C:\Users\guyna\.codex\worktrees\repairout2\Small_Heroes`
- Branch: `codex/r1d-page-contract-repair-scope-correction-budget`
- Exact base: `faba79dbce5099bfb0ef110dc2cf2d24f64196b9`
- Implementation commit: `1c438de5`
- Provider/render/storage/Production cost: `$0`

The prior immutable attempt remains untouched. Its initial provider response
had one page-12 `action_coverage_cardinality_invalid` issue. Its first compact
page repair was completed but rejected by the strict applier as
`page_contract_repair_action_binding_scope_invalid`; the receipt stopped with
`repair_output_invalid` after 2 logical provider calls and 1 repair. No
candidate or downstream authority existed.

## General correction

1. The strict applier is unchanged. It still permits only the compiler-owned
   target action and, when necessary, at most one existing same-page coverage
   binding. It rejects additions, removals, multiple matching coverage changes,
   stale targets, invalid identities and all non-target drift.
2. The compiler maps only the exact sanitized
   `page_contract_repair_action_binding_scope_invalid` identity to the closed
   `non_target_drift` repair-output class.
3. When and only when that identity occurs on the first standard
   `page_contract_patch`, the original invalid draft remains unchanged and the
   already-authorized second standard repair is used. No transport retry or
   fallback is introduced.
4. The second compact user prompt carries the exact closed context
   `previousRepairFailure: "target_scope_invalid"`. It instructs the model to
   preserve every other binding and never add or remove a record.
5. Success re-enters the ordinary compiler/validator path. A repeated scope
   violation is terminal as `repair_output_invalid` after 3 calls / 2 repairs.
   All other repair-output failure families retain their prior terminal
   behavior.

No prompt/schema authority for the initial authoring call changed. Model,
service tier, reasoning, 64K input ceiling, output budget, two-repair/three-call
standard budget, timeout, transport retries, fallback, pricing, `$5` hard
ceiling, candidate semantics, Reconciliation, Blueprint, Wizard and render
behavior are unchanged.

## Authority migration

- authoring policy: v9
- authoring request / receipt / readiness: v26 / v29 / v27
- page-contract system / user prompt: v12 / v13
- live materialization input / manifest / verification: v15 / v24 / v24
- execution materialization input / result: v14 / v18
- Supervisor request / readiness / result: v23 / v23 / v15
- Fresh Readiness evidence: v23

The immediate prior request v25, receipt v28 and readiness v26 are admitted only
as `legacy_immutable`; they cannot become current authority.

## Regression evidence

- `page-contract-repair.spec.ts` and
  `draft-reference-domain-hardening.spec.ts`: 2 files / 110 tests PASS.
  This proves the closed correction value, exact prompt round-trip, successful
  second compact repair, repeated-scope terminal, unchanged insertion/removal
  rejection, and sanitized failure mapping.
- `source-authority-lifecycle.spec.ts`: 1 file / 70 tests PASS. This proves a
  persisted v29 lifecycle with exactly 3 calls / 2 repairs and a candidate
  after the first repair is rejected for scope drift and the second is valid.
  The receipt does not persist the correction hint.
- `visual-contract-repair-loop.spec.ts` plus canonical authoring, Fresh
  Readiness, materialization, verification and Supervisor tests: 7 files / 338
  tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- One literal `npm run check` completed:
  - ordinary: 281 files; 3,186 tests passed, 65 skipped, 5 ENOENT assertions
    failed across 4 files from the established ignored-output fixture baseline;
  - resource-intensive: 19 files / 577 tests PASS;
  - diagnostics protocol valid; no timeout, RPC/IPC, reporter, launch, signal
    or teardown failure.

The repository/release fixture HOLD remains separate. No new assertion failure
was observed in the milestone implementation.

## Security and authority boundaries

No raw prompt, raw provider response, provider message, source phrase, authored
identifier/value, stack, environment value or secret is persisted by the new
path. No credential was loaded or inspected. No network/provider call, B0,
Fresh Readiness, canonical preflight, live authoring, candidate persistence,
Reconciliation, Blueprint, Wizard, image/Vision, render, storage/database,
deployment or Production action occurred.

## Rollback

Revert the implementation and documentation commits. Existing artifacts remain
immutable and the prior behavior returns: the first unusable page-repair output
terminates immediately. No artifact rewrite or data migration is required.

## Independent QA status

Claude Code independently reviewed immutable range
`faba79dbce5099bfb0ef110dc2cf2d24f64196b9..e263e044` read-only and returned
**PASS** with zero BLOCKER, zero MAJOR and zero MINOR. It verified the exact
eligibility conjunction, unchanged 3-call/2-repair budget, unchanged-draft
continuation, closed prompt context, terminal repeated failure, full version
cutover and absence of unrelated behavior.

Claude's plan-mode sandbox did not permit an independent test rerun, so all
numeric validation results above remain Codex execution evidence. Its sole
informational observation is pre-existing and fail-safe: when a replacement
coverage binding changes but does not match the target beat ID, the strict
applier retains the original binding and full revalidation follows instead of
adopting the drift. This is not a finding in the reviewed range.

This record attributes the independent PASS to Claude Code; Codex does not
self-award it. The PASS grants no product, live, render, QA deployment,
Production or release acceptance.
