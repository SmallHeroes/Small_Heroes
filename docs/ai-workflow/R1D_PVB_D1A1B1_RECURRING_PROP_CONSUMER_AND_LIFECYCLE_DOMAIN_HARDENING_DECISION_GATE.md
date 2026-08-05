# Decision Gate - R1D-PVB-D1A1B1 Recurring-Prop Consumer and Lifecycle-Domain Hardening

**Status:** PROPOSED - waiting for Guy's nine decisions; implementation is not authorized

**Date:** 2026-08-05

**Planning base / exact pushed HEAD:** `c7a1711374d03e6c02944c8c39f80ceda1911445`

**Planning branch:** `codex/r1d-pvb-d1a1b1-authority-reference-diagnostic-identity`

**Planning worktree:** `C:\Users\guyna\.codex\worktrees\6331\Small_Heroes`

**Planning cost/render allowance:** `$0` / zero renders

## 1. Executive decision

The two live failures are not evidence that lifecycle-gated props should be forced into fixed Set Board architecture. They expose an authoring-domain ambiguity: the draft field `setBoardStableAuthority.areas[].spatialNodes[].propId` looks like a general recurring-prop placement slot, but the compiler and final Set Board contract correctly interpret it as a stable fixed-object binding that must be safe on every page consuming that Set Board.

The proposed general fix is to make that stable-only meaning explicit in the draft schema and prompts, while retaining page-scoped recurring-prop placement in the already-existing page constraint and Blueprint frame domains:

- a **stable-set consumer** is permitted only for an ungated recurring prop with one stable placement that is never forbidden on any page consuming the Set Board;
- a **page-frame consumer** is permitted at or after reveal only when that page explicitly requires the prop, and is resolved later through the existing Blueprint placement-support/anchor domain;
- before reveal, on an explicitly forbidden page, or on an after-reveal page where the prop is merely permitted rather than required, no prop-bound page-frame consumer is authored;
- neutral supporting geometry may exist before reveal, but it may not bind, name, or visually imply the hidden prop.

This preserves fixed architecture as fixed architecture, gives portable/reveal-gated props a legitimate downstream path, and avoids changing the model, budgets, provider policy, final Blueprint contract, Wizard behavior, or render policy.

## 2. Exact live evidence

The consumed live attempt at the planning base completed one provider response and produced no candidate. Its typed terminal diagnostics contained exactly two unique issues:

| Issue code | Reference kind | Structural locator |
| --- | --- | --- |
| `recurring_prop_consumer_forbidden` | `set_area_node` | `authorityIndex: 0`, `areaIndex: 3`, `nodeIndex: 3`, `fieldRole: spatialNodes.propId`, `referenceClass: recurring_prop` |
| `recurring_prop_lifecycle_gated` | `set_area_node` | the same structural locator |

The canonical receipt v10 digest is `9e0ee610aeb80e1ab8fdca62c1a52dde6663970ad60116218d5d8e7f4e21cc52`; terminal readiness v8 digest is `7efa95564f20d3ce9c6036189325ff3a76dd889dd8548fd9c6cbac80df07f02e`. Conservative local accounting was `$0.668343`. The raw provider response was intentionally not persisted, so this gate does not guess the authored prop identifier or node prose.

The approved calibration Story Source proves the general lifecycle pattern without being production logic: a portable recurring object is absent and forbidden on early pages, is revealed later, remains available on later pages, and changes spatial position. Existing spoiler-safety fixtures already encode the correct base-set behavior by excluding such an object from Set Board fixed objects and zone bindings before reveal.

## 3. Observed behavior, expected behavior, and root cause

### Observed behavior

1. `SetBoardStableSpatialNode.propId` is documented as a stable fixed object.
2. The compiler treats every non-null Set Board node `propId` as a stable prop candidate.
3. It rejects the candidate when the recurring prop has any `firstRevealPage` with `recurring_prop_lifecycle_gated`.
4. It also rejects the candidate when the prop is forbidden on any page consuming that Set Board with `recurring_prop_consumer_forbidden`.
5. Only after those checks does it project the node into every location zone, create a prop `bindsTo`, and derive Set Board `fixedObjects`.
6. Final Set Board validation repeats the same invariants: a fixed object cannot be reveal-gated, cannot be forbidden on a consumer page, and must have one stable area placement.
7. The draft schema nevertheless exposes a generically named nullable `propId`, and the provider prompt must explain its narrow semantics in prose.

### Expected behavior

- The draft contract itself distinguishes stable-set binding from page-frame placement.
- A reveal-gated or portable recurring prop is expressed through page lifecycle constraints, not through a Set Board fixed-object slot.
- The compiler continues to reject any attempt to bind a gated or consumer-forbidden prop into stable Set Board authority; it never silently strips or demotes the binding.
- Blueprint feasibility accepts an explicitly required post-reveal prop only with valid page placement support, and rejects pre-reveal/forbidden placement.
- Wizard qualification consumes the approved Visual Package and Blueprint without inventing a second lifecycle model.

### Root cause

The final runtime domains are already separated, but the provider-facing draft domain is not explicit enough. `spatialNodes.propId` is semantically a stable-fixed binding even though its name resembles a general prop reference. Prompt prose is carrying a distinction that belongs in the typed authoring contract.

This is an authoring representation defect, not a reason to weaken the final Set Board validator and not a reason to make a portable prop part of fixed architecture.

## 4. Domain model and precise lifecycle rule

### Stable-set consumer

A recurring prop may bind to a stable Set Board spatial node only when all of the following are true:

1. its authority is uniquely declared;
2. `firstRevealPage` is absent;
3. no page consuming that Set Board/location explicitly forbids it;
4. its placement is genuinely stable across those consumers;
5. its Set Board area/node binding is unique and compiles to one final fixed-object/zone binding.

Such a prop is part of the persistent set. It may appear in the character-free Set Board and may be used by downstream Blueprint geometry as a stable object.

### Page-frame consumer

A lifecycle-gated or portable recurring prop must not bind to stable Set Board authority. It becomes eligible for a page-frame spatial consumer only when:

1. the page is at or after `firstRevealPage` (when one exists);
2. effective visibility is not `forbidden`;
3. that page explicitly declares the prop `required`;
4. Blueprint supplies a compatible `placement_support` consumer, using the page's exact `anchorId` when one is declared;
5. frame feasibility, capacity, zone, and safety constraints pass.

An after-reveal page with no explicit `required` constraint leaves the prop merely permitted and does not create a mandatory prop-bound consumer. Moving the prop between later pages is represented by page-scoped placement/anchors and frame composition, not by mutating the stable Set Board.

### Gated states

The prop remains gated:

- before `firstRevealPage`;
- on every page with effective visibility `forbidden`;
- whenever the page does not explicitly require a prop-bound placement;
- whenever no valid placement support exists;
- throughout the base Set Board if the prop has any lifecycle gate or is not spatially stable.

Neutral support geometry can remain available throughout the set, but it must be spoiler-neutral and must not bind or name the hidden prop. A future post-reveal Set Board variant would be a new product/runtime feature and requires a separate Decision Gate; it is not introduced here.

## 5. Proposed implementation shape

### Draft-only stable binding

Rename the provider-facing draft field from ambiguous `spatialNodes.propId` to flat nullable `spatialNodes.stablePropId`. The flat field preserves Structured Outputs nesting headroom and states the contract directly. It is not a new general prop-placement field.

The compiler must:

- validate `stablePropId` with the existing unique authority, lifecycle, consumer-safety, and stable-placement invariants;
- preserve the existing typed issue identities, updating only their closed field role to `spatialNodes.stablePropId`;
- normalize a valid draft binding into the existing final Set Board `propId`, zone `bindsTo`, and `fixedObjects` representation;
- reject any gated/forbidden binding fail-closed rather than deleting it, converting it to architecture, or routing it to repair automatically.

The initial and full-draft repair prompts must name the two consumer scopes explicitly. Reveal-gated/portable props go to page `propConstraints` and later Blueprint placement; only globally safe stable props may populate `stablePropId`.

### Final contract and downstream boundaries

No shape change is proposed for:

- final `BookVisualContractTemplate` / `vc-schema/v4`;
- final Set Board v4 authority/registry/content contracts;
- Action Semantic Catalog/Coverage;
- Blueprint v4 and Blueprint draft schema v5;
- Visual Package v5;
- approved runtime authority v6;
- Wizard runtime contract;
- render request or renderer.

Those surfaces must receive new qualification coverage, but their current typed domains already express page lifecycle, placement support, reveal-safe supporting geometry, and provider-unreachable Wizard qualification.

## 6. Nine architectural decisions for Guy

1. **Two closed consumer scopes.** Approve `stable_set` and `page_frame` as the only recurring-prop spatial-consumer scopes. A prop is never inferred from one scope into the other, and no generic third scope or fuzzy fallback is allowed.

2. **Stable-set eligibility.** Approve stable Set Board binding only for a uniquely declared prop with no `firstRevealPage`, no forbidden consumer page, and one genuinely stable placement. Any lifecycle gate, consumer prohibition, ambiguity, or mobility keeps it out of Set Board fixed authority.

3. **Post-reveal page-frame eligibility.** Approve a prop-bound page-frame consumer only at/after reveal on a page that explicitly marks the prop `required`, with valid Blueprint placement support and exact anchor enforcement when `anchorId` exists. `permitted` without `required` creates no mandatory consumer; pre-reveal or forbidden remains gated.

4. **Explicit draft-only field.** Approve replacing provider-facing draft `spatialNodes.propId` with nullable `spatialNodes.stablePropId`, while normalizing a valid stable binding into the unchanged final Set Board `propId` representation. No authored general prop placement is added to Set Board.

5. **Compiler and validator ownership.** Approve compiler-owned exact binding and fail-closed validation as the sole authority. Preserve `recurring_prop_lifecycle_gated` and `recurring_prop_consumer_forbidden`; update their closed locator field role to `spatialNodes.stablePropId`. Do not silently drop, rewrite, demote, repair, or force-fit an invalid binding.

6. **Prompt/schema and authority cutover.** Approve `vc-draft-schema/v12 -> v13`, initial system/user prompts `v9 -> v10`, repair system `v8 -> v9`, and repair user `v9 -> v10`. Approve a fail-closed lifecycle cutover to request v10, receipt v11, readiness v9, candidate v7, B0 materialization input v6, manifest/verification v8, pre-live readiness evidence v7, and Execution Request/readiness/result v7/v7/v5. Keep canonical materialization input v1, OpenAI evidence v3, provider-failure evidence v2, final VC v4, Blueprint v4, Visual Package v5, and runtime v6 unchanged unless implementation proves their serialized shapes changed.

7. **Immutable migration.** Approve no in-place migration or redigest of old B0, readiness, execution, receipt, candidate, or draft artifacts. Existing valid final v4 contracts may remain readable because their final Set Board shape is unchanged, but every future authoring attempt must use the new draft/prompt/lifecycle authority. Old provider drafts are historical only and cannot be current authority.

8. **Bounded proof through Wizard.** Approve repository-local tests covering the complete stable/gated/page-frame matrix, Structured Outputs compatibility, typed diagnostics, compiler projection, final validators, Blueprint feasibility, lifecycle digests, and zero-cost Wizard qualification with image/provider sentinels unreachable. Production code may contain no calibration-story literal or exception.

9. **Rollback and unchanged budgets.** Approve commit-level rollback before reliance on the new versions; after new artifacts exist, preserve them as historical evidence and place the path on HOLD rather than reinterpret them. Model, service tier, 64K input ceiling, prompts' information content beyond the approved domain clarification, call/repair budget, timeout, transport retries `0`, no fallback, `$4.884/$5.00` ceilings, candidate semantics, resemblance threshold, and all downstream approvals remain unchanged.

Guy should approve, amend, or reject these nine decisions as one architecture. Codex does not self-authorize implementation.

## 7. Versioning and migration detail

The draft field rename changes the structured-output schema bytes and all prompt bytes that describe the field. The lifecycle artifacts that bind those identities must therefore cut over together. Current-version validators must reject earlier authorities before credential reachability even if an older artifact is copied or canonically redigested.

Historical live artifacts, including the two-issue terminal attempt, remain byte-immutable evidence. They are not reclassified by the new semantics. No old failure is converted into a candidate, and no new candidate is synthesized from provider output that was intentionally discarded.

The final Visual Contract and Blueprint shapes remain unchanged. A valid legacy final contract containing a truly stable fixed prop may continue to validate as historical/final data, but it does not authorize a fresh live attempt. Any new current candidate must descend from the v13 draft and new authority chain.

## 8. Test plan and acceptance criteria

### Contract/compiler tests

- an ungated, never-forbidden, uniquely placed stable prop compiles from `stablePropId` into final fixed object and zone binding;
- a `firstRevealPage` prop in `stablePropId` fails with exactly `recurring_prop_lifecycle_gated`;
- a prop forbidden on any consuming page fails with exactly `recurring_prop_consumer_forbidden`;
- type/cardinality, duplicate authority, ambiguous placement, and missing authority remain fail-closed;
- a reveal-gated portable prop with no stable binding, pre-reveal forbidden constraints, and reveal/later required constraints compiles without being projected into the Set Board;
- neutral support geometry projects without a prop binding and contains no prop-derived identity or prose;
- the provider-facing schema accepts `stablePropId`, rejects legacy/extra `propId`, remains OpenAI Structured Outputs compatible, and retains depth headroom;
- production modules contain no story, character, page, object, or phrase literal from the calibration case.

### Blueprint/Wizard tests

- pre-reveal and explicitly forbidden page placement is rejected;
- a required reveal/later prop with compatible placement support is accepted;
- required placement without support, wrong zone, capacity breach, or wrong anchor is rejected;
- later page placement may use a different valid region/anchor without changing stable Set Board authority;
- a merely permitted prop creates no required Blueprint consumer;
- zero-cost Wizard qualification passes for the valid package while image generation and all provider boundaries remain unreachable.

### Lifecycle and authority tests

- every new version/digest is bound by B0, verifier, Fresh Readiness, Execution Request, and Supervisor verification;
- all superseded versions are `legacy_immutable` or unsupported as specified and fail before credential access;
- prompt/schema identity tampering, old-field injection, and canonical redigesting fail closed;
- receipt/readiness/candidate equality and typed terminal diagnostics remain valid through persistence/reload;
- model, budgets, retry/fallback, pricing ceilings, candidate semantics, Blueprint bytes, and runtime contracts are unchanged where promised.

### Required validation

An implementation milestone must pass focused suites, deterministic TypeScript, `git diff --check`, and one policy-correct `npm run check`. The six established ignored-fixture failures remain a separate release HOLD and are not waived by this Decision Gate; any seventh assertion or infrastructure failure stops the milestone. Independent Claude Code review is required before a new Fresh Readiness.

Acceptance is met only when both observed issue classes have a general valid representation that does not bind a lifecycle prop into fixed architecture, invalid stable binding remains terminal, and a zero-cost full candidate-to-Blueprint-to-Wizard fixture proves the path without reaching a provider or renderer.

## 9. Exact path to one LOW portrait render

This gate shortens the route but does not authorize any step below:

1. implement the approved draft-domain hardening and pass independent Claude Code QA;
2. push the reviewed immutable implementation head;
3. create and audit a new canonical Fresh Readiness/Execution Request bound to that head and authority chain;
4. separately authorize one bounded live authoring attempt under the unchanged `$5.00` ceiling;
5. require a valid Visual Contract candidate, then perform actual Semantic Reconciliation and Guy's product/content acceptance;
6. author and validate Blueprint v4 / Visual Package v5, then pass real Wizard qualification for one chosen portrait page;
7. separately verify current image pricing and authorize exactly one local `gpt-image-2` LOW portrait render;
8. save the image and sanitized evidence locally for Guy's visual judgment.

No full-book render, Vision run, storage/database write, Board publication, promotion, production activation, or deployment is part of that measurement.

## 10. Rollback, rejected alternatives, and review assignment

### Rollback

Before any new authority is consumed, revert the focused implementation commits and restore the prior current constants. If new-version artifacts have been emitted, preserve them byte-for-byte, mark them non-current/HOLD, and use a reviewed forward correction. Never rewrite historical evidence or make an old readiness current again.

### Rejected alternatives

- **Allow reveal-gated props in Set Board after reveal:** one Set Board is a stable base authority and has no page phase; this would make its meaning page-dependent.
- **Treat the portable prop as fixed architecture:** semantically false and incompatible with later movement.
- **Silently remove an invalid `propId`:** hides provider error and may produce a visually incomplete candidate.
- **Prompt-only wording with the same ambiguous field:** repeats the current reliance on prose instead of a typed boundary.
- **Add a general page-prop placement field to Set Board:** duplicates Blueprint ownership and creates two competing placement authorities.
- **Automatically repair these failures:** they are not Source-Evidence-ID-only and the current repair policy does not authorize semantic remapping.
- **Version every downstream artifact:** unnecessary when final serialized contracts remain unchanged; only changed/binding authorities should cut over.
- **Create post-reveal Set Board variants now:** broader product/runtime architecture requiring a separate Decision Gate.

### Review assignment

Guy owns the nine architecture decisions and later product/visual acceptance. Codex owns implementation and executable evidence after approval. Claude Code must independently falsify the immutable implementation range, especially stable-vs-page scope, schema compatibility, migration, no story literals, Blueprint/Wizard qualification, and unchanged budgets/downstream contracts. Claude Cowork is optional only if Guy wants product/creative review of how movable props should appear; it is not required for this technical domain boundary.

## 11. Do not do under this planning gate

No production-code, schema, test, fixture, or configuration change; no dependency install; no B0/Fresh Readiness/Execution Request materialization; no credential check/read/load; no pricing or network lookup; no provider/model call; no preflight or live authoring; no render/image/Vision; no storage/database/Supabase; no Board action; no Semantic Reconciliation; no Blueprint/package publication; no approval/promotion/activation; no deployment/firewall change; no push; and no implementation before Guy explicitly approves all nine decisions.
