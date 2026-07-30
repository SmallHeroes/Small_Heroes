# R1D-PVB-D1A1B1 Canonical Execution Request Materialization — implementation evidence

## Status and immutable scope

- Milestone: `R1D-PVB-D1A1B1-CANONICAL-EXECUTION-REQUEST-MATERIALIZATION`
- Worktree: `C:\Users\guyna\.codex\worktrees\1e57\Small_Heroes`
- Branch: `codex/r1d-pvb-d1a1b1-canonical-execution-request-materialization`
- Immutable base: `30745cf0b8fdc0798c96b7cda00951f900a89a86`
- Focused code commit: `b9a7b145432c28c115599ee24f9abb16cab7101b`
- Review range: base through the documentation head that contains this record
- Gate: **HOLD pending independent first-pass READ-ONLY Claude Code review**
- Cost: `$0`

This Task had sole-writer authority only in this worktree and branch. Every other branch and worktree was read-only. The target branch did not exist locally or in local origin tracking at intake, was created only from the exact approved base, has no upstream, and was not pushed.

## Verified root cause

The approved base contains a versioned `canonical-live-execution-request/v1` contract, canonical builder, Execution Supervisor, public `verify`/future `live` entrypoint, and independent technical PASS for that supervisor. It did not contain a trusted production surface that could create the request.

The only request construction was a low-level exported builder and test helper code. Callers therefore still had to hand-supply expected branch, HEAD, refs, divergence, B0 digest, preservation byte identities, and exact future command. The builder validated those claims but did not derive them. That left a manual-authority gap upstream of an otherwise fail-closed supervisor.

## Additive architecture

The implementation adds:

- `canonical-live-execution-request-materialization-input/v1`
- `canonical-live-execution-request-materialization-result/v1`
- a story-neutral TypeScript materialization core
- a separate strict TypeScript entrypoint and fixed CJS launcher
- repository command `materialize-canonical-live-execution-request`
- deterministic temp-repository, filesystem, sentinel, CLI, and failure-cleanup tests

The existing credential-bearing Execution Supervisor was not extended. Its only public modes remain exactly `verify` and `live`.

### Bounded caller input

The materializer input contains only:

- request ID and canonical timestamp;
- one canonical repository-relative B0 manifest path;
- one canonical repository-relative output directory;
- sorted unique explicit preservation paths;
- sorted unique explicit expected-absence paths;
- one opaque absolute credential-source path.

It contains no executable, argv, shell text, eval text, inline PowerShell, arbitrary child environment, expected branch, expected HEAD, expected ref commit, expected divergence, manifest digest, future-command digest, Story Source/story ID, child, companion, page, prop, reveal, model, prompt, schema, pricing, budget, repair, retry, or fallback policy.

The public CLI accepts only separate-value `--repo-root` and `--input`. Equals forms, duplicates, unknown flags, positional tokens, and missing flags/values produce one canonical sanitized rejection and exit `1`.

## Derived Git and B0 authority

Git derivation uses fixed repository-owned `git` argv with `shell:false`, `windowsHide:true`, a bounded output buffer/timeout, optional locks disabled, and a minimal platform environment:

1. repository top level;
2. symbolic `HEAD`;
3. exact `HEAD^{commit}`;
4. porcelain-v2 tracked/untracked cleanliness;
5. exact symbolic `@{upstream}`;
6. exact upstream commit;
7. exact left/right local/upstream divergence.

Detached, dirty, no-upstream, malformed, moved, failed, signaled, nonzero, or excessive-output results fail closed. The request receives the derived branch and upstream refs, their exact commits, and their derived ahead/behind counts.

The materializer composes `verifyCanonicalLiveRequestBundle` unchanged. A rejected verifier result stops before request bytes or authority creation. After successful verification, the materializer re-reads only the canonical verified manifest to obtain and bind its exact `futureLiveCommand`. Existing manifest schema/digest validation remains authoritative. Story Source, source snapshot, prompt, schema, Action Semantic Catalog/coverage, provider/endpoint/model/service tier, pricing, call/repair budgets, retry/fallback policy, and future-command rules are not reimplemented.

## Filesystem, credential, and persistence boundary

Materialization input, B0 manifest, and preservation files must be canonical repository-contained regular files. Lexical path, realpath, repository containment, canonical repository-relative spelling, symlink/junction alias, and hard-link uniqueness checks fail closed.

Preservation identities are calculated from one open descriptor with:

- maximum 64 MiB;
- exact byte count;
- SHA-256;
- descriptor identity and link-count recheck;
- post-read path/identity recheck;
- mutable buffer zeroing.

The credential source is an opaque path label. The materializer never calls existence, lstat/stat, realpath, open, read, parse, assignment-count, presence, or value-loading behavior for it. The request derives and fixes:

- variable `OPENAI_API_KEY`;
- assignment policy `single-line-start-assignment/v1`;
- `rejectAmbientCredential: true`;
- child environment policy `minimal-platform-allowlist/v1`;
- exact platform allowlist from repository code.

The fixed launcher excludes ambient `OPENAI_API_KEY`, routing variables, `NODE_OPTIONS`, and arbitrary environment names.

Request bytes are built only by `buildCanonicalLiveExecutionRequest` and `canonicalLiveAuthoringJsonBytes`. The materializer:

1. writes a private exact-byte staging file inside the contained output root;
2. runs the public `verifyCanonicalLiveExecution` path against that file;
3. removes the staging file;
4. publishes exact bytes under `<output>/canonical-live-execution-requests/<request-payload-digest>.json` through atomic no-overwrite immutable writing;
5. immediately runs public supervisor verify against the final path.

Identical bytes are idempotent. Differing bytes at the same address reject without overwrite. A rejected or unexpectedly throwing staged verification creates no final authority. A rejected or unexpectedly throwing final verification removes only a newly created same-byte, unique, non-aliased file. Pre-existing authority is never deleted by a failed replay.

## Zero-cost external-boundary proof

The real public TypeScript entrypoint was executed in a temporary Git repository under a preload sentinel that:

- throws on any read of the declared credential source;
- throws on OpenAI, Prisma Client, or Supabase module loading;
- throws on network fetch;
- throws on non-Git child process spawn, including canonical preflight and live child attempts;
- permits local filesystem writes only inside the declared contained materialization output root.

The materializer succeeded and returned canonical `materialized` plus `verification.status: ready`. Separate positive controls proved every credential, provider, database, storage, network, forbidden-write, preflight, and live-child sentinel would terminate the process if reached. The success output omitted the ambient fake secret and raw credential path.

## Validation evidence

Offline local dependency preparation used:

```powershell
npm ci --offline --ignore-scripts --no-audit --no-fund
node node_modules/prisma/build/index.js generate --schema backend/schema.prisma
```

The first short-timeout install process was terminated by the wrapper and left a partial task-created dependency tree. Direct recursive deletion was denied by environment policy, so the partial tree was preserved under ignored `node_modules/.codex-partial-install-20260730-1355`. A clean offline install then succeeded. Installed local versions were TypeScript `6.0.3`, Vitest `3.2.4`, and Prisma/Prisma Client `6.19.3`. No dependency network fallback, database access, package change, or lockfile change occurred.

Focused commands and exact results:

```powershell
node node_modules/typescript/lib/tsc.js --noEmit --project tsconfig.json --incremental false
# PASS

node node_modules/vitest/vitest.mjs run lib/visual-package/__tests__/live-execution-request-materialization.spec.ts
# PASS — 1 file / 20 tests

node node_modules/vitest/vitest.mjs run lib/visual-package/__tests__/live-execution-request-materialization.spec.ts lib/visual-package/__tests__/live-execution-supervisor.spec.ts lib/visual-package/__tests__/live-request-materialization.spec.ts lib/visual-package/__tests__/live-request-verification.spec.ts lib/visual-package/__tests__/canonical-live-authoring-launcher.spec.ts lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts
# PASS — 7 files / 316 tests

git diff --cached --check
# PASS before focused code commit
```

The single permitted repository-wide command ran literally once:

```powershell
npm run check
```

It completed in about 80 seconds. TypeScript passed. Vitest produced no timeout and no new failure; its only failures were the six established missing ignored-output fixtures:

1. `child-lexicon-ages-5-8.spec.ts` — one absent ignored story file
2. `momentum-gate-koko.spec.ts` — one absent ignored beat file
3. `page-entity-qa.spec.ts` — one absent ignored PNG
4. `set-appearance-ref-budget.spec.ts` — one absent ignored appearance-board PNG
5. `story-read-back-validation.spec.ts` — two absent ignored story files

The full check was not rerun. The new materializer and existing supervisor/B0 suites passed under full-suite load. There was no skip, retry, timeout change, assertion weakening, or fixture fabrication.

Before the full check, four ignored files were inventoried. Afterward, each retained its exact SHA-256:

- `outputs/scenario-banks/baby-elephant-tubi-locked.md` — `ee9fd1fd255535e42b24dc7e52bae54803fd8312086b3116c623b560fa53b0d1`
- `outputs/scenario-banks/bolly-armadillo-locked.md` — `fac8d36addccb9e76bbb60c849bf56a95d1ea8c3176bc574a52b3e6ae8fc1a3c`
- `outputs/story-gen-runs/2026-06-08T12-24-41-119Z/revalidate-chip-fix-2026-06-08T12-49-08-844Z/story.final.md` — `066b04fdcdf46a09493ada1fbc8697cb2c5e109bff85b3149ebe586aa4bde9d3`
- `outputs/story-gen-runs/2026-06-08T12-24-41-119Z/story.final.md` — `89b2ed326bb6e3ad8eb11ee01e379cd8f17e59b08a686695e6a42adea9d0f27d`

The full check created two QA-anchor files, two story-read-back scratch files, `tsconfig.tsbuildinfo`, and the Vitest result cache. Direct deletion was denied by environment policy. Each exact file was moved into ignored task-owned `node_modules/.codex-full-check-scratch-20260730-1414`; none remains under `outputs/` or repository root.

## Explicit non-actions and limitations

This milestone did not materialize a real-attempt execution request. The production command requires a configured upstream so it can derive bounded branch/upstream refs and divergence; it intentionally rejects a local-only preparation branch.

It did not invoke real B0 preparation/rematerialization, canonical import preflight, credential presence/check/read/load, pricing lookup, network/provider/model, live authoring, render/image/Vision/audio, storage/database/Supabase, Board, Semantic Reconciliation, approval, candidate/Blueprint/package publication, promotion, production activation, deployment, or push. No historical B0, request, receipt, readiness, candidate, or attempt artifact changed.

The paid supervised live phase remains HOLD. The implementation has not been exercised against a real credential or provider, and this milestone grants no such authority.

Rollback is reverting the focused code and documentation commits. Ignored dependency/scratch quarantines are task-local reproducibility residue and contain no tracked authority. Codex does not self-award independent technical PASS. Claude Code must begin by reconciling the exact branch, worktree, base, head, dirty state, ahead/behind state, and immutable review range, then perform a first-pass read-only adversarial review.
