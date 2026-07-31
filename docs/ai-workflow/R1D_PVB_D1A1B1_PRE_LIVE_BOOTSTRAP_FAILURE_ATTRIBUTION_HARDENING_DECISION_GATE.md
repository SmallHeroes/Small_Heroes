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
