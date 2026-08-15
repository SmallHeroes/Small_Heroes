# R1D Post-Repair Mixed Validation Routing — Implementation Evidence

**Status:** local implementation green; independent Claude Code QA pending
**Base:** `9d0504a78048c7daff2ec5c7b12de17aecb2b532`
**Branch:** `codex/r1d-post-repair-mixed-validation-routing`
**Worktree:** `C:\Users\guyna\.codex\worktrees\spotlightlion1\Small_Heroes`

## Problem evidence

Two separate, consumed Leo three-page QA authoring authorities ended with the same sanitized post-repair signature:

- Attempt v3 completed the initial response and one `page_contract_patch`, then stopped as `local_processing_failed / unexpected_local_failure`.
- Attempt v4 completed the initial response and one `page_spatial_reference_patch`, then stopped with the same terminal.
- Each receipt contains two completed logical provider calls, one repair, zero transport retries and no fallback.
- Combined conservative authoring accounting is approximately `$2.101603`.
- Both candidates are absent. Semantic Reconciliation, Blueprint, Wizard image dispatch and render authority are absent.
- Raw prompt, response, provider message, stack and credential value were neither persisted nor reconstructed.

The matching boundary strongly indicated a local post-compact-repair failure rather than a provider transport failure. Repository investigation traced the exact escape:

1. The initial draft fails in a compact page-repairable way.
2. Applying that patch exposes a closed Action Semantic capability gap together with a non-page-local final structural validation error.
3. Assembly wraps that pair in `PresentationStructuralValidationError`.
4. The page-local combined planner correctly returns no authority for the mixed global failure.
5. The compiler catch rethrows the nested `InvalidTemplateContractError` from inside the catch, escaping its own bounded repair loop.
6. The lifecycle has no typed classification for that escaped internal validation object and therefore correctly emits the sanitized generic local terminal seen in both live receipts.

## Red-to-green proof

A deterministic fake-provider regression models a page-spatial reference failure that masks a later mixed capability/structural failure. Before the production correction it failed exactly as expected:

- receipt status `failed`;
- `callCount: 2`;
- `repairCount: 1`;
- `draftValidationStatus: interrupted`;
- terminal `local_processing_failed / unexpected_local_failure`.

After the correction the same test passes with:

- receipt status `completed`;
- `callCount: 3`;
- `repairCount: 2`;
- repair modes `[null, page_spatial_reference_patch, full_draft]`;
- the intermediate diagnostic trail containing both `draft_contract` and `action_semantic` families, including `closed_catalog_capability_gap`;
- a zero-current-issue final diagnostic state;
- a content-addressed candidate digest;
- no rejected provider-authored spatial identifier in the sanitized receipt.

## Implementation

`compileBookVisualContractTemplate` no longer rethrows the nested structural error merely because mixed diagnostics cannot form a page-only repair. It keeps the existing structural and capability diagnostics, clears the compact presentation target, and lets the already-existing deterministic routing choose among structural bundle, page contract and finally full-draft repair. For this mixed non-page-local case, the existing full-draft lane is selected.

Unchanged invariants:

- one initial provider call plus at most two repairs;
- no transport retry and no fallback for this authoring flow;
- unchanged model, service tier, schema, prompts, token ceiling, timeouts and cost cap;
- page-local compact presentation/structural repair remains preferred when safe;
- a capability gap with no valid presentation-requirement target remains terminal;
- unknown local exceptions and unusable provider outputs remain terminal;
- prior receipts/readiness/output artifacts remain immutable.

## Baseline assertion correction

The focused suite exposed a pre-existing assertion in `visual-contract-live-authoring.spec.ts` that still expected `SOURCE_EVIDENCE_CATALOG_PROMPT_COLUMNS` in the initial prompt. Base commit `9d0504a7` intentionally changed that surface to `COMPLETE_STORY_SOURCE_PROMPT_COLUMNS`, omitting compiler-owned byte offsets while preserving ordered complete prose. The test now asserts the actual v13 initial-prompt contract. This is test-only alignment and changes no provider behavior.

## Validation

### Focused

- Red regression before implementation: **1 file / 1 test failed**, reproducing two calls, one repair and `local_processing_failed`.
- Same direct regression after implementation: **1 file / 1 test passed**.
- Related compiler/lifecycle set: **6 files / 174 tests passed**.
- `npx --no-install tsc --noEmit`: **PASS**.
- `git diff --check`: **PASS**.

### Repository gate

`npm run check` was invoked exactly once and completed in approximately 160 seconds:

- application TypeScript: PASS;
- autonomous-story TypeScript: PASS;
- canonical inventory: 299 specs;
- ordinary phase: 280 specs, exit 1 only for the exact six established missing-output fixture assertions;
- resource-intensive phase: 19 specs, PASS, valid diagnostic protocol, no timeout/RPC/IPC/reporter/launch/signal/teardown failure;
- no seventh assertion failure.

The six known failures remain a separate repository/release HOLD:

1. `child-lexicon-ages-5-8.spec.ts` — missing Sprint 11 story output.
2. `momentum-gate-koko.spec.ts` — missing Koko page-beats output.
3. `page-entity-qa.spec.ts` — missing Style01 PNG output.
4. `set-appearance-ref-budget.spec.ts` — missing Set Appearance Board output.
5. `story-read-back-validation.spec.ts` truncated control — missing story-pages output.
6. `story-read-back-validation.spec.ts` complete control — missing story output.

They are not implementation findings in this range and grant no release waiver.

## Boundary evidence

- Credential access: none.
- Provider calls: 0.
- Image calls/renders: 0.
- Fresh Readiness/preflight/live invocation: none.
- Storage/database writes: none.
- QA deployment/alias movement: none.
- Production action: none.
- External cost: `$0`.

## Review targets

Claude Code should attempt to falsify:

1. the exact red-to-green reproduction of the two-call generic failure;
2. selection of existing full-draft repair only when no safe page-local authority exists;
3. retention of the three-call/two-repair ceiling;
4. unchanged compact repair preference for page-local cases;
5. unchanged terminal behavior for unrepresentable capability gaps and unknown local errors;
6. complete mixed typed diagnostic evidence without raw provider material;
7. absence of Leo/story/child/companion/page literals;
8. correctness and narrowness of the prompt-v13 test-only assertion alignment;
9. exact repository-gate accounting and separation of the six-fixture release HOLD;
10. absence of credential, provider, image, deployment and Production activity.

Codex records its implementation evidence but does not self-award independent technical PASS.
