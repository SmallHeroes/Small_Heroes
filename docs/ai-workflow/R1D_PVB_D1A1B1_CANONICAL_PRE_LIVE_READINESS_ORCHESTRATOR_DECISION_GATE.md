# R1D-PVB-D1A1B1 canonical pre-live readiness orchestrator — Decision Gate

**Decision:** approved by Guy

**Immutable base:** `5af3871db833df35a82970aa5fb2b10f6bde1b07`

**Implementation branch:** `codex/r1d-pvb-d1a1b1-canonical-pre-live-readiness-orchestrator`

**Cost boundary:** exactly `$0`

## 1. Proposed change

Add one repository-owned, story-neutral canonical pre-live readiness
orchestrator with public `prepare` and `verify` modes only. It composes the
existing canonical materialization-input Writer, B0 materializer/verifier,
canonical Execution Request materializer, and Execution Supervisor verify
path as their sole authorities.

Add a built-in-only CJS dependency bootstrap that can run before
`node_modules` exists. It must prove one npm CLI derived from
`process.execPath`, run fixed offline `npm ci`, run the exact local Prisma CLI,
and then launch a capability-bound private TypeScript entrypoint. Preparation
must prove a clean dedicated branch whose same-name `origin` tracking ref is
at exact `0/0` parity before dependency or authority writes.

## 2. Why now?

The repository already owns the individual canonical seams, but repeated
operator-authored orchestration failed before live authority because topology,
dependency, and input handoffs were assembled in shell. The most recent
attempt exhausted on a PowerShell `@{upstream}` parsing defect and then crossed
its stop boundary with an unauthorized corrective read and install invocation.
This is a general missing coordinator/control-surface problem, not a story,
credential, provider, prompt, model, pricing, or rendering defect.

## 3. Scope

General system change. Public logical input is limited to repository root,
output root, Story Source key/path, request identity/timestamp, and one opaque
credential-source path. The coordinator derives child identities, Writer
inputs, B0 paths, preservation fences, expected absences, Execution Request,
Supervisor verification, and future-live-command identity.

## 4. Risk of hardcoding

Shared production code must contain no selected Story Source, story, child,
companion, page, prop, or reveal literal. Generic test fixtures may use
synthetic neutral data only. The coordinator must not duplicate schemas,
digests, Story Source reconstruction, Git/policy rules, prompt/model/budget
rules, preservation rules, or future-live-command validation.

## 5. Files likely affected

- one neutral library/contract plus the visual-package barrel;
- one built-in CJS launcher helper, public launcher, and private TypeScript
  entrypoint;
- one package command;
- focused unit, subprocess, temp-Git, boundary-sentinel, and structural tests;
- this Decision Gate, durable evidence, and `CURRENT.md`.

## 6. Expected behavior after change

`prepare` first proves local dependency and repository authority, then invokes
the existing Writer/B0/Execution/Supervisor surfaces in order. It emits
content-addressed `canonical-pre-live-readiness-evidence/v1` only after all
zero-cost authority checks pass. Evidence status is
`ready_for_spend_gate` and explicitly records:

- `pricingAuthority: not_checked`
- `canonicalPreflight: not_run`
- `credentialAccess: none`
- `providerCalls: 0`
- `liveAuthority: none`

Failures use sanitized
`canonical-pre-live-readiness-failure/v1` phase/reason codes. Exact replay is
idempotent; collision or drift fails closed. A corrected local condition may
be retried by a later public invocation, but one invocation performs no
internal retry or fallback.

`verify` rechecks current dependency, topology, B0, Execution Request, and
Supervisor authority without writes. There is no arm/live mode.

## 7. Validation plan

Run exact repository-local TypeScript, CJS syntax checks, structural scans,
and focused tests covering:

- cold dependency start, fixed offline npm/Prisma argv, npm ambiguity,
  link/junction rejection, and exit/signal propagation;
- Windows spaces/Unicode;
- same-name upstream and exact `0/0` topology before writes;
- unchanged Writer, B0, Execution Request, and Supervisor composition;
- canonical evidence, sanitized failure, idempotence, collision, rerun after
  correction, and current-state drift;
- credential, provider, database, storage, network, preflight, live-child,
  and unrelated-write unreachability with positive controls;
- absence of selected story/child/companion/page/prop/reveal literals.

After focused PASS, run literal `npm run check` exactly once. Do not rerun it.
The acceptance target is no timeout or new failure beyond the six established
missing ignored-fixture failures.

## 8. Cost impact

Exactly `$0`; zero image, audio, API, provider, database, storage, or network
generations/calls.

## 9. Rollback plan

Revert the focused implementation and documentation commits. Historical
artifacts remain immutable and are not migrated, rewritten, or deleted.

## 10. Review assignment

Guy approved the Decision Gate and all architectural decisions. Claude Code
must first reconcile the exact worktree, branch, immutable base/head, dirty
state, upstream state, and review range. Its first pass is read-only and must
try to falsify dependency provenance, pre-write topology enforcement, public
input narrowing, authority composition, write-free verify, evidence
canonicality/sanitization, idempotence/collision, drift detection, external
boundary unreachability, and literal neutrality.

Claude Cowork review is not required because this gate contains no new
product, UX, story, visual, or creative decision.

## 11. Do not do

No actual live-attempt B0 authority, canonical preflight, pricing/docs/network
lookup, credential existence check/read/load, provider/model call, live
authoring, render, image/Vision/audio, storage/database/Supabase, Board,
Semantic Reconciliation, approval, candidate/Blueprint/package publication,
promotion, production activation, deployment, PR, push, fixture fabrication,
global timeout increase, retry, skip, assertion weakening, unrelated cleanup,
or writes in other worktrees.

The stop-check resolved this as a general zero-cost production-control change.
The smallest proof is synthetic/temp-repository materialization plus boundary
sentinels; Guy has no visual artifact to eyeball for this milestone.
