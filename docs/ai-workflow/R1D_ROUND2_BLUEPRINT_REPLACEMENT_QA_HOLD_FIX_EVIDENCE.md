# R1D Round 2 — Blueprint orphan-claim replacement: QA HOLD fix evidence

**Date:** 2026-08-30
**Branch:** `codex/r1d-order-package-authority-binding`
**Author:** Claude Code (implementer, per Guy's explicit delegation; Codex re-gates)
**Starting committed HEAD:** `06c28e5a` (round-1 work was intentionally
uncommitted/dirty in this worktree; corrected in place).

Local, offline only. No provider/network/credential/database/render/deploy/push
or real-output operation occurred. The historical single-use predecessor claim
`466252b4a082ea6b98503bb2bc3e433a36408cfb61d1fd305afcbfa2b9804b64` was not
deleted, retried, impersonated or resolved; its bytes/path/digest are untouched.

## Codex HOLD → resolution

### BLOCKER 1 — maximum one successor is now globally enforced
Root cause: `successorExecutionDigest` varies with proposal/review digests and
`approvedAt`, so an alternate proposal/review/approval minted a *different*
successor identity and a second claim/provider call; `maxSuccessorExecutions:1`
was declarative only.

Fix: a compiler-owned, immutable **predecessor-keyed successor slot**
`outputs/qa-wizard-blueprint-authoring-ledger-v1/replacement-authorization-slots/<predecessorClaimDigest>.json`
records the single canonical `successorExecutionDigest`. It lives in the single
global ledger root (independent of any `outputDir`) and is written with the
existing create-or-collide immutable writer:
- created-or-verified at approval (`approveBlueprintReplacementProposal`, write),
  the earliest fence; and again
- created-or-verified in the execute precheck (`bindReplacementSuccessorSlot`),
  before the claim and any provider.

A second approval/execution whose lineage converges on a different successor
digest (alternate proposal, review, approval timestamp, or a different output
root) collides on the slot bytes and fails closed with
`replacement predecessor is already bound to a different successor`. Note-only
differences do not change the successor digest and re-bind the same slot
idempotently (identity is note-independent by design).

### BLOCKER 2 — terminal recovery is now lane/execution-bound
Root cause: ordinary and successor terminal manifests are byte-identical and
share `blueprint-authoring-manifests`; `recoverTerminalLookup` scanned only by
`request.digest` + `predecessor.digest`, so an ordinary re-entry could adopt a
successor terminal and mint `terminal-lookups/<predecessor>.json`.

Fix: a per-execution-identity **terminal binding**
`.../terminal-bindings/<executionIdentity>.json` is written immediately after the
terminal manifest and **before** any crash seam (so crash-recovery still works).
`recoverTerminalLookup` now:
- loads the binding for the current identity (exact terminal match when present);
- excludes any manifest already bound to a *different* identity
  (`foreignBoundTerminalManifestDigests`); and
- treats a binding whose terminal is missing/foreign as a torn state
  (`execution_state_uncertain`).

Ordinary v1 manifests/records are unchanged; the legacy scan is used only when no
foreign binding claims the terminal (backward compatibility). The predecessor's
non-mutating recoverability check now uses `loadTerminalBindingForIdentity`
instead of the mutating recovery, so `write:false` preparation has no side
effects.

Hostile regression (in the spec): after a completed successor, invoking the
ordinary lane stays `execution_state_uncertain`, calls zero providers, mints no
`terminal-lookups/<predecessor>.json`, and leaves the predecessor claim bytes
byte-identical.

### MAJOR 3 — existing successor claim/replay is now exact-bound
The replacement lane's `claimIsValid` is a closure comparing a stored claim's
embedded `executionIdentityDigest`, `authoringAuthorityDigest`, `requestDigest`,
`preflightManifestDigest`, and `replacement.{authorizationDigest, authorizationPath,
proposalDigest, reviewDigest, predecessorClaimDigest, predecessorClaimPath}` to
the exact loaded authorization. Used on initial reload, terminal-lookup load,
claim-race and incident re-entry, so a note-only (same-successor) authorization
rejects the stored claim before the provider/recovery instead of replaying it.

### MAJOR 4 — lineage reload completed
`loadValidatedReplacementAuthorization` now additionally requires
`review.proposalPath === authorization.proposalPath`,
`proposal.digest === authorization.proposalDigest`, and
`review.digest === authorization.reviewDigest` (paths are already re-derived
canonically by the content-addressed loader), rejecting self-consistent
cross-lineage artifacts.

### MAJOR 5 — strict operational CLI
`lib/visual-package/qaWizardBlueprintReplacementCli.ts` (entry
`scripts/qa-wizard-blueprint-replacement-cli.ts`) exposes
`prepare/review/approve/execute-replacement`:
- strict parser: `--name value` only (rejects `--name=value`), no duplicate,
  unknown, positional, or ambiguous flags; exact required-flag sets;
- bounded sanitized single-line output; no raw exception/stack/provider data;
  exit 2 (usage) / 1 (operation) / 0 (success);
- `execute-replacement` supplies no provider factory and stays
  provider-unreachable unless the exact authorization/preflight resolve.
Tested in-process (parser/dispatch) and via hermetic `spawnSync` subprocess.

### Test-failure fix
The first spec cell asserted `predecessor.claimDigest === authoringAuthorityDigest`;
it now asserts `predecessor.claimDigest` equals the ordinary claim's own canonical
digest (`JSON.parse(claimBefore).digest`), with an independent assertion that the
predecessor binding's `authoringAuthorityDigest` equals the ledger key.

### Also assessed/fixed
- Canonical time ordering: reviews may not predate proposal preparation;
  approvals may not predate the review (`qaWizardBlueprintReplacementAuthority`).
- `write:false` preparation writes nothing (non-mutating recoverability).
- Successor execution artifacts remain content-authority preserving
  (`authoringAuthorityDigest` unchanged) but execution-lineage explicit (distinct
  ledger identity + terminal binding).

## Files
- `lib/visual-package/qaWizardBlueprintAuthoringLifecycle.ts` — slot, terminal
  binding, recovery isolation, exact claim closure, lineage reload,
  non-mutating orphan check, ledger categories.
- `lib/visual-package/qaWizardBlueprintReplacementAuthority.ts` — time ordering.
- `lib/visual-package/qaWizardBlueprintReplacementCli.ts` (new) — CLI.
- `scripts/qa-wizard-blueprint-replacement-cli.ts` (new) — CLI entry.
- `lib/visual-package/index.ts` — barrel exports.
- `lib/visual-package/__tests__/qa-wizard-blueprint-replacement-lifecycle.spec.ts`
  — fixed assertion; orphan helper deletes the terminal binding; adversarial
  cells.
- `lib/visual-package/__tests__/qa-wizard-blueprint-replacement-cli.spec.ts` (new).
- `docs/ai-workflow/R1D_BLUEPRINT_ORPHAN_CLAIM_REPLACEMENT_EXECUTION_AUTHORITY_DECISION_GATE.md`
  (force-added, previously ignored).

## Local validation
- `npx --no-install tsc --noEmit`: clean.
- Focused battery (serial): replacement lifecycle **12/12**, legacy Blueprint
  authoring lifecycle **34/34**, CLI **14/14** = **60/60**.
- Full `lib/visual-package/__tests__` (1152 tests): 1133 passed, 5 skipped, and
  14 failures confined to five heavy git/subprocess/real-entry specs
  (`canonical-materialization-input`, `canonical-pre-live-readiness`,
  `live-execution-request-materialization`, `live-execution-supervisor`,
  `qa-wizard-candidate-bridge`) that fail only under full-parallel worker
  saturation (`Timeout calling "onTaskUpdate"`). None import the changed modules
  (`grep` = 0) and they pass in isolation (verified 29/29 for two of them).
- `git diff --check`: clean.

## Residual limitations / notes for re-gate
- `npm run check` (full `tsc + autonomous-typecheck + full vitest --diagnostics`)
  was not run to completion: on this machine the full-parallel vitest run
  reproduces the same environmental `onTaskUpdate` worker timeouts above, which
  are unrelated to this change. `tsc --noEmit` (the first `check` stage) is clean;
  the touched surface is green serially. Codex should re-run `npm run check` on a
  machine that can sustain the full-parallel battery.
- A nested-replacement predecessor (a replacement-shaped claim at the ordinary
  key) remains rejected by `loadPredecessorOrphanClaim`; no additional public
  path constructs one, so it is covered by the type/scope guard rather than a
  dedicated hostile cell.
