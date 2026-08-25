# R1D Blueprint Responses Boundary — Implementation Evidence

**Date:** 2026-08-25

**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`

**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`

**Base:** `3c6c04ceeb569fab17b749867121621cbba81016`

**State:** offline implementation green; independent Claude Code QA pending

## Approved requirement

Create the smallest general, paid-call-safe Blueprint authoring boundary needed
after an approved Candidate/Reconciliation bridge. The implementation must use
the existing Pre-Render Blueprint compiler and guarded OpenAI Responses
transport, have an independent locked policy and cost fence, preserve only
sanitized evidence, stop on any boundary failure, and load no provider module
from existing offline entrypoints. It does not yet execute a provider or create
Blueprint/package/Wizard artifacts.

## Production changes

1. `lib/visual-package/blueprintAuthoringPolicy.ts`
   - Adds `pre-render-blueprint-authoring-policy/v1`.
   - Locks OpenAI Responses, `gpt-5.6-sol`, default tier, medium reasoning,
     tools disabled, `store:false`, streaming, zero retries, 20-minute timeout,
     64K input, 48K output, 3 calls / 2 repairs, no fallback and `$5.00`.
   - Independently binds current pricing authority
     `openai-standard-pricing/2026-08-25-v3`.
   - Projects a conservative three-call maximum of `$4.224`.
   - Provides exact input-accounting, usage-consistency, cost and spend helpers.

2. `lib/visual-package/openaiResponsesBlueprintAuthoringAdapter.ts`
   - Builds the exact strict Blueprint JSON-schema Responses body.
   - Reuses the existing guarded, one-destination streaming transport.
   - Applies sequence, options, input and remaining-call reservation checks
     before credential access.
   - Reads the existing credential lazily and performs no fallback or retry.
   - Normalizes only closed response identity, completion, usage, cost and
     execution-attestation evidence.
   - Becomes terminal after every failure so compiler repair cannot trigger a
     second paid dispatch after a provider-boundary failure.

3. `lib/visual-package/productionAuthoringRunner.ts`
   - Advances current request v3 -> v4 and receipt v4 -> v5; retains request v3
     and receipt v4/v3 as immutable legacy identities.
   - Locks request policy to the Blueprint authority.
   - Independently recomputes input, reservation and usage cost evidence rather
     than trusting provider-returned numeric values.
   - Rejects missing, forged or inconsistent evidence before compiler repair.
   - Preserves exact `not_run`, canonical-dispatch and unattested-adapter states
     without allowing a later pre-dispatch stop to erase prior dispatch proof.
   - Persists no raw prompt, response, exception, credential or provider body.

4. `lib/visual-package/index.ts`
   - Exports only the pure Blueprint policy.
   - Does not export or eagerly load the provider adapter.

## Regression evidence

- Exact request body and schema policy, including tools/store/stream/tier.
- Exact `$4.224` maximum and `$5.00` acceptance boundary.
- Initial and repair 64K input admission; 64K + 1 rejects before credential.
- Zero credential/transport reachability in real-adapter preflight.
- Three-call reservation, zero retries and terminal fourth-call rejection.
- Credential failure records `not_run` and zero dispatch.
- A canonical initial dispatch remains proven when a repair credential read
  stops before transport.
- Completion, provider/model, response-id, output and usage failures stop before
  repair while retaining only bounded evidence.
- Output ceiling, total mismatch, cache partition overflow and reasoning-token
  overflow all fail closed.
- Reserved, nominal, per-call and cumulative cost forgeries are rejected; only
  recomputed values survive.
- Every execution-attestation axis is mutation-tested.
- One observed transport dispatch plus thrown transport failure records exactly
  one dispatch and zero retries, with raw error text absent.
- Missing model evidence records `unknown-model`; omitted boundary identity or
  malformed attestation reclassifies as invalid evidence.
- A child-process `Module._load` sentinel proves the shared barrel and runner do
  not import OpenAI or either provider adapter. Direct adapter import is the
  positive control and trips the sentinel.

## Validation

- Focused policy/adapter/runner: **2 files / 68 tests PASS**.
- Blueprint compiler/lifecycle plus canonical live boundary: **7 files / 378
  tests PASS**.
- `npx --no-install tsc --noEmit`: **exit 0**.
- `git diff --check`: **exit 0**.
- Literal `npm run check`: both TypeScript phases passed. Ordinary recorded
  3,675 passing / 70 skipped / 12 failing assertions. One failure was the
  expected inventory-count change from adding this spec; the census was updated
  from 329/309 to 330/310, the new spec is asserted in the ordinary partition,
  and that classifier file then passed 7/7. The other eleven are the established
  nine absent ignored-output assertions plus two run-variable five-second
  Blueprint-migration timeouts. Resource-intensive passed 613/613 before two
  established `onTaskUpdate` RPC errors. The full check was not retried.

No retry, timeout inflation, test skip, fixture fabrication or provider call was
used. The broader repository check remains a later pre-handoff validation and
must retain the already documented run-variable Vitest/incomplete ignored-output
baseline rather than being represented as newly green.

## Explicit non-actions and next boundary

No credential read, provider/network/live authoring, Candidate, persisted
Blueprint, approval, package, locator, Wizard, image/audio, render, database,
storage, Preview deployment, Production deployment or push occurred.

This milestone alone cannot spend. The next separate implementation must load
and replay an exact approved bridge, prepare the exact live request, atomically
claim that request before provider access, persist a terminal lookup/receipt,
persist the existing Blueprint lifecycle on success, and stop for Guy's exact
Blueprint/review approval. A claim without a terminal record must be treated as
uncertain and must never auto-retry.

## Independent QA falsification targets

- Attempt to import OpenAI through every offline barrel/runner path.
- Mutate every request-policy and response-evidence field independently.
- Forge input, reservation, usage, per-call/cumulative cost and attestation
  fields while keeping other evidence canonical.
- Exercise pre-dispatch, dispatched transport failure, incomplete response,
  malformed usage, compiler repair and repair exhaustion.
- Prove no failure can trigger another provider call and no raw material can
  enter a receipt.
- Verify request/receipt legacy identities and all unchanged compiler behavior.
