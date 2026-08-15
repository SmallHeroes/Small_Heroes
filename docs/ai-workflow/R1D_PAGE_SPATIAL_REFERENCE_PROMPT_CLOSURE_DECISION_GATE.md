# R1D Page-Spatial Reference Prompt Closure — Decision Gate

## 1. Proposed change

Make the existing page-spatial reference domain explicit in both initial and
full-draft authoring system prompts: every `{kind:"spatial",id}` used by a
page action or safety constraint must equal a `spatialNodes[].id` in that
page's exact `zoneId`. Closed non-spatial reference forms remain available.

## 2. Why now?

The consumed Leo v10 attempt proved that source-only full-draft regeneration
and bounded child output work. The third provider response resolved all 25
prior structural/action-semantic issues but introduced nine
`page_spatial_reference_outside_zone` issues. The compiler correctly rejected
them after the unchanged three-call budget was exhausted. The initial prompt
described zone authority but did not state the same-page membership invariant
at the action-reference authoring point.

## 3. Scope

General prompt-authority correction for every Story Source. No Leo, page,
child, companion, authored id, or provider-output literal is added.

## 4. Risk of hardcoding

Low. The rule restates an existing typed validator invariant and closed
reference domain. It does not add an accepted value, special case, heuristic,
or fallback.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- prompt/lifecycle/materialization regression tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

Initial and full-draft authors choose spatial ids only from the page's own
zone. Location, zone, Set Board area, prose, cross-zone, and invented ids are
explicitly forbidden. The validator remains unchanged and fail-closed.

## 7. Validation plan

Direct prompt regression for both initial and inherited full-draft prompts;
focused compiler/lifecycle/materialization tests; deterministic TypeScript;
`git diff --check`; one repository check if the focused surface is green.
After independent QA and push, rematerialize Fresh Readiness and allow one
final bounded live attempt. Render only after a valid candidate, Reconciliation,
Blueprint, and Wizard qualification exist.

## 8. Cost impact

Implementation and QA cost $0. The correction adds a small fixed prompt line
well inside the measured 64K headroom. A later live attempt retains one initial
plus at most two repairs, `$4.884` projected maximum and `$5.00` hard ceiling.

## 9. Rollback plan

Revert the focused prompt/test/documentation commits. Existing v12 prompt
authorities and all historical artifacts remain immutable but are not authority
for a new attempt.

## 10. Review assignment

Guy has already authorized continuous progress to a render and this final
corrected attempt. Claude Code must falsify same-page zone coverage, version
bindings, unchanged validator/schema/policy/budgets, ceiling headroom, and lack
of story-specific content before push/readiness.

## 11. Do not do

Do not change schema, validator acceptance, model, service tier, reasoning,
64K ceiling, call/repair budget, timeout, transport retries, fallback, cost
ceilings, candidate semantics, Blueprint/Wizard behavior, image generation,
storage/database, production, or existing attempt artifacts.

## Stop-check

This is a general system fix, changes production prompt authority, spends no
money during implementation, and is validated without images. The smallest
later product proof remains three LOW Leo pages. Guy should eyeball those pages
only after all canonical downstream gates pass.
