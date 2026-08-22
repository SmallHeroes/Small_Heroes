# Chameleon gender-flexible Story Source authority — implementation evidence

**Date:** 2026-08-22

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Decision Gate:** `CHAMELEON_GENDER_FLEXIBLE_SOURCE_AUTHORITY_DECISION_GATE.md`

## Outcome

The Chameleon source revision is now template-neutral authoring authority. The
historical accepted source and approved package remain immutable. The new
pending source changes exactly one metadata line from `gender: female` to
`gender: neutral`, keeps the reviewed chip-complete prose correction, and keeps
the two neutral English image-direction corrections.

This milestone is offline and non-authorizing. It creates no accepted revision,
review approval, reconciliation, Blueprint, Visual Package, locator update,
provider call, render, database write, storage write or deployment.

## Closed semantics

- `female`, `male` and `neutral` are the only Story Source gender modes.
- `neutral` means the source is complete for both boy and girl; it does not mean
  unknown gender.
- The legacy editorial profile remains exact-`female` by default.
- The explicit `gender_flexible` profile requires exact `neutral`.
- Runtime Story Bank prose is resolved from Wizard child gender. Package
  authoring remains order-independent.
- The compiler sees the exact phrase
  `gender-flexible source (boy/girl resolved at runtime)`.
- Arbitrary source gender values fail at Story Source snapshot and extraction
  boundaries.

## Pending artifacts

| Artifact | Identity |
|---|---|
| Request v3 | `19142a82f8856b0a908e8e65bf2fc9bbf4c61c8ff227598c87def5ee653fcfed` |
| Pending manifest v4 | `5864b11f6750d45948d2af8067344c01b2daf2d586af6fa0ff623f13d3635f53` |
| Neutral accepted-source candidate | `2100ea1494a9d9112b842113470ba3d3cb6ad8f36749256dc8ab7d68291ecb75` |
| Visual-direction candidate | `a3b9483889c56caf0698eac87e62f89978e589f377c3a0ca5299a3d5075e3d29` |
| Integrated source | `3aac47b55f606fd65a127c0679ffb42e6b16f93783d7a6386d81e5e8db01cef4` |
| Direction migration | `593e0d8b3d957e073a27f9ceca150ca3b8a56329646090ff7ac89646ecf50d50` |

Projection evidence:

- female full: `19efe8f3f3f62adf219ee903f3a2b20be0ccc1cdcabf4cf75c9806d1483a872d`;
- female prose excluding only the exact gender line:
  `c4e50ece51dbeb19687682f64dda8b0915e532da4e53de4eb60997b1571c21bd`,
  byte-identical to historical female prose;
- male: `75999df45ff3b7e04bd8d390c51fd892cf03154a3d56e7a64afe64cf8909ce8d`.

The manifest reports `approved:false`, `providerCalls:0`, `storageWrites:0`,
`databaseWrites:0`, and `renders:0`. Its output root accepts only a fresh mint;
an identical second invocation was rejected before writes and the five-file
SHA/length inventory stayed unchanged.

## Version cutover

| Authority | Previous | Current |
|---|---:|---:|
| Story Source snapshot | v2 | v3 |
| Template user prompt | v13 | v14 |
| Authoring request / receipt / readiness | v44 / v49 / v47 | v45 / v50 / v48 |
| B0 input / manifest / verification | v33 / v42 / v42 | v34 / v43 / v43 |
| Execution materialization input / result | v32 / v36 | v33 / v37 |
| Supervisor request / readiness / result | v41 / v41 / v34 | v42 / v42 / v35 |
| Fresh readiness | v41 | v42 |

Candidate v9 and QA Wizard Bridge v4 are unchanged; their current validators
bind the new nested authorities. Immediate predecessor authoring artifacts are
legacy-immutable, not current authority.

## Historical Snapshot compatibility

The initial full check exposed that the approved time-only migration was bound
to the exact v2 Story Source snapshot digest. Rebuilding v3 and comparing it to
that reconciliation falsely made the migration stale. The reader correction
separates two proofs:

1. current v3 reconstruction proves the Story Source identity, path and bytes;
2. the time-only lifecycle validates and persists the exact v2 or v3 snapshot
   digest already named by the approved package reconciliation.

No legacy snapshot is admitted as current authoring authority and no historical
artifact is rewritten. Real time migration, approval, Set Board rebind and
assembly pass after this correction.

## Validation

- focused source/materialization/runtime matrix: 289 assertions pass after the
  two stale literal corrections;
- canonical authoring boundary, materialization input and QA Wizard Bridge:
  192 assertions pass; aggregate process exit was nonzero only for one known
  Vitest `onTaskUpdate` timeout after all test files passed;
- historical/current source and time-authority compatibility: 3 files / 112
  tests pass, exit 0;
- `npx --no-install tsc --noEmit`: pass;
- `npm run story:autonomous-typecheck`: pass;
- `git diff --check`: pass.

Literal `npm run check` ran once and was not retried. Ordinary ran 3,459 tests:
3,449 passed and 10 failed. Five failures were the established missing ignored
`outputs/` fixtures. Five newly exposed time-authority failures were fixed and
then passed in the 112-test replacement. Resource-intensive ran 611/611
assertions and exited nonzero only for three established worker RPC timeouts.
The repository-wide gate is not represented as green.

## Preserved boundaries

- historical accepted source and storyboard corpus bytes unchanged;
- approved Visual Package and current locator unchanged;
- four pre-existing untracked Set Board artifacts untouched and unstaged;
- no provider, image, render, deployment, database, storage or credential path;
- the untracked revision lifecycle script is excluded from this milestone.

## Next gate

Commit only the focused implementation and tracked documentation, then give
Claude Code the immutable base-to-head range for adversarial read-only review.
Do not approve or promote pending v4 until Claude returns PASS and Guy accepts
the exact future revision/review identities produced by the separately hardened
acceptance lifecycle.
