# R1D-PVB-D1A1B1-ATTEMPT-3-READINESS evidence

**Recorded:** 2026-07-28T14:59:26.2080615+03:00
**Status:** HOLD — readiness stopped at the first nonzero full validation result
**Worktree:** `C:\Users\guyna\.codex\worktrees\4a16\Small_Heroes`
**Branch:** `codex/r1d-pvb-d1a1b1-live-authoring-attempt`
**Approved start:** `6d29fc6e8e66b839e0d08ea7057fff7793f235bc`

This is a sanitized local execution record. It intentionally excludes raw command output, stack traces, environment values, credentials, prompts, provider content, and ignored generated files.

## Authority and topology

- The live worktree began clean at exact `HEAD` and local origin `6d29fc6e8e66b839e0d08ea7057fff7793f235bc`, with `0/0` parity.
- Exactly one worktree owned the live branch. Main and `feat/chunked-generation` retained their pre-existing user state. B0 and B1A remained clean read-only evidence worktrees.
- No remote refresh was performed; the no-network boundary remained in force.

## Sanitized command and result transcript

1. The existing `node_modules` entry was rechecked immediately before removal. It was a Windows `Junction` inside the live worktree whose exact target was `C:\GNart\Work\Small_Heroes\node_modules`. The target was a real non-reparse directory.
2. Only the junction entry was removed with non-recursive directory-link deletion. The target remained present, and the target TypeScript package hash remained unchanged at SHA-256 `9332e97c30d3e53ed54910b89207ed657fb444066484df6e5b6965bf130865e9`.
3. `npm ci --offline --ignore-scripts` ran exactly once and exited `0` after a tool-reported 66.3 seconds. It installed 200 packages, audited 201 packages, and reported zero vulnerabilities. No install script ran and no registry/network fallback was used.
4. The resulting `node_modules` is a real local directory, not a reparse point. Its own `.bin` contains the local Prisma, TypeScript, and Vitest launchers. The committed inputs remained exact:
   - `package.json`: SHA-256 `19ac6d7a01d5ac8c8f4ff16d0d7b57c5781a125d2d3ec3af43b6983fff082f7d`
   - `package-lock.json`: SHA-256 `bf7932428ac1bc2cb8885e83a21f231486f35ea36820381b7d1763a77ba03d59`
5. `node node_modules/prisma/build/index.js generate --schema backend/schema.prisma` ran with Prisma update/checkpoint messaging disabled, exited `0`, and generated Prisma Client `6.19.3` locally in 335 ms. It did not access a database.
6. The isolated launchers reported TypeScript `6.0.3` and Vitest `3.2.4`. `node node_modules/typescript/lib/tsc.js --noEmit` exited `0`.
7. The exact local Vitest entrypoint ran seven focused authoring/readiness files. Result: **7 files / 226 tests PASS**, covering the canonical live boundary and launcher, B0 materialization, source authority, legacy fail-closed paths, production lifecycle, and Visual Contract compiler.
8. Because the isolated `.bin` environment was proven, the literal `npm run check` ran once. Its TypeScript phase passed. Vitest then exited `1` with seven failed tests in six files:
   - Six failures in the five established ignored-output fixture files: `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two cases in `story-read-back-validation.spec.ts`.
   - One additional 5-second full-load timeout in `delivery-input-writer-coverage.spec.ts`.
9. The explicit fail-closed rule stopped readiness at that nonzero result. The full check was not rerun, the timeout was not reclassified through an isolated rerun, and no correction or fixture import was attempted.

## Stop effects and evidence limits

- None of the four approved B0 artifacts was copied into the live worktree. Their exact intended live paths remain absent.
- Canonical B0 payload-domain validation, Story Source rebuild, cross-artifact verification, and canonical authoring preflight were not run.
- No Attempt 3 credential or live-call authority was reached or granted.
- The isolated `node_modules` tree, generated Prisma client, and any ordinary test scratch remain ignored local state for same-worktree QA. No package manifest, lockfile, source, schema, test, config, pricing, request, or B0 authority changed.
- Credential reads or existence checks, provider/model calls, pricing lookup, registry fallback, render/Vision, storage/database, Board, reconciliation, approval/publication/promotion, production activation, deployment, push, and spend were all zero.

## Gate

R1D-PVB-D1A1B1-ATTEMPT-3-READINESS is **HOLD / stopped before B0 preparation and canonical preflight**. This evidence grants no authority to rerun validation, prepare B0 inputs, execute preflight, load credentials, or begin Attempt 3. Independent read-only QA and a new explicit Guy ruling are required before any further action.
