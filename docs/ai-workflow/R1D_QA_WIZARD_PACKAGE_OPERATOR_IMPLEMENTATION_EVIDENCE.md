# R1D QA Wizard Package Operator — Implementation Evidence

**Date:** 2026-08-25

**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`

**Review base:** `42fbab55d576134b05aebae10d9cf05d99b1e3a7`

**Implementation head:** `dbfd3a59c83681ee04e4b3c2373273c33f6f443a`

**Independent-QA correction:** `be2e5f99`

**Provider / credential / database / storage / deploy / render activity:** none

## Goal and observed gap

The QA Wizard bridge and Blueprint operator could produce an exact approved
Blueprint, but the repository had no general operator that converted that
authority into a reviewed Visual Package candidate, recorded a separate exact
package approval, and atomically advanced the canonical Wizard locator. The
existing Story Source revision lifecycle was migration-specific, while the
production lifecycle was plan-only. Reusing either as an implicit shortcut
would leave predecessor selection, duplicate approvals, crash recovery and
locator conflicts to callers.

## Implemented boundary

- `qaWizardPackageLifecycle.ts` accepts only a canonical
  `blueprint_approved` QA Wizard manifest. It replays the approved bridge,
  production context and five Blueprint lifecycle artifacts before assembly.
- Review authorship is derived from immutable authoring provenance. The only
  caller-supplied review fields are a closed `worldMode`, exact `Guy`, and a
  strict millisecond UTC timestamp.
- Existing Visual Package v5 assembly and qualification resolve Story Source,
  template, reconciliation, style, Blueprint, Board, prop, layout and world
  authorities. Pre-approval readiness must be exactly one
  `package_approval_missing` reason with zero external counters.
- Candidate and package review retain their established pretty-JSON byte form.
  Lifecycle manifests, approval decisions, approvals and publication claims
  use canonical content-addressed JSON.
- Package approval is a separate exact-digest decision. It binds the Blueprint
  approval, candidate and package review; a repository-global candidate-keyed
  decision is durable before the variable approval/manifest artifacts. A
  different approver, timestamp, note or digest cannot create a second
  decision.
- Publication always targets `visual-packages/approved`; there is no alternate
  registry argument. Candidate review snapshots the exact present/absent
  predecessor locator and, when present, its bytes SHA and parsed identity.
- A repository-global candidate-keyed publication claim is durable before a
  locator-specific `wx` lock. Under the lock only the reviewed predecessor or
  exact approved successor is accepted. The immutable revision is written
  first, the mutable locator second, and both are reloaded byte-for-byte before
  the terminal manifest is written.
- Replay converges after in-process interruptions following approval decision,
  publication claim, revision write or locator replacement. A true process or
  host death while the locator lock is held deliberately leaves that lock in
  place; later publication fails closed until an operator verifies the state
  and removes the stale lock. Conflicting locator state, package bytes, global
  decision, claim or held lock never gets overwritten automatically.
- `scripts/qa-wizard-package.ts` exposes only `prepare-package`,
  `approve-package` and `publish-package`, each with an exact request object,
  one output root and explicit `--write true|false`. Rejections disclose only a
  closed reason code and zero external counters.

## Invariants retained

- Current identities remain package v5, candidate/review v3, approval v4,
  qualification v4 and locator v3; no parallel v6 schema was created.
- Core Visual Package, Blueprint, bridge, Board, prop, Wizard and render rules
  are unchanged.
- The package review's self-excluding digest remains distinct from the full
  review artifact digest embedded in the final package.
- Publication does not authorize image/audio rendering, database/storage
  writes, deployment, release or product acceptance.
- The implementation contains no story, child, companion, page or style
  special case.

## Falsification coverage

The new nine-test lifecycle suite builds a hermetic approved Blueprint chain
and proves exact preparation, zero counters, approval replay, conflicting
approval rejection, locator CAS, publication replay, locator tamper rejection,
recovery at all four durable seams, and fail-closed preservation of an existing
locator lock without publishing revision, locator or terminal-manifest bytes.
Existing Visual Package, Blueprint and Story Source migration suites prove
compatibility with the shared primitives.

The two package-publication cases in the existing Story Source migration suite
perform several complete lifecycle replays and measured 6.7–8.7 seconds. Their
test-only budgets are now explicit at 30 seconds instead of inheriting the
unrelated five-second unit-test default; assertions and production behavior are
unchanged.

The real CLI command graph has no statically reachable provider, credential,
storage, generation-pipeline or API-route capability. The broader esbuild graph
can enumerate the OpenAI SDK through an upstream dynamic import, but none of
the three package commands reaches that live-request executor or constructs a
provider client. The OpenAI-named static inputs are canonical-JSON/diagnostic
utilities without SDK, environment or network access. CLI help loads
successfully, and a missing request returns only `operator_request_invalid`
with no write claim.

## Validation

- `npx --no-install tsc --noEmit` — PASS.
- QA Wizard package lifecycle — 9/9 PASS after the independent-QA lock-parity
  regression.
- Blueprint/package/current-v5 focused matrix — 50/50 PASS.
- Story Source revision Blueprint/package migration — 8/8 PASS under its
  explicit integration budgets.
- Vitest workload classifier — 7/7 PASS; canonical inventory is 332 files,
  partitioned 312 ordinary / 20 resource-intensive.
- `npm run qa-wizard-package -- --help` — PASS.
- malformed-request CLI rejection — PASS, zero external counters.
- `git diff --check` — PASS.
- Full `npm run check`:
  - both TypeScript phases PASS;
  - ordinary: 3,721 PASS, 70 skipped, nine unchanged missing ignored-output
    fixture assertions in five unchanged files;
  - resource-intensive: 613/613 assertions PASS, with the three known Vitest
    `onTaskUpdate` RPC timeout events causing the phase process to exit 1;
  - no changed-code assertion failed.

## Explicit limitations and next gate

This implementation creates no real package candidate, review, approval,
revision or locator. It makes no credential read, provider call, cost, image,
Vision, audio, database/storage write, Wizard order, payment, deployment or
Production action.

Claude Code independently reviewed exact range `42fbab55..dbfd3a59` read-only
and returned technical PASS with no BLOCKER or MAJOR. Its two MINOR notes were
closed by correction `be2e5f99`: the held-lock regression and the corrected
crash/import-boundary wording. Claude then independently micro-re-gated exact
range `dbfd3a59..be2e5f99` and returned PASS with zero BLOCKER, zero MAJOR and
zero MINOR after reproducing 9/9 tests, TypeScript and diff checks. Codex records
Claude's verdicts and does not self-award independent PASS. The current branch
must now be pushed to an exact same-name upstream before Fresh Readiness. The
live chain then remains: one current accepted-v3 Visual Contract attempt, exact
reconciliation approval, bounded Blueprint authoring and exact Blueprint
approval, package preparation and exact package approval, canonical locator
publication, fresh Preview deployment, preorder attestation, Bar/mother Wizard
order, fake payment and one full LOW render.
