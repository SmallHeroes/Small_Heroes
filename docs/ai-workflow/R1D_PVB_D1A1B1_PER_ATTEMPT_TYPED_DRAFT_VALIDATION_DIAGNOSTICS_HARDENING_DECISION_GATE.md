# Decision Gate - R1D-PVB-D1A1B1 per-attempt typed draft-validation diagnostics hardening

**Status:** APPROVED for a separate local implementation by Guy's standing continuous-execution authorization; this documentation Task remains planning-only

**Date:** 2026-08-05

**Planning base:** `eeaca686a00ace669d2dda7bd25041683ca650b9`

**Planning branch:** `codex/r1d-pvb-d1a1b1-recurring-prop-consumer-lifecycle-hardening`

**Planning worktree:** `C:\Users\guyna\.codex\worktrees\2371\Small_Heroes`

**Planning cost/render allowance:** `$0` / zero renders

## 1. Executive decision

Create a compiler-owned, closed typed diagnostic trail for every repairable Visual Contract draft-validation issue. Each validator/compiler producer will emit a stable issue identity plus a sanitized structural locator at the point where the invariant is known. The repair loop may continue to retain the raw rejected draft and exact error prose in memory because the existing repair prompt requires them, but only bounded typed diagnostics cross the persistence boundary.

Every attempt receipt will record the canonical typed snapshot and its transition from the preceding attempt. Terminal readiness will copy the receipt's ordered diagnostic trail without parsing or reinterpretation. The evidence will distinguish newly introduced, persistent, resolved, and final issues without storing authored values.

This is a general observability correction for every Story Source. It does not change repair input, repair selection, model, provider, prompt/schema authority, token/call/repair budget, timeout, retry/fallback policy, candidate semantics, cost ceilings, or downstream authorization.

## 2. Why now?

The post-recurring-prop-hardening live attempt used all three allowed provider calls and improved from 15 validation errors to 2 and then 2. The final two attempts did not have the same broad family mix: attempt 2 records draft-contract plus draft-schema, while attempt 3 records action-semantic plus draft-contract. The current receipt therefore proves progress and change, but cannot say which invariant resolved, which new invariant appeared, which issue persisted, or where either final issue occurred.

`TemplateRepairExhaustedError` still carries the exact `TemplateRepairAttempt[]` trail in memory. Each attempt includes raw `draft` and `errors: string[]`, and full-draft repair receives those exact values. After the run, `runVisualContractAuthoring` calls `sanitizedAuthoringDiagnostics`, whose `diagnosticCodeFor` uses regular expressions over error prose and persists only a bounded count plus broad codes. Raw drafts, responses, and errors are correctly discarded. The exact final identities and locations are therefore unrecoverable, and another paid attempt before improving this evidence would be blind.

## 3. Observed behavior, expected behavior, and root cause

### Observed behavior

- `InvalidTemplateContractError` is the common free-text repairable channel.
- `TemplateRepairAttempt` stores exact `errors` and the rejected `draft` only in memory.
- `TemplateRepairExhaustedError` carries that in-memory trail to the lifecycle.
- Repairable producers include compiler assembly/topology/contract invariants, the template/vNext structural validators, Action Semantic coverage validation, and the separately typed Source-Evidence-ID path.
- `sanitizedAuthoringDiagnostics` classifies strings with keywords such as `schema`, `missing`, `action`, `beatId`, `authority`, and `zone`.
- A `VisualContractAuthoringAttemptReceipt` persists only `{count, codes}`. Readiness carries terminal summary, not the per-attempt trail.
- Existing `DraftAuthorityReferenceDomainError` proves the desired pattern is feasible: a source-owned typed issue and structural locator can be persisted safely without authored values. That error remains a distinct non-repairable terminal and is not redesigned here.
- `SourceEvidenceIdValidationError` already has typed affected-record data for compact routing, but attempt evidence currently collapses its error strings like every other repairable failure.

### Expected behavior

- Every error eligible to enter the Visual Contract repair loop has a closed typed sibling created at its validator/compiler source.
- Issue identity is stable across wording changes, and structural location uses closed enums plus bounded safe integers only.
- Exact strings and drafts still drive the unchanged in-memory repair prompt but never become persistent evidence.
- Each attempt's typed issues are normalized, deduplicated, bounded, and ordered canonically.
- Attempt order remains provider-call order. Transitions explicitly identify newly introduced, persistent, and resolved issues, and the terminal/successful attempt is marked final.
- Readiness copies the receipt's typed trail exactly. Operators can diagnose future exhaustion without reconstructing or retaining provider output.

### Root cause

Identity is discarded at the wrong abstraction boundary. The validators and compiler know the precise invariant and structural context, but expose only prose. The lifecycle sees the data after that loss and can either persist unsafe text or reduce it to regex-derived categories; it correctly chooses reduction. The missing system contract is a typed issue channel parallel to the existing in-memory repair prose.

### Contributing factors

- Template validation delegates to the vNext validator and prefixes its strings, erasing structured source ownership.
- Action Semantic validation returns `string[]` from both page grounding and final coverage checks.
- Several compiler helpers receive prose labels or interpolate authored identifiers into error strings rather than retaining safe locator context.
- The shared terminal sanitizer also serves other authoring paths, so its broad regex mapping cannot recover Visual Contract-specific identity.
- Strict exact-key artifact validators mean useful structured diagnostics require an explicit receipt/readiness version cutover.

## 4. Scope, feasibility, and hardcoding risk

This is a story-neutral Visual Contract compiler/evidence change. Production code must contain no calibration Story Source, child, companion, page literal, authored ID, source phrase, provider value, or prior-attempt special case.

The implementation scope includes every producer whose failure can be caught as repairable by `compileBookVisualContractTemplate`:

- draft-schema/shape validation in the Template and delegated vNext validators;
- draft-contract/compiler invariants in topology, spatial assembly, cover/source fidelity, cast/fact authority, recurring-prop lifecycle, evidence checks, and final contract validation;
- Action Semantic validation in page grounding and final coverage validation;
- projection of existing Source-Evidence-ID typed failure code plus page/coverage indices into the common typed trail, without redesigning or rerouting compact repair.

Non-repairable `DraftAuthorityReferenceDomainError` and `ActionSemanticCapabilityGapError` remain separate terminal families. Initial JSON decode and unusable repair output remain their existing terminal families. The analogous production Blueprint receipt uses the shared broad sanitizer but a different compiler/repair loop; it was inspected and is out of scope for this Visual Contract serialized cutover. Its version, bytes, and behavior must remain unchanged.

The hardcoding risk is controlled by deriving locators from structural traversal context and by testing more than one Story Source shape. No issue identity may encode an authored value or a story-specific exception.

## 5. Proposed typed evidence contract

### Closed issue

Each issue is a value object:

```text
DraftValidationIssue {
  family: draft_schema | draft_contract | action_semantic | source_evidence_id
  code: closed invariant code
  locator: closed discriminated structural locator
}
```

The baseline invariant-code vocabulary is grouped by source responsibility rather than prose wording:

- **Draft schema:** required field missing; value type invalid; value domain invalid; array shape/member invalid; schema version invalid; binding shape/mode/origin invalid; binding mode/origin incoherent; binding value required/forbidden/placeholder.
- **Draft contract:** topology empty/malformed; duplicate identity; unresolved/ambiguous/out-of-scope reference; relation arity invalid; coverage/cardinality invalid; world type missing; cover projection/source fidelity invalid; cast/fact authority mismatch; source-evidence phrase invalid; lifecycle/consumer invariant invalid; final structural invariant invalid.
- **Action Semantic:** coverage missing; beat identity missing/out of scope/duplicate; disposition kind/reason/payload invalid; coverage/action binding missing or cardinality invalid; represented-elsewhere pointer scope/unresolved/value mismatch; source-phenomenon binding mismatch.
- **Source Evidence ID bridge:** existing `source_evidence_id_malformed`, `source_evidence_id_unknown`, and `source_evidence_id_wrong_page` identities, projected from current typed affected records rather than parsed from their repair prose.

Implementation must freeze the exhaustive string-literal catalog after a mechanical producer census. It may split a baseline identity when two current invariants require different operator action, but it may not introduce `unknown`, `other`, a free-form code, or a prose-parsing fallback. Exhaustive tests must prove one closed identity for every repairable producer.

### Sanitized structural locator

The locator is a discriminated union of closed structural contexts such as root/cover field, cast member, human-cast member/garment, recurring prop, location, zone, Set Board authority/area/node/relation, page field, page transition, page action, page Action Semantic coverage record, page prop/safety constraint, and validator shadow field. It contains only:

- closed kind, collection role, field role, and reference class enums;
- positive page number where the source contract defines one;
- bounded non-negative structural indices;
- no general JSON Pointer or free-form path.

Authored IDs, values, names, labels, aliases, prose, hashes of values, excerpts, source phrases, provider response IDs, and arbitrary strings are forbidden. Combinations invalid for a locator variant reject fail-closed.

### Per-attempt transition record

Each provider-reached attempt that enters draft validation carries `draft-validation-attempt-diagnostics/v1`:

- `emittedCount`: typed source emissions before normalization;
- `currentUniqueCount`: normalized/deduplicated issues present on this attempt;
- `newlyIntroducedCount`, `persistentCount`, and `resolvedCount` relative to the preceding validated attempt;
- bounded canonical items of `{state: newly_introduced | persistent | resolved, issue}`;
- `finalAttempt: boolean`;
- `truncated: boolean`.

The initial attempt treats every current issue as newly introduced. A later successful attempt can contain zero current issues and the resolved prior set. Attempts that never enter draft validation carry `null`. Stable equality is family + code + canonical locator. Attempt array order remains chronological; item order is canonical and independent of validator emission order.

The existing broad attempt `count/codes` remains as a summary, but it is derived directly from typed emissions and family-to-summary mapping. Visual Contract draft-validation evidence must no longer call the prose regex classifier.

## 6. Nine architectural decisions

1. **Typed source ownership and repair-loop contract.** Approve a new compiler-owned `DraftValidationIssue` and repairable typed validation error/trail. Every known repairable producer emits typed issues at source while retaining exact error strings and raw drafts only in memory for the unchanged repair prompt. A newly introduced untyped repairable failure is an invariant breach that fails closed before another provider repair rather than being guessed or regex-classified.

2. **Closed families and invariant identities.** Approve `draft_schema`, `draft_contract`, `action_semantic`, and the bridge-only `source_evidence_id` as the closed families. Approve the baseline code responsibilities in section 5 and require implementation to freeze an exhaustive story-neutral catalog with no `unknown`, `other`, dynamic value, or prose-derived fallback. Existing Source-Evidence-ID failure codes remain the authority for their family.

3. **Sanitized structural locator union.** Approve closed locator variants containing only enums, positive page numbers where applicable, and bounded non-negative structural indices. Forbid authored IDs/values/names/labels/paths/hashes, prompt or response material, draft values, source phrases, provider messages, exception prose, stacks, secrets, and free-form strings. Invalid combinations and extra keys reject fail-closed.

4. **Complete producer conversion without routing change.** Approve converting every Template/vNext validator, compiler assembly/contract, and Action Semantic producer that can reach the repair loop. Project existing Source-Evidence-ID typed records into common diagnostics while preserving the exact compact-repair eligibility test. Keep authority/reference-domain and capability-gap terminals non-repairable and separate. Do not extend this cutover to the production Blueprint compiler/receipt.

5. **Canonical bounded transition semantics.** Approve per-attempt emitted, current-unique, newly-introduced, persistent, and resolved counts; `finalAttempt`; canonical equality by family/code/locator; deterministic sorting/deduplication; a hard 128 persisted transition-item cap per attempt; and explicit `truncated`. Counts are bounded safe integers and describe the complete pre-cap typed set; persisted items never exceed the cap. Attempt order is never sorted or collapsed.

6. **Receipt/readiness projection and version cutover.** Approve Visual Contract receipt `v11 -> v12` and readiness `v9 -> v10`. Receipt attempts carry the typed diagnostic object or `null`; readiness carries one exact ordered copy of the receipt's diagnostic trail and status (`not_evaluated`, `completed`, `interrupted`, or `repair_exhausted`) without reinterpretation. Request v10, candidate v7, OpenAI evidence v3, provider-failure evidence v2, Blueprint receipt v4, B0 materialization input v6, B0 manifest/verification v8, pre-live readiness v7, Execution Request/readiness/result v7/v7/v5, prompt/schema versions, and other schema labels remain unchanged. Their future artifact bytes and digests must nevertheless be newly materialized where they bind the v12/v10 values. Existing v11/v9 and all prior artifacts remain byte-immutable `legacy_immutable` evidence and cannot become current through redigest or copying.

7. **No behavioral or policy drift.** Approve diagnostics as evidence-only. Repair prompt inputs, full-draft versus compact routing, model `gpt-5.6-sol`, Responses/default tier, reasoning, schema/prompt authority, 64K input ceiling, output budget, one-initial/two-repair/three-call limits, timeout, retries `0`, no fallback, candidate semantics, `$4.884` reservation, `$5.00` ceiling, resemblance threshold, and every downstream authority remain unchanged.

8. **Deterministic local acceptance proof.** Approve exhaustive producer/catalog/locator tests; multi-attempt `15 -> 2 -> 2`-shape transition tests without live content; success-after-repair, repair exhaustion, compact Source-Evidence-ID, repair-output-invalid, and interrupted trails; ordering/deduplication/cap/truncation; strict exact-key round trips; hostile authored material non-persistence; v11/v9 legacy rejection as current; unchanged Blueprint bytes/version; and provider/credential/network/render/storage/downstream sentinels. Require focused suites, repository-local `tsc --noEmit`, `git diff --check`, and the policy-correct repository gate, followed by independent Claude Code review.

9. **Migration, rollback, Fresh Readiness, and next-live consequence.** Approve no historical mutation or backfill. Before any v12/v10 artifact is relied upon, rollback is a focused commit revert. After such artifacts exist, preserve them and place the path on HOLD for a reviewed forward fix; never downgrade or reinterpret them. Implementation changes `HEAD` and authority versions, so Fresh Readiness `9b881831...dc95790`, Execution Request `3a6276ba...3e16f`, receipt `f0e3a841...1b75a`, and readiness `bae87c91...94df8` are consumed historical evidence only. A later live attempt requires new independently reviewed implementation authority, new B0/Fresh Readiness and Execution Request bound to its exact pushed `HEAD`, a fresh official pricing check, and a separate armed execution sequence. This gate authorizes none of those operational steps.

Guy's standing continuous-execution authorization approves these nine decisions for a separate implementation Task because investigation discovered no model, budget, provider, downstream-policy, product, visual, or creative change. If implementation discovers that any such change is actually required, it must stop and return to Guy with an amended gate.

## 7. Likely implementation files and dependencies

Likely production surfaces:

- new `lib/visual-contract-compiler/draftValidationDiagnostics.ts` for issue/family/code/locator types, exact validators, normalization, comparison, and bounded transition projection;
- `lib/visual-contract-compiler/validateVNextVisualContract.ts` and `validateTemplateContract.ts` for typed structural issue emission;
- `lib/visual-contract-compiler/actionSemanticCoverage.ts` for typed Action Semantic issue emission;
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts` for compiler-producer conversion, typed repair attempts/errors, transition construction, and Source-Evidence-ID bridging;
- `lib/visual-package/authoringTerminalDiagnostics.ts` only for direct typed family-to-summary mapping without weakening the shared exact validator;
- `lib/visual-package/visualContractAuthoringLifecycle.ts` for attempt/readiness projection, exact current-version validation, persistence/reload, and v12/v10 cutover;
- canonical import/preflight and lifecycle/compiler tests whose exact current versions or workload inventory are bound to these modules.

Likely test surfaces include compiler contract/authority tests, Action Semantic tests, source-evidence repair tests, `source-authority-lifecycle.spec.ts`, `canonical-live-authoring-boundary.spec.ts`, persistence round-trip tests, current/legacy version tests, and workload-inventory expectations if a new canonical spec is added.

No prompt, structured-output schema, provider adapter, credential boundary, pricing policy, renderer, storage/database, Board, Semantic Reconciliation, Blueprint feasibility, Wizard, package publication, deployment, or firewall module should change.

## 8. Validation and acceptance criteria

Acceptance requires all of the following:

- every repairable producer in the Visual Contract loop maps to one or more closed typed issues, with a source-level exhaustive test and no string-only path;
- exact repair strings and drafts continue to reach the same full-draft prompt in memory, but no typed evidence changes repair mode or call eligibility;
- Source-Evidence-ID-only failures still select only compact repair, and mixed failures still select the existing full-draft path;
- broad `validationDiagnostics.codes` are derived from issue families, not regex over prose;
- first/later/final attempt semantics correctly identify new, persistent, resolved, and final issues, including a successful zero-current-issue final attempt;
- issue normalization is stable under emission reordering and Unicode/object-key variation, deduplicates exact family/code/locator identity, and rejects illegal catalog/locator combinations;
- more than 128 synthetic transition items proves complete bounded counts, deterministic retained items, and `truncated: true`;
- receipt v12 writes, reloads, and revalidates; readiness v10 reloads, revalidates, and deep-copies the exact receipt trail/status;
- hostile draft/source/provider/key/stack-shaped material cannot appear anywhere in serialized receipt/readiness diagnostics;
- receipt v11/readiness v9 and every artifact from the completed attempt remain byte-identical historical evidence and are rejected as current authority;
- current request v10, candidate v7, provider evidence v3, provider-failure v2, B0 input/manifest/verification v6/v8/v8, pre-live readiness v7, Execution Request/readiness/result v7/v7/v5, production Blueprint receipt v4, model/tier/budget/cost policy, candidate behavior, and downstream boundaries retain their schema labels and behavior; future binding artifacts are newly materialized rather than reused;
- focused tests, deterministic TypeScript, `git diff --check`, and the required repository gate are truthful; the six known ignored-fixture failures and recurring resource timeout remain release blockers until independently resolved;
- Claude Code independently falsifies the immutable implementation range before any new Fresh Readiness.

No provider call or render is needed to prove the implementation. The previous final two issues cannot be retroactively recovered, so acceptance must not claim to identify them.

## 9. Migration, future readiness, and future live attempt

There is no data migration. All ten artifacts under the completed attempt root remain byte-immutable, including the v11 receipt and v9 readiness. Fixtures intended to prove historical handling retain their original bytes and explicit legacy status. Fixtures intended to represent current authority must be generated deterministically as v12/v10 and may not be created by redigesting old evidence.

The implementation commit necessarily invalidates the completed attempt's Fresh Readiness and Execution Request for future use. After local validation, independent QA, and an explicitly authorized push, a separate zero-cost task must materialize new B0/Fresh Readiness and a new Execution Request bound to the new exact `HEAD` and current version identities. Only a later separately armed Task may perform official pricing verification, preflight, Supervisor verify, credential isolation, and at most one live invocation.

The diagnostic change makes a future failure actionable; it does not make a failed draft a candidate and does not authorize Semantic Reconciliation, Blueprint, Wizard, render, storage, publication, promotion, production activation, release, or deployment.

## 10. Rollback, risks, and rejected alternatives

### Rollback

Before current v12/v10 evidence is consumed, revert the focused implementation commits and restore v11/v9 constants. If v12/v10 evidence has been emitted, preserve it byte-for-byte, mark the path HOLD, and use a reviewed forward correction or explicit versioned rollback. Never delete, rewrite, redigest, or promote historical live evidence.

### Principal risks

- missing one string-only producer would create a false claim of complete typed evidence;
- a locator that accepts arbitrary strings could leak authored/source/provider content under a structured label;
- separately recomputing readiness transitions could drift from the receipt;
- sorting attempts rather than only issue items could destroy chronological meaning;
- allowing typed identity to influence routing could silently change the paid call policy;
- broadening the change to Blueprint could create an unnecessary cross-system artifact migration.

### Rejected alternatives

- Persisting raw or redacted validator prose, drafts, prompts, responses, or provider messages.
- Regex-parsing error prose after the compiler has discarded source identity.
- Hashing authored values or storing arbitrary JSON Pointers as locators.
- Persisting only the final attempt, which hides repair progress and newly introduced issues.
- Recording only broad families, which repeats the current `15 -> 2 -> 2` ambiguity.
- Changing prompts, schema, model, budget, or repair selection in the same milestone.
- Funding another live attempt before typed diagnostics pass independent QA and new authority is materialized.
- Retrofitting the production Blueprint receipt without evidence that its separate repair loop must share this version cutover.

## 11. Review assignment and stop-check

Guy owns product intent and supplied standing approval for this no-policy-change implementation. Codex owns the separate implementation, focused commits, tests, `CURRENT.md`, and engineering handoff. Claude Code must independently try to falsify producer completeness, closed-catalog coverage, locator privacy, transition truth, cap/count semantics, receipt/readiness equality, exact-key and legacy behavior, unchanged repair inputs/routing, unchanged Blueprint contract, and all external-boundary sentinels. Claude Cowork review is unnecessary because no product, UX, story, visual, or creative decision remains.

Stop-check result:

1. This is a general system fix, not a story-specific patch.
2. Incorrect producer conversion could affect any Story Source, so exhaustive source-level and multi-story fixtures are required.
3. Persistent evidence changes; authoring, candidate, render, and downstream semantics do not.
4. Implementation and validation spend `$0`.
5. The smallest safe proof is repository-local tests, TypeScript, diff check, and the policy-correct repository gate; no live call or render.
6. Guy's standing authorization is sufficient because no model/budget/provider/downstream-policy change was found.
7. Claude Code should attack completeness, privacy, transitions, versioning, and unchanged behavior.
8. No Claude Cowork review is needed.
9. Guy has no visual artifact to eyeball in this milestone.

## 12. Do not do

Under this planning/documentation milestone and the later implementation milestone, do not access credentials; perform a pricing/network/provider/model call; run preflight, Fresh Readiness, Supervisor verify/live, or real authoring; change prompts or schemas; alter repair inputs/routing, model/tier/reasoning, token/call/repair budgets, timeout, retries/fallback, candidate semantics, `$4.884/$5.00` ceilings, or downstream policy; mutate any existing attempt artifact; render or use image/Vision; access storage/database/Supabase; perform Board, Semantic Reconciliation, Blueprint/package publication, Wizard execution, approval, promotion, production activation, deployment, or firewall changes; push; or start implementation in this documentation-only Task.
