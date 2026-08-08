# Implementation Evidence - R1D-PVB-D1A1B1-PAGE-SPATIAL-REFERENCE-REPAIR-ROUTING

**Status:** Claude Code independently returned technical PASS for the immutable implementation range, with zero BLOCKER, zero MAJOR, and two non-blocking MINORs. Codex records the external verdict and does not self-award independent technical PASS.

**Date:** 2026-08-08

**Exact base:** `3707dc82cb4f39e165d2ed88174e9c5319255828`

**Branch:** `codex/r1d-pvb-d1a1b1-page-spatial-reference-repair-routing`

**Worktree:** `C:\Users\guyna\.codex\worktrees\spatial1\Small_Heroes`

**External state/cost:** none / `$0`

## Starting evidence and root cause

The immediately preceding bounded live attempt completed one OpenAI response and produced no candidate. Its typed diagnostics contained exactly five unique `page_spatial_reference_outside_zone` issues:

| Page | Action index | Field role |
|---:|---:|---|
| 1 | 0 | `object` |
| 1 | 1 | `object` |
| 2 | 0 | `object` |
| 2 | 1 | `object` |
| 4 | 0 | `object` |

The compiler's page-zone check was correct: each spatial reference must select one exact node declared by that page's zone. The routing was not. `DraftAuthorityReferenceDomainError` escaped the bounded validation loop wholesale, even though this one closed issue family can be corrected by the descriptive author without changing compiler-owned zone authority.

The consumed attempt and its artifacts were not modified or retried. This milestone used no credential, network, provider, pricing, preflight, readiness, candidate, render, or downstream boundary.

## Implementation

- Added a closed type guard for repairable page-spatial issues. A nonempty issue set is eligible only when every normalized issue is `page_spatial_reference_outside_zone`, carries `page_spatial_selection`, and uses the existing page action or safety-constraint locator.
- Routed eligible issues into the existing bounded full-draft repair mode. No new call mode, budget, retry, fallback, model, schema, prompt authority, or persisted artifact version was introduced.
- Projected each eligible issue to the existing typed attempt identity `draft_contract / out_of_scope_reference`. Action issues retain page and action index; safety issues retain page and constraint index. The persisted locator vocabulary and JSON shape remain unchanged.
- Built repair instructions only from closed structural locator data. The rejected provider-authored identifier and raw provider/validator material are not copied into the diagnostic section or persisted attempt evidence.
- Kept all other `DraftAuthorityReferenceDomainError` families terminal. A mixed set is terminal even when it contains one otherwise repairable page-spatial issue.

## Direct and lifecycle proof

Direct compiler coverage proves:

- five simultaneous invalid page-zone selections trigger one full-draft repair and a valid second-call result;
- all five supported field roles route with sanitized structural instructions: `subject`, `object`, `spatialEffect.target`, `spatialConstraint.target`, and `safetyConstraints.target`;
- an empty or mixed issue set is not eligible;
- recurring-prop, action identity, relation, Set Board, and other deterministic authority issues still stop after the first provider result;
- persistent page-spatial errors consume at most the existing three logical calls and then fail as typed repair exhaustion;
- hostile rejected IDs do not appear in the repair diagnostic section.

The Visual Contract lifecycle test proves:

- exactly one initial call plus one `full_draft` repair;
- the first attempt records one sanitized `out_of_scope_reference` identity;
- the second attempt records the issue as resolved and creates a candidate;
- the current receipt persists, reloads, and preserves the exact attempt trail;
- neither the in-memory nor reloaded receipt contains the rejected provider-authored ID.

## Input-ceiling proof

The existing runtime rechecks every actual call against the unchanged `64,000` input ceiling using UTF-8 bytes plus a `4,096` protocol allowance. A new corpus regression assembles the full-draft repair input for the approved Fox authority with the exact five structural issue positions:

- repair system prompt: `2,768` bytes;
- repair user prompt: `42,304` bytes;
- serialized draft schema: `13,072` bytes;
- protocol allowance plus separators: `4,098` units;
- total conservative upper bound: `62,242`;
- headroom: `1,758`.

The existing all-18-source initial-prompt corpus proof remains green and retains more than `1,024` units of headroom for every approved Story Source. No ceiling, estimator, schema, or budget was changed.

## Validation

Focused ordinary phase:

- `draft-reference-domain-hardening.spec.ts`
- `draft-validation-diagnostics.spec.ts`
- `visual-contract-repair-loop.spec.ts`
- `visual-contract-prompt-table-compaction.spec.ts`
- `visual-contract-live-authoring.spec.ts`
- `source-authority-lifecycle.spec.ts`
- Result: **6 files / 144 tests passed** at up to four workers. Claude independently reproduced the exact file selection twice; the previously recorded `143` was a transcription error.

Focused canonical resource phase:

- `canonical-live-authoring-boundary.spec.ts`
- `live-request-materialization.spec.ts`
- `live-request-verification.spec.ts`
- Result: **3 files / 209 tests passed** at up to two workers.

The final persisted round-trip target passed independently within its containing lifecycle file. `npx --no-install tsc --noEmit` and `git diff --check` passed after the final edits.

Literal `npm run check` was invoked exactly once and was not retried:

- wall time: `149.4 s`; command exit `1`;
- TypeScript: passed;
- canonical inventory: `286` files;
- ordinary: `267` files, four workers, `36,981 ms`, exit `1`, exactly the six established missing ignored-output fixture assertions;
- resource-intensive: `19` files, two workers, `107,312 ms`, exit `0`;
- both diagnostic protocols valid, with no timeout, RPC/IPC, reporter, launch, signal, protocol, termination, or teardown failure;
- no seventh assertion occurred.

The six fixture failures remain a separate repository/release HOLD:

1. `child-lexicon-ages-5-8.spec.ts` - one missing ignored story fixture;
2. `momentum-gate-koko.spec.ts` - one missing ignored page-beats fixture;
3. `page-entity-qa.spec.ts` - one missing ignored image fixture;
4. `set-appearance-ref-budget.spec.ts` - one missing ignored board fixture;
5. `story-read-back-validation.spec.ts` - two missing ignored story fixtures.

This milestone neither waives nor repairs that release HOLD. It is accepted only as the already-approved limitation for the local LOW measurement path.

## Unchanged surfaces and rollback

Unchanged: prompt/schema authority, model, Responses endpoint, service tier, reasoning, 64K ceiling, max output, one-initial/two-repair budget, timeout, transport retries, fallback, pricing assumptions, `$4.884/$5.00` ceilings, candidate semantics, receipt/readiness versions, Blueprint/Wizard policy, renderer, storage, publication, and deployment.

Rollback is a clean revert of this milestone's implementation commit(s). That restores every `DraftAuthorityReferenceDomainError` to terminal behavior. Historical artifacts remain immutable and are not migration inputs or authority for a future attempt.

## Independent Claude Code QA

Claude Code independently reviewed exact immutable range `3707dc82cb4f39e165d2ed88174e9c5319255828..e569528a0bdf8aadc81e6b302551699bc700b8bf` read-only and returned **technical PASS**. Preconditions, topology, one-commit scope, clean `git diff --check`, and absent upstream/same-name origin ref all passed. Claude independently reproduced deterministic TypeScript, the exact six-file ordinary selection at **144 tests**, the exact three-file resource selection at **209 tests**, the `62,242` repair ceiling, persisted receipt round-trip, and an exhaustive 35-combination issue-catalog eligibility sweep.

Findings were zero BLOCKER, zero MAJOR, and two non-blocking MINORs:

1. The existing persisted diagnostic locator collapses multiple same-action page-spatial roles to `fieldRole: reference`. This can reduce `currentUniqueCount` granularity when subject/object/effect/constraint fail on the same action. The in-memory repair instruction still carries every closed role, aggregate emitted counts remain truthful, and successful repair/candidate behavior is unaffected. A fix would require separate locator/versioning hardening, so the limitation is explicitly accepted for the bounded LOW measurement and deferred rather than expanding this milestone.
2. Codex's ordinary focused count was transcribed as `143`; Claude's two exact reruns proved `144`. This document and `CURRENT.md` correct the record without changing code, tests, or authority.

Claude's advisories are retained:

- **A1:** invalid/non-positive page-number handling can still terminate as local processing through code byte-identical to the base. It is pre-existing and does not reintroduce the preceding milestone's persisted-locator defect.
- **A2:** the eligibility guard redundantly rechecks catalog-enforced reference class and locator kind. This is intentional defense-in-depth.
- **A3:** Claude did not run literal `npm run check`. The `286/267/19`, exact-six-fixture, and no-seventh-failure claims remain Codex execution evidence; the separate repository/release HOLD remains unchanged.

This independent PASS is implementation-range technical acceptance only. It grants no product, visual, candidate, Blueprint, Wizard, render, release, deployment, or push acceptance. No further Claude round is required unless this documentation transcription is factually disputed.
