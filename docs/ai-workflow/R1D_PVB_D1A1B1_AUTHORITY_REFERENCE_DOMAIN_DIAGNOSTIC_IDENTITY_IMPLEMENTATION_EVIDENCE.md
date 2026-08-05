# R1D-PVB-D1A1B1 Authority/Reference-Domain Diagnostic Identity - Implementation Evidence

Date: `2026-08-05`

Status: **implementation range independently PASSed; post-live persisted-round-trip MAJOR corrected locally and pending Claude Code micro re-gate; repository gate HOLD only at the established six-fixture baseline**

Decision Gate: `docs/ai-workflow/R1D_PVB_D1A1B1_AUTHORITY_REFERENCE_DOMAIN_DIAGNOSTIC_IDENTITY_DECISION_GATE.md`

Implementation branch: `codex/r1d-pvb-d1a1b1-authority-reference-diagnostic-identity`

Implementation worktree: `C:\Users\guyna\.codex\worktrees\6331\Small_Heroes`

Exact base: `e7842b01ce9effce12dd40fabdd69505b5fdabca`

Committed milestones before this evidence commit:

1. `8339aa2432bb267dd74444337050da0adddd473d` - typed issue/locator contract and compiler emitters;
2. `bc513bebc5c55696e3c17de3c6af736d796b8af2` - Visual Contract receipt/readiness cutover and strict projection.

Commit 3 is the commit containing this evidence, exhaustive tests, the two discovered scope-preserving emitter/order corrections, the authorized workload-inventory expectation correction, and `CURRENT.md`. The immutable handoff records its exact hash and the full `base..HEAD` range.

External cost: `$0`.

## 1. Outcome

The authority/reference-domain failure family now has one closed, story-neutral, structurally located diagnostic contract from compiler production through immutable Visual Contract receipt/readiness evidence.

`DraftAuthorityReferenceDomainError.issues` is a readonly typed issue list. Its message is fixed as `draft authority/reference domain invalid` and contains no issue detail or authored value. The compiler emits typed structural context directly at every known producer site. The Visual Contract lifecycle consumes those issues directly and never parses the error message, provider response, or authored identifiers/values.

The current Visual Contract authoring receipt is v10 and readiness is v8. Receipt v9/readiness v7 remain immutable legacy evidence and cannot be loaded as current, rewritten, promoted, or made current by recomputing digests. The shared `AuthoringTerminalFailure`, shared `authoringTerminalFailureIsValid`, and production Blueprint receipt/validator v4 remain unchanged.

No request, candidate, prompt/schema, OpenAI evidence, provider-failure evidence, pricing/policy, model/tier, token/call/repair budget, timeout, transport retry, fallback, compiler/candidate semantic, resemblance threshold, or downstream authorization changed.

## 2. Root cause proved against the repository

The historical terminal evidence could identify only the generic family because compiler producers assembled free-form prose in `DraftAuthorityReferenceDomainError.issues`. The lifecycle correctly refused to persist that prose and collapsed it through generic classification, but this erased the safe invariant identity and structural location already available at each compiler site.

Repository investigation found:

- action/check/beat and Action Semantic coverage sites already knew page/action/coverage positions;
- relation-arity sites already knew set-area or page-zone relation positions;
- set, recurring-prop, zone-projection, and board-required-zone sites already knew authority/area/node/projection/zone positions;
- page spatial selection already knew page, action or safety-constraint position, and one of the five field roles;
- helper signatures and the zone-owner map carried prose/string labels where typed structural context was required;
- an earlier `buildZoneGraph` duplicate-zone rejection still intercepted `page_zone_id_duplicate` as repairable prose before the later typed invariant site.

The solution generalizes the family rather than adding a story, page, child, companion, phrase, identifier, or live-attempt special case.

## 3. Closed diagnostic architecture

### Single invariant authority

`lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics.ts` owns the exhaustive catalog:

- 23 issue codes;
- eight reference classes;
- 12 discriminated locator variants;
- 19 field roles.

The catalog is the only production authority for valid issue-code/reference-class/locator-kind/field-role combinations. Emitters use the catalog-derived issue type. There is no regex, ad-hoc open string, generic catch identity, or story-specific identity in this family.

### Sanitized structural locators

Locators admit only:

- closed reference class;
- closed field role;
- positive page number where applicable;
- bounded non-negative authority, area, action, coverage, zone, relation, node, projection, or safety-constraint indices.

They cannot contain authored IDs/values, names, labels, paths, hashes of authored values, excerpts, phrases, free-form strings, prompts, responses, provider bodies, exception messages, stacks, or secrets.

The 12 locator variants are `page_action_field`, `page_action`, `page_coverage`, `set_authority`, `set_area_relation`, `page_zone_relation`, `page_zone`, `set_area_node`, `set_area_projection`, `set_area_projection_zone`, `page_spatial_action`, and `page_spatial_safety_constraint`.

The five explicitly required page-spatial roles are `subject`, `object`, `spatialEffect.target`, `spatialConstraint.target`, and `safetyConstraints.target`.

### Canonical normalization and strict validation

Issues are validated, normalized, deduplicated, and deterministically code-unit sorted by issue code plus canonical locator. `totalCount` is the number of unique normalized issues after deduplication and before persistence capping. At most 128 issues are persisted, and `truncated` is explicit.

Validation fails closed on unknown or extra keys, missing keys, unknown code/class/kind/role values, invalid page numbers, negative/fractional/out-of-bound indices, duplicate or noncanonically ordered persisted items, total-count drift, or truncation drift.

### Compiler emitters and lifecycle

Every known compiler site emits typed issues. The earlier topology duplicate-zone rejection now emits `page_zone_id_duplicate` at the first rejecting site. Zone ownership carries typed authority/area context instead of prose labels. Public action-check validation accepts an optional structural action index and otherwise uses the safe coarser page/action-field locator.

The lifecycle passes typed issues to the Visual Contract-specific terminal builder. Its generic shared diagnostic remains the closed `authority_reference_validation_failed`; neither `Error.message` nor raw/authored/provider material is parsed or persisted.

### Visual Contract-only evidence extension

`VisualContractAuthoringTerminalFailure` extends the unchanged shared terminal failure with exactly one required key, `authorityReferenceDiagnostics`:

- nonempty and strictly valid only for `draft_authority_reference_domain_invalid`;
- exactly `null` for every other shared terminal code.

The Visual Contract validator checks its exact ten-key shape, delegates the stripped nine-key shared object to the unchanged shared validator, and then enforces extension/code/count consistency.

Receipt v10 and readiness v8 use this validator. Readiness copies the receipt failure exactly. Receipt v9 and readiness v7 are explicit `legacy_immutable` evidence. No fallback loader, rewrite, or redigest promotion exists.

## 4. Changed files by milestone

### Commit 1 - typed contract and emitters

- `lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics.ts`;
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`;
- `lib/__tests__/draft-reference-domain-hardening.spec.ts`;
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`.

### Commit 2 - evidence projection and version cutover

- `lib/visual-package/visualContractAuthoringTerminalDiagnostics.ts`;
- `lib/visual-package/visualContractAuthoringLifecycle.ts`;
- `lib/visual-package/index.ts`;
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`;
- `lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts`.

### Commit 3 - exhaustive proof and documentation

- `lib/__tests__/draft-authority-reference-diagnostics.spec.ts`;
- `lib/__tests__/draft-reference-domain-hardening.spec.ts`;
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`;
- `lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics.ts`;
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`;
- `lib/__tests__/vitest-workload-classifier.spec.ts`;
- `CURRENT.md`;
- this evidence document.

The two production corrections in commit 3 are limited to the earlier duplicate-zone typed emission and locale-independent code-unit ordering. The classifier edit changes only the expected canonical inventory from 284 to 285 and ordinary count from 265 to 266; resource-intensive remains 19. Workload policy, workers, pool, file parallelism, timeout, retry, skip, and configuration are unchanged.

## 5. Deterministic coverage

Coverage proves:

- every one of the 23 issue identities is emitted from a real compiler mutation;
- all 12 locator variants, eight reference classes, and 19 field roles have representative valid issues;
- both relation locator forms are emitted;
- all five page-spatial field roles are emitted with hostile authored identifiers absent from serialized issues;
- canonical order, deduplication, unique pre-cap total, 128-item cap, and truncation;
- strict rejection of extra/missing keys, unknown enums, negative/fractional/oversized indices, invalid pages, free-form fields, noncanonical item order, duplicates, and count/truncation drift;
- the fixed error message and absence of hostile authored values;
- unchanged shared nine-key terminal validation and strict Visual Contract ten-key extension semantics;
- receipt/readiness terminal equality and current/legacy version rejection;
- unchanged Blueprint v4 and shared terminal contract;
- provider, credential, network, preflight/live, render, storage, and database sentinels remain unreachable in the relevant boundaries.

## 6. Validation record

All validation was repository-local. Initial dependency preparation used `npm ci --offline --ignore-scripts --no-audit --no-fund` with no network fallback, followed by `npx --no-install prisma generate --schema backend/schema.prisma`. It changed neither package manifest nor lockfile. SHA-256 remained:

- `package.json`: `7DF1D93BCD93E7CE577525627048584096A04C110FC3D0E9D21436242308993D`;
- `package-lock.json`: `BF7932428AC1BC2CB8885E83A21F231486F35EA36820381B7D1763A77BA03D59`.

### Commit-boundary validation

- Commit 1: deterministic TypeScript PASS; focused **3 files / 53 tests PASS**; `git diff --check` PASS.
- Commit 2: focused **4 files / 209 tests PASS**; deterministic TypeScript PASS; `git diff --check` PASS. A prior smaller adjacent run also passed **2 files / 177 tests**.
- Exhaustive contract/emitter matrix before the final aggregate: **2 files / 35 tests PASS**.

### Invalid over-parallel focused aggregate and authorized replacement

The first 11-file focused aggregate invoked Vitest directly. Repository configuration gave it four fork workers with file parallelism, so it incorrectly mixed five policy-classified resource-intensive files into the four-worker run. All **11 files / 374 tests** passed, but Vitest exited `1` after `62.28s` with an unhandled `[vitest-worker]: Timeout calling "onTaskUpdate"`. That run was rejected as evidence and the milestone stopped; it was not silently retried.

Guy authorized one replacement through the existing `runVitestPhases` API, with diagnostics enabled and each file exactly once:

- ordinary phase: six files, four workers, **143/143 tests PASS**, Vitest duration `2.11s`, supervisor elapsed `2,667ms`;
- resource-intensive phase: five files, two workers, **231/231 tests PASS**, Vitest duration `82.05s`, supervisor elapsed `82,605ms`;
- both phases: exit `0`, signal `null`, launch error `null`, one valid diagnostic record, no classes, valid protocol;
- total wall time: `85.5s`.

After that focused PASS:

- `npx --no-install tsc --noEmit`: PASS in `9.3s`;
- `git diff --check`: PASS.

### First literal repository gate - required HOLD

The first authorized literal `npm run check` ran exactly once and was not retried. It completed in `145.4s` with:

- TypeScript PASS;
- canonical inventory 285 files;
- ordinary phase 266 files at four workers, elapsed `31,088ms`, exit `1`, valid one-record diagnostic protocol;
- resource-intensive phase 19 files at two workers, elapsed `110,187ms`, exit `0`, valid one-record diagnostic protocol;
- seven failed assertions: the six established absent ignored-output fixtures plus `vitest-workload-classifier.spec.ts` expecting stale inventory 284/ordinary 265.

The seventh assertion caused the required fail-closed stop. No retry or unauthorized correction occurred.

### Authorized inventory QA fix and replacement repository gate

Guy authorized only:

- inventory `284 -> 285`;
- ordinary `265 -> 266`;
- resource-intensive unchanged at `19`.

Validation then ran exactly as authorized:

- `npx --no-install vitest run lib/__tests__/vitest-workload-classifier.spec.ts --reporter=default`: **1 file / 7 tests PASS**, Vitest duration `399ms`, command wall `2.1s`;
- `npx --no-install tsc --noEmit`: PASS in `4.7s`;
- `git diff --check`: PASS;
- one replacement literal `npm run check`, not retried: completed in `131.7s`.

Replacement gate result:

- TypeScript PASS;
- canonical inventory **285 files** = **266 ordinary + 19 resource-intensive**;
- ordinary phase at four workers: elapsed `31,058ms`, exit `1` only for the established six assertions; diagnostic protocol valid, one record, signal `null`, launch error `null`;
- resource-intensive phase at two workers: **19/19 files PASS**, elapsed `96,447ms`, exit `0`; diagnostic protocol valid, one record, no classes, signal `null`, launch error `null`;
- no seventh assertion and no timeout, RPC/IPC, reporter, launch, signal, termination, teardown, or diagnostic-protocol failure.

The ordinary `signal_or_exit_failure` diagnostic class reflects its known nonzero assertion exit; the observed signal itself is `null`. The literal command correctly exits `1`, so the repository gate remains HOLD only at the documented baseline.

The six unchanged missing-output assertions are:

1. `lib/__tests__/child-lexicon-ages-5-8.spec.ts`;
2. `lib/__tests__/momentum-gate-koko.spec.ts`;
3. `lib/__tests__/page-entity-qa.spec.ts`;
4. `lib/__tests__/set-appearance-ref-budget.spec.ts`;
5. two cases in `lib/__tests__/story-read-back-validation.spec.ts`.

No missing ignored fixture was copied, generated, imported, or fabricated.

## 7. Preserved boundaries and limitations

### Independent Claude Code QA

Claude Code independently reviewed exact immutable range `e7842b01ce9effce12dd40fabdd69505b5fdabca..d374562e5db851e72ad4086f690060055cfce9b6` read-only and returned **TECHNICAL PASS** with zero BLOCKER, zero MAJOR, and zero MINOR. Codex records Claude Code's verdict; it does not self-award independent technical PASS.

Claude independently reproduced `npx --no-install tsc --noEmit` with exit `0` and ran a separate six-file selection with **223 tests PASS**. Its hostile probes rejected all **740** illegal catalog combinations and all **35** hostile-material mutations. It also confirmed the version cutover and strict legacy behavior, every typed compiler producer including the early `buildZoneGraph` duplicate-zone path, direct typed lifecycle transport without regex classification, Visual Contract-specific exact-key validation, unchanged shared nine-key terminal validation, unchanged Blueprint v4, receipt/readiness equality, and the absence of story-specific or authored-material persistence.

Claude retained four advisory limitations without charging a finding:

- **N1:** its six-file/223-test selection was not the recorded ordinary 6/143 plus resource-intensive 5/231 policy partition, and it did not rerun `npm run check`; those partition and repository-gate results remain Codex's recorded executable evidence;
- **N2:** once evidence is truthfully truncated to 128 persisted items, the artifact alone cannot distinguish a pre-cap `totalCount` of 200 from 5,000, although normalization and every persisted field remain cross-validated;
- **N3:** `pageNumber` accepts any positive safe integer while structural indices are capped at 1,000,000; Claude found no leakage or validation defect;
- **N4:** the implementation uses eight closed reference classes where the Decision Gate grouped the same domain into seven classes, splitting `page_zone` from `set_identity` and separating `spatial_relation`; the 23 issue identities are unchanged.

The six established missing ignored-output fixture assertions remain a separate repository-gate HOLD outside the reviewed implementation range. Claude did not rerun the full gate and neither confirmed nor extended that baseline. They are not implementation findings and remain release-blocking under their existing scope.

- Shared `AuthoringTerminalFailure` and `authoringTerminalFailureIsValid` are byte/behavior unchanged by the feature commits.
- Production Blueprint receipt/validator v4 and its bytes are unchanged.
- Request, candidate, prompt/schema, OpenAI evidence, provider-failure evidence, pricing/policy, and Blueprint versions are unchanged.
- Provider model/tier, prompt/schema authorities, token/call/repair budgets, timeout, transport retries zero, no fallback, pricing ceilings, repair routing, compiler/candidate semantics, resemblance threshold 0.70, and downstream authorization are unchanged.
- No credential access/check/load; pricing/network/provider/model call; B0/Fresh Readiness or Execution Request materialization; canonical preflight; live authoring; candidate approval; Semantic Reconciliation; Blueprint/Wizard execution; render/image/Vision; storage/database/Supabase; Board; publication/promotion/activation; deployment/firewall change; PR; or push occurred.
- No current receipt/readiness artifacts were materialized. The version cutover is proved with deterministic local construction/validation only.
- The six ignored-output fixtures remain a repository-gate HOLD outside this milestone.
- Independent Claude Code first-pass review is complete with TECHNICAL PASS and zero findings. The verdict is technical only and grants no product, visual, readiness, live, render, release, deployment, or push authority.

## 8. Rollback

There is no data migration and no external state. Before any v10/v8 evidence is produced, rollback is the three focused commits in reverse order. Because this milestone produced no readiness, request, candidate, Blueprint, render, database, or published artifact, rollback has no artifact migration. Existing v9/v7 evidence remains immutable legacy evidence either way.

## 9. Independent QA falsification record

Claude Code reviewed the immutable base-to-head range read-only and attempted to falsify:

1. whether any authority/reference producer still emits prose, throws a repairable generic error, or bypasses the typed catalog;
2. whether any issue code/reference-class/locator-kind/field-role combination is admitted outside the single catalog;
3. whether authored IDs/values, names, labels, paths, hashes, excerpts, phrases, prompts, responses, provider data, errors, stacks, or secrets can enter an issue or persisted artifact;
4. whether page numbers and structural indices enforce positive/bounded/non-negative integer rules exactly;
5. whether normalization is deterministic, deduplicated, canonically ordered, and counts unique pre-cap issues while persisting at most 128 with truthful truncation;
6. whether strict validators reject all extra/missing keys, unknown enums, invalid numbers, duplicate/noncanonical items, and count/truncation drift;
7. whether every one of the 23 compiler identities and all 12 locator variants/19 field roles are genuinely reachable from the intended structural sites, including the earlier `buildZoneGraph` duplicate-zone path;
8. whether lifecycle code parses `Error.message`, raw provider output, or authored values instead of consuming typed issues directly;
9. whether shared terminal shape/validator behavior changed, or the Visual Contract extension can be missing, extra, non-null for another code, null/empty for the authority code, or count-inconsistent;
10. whether receipt v10 and readiness v8 validate and preserve identical failure evidence and whether v9/v7 can become current after redigest, fallback, rewrite, or promotion;
11. whether Blueprint v4, request/candidate/prompt/schema/OpenAI/provider-failure/pricing/policy contracts or provider/model/tier/budget/timeout/retry/fallback/resemblance/downstream behavior drifted;
12. whether the inventory-only QA fix changed policy, workers, pool, parallelism, timeout, retry, skip, configuration, or production behavior;
13. whether any story, child, companion, page, identifier, phrase, or historical live-attempt special case was introduced;
14. whether the validation record accurately distinguishes the rejected four-worker aggregate, policy-correct focused replacement, first seven-failure repository HOLD, narrow inventory correction, and final six-fixture HOLD.

Independent technical review does not grant product, visual, candidate, Blueprint, Wizard, Fresh Readiness, provider, live-authoring, render, spend, publication, release, deployment, or push authority.

## 10. Post-live persisted-round-trip QA finding and correction

The first live attempt using this diagnostic authority produced one canonical receipt v10 and one readiness v8, then stopped terminally on two typed recurring-prop issues. Claude Code's read-only artifact audit independently recomputed and confirmed the artifact contents, digests, typed issue identities/locators, usage and cost arithmetic, receipt/readiness equality, sanitization, original fences, and absence of candidate or downstream authority. It nevertheless returned **HOLD** with one **MAJOR** because the persisted terminal diagnostics failed their own production validator after JSON reload.

The defect was isolated to `draftAuthorityReferenceDiagnosticsIsValid`. The function correctly validated every item and rebuilt canonical normalized issues, but compared the rebuilt array to the supplied array with raw `JSON.stringify`. In-memory locators used declaration-order keys, whereas repository canonical persistence recursively sorts object keys. The semantic content was identical, but insertion-order-sensitive serialization differed. The shared terminal validator was unaffected; only the new Visual Contract diagnostics extension had this round-trip defect.

The authorized narrow correction:

- applies the existing repository `canonicalize` authority to both arrays before equality comparison;
- preserves array order and duplicates as meaningful while making only object-key order and Unicode normalization invariant;
- keeps canonicalization inside the validator's fail-closed `try` boundary;
- changes no schema, artifact version, persisted byte contract, producer, terminal taxonomy, receipt/readiness projection, prompt, model, policy, budget, repair route, retry/fallback behavior, or downstream authorization.

Regression evidence:

- `lib/__tests__/draft-authority-reference-diagnostics.spec.ts` proves in-memory validity, canonical key-sorted round-trip validity, and continued rejection of reordered items, duplicates, count drift, truncation drift, extra/missing keys, and invalid locators;
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts` performs real canonical receipt v10 and readiness v8 writes, reloads both JSON files, validates both terminal classifications, confirms their equality, and rebuilds byte-equivalent readiness from the reloaded receipt;
- focused validation: **2 files / 53 tests PASS**;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS;
- `npm run check`: intentionally not run under the approved scope.

Before editing, the consumed output root was recorded as exactly ten regular files / 128,459 bytes. Receipt whole-file SHA-256 remained `39ea5c401ae7b2f43f6e29eac99e554bbf36ed9e20ed7938470767f136c1fb42`; readiness whole-file SHA-256 remained `ba729f449ec43551a8a994dd471204ebec9828dae132f82b693b2959ab381dca`; the original eight artifact hashes also remain unchanged. This correction did not open, rewrite, redigest, repair, or promote any artifact.

Claude Code's MAJOR is corrected locally but is not independently closed until a read-only micro re-gate. The consumed live attempt remains exhausted. No credential access, pricing/network/provider call, Fresh Readiness, preflight, live authoring, candidate, Semantic Reconciliation, Blueprint/Wizard execution, render, storage/database, Board, approval, publication, promotion, activation, deployment, firewall change, or push occurred in the correction task.
