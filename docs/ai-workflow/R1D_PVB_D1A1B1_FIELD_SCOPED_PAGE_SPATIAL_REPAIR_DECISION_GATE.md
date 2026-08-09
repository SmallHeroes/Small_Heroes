# R1D-PVB-D1A1B1 - Field-Scoped Page-Spatial Repair Decision Gate

Date: 2026-08-09

Exact base: `40fd3968e2bb73297a9e10c14acfae31e1ce1a30`

## 1. Proposed change

Replace complete-page output for the closed `page_spatial_reference_outside_zone` repair family with a strict field-scoped patch. The provider returns only the exact typed target identity and one permitted compiler-owned spatial reference ID. The compiler applies that ID only to the located EntityRef field and then reruns the complete existing assembly, authority, semantic, and final validation path.

The existing `page_contract_patch` behavior remains unchanged for final-structure and represented-elsewhere repairs. This adds one closed repair mode for one closed authority family; it is not a general JSON patch framework.

## 2. Why now?

The consumed bounded attempt proved the current complete-page repair is too broad for a field-local authority error. It resolved all six original spatial reference failures, but its first repair introduced twelve whole-book structural failures, one per page, and the second repair preserved them. Three logical provider calls and two repairs were exhausted at a conservative `$1.376857`, with no candidate.

Prompt instructions saying "preserve every other field" are not an enforceable mutation boundary. The compiler currently verifies only the returned page set, not which fields inside those pages changed. A typed field patch makes the permitted mutation structural and testable.

## 3. Scope

General compiler, strict structured-output schema, repair routing, lifecycle authority, verifier/readiness migration, tests, and documentation. No Story Source, page number, character, action, zone, node, or authored identifier is hardcoded.

## 4. Observed and expected behavior

Observed: six page-spatial reference errors selected compact complete-page repair. The returned pages resolved those errors but changed enough unrelated page state to make all twelve final page contracts structurally invalid.

Expected: for a homogeneous, fully locatable page-spatial error set, the provider can choose only one exact permitted spatial ID per exact typed locator. Application must reject missing, extra, duplicate, stale, wrong-page, wrong-action, wrong-field, non-spatial, and non-authority patches. Every byte outside those target EntityRefs must remain equal to the prior draft.

## 5. Root cause and contributing factors

Root cause: `applyPageContractRepairs` replaces complete affected page objects. The response schema enforces page shape and page-set completeness but intentionally allows all page fields to differ. Prompt prose is therefore the only protection for unrelated fields.

Contributing factors:

- page-spatial repair needs only an EntityRef selection, not a complete page rewrite;
- post-patch validation correctly detects drift but does so after provider cost is consumed;
- current typed diagnostics deliberately omit raw error prose, so prevention at the mutation boundary is safer than adding more provider-output persistence.

## 6. Nine architectural decisions

1. Eligibility is allowlisted only to a homogeneous set of `page_spatial_reference_outside_zone` issues with exact `page_spatial_action` locators.
2. The four admitted field roles remain `subject`, `object`, `spatialEffect.target`, and `spatialConstraint.target`; final-only `safetyConstraints.target` remains outside this repair mode.
3. A patch identity is exactly `{pageNumber, actionIndex, fieldRole}`. No beat ID, authored ID, prose, fuzzy match, item-order inference, or story literal selects scope.
4. Provider output is exactly one patch per expected identity and contains only that identity plus `spatialReferenceId`. The strict schema accepts no executable path, arbitrary JSON pointer, replacement object, or extra key.
5. `spatialReferenceId` must be copied from the compiler-owned, post-Set-Board spatial-node set for the exact page zone. The compiler constructs `{kind:"spatial", id}` itself.
6. Application is clone/non-mutating and exact-set. It validates the target's current structural shape, changes only `subject.entity`, `object`, `spatialEffect.target`, or `spatialConstraint.target`, and proves every non-target field remains byte-equivalent under canonical JSON.
7. Existing complete-page repair remains unchanged for structural and represented-elsewhere families. Mixed, malformed, unsupported, authority-missing, or safety-target issue sets keep their existing fail-closed route; no fallback or retry is added.
8. Prompt/schema authority and every dependent request, receipt, readiness, materialization, verifier, Supervisor, and Fresh Readiness version cut over fail-closed. Historical artifacts remain immutable and legacy-only.
9. Model, endpoint, service tier, reasoning, `64,000` input ceiling, output/call/repair budgets, timeout, zero transport retries, no fallback, `$4.884` reservation, `$5.00` hard ceiling, candidate semantics, Blueprint v4, Wizard, and render behavior remain unchanged.

## 7. Validation and acceptance criteria

1. Direct positive tests for all four field roles and multiple patches on the same action/page.
2. Exact-set rejection for missing, extra, duplicate, stale, wrong-page, wrong-action, wrong-field, unpermitted ID, invalid current target shape, and mixed issue families.
3. Canonical deep-diff proof that only the selected EntityRef leaves change and the input remains unmodified.
4. Sanitization proof: no full page, full draft, unrelated Story Source prose, rejected value, provider material, stack, credential, executable, or shell text enters the prompt or evidence.
5. Fake-provider lifecycle reproducing the six-position class and producing a candidate after one field-scoped repair without creating final-structure diagnostics.
6. Persistent failure remains bounded to the existing two-repair/three-call budget with truthful attempt diagnostics.
7. Prompt/schema compatibility, input-ceiling headroom, request/B0/verifier/Supervisor/readiness tamper rejection, version migration, and unchanged Blueprint/Wizard behavior.
8. Focused tests, deterministic TypeScript, `git diff --check`, one literal `npm run check`, and independent read-only Claude Code QA.

Done means the provider cannot rewrite any unrelated page field through this route, the fake lifecycle reaches a candidate, and every authority/tamper boundary fails closed.

## 8. Cost impact

Implementation and tests cost `$0`. No credential or provider call is authorized while implementing. A future bounded authoring attempt may use the unchanged maximum three provider calls and hard `$5.00` ceiling only after independent QA, push, and new Fresh Readiness.

## 9. Migration and rollback

Cut over the page-spatial patch prompt/schema and dependent operational authorities. Predecessor artifacts remain readable only as historical immutable evidence and cannot authorize a new attempt.

Rollback is the reverse of the focused commits. The prior complete-page spatial repair behavior returns; no historical artifact is rewritten.

## 10. Review assignment

Guy's standing instruction authorizes the technical work needed to reach the first Wizard-connected LOW page without repeated approval prompts. This gate makes no new product, story, visual, budget, or launch choice. Claude Code must falsify exact eligibility, target identity, authority selection, canonical field containment, prompt sanitization, attempt accounting, migration, and unchanged downstream behavior.

## 11. Stop-check and rejected alternatives

- General system fix: yes.
- Cross-story risk: bounded by typed locator and compiler-owned authority.
- Production behavior: one repair mutation boundary only.
- Spend now: none.
- Smallest proof: fake-provider repair lifecycle plus direct patch/tamper tests.
- Guy eyeball: the eventual one-page LOW portrait result after candidate, Reconciliation, Blueprint, and Wizard gates.

Rejected alternatives:

- stronger prompt prose: still unenforceable;
- accepting the structurally invalid draft: violates candidate admission;
- retrying another complete-page patch: already exhausted and can repeat drift;
- raw JSON Patch: too broad and unsafe;
- persisting raw response: unnecessary and violates the sanitized evidence boundary;
- story-specific ID replacement: not architecture.

## 12. Do not do

No Story Source literal, raw provider material, fuzzy matching, arbitrary patch path, complete-page spatial replacement, schema/model/budget/timeout/retry/fallback change, credential access, pricing/network/provider call, real B0/Fresh Readiness, preflight, live authoring, candidate, Reconciliation, Blueprint/Wizard execution, render/image/Vision, storage/database, Board action, approval, publication, promotion, activation, deployment, or push during implementation.
