# R1D Terminal Reference Cleanup Input/Output Rebalance Decision Gate

**Date:** 2026-08-18
**Owner:** Guy (uninterrupted Candidate/LOW-render product authority), Codex (technical design, implementation and spend fencing)
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `006782079eed049ecac7b024c06162d60ae4e0f3`

## 1. Proposed change

Rebalance only the already-authorized terminal page-spatial reference cleanup from `6,000` input / `2,000` output tokens to `12,000` input / `1,000` output tokens. Keep the same single optional fourth call, exact residual family, exact eligible predecessors, schema, prompt, model, reasoning, retry and no-fallback policy.

Advance authoring policy authority and every canonical request/materialization/Supervisor/Fresh envelope that binds it. Historical evidence remains immutable.

## 2. Why now?

The sole v8 canonical attempt under `outputs/r1d-booksurface-v8-action-identity-fresh-00678207-20260818T094340492Z` ended fail-closed. Receipt v38 `06825c473b10e02ae0d1f0ba5d5783996295051f43b62128972185242481b65a` proves:

- calls 1–3 reached the provider and completed;
- route `initial -> page_spatial_reference_patch -> full_draft`;
- the final draft had only seven `out_of_scope_reference` identities;
- the already-authorized terminal cleanup was selected;
- no fourth provider dispatch occurred because canonical input accounting was `9,719` against the `6,000` cleanup ceiling;
- terminal failure was `input_token_ceiling_exceeded`; Candidate and render authority remained absent.

The second-call page-spatial repair handled eleven targets with only `618` total output tokens, including `292` reasoning tokens. The remaining seven-target cleanup therefore needs more input authority, not the existing 2,000-output reserve.

## 3. Scope

This is a general policy-budget correction for the closed terminal reference-only cleanup. It is not tied to Dini, any page number, any action, or any story content.

## 4. Risk of hardcoding

No target count or story identity is admitted specially. The existing exact residual classifier, eligible predecessor check, typed target construction, prompt/schema admission, atomic patch application and full revalidation stay unchanged. Requests above 12,000 input still stop before provider. Responses exceeding 1,000 output still fail closed at the provider boundary.

## 5. Files likely affected

- `lib/visual-contract-compiler/authoringPolicy.ts`
- visual authoring request/receipt/readiness and canonical B0/execution/Supervisor/Fresh authority versions
- live-request materialization's exact policy shape and projected-cost fence
- focused compiler, lifecycle, materialization, Supervisor and Fresh tests
- `CURRENT.md` and implementation evidence

No renderer or image-generation code changes.

## 6. Expected behavior after change

- The fourth call remains unavailable unless the third completed standard call follows `book_surface_patch` or `full_draft` and leaves only typed `out_of_scope_reference` issues.
- Its input ceiling is 12,000 and output cap is 1,000.
- The observed 9,719-byte seven-target request becomes admissible.
- Any mixed residual, wrong predecessor, fifth call, extra repair, input overflow or output overflow remains rejected.
- Candidate still requires a successful patch plus unchanged full compilation and validation.

## 7. Validation plan

1. Policy tests prove exact `12,000 / 1,000` values, unchanged call/repair counts and residual eligibility.
2. Compiler loop proves a live-shaped terminal cleanup above 6,000 and at or below 12,000 dispatches once, uses output cap 1,000, closes the residual and returns a candidate; over-12,000 still performs no dispatch.
3. Lifecycle proves exact four-call/three-repair sequence, counters, usage/cost reservations and no fifth call.
4. Canonical request/materialization/Supervisor/Fresh suites prove current versions, immediate-predecessor rejection and exact projected maximum `$4.9995`.
5. TypeScript and diff-check pass.
6. Claude Code independently adversarially reviews the immutable range.
7. Only after PASS: new Fresh authority and at most one new live attempt. A valid Candidate remains mandatory before LOW render.

## 8. Cost impact

At official GPT-5.6 Sol Standard rates verified 2026-08-18—cache-write input `$6.25/M` and output `$30/M`, with the existing 1.1 uplift—the old cleanup reserve is `$0.10725`; the new reserve is `$0.1155`. The unchanged three-call standard reserve is `$4.884`, so the new projected maximum is exactly `$4.9995`, leaving `$0.0005` beneath the unchanged hard `$5` fence.

No provider or image spend occurs during implementation/testing. One later bounded live authoring attempt is authorized after independent PASS. Guy's full-book LOW render authority applies only after a valid Candidate.

## 9. Rollback plan

Revert the focused policy/version commit. All consumed v8 artifacts remain immutable and ineligible for replay or promotion.

## 10. Review assignment

Guy explicitly authorized uninterrupted progress to Candidate and a full-book LOW render without further questions. Claude Code must try to falsify exact cost math, output sufficiency evidence, residual/predecessor exclusivity, no fifth call, over-input/over-output rejection, request-version cutover and unchanged renderer/candidate boundaries.

## 11. Do not do

- Do not add a general fourth call or a fifth call.
- Do not admit mixed residuals or other repair modes.
- Do not exceed `$5`, retry, fallback or change model/tier/reasoning.
- Do not reuse the consumed v8 output root.
- Do not render without Candidate; do not run HIGH/production/deployment/payments.
