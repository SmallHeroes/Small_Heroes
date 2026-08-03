# R1D-PVB-D1A1B1 pre-live bootstrap failure attribution hardening — implementation evidence

## Status and topology

- Worktree: `C:\Users\guyna\.codex\worktrees\a065\Small_Heroes`
- Branch: `codex/r1d-pvb-d1a1b1-pre-live-bootstrap-failure-attribution`
- Immutable base and merge-base:
  `696e6eb27b82ac4b6e823bb9bc63edd2aec43852`
- Focused implementation commit:
  `f514971084bff5c0a19dd6bdcfb4810c44e70bbf`
- Documentation/evidence: this document's containing commit
- Upstream/push: none
- Cost: exactly `$0`
- Gate: **HOLD pending independent Claude Code technical review**. Codex does
  not self-award PASS.

The `a065` worktree began detached, clean, and exactly at the approved base.
The target local and remote-tracking refs were absent before the branch was
created. Every worktree was inventoried. `c5fe` and all other worktrees stayed
read-only; known pre-existing dirty state in `main` and
`feat/chunked-generation` was preserved.

## Observed defect and root cause proof

The original launcher enclosed trusted executable/repository authority,
topology verification, and npm CLI resolution in one catch. It chose the
failure phase with `paths ? 'topology' : 'dependency'`.

A pre-edit injected reproduction allowed topology to succeed and then threw a
resolver error. The canonical output was exactly `phase: topology` and
`reasonCodes: [pre_live_topology_rejected]`. No child spawned. This proves the
record could misattribute npm resolution as Git topology.

The Windows `inheritedValue` implementation used
`Object.keys(environment).find(...)`, enumerating all environment names before
copying the allowlist. The approved credential boundary requires fixed direct
reads only.

## Implemented solution

`runCanonicalPreLiveReadinessLauncher` now has four explicit fail-closed
attribution boundaries:

1. launcher/repository authority -> `launcher` /
   `pre_live_launcher_repository_authority_rejected`;
2. topology verification -> `topology` plus the closed mapping below;
3. npm CLI resolution -> `dependency` /
   `pre_live_dependency_npm_cli_resolution_rejected`;
4. installed dependency authority -> `dependency` /
   `pre_live_dependency_authority_rejected`.

The closed bootstrap map is:

| Internal bootstrap class | Sanitized public reason |
|---|---|
| `bootstrap_repository_mismatch` | `pre_live_topology_repository_mismatch` |
| `bootstrap_dedicated_branch_required` | `pre_live_topology_dedicated_branch_required` |
| `bootstrap_same_name_upstream_required` | `pre_live_topology_same_name_origin_required` |
| `bootstrap_head_mismatch` | `pre_live_topology_head_mismatch` |
| `bootstrap_divergence_rejected` | `pre_live_topology_divergence_rejected` |
| `bootstrap_dirty_rejected` | `pre_live_topology_dirty_rejected` |
| `bootstrap_output_not_ignored` | `pre_live_output_root_must_be_ignored` |
| `bootstrap_git_rejected` | `pre_live_topology_git_rejected` |

Every other thrown value, including one whose property access itself fails,
collapses to `pre_live_topology_rejected`. Raw thrown text, stack, path,
command, stdout/stderr, prompt, secret, credential, and environment metadata
are never serialized.

`minimalEnvironment` retains the existing platform allowlists but now reads
each fixed name directly. It never enumerates the supplied environment. A
hostile Proxy test throws on `ownKeys`, on any unapproved name, and on any
`OPENAI_API_KEY` access. Both a complete successful `prepare` bootstrap and a
sanitized Git diagnostic path pass while the traced reads equal only the
Windows allowlist.

All children still use the same environment keys, `shell:false`, executable,
cwd, stdio, and argv. Public modes remain exactly `prepare` and `verify`.
Early failures are returned to the public CJS wrapper, written only to stdout,
and do not create output authority.

## Canonical compatibility and reachability evidence

Tests assert the exact v1 field set and the unchanged canonical digest labels.
Every new early failure retains:

```text
pricingAuthority: not_checked
canonicalPreflight: not_run
credentialAccess: none
providerCalls: 0
liveAuthority: none
```

The boundary matrix proves exact phase/reason for launcher authority, all
eight known topology classes, unknown fallback, npm resolver, and dependency
authority. Counters prove topology/npm/dependency/child boundaries are reached
only in sequence and every later boundary remains unreachable after failure.
The formerly conflated npm case is explicitly `dependency`, never `topology`.

## Validation

```text
pre-edit focused launcher baseline
PASS — 1 file / 7 tests

final focused launcher suite
PASS — 1 file / 9 tests

adjacent authority regression
PASS — 10 files / 328 tests

node node_modules/typescript/lib/tsc.js --noEmit --project tsconfig.json --incremental false
PASS

npx --no-install tsc --noEmit
PASS

node --check scripts/lib/canonical-pre-live-readiness-launcher.cjs
PASS

structural environment/credential scan
PASS — no environment Object.keys/Object.entries, Reflect.ownKeys,
environment for-in, Get-ChildItem Env, or OPENAI_API_KEY match in the bootstrap
launcher/public/private entry surfaces

git diff --check
PASS
```

The adjacent 10-file / 328-test matrix covered canonical pre-live readiness,
canonical materialization input, live-request/B0 materialization, canonical
Execution Request, Execution Supervisor, canonical live boundary/launcher,
source authority, and production lifecycle. It preserved the existing
boundary-sentinel positive controls.

Literal `npm run check` ran exactly once. It was not rerun. TypeScript passed.
Vitest reported the established six missing ignored-fixture failures across
five files and no timeout:

1. `child-lexicon-ages-5-8.spec.ts` — absent ignored story;
2. `momentum-gate-koko.spec.ts` — absent ignored page-beats file;
3. `page-entity-qa.spec.ts` — absent ignored PNG;
4. `set-appearance-ref-budget.spec.ts` — absent ignored appearance-board PNG;
5. two `story-read-back-validation.spec.ts` cases — absent ignored story
   inputs.

No fixture was copied, fabricated, skipped, or weakened. No retry,
serialization, assertion change, or timeout increase was added. The changed
launcher/readiness surface had no full-run failure. The full gate remains
truthfully non-green.

The full run created ordinary ignored scratch under two output paths, three
timestamped story-log directories, and `tsconfig.tsbuildinfo`. Those exact
paths were moved without deletion to
`C:\Users\guyna\AppData\Local\Temp\small-heroes-r1d-bootstrap-attribution-check-scratch-20260731-a065`.

## Limits, rollback, and QA targets

No real B0, readiness, execution, or live artifact was created. No credential
was checked, read, loaded, hashed, printed, or passed. No canonical preflight,
pricing/docs/network/provider/model call, live authoring, render,
image/Vision/audio, storage/database/Supabase, Board, Semantic Reconciliation,
approval, publication, promotion, production activation, deployment, PR, or
push occurred. Cost remained exactly `$0`.

Rollback is reverting the focused implementation and documentation commits.
No schema or artifact migration is required. Historical evidence stays
immutable.

Independent Claude Code review should falsify:

- exact branch/base/head/range and focused file scope;
- npm resolver attribution after successful topology;
- every known topology mapping and unknown fallback;
- later-boundary and child-spawn unreachability;
- exact v1 fields, digest behavior, and zero-cost attestations;
- raw secret/path/stack/message/environment exclusion;
- hostile environment non-enumeration and credential non-access;
- unchanged prepare/verify, offline npm/Prisma argv, Windows Unicode/spaces,
  `shell:false`, and exit/signal behavior;
- absence of TypeScript schema, prompt, model, budget, policy, retry, fallback,
  diagnostic-mode, raw-error, or live-authority drift.

## Successor implementation evidence - Git invocation diagnostics

This section records the approved 2026-08-03 successor milestone without
changing the immutable claims for the earlier reviewed range above.

### Topology and status

- Worktree: `C:\Users\guyna\.codex\worktrees\a7ee\Small_Heroes`
- Branch: `codex/r1d-pvb-d1a1b1-pre-live-git-invocation-diagnostics`
- Exact pushed base/merge-base:
  `f09cfc6d30e13110c5ec39596fded8a4ed7a52ba`
- Source branch at intake: same-name upstream and local remote-tracking parity
  `0/0` at the exact base. This observed fact does not identify or authorize a
  push actor.
- Commit 1: `eefd7d6d` - closed Git catalog, shared invocation sanitizer,
  public probe, evidence v1, and subprocess matrix.
- Commit 2: this integration/evidence commit - shared private-entry/core
  consumption, failure v3, v2 historical fixture/reader, adjacent tests, and
  durable documentation.
- Target branch: local, no configured upstream or same-name remote-tracking
  ref, unpushed. Gate: **HOLD pending independent Claude Code review**. Codex
  does not self-award PASS.

### Implemented boundary and migration

- `scripts/lib/canonical-pre-live-git-invocation.cjs` is the sole command
  catalog and process-classification boundary. Its eight command IDs and two
  environment profiles are closed. Production callers cannot supply command
  text, argv, executable, cwd, shell, or eval.
- `probe-git` runs both profiles before dependency authority is resolved. It
  emits only canonical `canonical-pre-live-git-probe-evidence/v1` on stdout.
  The PASS-like status is `ready_for_canonical_prepare`, not readiness or live
  authority.
- The probe contract binds `credentialAccess:none`, `providerCalls:0`,
  `canonicalPreflight:not_run`, `pricingAuthority:not_checked`,
  `readinessAuthority:none`, and `liveAuthority:none`.
- Every observation contains exactly profile, command ID, nullable closed
  failure class, bounded exit/signal/error/stderr classes, and stdout/stderr
  byte counts. Failure evidence requires a non-null failure class. The
  `safe_directory` classifier requires a fixed stderr pattern; no inference
  from context is allowed.
- Launcher and private entry now produce current
  `canonical-pre-live-readiness-failure/v3`. `gitDiagnostic` is always present
  and nullable; unknown, extra, out-of-range, or otherwise malformed fields
  fail closed. Non-Git failures carry `null`.
- Historical v2 fixture payload digest is
  `aa9a75d8b07b8706dcaf9cae440b2770a1d5e5c671ef703ab2ee803bda9fd59f`;
  fixture-file SHA-256 is
  `53ed113572a0d4f971dac7d20c424b498ca7646f7bee8261d8fd66de6b7141ba`.
  The reader labels it `historical_evidence`; default current validation
  rejects it. Its bytes are not rewritten or promoted.
- Successful readiness remains v4. B0, Execution Request, Supervisor,
  Wizard, dependency order, offline npm/Prisma argv, capability, public
  prepare/verify, model, prompt, budget, retry, fallback, timeout, accounting,
  and cost contracts remain unchanged.

### Deterministic evidence

```text
CJS syntax for public wrapper, shared Git boundary, and launcher
PASS

focused + adjacent deterministic suite
PASS - 7 files / 242 tests

post-hostile-result focused integration suite
PASS - 3 files / 155 tests

repository-local TypeScript
PASS

structural raw-data/environment/command scan
PASS

working-tree git diff --check
PASS

literal npm run check - exactly once, not rerun
NON-GREEN - TypeScript passed; Vitest config startup failed before collection
```

The 242-test matrix covers all eight commands under both profiles and all six
failure classes, real Windows repositories and linked worktrees with
spaces/Unicode, hostile environment reads, raw-data exclusion, content
addressing, credential/output/dependency non-touch, launcher and private
failure integration, immutable v2 compatibility, successful prepare/verify,
canonical input and B0 materialization, Execution Request materialization,
and Supervisor verification.

The current worktree began without `node_modules` after the earlier failed
readiness preparation. No install or generation ran. Deterministic validation
used an ignored local junction to the already-prepared dependency tree in the
read-only `600e` worktree. After the final syntax/TypeScript/focused gate, the
junction and generated `tsconfig.tsbuildinfo` were removed while the junction
target was reverified intact. The target worktree therefore returned to its
intake dependency/scratch shape. This was test tooling, not
dependency/bootstrap authority.

The one literal `npm run check` reached and passed TypeScript, then exited `1`
before collecting any Vitest test. Esbuild resolved the ignored dependency
junction through the `600e` worktree and the sandbox denied a broader-directory
read while loading `vitest.config.ts`. It did not reproduce the established
six ignored-fixture failures because Vitest never started, and it exposed no
test assertion failure. The command was not rerun. This is recorded as a new
environment/startup limitation; the full gate is truthfully non-green.

No real dependency install/Prisma generation, B0/rematerialization/readiness,
credential existence/check/access/load/hash, canonical preflight,
pricing/network/provider/model call, live authoring, render/image/Vision,
storage/database, Board, Semantic Reconciliation, approval, publication,
promotion, activation, deployment, PR, or push occurred. Cost remained `$0`.
Rollback is reverting the two successor commits in reverse order; no external
state or historical evidence cleanup is required.

Independent Claude Code review should falsify the exact topology/range, closed
catalog, both unbroadened profiles, every failure class and classifier,
command/later-boundary unreachability, content addressing, v2 byte/digest
immutability, v3 strictness, raw-data exclusion, probe non-authority,
dependency/credential/output non-touch, unchanged sequencing/argv/versions,
and the absence of remediation or policy drift.
