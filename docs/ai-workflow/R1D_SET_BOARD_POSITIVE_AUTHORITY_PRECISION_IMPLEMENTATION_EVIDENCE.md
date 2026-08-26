# R1D Set Board Positive-Authority Precision + Collect-All Admission — Implementation Evidence

**Date:** 2026-08-26
**Branch/worktree:** `codex/r1d-qa-wizard-downstream-lifecycle` / `C:\GNart\Work\sh-live-chameleon-v3`
**Reviewed/pushed base:** `b35f76301254ff089d3ce381e08f257cc7b39f1d`
**Production/test commit:** `ac9037be`
**Cost/render:** zero provider, image, audio, storage, database, deployment or render calls

## Outcome

The revised Chameleon authoring Candidate is no longer rejected by two lexical
collisions in Set Board positive-authority validation. The correction is
general, versioned and backward-compatible: definitions that pass v2 retain
their exact v2 identity, while only a v2 rejection is evaluated under the
precise v3 matcher.

Admission is now collect-all before Registry or storage access. Every required
Set is evaluated in an isolated contract projection, while orphan, malformed,
non-array and explicitly empty authority shapes remain visible in a residual
contract-scope census. Downstream consumers report `board_authority_invalid`
and `set_authority_invalid` instead of fabricating stale/missing-board noise.

## Verified root cause

Candidate `be2d3202ef92b7d0d0e2d9647871bc590cb8ec9bf55465e450c9c8141e7bcbc9`
was already a valid authoring result: 8 pages, 66 coverage records and zero
template validation errors. Downstream projection failed because:

- `set_home` treated physical `child-scale` furniture descriptions as cast
  authority;
- `set_neighborhood_route` derived bare `route` from excluded prop
  `prop_route_labels` / `Route-label set`, colliding with physical route
  openings and thresholds;
- the prior fail-fast projection exposed only the first Set/field failure.

Another provider attempt could not correct any of these deterministic local
consumer defects.

## Implementation

### Versioned precise matcher

- `set-board-positive-authority/v2` is unchanged and remains first choice.
- `set-board-positive-authority/v3` is selected only when v2 rejects and the
  complete v3 issue census is empty.
- The physical scale exception requires an exact Unicode hyphen/dash compound,
  a corresponding structured `furniture` node, and one exact closed node-ID
  suffix: `bed`, `table`, `craft table` or `work table`.
- Spaced verb forms, real child references later in the same field,
  portrait/statue/photo/silhouette disguises, wrong kinds, mismatched node IDs,
  and non-geometry fields remain rejected.
- Precise excluded-prop heads use terminal ID/name singular-plural alignment;
  full name and de-namespaced ID phrases remain blocked. Existing v2 semantic
  heads remain the fallback when no terminal alignment exists.
- Collect-all diagnostics retain distinct blocked identities and suppress only
  a redundant generic cast duplicate when a more specific identity explains
  the same occurrence.

### Two-layer admission and consumer fence

- `collectRequiredSetBoardAdmissionCensus` evaluates stable and semantic
  authority separately for every required Set.
- A residual contract projection collects orphan/malformed/non-array/empty
  authority failures without contaminating valid required Sets.
- Artifact resolution, runtime Board binding and the final pre-image Board
  assertion all complete admission before Registry/storage dependencies.
- Promotion, qualification, production readiness and Visual Package v4 map the
  failure distinctly and do not add misleading `board_stale` or
  `board_unresolved` comparisons after authority rejection.
- `set_authority_invalid` is candidate-invalid in v4, so review, approval and
  publication readiness all remain false.

## Real-artifact proof

The immutable Candidate census is deterministic and admits all three required
Sets with zero issues:

| Set | Policy | Set definition hash | Content policy digest |
|---|---|---|---|
| `set_home` | v3 | `e71fbd7acf90869409ae5e85928951f7a941e2a87e0efd327323b98bfa155d78` | `9e894ba0362f47d0a016732fbf1e909d85a53202c43f0fe7c19e72f0865c3f5c` |
| `set_kindergarten` | v2 | `a04ca2012f6c8837a720564f6ec32e330c49a76bf8bd3f9dd2aafe74fe7b0b8c` | `351e8f918db8b68c6a3e8eeea1103f034d01608e3d0171db65cc4c32f31a030c` |
| `set_neighborhood_route` | v3 | `a9c0e87d38fdeb75d7f1bb760bcc976c213fd8e57936b7eadf3ee4d9ce55f389` | `9e894ba0362f47d0a016732fbf1e909d85a53202c43f0fe7c19e72f0865c3f5c` |

Both immutable approved historical Chameleon package revisions remain 2/2 v2,
retain their exact historical Set hashes (`803dea01…`, `fd15ad19…`), and resolve
their real Registry Boards with zero issues. No Board, package, locator or
Candidate bytes were rewritten.

The successful authoring Supervisor result was persisted from an exact
post-hoc stdout recovery after the original process completed; it was not a
second execution. The authoring receipt remains
`0844f5addcf4fc2cad51f98cf4404e98424825f3859644b3395f2a04da74f5d9`,
with one provider invocation, zero retry/fallback, nominal cost `$0.465751`
and conservative cost `$0.512337`.

## Validation

- Focused authority + v4 lifecycle: 4 files, 74/74 tests pass.
- Full Set Board suite: 14 files, 349/349 tests pass.
- Selected Visual Package/readiness consumers: 6 files, 129/129 tests pass;
  one environment-gated file contributes 4 intentional skips.
- `npx --no-install tsc --noEmit`: exit 0.
- `git diff --check`: clean.
- Two independent read-only adversarial audits returned 0 BLOCKER / 0 MAJOR /
  0 MINOR before commit.

Literal `npm run check` on the final code bytes passes both TypeScript phases.
Ordinary runs 315 files: 293 pass, 17 skip and the same five unchanged
ignored-output fixture readers fail on nine absent local artifacts; 3,809
assertions pass and 70 skip. Resource-intensive runs 20/20 files and 623/623
assertions pass, followed by the three known Vitest `onTaskUpdate` RPC timeout
events. The repository command exits 1 and is not relabeled as a clean PASS;
no changed-code assertion fails.

## Changed surface

Production changes are limited to Set Board policy/projection/admission,
runtime Board preflight, Visual Package issue mapping and their exports. Tests
cover matcher counterexamples, v2 identity preservation, collect-all
per-Set/residual behavior, no-I/O ordering, and v4 candidate invalidation.

No Story Source, authoring prompt/schema/model/budget, Candidate, Board asset,
Registry entry, package, locator, Wizard UI, payment, render or deployment
semantics changed.

## Rollback

Revert `ac9037be` and the documentation closure commit. Existing v2 artifacts
require no migration or cleanup because no Registry or package bytes changed.

## Binding next action

Claude Code independently reviewed immutable range
`b35f76301254ff089d3ce381e08f257cc7b39f1d..f3df8eb9b52d20b1cc2b0b66f04d9b50fdf12b45`
and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It independently ran
the 74-test core matrix, 1,095 Visual Package assertions with five skips, and
TypeScript; every assertion passed. It reproduced the three post-completion
Vitest RPC timeouts and classified them as harness noise rather than test
failures. Its two stated evidence boundaries were non-findings: it did not
recompute the three real-artifact hashes itself and did not rerun the full
repository check, both of which Codex already recorded with exact outputs.

That technical PASS permits the offline reconciliation operator and exact
approval/mint lifecycle; it does not itself authorize a Board mint or render.
After exact reconciliation approval, the remaining sequence is three LOW
Board candidates, Board QA and Guy approval, Blueprint/package publication,
Preview preflight, then the one already authorized fake-paid LOW full Wizard
book for Bar age 5 with mom narration. No second paid authoring attempt is
needed.
