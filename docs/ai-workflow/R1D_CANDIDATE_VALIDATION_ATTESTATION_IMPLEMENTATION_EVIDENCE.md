# R1D Candidate Validation Attestation — Implementation Evidence

**Date:** 2026-08-19
**Branch:** `codex/r1d-mixed-source-compact-scheduler`
**Base:** `d461080bb86c4e32bfe8442891d583a699e46880`
**Status:** local implementation green; independent Claude Code re-gate required

## Outcome

The QA Wizard bridge can now consume an immutable Visual Contract Candidate at
a later clean, pushed consumer HEAD without rewriting historical authoring
evidence and without weakening live Git checks.

The implementation adds a strict, content-addressed
`qa-wizard-candidate-validation-attestation/v1` and advances the current bridge
manifest from v2 to v3. It does not alter the Chameleon Candidate, authoring
artifacts, prompts, schemas, model, policy, budgets, retries, fallback,
reconciliation content, approval, Blueprint, Wizard or render behavior.

## Root cause closed

The old bridge compared the live checkout directly to the historical Fresh
authoring HEAD. That check was valid during authoring but made a later validator
correction impossible to consume. The raw Supervisor result additionally had
to be captured under its canonical content-addressed category before bridge
loading.

The new boundary keeps the two authorities separate:

- historical authoring repository facts are checked only against the immutable
  Fresh and execution artifacts;
- current live repository facts are checked against the pinned attestation
  consumer section on every current manifest load.

This keeps dirty, ahead, behind, wrong-branch, stale-head and ancestor-only
replay fail-closed while permitting a legitimate later validator HEAD.

## Implemented contract

The attestation strictly binds:

- Fresh Readiness, execution request, canonical execution result and child
  output authority;
- Story Source, source snapshot, authoring request, receipt and readiness;
- Candidate, template, action-semantic coverage and source-evidence catalog;
- current repository realpath, branch, HEAD, upstream, 0/0 divergence and clean
  tracked/untracked state;
- current template schema version and bounded validator result;
- a frozen reconciliation-only authority scope and explicit
  `doesNotAuthorize` list.

Artifacts persist only as canonical JSON at
`candidate-validation-attestations/<digest>.json`, with digest/filename/bytes
identity and symlink-alias rejection. Failed validation may be recorded as
evidence but cannot authorize bridge progression.

The public bridge CLI adds `attest-candidate-validation`. Current
`prepare-reconciliation` requests require the attestation path. Manifest v3
stores its descriptor so load, approve and advance all revalidate the same
pinned attestation. Exact manifest v2 and v1 remain read-only legacy paths and
cannot be upgraded or persisted as current.

## Falsification coverage

The focused suite proves:

- preview and write construction are byte-identical;
- an old authoring HEAD and a later clean pushed consumer HEAD can coexist;
- current v3 prepare/load/approve/advance retains the attestation;
- Candidate/template/source/provenance/head/digest/path/category tampering
  fails;
- cross-Candidate, arbitrary-path, hard-link, symlink/junction and collision
  attempts fail;
- dirty, ahead, behind, wrong-branch, stale and ancestor-only consumer states
  fail;
- a failed validator result and modified authority scope fail;
- exact v2 and v1 pending/approved manifests replay read-only without upgrade;
- separate exact Guy approval remains required.

## Validation evidence

- Focused surface:
  `visual-contract-template.spec.ts`, `set-definition.spec.ts`,
  `positive-authority-spoiler-guard.spec.ts`, and
  `qa-wizard-candidate-bridge.spec.ts` — **4 files / 89 tests PASS**.
- `npx --no-install tsc --noEmit` — PASS.
- `git diff --check` — PASS.
- One literal `npm run check` — HOLD, not rerun:
  - TypeScript — PASS.
  - autonomous-story typecheck — PASS.
  - ordinary phase — the same five established missing ignored-`outputs/`
    fixture assertions; no new changed-surface failure.
  - resource-intensive phase — **20 files / 610 tests passed**, followed by one
    Vitest `onTaskUpdate` RPC timeout; the phase therefore returned exit 1.

The repository-wide HOLD is recorded as baseline/infrastructure evidence, not
represented as a functional PASS.

## Scope and exclusions

No credential was read. No provider, network service, Fresh Readiness, live
authoring, image generation, render, database, publication or deployment call
occurred. No existing output artifact was written or modified. Test writes were
limited to isolated temporary directories.

The next permitted action is an independent read-only Claude Code re-gate of
the focused immutable commit range. Real Chameleon Supervisor capture,
candidate-validation attestation creation and reconciliation preview remain
blocked until that PASS.

## Independent QA falsification targets

Claude Code should independently verify:

1. the attestation exact-key schema, canonical digest and contained-path rules;
2. full cross-binding of historical authoring provenance and Candidate subject;
3. live Git retargeting without removal of any historical artifact check;
4. stale/ancestor/dirty/divergent/cross-Candidate replay rejection;
5. propagation through all v3 prepare/load/approve/advance entry points;
6. exact immutable v2/v1 replay and inability to write/upgrade legacy manifests;
7. reconciliation-only scope and continued separate Guy approval;
8. absence of prompt/schema/model/policy/budget/Candidate/render drift.
