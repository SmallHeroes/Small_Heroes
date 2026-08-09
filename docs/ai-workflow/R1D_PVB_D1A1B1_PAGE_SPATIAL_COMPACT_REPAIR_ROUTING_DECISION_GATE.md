# R1D-PVB-D1A1B1 — Page-Spatial Compact Repair Routing Decision Gate

Date: 2026-08-09

Exact base: `22857995df578d366809226a5d693cd783a10ed7`

## 1. Proposed change

Route the one closed authority issue family `page_spatial_reference_outside_zone` through the existing `page_contract_patch` repair mode instead of the whole-draft repair mode. Each affected page receives only its complete page contract, exact typed structural targets, and a compiler projection of the spatial nodes declared by that page's zone.

## 2. Why now?

The latest bounded live attempt completed one provider response and produced five page-local spatial-reference failures at pages 1, 2, and 4. The existing repair router correctly marked them repairable, but selected `full_draft`. That second request was rejected locally before provider reachability because it exceeded the unchanged `64,000` input ceiling. No candidate, Blueprint, Wizard qualification, or render authority was produced.

The existing compact page-contract repair already replaces complete affected page contracts and reruns full assembly and validation. The missing boundary is a typed, bounded reference projection for page-zone spatial selections.

## 3. Scope

This is a general compiler, repair-routing, lifecycle-authority, and test change for every Story Source. It does not change Story Source data, initial authoring semantics, candidate admission, Blueprint/Wizard behavior, or rendering.

## 4. Risk of hardcoding

No story, page number, character, prop, zone, node, source phrase, or authored identifier is hardcoded. Eligibility is all-or-nothing over the closed issue identity and exact compiler-owned locator. The permitted node set is derived at runtime from the affected page's exact zone in the failed draft.

## 5. Files likely affected

- `lib/visual-contract-compiler/pageContractRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- focused compiler and lifecycle tests
- Visual Contract request/receipt/readiness and canonical materialization bindings
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

When every failure is `page_spatial_reference_outside_zone` with a valid page-spatial locator, the router selects `page_contract_patch`. The compact request carries each affected complete page contract, the exact action or safety-constraint position and field role, and only the allowed spatial-node identities for that page's zone. The model may copy one exact permitted node identity or choose a schema-valid non-spatial reference; it cannot modify zone or Set Board authority.

Mixed, malformed, non-page, recurring-prop, deterministic-authority, Action Semantic capability, source-evidence, and other issue sets remain on their existing fail-closed routes. Every compact result is exact-set applied to a clone and must pass the complete compiler and candidate lifecycle again.

## 7. Validation plan

1. Direct tests for the four page-spatial field roles present in the strict draft-page schema, exact page/zone projection, deterministic ordering, and compact-payload sanitization. The final-only `safetyConstraints.target` role stays on its existing route because it cannot be represented by the strict draft-page repair schema.
2. Fail-closed tests for mixed families, wrong locators, missing/duplicate pages or zones, empty spatial authority, tampered patch sets, and non-mutation.
3. Lifecycle proof of one initial response plus one compact page repair producing a candidate; persistent failure remains bounded by the existing repair budget.
4. Input-ceiling proof for the approved Fox authority with safety headroom below `64,000`.
5. Request/B0/verifier/Supervisor/readiness tamper and migration coverage for the new prompt authority.
6. Focused tests, deterministic TypeScript, `git diff --check`, one literal `npm run check`, then independent read-only Claude Code QA.

## 8. Cost impact

Implementation and validation cost `$0`. No credential or provider call is authorized in this milestone. A future attempt keeps one initial call, at most two repairs, zero transport retries, no fallback, conservative reservation `$4.884`, and hard ceiling `$5.00`.

## 9. Rollback plan

Revert the focused implementation commits. The previous behavior returns: this issue family remains repairable only through whole-draft repair and may stop locally at the input ceiling. Historical artifacts remain byte-immutable and non-authoritative for a later attempt.

## 10. Review assignment

Guy's standing instruction authorizes routine technical decisions required to reach one Wizard-connected LOW page without repeated approval prompts. No product, story, UX, visual, budget, or launch choice is introduced here. Claude Code must adversarially falsify eligibility, exact zone authority, prompt sanitization, patch containment, attempt accounting, ceiling headroom, version migration, and unchanged downstream behavior.

## 11. Nine architectural decisions

1. Eligibility is allowlisted only to `page_spatial_reference_outside_zone`.
2. Every issue in the failure set must be eligible and structurally locatable; mixed sets remain fail-closed.
3. Page selection comes only from typed positive `pageNumber`; item selection comes only from typed action indices and the four closed draft-page field roles. The final-only safety-constraint locator is not admitted to this compact schema.
4. The repair authority for a page is the exact, uniquely resolved zone selected by that page and its exact spatial-node set; authored rejected values never become authority.
5. The existing `page_contract_patch` mode and strict complete-page response schema are reused; no fourth repair framework or arbitrary patch language is added.
6. The compact request includes no complete draft, unrelated Story Source prose, raw validator prose, provider message, stack, credential, executable text, or downstream authority.
7. Prompt authority and all dependent request, receipt, readiness, materialization, verifier, Supervisor, and Fresh Readiness versions cut over fail-closed; predecessor artifacts remain immutable and legacy-only.
8. Model, endpoint, service tier, reasoning, `64,000` input ceiling, output/call/repair budgets, timeout, transport retries, fallback, `$4.884` reservation, and `$5.00` ceiling remain unchanged.
9. A future candidate must still pass Semantic Reconciliation, Blueprint feasibility, Wizard qualification, render pricing, and explicit one-page LOW render authority; this implementation grants none of them.

## 12. Stop-check

- General system fix: yes.
- Cross-story risk: bounded by closed issue and exact page-zone authority.
- Production behavior: repair routing only.
- Spend now: none.
- Smallest proof: fake-provider two-call compact lifecycle plus ceiling/tamper tests.
- Unresolved Guy decision: none; no product or budget choice.
- Claude falsification: routing, projection, sanitization, accounting, authority cutover, unchanged downstream behavior.
- Guy eyeball: the eventual single LOW portrait page after Wizard qualification.

## 13. Do not do

No story-specific literal, fuzzy matching, guessed node, automatic authority rewrite, schema broadening, model/budget/timeout/retry/fallback change, credential access, pricing/network/provider call, real B0/Fresh Readiness, preflight, live authoring, render/image/Vision, storage/database, Board action, approval, publication, promotion, activation, deployment, or push.
