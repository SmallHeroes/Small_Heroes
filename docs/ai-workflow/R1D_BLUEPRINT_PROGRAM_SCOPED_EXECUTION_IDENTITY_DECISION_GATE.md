# Decision Gate — Blueprint program-scoped execution identity

Status: **approved for offline implementation and independent QA**

Owner: Guy (Product Owner)

Technical owner: Codex

Date: 2026-08-31

Branch: `codex/r1d-order-package-authority-binding`

Worktree: `C:\GNart\Work\sh-order-package-authority`

## Decision requested

Correct the paid Blueprint authoring ledger so one immutable content authority may be
executed once per materially versioned authoring program, without turning request IDs,
timestamps, output directories, or generic failures into retry authority.

Guy has already authorized diagnosis, the smallest general offline correction, independent
QA, one later bounded live authoring attempt, and the downstream render path. This gate does
not itself spend, call a provider, render, deploy, publish a Candidate, or approve product
quality.

## Observed behaviour and evidence

The bounded 2026-08-31 `execute-live` command returned
`execution_state_uncertain` in about three seconds. The durable output root contains only the
new request and preflight manifest. No execution claim, receipt, incident, terminal binding,
terminal lookup, provider call, token-count call, credential read, or cost was created.

The current request resolves to the same content `authoringAuthorityDigest`
`c0c2c8e39c86fc3a4b1630a90c0738fd71ce968dcfb632028991a92006149a43`
as an immutable earlier terminal. That terminal used the legacy Blueprint prompt program v5
and failed pre-provider because its initial wire was 188,654 bytes. The current prompt program
is v6; the real current compiler projection is 61,990 bytes and reaches an injected offline
provider exactly once. The current preflight therefore passes, but the ordinary ledger key is
still only the stable content authority and collides with the v5 terminal before dispatch.

## Expected behaviour

1. `authoringAuthorityDigest` remains the stable semantic/content authority used by the
   resulting Blueprint and all downstream review/approval/package bindings.
2. The ordinary paid-execution key binds both that content authority and one exact,
   compiler-owned authoring-program projection.
3. Same content + same program has one paid slot. Changing request ID, timestamp, output root,
   or operator envelope cannot create a second slot.
4. Same content + a materially new, explicitly versioned program receives a distinct slot.
5. Legacy request/claim/terminal/receipt bytes stay unchanged and replayable under their
   legacy content-only identity; no artifact is renamed, migrated, overwritten, or adopted by
   the current program.
6. Unknown, stale, malformed, or tampered program evidence rejects before any ledger mutation,
   credential access, token-count transport, or generation provider.

## Root cause

The content authority intentionally omits prompt, schema, provider-wire, admission, and cost
policy versions. The ordinary execution lane nevertheless reused that content digest directly
as its single-use ledger address. That conflated two different concepts:

- what Blueprint content is being authored; and
- which executable authoring program is allowed one paid attempt.

The existing orphan-replacement authority is not the answer. It is correctly limited to an
unresolved claim with no terminal, and a terminal-failure successor would require bespoke
human retry authorization after every legitimate program upgrade. The verified case is a
program identity cutover, not an orphan or a request retry.

## Approved design

Introduce one canonical, exact-key `blueprint-authoring-execution-program/v1` projection. It
binds the active initial and repair prompt versions/digests, draft-schema version/name/digest,
layout-policy version/digest, structured-output compatibility-profile version/digest,
composition policy, generation evidence/wire policy, and exact-count admission/evidence. It also
binds three runtime-consumed semantic authorities: the static token-request fields (roles, strict
schema mode, tools/tool choice, and truncation), the actual generation/count transport destinations
and dispatch constraints, and the frozen count-aware cost arithmetic including the strict 272,000
token breakpoint, 2x multiplier, rates, call/probe maxima, and $5 inclusive ceiling. A separate
effective-policy digest binds provider, model, reasoning, repair ordinals, ceilings, budgets,
no-fallback, retry, timeout, protocol allowance, and pricing constants.

Cut the production request to v5 and embed that complete program projection. The request is
invalid unless the embedded projection exactly equals the compiler's current projection.
Derive the ordinary execution identity from:

```text
canonicalHash({
  version: "qa-wizard-blueprint-ordinary-execution-identity/v2",
  authoringAuthorityDigest,
  executionProgramDigest
})
```

Current ordinary claims bind the derived execution identity and program digest explicitly.
Legacy v3/v4 request artifacts and v1 ordinary claims remain immutable/read-only under the
legacy content-only key. Replacement-successor identities remain separate and unchanged.

An already consumed current identity with a different request envelope must fail closed with
a bounded, truthful `execution_identity_already_consumed` classification after validating the
existing durable authority; it must not be called tampering and must not redispatch.

## Scope and likely files

- new pure execution-program and shared Responses transport-authority modules;
- runtime-consumed static token-request and frozen count-aware cost authorities;
- `productionAuthoringRunner.ts` request v5/current validation plus immutable v3/v4 replay;
- `qaWizardBlueprintAuthoringLifecycle.ts` current ordinary identity/claim resolution and
  legacy replay selection;
- focused runner, lifecycle, replacement-lane, and production-scale offline tests;
- `CURRENT.md` and focused evidence documentation.

No story, prompt prose, JSON schema rule, model, budget, retry/fallback, provider adapter,
Wizard, package, image, audio, payment, render, or deployment behaviour is in scope.

## Acceptance criteria

- The real legacy v5 terminal and current v6 program derive different ledger identities.
- A current v6 execution can pass the claim boundary exactly once with an injected provider;
  no network is used in the proof.
- Exact replay dispatches zero provider/count calls.
- Same program with a different request ID/time/output root dispatches zero calls and returns a
  truthful consumed-identity rejection.
- Prompt-, schema-, policy-, content-, or program-digest substitutions behave according to the
  canonical identity and fail closed when evidence is stale or tampered.
- Transport destination/dispatch drift and cost-threshold/rate/ceiling drift change or invalidate
  the program identity; exact 272,000/272,001 and $5.000000/$5.000001 boundaries are covered.
- The ordinary CLI supplies the same lazy credential reader to count and generation adapters.
- Current v2 cannot recover/adopt legacy v1 terminals; legacy v1/v4 with receipt v6 or v7 replay
  remains valid under the current receipt policy.
- Concurrent same-identity executions dispatch at most once.
- Replacement/orphan regressions remain green and cannot impersonate an ordinary identity.
- Focused suites, production-scale offline harness, `npx tsc --noEmit`, and
  `git diff --check` pass. The broader repository contract is run and reported honestly.

## Risks and controls

- **Accidental retry surface:** request metadata is excluded from the identity; the program is
  compiler-owned and exact-key validated. Descriptive pricing/source/unit labels are excluded;
  executable numeric semantics remain bound, while descriptive policy-version labels cannot mint
  another paid slot. Wire/evidence schema versions that govern validation and replay remain bound.
- **Stale preflight under new code:** the program is persisted in the request, not recomputed
  only at execute time.
- **Legacy corruption:** old artifacts are never rewritten; loaders select legacy semantics by
  immutable request/claim version.
- **Cross-program adoption:** current claims, paths, terminal ownership, and replay bind the
  same derived identity and program digest.
- **Version discipline:** any material program change must cut the program projection/version;
  the effective policy, layout, compatibility-profile, and schema digests make silent drift
  observable. Before a future receipt-policy change, current v6/v7 replay semantics must be frozen.

## Rollback

Before any current-program live execution, rollback is a code revert; all legacy artifacts
remain valid. After a current claim exists, its immutable ledger files must be preserved and
the code may only be superseded by another explicit version cutover, never by deleting or
rewriting the claim.

## Stop-check result

- Product intent is explicit and no unresolved creative decision exists.
- The correction is general, not story-, child-, page-, or companion-specific.
- No paid call or render is part of this milestone.
- Exactly one writer owns the clean branch/worktree.
- A new high-confidence blocker stops the milestone; it is not patched symptomatically.
