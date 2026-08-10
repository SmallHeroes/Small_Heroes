# Decision Gate — R1D-PVB-D1A1B1-TYPED-PRESENTATION-REQUIREMENT-COVERAGE

## Outcome

Approve a general, typed presentation-review lane for source-grounded visual beats that are visible but are not action semantics. The lane must remain unreviewed until Semantic Reconciliation and must be proven through Blueprint/Wizard qualification before any render authority exists.

## Observed behavior and root cause

The Visual Contract authoring prompt requires every same-page Story Source visual beat to enter `actionSemanticCoverage`. The closed dispositions currently allow a typed action, a strict structured non-prose pointer, a non-visual rationale, or a terminal catalog gap. `mustShow` is intentionally excluded from `represented_elsewhere` because it is prose. Consequently static state, lighting, composition focus, graphic sound cues and ambient presentation requirements are forced into `unsupported`, even though Semantic Reconciliation already owns review of preserved visual presentation and Blueprint already consumes approved reconciliation evidence.

The defect is an authority-domain conflation: complete visual-beat accounting is being treated as synonymous with closed action-semantic representability.

## Non-negotiables

- General for every Story Source; no story, page, character, phrase or object literals.
- Do not widen or weaken `represented_elsewhere`.
- Do not make presentation evidence count as an action requirement or Action Semantic Catalog capability.
- Exact same-page `mustShow` pointer and exact current value are required.
- Source evidence remains compiler-resolved and exact.
- Semantic Reconciliation must explicitly preserve the exact contract evidence before Blueprint/Wizard qualification.
- No prompt/schema/model/budget/timeout/retry/fallback/candidate-policy change beyond this typed lane and its authority version cutover.
- Existing artifacts remain immutable and are not authority for a new attempt.

## Nine architectural decisions

1. Add the closed `presentation_requirement` Action Semantic Coverage disposition; it is coverage review evidence, not action authority.
2. Bind it to one exact same-page `mustShow` JSON pointer and exact string value, using the existing canonical pointer resolver.
3. Add a closed presentation-class catalog: `static_state`, `lighting_state`, `composition_focus`, `graphic_sound_cue`, and `ambient_event`.
4. Reject the lane when the pointer is missing, cross-page, outside `mustShow`, unresolved, or value-mismatched; keep `represented_elsewhere` unchanged.
5. Prompt policy forbids using this lane for bodily action, interaction, environmental phenomena acting on entities, movement/spatial effects, or current-frame typed spatial relations.
6. Candidate evidence remains `reviewState: unreviewed`; no authoring result self-approves the classification.
7. Current Source Prompt Reconciliation must embed the exact candidate Action Semantic Coverage authority and derive its mandatory presentation binding from that authority. Production file construction requires the exact persisted candidate. Semantic Reconciliation must then contain an approved preserved beat whose exact `contractEvidence` includes the presentation pointer and value. Missing or candidate-mismatched authority/evidence blocks Blueprint authoring.
8. Blueprint v4 and Wizard/render contracts remain unchanged; their existing reconciliation and Visual Contract inputs carry the qualified presentation evidence downstream.
9. Cut over draft/prompt/coverage and lifecycle authority versions fail-closed, keep historical artifacts immutable, and add exact positive, tamper, migration, Blueprint and Wizard qualification tests.

## Implementation order

1. Coverage contract, schema, compiler normalization, prompt policy and diagnostics.
2. Lifecycle version/digest bindings and legacy rejection.
3. Reconciliation qualification bridge plus Blueprint/Wizard zero-cost proof.
4. Focused tests, deterministic TypeScript, `git diff --check`, one repository check, evidence and independent QA handoff.

## Acceptance criteria

- A valid non-action source beat can bind only to an exact same-page `mustShow` item and a closed presentation class.
- Presentation coverage cannot satisfy an action requirement and cannot bypass action/spatial validators.
- Pointer/value tampering, cross-page references, duplicates and malformed classes fail closed with sanitized diagnostics.
- An unreviewed or unresolved presentation requirement blocks Blueprint authoring.
- An approved preserved reconciliation beat with exact pointer/value evidence passes Blueprint and Wizard dry qualification without changing Blueprint v4 or renderer behavior.
- Current reconciliation cannot be built or validated from Story Source plus template alone; an exact current candidate and its canonically verified coverage authority are mandatory.
- Old versions are rejected as legacy/non-authoritative for a new attempt.
- No provider, credential, Fresh Readiness, render or external-cost action occurs in this milestone.

## Rollback

Revert the focused implementation commits. No historical artifact is rewritten, so rollback restores the preceding closed-disposition and lifecycle authorities without data migration.
