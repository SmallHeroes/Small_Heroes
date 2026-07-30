# R1D-PVB-D1A1B1 canonical supervised live attempt — execution evidence

**Recorded:** 2026-07-30
**Status:** HOLD — attempt exhausted at the first canonical execution-request materialization invocation
**Worktree:** `C:\Users\guyna\.codex\worktrees\1e57\Small_Heroes`
**Branch:** `codex/r1d-pvb-d1a1b1-canonical-execution-request-materialization`
**Authorized and pushed start:** `7cfcccd1b1dfa0c5becbd1f7b730333acb2d9745`

This record is sanitized. It excludes the API-key value, unrelated
environment assignments, raw prompts, raw provider responses, raw errors,
and exception stacks.

## Authority and intake topology

Guy authorized one fail-closed supervised live attempt from exact pushed head
`7cfcccd1b1dfa0c5becbd1f7b730333acb2d9745` in the existing materializer
worktree and branch.

Intake proved:

- local `HEAD`, upstream, and origin all resolved to the authorized head;
- local/upstream divergence was `0/0`;
- the worktree was clean;
- this Task was the sole writer for this worktree and branch;
- all other milestone worktrees were clean and read-only; and
- `main` and `feat/chunked-generation` retained their pre-existing dirty
  product state and were not modified.

## Isolated offline dependencies

The task preserved the two ignored dependency-quarantine directories outside
`node_modules` by exact directory rename, ran:

```text
npm ci --offline --ignore-scripts --no-audit --no-fund
node node_modules/prisma/build/index.js generate --schema backend/schema.prisma
```

and restored the quarantine directories. Their pre/post inventories remained:

- `.codex-full-check-scratch-20260730-1414` — 6 files / 445,504 bytes;
- `.codex-partial-install-20260730-1355` — 1,970 files / 12,248,599 bytes.

`node_modules` is a real local directory, not a link or reparse-point
authority. Installed versions were Node `22.19.0`, tsx `4.22.2`, TypeScript
`6.0.3`, Vitest `3.2.4`, OpenAI SDK `6.35.0`, and Prisma/Prisma Client
`6.19.3`. Package installation was offline; Prisma generation used no
database.

## Canonical zero-cost B0 rematerialization

The ignored v2 B0 control input was derived from the prior canonical v2
calibration control data. Only repository root, request ID, and timestamp
changed. Story Source key/path remained control data and no shared code,
schema, prompt, policy, Story Source, test, or fixture was edited.

The sole B0 command was:

```text
node node_modules/tsx/dist/cli.mjs --require ./scripts/shims/register-server-only.cjs scripts/production-visual-lifecycle.ts source-authoring-live-request-materialize --repo-root C:\Users\guyna\.codex\worktrees\1e57\Small_Heroes --request outputs/r1d-pvb-d1a1b1-canonical-supervised-live-attempt/b0/materialization-inputs/canonical-live-request-v2.json --out outputs/r1d-pvb-d1a1b1-canonical-supervised-live-attempt/b0/live-request
```

It exited `0` with
`canonical_live_request_materialization / materialized_inputs_only` and
created exactly four B0 authority artifacts:

- normalized Story Source digest
  `02629e886a9aaa1e714d9a8d652c24d94ca5843465ff8a9cb70d320a24e2231c`;
- source-authority request
  `f160ea6646e561bc68b7bf2b0a8eeffac2abf40422a6a8b0957155b399f99b8d`;
- portable source snapshot
  `d8a6bed426a3ea571242915dcd63851bd59de4f148c52fbf28d0cb49429123d9`;
- live authoring request
  `b3958e82cb9c1cb75eda0251e55fe041da110611f5e76445afe1c5f12162c8f2`;
  and
- worktree-bound materialization manifest
  `b5b25fc4c9e2044f42758688e6ce1cc05e9fbdeee1ae5e79913ca7d43c5d376f`.

The v4 request retained OpenAI Responses `gpt-5.6-sol`, service tier
`default`, reasoning `medium`, 64,000 maximum input tokens, 36,000 maximum
output tokens, three calls, two repairs, zero transport retries, no fallback,
projected maximum `$4.884`, and hard ceiling `$5.00`. This is materialized
policy authority, not evidence that current official pricing was reverified
or that any reservation was consumed.

## Terminal execution-request materialization rejection

One execution-request control input was created with:

- the B0 manifest path above;
- five exact preservation paths covering the B0 input and four B0 artifacts;
- five expected-absence category paths for receipts, failure evidence,
  readiness, rejected requests, and candidates; and
- the approved credential source as an opaque path label.

The only execution-request materialization invocation was:

```text
node scripts/canonical-live-execution-request-materialize.cjs --repo-root C:\Users\guyna\.codex\worktrees\1e57\Small_Heroes --input outputs/r1d-pvb-d1a1b1-canonical-supervised-live-attempt/execution-request/materialization-inputs/canonical-live-execution-request-v1.json
```

It exited `1` with sanitized result
`canonical-live-execution-request-materialization-result/v1 / rejected` and
reason code:

```text
execution_request_materialization_input_rejected
```

The command was not corrected or rerun.

Read-only diagnosis through the production validator and serializer found:

- structured input issues: none;
- raw byte length: `1,951`;
- canonical byte length: `1,951`;
- raw SHA-256:
  `5bdb857fdb9d855778d709e59f9208d7267f7e88351644f03b8228ffd538df70`;
- canonical-byte SHA-256:
  `bcb5adc0457fa53c7b67780364e03e529fad313a4cf91fd006957dea850acbd9`;
- exact byte equality: false.

`readCanonicalInput()` compares the raw input bytes with
`canonicalLiveAuthoringJsonBytes()` before deriving Git, verifying B0, or
building request authority. The caller-created pretty JSON had valid
structured fields but noncanonical key ordering. The materializer therefore
failed at its intended canonical-byte gate.

No staging file or
`canonical-live-execution-request/v1` authority was created. Execution
Supervisor `verify` and `live` modes were never reached.

## Preserved artifact inventory

| Artifact | Bytes | Raw SHA-256 | Payload-domain digest |
| --- | ---: | --- | --- |
| `b0/materialization-inputs/canonical-live-request-v2.json` | 353 | `51745b3ca69dedfbad68f7441247387662256bccd47d5f11c7e44cff15ab2bf1` | input only |
| `b0/live-request/source-authority-requests/f160ea6646e561bc68b7bf2b0a8eeffac2abf40422a6a8b0957155b399f99b8d.json` | 349 | `831aec5ce6e7aa3378a97d770bb2e165efd6c7b3fb11975fc29d766d42055908` | `f160ea6646e561bc68b7bf2b0a8eeffac2abf40422a6a8b0957155b399f99b8d` |
| `b0/live-request/source-snapshots/d8a6bed426a3ea571242915dcd63851bd59de4f148c52fbf28d0cb49429123d9.json` | 29,125 | `bdedc40c645c949bece8278ecf45e515e242eb957d1e85b9882605628216def0` | `d8a6bed426a3ea571242915dcd63851bd59de4f148c52fbf28d0cb49429123d9` |
| `b0/live-request/authoring-requests/b3958e82cb9c1cb75eda0251e55fe041da110611f5e76445afe1c5f12162c8f2.json` | 2,680 | `1360e45641067a1513e6c9772b7fb7666a4df3a72539f4e872b705c7dbfec5eb` | `b3958e82cb9c1cb75eda0251e55fe041da110611f5e76445afe1c5f12162c8f2` |
| `b0/live-request/live-request-materializations/b5b25fc4c9e2044f42758688e6ce1cc05e9fbdeee1ae5e79913ca7d43c5d376f.json` | 3,583 | `b00627a85b200e29d8befcf8042c095a99a236e1abd4ec4fdfde1e265da21d4f` | `b5b25fc4c9e2044f42758688e6ce1cc05e9fbdeee1ae5e79913ca7d43c5d376f` |
| `execution-request/materialization-inputs/canonical-live-execution-request-v1.json` | 1,951 | `5bdb857fdb9d855778d709e59f9208d7267f7e88351644f03b8228ffd538df70` | rejected input only |

All paths above are relative to
`outputs/r1d-pvb-d1a1b1-canonical-supervised-live-attempt/`.

The five expected-absence category paths remain absent. No receipt,
provider-call-failure evidence, readiness, rejected-authoring-request,
candidate, execution request, prompt, raw response, or raw error artifact
exists.

## Calls, cost, and evidence semantics

The attempt stopped before every authorized external or credential boundary:

- official OpenAI pricing/model lookups: `0`;
- canonical bare preflight runs: `0`;
- credential presence checks: `0`;
- credential reads/loads: `0`;
- Execution Supervisor `verify` invocations: `0`;
- Execution Supervisor `live` invocations: `0`;
- application provider calls: `0`;
- structural/semantic repair calls: `0`;
- transport retries: `0`;
- fallback: none;
- locally observed spend: `$0.00`.

The materializer's `externalBoundaryEvidence` zero fields are invariant/policy
evidence supported here by the early canonical-input control flow, call-graph
review, command history, and the absence of live artifacts. They are not
directly instrumented runtime or provider-account counters. No OpenAI account,
billing, usage, request-log, or other external service-log audit occurred.

## Operational notes and final authority

An initial all-in-one dependency-preservation wrapper was blocked by the local
execution policy before it ran. A subsequent read-only deep-hash attempt was
unsuitable for intentionally incomplete long paths in the preserved partial
install; it wrote nothing. Two read-only inline diagnostic expressions failed
before a third reported the bounded canonicality facts above. None of those
events crossed a credential, network, provider, model, database, storage, or
live-authoring boundary.

No test suite or `npm run check` was run. The required deterministic
repository-local TypeScript and `git diff --check` closeout validations are
recorded in `CURRENT.md`.

This attempt is exhausted. It grants no corrected execution-request input,
second materialization invocation, pricing lookup, preflight, credential
reuse, supervisor verification/live invocation, provider call, repair, retry,
render/image/Vision/audio call, storage/database/Supabase action, Board action,
Semantic Reconciliation, approval, Blueprint/package publication, promotion,
production activation, deployment, or push. Any continuation requires a new
Lead ruling and Guy's explicit authority.
