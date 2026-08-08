# R1D-PVB-D1A1B1 — Page-Spatial Reference Repair Routing Decision Gate

Date: 2026-08-08
Base: `3707dc82cb4f39e165d2ed88174e9c5319255828`

## 1. Proposed change

Route the single closed compiler issue `page_spatial_reference_outside_zone` through the existing bounded full-draft repair path when, and only when, every authority/reference-domain issue from the failed attempt has that exact identity and a valid typed page-spatial locator. All other `DraftAuthorityReferenceDomainError` issues remain terminal and non-repairable.

## 2. Why now?

The first post-diagnostics live attempt completed one OpenAI Responses call but produced no candidate. Receipt `7493907e…` recorded five identical `page_spatial_reference_outside_zone` issues in `action.object` on pages 1, 2, and 4. The compiler had enough closed structural context to request a bounded correction, but the broad exception-family fallthrough marked the whole attempt terminal with zero repairs. This blocks the Visual Contract candidate, Blueprint/Wizard qualification, and the first LOW page measurement.

## 3. Scope

This is a general compiler/lifecycle routing change for every Story Source. It does not alter Story Source content, schema authority, the initial prompt, model, service tier, budgets, retry/fallback policy, candidate semantics, or downstream behavior.

## 4. Risk of hardcoding

No story, page, character, prop, location, zone, or authored identifier is encoded. Eligibility is derived only from the closed issue code and validated structural locator. Mixed issue sets and every other authority/reference class fail closed.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/__tests__/draft-reference-domain-hardening.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`
- focused diagnostic/authoring lifecycle tests as required
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

An initial draft containing only out-of-zone page-spatial references receives one existing full-draft repair call. Its diagnostic supplement identifies only page number, structural item index, field role, and the invariant; it contains no copied authored ID, provider message, source phrase, stack, or secret. The existing full-draft path still supplies the previous draft in memory and never persists it. A repaired draft can continue through normal validation. A persistent invalid draft can consume at most the already-approved two repairs and then fails with the existing repair-exhausted evidence. Any mixed or different authority issue remains terminal before a repair call.

## 7. Validation plan

1. Direct compiler tests for all five page-spatial field roles, successful repair, persistent failure, and mixed/non-eligible failures.
2. Lifecycle tests proving call/repair counts, typed per-attempt diagnostics, sanitized persisted bytes, and unchanged terminal routing for other authority issues.
3. Focused regression suites, deterministic TypeScript, `git diff --check`, then one literal `npm run check`.
4. Independent read-only Claude Code QA before a new Fresh Readiness.

## 8. Cost impact

Implementation and validation cost `$0`. A future live attempt retains one initial call plus at most two repairs, transport retries zero, no fallback, conservative reservation `$4.884`, and hard ceiling `$5.00`. No live call or render is authorized by this implementation milestone.

## 9. Rollback plan

Revert the focused implementation commit. The prior behavior—every `DraftAuthorityReferenceDomainError` terminal before repair—returns without migrating or rewriting any historical artifact.

## 10. Review assignment

Guy's standing instruction is to continue toward one Wizard-connected LOW page without repeated routine approvals; this narrow technical routing decision is therefore approved unless investigation reveals a product/visual choice. Claude Code must try to falsify the exact eligibility fence, mixed-issue terminal behavior, sanitized repair input, attempt accounting, and lack of version/budget/prompt/schema drift. Claude Cowork is not needed because no product, UX, story, or creative decision is present.

## 11. Nine architectural decisions

1. Eligibility is allowlisted to `page_spatial_reference_outside_zone` only.
2. Every issue in the thrown authority set must be eligible; mixed sets remain terminal.
3. Existing typed locators are the only source of diagnostic attribution; rejected authored values are not copied into diagnostic text or evidence, while the existing in-memory previous-draft repair input remains unchanged.
4. Eligible issues use the existing full-draft repair path, not Source-Evidence compact repair and not a new framework.
5. Per-attempt persistence uses the existing closed `draft_contract/out_of_scope_reference` diagnostic with page/item structural attribution; artifact JSON shape and versions do not change.
6. The repair prompt builders and version labels remain unchanged; only previously unreachable typed errors enter the already-authorized builder.
7. Initial prompt/schema/model/tier/64K ceiling/call budget/repair budget/timeout/retries/fallback/cost ceilings remain unchanged.
8. Historical artifacts remain byte-immutable and are not authority for a new attempt; the new HEAD and Fresh Readiness bind the behavior.
9. No candidate, Reconciliation, Blueprint, Wizard, or render authority exists until a future bounded live attempt actually produces and validates a candidate.

## 12. Stop-check

- General system fix: yes.
- Cross-story risk: bounded by a closed issue allowlist and fail-closed mixed-set rule.
- Production behavior: only repair eligibility for one compiler-owned invariant.
- Spend now: none.
- Smallest proof: stubbed two-call compiler/lifecycle tests.
- Guy decision: covered by standing authorization; stop only if product semantics or budgets must change.
- Claude falsification: routing, sanitization, accounting, unchanged authorities.
- Guy eyeball: the eventual single LOW portrait page, only after Wizard qualification.

## 13. Do not do

No story-specific literals, fuzzy matching, local ID guessing, automatic canonicalization of rejected spatial references, schema/prompt/model/budget changes, credential access, network/provider call, Fresh Readiness, live authoring, render, storage/database, Board, approval, publication, promotion, activation, deployment, or push.
