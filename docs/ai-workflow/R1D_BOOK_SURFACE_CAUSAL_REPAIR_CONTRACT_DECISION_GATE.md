# R1D Book Surface Causal Repair Contract — Decision Gate

**Date:** 2026-08-18
**Owner:** Codex (technical)
**Product authority:** Guy's standing instruction to continue the bounded QA-authoring path; no product/creative choice is changed here
**Base:** pushed `f9797c20169309944d0cfdd2ef37edf871a6f610`
**Branch:** `codex/r1d-book-surface-causal-repair-contract`
**Status:** approved technical execution brief; implementation in progress;
pre-spend schema-admission amendment recorded below

## 1. Proposed change

Replace the current whole-page Book Surface repair authority with one causal,
field-scoped repair contract and align the structured action schema with the
already-authoritative Action Semantic Catalog.

The milestone will:

1. derive strict action-requirement JSON-schema groups from the catalog for
   the bounded repair roots that may rewrite whole action semantics, so those
   repair responses cannot encode catalog-forbidden subject/object/spatial/
   laterality combinations, grouping predicates only when their complete
   static rule signatures are identical;
2. split the current cross-field diagnostic bucket into closed subcauses while
   keeping page identity, raw emission count, routing keys and transition
   semantics stable;
3. retain exact causes in Book Surface authority and derive a closed writable
   field set per page; every other returned field must equal the current draft
   and remains visible to the non-target drift guard;
4. add bounded read-only validator context for affected pages, including exact
   per-page presence/anchor/safety facts, immutable action/coverage bindings,
   lifecycle obligations and transition context where relevant; none of this
   becomes output authority;
5. preserve the exact ordered action beat/binding identity in this repair lane;
6. append only missing deterministic `projectPageMustShow` and
   `projectPageMustNotShow` strings after grounding, preserving all existing
   prose, order and presentation pointer indexes, then run the unchanged full
   validator;
7. reject Book Surface authority when a cause has no safe writable field.

The response remains strict and atomic. It may continue to return the complete
page structural shape, but only cause-authorized fields are applied; all other
fields must be exact echoes.

## 2. Why now?

The sole canonical attempt under
`outputs/r1d-hint-admission-observability-fresh-f9797c20-20260817T211128482Z`
ended fail-closed without a candidate. Receipt v34
`c2d01c1ede28e2abce726c8a904c1356a61700b7930f2176ef8b629d263a276e`
records exactly three completed provider calls, two repairs, zero retries and
no fallback at `$1.652015 / $1.826229` nominal/conservative cost. The route was
`initial -> book_surface_patch -> book_surface_patch`, proving the preceding
aggregate-count correction worked.

Attempt one carried twelve page `page_action_requirements_invalid` causes.
Attempt two resolved cover, presentation and lifecycle but left ten broad
cross-field causes and two action causes. Attempt three retained eight broad
cross-field causes, regressed four pages to action causes, and newly introduced
recurring-prop lifecycle failure.

That lifecycle regression has one deductive mutation source. The second repair
had `recurringPropAuthority:null`, so `recurringProps[].firstRevealPage` could
not change. The validator derives lifecycle only from those values and page
`propConstraints`; the whole-page applier nevertheless masked and rewrote every
affected page's `propConstraints`. The repair therefore changed an unrelated
field while blind to the lifecycle facts it had to preserve.

The same contract lets the provider rewrite action requirements without exact
per-page presence/anchor/safety/coverage context. Its strict schema also admits
static catalog-invalid action combinations that the final validator rejects.
Another paid run through this unchanged contract would knowingly reproduce a
proven authority/context defect.

## 3. Scope

This is a general compiler and bounded-repair contract correction. It is not a
Dini-, page-, child-, companion-, story- or style-specific patch.

In scope:

- action schema/catalog parity;
- page structural subcauses and diagnostic versioning;
- Book Surface input authority, prompt, masking, application and admission;
- compiler-owned page prose projection;
- canonical authoring/Fresh authority cutover required by changed prompt/schema
  digests;
- focused lifecycle, materialization and boundary regressions;
- CURRENT/evidence and independent Claude Code review.

Out of scope:

- model, provider, reasoning, service tier, timeout, call/repair caps, output
  token schedule, retries, fallback or `$5` fence;
- action catalog semantics, Story Source, candidate/Blueprint/Visual Package/
  Wizard schemas, image generation, render policy, Reader, storage/database,
  deployment or production;
- any story-specific literal or provider-response persistence.

## 4. Risk of hardcoding

No story/page literal is allowed. Writable fields are derived only from closed
diagnostic causes. Static action schema branches are generated from the current
catalog, not duplicated by hand. Read-only context is derived from current
compiler authority. Tests must use multiple predicates, pages and failure
families and must reject cross-story/cross-page/tampered bindings.

## 5. Exact authority decisions

### 5.1 Action schema

- Generate exactly one strict branch per unique Action Semantic Catalog static
  rule signature. Every predicate must appear exactly once, and predicates may
  share a branch only when subject kinds, object rule/kinds, spatial-effect
  rule, spatial-constraint rule/relations and laterality are all identical.
- Deduplicate repeated field schemas through local root `$defs`/`$ref`. A naive
  34-branch inline encoding measured 45,118 schema bytes and would exceed the
  canonical input ceiling; the grouped encoding must remain below every
  affected route's existing admission limit.
- Pre-spend corpus measurement found that even the grouped schema adds 9,568
  bytes to the whole-draft root: three canonical 12-page QA inputs would become
  unreachable at 65,681--72,384 bytes, and the approved-source minimum
  headroom would fall to 748 bytes. Therefore the initial/full-draft root and
  the already-admission-proven Page Contract root retain their exact generic
  action schema and current versions. Their unchanged final validator still
  rejects every catalog-invalid action. The catalog-strict fragment is scoped
  to Book Surface and Structural Bundle, the bounded whole-semantic page
  rewrite roots that fit it and can otherwise regress valid action fields.
- Do not raise 64K, lower the 1,024-byte corpus guard, strip Story Source
  authority, or relabel an over-limit request as admissible.
- Encode permitted subject kinds, object rule/kinds, spatial-effect rule,
  spatial-constraint relations and laterality directly from the catalog.
- Preserve empty `actionRequirements:[]` legality; the existing compiler
  omission bridge remains authoritative for true no-action pages.
- Dynamic references, same-page presence, source grounding and coverage remain
  validator/compiler responsibilities.

### 5.2 Closed structural subcauses

Replace the current producer's broad cross-field cause with distinct closed
causes for action/constraint conflict, resolved check-ID collision by check
kind, and page steering projection containment. Keep the retired broad literal
readable only as immutable legacy diagnostic authority. The issue key remains
family + code + page locator, so causes union on the same page without changing
unique counts or routes.

### 5.3 Cause-to-field authority

`locationId` and `zoneId` are always copied and never mutable. `sameLocationAs`
has no active validator consumer and is not mutable in this lane.

The current writer may authorize only:

| Current cause | Writable page fields |
| --- | --- |
| `page_steering_invalid` | `mustShow`, `mustNotShow`, `camera` |
| `page_prop_state_invalid` | `propState` |
| `page_prop_constraints_invalid` | `propConstraints` |
| `page_action_requirements_invalid` | `actionRequirements` |
| `page_action_constraint_conflict_invalid` | `actionRequirements` |
| `page_action_check_id_collision_invalid` | `actionRequirements` |
| `page_prop_check_id_collision_invalid` | `propConstraints` |
| `page_transition_invalid` | `transition` |

Projection containment is compiler-owned and grants no provider field. Safety,
cast/presence, spatial-identity and human-presence causes have no safe writable
field here and make Book Surface authority unavailable. A safety check-ID
collision is likewise ineligible because safety is not an output field.

Multiple causes on one page union only their listed fields. A field outside the
union must equal the current draft byte-for-byte and is never masked or applied.

### 5.4 Read-only validator context

For each affected page, send only bounded structured facts needed to preserve
the allowed edit:

- compiler-derived `castIds` and presence facts;
- location anchor IDs and zone spatial IDs;
- scrubbed safety structure without source prose;
- ordered action-binding authority
  `{actionIndex, beatId, coverageIndex, sourceEvidenceId}`;
- per-page pre-reveal prop obligations derived from current
  `firstRevealPage` values;
- compact page/transition topology when transition is writable.

The provider never returns these fields. Raw Story Source, source phrases,
validation prose beyond existing sanitized hints, responses, stack traces,
paths, credentials and secrets are forbidden.

Action repair must preserve exact action count and ordered beat IDs. Existing
dedicated binding routes remain the only authority to add/split/rebind action
coverage.

### 5.5 Compiler-owned page projection

After source grounding and fact overlay, when the existing prose arrays are
valid string arrays, append each missing exact projection string in projection
order. Never erase, reorder or rewrite existing strings. Append-only behavior
keeps existing presentation pointer indexes stable. Malformed arrays remain
invalid. Full source, structural, action-semantic and candidate validation still
runs; conflicts and check-ID collisions are not waived.

This follows the repository's existing doctrine that page prose is a projection
of authoritative structure and the existing cover projection precedent.

## 6. Expected behavior after change

- Static catalog-invalid actions cannot cross a Book Surface or Structural
  Bundle structured-output boundary, and cannot cross final validation on the
  unchanged initial/full-draft or Page Contract boundaries.
- A page repair cannot regress an already-valid unrelated field.
- `propConstraints` cannot change during an action/cross-field-only repair, so
  the observed lifecycle regression is mechanically impossible.
- Action semantics may be repaired without changing beat/coverage identity.
- Presentation-page action repair cannot deadlock on a stale derived
  `mustShow`: the compiler appends the exact missing projection without moving
  the selected pointer.
- Every applied repair is fully reassembled and revalidated. No diagnostic is
  waived and no candidate is emitted unless all gates pass.
- The standard schedule remains three calls/two repairs and
  `[40000, 32000, 36000]` with no retry/fallback expansion.

## 7. Likely files

Primary:

- `lib/visual-contract-compiler/actionSemanticCatalog.ts`
- `lib/visual-contract-compiler/templateDraftSchema.ts`
- `lib/visual-contract-compiler/draftValidationDiagnostics.ts`
- `lib/visual-contract-compiler/validateBookVisualContract.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/bookSurfaceRepair.ts`
- schema consumers for page-contract and structural-bundle repair
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- canonical B0/materialization/Fresh/Supervisor authority files required by the
  prompt/schema digest cutover.

Tests:

- template/action schema compatibility and catalog census;
- draft-validation diagnostics and base/vNext validation;
- Book Surface unit, repair loop and source-authority lifecycle;
- page-contract/structural-bundle schema compatibility;
- materialization, pre-live, Supervisor and boundary version/digest suites.

Documentation:

- `CURRENT.md`
- implementation evidence for this milestone.

## 8. Validation plan

Before any spend:

1. exact catalog parity in the catalog-strict repair fragment: every predicate
   exactly once and rule-by-rule match; the initial v15 and Page Contract v2
   schemas remain byte/digest and admission stable;
2. schema compatibility/depth tests and explicit former counterexamples;
3. empty-array omission/retention invariants;
4. each new subcause alone and in canonical unions, with unchanged issue key,
   emitted count, unique count and transition behavior;
5. exact cause-to-field positive cases and hostile drift for every other field;
6. lifecycle cannot regress when recurring-prop authority is null;
7. read-only context exactness, privacy, tamper and compact roundtrip;
8. ordered action beat/binding identity preservation and output exclusion of
   action coverage;
9. append-only projection preserves extras/order/pointers, is idempotent, and
   does not hide malformed arrays, action conflicts or collisions;
10. live-shaped twelve-page route reaches a candidate within exactly three
    calls/two repairs and unchanged caps, with no introduced action/lifecycle
    identity and both repair inputs at least 4,096 bytes below the 64K ceiling;
11. current/legacy version and digest/tamper coverage through Fresh/Supervisor;
12. affected focused suites, `npx --no-install tsc --noEmit`, one literal
    `npm run check`, and `git diff --check`;
13. independent Claude Code read-only review of the immutable range.

Known missing ignored-output fixtures and any Vitest RPC timeout remain separate
release HOLDs and are not waived.

## 9. Version and migration plan

Expected current cutover, subject to exact implementation census:

- draft schema remains v15;
- page-contract repair schema remains v2;
- structural-bundle repair schema v2 -> v3;
- Book Surface schema/prompt/user prompt v4 -> v5;
- draft-validation attempt diagnostics v3 -> v4;
- authoring request/receipt/readiness v30/v34/v32 -> v31/v35/v33;
- B0 input/manifest/verifier v19/v28/v28 -> v20/v29/v29;
- execution materialization input/result v18/v22 -> v19/v23;
- canonical Supervisor request/readiness/result v27/v27/v20 -> v28/v28/v21;
- Fresh Readiness evidence v27 -> v28.

Immediate predecessors become immutable legacy authority where the repository
supports legacy status. Candidate v9, policy v12, standard budget v2, OpenAI
evidence, child-output authority and QA Wizard manifest shapes remain unchanged
unless an exact compile-time shape dependency proves otherwise. Historical
artifacts are never rewritten or upgraded.

## 10. Cost impact

Implementation, tests and independent review: `$0` provider/image cost.

After green independent QA and push, at most one brand-new canonical bounded
authoring attempt may run under a new Fresh package. It retains the existing
hard `$5` reservation and zero retries/fallback. No image, Vision or render is
authorized by this Gate.

## 11. Rollback plan

Revert the focused Gate/implementation/evidence commits. Historical artifacts
remain immutable; no data migration or artifact rewrite is required. Do not
reuse a Fresh package created for the reverted head. No production rollback is
needed because production is untouched.

## 12. Review assignment

Guy has no unresolved product decision: this preserves existing semantics and
narrows technical mutation authority. Codex owns implementation and validation.
Claude Code must try to falsify catalog parity, cause attribution, writable-field
minimality, context privacy/completeness, binding identity, projection pointer
stability, input admission, version cutover and non-regression of all budgets and
downstream gates.

Claude Cowork is not required because no product, UX, story or visual decision
is being made.

## 13. Do not do

- no story/page literal or Dini-only rule;
- no raw prompt/response/draft/error/secret persistence;
- no diagnostic waiver, hidden fallback, extra call/repair, retry or model change;
- no full-draft substitution for an ineligible causal repair;
- no candidate/Wizard/render authority without canonical validation;
- no credential access, provider call, Fresh Readiness, image, Vision, render,
  storage/database, deployment, production or push during implementation;
- no full-book render under this Gate.
