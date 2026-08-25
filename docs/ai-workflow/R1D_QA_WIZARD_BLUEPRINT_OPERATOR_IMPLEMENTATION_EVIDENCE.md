# R1D QA Wizard Blueprint Operator — Implementation Evidence

**Date:** 2026-08-25

**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`

**Combined base:** `3c6c04ceeb569fab17b749867121621cbba81016`

**Provider / live / render during this milestone:** none

## Goal and observed gap

The bounded OpenAI Responses Blueprint adapter existed, but there was no
single public operator lifecycle that could safely take the already-approved
QA Wizard Candidate bridge through immutable preflight, at-most-once paid
execution, sanitized terminal persistence and a separate exact Guy approval.
Calling the runner directly would leave duplicate-spend, credential timing,
crash replay and authority-rebinding decisions to callers.

## Implemented boundary

- `qaWizardBlueprintAuthoringLifecycle.ts` reloads and re-derives the approved
  bridge/context, prepares immutable preflight, claims one repository-global
  authoring authority, invokes the provider only after the claim, self-replays
  the returned receipt, and then publishes a canonical terminal.
- The ledger root is
  `outputs/qa-wizard-blueprint-authoring-ledger-v1`. Claim identity is derived
  from stable authoring authority, not output/request aliases. A terminal or
  uncertain claim cannot create another paid owner.
- The focused credential reader is constructed without filesystem access. On
  first invocation after the claim it opens one explicit absolute regular
  non-symlink file, verifies the opened identity, extracts exactly one
  `OPENAI_API_KEY`, caches only that value in memory and emits only the closed
  `credential_source_invalid` error externally.
- Receipt v6 persists no prompts, output, draft, provider payload, exception,
  secret or unrelated environment assignment. It binds exact typed terminal
  diagnostics, failure reason/kind, usage/cost/accounting and execution
  attestation.
- Replay requires the fixed Blueprint schema byte count, the two-byte `\n\n`
  separator, arithmetic-consistent accounting at or below 64K, exact
  compiler-vs-adapter reason provenance, and canonical adapter state:
  dispatch 0 means route false/model true; dispatch 1 means route/model true.
- Candidate bytes are validated and replayed before terminal persistence.
  Approval is a later, exact-`Guy`, candidate-digest-bound operation with a
  candidate-keyed immutable decision written before variable approval files.
- Existing immutable writers reuse identical bytes without rewriting them and
  fsync only newly created operator artifacts when requested.
- The public CLI has only `prepare-live-request`, `execute-live` and
  `approve-blueprint`. Only `execute-live` can reach the provider and it
  requires `--credential-file <absolute-local-env-file> --write true`.
- A whole-repository callsite census proves the canonical adapter remains
  behind this claimed operator. The legacy runner callsite is preflight-only.

## Falsification coverage

The lifecycle tests cover concurrent and cross-output claims, completed/failed
replay, crash seams, collision/no-overwrite behavior, hardlinks and junctions,
noncanonical bytes, scalar/array confusion, non-finite JSON, diagnostic
population integrity, cost/usage inconsistency, over-64K accounting, zeroed
schema/separator bytes, impossible adapter route/model states, compiler-only
failure reasons forged as adapter evidence, raw-material scanning and exact
approval replay.

The credential tests prove construction and preflight are filesystem-free,
first access occurs after the execution claim, only the named assignment is
accepted, aliases/hardlinks/symlinks/duplicate assignments are rejected, and
the approved local `.env.local` shape can be parsed without printing or
persisting its secret.

## Validation

- `npx --no-install tsc --noEmit` — PASS.
- Operator lifecycle — 32/32 PASS.
- QA Wizard Candidate bridge — 8/8 PASS under
  `threads.singleThread`; elapsed 77.31s in the final run.
- Blueprint boundary/lifecycle/census matrix — 119/119 PASS.
- `npm run qa-wizard-blueprint-authoring -- --help` — PASS.
- `git diff --check` — PASS.
- Full `npm run check`:
  - both TypeScript phases PASS;
  - ordinary: 3,711 PASS, 70 skipped, 11 unchanged baseline failures;
  - resource-intensive: 610 PASS, three timing failures and three known
    `onTaskUpdate` RPC events;
  - the 11 baseline failures are nine missing ignored-output fixtures and two
    unchanged five-second migration tests;
  - no changed-code assertion failed.

## Explicit limitations and exclusions

- Atomic claims exclude concurrent processes and survive ordinary process
  restart. No claim is made for abrupt Windows host/power-loss durability.
- This milestone does not create or approve a real Blueprint, reconcile a
  Visual Package, qualify a Wizard product, create an order, fake-pay, render,
  upload, write the database, deploy or publish.
- The exact combined operator and correction ranges have independent Claude
  Code PASS verdicts. Codex does not self-award those gates.
- A paid live attempt remains bounded to the compiler-owned model, three calls,
  two repairs, zero transport retries, no fallback and the independent $5 hard
  ceiling.

## Post-commit replay correction

Adversarial probes after the first operator commit found two related replay
fidelity gaps. Fully re-digested failures could carry an execution attestation
that the claimed compiler/adapter source never writes, and the response-ID or
empty-output reasons could omit provider-version/ID/digest evidence that is
already present at those producer checkpoints.

The general correction binds source and producer order rather than naming one
historical receipt:

- every `compiler_response_boundary` attempt has a response digest and either
  canonical-completed or exact `injected_adapter_unattested(1)` evidence;
- adapter response failures use exact canonical-observed dispatch evidence;
- adapter/compiler `execution_attestation_invalid` shapes are distinct;
- `response_id_invalid` requires current provider evidence version plus the
  already-computed output digest;
- `response_output_empty` additionally requires the earlier valid response ID;
- provider identity, evidence version, completion, usage and cost reasons are
  matched to the fields available at their actual producer position.

The new hostile cases recompute the aggregate execution attestation and the
receipt digest, so rejection is attributable to the source/reason contract
rather than a stale outer hash. Two separate read-only falsification passes
returned PASS with 0 findings. TypeScript, the 32-test lifecycle suite, the
119-test focused matrix and `git diff --check` pass after the correction.

An attempted Claude Code review of the original combined range exhausted its
explicit $7 audit budget before emitting a verdict. That attempt grants no
technical PASS.

Claude Code subsequently reviewed exact correction range
`fbb9acd2e0f190a1a721b11b4a18a9eef017cf4d..8ea8d413d69b1642c0bf9c0c5c4245d51ed8bf66`
read-only and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It independently
traced compiler and adapter producer ordering, attempted full rehash plus
aggregate-rebind counterexamples, and ran TypeScript, 32/32 lifecycle and
221/221 adapter/canonical-live-boundary/launcher checks. No external action was
performed. This PASS closes the correction findings. The remaining operator
claim, credential, persistence and approval surfaces then received their own
bounded independent audit.

Claude Code independently audited cumulative operator range
`90f3f20a2689373c7938daef353ea6926deadba7..8ea8d413d69b1642c0bf9c0c5c4245d51ed8bf66`
read-only and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It verified
the stable-authority claim precedes lazy credential/provider access,
fail-closed uncertain recovery, exact terminal replay, pre-persistence
candidate replay, independent cost reservation, credential file identity and
sanitization, writer-shaped response evidence, candidate-keyed exact Guy
approval, the stated Windows process/concurrency boundary, the production
callsite census and the absence of a story-specific shortcut. Its environment
blocked new `npx` commands, so the verdict used exhaustive static tracing and
the already-recorded green TypeScript, 32/32 lifecycle and 119/119 focused
matrix; it independently confirmed `git diff --check` is clean.

Claude Code also independently audited the Responses-boundary range
`3c6c04ceeb569fab17b749867121621cbba81016..90f3f20a2689373c7938daef353ea6926deadba7`
and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**, including independent
TypeScript and 70/70 adapter/foundation verification.

The operator is therefore technically accepted. It still cannot be invoked
for the current accepted-v3 Chameleon story until that Story Source first has
a current Visual Contract Candidate and an exact approved QA Wizard bridge.
The only approved bridge currently present on disk is bound to the superseded
bus-stop Story Source and is explicitly ineligible for the new-story proof.
