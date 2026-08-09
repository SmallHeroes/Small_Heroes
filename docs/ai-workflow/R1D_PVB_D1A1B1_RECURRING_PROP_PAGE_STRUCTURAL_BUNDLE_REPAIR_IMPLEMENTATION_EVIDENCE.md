# R1D-PVB-D1A1B1 Recurring-Prop Page Structural Bundle Repair - Implementation Evidence

Date: `2026-08-10`

Status: **independent technical PASS on the original implementation; focused MINOR correction pending micro re-gate; repository/release HOLD at the established six-fixture baseline**

Decision Gate: `docs/ai-workflow/R1D_PVB_D1A1B1_RECURRING_PROP_PAGE_STRUCTURAL_BUNDLE_REPAIR_DECISION_GATE.md`

Worktree: `C:\Users\guyna\.codex\worktrees\structbundle1\Small_Heroes`

Branch: `codex/r1d-pvb-d1a1b1-structural-bundle-repair`

Exact base: `ed7580a6d4ffe0159799821d7d067d883d34f8b6`

Green commits before this final test/evidence commit:

1. `1a9c309858075b8b4b694550d581bc2c9b676250` - strict structural-bundle schema, authority selection, sanitized prompt, parser, exact application and direct tests;
2. `2175b11d04979dceb3db52a8c0c3939a6679fdb4` - compiler routing, lifecycle dispatch, adapter support, canonical materialization, Execution Supervisor and Fresh Readiness authority cutovers.

External cost: `$0`.

## Outcome

The implementation adds one closed repair mode, `structural_bundle_patch`, for the exact failure family observed after the successful field-scoped spatial repair:

- at least one `draft_contract / final_structural_invariant_invalid / final_structure` issue at the `recurring_props` collection;
- at least one issue with the same family/code/field role at an exact positive page identity;
- no other issue family, code, locator class, or field role.

Page-only structural failures remain on the existing `page_contract_patch`. Unsupported or mixed classes retain the existing fail-closed route. The new router contains no story, page, child, companion, or authored-value literal.

The repair response is an exact strict object:

- `recurringProps`: the complete current recurring-prop set, with exact existing IDs;
- `pageContracts`: complete contracts for exactly the affected page numbers.

The provider does not receive the Story Source, previous full draft, raw provider material, credentials, or unrelated global fields. Its bounded authority is limited to current recurring props, affected pages, sanitized local validation messages, and compiler-owned location/zone/cast/spatial-reference IDs. Validation messages are normalized, deduplicated, sorted, length-bounded, count-bounded, and secret-pattern rejected.

Application is clone-first and fail-closed. It rejects extra, missing, duplicate, renamed or stale prop/page identities; rejects non-exact schema keys; replaces only the recurring-prop collection and selected page leaves; proves the rest of the draft canonically unchanged; and then re-enters the complete compiler/validator pipeline. Candidate semantics are unchanged.

## Three-call lifecycle proof

The new lifecycle regression uses only a fake provider and creates a general draft containing a field-scoped page-spatial reference error plus latent recurring-prop and page structural errors. The first validation exposes only the field-scoped error. Call 2 applies the established exact spatial patch, after which full validation exposes the mixed structural family. Call 3 uses `StructuralBundleRepairPatch` and returns a valid candidate.

Assertions prove:

- logical provider calls: `3`;
- repairs: `2`;
- repair modes: `[null, page_spatial_reference_patch, structural_bundle_patch]`;
- candidate digest: present;
- transport retries: unchanged at `0`;
- fallback: unchanged/forbidden;
- the final prompt omits `previousDraft` and `storySource`;
- the final prompt plus schema conservative upper bound leaves at least `4,096` tokens below the unchanged `64,000` input ceiling.

## Authority migration

Current authorities cut over together and reject their immediately prior versions as legacy immutable:

| Authority | Current | Immediately prior |
|---|---:|---:|
| Visual Contract authoring request | v15 | v14 |
| authoring receipt | v18 | v17 |
| authoring readiness | v16 | v15 |
| B0 materialization / verification | v13 | v12 |
| Execution Request / Supervisor readiness | v12 | v11 |
| Execution Request materialization result | v7 | v6 |
| Pre-Live Readiness evidence | v12 | v11 |

The B0 manifest, verifier result, Execution Request, Supervisor readiness, Pre-Live Readiness, and canonical live child parser all bind the structural-bundle schema compatibility authority and prompt identity. Tamper tests redigest altered structural compatibility and prove rejection. Candidate v7 and Blueprint v4 remain unchanged.

## Validation

Focused results:

- `structural-bundle-repair.spec.ts`, `visual-contract-repair-loop.spec.ts`, `vitest-workload-classifier.spec.ts`: **3 files / 42 tests PASS**;
- `source-authority-lifecycle.spec.ts`: **1 / 57 PASS**;
- `canonical-live-authoring-boundary.spec.ts`: **1 / 135 PASS**;
- `live-request-materialization.spec.ts`: **1 / 34 PASS**;
- `live-request-verification.spec.ts`: **1 / 45 PASS**;
- `live-execution-request-materialization.spec.ts`: **1 / 20 PASS**;
- `live-execution-supervisor.spec.ts`: **1 / 34 PASS**;
- `canonical-pre-live-readiness.spec.ts`: **1 / 12 PASS**;
- `npx --no-install tsc --noEmit`: **PASS**;
- `git diff --check`: **PASS**.

Literal `npm run check` ran exactly once and was not retried:

- TypeScript: **PASS**;
- canonical inventory: **288 files** (`269` ordinary, `19` resource-intensive);
- ordinary: four workers, `32,672 ms`, exit `1` only for the exact established six missing ignored-output assertions;
- resource-intensive: two workers, all **19 files PASS**, `97,155 ms`, exit `0`;
- both diagnostic protocols valid;
- no seventh assertion and no test timeout, `onTaskUpdate`/RPC, IPC, reporter, launch, signal, termination, teardown, or diagnostic-protocol failure.

The six release-blocking fixtures remain unchanged and outside this implementation: one failure each in `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two in `story-read-back-validation.spec.ts`. No missing fixture was created, copied, imported, or fabricated.

Validation cleanup removed only artifacts created by this run: four exact ignored scratch files, three exact timestamped story-QA log directories, `tsconfig.tsbuildinfo`, and the current Vitest result cache. No dependency tree, historical output, authority artifact, or user work was removed.

## Acceptance and remaining authority

Engineering acceptance criteria are met locally:

1. exact closed routing and fallback preservation;
2. strict schema and exact identity containment;
3. sanitized bounded prompt authority;
4. real three-call fake-provider lifecycle to candidate;
5. at least 4,096-token final-call headroom;
6. complete authority/version binding and legacy rejection;
7. unchanged model, service tier, budgets, timeout, retry/fallback, candidate, Blueprint, Wizard and renderer;
8. focused, TypeScript and repository-gate evidence with the historical fixture HOLD separated truthfully.

The original implementation range has independent technical PASS. The focused correction below still requires a read-only micro re-gate. Codex does not self-award that closure. This record grants no credentials, pricing/provider call, Fresh Readiness, preflight, live authoring, candidate approval, Semantic Reconciliation, Blueprint/Wizard, render, storage/database, publication, deployment, or push authority.

## Independent QA and focused correction

Claude Code independently reviewed immutable implementation range `ed7580a6d4ffe0159799821d7d067d883d34f8b6..6c21e2c32e5bbaee761275230c9eb22939937d26` and returned **TECHNICAL PASS** with zero BLOCKER, zero MAJOR, and one non-blocking MINOR. It independently reproduced **379** focused assertions, TypeScript, schema compatibility, routing, sanitization, parser/application rejection classes, containment, lifecycle shape and every authority cutover. Codex records Claude's verdict and does not self-award independent PASS.

The valid MINOR concerned only the exported application helper's draft-side stale guard. Shape and unique-ID validation did not prove that the current draft recurring-prop IDs were exactly the authority/patch IDs. An additional current-draft identity could therefore reach a non-null assertion and be replaced with `undefined`, although the production lifecycle derives authority and patch targets from the same in-memory draft and downstream validation would reject the corrupted result.

The focused QA correction now computes the validated current-draft prop ID set and requires exact size and membership equality with the patch set before mapping. Both a missing current-draft prop and an additional current-draft prop throw `structural_bundle_repair_prop_target_stale`. The correction changes no routing, response schema, prompt, authority version, model, budget, retry/fallback rule, provider behavior, candidate semantics or downstream behavior.

Focused correction validation:

- `structural-bundle-repair.spec.ts` and `visual-contract-repair-loop.spec.ts`: **2 files / 35 tests PASS**;
- `npx --no-install tsc --noEmit`: **PASS**;
- `git diff --check`: **PASS**.

`npm run check` was intentionally not rerun for this narrow correction. The original single-run evidence and separate six-fixture release HOLD remain unchanged.

Claude's advisory notes remain recorded without scope expansion: explicit named tamper tests are uneven across two surfaces whose production bindings are present; the three-call lifecycle does not directly assert per-attempt retry/fallback fields although the unchanged constants prohibit them; Claude did not independently run `npm run check`; and the documentation was faithful. Independent closure of the MINOR remains pending a read-only micro re-gate of the focused correction range.

## Rollback

Rollback of the original implementation is the three-commit range ending at `6c21e2c32e5bbaee761275230c9eb22939937d26`; the focused QA correction is a separate following commit. Prior artifacts remain immutable and legacy-classified. A rollback restores the prior route behavior and prior authority versions; it must not rewrite any historical live-attempt artifact.
