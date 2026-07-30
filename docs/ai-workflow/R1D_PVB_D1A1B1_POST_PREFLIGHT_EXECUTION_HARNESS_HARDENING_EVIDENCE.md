# R1D-PVB-D1A1B1 Post-Preflight Execution Harness Hardening — implementation evidence

## Status and immutable scope

- Milestone: `R1D-PVB-D1A1B1-POST-PREFLIGHT-EXECUTION-HARNESS-HARDENING`
- Worktree: `C:\Users\guyna\.codex\worktrees\0ea6\Small_Heroes`
- Branch: `codex/r1d-pvb-d1a1b1-post-preflight-execution-harness-hardening`
- Immutable base: `6442e6ff4b45821ee53c1f20e4f29321390b6eec`
- Implementation commit: `e72d3451a3b227d405d538d96d6165bde15a24ed`
- Gate: **HOLD pending independent first-pass READ-ONLY Claude Code review**
- Cost: `$0`

The task had sole-writer authority only in this worktree and branch. All other worktrees were treated as read-only evidence. The implementation commit was created locally and was not pushed.

## Root cause addressed

The exhausted diagnostic live attempt passed its one canonical import preflight and the existing canonical B0 verifier, then failed before any post-preflight check because a hand-authored inline PowerShell harness had a parse error. No credential was loaded and no live child was spawned. This milestone replaces that fragile orchestration class with a canonical repository-owned Node execution supervisor. It does not revive, correct, or rerun the exhausted attempt.

## Additive architecture

The implementation adds:

- `canonical-live-execution-request/v1`
- `canonical-live-execution-readiness/v1`
- fixed `canonical-live-execution-probe/v1`
- a strict public supervisor launcher with only `verify` and future `live` modes
- one story-neutral TypeScript readiness and process-running core
- one fixed local probe child
- deterministic boundary and regression tests

The request binds:

- repository root and exact branch/HEAD expectations;
- tracked and untracked cleanliness;
- explicit refs and left/right divergence expectations;
- exact canonical B0 manifest path, byte length, SHA-256, and canonical identity;
- explicit preservation files with byte length and SHA-256;
- explicit configured paths that must remain absent;
- an exact credential source and isolation policy without any secret value;
- the exact `futureLiveCommand` executable, argv, and identity.

Requests and readiness evidence exclude secret values, raw prompts/responses, arbitrary command text, and story literals. Output is canonicalized and digested over a versioned payload domain. Readiness reasons are fixed, bounded, and sanitized.

## Sole B0 authority

The readiness core calls the existing `verifyCanonicalLiveRequestBundle`. That function remains the sole authority for the B0 bundle, including payload-domain digests, Story Source, request/prompt/schema/model/service-tier policy, timeout, call and repair budgets, retry/fallback policy, and `futureLiveCommand`.

The supervisor does not duplicate those validations. After the existing verifier succeeds, it reads the already-verified manifest only to obtain and compare the exact executable and argv identity used by the future child.

No existing authoring launcher, verifier, B0 artifact, schema, Story Source, request, prompt, model, timeout, budget, retry/fallback policy, or `futureLiveCommand` changed.

## Readiness and filesystem fences

Git checks use fixed no-shell spawn calls and exact argv. They verify:

- repository top-level identity;
- symbolic branch;
- exact HEAD;
- tracked and untracked cleanliness through porcelain v2;
- each explicitly declared ref;
- explicit left/right divergence.

Git commands receive a minimal environment with optional locks disabled. Spawn error, signal, nonstandard exit, and bounded-output failures are fail-closed and sanitized.

Preservation fences:

- accept only explicit repository-contained relative file paths;
- reject absolute paths, traversal, globs, empty/noncanonical components, case or separator aliases, and duplicate normalized paths;
- reject symlink and junction escape;
- reject hard links;
- open and hash the same file descriptor;
- verify byte length and SHA-256;
- recheck file identity after reading to detect replacement races.

Expected-absence paths use the same containment and canonicalization rules and fail if the configured artifact exists. Shared code contains no story-specific path list or story literal.

## Verify boundary

`verify` performs only request parsing, canonical validation, local Git inspection, local explicit-file inspection, and the existing read-only B0 verification. It does not:

- read or check the real credential source;
- inspect `OPENAI_API_KEY`;
- spawn the authoring child;
- invoke preflight;
- reach provider, network, storage, database, or application write boundaries.

Tests put throwing sentinels around credential, provider, network, storage, database, and write surfaces. Verify succeeds without touching them, and positive controls prove the sentinels would fail if invoked.

## Future live boundary

No real `live` execution occurred. The future path was tested only with fake keys, fake children, local temporary repositories, and injected process-runner boundaries.

The future path:

1. rejects ambient `OPENAI_API_KEY`;
2. runs the same readiness core;
3. only after readiness passes, reads exactly one line-start `OPENAI_API_KEY=` assignment from the declared source;
4. constructs a minimal platform-aware allowlisted child environment;
5. spawns only the exact verified manifest command with `process.execPath`, exact argv, `shell:false`, and `windowsHide:true`;
6. clears credential authority immediately after the synchronous spawn boundary and before waiting for child completion;
7. performs no retry or fallback;
8. propagates child spawn errors, signals, nonstandard exits, and bounded-output failures through sanitized results.

Credential-source buffers and captured child output buffers are zeroed. Results do not contain the secret, raw output, raw error, raw command, or unrelated environment values.

## Fixed zero-cost probe

The probe uses the same child-process runner but has a fixed repository-owned script, fixed allowed behaviors, and no caller-supplied executable, argv, environment, credential, prompt, or story data. It tests:

- Windows paths with spaces and Unicode;
- exact argv;
- environment isolation;
- bounded and sanitized output;
- normal exit;
- nonstandard exit;
- signal;
- spawn error;
- fail-closed handling.

The safe difference is explicit: the probe can only run the fixed synthetic local child and cannot reach network/provider/write boundaries. A future real live child is the exact manifest `futureLiveCommand` and is allowed to cross the authoring boundary only after separate authorization, readiness, preflight sequence, and post-gate credential access.

## Validation evidence

Dependency preparation was local/offline:

- `npm ci --offline --ignore-scripts --no-audit --no-fund`
- local Prisma client generation with installed Prisma `6.19.3`

Observed exact local versions included TypeScript `6.0.3`, tsx `4.22.2`, Vitest `3.2.4`, OpenAI `6.35.0`, and Prisma/Prisma Client `6.19.3`. `package.json` and `package-lock.json` were unchanged.

Focused commands and results:

```powershell
node node_modules/vitest/vitest.mjs run lib/visual-package/__tests__/live-execution-supervisor.spec.ts
# PASS — 1 file / 31 tests

node node_modules/vitest/vitest.mjs run lib/visual-package/__tests__/live-request-materialization.spec.ts lib/visual-package/__tests__/live-request-verification.spec.ts lib/visual-package/__tests__/canonical-live-authoring-launcher.spec.ts lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts
# PASS — 5 files / 263 tests

node node_modules/typescript/lib/tsc.js --noEmit --project tsconfig.json --incremental false
# PASS
```

Focused total: **6 files / 294 tests PASS**.

The single permitted repository-wide command was run literally once:

```powershell
npm run check
```

It completed TypeScript and Vitest in 76 seconds. Its only failures were the six established ignored-output-fixture failures:

1. `child-lexicon-ages-5-8.spec.ts` — one missing ignored story file
2. `momentum-gate-koko.spec.ts` — one missing ignored beat file
3. `page-entity-qa.spec.ts` — one missing ignored PNG
4. `set-appearance-ref-budget.spec.ts` — one missing ignored appearance-board file
5. `story-read-back-validation.spec.ts` — two missing ignored story files

There was no timeout, no new failure, no retry, skip, global timeout change, or assertion weakening.

The full check created four known scratch output files plus `tsconfig.tsbuildinfo`; each was removed by exact path. Four pre-existing ignored files under `outputs/` were inventoried before the run and preserved byte-for-byte using their original SHA-256 identities.

## Explicit non-actions and limitations

This milestone did not run canonical import preflight. It did not inspect, presence-check, load, copy, print, hash, or pass a real credential. It made no pricing lookup, external network/provider/model call, live authoring call, render/image/Vision/audio call, storage/database/Supabase call, Board action, Semantic Reconciliation action, approval, candidate/Blueprint/package publication, promotion, activation, deployment, or push.

The future `live` path is implemented and deterministically tested, but remains unauthorized and unproven against a real credential/provider. The fixed probe validates process mechanics only; it is not a provider, preflight, B0, Blueprint, readiness, product, or visual attestation.

Rollback is reverting this milestone's commits and removing only exact ignored local artifacts created by this task. The four pre-existing ignored output files are outside rollback scope.

Codex does not self-award independent technical PASS. First-pass Claude Code review must begin by reconciling the exact branch, worktree, base, head, dirty state, and immutable review range before assessing the implementation.
