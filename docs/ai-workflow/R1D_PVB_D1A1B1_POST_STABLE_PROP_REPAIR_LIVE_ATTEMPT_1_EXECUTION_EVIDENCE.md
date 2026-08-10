# R1D-PVB-D1A1B1 Post Stable Prop Repair Live Attempt 1 — Execution Evidence

## Authority

- Branch: `codex/r1d-pvb-d1a1b1-stable-prop-scope-compact-repair`
- Immutable attempted head/upstream: `8b088d1ecc8c0a636e7c8aec95d4819063625fbf`, clean, `0/0`
- Fresh Readiness v15: `93f219dd8f4bdea446cc40b13c2359ce8db753be399c7da9b052e946f6b6d61e`
- Execution Request v15: `dbf15b0215df4228b81a548ba5665b8ae5739329d4ca2bf5b7e86a6c7d36b1b9`
- B0 manifest/verifier v16: `6d566e958f7aa7e833b778c473a7a94b47b65faf5a93e0547031448187895ffe`
- Output root: `outputs/r1d-pvb-d1a1b1-post-stable-prop-scope-repair-fresh-readiness-20260810T142500Z`

## Preparation and arming

The canonical Git probe passed under both minimal environment profiles with digest `5786b4c228beeedca597fa57a704a2d0df55d72a504cc705072f9b5def95105d`. One offline canonical prepare and one canonical verify produced replay-identical readiness. No credential access or provider call occurred during preparation.

Official OpenAI documentation confirmed the exact `gpt-5.6-sol` model, Responses endpoint, `default` service tier policy, `$5` input, `$0.50` cached input and `$30` output rates per million tokens, with cache writes at `1.25×` uncached input (`$6.25`). The unchanged worst-case reservation is `(64,000 × $6.25/M + 36,000 × $30/M) × 3 × 1.10 = $4.884`, below the `$5.00` hard ceiling.

Exactly one `node scripts/visual-contract-authoring.cjs preflight` passed. Exactly one Supervisor verify returned `canonical-live-execution-readiness/v15` digest `d30a06b076afcd790f43f1e7a7dacaac93577ac9ae36ab4f76494bba18d10eb8`, with clean Git, five preserved files, five absent output paths, verified B0/current schema authority, zero writes and no credential/provider reachability.

## Live result

Exactly one Supervisor live invocation ran for 306 seconds. The credential source was attempted and read only inside the child boundary, ambient credential inheritance was false, and credential authority was cleared afterward. Child stdout and stderr were suppressed.

The adapter started one transport dispatch for the initial logical call. No HTTP response was received. Sanitized provider-failure evidence classifies:

- `failureClass: connection_timeout`;
- `sdkErrorKind: api_connection_timeout_error`;
- `phase: transport_dispatch`;
- `httpResponseReceived: false`;
- `billingState: unknown_no_usage`.

Canonical counts are provider calls `1`, repairs `0`, transport retries `0`, fallback `false`. Usage fields are absent and local nominal/conservative accounting is `$0.00`; that is not an OpenAI account or billing audit.

Persisted content-addressed artifacts are:

- receipt v21 `e8b53425a0f4651bac3309f1895cc6b0902dee1f12a57cf95d283198fbcda5b3`;
- provider-call-failure evidence v2 `29571da7564de93341b37631e0b4f567d3ce056a6ab195a98d607adb7d450cb1`;
- readiness v19 `e9dbcf1288a6f30d4c3c7f536cef0d6cf2719a37d073c6836406d6af6d460c40`.

The receipt terminal classification is `provider_execution_failure / provider_call_failed / provider_call / ineligible / provider_execution_not_repairable`. No response body, raw provider message, prompt, schema body, stack or secret was persisted.

## Authority boundary and continuation

No Visual Contract candidate exists. Action Semantic coverage was not evaluated. Semantic Reconciliation, human approval, Blueprint, Visual Package, Wizard, page selection and render authority are absent. No image/Vision, storage/database, Board, publication, promotion, activation, deployment or production action occurred.

This attempt and its readiness are exhausted and cannot be rerun. The failure is a transport timeout rather than an implementation or validation finding; no timeout, retry, fallback, model, prompt, schema or budget change is authorized. Guy's standing 2026-08-10 instruction authorizes a separately materialized new attempt through the existing canonical gates. Production remains blocked.
