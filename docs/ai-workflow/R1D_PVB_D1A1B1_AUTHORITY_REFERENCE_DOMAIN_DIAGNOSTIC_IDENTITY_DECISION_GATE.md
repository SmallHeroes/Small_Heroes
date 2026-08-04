# Decision Gate - R1D-PVB-D1A1B1 Authority/Reference-Domain Diagnostic Identity

**Status:** PROPOSED - waiting for Guy's nine decisions; implementation is not authorized

**Date:** 2026-08-04

**Planning base:** `1d38f2e5996ddca46a3e99ac4956ab4ef50786d6`

**Planning branch:** `codex/r1d-pvb-d1a1b1-terminal-validation-observability`

**Planning worktree:** `C:\Users\guyna\.codex\worktrees\112a\Small_Heroes`

**Planning cost/render allowance:** `$0` / zero renders

## 1. Proposed change

Replace prose-based `DraftAuthorityReferenceDomainError.issues: string[]` with a closed, story-neutral typed issue contract. Each issue would carry an invariant-specific code and a sanitized structural locator sufficient to identify the affected page/field/reference class without persisting any authored identifier or value.

Project those typed issues deterministically into future Visual Contract receipt/readiness evidence while keeping the existing high-level terminal classification `draft_authority_reference_domain_invalid`. The raw prompt, response, draft value, source phrase, provider material, exception prose, stack, and secret boundary remains closed.

This gate is planning only. It does not authorize production-code changes, new artifacts, Fresh Readiness, credential access, provider calls, live authoring, or any downstream action.

## 2. Why now?

The post-terminal-observability live attempt proved that the hardened terminal taxonomy works in a paid run: one completed provider response and zero repairs ended as a distinct non-repairable draft authority/reference-domain failure rather than false repair exhaustion.

It also exposed the next general observability boundary. The canonical receipt records `diagnosticCount: 2` and the generic codes `authority_reference_validation_failed` and `draft_authority_reference_domain_invalid`, but cannot identify the affected page, field, reference class, or invariant. The raw response was correctly discarded, so the current attempt cannot be diagnosed retrospectively. Funding a repeat without improving this boundary would risk another precise terminal family with insufficient local attribution.

## 3. Observed behavior, expected behavior, and root cause

### Observed behavior

- `DraftAuthorityReferenceDomainError` accepts `string[]` and joins the strings into its `Error.message`.
- Current compiler throw sites interpolate authored `beatId`, `checkId`, zone, prop, location, set, and relation values into prose.
- `runVisualContractAuthoring` passes those strings to `sanitizedAuthoringDiagnostics`.
- `diagnosticCodeFor` uses regular expressions over the prose to choose broad categories.
- Receipt/readiness correctly persist only a bounded count, generic diagnostic codes, one closed issue code, and a fixed terminal message.
- Once the prose and provider response are discarded, the page/field/reference-class identity is unrecoverable.

### Expected behavior

- The compiler establishes a closed invariant identity at the exact failure site rather than encoding identity in prose.
- A typed structural locator answers where the invariant failed using only bounded enums and integers.
- Persistent evidence remains useful without containing the authored reference value, source text, prompt/response content, provider prose, stack, or secret.
- Receipt and readiness carry the same sanitized detail; current terminal code, repair ineligibility, budgets, and provider policy do not change.
- Historical artifacts remain immutable and cannot be redigested into current authority.

### Root cause

The authority/reference-domain boundary classifies too late. Compiler validation knows the exact invariant and structure, but exports only free text. The lifecycle can either persist unsafe prose or collapse it into broad codes; it correctly chooses collapse. The missing abstraction is a typed issue identity created before prose exists.

### Contributing factors

- `normalizeSpatialRelations` receives a string label rather than typed location context.
- `zoneOwner` stores prose labels, not structural owner locators.
- action/coverage maps retain authored IDs as keys but do not consistently retain safe record indices for diagnostics.
- the common terminal sanitizer is intentionally generic and regex-based because it handles several validator families.
- the current terminal-failure shape has exact-key validation, so adding structured detail is an artifact-contract change rather than a documentation-only enhancement.

## 4. Scope, feasibility, and hardcoding risk

This is a general compiler/evidence-boundary change. It must contain no story key, child, companion, page literal, authored ID, source phrase, or prior-attempt special case.

The investigation found that sanitized structural attribution is feasible at all current `DraftAuthorityReferenceDomainError` producers:

- action/coverage failures already have page number and action or coverage index;
- Set Board failures already have authority, area, node, and relation indices;
- page-zone failures can retain the zone index during normalization;
- page spatial-reference validation already has page number, collection index, and exact closed field role;
- duplicate/ambiguous owner maps can retain typed locators instead of prose labels.

One public helper currently receives only page number and `beatId`; its caller can pass safe record context, or the helper can emit the coarser page/field locator. No authored ID is required for diagnosis.

This design cannot recover detail from the completed attempt. It improves only future locally produced evidence after an approved implementation and cutover.

## 5. Likely files and modules

Likely production surfaces:

- new `lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics.ts` for the closed issue/locator contract, normalization, validation, and sanitized projection;
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts` for typed issue creation at every current throw site;
- `lib/visual-package/authoringTerminalDiagnostics.ts` only if a direct closed-code input is needed to avoid regex classification for this family;
- `lib/visual-package/visualContractAuthoringLifecycle.ts` for Visual Contract-specific failure projection, strict receipt/readiness validation, and version cutover.

Likely test surfaces:

- `lib/__tests__/draft-reference-domain-hardening.spec.ts`;
- `lib/__tests__/draft-action-authority.spec.ts`;
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`;
- `lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts`;
- affected canonical preflight/version-binding tests discovered during implementation.

No prompt, schema, provider adapter, credential, renderer, storage/database, Board, reconciliation, Blueprint feasibility, or deployment module is expected to change.

## 6. Proposed closed issue catalog

The implementation should own one exhaustive catalog, grouped below. Names are story-neutral and describe invariant failures rather than authored values.

| Reference class | Proposed issue identities |
| --- | --- |
| Action identity | `action_check_id_forbidden`, `action_beat_id_outside_page_authority`, `action_beat_binding_cardinality_invalid` |
| Action coverage | `coverage_check_id_forbidden`, `coverage_action_binding_cardinality_invalid`, `coverage_beat_cardinality_invalid`, `action_coverage_cardinality_invalid` |
| Relation arity | `unary_relation_object_forbidden`, `binary_relation_object_required` |
| Zone/set identity | `page_zone_id_duplicate`, `set_fixed_objects_forbidden`, `set_identity_id_duplicate` |
| Recurring-prop binding | `recurring_prop_reference_type_invalid`, `recurring_prop_reference_cardinality_invalid`, `recurring_prop_lifecycle_gated`, `recurring_prop_consumer_forbidden` |
| Zone projection | `zone_projection_cardinality_invalid`, `zone_projection_duplicate_zone`, `zone_projection_unknown_zone`, `zone_projection_location_mismatch`, `zone_projection_ambiguous_owner`, `board_required_zone_unprojected` |
| Page spatial selection | `page_spatial_reference_outside_zone` |

Implementation must prove that every current authority/reference-domain throw site maps to exactly one catalog identity and that no fallback prose identity exists.

## 7. Nine architectural decisions for Guy

1. **Typed compiler error contract.** Approve changing `DraftAuthorityReferenceDomainError.issues` from `string[]` to a readonly array of closed typed issues. Its `Error.message` becomes one fixed sentence and must never join issue detail or authored values.

2. **Closed invariant catalog.** Approve the catalog in section 6 as the only production issue-code authority. New compiler invariants require an explicit catalog addition and exhaustive tests; no regex, ad hoc string, story-specific identity, or generic unknown code is permitted inside this error class.

3. **Sanitized locator union.** Approve a discriminated locator union containing only closed reference class, closed field role, positive page number where applicable, and non-negative structural indices such as action, coverage, authority, area, node, relation, zone, or safety-constraint index. Authored IDs/values, names, labels, paths, hashes of values, excerpts, phrases, and free-form strings are forbidden.

4. **Deterministic normalization and bounded persistence.** Approve canonical sorting and deduplication by issue code plus locator. Persist an exact safe-integer `totalCount`, at most 128 normalized items, and an explicit `truncated` flag; retain the existing bounded terminal `diagnosticCount`/`diagnosticCodes` as a summary. Unknown/extra keys, invalid integers, and unrecognized enums fail closed.

5. **Visual Contract-specific terminal detail.** Approve leaving the shared `AuthoringTerminalFailure` and production Blueprint receipt shape unchanged. Define a Visual Contract-specific failure extension with required `authorityReferenceDiagnostics`, populated only for `draft_authority_reference_domain_invalid` and `null` for every other Visual Contract terminal. Readiness copies the full Visual Contract failure without reinterpretation; attempt-level generic diagnostic codes remain a bounded summary.

6. **Fail-closed artifact cutover.** Approve Visual Contract receipt `v9 -> v10` and readiness `v7 -> v8`. Prior v9/v7 artifacts remain immutable `legacy_immutable` evidence and are rejected as current authority even after redigesting. No loader fallback or historical rewrite is allowed. Request, candidate, prompt/schema, OpenAI evidence, provider-failure evidence, production Blueprint receipt, and shared pricing/policy versions remain unchanged unless implementation proves their serialized contract changed.

7. **Compiler-owned emission, no post-hoc parsing.** Approve replacing every prose-producing authority/reference-domain site with typed construction at the point the invariant is known. String-label helper parameters and prose owner maps become typed locator context. The lifecycle consumes typed issues directly; it must not parse `Error.message`, inspect a raw response, or derive identities from authored values.

8. **Local proof and future re-gates.** Approve deterministic local tests that cover every issue identity, locator variant, ordering/deduplication/truncation, hostile authored values, receipt/readiness equality, strict current/legacy version behavior, unchanged Blueprint bytes/version, and provider/credential/render/storage sentinels. Implementation must run focused suites, `npx tsc --noEmit`, `git diff --check`, and the repository gate required by `AGENTS.md`, then receive independent Claude Code review. Only after technical closure may a separate Fresh Readiness be materialized; any future live attempt still requires its own explicit authorization.

9. **Rollback and unchanged behavior.** Approve commit-level rollback before any v10/v8 artifact becomes relied upon. After cutover, rollback must preserve v10/v8 artifacts as historical evidence and place live authoring on HOLD rather than reclassifying them. Provider model/tier, prompts, schemas, token/call/repair budgets, retries `0`, no fallback, timeout, cost ceilings, repair eligibility, compiler semantics, candidate rules, resemblance threshold, and every downstream authorization remain unchanged.

Guy should approve, amend, or reject these nine decisions as one architecture before implementation. Codex does not self-authorize any decision.

## 8. Expected behavior after an approved implementation

A future failure could safely state, for example, that page 7 `actionRequirements[2].object` failed the `page_spatial_selection` reference class with issue code `page_spatial_reference_outside_zone`, without storing the rejected spatial ID, page prose, or response. A Set Board failure could identify authority/area/node indices and `recurring_prop` / `stable_node_prop_id` without persisting the prop ID.

The current terminal family remains non-repairable. No new provider call is selected, no repair prompt is created, and no candidate is produced from an invalid draft. Operators gain structural attribution only.

## 9. Validation and acceptance criteria

The smallest sufficient proof is repository-local and provider-unreachable:

- one deterministic unit case for every catalog identity;
- captured multi-issue matrices prove stable page/field/reference-class locators and no repair call;
- duplicate and reordered inputs prove canonical ordering and deduplication;
- more than 128 synthetic safe issues prove `totalCount`, bounded items, and `truncated` without unbounded evidence;
- hostile values containing source phrases, key-shaped text, line breaks, JSON fragments, stack-like text, and provider-like messages never appear in serialized receipt/readiness;
- one-call/zero-repair authority failure retains the existing terminal phase/class/repair reason plus structured detail;
- receipt failure and readiness terminal classification remain deep-equal;
- malformed, extra-key, unknown-enum, negative-index, non-integer, and forbidden-string diagnostic objects are rejected;
- v9/v7 remain immutable historical evidence and cannot pass as current v10/v8;
- production Blueprint receipt v4 output and validation remain unchanged;
- valid compilation and valid live-mode stubs still produce the same candidate semantics;
- provider, credential, render, storage/database, Board, reconciliation, and deployment sentinels remain unreachable.

No full-book render, image generation, provider call, Fresh Readiness, or live attempt is part of the implementation proof.

## 10. Migration, future Fresh Readiness, and future live attempt

No historical artifact migration is recommended. Failed v9/v7 artifacts remain readable only as immutable historical evidence. Test fixtures that intend to exercise current authority must be regenerated locally as v10/v8; fixtures that prove history retain their original bytes and explicit legacy status.

An approved implementation changes current receipt/readiness authority and repository `HEAD`. Therefore the consumed Fresh Readiness digest `7032cc80...d14168a` and Execution Request `73cd25bf...15fe7a` can never authorize a later attempt. After implementation, validation, commit, and independent QA, a separate task must build a new Fresh Readiness and new Execution Request bound to the new immutable `HEAD` and v10/v8 identities. Their schema versions need not change if only bound values/digests change, but their artifacts and digests must be new.

A future live attempt remains a separate armed action with a fresh pricing check, zero ambient credential inheritance, exactly one preflight/verify/live sequence, unchanged call/repair/retry/fallback policy unless separately approved, and a new explicit cost authorization. This Decision Gate grants none of that authority.

## 11. Rollback, rejected alternatives, review assignment, and do not do

### Rollback

Before any new current artifact is relied upon, revert the focused implementation/version commit and restore v9/v7 current constants. If v10/v8 evidence has been emitted, never rewrite or delete it; mark the path HOLD, preserve the artifacts, and use a separately reviewed forward fix or explicit versioned rollback.

### Rejected alternatives

- Persisting partially redacted validator prose: redaction is incomplete and unstable.
- Regex-parsing the current prose into identities: it preserves the defect and is brittle to wording.
- Persisting authored IDs or hashes of authored IDs: both add value-derived material without being required for structural diagnosis.
- Retaining raw response or exception detail in a sidecar: violates the approved persistence boundary.
- Reconstructing or guessing the two issues from the completed attempt: the required information no longer exists.
- Funding another live attempt before observability is implemented and independently gated: repeats the known diagnostic limitation.
- Expanding this milestone into prompt/schema/repair changes: not required to solve diagnostic identity.

### Review assignment

Guy owns approval of the nine decisions. After any approved implementation, Claude Code should falsify catalog completeness, locator privacy, all strict validators, canonical ordering/count behavior, receipt/readiness equality, version cutover, immutable legacy handling, unchanged Blueprint contract, no behavior drift, and all excluded-boundary sentinels. Claude Cowork review is not required because this is a technical evidence-contract decision with no product/creative question.

### Do not do

No production-code edit under this planning milestone; no credential access; no pricing lookup; no network/provider call; no live authoring; no Fresh Readiness or Execution Request materialization; no render/image/Vision; no storage/database/Supabase; no Board or Semantic Reconciliation; no Blueprint/package publication; no approval/promotion/activation; no deployment/firewall change; no branch/worktree switch; no push; and no implementation without Guy's explicit approval.
