# R1D-PVB-D1A1B1-ATTEMPT-4 execution evidence

**Recorded:** 2026-07-29
**Status:** HOLD — stopped at the first post-preflight verifier preload-resolution failure
**Worktree:** `C:\Users\guyna\.codex\worktrees\f48c\Small_Heroes`
**Branch:** `codex/r1d-pvb-d1a1b1-attempt-4`
**Approved source:** `codex/r1d-pvb-d1a1b1-attempt-3`
**Approved base:** `222c9959d8641a5a2fce5d34bfb22ab1aa2fda40`

This record is sanitized. It excludes the API key value, unrelated environment values, raw prompts/responses, hidden reasoning, raw provider payloads, raw exception stacks, and any untrusted provider content.

## Authority and topology

- Guy explicitly authorized this one fail-closed Attempt 4 after the repository-owned verifier and its corrected write sentinel received independent Claude Code PASS.
- Before mutation, the approved object, local source branch, configured source upstream, local remote-tracking ref, and fresh `git ls-remote --heads origin refs/heads/codex/r1d-pvb-d1a1b1-attempt-3` result all resolved to exact `222c9959d8641a5a2fce5d34bfb22ab1aa2fda40`. Local-source versus origin divergence was `0/0`.
- Source worktree `C:\Users\guyna\.codex\worktrees\2ad5\Small_Heroes` and detached target worktree `C:\Users\guyna\.codex\worktrees\f48c\Small_Heroes` were clean. No local or origin Attempt-4 branch existed. The only live agent was this execution task.
- The target was attached only to new branch `codex/r1d-pvb-d1a1b1-attempt-4`; its merge base remained the approved commit. No other worktree owns the branch.
- The unrelated pre-existing dirt in `C:\GNart\Work\Small_Heroes` and `C:\GNart\Work\sh-wt-style01` was inventoried before mutation, remained outside this execution, and was not touched.

## Credential-process deviation

Before Phase 1, the OpenAI API-key skill required a safe credential gate. Because Guy's brief explicitly selected reuse from `C:\GNart\Work\Small_Heroes\.env.local`, Codex performed one no-output line-oriented usability-presence check for the `OPENAI_API_KEY` assignment in that named file. The check reported only `usable_present`; it did not print, persist, summarize, or hash the value. It could traverse unrelated file entries before finding the assignment even though it did not parse or emit their names or values.

This check opened the approved credential source before the delegated Phase 1 gates, contrary to the brief's instruction to read it only after all Phase 1 gates passed, and its line traversal did not meet the stricter instruction to read no unrelated env names. The live child was never created and the credential was never injected. These process deviations are explicit and must be included in independent QA; they are not treated as permission for another attempt.

## Dependency gate

1. Committed dependency inputs were unchanged:
   - `package.json`: 2,069 bytes; SHA-256 `19ac6d7a01d5ac8c4ff16d0d7b57c5781a125d2d3ec3af43b6983fff082f7d`
   - `package-lock.json`: 128,844 bytes; SHA-256 `bf7932428ac1bc2cb8885e83a21f231486f35ea36820381b7d1763a77ba03d59`
2. `node_modules` was absent, so the one permitted command ran:

   ```text
   npm ci --offline --ignore-scripts
   ```

   Result: exit `0`; 200 packages installed; 201 audited; zero vulnerabilities. No retry, registry fallback, global/npx substitution, junction, package change, or install script occurred.
3. The resulting `node_modules` is a real `Directory`, with no link type or target.
4. Exact installed versions: Node `v22.19.0`, npm `10.9.3`, Prisma/Prisma Client `6.19.3`, TypeScript `6.0.3`, and tsx `4.22.2`.
5. Because install scripts were disabled and the generated client was absent, the exact installed CLI ran with Prisma update/checkpoint messaging disabled:

   ```text
   node node_modules/prisma/build/index.js generate --schema backend/schema.prisma
   ```

   Result: exit `0`; Prisma Client `6.19.3` generated locally in 177 ms; no database access.

## Canonical B0 materialization

The ignored calibration input preserved the approved general data:

- version `canonical-live-request-materialization-input/v1`
- request ID `r1d-pvb-d1a1b0-fox-calibration-001`
- requested timestamp `2026-07-27T21:02:12.469Z`
- Story Source key `fox_uri_adventure`
- Story Source path `story-bank/v3-approved/fox_uri_adventure.md`
- only worktree-bound substitution: repository real path `C:\Users\guyna\.codex\worktrees\f48c\Small_Heroes`

The canonical production lifecycle ran once:

```text
node node_modules/tsx/dist/cli.mjs --require ./scripts/shims/register-server-only.cjs scripts/production-visual-lifecycle.ts source-authoring-live-request-materialize --repo-root C:\Users\guyna\.codex\worktrees\f48c\Small_Heroes --request outputs/r1d-pvb-d1a1b1-attempt-4/materialization-inputs/fox-live-request.json --out outputs/r1d-pvb-d1a1b1-attempt-4/live-request
```

- Started: `2026-07-29T11:32:55.4012904Z`
- Finished: `2026-07-29T11:32:56.8312775Z`
- Result: exit `0`; `canonical_live_request_materialization / materialized_inputs_only`

Canonical payload-domain identities and cross-links:

- normalized Story Source: `02629e886a9aaa1e714d9a8d652c24d94ca5843465ff8a9cb70d320a24e2231c`
- worktree-bound source-authority request: `d331b1570f692b6ee9c865ede80811be96df911d333eaf4050e0d3b7ed312551`
- portable source snapshot: `d8a6bed426a3ea571242915dcd63851bd59de4f148c52fbf28d0cb49429123d9`
- portable live request: `d3038f06ee172522445d438359d0b3bdef60ce7fa7dccb53f5d7853617d2ccff`
- worktree-bound manifest: `975fc89f5265bb61f77cc01cb88f7584d8aae7c0ba48a717383bea9fd1147cae`
- page count: `12`, page numbers `1` through `12`, authored cover authority present

The materialized request and manifest retained OpenAI Responses `gpt-5.6-sol`, service tier `default`, reasoning `medium`, at most three application calls, at most two semantic repairs, zero transport retries, no fallback, conservative reservation no greater than `$4.884`, and hard ceiling exactly `$5.00`.

No whole-file JSON hashing or hand-built verifier supplied artifact authority. For inventory only, the five local files were:

| Artifact | Bytes | Inventory SHA-256 |
| --- | ---: | --- |
| materialization input | 335 | `31839f3a2e6adbbbc867d668c362521f44920823b761e40b66169407ae30053a` |
| source-authority request | 349 | `21b5b2a88958a944ceb9b66ae12311d2b02e0707267c353a6071e14bfd95ba54` |
| source snapshot | 29,125 | `bdedc40c645c949bece8278ecf45e515e242eb957d1e85b9882605628216def0` |
| live request | 2,432 | `73289fcf62fd339aa2fb8a69100fa83333025d4dbc706875ed451b35db0aa505` |
| manifest | 3,376 | `c51f4924d9979da6c1303854ff680aea38526173506c6e7df3eefbc24c206a24` |

## Single preflight

`NODE_OPTIONS` was confirmed absent. The one exact bare preflight ran after dependencies and B0 were green:

```text
node scripts/visual-contract-authoring.cjs preflight
```

- Ready timestamp: `2026-07-29T11:33:13.0885033Z`
- Result: exit `0`; `LIVE-AUTHORING IMPORT PREFLIGHT PASS`
- Checked labels: adapter factory, request-body builder, canonical live runner, `OPENAI_API_KEY`, and `openai-responses-authoring-evidence/v2`
- No credential loading, env file, `NODE_OPTIONS`, sentinel, npm/npx/tsx substitution, extra argument, second preflight, or correction occurred.

## First-failure verifier stop

The one post-preflight verifier invocation used the literal command shape recorded by the independently gated verifier-hardening evidence:

```text
node node_modules/tsx/dist/cli.mjs --require scripts/shims/register-server-only.cjs scripts/production-visual-lifecycle.ts source-authoring-live-request-verify --repo-root C:\Users\guyna\.codex\worktrees\f48c\Small_Heroes --manifest outputs/r1d-pvb-d1a1b1-attempt-4/live-request/live-request-materializations/975fc89f5265bb61f77cc01cb88f7584d8aae7c0ba48a717383bea9fd1147cae.json
```

- Ready timestamp: `2026-07-29T11:33:27.7772595Z`
- Result: exit `1`
- Bounded failure: Node `MODULE_NOT_FOUND` for preload label `scripts/shims/register-server-only.cjs`
- The repository TypeScript script never evaluated. No sanitized `canonical-live-request-verification/v1` success or rejection payload was emitted, and no artifact was read by the canonical verifier.

Read-only diagnosis after the binding stop found:

- `docs/ai-workflow/R1D_PVB_D1A1B1_POST_PREFLIGHT_VERIFIER_HARDENING_EVIDENCE.md` records the exact failed preload string without `./`;
- `AGENTS.md`, `CLAUDE.md`, `package.json`, and repository standalone-script examples require `--require ./scripts/shims/register-server-only.cjs`; and
- `lib/visual-package/__tests__/live-request-verification.spec.ts` exercises the real subprocess with absolute paths for local tsx, the shim, and the script file.

This is a command-authority/documentation-boundary failure before artifact verification, not evidence that B0 is stale or invalid. Per the first-failure rule, no `./` correction, absolute-path substitution, verifier rerun, second preflight, pricing lookup, or live invocation occurred.

## Stop effects and external boundaries

- Fresh official OpenAI pricing/model authority was not checked. There are no pricing URLs, lookup timestamps, or new calculations for Attempt 4.
- No live child was created and no credential was injected.
- Application provider calls: `0`.
- Semantic repairs: `0`.
- Transport retries: `0`.
- Provider usage/cache-write evidence: none.
- Calculated incurred cost: `$0.00`.
- Maximum incurred cost: `$0.00`.
- `authoring-receipts`, `readiness-evidence`, `contract-candidates`, and `rejected-authoring-requests` are absent.
- No render/page/image/Vision/audio, storage/database/Supabase, Set Identity Board, Semantic Reconciliation, Visual Contract approval, Blueprint authoring/approval, package assembly/publication/promotion, production activation, deployment, or push occurred.
- No production code, schema, config, test, package, lockfile, Story Source, or request-policy file changed.

## Closeout validation

- Direct deterministic `node node_modules/typescript/bin/tsc --noEmit`: PASS.
- The current-run ignored `tsconfig.tsbuildinfo` was removed by exact path.
- The full suite was not run, consistent with the execution brief.
- Closeout topology before documentation remained exact: target branch and source branch at approved base, target merge base exact, source local/remote-tracking parity `0/0`, relevant source/target worktrees clean, and unique target worktree ownership.

## Gate

R1D-PVB-D1A1B1-ATTEMPT-4 is **HOLD / exhausted before pricing and provider reachability**. This evidence grants no authority to correct or rerun the verifier, rerun preflight, perform pricing research, inject credentials, invoke the provider, or continue downstream. Independent Claude Code first-pass read-only QA and a new explicit Guy ruling are required. Codex does not self-award independent technical PASS.
