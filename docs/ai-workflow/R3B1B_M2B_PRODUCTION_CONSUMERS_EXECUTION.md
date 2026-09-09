# M2b — semantic production bridge and real consumer integration

Date: 2026-09-09. Status: IMPLEMENTED; LOCAL FULL CHECK GREEN; INDEPENDENT QA PENDING.
Independent code PASS still ends at `8766aff1`. This is not product acceptance,
M2b completion, a real P1 approved package, or render readiness.

## Requirement, topology and scope

Guy directed continued work toward a ready book without another generic
approval. Existing General Semantic Recovery Gate covers this M2b integration;
its continuation addendum was recorded before implementation. Same task is the
sole writer in `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
`codex/r3b1b-semantic-recovery-m1`. Base is exactly
`3743b20a7f46daa248c53536200e45cc97124b69`, clean and 0/0 at start.
One focused implementation commit is intended; the final handoff pins its HEAD.
No new overlapping task, dependency worktree write, cleanup or push is authorized
by implication. Protected read-only dependencies:

- `C:/Users/guyna/.codex/worktrees/d53b/Small_Heroes`, `768ccb2fe20edb1351cb4783796613cbf7a2993c`.
- `C:/GNart/Work/sh-r3b1b-accepted-intent-wave-2`, `63ccb4846ebe5be9ab392960d389610a1b2b9d42`.

Claude's supplied documentation re-gate `8766aff1..3743b20a` is PASS 0/0/0,
closing focused-command P2. Both commits were already propagated at this
continuation's start; no actor is inferred. This does not extend code PASS.

## Observed cause and implemented solution

Reviewed v6 reconciliation artifacts intentionally had null production contexts.
Actual Blueprint and package consumers accepted only the legacy v5 bridge and
loaded authority synchronously. Fresh historical/current validation is async.
The first genuine P1 context integration additionally exposed a v4-only schema
filter in the shared package template loader, despite the established v5 group
validator. These are consumer integration gaps, not new story defects.

1. Materialize the exact approved effective template and reconciliation as raw
   canonical content-addressed JSON. These projections are inputs, not authority.
2. Build a distinct `qa-wizard-semantic-production-bridge/v1` by reconstructing
   the full approved semantic chain, raw projections, source, style and existing
   production context/Set admission. Bind complete context digest and exact
   approval, template, coverage and style identities. Every read repeats validation.
3. Dispatch through `qaWizardProductionContext.ts`: semantic version uses that
   strict loader; other input uses the existing v5 loader. Rejection never falls
   back from semantic to legacy, and pending/review-only artifacts remain closed.
4. Migrate the real Blueprint and package authority-dependent call graphs and
   CLIs to async/await, including replacement/diagnostic lanes, recovery/replay,
   approvals and package publication. Await the lane precheck before claims.
5. Pin scalar caller inputs before awaits; recheck affected manifest/claim/lookup,
   successor authority and terminal census bytes/state across async validation.
6. Use the existing `humanGroupSchemaIsSupported` predicate in template loading;
   retain the full validator, story/coverage/digest checks, and reject v4 with
   groups, v5 without groups, empty groups and future schemas.

No content policy, prompt, catalog, threshold, model, paid budget or QA gate
change. No fake Candidate, v5 relabeling, ambient context, cached validation or
synchronous subprocess adapter. Three strict offline CLI operations are added:
`materialize-production-inputs`, `prepare-production-bridge`,
`read-production-bridge` in `scripts/semantic-correction-approval-bridge.ts`.

## Compatibility, failure semantics and rollback

Legacy artifact schemas remain readable with identical legacy identities.
Authority-loading APIs now return Promises; callers must await them. All located
repository callers/tests/CLIs are migrated; unknown external JS callers would
also need migration. The old v5 loader itself remains synchronous and unchanged.
Blueprint/package manifest versions stay unchanged and explicitly allow only
the old v5 or new semantic production bridge identity.

Projection materialization preflights both destinations. It is not a multi-file
transaction: a filesystem failure may leave valid immutable projections, never
a production bridge. Exact retry is idempotent; collisions/aliases fail closed.
Bridge preview creates no output; it requires the two prior input projections.
No filesystem-wide lock or protection against arbitrary privileged concurrent
disk writes is claimed. Async lifecycle changes merit hostile race/replay QA.

Rollback: stop using the additive semantic bridge and revert this focused
commit, migrating callers back with it. Do not delete original artifacts or
reinterpret the new bridge as v5. No database/deployment migration is involved.

## Validation and candid development history

Logs are under ignored local `outputs/qa-m2b-production-consumers-20260909/`.
They are not Git-tracked; no off-machine backup has been verified, and pushing
this commit will not preserve them. Regeneration cannot restore original logs.
Final `npm run check` exited 0 in one full run: 5796 passed, 73 existing skips,
zero failures; root and autonomous typechecks passed. Ordinary phase: 369 files,
5125 passed / 73 skipped, workers 4, 136437 ms, exit 0. Resource phase: 22 files,
671 passed, workers 2, 248047 ms, exit 0. Canonical inventory stays 391; no worker,
timeout, skip, discovery or gate policy changed. Raw full-check.log SHA-256:
`1f9904340aef93bcd7f1a01be95d17e00d35727d8bffc5eb5d1c1b13e44b60e8`.
This is one locally green run, not closure of the separate timing reliability P1.

- Initial async migration: 41 failed / 80 passed and 3 unhandled errors in four
  specs. Mechanical test over-awaiting broke deliberate inflight/rejection
  assertions; additionally a real missed async precheck callback was fixed by
  awaiting it before claim/provider. These were development failures, not inherited.
- `migration-focused-2.log`: four specs, 121/121 passed after those fixes.
- `production-focused-1.log`: 75 passed / 1 failed, exposing the actual v5 schema
  loader gap. `production-focused-2.log`: suite failed before tests due to a
  development import typo; corrected to existing `humanGroupCast` module.
- `production-focused-3.log`: two selected real P1-context tests passed; 74
  filtered tests were not run. This selected run is not a full 76-test PASS.
- `focused-1.log`: seven specs, 265/265 passed before final async race tests and
  fences. Final focused/full runs supersede it for final-state validation.
- `focused-final.log`: seven specs, 268 passed / 2 failed. The two newly added
  slot tests correctly observed rejection but incorrectly expected the slot
  directory to be absent: proposal preparation had already made empty categories.
  Corrected assertions require the existing slot directory to stay empty.
  `async-slot-regression.log`: both corrected cases passed (31 other tests were
  filtered, not executed). No production fix, timeout or skip change followed.
  The final full check, not an invented 270/270 focused rerun, validates the final
  seven-spec state including the added real legacy shared-loader assertions.
- Development typechecks caught the source-identity field, unknown input narrowing,
  Promise CLI call sites and a fixture literal assignment; fixes are in this diff.

The P1 positive test uses real source, effective template/coverage and style,
the real context builder, semantic bridge loader and actual Blueprint preflight/
reload. Only historical/current validator and Git authority are fixture seams.
Reconciliation decisions remain structural fixture inputs, NOT product decisions.
Package integration tests exercise actual Blueprint and package stages through
publication/replay for both bridge versions, but mock the authority loader and
  provider. Combined seam coverage is not a full real P1 package or live end-to-end
render. Test-local approvals and locator writes are confined to test roots.

Development log SHA-256 (raw bytes; retained failures are not overwritten):

| Log | SHA-256 |
| --- | --- |
| migration-focused-1.log | c985865b7b3ab34caabde37784ae791dde4b4b378140d8462c80098f111d105c |
| migration-focused-2.log | 9f80b9a56472bc9f3dd59285f7041502e49e7cd9a795c560624b4ef8cba3f972 |
| production-focused-1.log | 4cadc6df2658c7caf2468ac4924d1dc7fb7285071c332d52fced9c20fbe6389d |
| production-focused-2.log | 7ace68fdee9c8f07682e9d33fc2a0d4f235abbf804da8b521c2dacfaf3e23f71 |
| production-focused-3.log | 3416a473ca35095cd3292c151395fbc16576f23b91fbe26516ffc5e0074815d6 |
| focused-1.log | 4f05ecc2a7fd55fc2c08626e57e6d250fb71c453768b4c228c6da4cae0e5fa63 |
| focused-final.log | d9620f22e6cad73a4937614d4424e4cc9267fa37e03dd149c73a05ddd8766d36 |
| async-slot-regression.log | 603d59ec5460365354dc9879dc9e285a3a4abb141d7dba155a153060abfe96c3 |

Preservation check during final validation: exact published inventory script
recomputed 14 files / 412516 bytes, SHA
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
Raw accepted packet SHA remains `d2020e7381679502380fa44c0e1c357da4204155f73885adabb479759eb3c4ba`;
approval SHA `522e48e78350c93042bcc59c9df41386caf3a64f41527ffd51eb5346362a536e`;
pending bridge SHA `c2251c152a90fc5a1ce9ac4313e688bfe293b0231b807f3c1a8f1ce969bbc44c`.

Focused command (all paths must exist; no fabricated filters):

Final inventory expectation: 7 files / 270 tests (94+64+33+16+14+34+15).

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
$focusedSpecs = @(
  'lib/visual-package/__tests__/semantic-correction-approval-bridge.spec.ts'
  'lib/visual-package/__tests__/qa-wizard-blueprint-authoring-lifecycle.spec.ts'
  'lib/visual-package/__tests__/qa-wizard-blueprint-replacement-lifecycle.spec.ts'
  'lib/visual-package/__tests__/qa-wizard-blueprint-replacement-cli.spec.ts'
  'lib/visual-package/__tests__/qa-wizard-package-lifecycle.spec.ts'
  'lib/visual-package/__tests__/visual-package-lifecycle.spec.ts'
  'lib/visual-package/__tests__/qa-wizard-candidate-bridge.spec.ts'
)
if (($focusedSpecs | Select-Object -Unique).Count -ne $focusedSpecs.Count) { throw 'Duplicate spec path' }
foreach ($spec in $focusedSpecs) { if (!(Test-Path -LiteralPath $spec -PathType Leaf)) { throw "Missing spec: $spec" } }
npx vitest run @focusedSpecs --maxWorkers=2
if ($LASTEXITCODE -ne 0) { throw 'Focused tests failed' }
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'Root typecheck failed' }
npm run check
if ($LASTEXITCODE -ne 0) { throw 'Full repository check failed' }
```

## Independent QA targets and remaining work

Read-only first pass, exact final base-to-head range supplied by Codex. Reconcile
branch/HEAD before accepting findings. Attack: actual v6-to-Blueprint cutover;
full context/style/Set and effective coverage identity; pending/null artifact
rejection; wrong/rehashed pins, aliases, collisions, stale current authority;
async caller mutation, ledger/manifest/census drift; precheck awaited before
claim/provider; concurrent/recovery/frozen/replacement/diagnostic isolation;
legacy shared-loader compatibility; real package version union and locator CAS;
CLI errors, Promise call sites and absence of skipped/relaxed checks. Check the
mock boundaries above, not only test counts. Return P0/P1/P2 PASS/HOLD; Codex
does not independently PASS its own work.

Remaining: independent consumer QA; exact real reconciliation mappings and Guy
decision; current production bridge/Blueprint, required Boards/package, and the
already-authorized bounded visual verification. General implementation/render
permission is not pending again; exact new product acceptance cannot be invented.
Original P1 stays HELD 0/3/3, M2b/book readiness incomplete, timing reliability
P1 unresolved even if a single full run passes. No credentials/providers/spend,
real render, publication, deployment or payments in this implementation.
The existing accepted packet and real approval/pending manifests remain immutable
and locally stored; pending `80177ac9` binds historical `28f25ef7`, not current HEAD.
