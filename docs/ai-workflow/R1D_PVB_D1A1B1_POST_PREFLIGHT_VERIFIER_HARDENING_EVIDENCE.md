# R1D-PVB-D1A1B1 post-preflight verifier hardening evidence

**Recorded:** 2026-07-29
**Status:** local implementation complete; independent first-pass QA pending
**Approved start:** `36f88f62c69b86237f7af322a0660ab37f09723f`
**Implementation commit:** `d651a43a9105fb6f0f30537133eeb6d1b95ed32b`
**Worktree:** `C:\Users\guyna\.codex\worktrees\2ad5\Small_Heroes`
**Branch:** `codex/r1d-pvb-d1a1b1-attempt-3`
**Cost:** `$0.00`

This record is sanitized. It contains no credential value or existence result, raw prompt/response, hidden reasoning, provider payload, raw exception stack, or external reachability claim.

## Topology and authority

- Before mutation, local `HEAD`, the configured upstream, and origin all resolved to exact `36f88f62c69b86237f7af322a0660ab37f09723f` at `0/0` parity.
- The tracked and nonignored-untracked worktree was clean. Exactly one worktree owned `codex/r1d-pvb-d1a1b1-attempt-3`; all relevant source/B0/previous execution worktrees remained clean and read-only.
- The existing dependency tree was a real directory from the preserved offline Attempt-3 installation. `package.json` and `package-lock.json` remained byte-identical to their approved identities.
- The five ignored Attempt-3 files were inventoried before and after work. Their sizes and SHA-256 byte identities remained:
  - materialization input: 335 bytes, `a95b34083abce1064b20f7f37f860a504f5db0a2dea2eb4680b5f70e784c2bf9`
  - source-authority request: 349 bytes, `9d0329cfb81ba48e4a93f9ca81e793d0e65619dd20d9553c0662a02126b7ac52`
  - source snapshot: 29,125 bytes, `bdedc40c645c949bece8278ecf45e515e242eb957d1e85b9882605628216def0`
  - live request: 2,432 bytes, `73289fcf62fd339aa2fb8a69100fa83333025d4dbc706875ed451b35db0aa505`
  - manifest: 3,376 bytes, `95d3e2d4293d191f0a4bf013bd53922b282e026083ff8b3b9b4ec9cd00a2427e`

These byte hashes are inventory evidence only. Canonical authority remains each artifact's schema-defined payload-domain digest.

## Implemented contract

- Library entrypoint: `verifyCanonicalLiveRequestBundle({ repoRoot, manifestPath })`.
- CLI shape:

  ```text
  node node_modules/tsx/dist/cli.mjs --require scripts/shims/register-server-only.cjs scripts/production-visual-lifecycle.ts source-authoring-live-request-verify --repo-root <absolute-repository-root> --manifest <repository-relative-manifest>
  ```

- Public flags: exactly `--repo-root` and `--manifest`, separate-value form only.
- Success version/status: `canonical-live-request-verification/v1`, `verified`, `zeroWrite: true`.
- Failure version/status: same version, `rejected`, `zeroWrite: true`, stable bounded `reasonCodes`, nonzero child exit.
- Derived inputs: source-authority request, source snapshot, live authoring request, common output root, and expected future live command all come from the validated manifest.
- Exact request fence: OpenAI Responses, `gpt-5.6-sol`, `default`, `medium`, three calls, two repairs, zero transport retries, no fallback, reservation `<= $4.884`, ceiling `= $5.00`.

## Validation transcript

1. Direct deterministic TypeScript:

   ```text
   node node_modules/typescript/bin/tsc --noEmit
   ```

   Result: **PASS**.

2. Initial focused materializer/verifier run:

   ```text
   node node_modules/vitest/vitest.mjs run lib/visual-package/__tests__/live-request-materialization.spec.ts lib/visual-package/__tests__/live-request-verification.spec.ts
   ```

   Result: **57 passed / 10 failed**. The failures were confined to two test-harness assumptions: the four-page fixture's correct `$4.488` reservation was expected as the 12-page `$4.884` maximum, and the write sentinel activated before tsx completed its own cache-directory setup. Every executed artifact, policy, digest, linkage, source-mutation, and path rejection behaved as intended.

3. Corrections:
   - Use a general 12-page synthetic story to exercise the approved maximum reservation.
   - Preserve the write sentinel but allow calls whose captured stack is inside the exact installed tsx runtime. Application writes still throw, positive controls prove the throw, and a complete synthetic repository file-tree identity is compared before/after the real verifier process.

4. Final focused run, same exact command: **2 files / 68 tests PASS**.

5. One literal full check:

   ```text
   npm run check
   ```

   This command ran exactly once and was not rerun. TypeScript **PASS**. Vitest completed without timeout or new failure. It reproduced exactly six established missing ignored-output fixture failures in five files:
   - `lib/__tests__/child-lexicon-ages-5-8.spec.ts`
   - `lib/__tests__/momentum-gate-koko.spec.ts`
   - `lib/__tests__/page-entity-qa.spec.ts`
   - `lib/__tests__/set-appearance-ref-budget.spec.ts`
   - `lib/__tests__/story-read-back-validation.spec.ts` (two cases)

   The new verifier suite and changed materializer suite passed under full-suite load. No missing fixture was copied, fabricated, or imported.

6. `git diff --check`: **PASS** before the implementation commit.

## Adversarial coverage

- Positive controls prove credential existence/read, provider-module import, network fetch, and application filesystem write boundaries throw.
- The real production lifecycle script runs through exact local tsx plus the server-only shim while those boundaries are active.
- Success validates all four canonical files and preserves the synthetic tree byte-for-byte.
- Failure coverage includes malformed/stale manifest, source request, source snapshot, and live request; noncanonical bytes; non-JSON canonical domain; current Story Source mutation; wrong payload digest; wrong descriptor/linkage; wrong live mode; provider/model/tier/reasoning/call/repair/retry/fallback policy; reservation and hard ceiling; substituted future command; missing artifact; public and manifest path escape; alias/symlink behavior where supported; malformed CLI input; and deterministic repeated sanitized failure.
- Two-root materialization proves portable source-snapshot/live-request identities and distinct worktree-bound source-authority/manifest identities.
- Shared implementation contains no selected story, child, companion, or page literal.

## Cleanup and exclusions

- Current-run ignored files were selected only by post-run timestamps, inspected, and deleted by explicit file path. This removed two synthetic QA-anchor files, two story-read-back scratch files, three generated Story QA log bundles, the Vitest result cache, and `tsconfig.tsbuildinfo`. The shell rejected the initial recursive cleanup command before mutation; the completed cleanup used explicit file deletion only. Historical Attempt-3 evidence was preserved and rehashed afterward.
- Empty ignored directories may remain; they contain no artifact and do not appear in Git status.
- No canonical preflight, actual Attempt-3 verifier execution, pricing or network lookup, credential read/check, provider/model call, live authoring, render/image/Vision, storage/database/Supabase, Board action, Semantic Reconciliation, approval, Blueprint/package publication or promotion, production activation, deployment, or push occurred.
- Provider calls: `0`; model calls: `0`; semantic repairs: `0`; transport retries: `0`; cost: `$0.00`.

## Gate

The corrective implementation is locally complete and committed, but Codex does not self-award independent technical PASS. Claude Code must review the final immutable base-to-head range read-only and attempt to falsify the verifier's containment, schema/byte/digest/linkage, current-source, policy/cost/command, sanitization, and zero-boundary claims. Attempt 3 remains exhausted and no verifier/preflight/live retry is authorized.
