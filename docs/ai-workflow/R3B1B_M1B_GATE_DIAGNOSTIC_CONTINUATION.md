# M1b supplied QA and repository-gate diagnostic continuation

2026-09-08. Implementation base: `711d63f0d11df096efc4bdfbd842af4aa8fcb97c`.
Status: complete uninstrumented gate PASSED; intermittent root cause unresolved.

## Authority and topology

The supplied independent Claude Code PASS P0=0/P1=0/P2=0 is bounded to
`d91fc72b..711d63f0`. Codex verified the two-commit, no-merge, 29-path,
+703/-108 topology and `git diff --check`. Claude's 396 focused tests, both
typechecks, held replay and 27 assertions are attributed to its report, not
claimed as newly rerun by Codex in this continuation. The full-check log it
reviewed remains a failed run; Codex recomputed its exact SHA-256:
`ab133ccd573e3b208a95cd9d3b116a62d2e24bc4b35b4d0d7b69a11fb0feb3cc`.

This task remains the only implementation writer, same branch/worktree
`codex/r3b1b-semantic-recovery-m1`, `C:/GNart/Work/sh-r3b1b-semantic-m1`.
At continuation start: clean, cached ahead 7 / behind 0, HEAD `711d63f0`.
d53b (`768ccb2f`) and accepted-intent (`63ccb484`) were clean and read-only.
The full worktree/branch inventories were inspected; no cleanup, remote-parity
claim or push. Existing approval authorizes continued recovery work, not changed
test deadlines, waived acceptance or new provider charges. Application spend $0.

## Observed and expected behavior

The supplied QA falsified the catalog cutover claims and found no defect.
The remaining repository failure was a native Git rejection in
`canonical-pre-live-readiness.spec.ts`; the previous full run instead failed a
5000ms materialization test. Isolated passes do not establish a repository PASS.

`liveExecutionSupervisor.ts` uses a native synchronous Git call with a 10000ms
deadline and bounded output. Its adapter reduces the native error to a Boolean;
the caller emits `git_command_failed` for errors, signals, nonzero status or
oversized output. The old log therefore cannot distinguish those causes.
No specific native cause or inherited classification is established.

## Diagnostic method and limits

An ignored, opt-in preload records native Git verb, argument digest (not values),
timing, configured timeout/buffer, status/signal/error code and output byte
counts. No stdout/stderr text, argv values, environment values or credentials
are recorded. Calls/results are not retried or substituted. It is not imported
by production or committed as a runtime dependency.

1. `focused-traced.log`: both affected specs, 2 workers, 28 passed / 1 failed.
   The original drift test passed (16219ms). All 371 native calls with the
   10000ms supervisor deadline completed successfully, maximum 213ms. The one
   failure was diagnostic interference: the preload also entered the private
   CLI child; its diagnostic append hit the child's test write sentinel. This
   is an invalid broad-instrumentation control, not a product regression or
   reproduction of the old supervisor failure. Its failed log is retained.
2. `focused-worker-traced.log`: preload restricted to Vitest's worker and its
   own NODE_OPTIONS removed before test execution, so no diagnostic preload
   reaches a CLI child. 28 passed / 1 failed. The original drift test passed
   (17833ms), all private-entry sentinel controls passed, and materialization
   passed 15/15. All 371 supervisor native Git calls succeeded, maximum 276ms;
   187 topology calls with a 20000ms deadline had maximum 216ms, no native errors
   or signals, 186 exit-zero results and one exit 128 in the adversarial suite.
   Do not conflate that nonzero topology result with a supervisor timeout.
   The different failure was `makes one attempt per phase and can resume safely
   after local correction`: 8126ms against its unchanged default 5000ms timer.
   Diagnostic timing is not uninstrumented timing, and this does not prove the
   old native failure's cause. No timeout/worker/runner/test policy was changed.
3. One complete `npm run check` was then started with NODE_OPTIONS absent and
   without the diagnostic preload. Its ordinary phase passed 4936 tests with
   73 existing skips; resource phase passed 671/671, exit 0. Both typechecks
   passed; complete process exit 0, 5607 passed / 73 skips / zero failed.
   Inventory 387/365/22, workers 4/2, both phases once, empty failure classes.
   Ordinary elapsed 127786ms; resource elapsed 309633ms. The two originally
   failing specs both passed in this complete run. This is current-state gate
   evidence, not a repair or a guarantee against recurrence.

Complete log: `full-check-uninstrumented.log`, SHA-256
`00c6aa7807308d903c83f210198b3291625691fbf4a1e1cf29bae36fab5e2dc1`.
This new log has not been independently reviewed by Claude. Original P1
inventory was recomputed: 14 / 412516 /
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.

Artifacts: `outputs/qa-m1b-git-diagnosis-20260908/` (ignored).
The preload's first version differed only by lacking the worker guard and
NODE_OPTIONS removal added at the top. Preserve that distinction when reviewing
the two diagnostic logs. A passing fresh run, if obtained, is current-state
evidence, not proof that intermittent failures were fixed or cannot recur.

## Next approved recovery surface mapped (read-only, not implemented here)

The existing Gate still controls M2. Reuse source-bound supporting-cast facts,
compiler appearance policy and action check-ID construction, existing coverage
and source-evidence validation, prose projection, and exact cover operations.
No new service, provider authoring attempt or source rewrite is necessary for
the proposed offline recovery. The paid candidate/receipt remain immutable.

The exact original p2/p6/p10/p12 actions, mustShow entries and coverage were read.
Recover p6/p10 through `runs`; p2 hurried motion and p12 gentle withdrawal use
the existing presentation lane, preserving child walks and companion p8 walks.
Replace the single p12 passive cutting entry at index 0 and its coverage value;
preserve the separate served-slice/cherry entry at index 5. Remove `if visible`
from the p12 cart state under Guy's already approved required-visible choice.
Cast recovery must carry individuals and groups without fabricated headcounts.

Bridge inventory confirms the version boundary is material: the current
attestation and reconciliation prepare functions rebuild a *current* authoring
request and call the current paid candidate factory. Those cannot consume the
held v3 receipt after the v4 cutover. M2 needs an explicit historical-chain input
and separately bound effective-template/effective-coverage correction, not a
relaxed current factory or a forged provider candidate. Existing cover-only v5
coverage equality must remain intact. This is the expected M2 dependency, not a
new defect in the independently reviewed M1b code range.

## Boundaries

After committing this evidence as `cff1abeb`, Codex attempted a read-only Claude
Code review with no credential/provider/edit tools. The CLI exited 1 before
model work with `Not logged in / Please run /login`: zero input/output tokens,
total_cost_usd 0. Log: `claude-closeout-review.jsonl`. No review verdict resulted,
and no reviewer remains running. Prior supplied code PASS is not revoked or
extended. M2 remains mapped, not implemented; automatic independent QA needs
owner reauthentication or an externally supplied read-only evidence review.

No production code, tests, runner configuration, timeouts, workers, inventory,
source or original P1 artifacts changed. No render, provider, credential access,
Blueprint, approval, promotion, publication, deployment, payment or push.
P1 remains HELD P0=0/P1=3/P2=3. M2 and exact-artifact product acceptance remain
incomplete. This document does not self-award independent QA to its own range.
