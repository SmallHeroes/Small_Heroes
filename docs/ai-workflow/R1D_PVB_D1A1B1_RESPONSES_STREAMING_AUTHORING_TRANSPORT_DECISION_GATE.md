# R1D-PVB-D1A1B1 Responses Streaming Authoring Transport - Decision Gate

## Decision

Proceed under Guy's standing 2026-08-10 authority to reach one local Wizard-connected `gpt-image-2` LOW portrait-page measurement. Replace only the synchronous OpenAI Responses wait with the official streaming Responses transport. The provider request remains one logical call and one HTTP dispatch. This gate does not authorize a transport retry, fallback, production action, publication, storage, deployment, full-book render, or any increase to the authoring or cost budget.

## 1. Proposed change

Set `stream: true` on the existing OpenAI Responses request, consume the returned SDK event stream, discard nonterminal deltas, and return the one terminal response object to the existing response mapper and authoring lifecycle. At that trust boundary, normalize the SDK convenience `output_text` from the canonical terminal Response `output[].content[]` representation when streaming does not add the convenience field. Persisted provider evidence cuts over from v4 to v5 so newly materialized authority proves the streaming request body and current code path.

## 2. Why now?

Two separately materialized live attempts at exact pushed head `d3070cbded13891ba964466ca2bbbd1e1b96d227` reached the SDK transport but received no HTTP response before failing after approximately 306 seconds. Both canonical provider-failure artifacts report `transport_dispatch / connection_timeout / api_connection_timeout_error`, `httpResponseReceived: false`, one logical provider call, one transport dispatch, zero transport retries, zero fallback, no usage, and no provider billing claim.

The repository timeout remains twenty minutes. The repeated approximately five-minute boundary therefore occurs before the repository timeout and before response mapping or validation. OpenAI's official Responses streaming guide documents `stream: true` as the supported way to receive server-sent events during long response generation, with `response.completed` carrying the completed Response object. This is a transport-observability correction, not a prompt, schema, model, validation, or budget correction.

## 3. Scope

General transport change for canonical OpenAI Responses Visual Contract authoring. It applies to every Story Source and every initial or repair call routed through the existing adapter. It does not add story-, child-, page-, character-, or failure-specific behavior.

## 4. Risk of hardcoding

No authored value, Story Source phrase, request ID, response ID, output delta, or provider message controls the reduction. The collector recognizes only the closed SDK terminal event types `response.completed`, `response.failed`, and `response.incomplete`. Invalid events, provider error events, missing terminal events, invalid terminal payloads, or events after the terminal response fail closed with stable local codes.

## 5. Files likely affected

- `lib/visual-package/openaiResponsesVisualContractAuthoringAdapter.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- `scripts/visual-contract-authoring.ts`
- focused adapter, launcher, lifecycle, materialization, Supervisor, and Fresh Readiness tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior

The adapter makes exactly one `responses.create` call with the unchanged model, tier, prompts, structured-output schema, token limits, request timeout, and retry policy plus `stream: true`. It consumes SSE events until exactly one terminal Response is observed. The mapper accepts either the non-streaming SDK convenience `output_text` or deterministically joins string `output_text` content parts from terminal message items, matching the SDK's documented helper behavior. Missing or malformed canonical output fails closed to the existing provider-evidence rejection. Deltas are not retained. Raw provider error-event prose is discarded. Failed or incomplete terminal Responses remain subject to the existing terminal classification.

## 7. Validation plan

- request-body tests proving `stream: true` and every unchanged locked policy field;
- SDK/fetch integration proving one SSE response maps through the real adapter;
- collector tests for completed, failed, incomplete, missing-terminal, invalid-event, invalid-terminal, raw-error-event, and event-after-terminal paths;
- sanitization tests proving raw provider prose does not survive a stream error;
- version migration and preflight tests for evidence v5 with v4 legacy-immutable;
- canonical request materialization, verification, Supervisor, and Fresh Readiness regressions;
- deterministic TypeScript, `git diff --check`, one canonical import preflight, and one literal repository check;
- independent Claude Code adversarial QA before a new live attempt.

## 8. Cost impact

Implementation and validation cost `$0`. Streaming does not create an additional provider call and does not change token accounting. The later live attempt remains bounded to one initial call plus at most two canonical repairs, zero transport retries, no fallback, `$4.884` conservative reservation, and `$5.00` hard ceiling.

## 9. Rollback

Revert the focused implementation and evidence commits. Evidence v5 becomes unsupported for new authority; evidence v4 remains historical immutable evidence. All prior output roots remain byte-unchanged. No data, storage, or production migration is required.

## Nine architectural decisions

1. Keep the existing OpenAI SDK and `responses.create`; set `stream: true` on the same request rather than introducing a second endpoint or custom SSE client.
2. One streaming invocation is one logical provider call and one transport dispatch; it is not polling, retry, fallback, or a sequence of calls.
3. Reduce only the closed terminal event set `response.completed`, `response.failed`, and `response.incomplete`; every other event is non-authoritative progress.
4. Require exactly one valid terminal Response; missing terminal, invalid terminal, provider error event, or any event after terminal fails closed.
5. Do not persist deltas, raw provider error events, raw response material, prompt text, stack, or credential material.
6. Normalize only the terminal Response's canonical message `output_text` content into the SDK convenience representation expected by the mapper; leave validation, repair routing, candidate, receipt, readiness, and cost-accounting logic unchanged.
7. Cut current OpenAI Responses authoring evidence to v5 and retain v4 as legacy immutable; preflight must bind v5 before credential access.
8. Leave model, service tier, reasoning, prompt/schema authority, 64K/36K limits, twenty-minute timeout, call/repair budget, zero retries, no fallback, and cost ceilings unchanged.
9. Permit another bounded live attempt only after focused validation, repository-gate accounting, independent Claude Code QA, push, Fresh Readiness, pricing, one preflight, and one Supervisor verify.

## Stop-check

- General fix: yes; transport-only and cross-story.
- Root cause evidence: two independent pre-HTTP connection timeouts at the same approximately 306-second boundary while the local timeout is twenty minutes.
- Official contract: OpenAI Responses streaming uses `stream: true` and SSE terminal response events.
- Spend during implementation: none.
- Product or visual semantics changed: no.
- Production state: remains blocked.
- Smallest proof: focused transport/authority tests followed by one bounded live authoring attempt; only a valid candidate may proceed to one LOW page.
- Guy decision: supplied by the standing instruction to continue without repeated approvals while preserving hard cost, render, and production boundaries.
- Claude Code falsification: extra dispatches, raw event leakage, terminal-event ambiguity, evidence-version drift, request-body drift, retry/fallback drift, or broken materialization/Supervisor/Fresh Readiness authority.

## Do not do

Do not change prompt or structured-output schema; model, reasoning, service tier, token/call/repair budget, timeout, retries, fallback, candidate policy, Blueprint, Wizard, image prompt, style references, production state, storage/database, publication, promotion, activation, deployment, or full-book rendering.
