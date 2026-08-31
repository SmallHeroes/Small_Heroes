# R1D Blueprint Transition + Composition Repair Authority — Implementation Evidence

## Status

Implemented and independently QA-passed. Claude Code reviewed immutable range
`752e46a9fac0bb4a22e9af6a09cafc8efaf4a70e..dd15b9cfe5fcaf35f09f49ee699773c6abfcac30`
read-only and returned **PASS — 0 BLOCKER / 0 MAJOR**. This document does not grant another
provider call, retry, Candidate, Wizard qualification, render, deployment, or product acceptance.

## Triggering live evidence

Guy authorized exactly one ordinary authoring execution for:

- Request `3232af557a75239f0395343636e4efaf2670ce4e2cc85e59bacb4b0bf36f3a19`;
- Preflight `512e61ccd5a2e8f158e7fc79d623b652154039f2bf83df8c6f76616c1edcf8ad`;
- Fresh Readiness `55559f9a2f81f940527462b3357587aadd5c2efc7c2929335babc31a710fb891`;
- at most three generation calls, two repairs, `$5`, retry zero, no fallback, no render.

That authority was consumed once. The immutable result is:

- terminal manifest `0e1084d066ba497ff353aac1ae905e22b0c359f5066a97568b90cdb8883b93da`;
- receipt `944a55a2cdafb4207c111cf59bec12cbbd2a75f2fc5840b6ead8c33e2c7a4c8c`;
- sanitized capture `806eee38d13113351b9c6f083f67ec3d34eb3fd9fc1a2cb7bcf6d3248e8159eb`;
- execution identity `59717a794965945124d2fa4bf9558cc031ca26680f3d8bac1bafb0ab1085bffd`;
- `3` generation calls, `2` repairs, no fallback, conservative cumulative cost `$1.367213`;
- terminal `draft_validation_repair_exhausted`, no Candidate and no render.

The complete capture records `80 -> 54 -> 6` emitted diagnostics and `70 -> 52 -> 6`
distinct identities. The final repair resolved 46 distinct identities and introduced none. The
remaining frontier was exactly five `traversal_infeasible` diagnostics at
`frames[2|3|4|6|7].affordanceIds` and one `composition_policy_invalid` diagnostic at `frames`.

## Root cause

The final six were not a transport, scheduler, budget, model, linkage, or validator-rule failure.
The validator knew the violated invariants, but the repair-prompt diagnostic projection did not expose the measurements
needed to distinguish:

1. no visible direction-compatible traversal is bound to the transition frame; from
2. a matching traversal exists but its footprint overlaps no cast placement.

Composition failures likewise carried only prose even though the validator had the exact
threshold and observed measurement. The repair provider therefore received a failure identity
without lossless writable-target evidence.

## Implementation

### Traversal diagnostics

`preRenderBlueprint.ts` now emits two closed diagnostic shapes while preserving the same
accept/reject predicate and `traversal_infeasible` code:

- missing direction-compatible traversal remains attached to `frames[n].affordanceIds` and
  carries the governing connection, frame zone, direction, consumer, connection membership,
  frame membership, visible candidates, and matching-candidate set;
- an existing matching traversal with no cast overlap is attached to `frames[n].placements` and
  carries the exact matching traversal IDs, cast placement IDs, required minimum overlap, and
  observed overlapping placement set.

All values are derived from the same normalized candidate collections used by validation. No
provider-owned geometry is synthesized or corrected by the compiler.

### Composition diagnostics

`preRenderBlueprintCompositionPolicy.ts` now exposes structured diagnostics for every existing
policy family: close-up area, medium area, over-shoulder area, required close-up, required wide,
distinct shot count, distinct angle count, consecutive-shot limit, and cast-scale ratio. The
threshold constants and human-readable messages are unchanged. The legacy issue function is a
message-only projection of the structured function, so existing display callers remain
compatible.

### Sanitized persistence boundary

Repair prompts intentionally receive the structured values. Durable sanitized failure capture
still retains only closed code, sanitized field path, redaction state, and expected/actual
presence flags. A hostile regression uses different safe-alphabet names and traversal IDs with
the same structural identity and proves:

- equal sanitized censuses, identity digests, and full-census digests;
- no raw message, name, connection ID, traversal ID, placement ID, `message`, `expected`, or
  `actual` property appears in serialized capture bytes.

The separate opaque admission request commitment may change with exact provider-request bytes; the source
comment now states this narrower truth instead of claiming that no value can influence any digest.

### Repair-prompt program cutover and replay

The structured evidence changes the exact repair-user prompt for the same failed draft and
context. The pinned F1 case proves this materially: `50,530` rather than `47,647` user bytes.
Leaving the execution program at `19c5...` would therefore let a pre-change preflight pass the
exact-current gate while executing different repair bytes and admission accounting.

The correction is deliberately narrow:

- repair-prompt semantic identity advances from v7 to v8;
- current execution program becomes
  `3e3620216a38422e1e0513487073eb166ad64085483f12d35ed18e00322ff3ca`;
- the exact prior prompt-v7/program
  `19c5bbb1ac157cfc4d9cffe3f4133f04870a5e6b828aafc67bc8be336fa36978`
  is frozen as `legacy_immutable` for replay only;
- fresh ordinary, replacement, and diagnostic-successor gates continue to require exact current
  program, so the frozen object cannot reach a provider or token-count factory;
- initial prompt v7, repair system-prompt bytes/digest, provider wire v1, repair wire v2, draft
  schema v6, validator predicates, thresholds, model, and budgets are unchanged. Diagnostics are
  a block before `REPAIR_WIRE`; the existing grouped diagnostic tuple already supports
  expected/actual, while `REPAIR_WIRE` remains v2 unchanged.

Read-only runtime proof loaded the exact consumed terminal manifest `0e1084d0...` after the
cutover. It still resolves request `3232af55...`, receipt `944a55a2...`, capture `806eee38...`, and
stage `authoring_failed` without mutation. A complete request-v5 artifact census loaded all five
existing preflight/terminal manifests under the frozen v6 and v7 programs.

## Provider-free production-scale proof

The eight-page authoring harness uses six unique transition connections. Its first injected draft
has exactly the five transition failures at pages 2, 3, 4, 6, and 7 plus a measured cast-scale
ratio of `3.00`, below the unchanged `3.5` minimum. Page 8 is a valid transition positive control.
The injected corrected whole-book response reaches zero issues on attempt 2.

The pinned F1 admission harness remains non-vacuous and exact. Its first draft contains six
affected traversal rows at pages 3–8 and no composition diagnostic. Those rows add 2,793 bytes of
structured expected/actual evidence plus 90 bytes from the six 15-byte-longer split traversal
messages: exactly 2,883 user bytes. Its deterministic first-repair census is therefore now
`50,530` user bytes and `77,995` estimated bytes. It still requires one exact 50,000-token count,
makes three generation calls in total, uses two repairs, and proves every reservation remains
within the unchanged `$5` ceiling. This is an accounting expectation update, not a limit or
policy change.

## Validation

- Validator/repair matrix: **5 files / 200 tests PASS**.
- Program/replay/fresh-dispatch matrix: **3 files / 162 tests PASS**.
- `npx tsc --noEmit`: exit `0`.
- `git diff --check`: clean.
- Literal `npm run check` passed both TypeScript phases. Its 332-file ordinary partition returned
  exactly the established unrelated baseline: **5 fixture-reading files / 9 assertions failed**,
  with **4,287 passed / 73 skipped**. No changed test or production path failed.
- The resource-intensive partition passed all **20 files / 632 tests**. Vitest then emitted the
  three known worker `onTaskUpdate` RPC timeouts, making that phase and the literal command exit
  `1` despite zero failed resource-intensive assertions. This remains an honestly reported
  repository-infrastructure HOLD, not a regression attributed to this milestone.
- Claude Code independently reran the complete changed-spec set at **8 files / 362 tests PASS**,
  reproduced TypeScript exit `0` and clean diff hygiene, and found no code, replay, admission,
  privacy, semantic-equivalence, or scope defect. Its sole informational MINOR concerned a digest
  transcription in the handoff prose; the repository's test-pinned current digest is the canonical
  `3e3620216a38422e1e0513487073eb166ad64085483f12d35ed18e00322ff3ca`.

## Scope and exclusions

Changed behavior is limited to structured diagnostic observability, repair authority, and the
required repair-prompt v8/program cutover. No validation rule, threshold, initial/system prompt
bytes, provider/repair wire, draft schema, model, provider adapter, call budget, repair budget,
price, `$5` ceiling, retry, fallback, Story Source, Visual Contract, Visual Package, Wizard,
payment, image, audio, render, deployment, or database behavior changed.

No provider, token-count endpoint, network, credential, image, audio, render, deployment, or
database operation occurred after the single authorized live attempt. That execution identity is
consumed and is not retried by this milestone.
