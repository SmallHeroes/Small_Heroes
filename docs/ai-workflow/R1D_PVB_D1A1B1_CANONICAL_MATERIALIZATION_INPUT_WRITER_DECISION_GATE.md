# R1D-PVB-D1A1B1 canonical materialization-input writer — Decision Gate

**Decision:** approved by Guy

**Immutable base:** `be19817106b16770477b1be15374aa7dd55eb6a2`

**Implementation branch:** `codex/r1d-pvb-d1a1b1-canonical-input-writer`

**Cost boundary:** exactly `$0`

## 1. Proposed change

Add one repository-owned `canonical-materialization-input/v1` envelope,
strict two-mode writer, content-addressed immutable persistence boundary, and
common reader used by B0 live-request materialization and canonical Execution
Request materialization. Preserve each existing payload schema and validator
as its authority.

## 2. Why now?

The exhausted supervised attempt proved that a structurally valid,
deep-equal, same-length Execution Request input can fail solely because a
caller hand-authored a different top-level key order. B0 accepted logical JSON
without raw canonicality while Execution Request required canonical bytes.
Neither consumer had a public repository producer. This general contract gap
blocked the attempt before execution authority.

## 3. Scope

General system change. It is not story-specific config, a
child/companion/page patch, provider logic, or a one-off attempt workaround.

## 4. Risk of hardcoding

Shared production code must contain no selected story, story key, child,
companion, page, prop, or reveal data. Story data may appear only in generic
test fixtures.

## 5. Files likely affected

- shared materialization-input contract, writer, and reader modules;
- both existing materialization consumers;
- one fixed CJS launcher and private TypeScript entrypoint;
- package command and production lifecycle usage;
- focused tests, boundary sentinels, `CURRENT.md`, and durable evidence.

## 6. Expected behavior after change

Operators use one strict CLI in either
`source-authoring-live-request` or
`canonical-live-execution-request` mode. Separate logical flags produce one
validated canonical envelope at
`<out>/canonical-materialization-inputs/<kind>/<digest>.json`. Equivalent flag
order yields the same bytes, digest, and path. Both consumers reject manual,
legacy, noncanonical, aliased, linked, stale-digest, or wrongly addressed
inputs before downstream authority. Existing model, prompt, schema, pricing,
budget, repair/retry/fallback, and `futureLiveCommand` authority is unchanged.

## 7. Validation plan

Run deterministic TypeScript and focused writer/reader, B0 consumer,
Execution Request consumer, verifier, supervisor, launcher, boundary, source
authority, and lifecycle suites. Exercise CLI grammar, ordering invariance,
idempotence/collision, digest/address binding, source races, link aliases,
opaque credential handling, sanitized results, external-boundary sentinels,
legacy rejection, and both end-to-end consumers. After focused PASS, run
literal `npm run check` exactly once and accept only the six established
missing ignored-fixture failures.

## 8. Cost impact

Exactly `$0`; zero image/audio/API generations.

## 9. Rollback plan

Revert the focused implementation commits. Historical B0 v2 and Execution v1
inputs remain immutable and are neither rewritten nor deleted.

## 10. Review assignment

Guy approved the architectural decisions and implementation boundary. Claude
Code must first reconcile branch/worktree/base/head and then falsify
canonicality, content addressing, link/race containment, collision and
cleanup, CLI/environment hardening, credential non-access, sanitization,
consumer cutover, legacy rejection, and unchanged downstream policy. Claude
Cowork review is not required because this gate contains no product, UX,
story, visual, or creative decision.

## 11. Do not do

No real B0 or Execution Request materialization, canonical preflight,
credential access/check/load, pricing/network/provider/model call, live
authoring, render/image/Vision/audio, storage/database/Supabase, Board,
Semantic Reconciliation, approval, candidate/Blueprint/package publication,
promotion, production activation, deployment, PR, push, fixture fabrication,
timeout increase, assertion weakening, skip, or full-check retry.
