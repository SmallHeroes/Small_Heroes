# R1D-PVB-D1A1B1 Responses Streaming Authoring Transport - Implementation Evidence

## Status

Streaming transport independently PASSed within the bounded LOW exception. The post-live terminal-output mapper correction is locally green and pending an independent focused re-gate. Repository/release status remains HOLD on the separate six known fixture failures.

- Base: `d3070cbded13891ba964466ca2bbbd1e1b96d227`
- Branch: `codex/r1d-pvb-d1a1b1-streaming-authoring-transport`
- Worktree: `C:\Users\guyna\.codex\worktrees\streamtransport1\Small_Heroes`
- External implementation cost: `$0`

## Triggering evidence

Two separately materialized attempts on the exact base failed before any HTTP response or provider usage was returned.

Attempt 1:

- Fresh Readiness `241a89f3cdaecb33b99ffd0e782cf56fbcdf4123a263f2d00c68708e7c74dec4`.
- Execution Request `be31ca47b05aa4f08a784aa88d5aa4a81151cea77a24ff3e07396a27ffdec0c4`.
- Receipt `f736d1a1ee9c67fdd24c896b19361860241cd26bfcc5837c05593ffe7a2f50df`.
- Provider-failure evidence `856d75cd11b27fe58224d4a47eed3e1407a4a4cbcfc0084c42eee0f3849ba0b6`.
- Readiness `4796b22886bf35d93c1ebe74ce6ec9c66ed6dfcdd93425c5256044a23a651ec2`.

Attempt 2:

- Fresh Readiness `0ac5ead19f2c3c3dc93ebbd1f7173abc1d0b63101c9254a7805bef85e36ba484`.
- Execution Request `69e1fccb8730554e9b34e4eeafad6f54a65105b20204736afe9acecef41f8d3d`.
- Receipt `85fc675b353926bc652c1c90991470bc2d1c15fadcf111c3880d9c79a7cda0c2`.
- Provider-failure evidence `5828b9e460b350e7fd7271701ea56c24d377763a18fdac4f4cc6fb6c582a47b6`.
- Readiness `88df8adcb225daeca7a38ed6174550fc8d3148739a5d73ccde93bf6c8b7340ba`.

Both failures are `transport_dispatch / connection_timeout / api_connection_timeout_error`, with `httpResponseReceived: false`, one logical provider call, one transport dispatch, zero retries, no fallback, no usage, `unknown_no_usage` billing state, zero locally accounted cost, and no candidate or downstream authority. The first attempt received an independent Claude Code artifact-audit PASS for execution-record fidelity. Historical output roots remain unchanged.

## General correction

The canonical OpenAI Responses request body now uses `ResponseCreateParamsStreaming` and binds `stream: true`. `responses.create` still executes once with the same locked request options. A small trust-boundary collector consumes the returned `AsyncIterable` and:

1. ignores nonterminal progress/delta events without retaining them;
2. accepts one terminal `response.completed`, `response.failed`, or `response.incomplete` event;
3. returns only that event's Response object to the unchanged mapper;
4. rejects malformed events, raw `error` events, malformed terminal payloads, missing terminal events, and any event after terminal with stable local codes; and
5. discards raw provider error-event prose before the existing sanitized failure boundary.

This removes the whole-response wait that repeatedly died before HTTP headers while preserving one HTTP request and every downstream validation and repair rule.

## First streamed live attempt and terminal-output correction

Fresh Readiness v15 on pushed head `8e3b0285f8d2613c3e1e1f307c9675cb2362cdbb` passed with digest `547faae405fbad83aad8dda33fad3d790efc00ae487fa3f073597ac558ed0940` and Execution Request `dcc21d432ce1c12a0dbaaed6c4716944de27a9b286f8f71bb3806481015cc238`. Canonical preflight and Supervisor verify passed. The sole live invocation then proved the transport correction: OpenAI completed one streamed response instead of timing out.

- Receipt v21: `aa26771305e3843f8c4e5ff2b7c91fa91be4cff5ebe206f0e73196c668809497`.
- Readiness v19: `c24fb855107b19688969eb269b21116ce605c404383b184a862a2680809db7f3`.
- Provider response ID: `resp_0e0abdce6bc056de016a79fb4cc57c81a2b627972001cf5f7e`.
- Calls / repairs / transport retries / fallback: `1 / 0 / 0 / false`.
- Usage: input `17,402`; cache-write `17,399`; cached input `0`; output `23,736`; reasoning `1,974`; total `41,138`.
- Nominal / conservative accounting: `$0.820839 / $0.902927`.
- No provider-failure evidence exists because the provider completed. No candidate or downstream/render authority was produced.

The terminal result was `provider_evidence_invalid / provider_execution_evidence_invalid`. Receipt usage and completion evidence were present, but mapped output was empty. Repository and installed-SDK inspection established the exact compatibility gap: non-streaming SDK parsing adds the convenience `response.output_text`, while a raw `response.completed` SSE event carries the same text in `response.output[].content[]`. The mapper read only the convenience field.

Focused commit `7d3858f2` corrects that boundary without changing provider input or lifecycle policy. It prefers a string `output_text` when present; otherwise it joins only string `output_text` content parts from terminal message items, equivalent to the SDK helper. Missing/malformed arrays, message content, or text fail closed to empty mapped output and the existing evidence-invalid path. It does not retain raw deltas or provider prose.

## Authority and unchanged policy

- Current provider evidence: `openai-responses-authoring-evidence/v5`.
- v4 is `legacy_immutable`; v2/v3 remain historical legacy.
- Canonical import preflight requires v5.
- The request-body digest now binds `stream: true` through existing canonical evidence.
- Prompt authorities, structured-output schemas, model `gpt-5.6-sol`, Responses endpoint, default service tier, reasoning, token ceilings, one-initial/two-repair budget, twenty-minute request timeout, zero transport retries, no fallback, candidate semantics, and `$4.884/$5.00` cost ceilings are unchanged.
- Blueprint, Wizard, image generation, storage, production, and downstream contracts are unchanged.

## Validation

Direct transport boundary and deterministic TypeScript:

```text
npx --no-install vitest run lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts --maxWorkers=1 --fileParallelism=true
1 file / 145 tests PASS

npx --no-install tsc --noEmit
PASS
```

Post-live terminal-output correction:

```text
canonical-live-authoring-boundary.spec.ts: 1 file / 149 tests PASS
adjacent adapter/launcher/lifecycle/provider suites: 5 files / 298 tests PASS
npx --no-install tsc --noEmit: PASS
git diff --check: PASS
```

The replacement literal `npm run check` for the correction passed TypeScript and all 19 resource-intensive files with valid diagnostic protocol. Its 271-file ordinary phase reported exactly the same six established ignored-output fixture failures and no seventh assertion or infrastructure failure.

Canonical authority regression chain:

```text
npx --no-install vitest run \
  lib/visual-package/__tests__/live-request-materialization.spec.ts \
  lib/visual-package/__tests__/live-request-verification.spec.ts \
  lib/visual-package/__tests__/live-execution-supervisor.spec.ts \
  lib/visual-package/__tests__/canonical-pre-live-readiness.spec.ts \
  lib/visual-package/__tests__/canonical-pre-live-readiness-launcher.spec.ts \
  lib/visual-package/__tests__/canonical-live-authoring-launcher.spec.ts \
  lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts \
  --maxWorkers=1 --fileParallelism=true

7 files / 310 tests PASS
```

Adjacent provider/lifecycle regression before the full chain passed 4 files / 149 tests. Canonical zero-cost import preflight passed and reported `openai-responses-authoring-evidence/v5`. `git diff --check` passed.

The one literal `npm run check` passed TypeScript and the complete 19-file resource-intensive phase with valid diagnostic protocol. Its 271-file ordinary phase reported exactly the six established missing ignored-output fixture failures and no seventh assertion or infrastructure failure. These six remain a separate release HOLD and are accepted only for the bounded local LOW measurement.

## Acceptance evidence

- The real SDK/fetch path receives an SSE response and proves `stream: true` is in the transmitted JSON body.
- One completed stream reduces to the exact terminal Response object.
- Failed and incomplete terminal Responses continue into the existing lifecycle rejection path.
- Missing terminal, raw error, invalid event, invalid terminal, and event-after-terminal paths fail closed.
- A raw provider error string does not appear in the thrown stable local error.
- Locked request policy remains unchanged apart from `stream: true`.
- Canonical materialization, verification, Supervisor, and Fresh Readiness tests remain green.
- v4 evidence is legacy immutable, v5 is current, and preflight binds v5.

## Boundaries

Implementation and correction validation did not access credentials or providers. The separately authorized streamed live attempt accessed the credential source only inside the Supervisor child, completed exactly one provider call, and persisted only the canonical receipt/readiness evidence listed above. It produced no candidate, Semantic Reconciliation, Blueprint/Wizard execution, image/Vision/render, storage/database, publication, deployment, or production action. Production remains blocked.

## Independent QA

Claude Code independently reviewed exact immutable pushed range `d3070cbded13891ba964466ca2bbbd1e1b96d227..d1beac4bb89222f7ab84abd07a769412cdb74eee` and returned **PASS** with zero BLOCKER, zero MAJOR, and zero MINOR. It verified the single `responses.create` dispatch with `stream: true`, closed terminal-event reduction, every fail-closed malformed/error/missing/after-terminal path, raw provider prose and delta suppression, unchanged mapper/validation/repair/cost flow, evidence v5/v4 migration, preflight binding, locked request policy, and meaningful SDK/SSE test coverage. Codex records Claude Code's independent verdict; it does not self-award technical PASS.

Claude retained two non-blocking advisory notes: the pre-existing diagnostic observations expose `sdkRequestBuildStarted` but not a separate succeeded flag, and the deliberate no-retention policy means operators receive no token-level streaming telemetry. Neither changes correctness, authority, cost, or the bounded LOW route.

## Rollback

Revert the focused transport and evidence commits. Historical attempt artifacts are already immutable and need no migration or rewrite.
