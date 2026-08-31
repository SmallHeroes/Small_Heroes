# R1D Blueprint per-attempt diagnostic evidence — implementation evidence

Date: 2026-08-31

Branch: `codex/r1d-order-package-authority-binding`

Implementation base: `edd4a770549964283f8606b95f58e0380bcd90c0`

Decision Gate:
`docs/ai-workflow/R1D_BLUEPRINT_PER_ATTEMPT_DIAGNOSTIC_EVIDENCE_DECISION_GATE.md`

## Outcome

The failed Blueprint-authoring evidence path now preserves an exact, sanitized,
ordered census for every validation-bearing attempt. Receipt v8 and capture v4 can
durably prove a trajectory such as `223 -> 89 -> 5`; the bounded operator summary
still caps its displayed `count` at 128 but now also carries the exact `totalCount`
and an explicit `countSaturated` flag.

This is an observability and evidence-integrity correction. It does not change the
prompt, model, compiler rules, validator rules, three-call/two-repair budget,
provider transport, retry/fallback policy, $5 ceiling, Candidate authority, Wizard,
or render behavior. It does not claim that the final five diagnostics are solved.

## Incident evidence

The one bounded live run that preceded this milestone completed three canonical
provider calls with no retry or fallback and stopped on
`draft_validation_repair_exhausted`:

- receipt:
  `outputs/r1d-lantern-program-v1-fresh-readiness-20260831T082520486Z/blueprint-authoring/authoring-receipts/9b3b3f1fdb19fecba77d098a979f863bab05334c95ef4f31a45351a3bdbb3455.json`
- capture:
  `outputs/r1d-lantern-program-v1-fresh-readiness-20260831T082520486Z/blueprint-authoring/sanitized-failure-captures/7c301e92c0b38239e897c92b026dacb4972ca5b3e6cf562c661e58dc014fc3a6.json`
- immutable receipt/capture versions: v7/v3
- durable bounded summaries: `128 -> 89 -> 5`
- true in-memory validation populations: `223 -> 89 -> 5`
- usage-backed cumulative conservative cost: `$1.285786`
- execution attestation: three logical calls, three transport dispatches, zero
  transport retries, no fallback
- aggregate capture total: 317; attempt attribution was not persisted
- result: no Candidate and no render

The old bytes were read only. They were not rewritten, migrated, or redigested.

## Production changes

### Receipt v8

- Every current attempt stores the bounded category summary plus exact
  `totalCount`, `countSaturated`, and a commitment to that attempt's complete
  sanitized census.
- Receipt evidence validation recomputes count/commitment topology and the aggregate
  count. Missing, swapped, reordered, extra-key, or mismatched evidence fails closed.
- The complete census itself remains in the content-addressed capture, not in the
  receipt. No raw draft, message, expected/actual value, story prose, or PII is added.

### Capture v4

- `attemptCensuses` is an exact-key, ordered sequence of admitted generation
  attempts `1..N`, bounded to the frozen three-attempt topology.
- Every census uses the closed compiler diagnostic-code catalog and the existing
  sanitized structural identity projection.
- The run-wide census is deterministically re-merged from the per-attempt censuses;
  identity collision, omission, overflow, reorder, or aggregate mismatch rejects.
- Current terminal codes are checked against the closed authoring terminal catalog.

### Publication, recovery, and replay

- The lifecycle accepts only the exact schema pairings v8/v4, v7/v3, and v6/v2.
- First terminal publication, lookup, recovery, and replay apply the same
  capture-required predicate and the same version-aware evidence validation.
- A same-aggregate capture with attempt partitions swapped is rejected before a
  terminal lookup can be durably published.

### Frozen legacy interpretation

- Receipt v7 and capture v3 remain immutable and replay only through a frozen
  admission-ledger/v1 policy snapshot: model, count-attestation version, 64K input
  ceiling, byte-accounting allowance, 3/2 call topology, $5 ceiling, price rates,
  272K strict breakpoint, and generation/probe reservation constants.
- Receipt v7 generation debit and capture v3 admission validation use those frozen
  functions. Current v8/v4 uses current policy functions. Receipt v6/capture v2
  retains its pre-ledger historical shape.
- The real paid v7 receipt validates with a null evidence reason and its real v3
  capture validates true under the frozen path.

## Offline falsification evidence

The focused battery passed **4 files / 202 tests** with one worker:

- `blueprint-admission-honesty-and-capture.spec.ts`: 54
- `production-lifecycle-foundation.spec.ts`: 93
- `qa-wizard-blueprint-authoring-lifecycle.spec.ts`: 54
- `blueprint-authoring-production-scale-f1-harness.spec.ts`: 1

The lifecycle integration uses the real compiler/assembly/validator stack and three
injected drafts that emit exactly `223 -> 89 -> 5`. It proves:

- three generation calls, two repairs, and one offline exact-count consultation;
- v8 summaries `[128/223/saturated, 89/89, 5/5]`;
- v4 per-attempt totals `[223, 89, 5]` and the exact final five identities;
- mint, persist, reload, recovery, and replay;
- provider and exact-count factories are unreachable after first execution;
- raw synthetic identifiers and prose do not enter receipt/capture bytes.

Additional hostile tests cover current closed catalogs, exact-key shapes,
attempt/commitment reorder and mismatch, aggregate mismatch, saturation boundaries,
legacy v7/v3 recovery/replay, and v6/v2 preservation.

`npx --no-install tsc --noEmit` passed. `git diff --check` passed.

The literal repository contract `npm run check` was also run and is not represented
as green: ordinary tests retained nine missing ignored-output-fixture assertions in
five unchanged files; the resource partition retained 19 unrelated timeout failures
and four known Vitest worker `onTaskUpdate` RPC timeout errors. None of those affected
files is changed by this milestone. The focused evidence above is green; the existing
repository-wide fixture/resource HOLD remains disclosed.

## Boundaries and next gate

No network, credential, provider, live authoring, image, audio, render, Candidate,
deployment, database, or remote mutation occurred in this milestone.

The next action is an independent read-only Claude Code review of the immutable local
commit range. A technical PASS would authorize diagnosis from truthful future v8/v4
evidence; it does not itself authorize another paid run or render.
