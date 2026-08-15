# R1D Compound Page Authority Repair Routing — Decision Gate

## 1. Proposed change

Collect page-local action-binding cardinality issues and page-spatial reference-domain issues from the same authored draft before selecting a repair route. Preserve the existing compact route for either homogeneous family. Route the closed mixed family through one bounded `full_draft` repair carrying both typed diagnostic sets.

## 2. Why now?

The consumed Leo v11 attempt exposed a validation-order blind spot. Its full-draft response contained one page-7 action-binding cardinality issue and page-spatial reference failures on other pages. The compiler threw the cardinality authority error before checking page-spatial domains, spent the last repair on page 7 alone, and discovered the remaining spatial failures only after the three-call budget was exhausted. The page-contract repair did not and could not create failures on pages it never received.

## 3. Scope

General compiler and repair-routing behavior for every Story Source. No Leo, page-7, companion, child, phrase, location, node-id or story-specific literal is admitted.

## 4. Architectural decisions

1. Page-spatial validation becomes a pure collector that returns typed issues plus exact per-page zone authority; its fail-closed public behavior remains unchanged at the compiler boundary.
2. Spatial collection runs against the canonical page draft independently of action-semantic grounding, so a failure in either layer cannot hide the other.
3. Action-binding cardinality and page-spatial issues from one draft are normalized into one `DraftAuthorityReferenceDomainError` when both exist.
4. Homogeneous page-spatial failures retain `page_spatial_reference_patch`; homogeneous action-binding cardinality failures retain `page_contract_patch`.
5. Only the exact closed mixed set—repairable page-spatial issues plus repairable action-binding cardinality issues—may fall through to the existing `full_draft` route with both sanitized diagnostic sets. Any third authority family remains terminal.
6. Model, endpoint, service tier, prompt/schema authority, 64K ceiling, call/repair budget, timeout, transport retry, fallback and $4.884/$5.00 ceilings remain unchanged.
7. No raw provider material, authored rejected ids, source phrase, prompt, response, stack or credential is added to persisted diagnostics. Existing typed page/item locators remain the durable identity.
8. Regression coverage must prove mixed-family co-observation, one final full-draft repair, preservation of both homogeneous compact routes, no extra call, and unchanged terminal behavior for an unapproved mixed authority family.
9. Historical artifacts remain immutable and cannot authorize a new attempt. The code change requires a fresh canonical readiness authority before another live call.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- focused compiler/repair-loop tests
- `CURRENT.md`
- implementation evidence

No image generation, Reader, Wizard, payment, storage, deployment or production file is in implementation scope.

## 6. Expected behavior after change

When a draft has both a repairable action-binding cardinality defect and repairable same-page-zone spatial references, the next and only remaining provider repair receives both typed failure sets and regenerates one complete draft. A successful response then proceeds through the full validators. No repair is granted for unknown or deterministic authority failures.

## 7. Validation plan

- Direct mixed-family collector/routing regressions.
- Existing spatial-only and cardinality-only routing regressions.
- Terminal mixed-family negative control.
- Focused compiler, repair-loop, lifecycle and materialization tests.
- TypeScript, `git diff --check`, and one repository gate.
- Independent Claude Code read-only adversarial review before push.
- After push: new Git probe, Fresh Readiness prepare/verify, one bounded live attempt; only a fully valid candidate may continue to Reconciliation, Blueprint, Wizard and three LOW Leo pages.

## 8. Cost impact

Implementation and QA cost $0. A later live authoring attempt retains the existing maximum three provider calls and hard $5.00 ceiling. Image spend is forbidden until candidate, Reconciliation, Blueprint and Wizard qualification pass; then the authorized audition is exactly three `gpt-image-2` LOW pages.

## 9. Rollback plan

Revert the focused implementation commit. No artifact migration or data rewrite is required. Old receipts/readiness evidence remain immutable historical records.

## 10. Review assignment

Guy has already authorized continuous execution toward the three-page LOW proof. Claude Code must try to falsify validation completeness, mixed-family closure, compact-route preservation, call-budget preservation, diagnostic sanitization and unrelated-surface exclusion. Product acceptance remains Guy's after inspecting the rendered pages.

## 11. Do not do

No model/prompt/schema/budget change, retry, fallback, timeout increase, story literal, credential inspection, production deployment, storage/database write, full-book render, or product acceptance.
