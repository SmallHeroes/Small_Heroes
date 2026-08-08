# R1D-PVB-D1A1B1 Action Semantic Capability-Gap Diagnostic Identity — Decision Gate

**Date:** 2026-08-09
**Base:** `769ab56f1ec332172a9976c2bbd567ba79121f3c`
**Branch:** `codex/r1d-pvb-d1a1b1-action-semantic-gap-diagnostic-identity`
**Mode:** repository investigation and architecture; no provider or render authority

## 1. Proposed change

Persist one closed, typed, sanitized diagnostic identity for every
`ActionSemanticCapabilityGapError` item through the existing per-attempt draft-validation
diagnostic trail. The identity will contain only a closed issue code and a structural
locator: page number, `page_action_semantic_coverage`, coverage index, and the
`disposition` field role.

The change does not make the gap repairable and does not expand the Action Semantic
Catalog. It makes a completed provider response that selects
`unsupported / closed_action_catalog_gap` operationally diagnosable without retaining the
draft, beat ID, source-evidence ID, source phrase, prompt, response, or provider prose.

## 2. Why now?

The consumed live attempt at immutable head `769ab56f...` completed one provider response
and terminated correctly on exactly one `action_semantic_capability_gap`. Receipt v12 and
readiness v10 truthfully record the terminal class and count, but persist no safe locator.
The raw response was intentionally discarded and the child output was suppressed, so the
specific page/coverage record cannot be reconstructed or guessed. A further catalog change
would therefore be blind and risk story-specific force-fitting.

This is the smallest general change that turns the next equivalent terminal event into
actionable evidence. It is a render-path blocker, not product acceptance or visual work.

## 3. Scope and observed root cause

This is a general system/evidence change for every Story Source.

Observed flow:

1. `sourceGroundPageActionSemantics()` already knows the page and coverage index.
2. It creates an `ActionSemanticCapabilityGap` carrying page plus raw in-memory identities
   and source phrase, but omits the safe coverage index.
3. `ActionSemanticCapabilityGapError` reaches the lifecycle catch as a distinct,
   non-repairable terminal error.
4. The catch records only a generic terminal code and `gapCount`; it does not populate the
   existing `draftValidationDiagnostics` field.
5. Receipt/readiness consequently preserve `[null]` for the diagnostic attempt trail.

The existing `DraftValidationAttemptDiagnostics` envelope already supports an
`interrupted` receipt with a non-empty typed final trail, canonical normalization,
deduplication, ordering, counts, truncation, deep copy, persistence, and readiness equality.
No new parallel evidence framework is needed.

## 4. Risk of hardcoding

No story, page, phrase, predicate, character, prop, or authored identifier is admitted to
production logic. The issue arises only from the closed `unsupported` disposition and is
projected by structural position. Tests must use synthetic Story Sources and multiple page
and coverage positions. The Fox attempt is evidence for the missing boundary, not a fixture
or conditional.

## 5. Likely files

- `lib/visual-contract-compiler/actionSemanticCoverage.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/draftValidationDiagnostics.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- focused compiler, lifecycle, boundary, migration, and persistence tests
- `CURRENT.md`
- this Decision Gate and implementation evidence

No prompt, structured-output schema, catalog capability, provider adapter, Blueprint,
Wizard, renderer, dependency, or lockfile file should change.

## 6. Nine architectural decisions

1. **One closed issue identity.** Add only
   `action_semantic / closed_catalog_capability_gap` to the typed draft-validation issue
   catalog. It denotes a valid authored `unsupported / closed_action_catalog_gap`
   disposition that the current catalog cannot represent; it is not an invalid disposition
   and must not reuse an inaccurate existing code.

2. **Structural locator only.** Project every gap to `page_item` with
   `collectionRole: page_action_semantic_coverage`, `fieldRole: disposition`, positive
   `pageNumber`, and non-negative `itemIndex` equal to the original coverage index. An
   unsafe page uses the existing bounded `collection_item` fallback. No beat ID,
   source-evidence ID, phrase, predicate, authored value, path, or hash is persisted.

3. **Producer-owned index.** Add `coverageIndex` to the in-memory gap at the producer where
   the index is authoritative. Do not infer it later from beat/source identities, parse an
   error message, or perform fuzzy matching. Existing raw in-memory fields remain confined
   to the compile boundary and are never copied into evidence.

4. **Reuse the existing trail.** On this terminal error, build one typed diagnostic
   emission set and bind it to the matching completed provider attempt via the existing
   trail builder and lifecycle validator. Receipt status remains `failed`, draft-validation
   status remains `interrupted`, and terminal classification remains
   `semantic_capability_failure / ineligible / semantic_capability_not_repairable`.

5. **Preserve exact evidence invariants.** Existing normalization, ordering,
   deduplication, emitted/unique/transition counts, 128-item cap, truncation, exact keys,
   canonical persistence, readiness deep-copy, and receipt-to-readiness equality remain the
   only authority. Multiple identical structural gaps deduplicate canonically while
   `emittedCount` remains truthful.

6. **Fail-closed version cutover.** Because the closed issue vocabulary changes, cut
   `draft-validation-attempt-diagnostics/v1` to `v2`. Cut Visual Contract receipt v12 to
   v13 and readiness v10 to v11 so historical v12/v10 artifacts with v1 trails remain
   immutable legacy evidence rather than being reinterpreted. No request, candidate,
   provider evidence, provider-failure evidence, Blueprint, prompt, or schema version
   changes unless implementation proves an actual serialized contract dependency.

7. **No behavior or authority expansion.** The Action Semantic Catalog v3, coverage v5,
   compiler acceptance rules, full/compact repair selection, call/repair budgets, model,
   endpoint, service tier, reasoning, timeout, retries, fallback, candidate semantics,
   `$4.884` reservation, `$5.00` ceiling, Blueprint/Wizard gates, and renderer remain
   unchanged. Capability gaps stay terminal and consume no repair call.

8. **Exact validation matrix.** Tests must cover one and multiple gaps; deterministic
   page/index ordering; duplicate normalization with truthful emitted count; invalid/unsafe
   page fallback; in-memory error detail versus sanitized persisted projection; receipt
   write/reload; readiness write/reload and exact equality; legacy v1/v12/v10 status;
   redigested tampering of code, page, index, field role, counts, truncation, and extra keys;
   unchanged non-repairability; unchanged shared terminal validator and Blueprint v4; and
   absence of raw beat/source IDs, phrase, prompt/response/provider material, stack, or
   credential.

9. **Fresh authority and rollback.** Rollback is commit-level before new artifacts are
   relied upon. After implementation PASS, a new pushed head, new Fresh Readiness, and a
   separate bounded live attempt are required. Existing ten-file attempt evidence remains
   byte-immutable and non-reusable. A new candidate, if any, must still traverse Semantic
   Reconciliation, Blueprint, Wizard qualification, render pricing, and one local
   `gpt-image-2` LOW portrait-page render.

## 7. Expected behavior and acceptance criteria

- A completed response that creates one catalog capability gap writes a receipt attempt
  containing one typed `closed_catalog_capability_gap` issue at the exact page/coverage
  position and a readiness artifact carrying the identical deep-copied trail.
- The receipt remains terminal, non-repairable, and candidate-free.
- Multiple gaps remain deterministic, bounded, and count-consistent.
- No raw or authored material crosses the evidence boundary.
- All other terminal classes, repairs, successes, budgets, and downstream behavior remain
  byte-for-byte or behaviorally unchanged as appropriate.
- Focused tests, deterministic TypeScript, `git diff --check`, and the one literal
  repository check meet the existing gate. Only the six established ignored-fixture
  failures may remain; any seventh assertion or infrastructure failure stops fail-closed.
- Claude Code independently returns technical PASS on an immutable commit range before a
  new Fresh Readiness is used.

## 8. Cost and render impact

Implementation and validation cost `$0`. No credential, pricing lookup, provider/model
call, Fresh Readiness, preflight, live authoring, image/Vision, or render is part of this
milestone. Future spend remains separately fenced by the existing `$4.884/$5.00` policy.

## 9. Rejected alternatives

- **Guess the missing predicate/page from the Story Source:** rejected; the provider draft
  was discarded and the evidence does not support reconstruction.
- **Retrieve or persist the raw provider response:** rejected; violates the established
  sanitized evidence boundary and would not generalize safely.
- **Make all unsupported actions repairable:** rejected; changes semantic policy and may
  force-fit unsupported meaning.
- **Add a generic catch-all predicate:** rejected; weakens the closed catalog and hides real
  capability gaps.
- **Create a second action-gap evidence framework:** rejected; the existing typed
  per-attempt trail already owns the required invariants.
- **Add a new closed code without versioning:** rejected; older consumers would reject a
  new enum member under the same version, so the contract would be misleading.

## 10. Review assignment and owner decision

Guy's standing instruction to progress without per-step approval covers this narrowly
bounded, zero-cost, evidence-only milestone. No unresolved product, story, UX, creative,
visual, budget, or launch decision was found. Codex therefore proceeds under these nine
decisions and will stop if implementation would require changing semantic capability,
repair behavior, prompt/schema authority, budgets, renderer, or downstream policy.

Claude Code must adversarially falsify producer ownership, coverage-index accuracy,
sanitization, canonical ordering/deduplication/counts, persistence and tamper rejection,
version migration, non-repairability, unchanged shared/Blueprint contracts, and absence of
story-specific behavior.

Claude Cowork review is unnecessary because no product, UX, story, or visual choice is made.
Guy's next visual decision remains examination of the first successful LOW portrait page.

## 11. Do not do

Do not access credentials; perform pricing/network/provider/model calls; create real B0 or
Fresh Readiness; run preflight or live authoring; alter prompts, structured-output schemas,
Action Semantic capabilities, repair routing, model/tier/reasoning, token/call/repair
budgets, timeout, retries/fallback, candidate semantics, Blueprint/Wizard policy, or
renderer; mutate historical attempt artifacts; use image/Vision; access storage/database;
perform Board, Semantic Reconciliation, approval, publication, promotion, activation, or
deployment; or push.
