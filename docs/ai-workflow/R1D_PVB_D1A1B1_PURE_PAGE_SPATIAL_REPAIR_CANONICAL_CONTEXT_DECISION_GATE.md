# R1D-PVB-D1A1B1 Pure Page-Spatial Repair Canonical Context — Decision Gate

Status: APPROVED FOR IMPLEMENTATION under Guy's standing authorization to continue to a QA Wizard LOW proof without further approval prompts.

Base: `f1397b9c798868700d15e982994894b1fd21bc83`

## 1. Proposed change

Bind pure `page_spatial_reference_patch` target derivation and patch application to the same compiler-owned canonical page contracts that produced the typed reference-domain issues. Today the compound repair lane uses that canonical context, while the pure page-spatial lane falls back to the raw provider draft.

## 2. Why now?

The bounded live attempt completed all three provider responses within the new output budgets. Repair 1 reduced the draft to six `out_of_scope_reference` issues, but repair 2 was routed as `full_draft` and reintroduced 27 unique failures. Repository tracing shows that issue locators are produced after topology canonicalization while pure spatial repair targets are derived from raw page contracts; an exact raw/canonical zone-ID drift can therefore make the compact authority appear unavailable.

## 3. Scope

General compiler repair-routing correction for every Story Source. No story, child, companion, page, authored ID, or provider-output literal is special-cased.

## 4. Risk of hardcoding

Low. The fix reuses existing compiler-owned `canonicalPageContracts`, typed issue locators, exact action indices, and permitted zone spatial IDs. Ambiguous or missing canonical authority remains fail-closed.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- focused compiler/lifecycle regression tests
- `CURRENT.md`
- implementation evidence under `docs/ai-workflow/`

## 6. Expected behavior after change

Nine architectural decisions:

1. The typed issue producer and compact repair consumer share one canonical page-contract context.
2. Pure page-spatial targets are derived from canonical page contracts when the error supplies them.
3. Successful patches are applied to that same canonical-context draft, preserving unrelated raw draft surfaces.
4. Only exact typed page/action/field locators and permitted spatial IDs enter the compact repair prompt.
5. Raw rejected IDs, provider prose, prompts, responses, messages, stacks, and secrets remain absent from receipts and readiness.
6. Missing, ambiguous, or invalid canonical context remains fail-closed; no fuzzy match, retry, fallback, or invented authority is added.
7. Model, prompt/schema authority, 64K input ceiling, `[40000,32000,36000]` output allocation, call/repair budget, timeout, transport retries, fallback policy, and `$5` cap are unchanged.
8. Persisted artifact schemas and versions do not change because the repair mode and evidence shape already exist; historical artifacts remain immutable.
9. Mixed issue families, compound repair, terminal cleanup, candidate semantics, Blueprint/Wizard behavior, and downstream gates remain unchanged.

## 7. Validation plan

- Regression: a raw page zone alias that canonicalizes to an exact zone plus a repairable out-of-zone action reference must route to `page_spatial_reference_patch`, never `full_draft`.
- Assert the compact prompt contains only canonical permitted IDs and excludes the raw rejected reference.
- Assert the completed candidate preserves exact action identity and unrelated draft fields.
- Preserve direct, mixed-family, tamper, deduplication, and terminal cleanup coverage.
- Run focused tests, deterministic TypeScript, `git diff --check`, then one repository gate if focused validation is green.
- Independent Claude Code adversarial QA before push.

## 8. Cost impact

Implementation and validation cost `$0`. A later new Fresh Readiness and bounded authoring attempt may spend under the already-approved hard cap; no provider or render call is part of this implementation milestone.

## 9. Rollback plan

Revert the focused implementation commit. No data migration, artifact rewrite, schema downgrade, or downstream rollback is required.

## 10. Review assignment

Claude Code must falsify canonical-context binding, exact authority, prompt sanitization, unchanged budgets/policies, preservation of compound and terminal paths, and absence of story-specific behavior. Guy retains product/visual acceptance of any later render.

## 11. Stop-check and exclusions

- General fix: yes.
- Production behavior affected: authoring repair routing only; production deployment is excluded.
- Smallest proof: deterministic fixture with raw/canonical topology drift.
- No credentials, pricing lookup, network/provider call, Fresh Readiness, preflight, live authoring, image/Vision, render, storage/database, deployment, or push during implementation.

