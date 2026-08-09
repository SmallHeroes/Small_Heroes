# R1D-PVB-D1A1B1 - Recurring-Prop and Page Structural Bundle Repair Decision Gate

Date: 2026-08-09

Exact base: `ab1bf2055167a18cdd927c2f94583edd238f548e`

## 1. Proposed change

Add one strict compact repair route for a closed mixed diagnostic set: exactly one `draft_contract / final_structural_invariant_invalid` locator for the complete `recurring_props/final_structure` collection plus one or more page `final_structure` locators. The provider returns only a complete recurring-prop collection and complete contracts for the exact affected page set. The compiler applies that bounded bundle, proves containment outside it, and reruns the complete existing assembly and validation path.

Page-only final-structure failures continue to use `page_contract_patch`. Any additional collection, root, cover, topology, schema, authority, Action Semantic, or unsupported issue keeps the existing fail-closed route.

## 2. Why now?

The consumed attempt proved the field-scoped spatial route: all three original spatial failures were resolved for 642 input tokens. Whole-book validation then exposed one global recurring-prop structural identity and twelve page structural identities. Page-only repair correctly refused the mixed set, while full-draft repair exceeded the unchanged 64K input ceiling before provider reachability.

The blocked data is smaller than a whole draft. The repair needs the recurring-prop authority and affected pages, not locations, zones, cast descriptions, cover, complete facts, or the whole Story Source.

## 3. Scope

General compiler repair selection, strict structured-output schema, exact application boundary, lifecycle/request authority cutovers, tests, and documentation. No Story Source, page number, prop ID, character, place, or authored value is hardcoded.

## 4. Observed and expected behavior

Observed: a homogeneous page-only structural set is compact-repairable, but adding the one global `recurring_props` structural locator makes the set ineligible and falls through to an over-sized whole-draft repair.

Expected: only the closed global-plus-page set selects the new route. The provider can modify the complete recurring-prop collection and exactly the affected pages, but no other draft field. Missing, extra, duplicate, malformed, stale, or identity-changing output rejects before application. Full validation remains authoritative after application.

## 5. Root cause and contributing factors

Root cause: the current repair target algebra has no bounded representation for a global collection and page contracts in one repair. `structuralRepairTarget` admits only page/page-item locators, and `pageContractRepairAffectedPages` therefore returns `null` when the recurring-prop collection identity is present.

Contributing factors:

- the whole-draft repair resends global data unrelated to the typed failure set;
- the repair request is stateless and must carry the exact affected data and sufficient compiler-owned reference authority;
- the persisted diagnostics intentionally omit raw provider output and raw validator prose, so safety must come from typed selection, strict output, and containment rather than post-hoc inspection;
- the live raw draft is deliberately unavailable, so the implementation must prove the general class with deterministic fixtures rather than story-specific reconstruction.

## 6. Nine architectural decisions

1. Eligibility is exact and homogeneous: every issue is `draft_contract / final_structural_invariant_invalid`; there is exactly one `collection / recurring_props / final_structure` identity and at least one positive page `final_structure` identity; no other locator is admitted.
2. The new mode is `structural_bundle_patch`. Page-only final-structure sets remain on `page_contract_patch`; mixed or unsupported sets retain `full_draft` or the existing terminal behavior. Repair priority, maximum calls, and maximum repairs do not change.
3. Output is an exact-key object containing only `recurringProps` and `pageContracts`. Both reuse the current exported draft member schemas; no JSON pointer, operation language, executable field, arbitrary global object, or prose field is accepted.
4. Eligibility additionally requires the current recurring-prop collection to have a non-empty, unique, compiler-addressable ID set and every affected page to be uniquely addressable by positive `pageNumber`. If identities are malformed, repair stays ineligible instead of guessing.
5. Application requires the output recurring-prop ID set and affected page-number set to equal the expected sets exactly. IDs and page numbers are immutable selectors. The provider may change only schema-authorized descriptive/lifecycle fields inside those props and complete fields inside those exact pages.
6. The request contains only the current recurring props, exact affected pages, aligned local compiler validation messages for the admitted identities, and a bounded compiler-owned reference-domain projection needed to preserve valid IDs. Raw Story Source, unrelated draft sections, provider output, stack, credential, shell, and executable content are excluded. Validation messages are transient provider guidance and never persisted as authority.
7. Application is clone/non-mutating and uses a canonical mask to prove every field outside `recurringProps` and the selected pages is unchanged. Complete topology, source evidence, Action Semantic coverage, final contract, candidate, and downstream validators rerun after the patch; no invalid bundle can become a candidate.
8. The new schema/prompt identity and every dependent authoring request, receipt, readiness, B0, verifier, Supervisor, and Fresh Readiness authority cut over fail-closed. Historical artifacts remain immutable and legacy-only. Attempt records expose the new repair mode without changing candidate or Blueprint versions.
9. Model, Responses API/default tier, reasoning, `64,000` input ceiling, output/call/repair budgets, timeout, transport retries zero, no fallback, `$4.884` reservation, `$5.00` hard ceiling, candidate semantics, Blueprint v4, Wizard, renderer, and release policy remain unchanged.

## 7. Validation and acceptance criteria

1. Direct eligibility tests for the exact recurring-prop-plus-pages set and rejection of page-only, duplicate collection, second collection, root, cover, malformed, mixed-family, and invalid-identity sets.
2. Strict schema/parse tests for exact keys, current recurring-prop member shape, current page member shape, and absence of arbitrary patch language.
3. Application tests for exact prop/page sets; missing, extra, duplicate, reordered-identity ambiguity, changed IDs/page numbers, stale inputs, extra/missing keys, and malformed members reject fail-closed.
4. Canonical containment and non-mutation tests prove no location, zone, Set Board, cast, cover, global prohibition, unrelated page, or hidden field changes.
5. Sanitization tests prove no raw Story Source, unrelated draft, provider material, stack, credential, shell, or executable content enters the bounded prompt or evidence.
6. Fake-provider lifecycle: initial page-spatial failure -> field-scoped spatial repair -> recurring-prop/page structural bundle repair -> candidate, with exactly three provider calls, two repairs, zero retry/fallback, and complete diagnostic transitions.
7. A persistent or newly mixed structural failure exhausts or returns to the existing route truthfully; it never expands scope silently.
8. Input-ceiling tests prove the exact twelve-page calibration and worst representative approved inputs stay below 64K with at least 4,096 conservative units of headroom.
9. Prompt/schema compatibility, request/B0/verifier/Supervisor/readiness tamper rejection, version migration, unchanged shared terminal validation, Blueprint v4, Wizard qualification, and render behavior.
10. Focused tests, deterministic TypeScript, `git diff --check`, one literal `npm run check`, and independent read-only Claude Code QA.

Done means the closed mixed set never selects full-draft repair, the fake lifecycle reaches a candidate within the unchanged budget, and no unrelated field becomes provider-mutable.

## 8. Cost impact

Implementation and tests cost `$0`. No credential or provider call is authorized during implementation. A future bounded authoring attempt retains the existing maximum three provider calls and hard `$5.00` ceiling only after technical QA, push, and new Fresh Readiness.

## 9. Migration and rollback

Cut over the new repair prompt/schema and dependent operational authorities. Predecessor artifacts remain readable only as historical immutable evidence and cannot authorize a new attempt.

Rollback is the reverse of the focused implementation commits. The prior routing returns, causing this mixed set to fall through to full-draft admission and fail closed at 64K. No historical artifact is rewritten.

## 10. Review assignment and owner decision

Guy's standing instruction authorizes the technical work needed to reach the first Wizard-connected LOW page without repeated approval prompts. This gate makes no new product, story, visual, model, budget, or launch choice, so no unresolved product decision remains. Claude Code must falsify exact eligibility, strict output, identity preservation, canonical containment, prompt minimization, ceiling headroom, migration, attempt accounting, and unchanged downstream behavior.

## 11. Stop-check and rejected alternatives

- General system fix: yes.
- Cross-story risk: bounded by typed diagnostic identity, exact sets, and full revalidation.
- Production behavior: one repair route only.
- Spend now: none.
- Smallest proof: deterministic fake-provider three-call lifecycle plus direct parse/application/tamper tests.
- Guy eyeball: the eventual one-page LOW portrait result after candidate, Reconciliation, Blueprint, and Wizard gates.

Rejected alternatives:

- raising the 64K ceiling or model budget: unnecessary and explicitly forbidden;
- accepting the invalid draft: violates candidate admission;
- treating the collection issue as page-only: cannot repair global recurring-prop authority;
- arbitrary JSON Patch: too broad and unsafe;
- resending the complete draft with shorter prose: retains unrelated mutation authority;
- deterministic story-specific reconstruction from the Fox attempt: raw draft is unavailable and a one-story patch is not architecture;
- persisting raw provider output or validator prose: unnecessary and violates the evidence boundary.

## 12. Do not do

No Story Source literal, raw provider material, fuzzy matching, arbitrary patch path, model/schema-authority weakening, context/call/repair budget change, timeout/retry/fallback change, credential access, pricing/network/provider call, real B0/Fresh Readiness, preflight, live authoring, candidate, Reconciliation, Blueprint/Wizard execution, render/image/Vision, storage/database, Board action, approval, publication, promotion, activation, deployment, or push during implementation.
