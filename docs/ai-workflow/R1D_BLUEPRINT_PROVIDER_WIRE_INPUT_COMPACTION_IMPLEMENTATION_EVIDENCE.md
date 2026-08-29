# R1D Blueprint Provider-Wire Input Compaction — Implementation Evidence

Status: offline implementation complete; independent Claude Code re-gate PASS. This evidence grants no live/provider/render authority by itself.

## Problem and root cause

The first bounded Blueprint execution terminated before dispatch with `input_token_ceiling_exceeded`: 188,654 estimated input bytes against the unchanged 64,000-byte conservative ceiling. Its receipt proves zero logical provider calls, zero transport dispatches and $0 provider spend. The authoring prompt had serialized complete canonical artifacts, including full reconciliation evidence that is required for offline validation but is not provider instruction authority.

The repair path had the same structural risk: a complete invalid draft plus a large complete diagnostic census could exceed the input ceiling before a second call.

## Implemented boundary

- `preRenderBlueprintProviderWire.ts` projects validated canonical context into a deterministic compact initial wire and a compact repair wire. The complete canonical context remains in memory for deterministic overlay and full validation.
- Provider-visible free prose uses the existing provider-safe spatial projectors. Canonical IDs remain structured internal authority; unresolved `[spatial:id]` markers fail closed instead of crossing the provider boundary.
- Initial prompt admission is computed from the exact system prompt, exact projected user prompt, strict output schema, separators and the unchanged 4,096-byte protocol allowance. Both preflight and direct execution reject an oversized initial prompt before provider or credential reachability.
- Repair diagnostics are grouped only when their complete identity is identical. Code, field, message, expected-value presence/value, actual-value presence/value and multiplicity remain explicit. Missing values and explicit `null` remain distinct.
- A repair prompt is accounted before the next `callAuthor`. If it exceeds 64,000 bytes, `PreRenderBlueprintRepairInputNotAdmissibleError` stops the loop, preserves the full sanitized local attempt census, maps to the existing closed terminal code `repair_route_input_not_admissible`, and performs no second provider call.
- New authoring and repair records use prompt v6. Existing v5 Blueprint/package provenance remains accepted without rewriting old artifacts. Provenance shape/version remains v4.
- `projectContractProse.ts` now declares the exact common structural interface used by both authored Templates and resolved contracts; its runtime projector behavior is unchanged.
- `tsconfig.json` excludes ignored runtime `outputs/` diagnostics from `tsc`. Vitest runtime fixture behavior is unchanged.

## Exact approved-context census

Read-only scripts loaded the approved eight-page corrected Chameleon Production Context from:

`outputs/r1d-lantern-fresh-readiness-20260829T155643118Z/corrected-bridge/bridge-manifests/fd13940822593c6ecf81b64af907389dad219297cd52ecde43985b6d0603ed9d.json`

No credential, provider, network or write boundary was reached.

| Surface | System | User | Schema | Separators | Protocol | Total | Headroom |
|---|---:|---:|---:|---:|---:|---:|---:|
| Initial | 2,144 | 34,995 | 20,753 | 2 | 4,096 | 61,990 | 2,010 |
| Representative repair | 2,290 | 35,413 | 20,753 | 2 | 4,096 | 62,554 | 1,446 |

Both provider surfaces contain zero `[spatial:` markers. The representative historical provider-owned draft shrank from 46,554 raw JSON bytes to 26,041 compact draft bytes; the repair authority index is 9,011 bytes.

## Hostile repair proof

A real-context draft was made invalid across all nine frames, surfacing 347 complete validation issues across nine codes and 263 code/field pairs. The exact repair input would be 111,706 bytes. The compiler:

- called the injected provider exactly once;
- retained all 347 local diagnostics;
- rejected the repair as non-admissible;
- never dispatched call two.

Tracked regressions independently prove the same one-call property with a large schema-valid draft field and prove that identical diagnostics collapse while different causes and absent-versus-explicit-null values remain separate.

## Policy and artifact preservation

Unchanged: model `gpt-5.6-sol`, reasoning `medium`, strict draft schema, 48,000 max output tokens, 64,000 max input bytes, three calls, two repairs, $5 hard ceiling, zero transport retries, no fallback, provider/storage policy and per-page resemblance threshold. No Story Source, Visual Contract, reconciliation, Candidate, Blueprint, Board, package, approval, locator or render artifact was changed.

Provider/image/audio/network/database/deployment operations in this milestone: zero. The prior consumed request remains immutable and cannot be replayed.

## Validation

- `npx --no-install tsc --noEmit`: PASS.
- Direct compiler/runner admission battery: 2 files, 71/71 PASS.
- Blueprint authoring/lifecycle/runner/Wizard/adapter focused battery: 5 files, 133/133 PASS after the final lossless-null distinction.
- `git diff --check`: PASS.
- Literal `npm run check` is honestly red on the established repository baseline/infrastructure:
  - ordinary phase: 4,046 PASS, 9 ENOENT/lstat failures in five unchanged specs that read absent ignored historical `outputs/` fixtures, 73 skipped;
  - resource-intensive phase: 615 PASS and 17 timeout-only failures in five unchanged Git/subprocess-heavy specs, plus four known `onTaskUpdate` RPC timeouts.
- Claude Code independently inspected the diff/import graph and classified the ordinary failures as the documented fixture baseline and the resource failures as test-infrastructure contention, not a changed hot path. It issued GO to commit. Follow-up fresh-process runs produced only the same near-threshold 5.27–7.48-second timeouts against a fixed five-second ceiling, with no semantic assertion failure and no hang above twice the limit; two previously red files passed fully (29/29 combined).

## Independent QA falsification targets

Claude Code should review the complete focused range, not only changed lines, and try to falsify:

1. loss of provider-required story/world/cast/wardrobe/companion/prop/spatial/action/safety/transition authority;
2. internal marker leakage or prose that no longer binds canonical IDs;
3. initial preflight/execution prompt-accounting mismatch or any provider/credential/write reachability before rejection;
4. repair grouping that hides a distinct diagnostic cause, including missing versus explicit `null`;
5. a second provider call after repair input becomes non-admissible;
6. raw invalid draft/prompt/secret material in persisted receipts;
7. v5 legacy artifact rejection or silent provenance upgrade;
8. policy/model/schema/budget/retry/fallback/Candidate/Wizard/render drift;
9. story-, child-, companion- or page-specific behavior.

No live authoring should run before that independent PASS.

## Independent QA result

Claude Code independently reviewed immutable range `02fd2a7a47e864da3ec4dd3bcbfb420556eaf994..7c6b9e1bb30a771c0d14e0d4744f145547a54020` and returned **PASS (technical only)** with zero BLOCKER and zero MAJOR findings. It verified one commit, zero merges, 12 files, clean worktree and exact one-commit local divergence; independently ran TypeScript, the 71/71 admission subset and 10/10 legacy lifecycle tests; and accepted all eleven implementation claims.

Two non-blocking observations remain explicit:

- repair `source_phenomenon` subjects retain their canonical evidence ID but do not resend the already-bound source phrase;
- a malformed non-`worldPlan` draft passes through the compact-draft helper unchanged, but exact admission and marker checks still stop it before call two when oversized or unsafe.

Neither observation creates a provider, validation, receipt or legacy bypass. The PASS allows Codex to consider a fresh bounded live attempt only against Guy's separate standing authorization and a newly satisfied Fresh Readiness gate.
