# R1D-PVB-D1A1B1 — Represented-Elsewhere Page Repair Routing Decision Gate

Date: 2026-08-09

Exact base: `1d2a5a8f6cfa72db3a4d2375c4728bb7305697b8`

Decision: approved by Guy before implementation, including all nine architectural decisions below.

## 1. Proposed change

Extend only the existing `page_contract_patch` repair eligibility to the closed Action Semantic identities `represented_elsewhere_pointer_out_of_scope`, `represented_elsewhere_pointer_unresolved`, and `represented_elsewhere_value_mismatch`. Use the typed page locator and a compiler-owned exact same-page pointer/value projection to request complete replacement page contracts through the existing schema.

## 2. Why now?

The prior compact repair can resolve page-contract structure but a repaired draft can then fail on one represented-elsewhere pointer/value relationship that is still page-local and structurally correctable. The compiler already owns the typed issue identity and the accepted same-page structured domain, but the repair selector treats these Action Semantic identities as ineligible. That unnecessary terminal boundary prevents a valid candidate after the first compact repair.

## 3. Scope

This is a general compiler and authority-lifecycle change. It is not story-, child-, companion-, page-, or provider-response-specific. It changes only closed eligibility, safe compact input construction, prompt identity, lifecycle coverage, and the required authority-version cutover.

## 4. Risk of hardcoding

The solution uses only closed issue codes, validated typed locators, exact draft page numbers, complete page contracts, and compiler-derived same-page structured values. It forbids authored-ID lookup, story literals, prose parsing, fuzzy matching, and treating the persisted coverage `itemIndex` as a page-contract authoring index.

## 5. Files likely affected

- `lib/visual-contract-compiler/actionSemanticCoverage.ts`
- `lib/visual-contract-compiler/pageContractRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- authoring lifecycle, canonical materialization/verification, Supervisor, and readiness authority modules
- focused compiler, lifecycle, schema, authority, downstream-regression, and producer-census tests
- `CURRENT.md` and durable implementation evidence

No dependency or lockfile change is permitted.

## 6. Expected behavior after change

When every rejection is one of the three approved represented-elsewhere identities and every locator is safe, page-local, positively page-numbered, and in `page_action_semantic_coverage`, the existing bounded repair loop selects `page_contract_patch`. The compact request includes exactly the complete affected page contracts, sanitized typed targets, and the permitted exact same-page pointer/value pairs. It contains no complete draft or raw prose. The model returns complete affected page contracts; strict parsing and exact-set application clone the prior draft, then the compiler reruns the full validation and candidate path. Any unsafe, mixed, malformed, unlocatable, or different issue set retains existing behavior.

## 7. Validation plan

1. Direct eligibility tests for all three identities and every accepted/rejected locator shape.
2. Projection tests proving equality with the validator's accepted same-page structured string domain.
3. Prompt privacy tests excluding raw validation prose, provider material, unrelated Story Source prose, credentials, stacks, and executable content.
4. Exact page-set, clone/non-mutation, parse/application, and full revalidation tests.
5. A fake-provider lifecycle with 12 structural failures, one represented-elsewhere failure, two compact repairs, three calls, and final candidate.
6. Third-prompt admission below 64K with at least 4,096 conservative units of headroom.
7. B0, materialization, verification, Execution Request, Supervisor, readiness, digest, and tamper binding regressions.
8. Unchanged source-evidence, full-draft, terminal-taxonomy, candidate v7, Blueprint v4, Wizard, and render behavior.
9. Deterministic TypeScript, `git diff --check`, one literal `npm run check`, and independent Claude Code read-only QA.

No real provider or image generation is part of validation.

## 8. Cost impact

Implementation and validation cost `$0`. No credential access, network call, provider call, model call, or render is authorized. Future live policy remains the existing one initial call plus at most two repairs, `$4.884` conservative reservation, and `$5.00` hard ceiling.

## 9. Rollback plan

Revert the focused closeout, authority-cutover, and compiler commits in reverse order before materializing any new authority. The prior behavior then returns: represented-elsewhere issues remain outside `page_contract_patch`. Historical artifacts are not changed and require no migration or cleanup.

## 10. Review assignment

Guy approved the behavior, version cutovers, operational fences, and exclusions. Claude Code must review the immutable base-to-head range read-only and try to falsify eligibility closure, locator safety, projection equality, prompt privacy, exact-set/non-mutation behavior, complete revalidation, call accounting, input admission, authority/tamper binding, version migration, and unchanged downstream semantics. No product, UX, story, visual, or creative question remains for Claude Cowork.

## 11. Nine approved architectural decisions

1. Extend only existing `page_contract_patch` eligibility to the three named closed Action Semantic identities.
2. Do not add a fourth repair mode or a general repair framework.
3. Eligibility is all-or-nothing and fail-closed: every issue must be Action Semantic, page-local, positively page-numbered, and located in `page_action_semantic_coverage`; mixed and unsafe sets retain existing behavior.
4. Select affected pages only from typed `pageNumber`; never use `itemIndex`, authored IDs, prose parsing, fuzzy matching, or story-specific literals as a page-local authoring index.
5. Compact input contains only complete affected page contracts, closed sanitized targets, and compiler-owned permitted exact same-page structured string pointer/value pairs.
6. Do not silently rewrite a pointer. Return complete contracts through `PageContractRepairPatches`; apply fail-closed and non-mutating, then rerun every complete validation and candidate gate.
7. Preserve model, endpoint/tier, reasoning, ceiling, budgets, timeout, retries, fallback, cost fences, candidate semantics, Blueprint, Wizard, and render behavior.
8. Cut over repair prompts to v2; Visual Contract request/receipt/readiness to v12/v15/v13; canonical materialization/verification to v10; Execution Request/readiness to v9; and Pre-Live Readiness evidence to v9. Preserve draft schema v13, page repair schema v1, candidate v7, and Blueprint.
9. Keep legacy artifacts immutable and non-authoritative for every new attempt.

## 12. Stop-check

- General system fix: yes.
- Cross-story risk: bounded by closed codes, typed locators, and compiler-owned projection.
- Production effect: one additional closed family may use an existing bounded repair mode.
- Spend now: none.
- Smallest proof: fake-provider compiler/lifecycle tests; no image or full-book render.
- Product decision: all nine architectural decisions explicitly approved.
- Claude falsification: closure, safety, privacy, exact application, full gates, authority, and unchanged boundaries.
- Claude Cowork: not required; no unresolved product/creative choice.
- Guy eyeball: no visual output exists in this milestone.

The approved scope satisfies the stop-check. Any model, budget, validation, candidate, Blueprint, Wizard, render, or external-action change requires a new decision.

## 13. Do not do

No credential access/check/load; pricing/network/provider/model call; real B0/Fresh Readiness; canonical preflight; live authoring or candidate generation; full-book or page render; image/Vision; storage/database; Board; Semantic Reconciliation; approval; publication; promotion; activation; deployment; push; dependency/lockfile change; silent pointer rewrite; validation weakening; story-specific patch; or change to the named unchanged operational/downstream semantics.
