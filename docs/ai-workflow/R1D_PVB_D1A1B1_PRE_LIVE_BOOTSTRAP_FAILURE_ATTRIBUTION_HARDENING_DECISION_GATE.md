# R1D-PVB-D1A1B1 pre-live bootstrap failure attribution hardening — Decision Gate

**Decision:** approved by Guy, including all nine architectural decisions

**Immutable base:** `696e6eb27b82ac4b6e823bb9bc63edd2aec43852`

**Implementation branch:** `codex/r1d-pvb-d1a1b1-pre-live-bootstrap-failure-attribution`

**Cost boundary:** exactly `$0`

## 1. Proposed change

Harden the repository-owned canonical pre-live readiness launcher's earliest
fail-closed bootstrap surface. Replace heuristic phase attribution with fixed
launcher/repository, topology, dependency-authority, and npm-CLI-resolution
boundaries. Add a closed sanitizer for known bootstrap topology rejection
classes and replace Windows environment-key enumeration with direct reads of
the fixed platform allowlist.

## 2. Verified problem and root cause

`scripts/lib/canonical-pre-live-readiness-launcher.cjs` wraps trusted launcher
and repository authority, `verifyBootstrapTopology`, and
`resolveUniqueLocalNpmCli` in one catch. The catch chooses `topology` whenever
`paths` is truthy. A resolver failure after topology therefore becomes
`pre_live_topology_rejected`, while earlier launcher/repository failures can
collapse into dependency authority. The failed v1 record does not prove which
boundary failed.

On Windows, `inheritedValue` calls `Object.keys(environment)`. Even though only
allowlisted values are copied, every ambient environment name is enumerated.
The bootstrap must use fixed direct lookups and must never access
`OPENAI_API_KEY`.

## 3. Binding decisions

1. Preserve `canonical-pre-live-readiness-failure/v1`, its exact fields,
   canonical digest rules, zero-cost attestations, and compatibility.
2. Use explicit fixed attribution boundaries for launcher/repository,
   topology, dependency authority, and npm CLI resolution.
3. Map only repository mismatch, dedicated branch, same-name upstream/origin,
   head mismatch, divergence, dirty state, ignored-output requirement, and
   generic Git rejection; unknown errors use one generic sanitized code.
4. Npm CLI resolution uses stable reason
   `pre_live_dependency_npm_cli_resolution_rejected`.
5. Early bootstrap failures remain stdout-only and create no output authority.
6. Windows inheritance performs only fixed allowlisted direct reads, preserves
   required platform child behavior, and never reads/checks/hashes/prints or
   passes `OPENAI_API_KEY`.
7. Preserve sequencing, offline npm/Prisma argv, capability boundary,
   `shell:false`, exit/signal behavior, public prepare/verify, and downstream
   B0/prompt/model/schema/budget/policy authority.
8. Add no diagnostic mode, raw-error field, v2 version, retry, fallback, or
   story-specific literal.
9. Stop and return to the Lead if implementation would require a TypeScript
   schema, prompt, model, budget, policy, or live-behavior change.

## 4. Scope and compatibility

The smallest general implementation is one CJS launcher and its focused test
surface. The TypeScript readiness schema already accepts the existing phases
and bounded reason-code strings; no TypeScript runtime/schema migration is
needed. Existing canonical records remain immutable and valid.

Likely tracked files are:

- `scripts/lib/canonical-pre-live-readiness-launcher.cjs`
- `lib/visual-package/__tests__/canonical-pre-live-readiness-launcher.spec.ts`
- this Decision Gate, implementation evidence, and `CURRENT.md`

## 5. Acceptance criteria

- Launcher/repository, every known topology class plus unknown fallback,
  dependency authority, and npm resolution have exact phase/reason tests.
- The npm resolver regression is demonstrably not topology, and later
  boundaries/spawns are unreachable after every early failure.
- A hostile environment Proxy throws on enumeration and on any
  `OPENAI_API_KEY` access; both successful and diagnostic paths still work
  through only allowlisted reads.
- Canonical bytes exclude fake secret, path, stack, raw message, and
  unapproved environment names while preserving `credentialAccess:none`,
  `providerCalls:0`, `canonicalPreflight:not_run`,
  `pricingAuthority:not_checked`, and `liveAuthority:none`.
- Existing valid prepare/verify, Windows spaces/Unicode, exact offline
  dependency argv, and exit/signal controls continue to pass.

## 6. Validation and review

Run focused launcher/readiness tests, touched CJS syntax, deterministic local
TypeScript, structural scans, relevant adjacent regressions, and
`git diff --check`. Only after focused PASS, run literal `npm run check`
exactly once and do not rerun it. Stage explicit pathspecs only.

Claude Code receives an immutable base-to-head range and performs a read-only
first pass. It should try to falsify boundary reachability, sanitizer closure,
canonical-field/digest preservation, environment non-enumeration, credential
non-access, stdout-only early failure, and unchanged child sequencing/argv.

## 7. Stop-check, rollback, and exclusions

This is a general zero-cost production-control correction. It can affect all
stories equally but changes no story, visual, product, or creative behavior.
The smallest proof is synthetic launcher/temp-repository execution; Guy has no
visual artifact to inspect. Rollback is reverting the focused code and
documentation commits; no artifact migration is required.

No B0 materialization, Fresh Readiness, credential existence/read/load,
preflight, pricing/docs/network/provider/model call, live authoring,
render/image/Vision/audio, storage/database/Supabase, Board, Semantic
Reconciliation, approval, publication, promotion, production activation,
deployment, PR, push, unrelated cleanup, or write in another worktree is
authorized.

## 8. Approved successor amendment - Git invocation diagnostics

On 2026-08-03 Guy approved
`R1D-PVB-D1A1B1-CANONICAL-PRE-LIVE-GIT-INVOCATION-DIAGNOSTICS-HARDENING`
from exact pushed base `f09cfc6d30e13110c5ec39596fded8a4ed7a52ba` on branch
`codex/r1d-pvb-d1a1b1-pre-live-git-invocation-diagnostics`. This amendment
does not alter the historical decisions or review claims above. It supersedes
the earlier "no diagnostic mode / no v2" restriction only for the new
successor range after a later Fresh Readiness failure proved that generic Git
rejection destroyed necessary sanitized attribution.

The approved successor decisions are:

1. One closed repository-owned catalog defines the exact Git commands for
   top-level, branch, upstream, HEAD, upstream HEAD, divergence, status, and
   output-ignore. No user/caller supplies executable, argv, shell text, cwd,
   eval, or arbitrary command.
2. Preserve distinct `bootstrap_launcher` and `private_entry` environment
   profiles and their existing allowlists without merging or broadening them.
3. Add public zero-cost `probe-git` before dependency/bootstrap consumption.
   It must not resolve/install dependencies, access dependency authority,
   write output roots, touch credentials, call network/provider, or award
   readiness/live authority.
4. Emit stdout-only, content-addressed
   `canonical-pre-live-git-probe-evidence/v1` as diagnostic evidence only.
5. Use only `spawn_error`, `timeout`, `signal`, `output_ceiling`,
   `malformed_result`, and `nonzero_exit`, with stable reason mapping.
6. Persist only the fixed profile/command identity, bounded status and
   signal/error/stderr classes, byte counts, attestations, version, and
   digest. Raw command/process/environment data must be discarded.
7. Make `canonical-pre-live-readiness-failure/v3` current with a strict
   nullable Git diagnostic. Historical v2 remains immutable/readable only as
   evidence. Success readiness v4 and downstream authority do not bump unless
   a verified binder requires it.
8. Cover every command/failure class, both profiles, Windows repositories and
   linked worktrees, spaces/Unicode, hostile environments, credential
   non-access, raw-data exclusion, propagation, and unchanged sequencing.
9. Add no remediation, Git configuration mutation, `safe.directory`, retry,
   fallback, environment broadening, provider reachability, or story literal.

The same stop-check and zero-cost exclusions continue to apply. A future
probe may justify a separate remediation Decision Gate; it cannot authorize
remediation itself.
