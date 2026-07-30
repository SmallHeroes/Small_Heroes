# R1D-PVB-D1A1B1 canonical materialization-input writer — implementation evidence

## Status and topology

- Worktree: `C:\Users\guyna\.codex\worktrees\f9db\Small_Heroes`
- Branch: `codex/r1d-pvb-d1a1b1-canonical-input-writer`
- Immutable base: `be19817106b16770477b1be15374aa7dd55eb6a2`
- Core commit: `682fd074`
- Consumer/CLI commit: `d27574aa`
- Tests/evidence: this document's containing commit
- Push: none
- Cost: exactly `$0`
- Gate: local implementation awaiting independent first-pass READ-ONLY Claude
  Code QA; Codex does not self-award independent technical PASS.

The task was detached and clean at the exact base before branch creation and
was the sole writer for this branch/worktree. Every other worktree remained
read-only. Known user changes in `main` and `feat/chunked-generation` were
inventoried and preserved.

## Verified root cause

B0 parsed and structurally validated logical JSON without checking its raw
byte form. Execution Request required raw canonical bytes before structural
validation. Neither had a public repository-owned input producer. The
exhausted input was structurally valid and deep-equal at the same 1,951-byte
length, differing only in top-level key order. This was a general
producer/contract gap, not a story, B0, provider, credential, pricing, prompt,
model, or budget failure.

## Implemented boundary

`canonical-materialization-input/v1` contains kind, payload schema version,
the existing kind-specific validated payload, canonical SHA-256 algorithm,
and digest. The writer validates first and publishes canonical UTF-8 bytes
atomically/no-overwrite at
`<out>/canonical-materialization-inputs/<kind>/<digest>.json`. Exact replay is
idempotent; different bytes at the same address reject. A newly created exact
artifact is removed if post-write common-reader verification fails.

The common reader opens one canonical repository-contained file descriptor,
requires a unique regular file and link count one, bounds input to 1 MiB,
checks descriptor identity/size/timestamps around the read, rechecks path
identity and bytes, rejects symlink/junction/hard-link authority, requires
canonical bytes, validates envelope kind/schema/digest, proves the filename
content address, and invokes the existing kind-specific validator.

The public CJS writer exposes exactly:

- `source-authoring-live-request`
- `canonical-live-execution-request`

It accepts separate bounded logical flags only, with no raw JSON, executable,
argv, shell/eval, inline PowerShell, or arbitrary environment. Unknown,
equals-form, positional, duplicate, missing, and duplicate repeated values
reject. Repeated lists sort only after duplicate rejection, so equivalent
caller order has identical bytes/digest/path.

The launcher uses exact local `tsx/cli`, the server-only shim, `shell:false`,
`windowsHide:true`, and a minimal environment plus `TSX_DISABLE_CACHE`. It
preserves Windows spaces/Unicode and exact exit/signal disposition.

`canonical-materialization-input-write-result/v1` uses stable sanitized reason
codes for CLI, schema, canonical-domain, filesystem, collision, post-write
verification, and generic failure. Its zero fields are explicitly
`externalBoundaryControlFlowEvidence` with
`evidenceKind: invariant-and-control-flow/v1`; they are not provider telemetry
or account/billing evidence.

B0 and Execution Request now use this one reader while retaining their
existing payload schemas/validators. Positive production-path tests construct
inputs through the public writer. Raw legacy B0 v2 and Execution v1 inputs
reject in new-attempt production paths, with no silent fallback. Historical
inputs remain immutable; migration is explicit rematerialization.

No Story Source/model/prompt/schema/pricing/call/repair/retry/fallback or
`futureLiveCommand` policy changed or was duplicated.

## Validation

Focused coverage includes both modes and consumers; kind/schema/digest/
filename binding; canonical bytes; flag-order invariance; idempotence,
collision, and cleanup; CLI grammar; Windows spaces/Unicode; containment,
traversal, symlink/junction/hard-link and source races; credential syntax-only
handling and redaction; exact launcher argv/environment/exit/signal behavior;
positive-control credential/provider/database/storage/network/child/write
sentinels; legacy rejection; and the no-selected-story-literal guard.

```text
npx tsc --noEmit
PASS

focused Vitest
PASS — 9 files / 351 tests
```

One earlier widened focused run exposed two unmigrated positive test fixtures
in the verifier and supervisor suites; production correctly rejected their
raw B0 JSON. Those fixtures were converted to the public writer. The affected
rerun passed 2 files / 74 tests, followed by 9 files / 351 tests.

Literal `npm run check` ran exactly once. TypeScript passed. Vitest completed
without timeout. New and affected suites passed under full-suite load. The
only failures were the six established missing ignored-fixture failures:

1. `child-lexicon-ages-5-8.spec.ts` — one story file
2. `momentum-gate-koko.spec.ts` — one beat file
3. `page-entity-qa.spec.ts` — one PNG
4. `set-appearance-ref-budget.spec.ts` — one appearance-board PNG
5. `story-read-back-validation.spec.ts` — two story files

The command was not rerun. There was no skip, retry, timeout increase,
assertion weakening, or fixture fabrication.

The full gate created five scratch files plus `tsconfig.tsbuildinfo`. Direct
deletion was blocked before execution by local policy. Each exact task-created
file was moved after a workspace-containment check into ignored
`node_modules/.codex-canonical-input-writer-full-check-scratch-20260731`.
None remains at its repository/output test path.

Offline dependency preparation used
`npm ci --offline --ignore-scripts --no-audit --no-fund` and local Prisma
generation without database access. The first compile attempt found no local
TypeScript compiler and exited before compilation. The offline install then
succeeded without dependency network fallback. No package or lockfile content
changed.

## Limits and non-actions

No real B0 or Execution Request materialization, preflight, credential
presence/read/check/load, pricing lookup, network/provider/model call, live
authoring, render/image/Vision/audio, storage/database/Supabase, Board,
Semantic Reconciliation, approval, candidate/Blueprint/package publication,
promotion, production activation, deployment, PR, or push occurred. No
historical artifact was rewritten or deleted. Cost remained exactly `$0`.

Rollback is reverting the three focused milestone commits. Independent Claude
Code first-pass QA remains required before technical PASS.
