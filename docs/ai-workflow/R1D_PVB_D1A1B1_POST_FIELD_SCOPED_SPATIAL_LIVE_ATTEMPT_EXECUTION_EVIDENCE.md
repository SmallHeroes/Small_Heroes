# R1D-PVB-D1A1B1 - Post-Field-Scoped Spatial Live Attempt Execution Evidence

Date: 2026-08-09

Status: terminally exhausted; execution-record fidelity independently PASSed; no candidate or render authority

## Immutable authority

- Repository head and same-name upstream: `ab1bf2055167a18cdd927c2f94583edd238f548e`
- Fresh Readiness v11: `baa81e825cc3640735929d13e16a9ea844d25ed4c2774496fdd8580203c6943a`
- Execution Request v11: `90af1687a4581b4756fa9c77f1e15e7c7f53264f4c102b54c5a10defef9a55a5`
- B0 manifest v12: `32ede62f7691c5877e8ae466745adacacd145f29bc171d93c29df8e74397f2f4`
- Execution Supervisor readiness: `10ef7278c641e1872c2b2fe6d06c7e7a93aaa205f22620a00427564ee891c27a`
- Output root: `outputs/r1d-field-scoped-spatial-fresh-readiness-20260809T182409440Z`

The canonical Git probe, Fresh Readiness prepare, and Fresh Readiness verify passed at zero cost. Claude Code independently audited the pre-live eight-artifact authority and returned PASS with no BLOCKER, MAJOR, or MINOR.

## Armed execution

- Official OpenAI pricing matched the frozen request policy for `gpt-5.6-sol`, the Responses API, default service tier, the recorded rates, projected `$4.884`, and hard `$5.00` limits.
- Canonical preflight: exactly one invocation, PASS.
- Execution Supervisor verify: exactly one invocation, PASS.
- Execution Supervisor live: exactly one invocation, child exit `1` after about `224 s`; raw stdout and stderr were suppressed.
- Credential-source access occurred only inside the Supervisor child boundary. Source read succeeded, ambient inheritance was false, and credential authority was cleared.
- Transport retries: `0`; fallback: `false`.

The preflight, Supervisor invocation counts, and runtime credential-boundary observations are Task-transcript evidence. They are not persisted in the receipt/readiness and are not claimed as artifact-recomputed facts.

## Canonical outcome

- Receipt v17: `b6380ac57f1d0e3213a5007a7bf3e4544890a23bcd92cff5b6880f4b1a51f323`
- Readiness v15: `a012cfa0287e64fb9aac7fa460e596bfdcb14df09d42e450ccc8b5887a97992f`
- Receipt status: `failed`
- Terminal class/code: `input_limit_violation` / `input_token_ceiling_exceeded`
- Phase: `provider_admission`
- Repair eligibility/reason: `ineligible` / `input_limit_not_repairable`
- Logical provider calls / repairs / transport retries / fallback: `2 / 1 / 0 / false`
- Candidate / reconciliation digests: `null / null`
- Blueprint authoring ready: `false`

### Attempt 1 - initial response

- Provider response completed.
- Usage: input `17,431`; cache-write input `17,428`; cached input `0`; output `17,194`; reasoning `4,362`; total `34,625`.
- Nominal cost: `$0.624760`; conservative cost: `$0.687241`.
- Three unique `draft_contract / out_of_scope_reference` issues were emitted at page 1 item 0, page 1 item 1, and page 4 item 0 in `page_actions/reference`.

### Attempt 2 - field-scoped repair

- Repair mode: `page_spatial_reference_patch`.
- Provider response completed.
- Usage: input `642`; cache-write input `0`; cached input `0`; output `282`; reasoning `184`; total `924`.
- Nominal cost: `$0.011670`; conservative cost: `$0.013720`.
- All three original spatial issues were resolved.
- Whole-book validation then exposed thirteen unique `draft_contract / final_structural_invariant_invalid` identities: one `recurring_props/final_structure` collection locator and one page `final_structure` locator for every page 1 through 12. The transition contains 13 newly introduced and 3 resolved identities; it is not truncated.

### Attempt 3 - provider admission stop

- Selected repair mode: `full_draft`.
- The request exceeded the unchanged `64,000` application input ceiling before provider reachability.
- Provider calls, transport dispatches, and usage for this attempt are all zero/null as applicable.

### Aggregate usage and cost

- Input tokens: `18,073`
- Cache-write input tokens: `17,428`
- Cached input tokens: `0`
- Output tokens: `17,476`
- Reasoning tokens: `4,546`
- Total tokens: `35,549`
- Nominal estimated cost: `$0.636430`
- Conservative accounted cost: `$0.700961`
- Projected maximum remained `$4.884`, below the hard `$5.00` ceiling.

## Independent Claude Code audit

Claude Code independently audited the consumed 8-to-10 artifact delta and returned **PASS for execution-record fidelity** with zero BLOCKER and zero MAJOR. It recomputed all artifact digests, crosslinks, usage, cost, diagnostic transitions, terminal classification, absence fences, and sanitization claims.

Claude retained one recurring non-blocking MINOR: the receipt-level aggregate execution attestation degrades to `injected_adapter_unattested` when the third attempt is legitimately `not_run`, even though attempts 1 and 2 each persist complete `canonical_adapter_observed` evidence. Canonical route, dispatch, retry, and fallback claims therefore cite the per-attempt records, not the degraded aggregate.

Advisories remain that Supervisor invocation and runtime credential facts are not persisted, Action Semantic coverage was not evaluated, and cost is canonical local accounting rather than a provider-account billing audit.

## Root-cause boundary and next action

The new field-scoped route worked exactly as intended: it resolved all spatial-reference issues with only 642 input and 282 output tokens while preventing unrelated field mutation. The remaining blocker is a different repair-domain problem. `page_contract_patch` can replace pages only, but the closed diagnostic set also contains one global `recurring_props` collection identity. The router therefore correctly rejects page-only repair and selects `full_draft`, whose input exceeds the fixed ceiling.

The next Decision Gate is a general bounded structural-bundle repair for exactly that mixed global-plus-page identity set. It must not retry this consumed attempt, weaken final validation, enlarge the model context, or broaden arbitrary patch authority.

## Authority exclusions

The output root contains the original eight Fresh Readiness artifacts plus the receipt and readiness above. No candidate, provider-failure, or rejected-request file exists. No Semantic Reconciliation, approval, Blueprint, Wizard qualification, page selection, image/Vision call, render, storage/database action, Board action, publication, promotion, activation, deployment, commit, or push followed the consumed attempt.

This record persists no raw prompt, raw response, provider message, stack, credential, or secret. It grants no retry, new live attempt, candidate, Blueprint, Wizard, render, release, deployment, or push authority.
