# R1D — Book-Surface Attempt 2 Execution Evidence

## Scope and authority

- Immutable branch HEAD: `a43f2d5dafe2edb6f771721d17bdf1c426ceb4ce`
- Output root: `outputs/r1d-book-surface-attempt-2-fresh-readiness-a43f2d5d-20260816T001520377Z`
- Fresh Readiness digest: `488d5d9ebe4a295d417370a85c605896038c3033a0adc592227f75caaeb1662e`
- Execution Request digest: `d22369a5f167a39eb44c8c4c743e49132a8998a4e1e3fc8b8de8ebcc8820d678`
- Authoring receipt digest: `483cbc2a66ffe2b09dec2612d4f738fac581fda0f72f4a1bfd1b994bff9f1345`
- Receipt version: `visual-contract-authoring-receipt/v27`
- This authority is consumed and must not be replayed.

## Exact bounded execution result

- Canonical Git probe: one PASS, digest
  `a2f45360e23c89c39ff784d9ea1f20749f8f37f97913be26f98d1a0fb0ae06a8`.
- Fresh Readiness: one prepare PASS and one verify PASS.
- Canonical preflight: one PASS.
- Execution Supervisor verify: one PASS, readiness digest
  `08484e81a32746ef23a8e2882bc60d202b170bc0d52d33e05edf32c491074d41`.
- Supervisor live invocation: one; child exit 1 after one completed provider
  response.
- Logical provider calls / transport dispatches / transport retries / fallback:
  `1 / 1 / 0 / false`.
- Repair calls: `0`.
- Credential source access succeeded only inside the Supervisor live child;
  ambient inheritance was not authority and credential authority was cleared.
  No raw credential value was emitted or persisted.
- Candidate, Reconciliation and downstream/render authority: none.

## Provider usage and accounting

- Model/provider/endpoint/tier: `gpt-5.6-sol` / OpenAI / Responses / default.
- Input tokens: `17,075`.
- Cache-write input tokens: `17,072`.
- Cached input tokens: `0`.
- Output tokens: `27,446`.
- Reasoning tokens: `2,470`.
- Total tokens: `44,521`.
- Nominal estimated cost: `$0.930095`.
- Conservative accounted cost: `$1.023109`.
- Projected maximum exposure before call: `$4.99125`, beneath the hard `$5.00`
  cap.
- Usage is canonical provider-reported evidence plus local accounting, not an
  OpenAI billing-account audit.

## Terminal classification

- Status: `failed`.
- Error class: `authority_reference_domain_failure`.
- Code: `draft_authority_reference_domain_invalid`.
- Phase: `draft_authority_reference_domain`.
- Repair eligibility/reason: `ineligible` /
  `authority_reference_domain_not_repairable`.
- Diagnostic count: `4`; diagnostics were not truncated.

Sanitized typed issues:

1. Page 7, coverage index 12,
   `coverage_action_binding_cardinality_invalid`.
2. Page 7, coverage index 17,
   `coverage_action_binding_cardinality_invalid`.
3. Page 8, coverage index 3,
   `coverage_action_binding_cardinality_invalid`.
4. Page 10, action index 0, field role `object`,
   `page_spatial_reference_outside_zone`.

## Persistence and exclusions

The output root contains ten canonical JSON files. Candidate, rejected-request
and provider-failure directories contain no persisted candidate authority. No
raw prompt, raw response, provider message, stack or secret is reproduced in
this record. No image/Vision call, render, storage/database action, Board
action, publication, promotion, activation, deployment, tracked edit, commit
or push occurred during the attempt.

This record describes execution fidelity only. It grants no product, visual,
candidate, Reconciliation, Blueprint, Wizard, render, billing, release or
deployment acceptance.
