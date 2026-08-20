# R1D Blueprint Static Spatial Constraint Feasibility — Implementation Evidence

## Outcome

The Blueprint validator now accepts exact typed fixed-set geometry for a static
`beside` constraint. `cast` and `prop` targets remain bound to their unique
current-frame placement; `spatial` and `anchor` targets must instead have
exactly one matching, resolving `spatialTargetRegions` entry on the selected
action-space affordance. All existing horizontal-gap, vertical-overlap,
non-overlap, subject-placement, consumer, participant and capacity rules remain
unchanged.

## Root cause

The draft schema and prompt already authorize typed spatial target regions, but
`staticSpatialConstraintIsFeasible` called `placementForEntity` for every
target kind. That helper intentionally returns placements only for cast and
props, and the schema intentionally has no spatial-node placement subject. A
valid action such as “companion sits beside fixed bed geometry” was therefore
unrepresentable regardless of draft quality.

## Exact offline proof

The approved Chameleon Production Authoring Context was used to construct one
complete provider-free whole-book draft:

- 1 cover + 8 page frames;
- 6 authored transition connections;
- 54 typed spatial affordances;
- draft digest `07e69767e11244dbb81d439175958b0f52fe0a4eb12dffc53d69d1e6173eb980`;
- compiled Blueprint digest `1d52af9e2de461aa981e7d17a9324b7b5c9be9cdaca21a70e01de7befd5ed72f`.

Before the correction, validation returned exactly one
`action_infeasible` issue for page 8's static relation to `sp_bed`. With the
same immutable context and same content-addressed draft, validation returns
`ok:true` and zero issues. Boundary evidence remains zero provider, credential,
network, image, database and production activity.

## Regression coverage

The direct validator suite proves:

- exact spatial-node target geometry is accepted;
- a missing or duplicate target region is rejected;
- overlapping geometry is rejected;
- existing cast-group/current-prop-placement static behavior stays green;
- missing prop placement and fabricated static destinations remain rejected.

Focused validation:

- `pre-render-book-visual-blueprint.spec.ts`: 110/110 PASS;
- `pre-render-blueprint-authoring.spec.ts`: 14/14 PASS;
- `pre-render-blueprint-lifecycle.spec.ts`: 9/9 PASS;
- combined: 3 files / 133 tests PASS;
- `npx tsc --noEmit`: PASS;
- `git diff --check`: PASS;
- one literal `npm run check`: TypeScript and autonomous Story typecheck PASS;
  resource-intensive 20 files / 610 tests PASS; ordinary 3,345 tests PASS,
  65 skipped, and only the five established ignored-`outputs/` fixture
  assertions failed in four unchanged specs.

## Unchanged behavior

No Story Source, Visual Contract, Candidate, reconciliation, schema, prompt,
version, model, budget, retry/fallback, Wizard, renderer, style, database or
production behavior changed. No provider or media generation occurred.

## Independent QA targets

Claude Code should attempt to falsify target-kind separation, exact region
cardinality, reference resolution, geometry boundary behavior, unchanged
prop/cast placement authority, and the claim that no schema/prompt/version or
render-policy surface changed.
