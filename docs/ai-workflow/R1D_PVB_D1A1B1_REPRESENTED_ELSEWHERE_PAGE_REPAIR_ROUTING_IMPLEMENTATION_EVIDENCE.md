# Implementation Evidence — R1D-PVB-D1A1B1-REPRESENTED-ELSEWHERE-PAGE-REPAIR-ROUTING

**Status:** Implementation complete; independent Claude Code QA pending. The literal repository gate remains HOLD on its recorded seven-failure ordinary run. Codex does not self-award technical PASS.

**Date:** 2026-08-09

**Exact base:** `1d2a5a8f6cfa72db3a4d2375c4728bb7305697b8`

**Branch:** `codex/r1d-pvb-d1a1b1-represented-elsewhere-page-repair-routing`

**Worktree:** `C:\Users\guyna\.codex\worktrees\1602\Small_Heroes`

**Commit 1:** `4d5309cc8fa31017c91b0f415d41ee275c877ad2` — `feat(authoring): route represented-elsewhere page repairs`

**Commit 2:** `556bdb3492a20ce20795d6c1214385bb77d7ca71` — `feat(authoring): cut over represented-repair authority`

**Closeout commit:** the commit containing this evidence, `CURRENT.md`, and the exhaustive producer-census update

**Code implementation range before this record:** `1d2a5a8f6cfa72db3a4d2375c4728bb7305697b8..556bdb3492a20ce20795d6c1214385bb77d7ca71`

**External state/cost:** none / `$0`

## Verified problem and root cause

The existing compact `page_contract_patch` route handled homogeneous page-local final-structure failures. After such a patch, complete revalidation could correctly expose a represented-elsewhere pointer/value problem, but all Action Semantic failures were excluded from the compact route. The remaining failure was page-local and described by a closed typed issue with a typed page number; terminating or sending the whole draft was unnecessary.

The validator already owned the permitted domain: exact string-valued structured fields from the same fully assembled page contract, excluding action requirements, must-show/must-not-show, camera/shot data, and transition cues. The missing system element was a deterministic compiler projection of that domain coupled to narrow repair eligibility. Provider-prose parsing, `itemIndex` lookup, fuzzy authored-ID matching, silent pointer canonicalization, a fourth repair mode, and a general patch framework were rejected.

## Implemented architecture

### Closed eligibility

- Reused `page_contract_patch`; no new repair mode or framework was added.
- Added only `represented_elsewhere_pointer_out_of_scope`, `represented_elsewhere_pointer_unresolved`, and `represented_elsewhere_value_mismatch`.
- Action Semantic eligibility is homogeneous and all-or-nothing. Every issue must have a valid closed typed diagnostic, `kind: page_item`, `collectionRole: page_action_semantic_coverage`, a safe positive `pageNumber`, a structurally valid persisted `itemIndex`, and the exact code-specific field role.
- `itemIndex` is validated only as part of the typed locator. It is not used to select an authoring page, is not sent to the compact prompt, and is not interpreted as a page-contract array index.
- The affected page set is derived only from typed `pageNumber` and must resolve to exactly one draft page per number.
- Structural and Action Semantic issue sets cannot mix. Capability-gap, authority, source-evidence, malformed, unsafe, empty, missing-page, missing-projection, and all other sets retain their prior behavior.

### Permitted same-page pointer/value projection

- `actionSemanticCoverage.ts` owns `representedElsewherePointerIsPermittedForPage` and uses it both for validation and projection, preventing parallel domain definitions.
- `permittedRepresentedElsewherePointerValuesForPage` recursively enumerates exact string leaves from the fully assembled affected page contract, applies the shared predicate, JSON-pointer-encodes path tokens, resolves every emitted pointer back to its value, and sorts deterministically.
- The excluded validator domains remain excluded: action requirements, `mustShow`, `mustNotShow`, camera/shot fields, and transition cues.
- Projection contains exact same-page structured pointer/value pairs only. It cannot contain unrelated pages, whole-draft values, Story Source prose, or arbitrary provider text.

### Compact request and application

- Page repair system/user prompts cut over to v2. Schema and name remain `page-contract-repair-schema/v1` and `PageContractRepairPatches`.
- Each affected page input contains only `pageNumber`, its complete `pageContract`, closed `repairTargets` (`family`, `code`, `pageNumber`), and `permittedPointerValues`.
- Raw validator prose, full draft, global reference authority, unrelated Story Source prose, provider material, prompts/responses, stacks, credentials, secrets, and executable/shell content are absent.
- The model must return complete page contracts. Prompt v2 explicitly forbids silently rewriting a pointer and permits pointer/value use only as an exact supplied pair.
- Existing strict parsing/application requires the returned set to equal the affected set exactly, rejects unsafe/duplicate/missing/extra pages and unexpected keys, clones the draft, and replaces only the affected complete contracts.
- The compiler then reruns complete assembly, authority, source-evidence, Action Semantic coverage, final validation, and candidate checks. No validation gate was weakened or skipped.

### Typed compiler routing

- The compiler throws a typed `ActionSemanticCoverageValidationError` carrying a defensive clone of the fully assembled pointer template alongside the existing sanitized diagnostic issues.
- Only the local repair selector consumes that structured template to construct the permitted projection. It never serializes raw validation errors or the whole template to the prompt.
- The exhaustive AST producer census now inventories the new subclass explicitly: 15 direct `InvalidTemplateContractError` constructions plus one `ActionSemanticCoverageValidationError` construction, with all three subclass parameters required.

## Authority and migration cutover

- page-contract repair system/user prompts: v2
- Visual Contract authoring request: `visual-contract-authoring-request/v12`
- Visual Contract authoring receipt: `visual-contract-authoring-receipt/v15`
- Visual Contract authoring readiness: `visual-contract-authoring-readiness/v13`
- canonical live-request materialization/verification: v10
- canonical execution request/readiness: v9
- canonical pre-live readiness evidence: v9
- draft schema: unchanged v13
- page-contract repair schema: unchanged v1
- candidate: unchanged v7
- Blueprint: unchanged v4

Current-version and digest checks bind the new prompt authority across B0, materialization, verification, Execution Request, Supervisor, and readiness. Predecessor versions are explicit `legacy_immutable` authorities and cannot authorize a new attempt. Historical artifacts are not migrated, rewritten, or reinterpreted.

## Unchanged boundaries

The implementation does not change `gpt-5.6-sol`, Responses API/default service tier, reasoning, the `64,000` input ceiling, output/call/repair budgets, timeout, zero transport retries, no fallback, `$4.884` conservative reservation, `$5.00` hard ceiling, candidate semantics, Blueprint, Wizard qualification, render behavior, full-draft repair behavior, source-evidence repair, terminal taxonomy, dependencies, `package.json`, or `package-lock.json`.

## Focused validation

All lifecycle/provider tests used fake or injected boundaries; no credential, network, provider, model, or image path was reached.

- Page-repair, Action Semantic catalog/projection, and compiler repair loop: **3 files / 52 tests PASS**.
- Authority/materialization/readiness selection: **6 files / 195 tests PASS** before the final lifecycle scenario was added; the changed source-authority lifecycle then reran at **1 file / 52 tests PASS**.
- Canonical live-authoring boundary and Structured Outputs compatibility: **2 files / 160 tests PASS**.
- Source-evidence repair, production lifecycle, visual package, Blueprint, Wizard qualification, render preflight, and visual-package lifecycle unchanged behavior: **7 files / 203 tests PASS**.
- Exhaustive typed repairable-producer census after the literal-gate finding: **1 file / 17 tests PASS**.
- Deterministic TypeScript: PASS after production changes; rerun before the closeout commit.
- `git diff --check`: rerun before the closeout commit.

The load-bearing fake-provider scenario starts with 12 page-local structural failures, performs a first `page_contract_patch`, exposes exactly one `represented_elsewhere_value_mismatch` on page 1, performs a second `page_contract_patch` for only page 1, and produces a candidate. Receipt evidence records exactly three provider calls and two repairs; diagnostic counts transition 12 -> 1 -> 0. The third prompt includes the closed target and the exact permitted pointer/value pair, excludes validator/provider/stack/credential material, and is admitted with at least 4,096 conservative units of headroom below 64K.

Direct negative tests cover every accepted/rejected locator shape; mixed, unsafe, malformed, missing-page, missing-projection, and unrelated issue rejection; exact projection equality; prompt leakage sentinels; strict returned page sets; caller non-mutation; complete revalidation; prompt/schema digest tampering; stale authorities; and unchanged downstream versions/semantics.

## Literal repository check — HOLD retained

The authorized literal `npm run check` was invoked exactly once and was not rerun.

- TypeScript phase: PASS.
- Canonical inventory: `287` files — ordinary `268`, resource-intensive `19`.
- Resource-intensive phase: **19 files completed**, `workerLimit: 2`, `elapsedMs: 102257`, exit `0`, signal `null`, no launch error, valid diagnostic protocol, no diagnostic failure class, and no assertion, timeout, RPC/IPC, reporter, launch, signal, teardown, or protocol failure.
- Ordinary phase: the exact six established missing ignored-output fixture assertions plus one new producer-census assertion; exit nonzero.

The established six assertions were:

- `lib/__tests__/child-lexicon-ages-5-8.spec.ts` — 1
- `lib/__tests__/momentum-gate-koko.spec.ts` — 1
- `lib/__tests__/page-entity-qa.spec.ts` — 1
- `lib/__tests__/set-appearance-ref-budget.spec.ts` — 1
- `lib/__tests__/story-read-back-validation.spec.ts` — 2

The seventh assertion was implementation-caused and accurately exposed census drift: one direct `new InvalidTemplateContractError` became a typed subclass construction, so the previous expected count of 16 became 15. The correction does not hide or waive that producer. The exhaustive census now includes `ActionSemanticCoverageValidationError: 1` and checks its required `errors`, `diagnosticIssues`, and `pointerTemplate` parameters; focused result is **17/17 PASS**.

Per the approved fail-closed instruction, `npm run check` was not rerun. The historical literal result remains seven failures even though the implementation-caused census assertion has focused proof of correction. Therefore the literal repository gate and release state remain **HOLD** pending Guy's decision on whether a second literal run is authorized; independent review must not describe this range as repository-green.

## Commit scope

Commit 1 owns closed eligibility, validator-aligned projection, prompt v2, compiler routing, direct prompt/privacy/non-mutation tests, and the three-call/two-repair compiler control.

Commit 2 owns Visual Contract and canonical authority cutovers, lifecycle/tamper migration tests, and the outer fake-provider three-call/two-repair candidate scenario.

The closeout commit owns the explicit typed-producer census update, `CURRENT.md`, the approved Decision Gate transcription, and this durable evidence. It contains no dependency or lockfile change.

## Explicitly absent actions and authority

No credential access/check/load, pricing lookup, network/provider/model call, real B0 or Fresh Readiness, canonical preflight, live authoring, candidate generation, render/image/Vision, storage/database, Board action, Semantic Reconciliation, approval, publication, promotion, activation, deployment, PR, or push occurred. No historical artifact changed. External cost is `$0`.

This milestone grants no Fresh Readiness, spend, live-authoring, candidate, Blueprint, Wizard, render, product, visual, release, deployment, or push authority. Independent Claude Code review is still required.

## Rollback

Before any new authority is materialized, revert the closeout commit, then `556bdb3492a20ce20795d6c1214385bb77d7ca71`, then `4d5309cc8fa31017c91b0f415d41ee275c877ad2`. The prior represented-elsewhere terminal behavior returns. No external state requires cleanup. If future artifacts exist, preserve them as immutable historical evidence and rematerialize authority from a separately reviewed head rather than rewriting them.

## Claude Code read-only falsification targets

1. Reconcile branch/worktree ownership, exact pushed base, linear base-to-head range, clean state, no upstream/push, and blob-identical package/lock files.
2. Prove eligibility is limited to the three closed identities and homogeneous safe typed locators; mixed, malformed, capability-gap, authority, source-evidence, and other sets cannot enter `page_contract_patch` through this extension.
3. Prove affected pages derive only from typed positive `pageNumber`; `itemIndex`, prose, authored IDs, fuzzy matching, and story literals do not select or map page contracts.
4. Compare the compiler projection exhaustively with the validator's accepted exact same-page structured string domain, including JSON-pointer escaping, deterministic order, exact resolution, and excluded domains.
5. Falsify prompt privacy with hostile raw validator prose, unrelated source/provider text, stacks, credentials/secrets, and executable/shell payloads. Confirm no complete draft or global authority leaks.
6. Falsify schema parsing, exact affected-page equality, duplicate/missing/extra/unsafe pages, clone/non-mutation, complete-contract replacement, and lack of silent pointer rewriting.
7. Trace post-patch execution through complete assembly, authority, source-evidence, Action Semantic coverage, final validation, and candidate checks; look for any acceptance bypass.
8. Reproduce the 12 -> 1 -> 0 fake-provider lifecycle, exactly three calls/two `page_contract_patch` repairs, page-1-only second request, candidate binding, and third-prompt 4,096-unit headroom.
9. Verify B0, materialization/verification, Execution Request, Supervisor, readiness, prompt/schema digests, and tamper rejection with the exact version cutovers and explicit legacy predecessors.
10. Prove model, tier, reasoning, ceiling, budgets, timeout, retries, fallback, cost fences, full-draft/source-evidence behavior, terminal taxonomy, candidate v7, Blueprint v4, Wizard, render, dependencies, and lockfile are unchanged.
11. Audit the producer census correction rather than accepting a reduced base-class count without explicit subclass coverage.
12. Reconcile the literal repository gate as an original seven-failure HOLD: six established ignored-output fixtures plus the now-focused-green census correction. Do not infer a green literal run that did not occur.
13. Search the entire range for story/page/character/provider-specific literals, prose parsing, hidden credential/network paths, prompt/response persistence, and excluded external actions.
14. Check this evidence and `CURRENT.md` for factual fidelity and ensure neither self-awards independent technical PASS or grants live/render/release authority.
