# R1D — Compound Page Repair Canonical Context Implementation Evidence

## Topology and scope

- Base: `a43f2d5dafe2edb6f771721d17bdf1c426ceb4ce`
- Branch: `codex/r1d-compound-page-repair-canonical-context`
- Code head: `48c10306` (`fix(authoring): repair compound pages from canonical context`)
- Production implementation is limited to canonical planning context,
  complete-page target derivation and authority-version cutover.
- Historical output artifacts were not edited or rematerialized.

## Observed failure and root cause

Attempt 2 produced exactly three action-coverage cardinality issues and one
page-spatial reference issue. That issue union is already the closed,
approved complete-page compound repair family, but its plan returned null for
two independent general reasons:

1. Spatial validation used `canonicalizeTopology` output. The planner then
   re-checked raw provider page topology, so a raw zone alias such as
   `ZONE_ROOM` no longer matched the compiler-owned `zone:room` authority.
2. The compound complete-page planner called the field-only spatial-target
   builder. That builder requires predicate/subject/object context for the
   exact-field patch prompt, even though the complete-page prompt and
   application path do not consume that context.

The failure therefore fell through to terminal classification without using
the otherwise-authorized repair call.

## Implemented behavior

- `DraftAuthorityReferenceDomainError` can retain a deep-cloned canonical page
  view in memory when spatial authority was actually collected. It is not part
  of receipt/readiness diagnostics and is never persisted.
- Compound planning proves exact page/index/field/reference targets against
  that compiler-canonical view. The response still patches the raw draft by
  exact page identity, and the result must pass full recompilation.
- Spatial target derivation is split into a strict base and the existing
  field-patch enrichment. Complete-page compound repair uses only the strict
  base; field-only spatial repair still fails closed unless complete action
  context exists.
- No new issue family, repair mode, broad fallback or provider-authored
  authority was introduced. Missing/ambiguous pages, invalid authority,
  malformed locators, duplicates and non-target drift remain rejected.

## Authority migration

- Authoring policy: v8.
- Authoring request / receipt / readiness: v25 / v28 / v26.
- Live materialization input / manifest / verification: v14 / v23 / v23.
- Execution materialization input / result: v13 / v17.
- Supervisor request / readiness / result: v22 / v22 / v14.
- Fresh Readiness evidence: v22.
- Immediate authoring predecessors v24 / v27 / v25 are explicitly
  `legacy_immutable`; all old artifacts remain historical and cannot authorize
  a new attempt.

## Validation

- Test-first red proof: both new regressions failed before the fix, one because
  compound planning returned null with irrelevant malformed action context and
  one because raw zone alias topology prevented the repair call.
- Focused final validation: 9 files / 447 tests PASS under repository workload
  policy (3 ordinary files / 176 tests at 4 workers; 6 resource-intensive files
  / 271 tests at 2 workers), with valid diagnostics and no timeout, RPC/IPC,
  reporter, launch, signal or teardown failure.
- Migration regression: 1 file / 69 tests PASS after explicit legacy/current
  assertions were added.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Literal `npm run check`: invoked exactly once. TypeScript and autonomous-story
  TypeScript passed; ordinary phase passed 3,182 assertions and reported five
  ENOENT failures in four established ignored-output fixture members;
  resource-intensive phase passed 19 files / 577 tests with clean diagnostics.
  There was no seventh/new implementation or infrastructure failure. The
  ignored-output baseline remains the separate repository/release HOLD.

## Unchanged behavior and rollback

Unchanged: model, Responses route/service tier/reasoning, prompts and structured
output schema, 64K input ceiling, logical call/repair budgets, timeout,
transport retry count, fallback policy, hard `$5.00` cap, candidate semantics,
final validators, Blueprint/Wizard behavior and render/storage/deployment
boundaries.

Rollback is the single code commit before any new authority is materialized.
After Fresh Readiness or live use, rollback also requires discarding those new
authorities; historical artifacts must never be rewritten.

## Acceptance state

Codex records local implementation evidence only and does not self-award
independent technical PASS. Claude Code must falsify the exact range before a
new Fresh Readiness and live attempt are treated as technically accepted. No
credential, provider, B0/Fresh Readiness, preflight, live authoring, render,
storage/database, deployment, Production or push action occurred in this
implementation; cost was `$0`.
