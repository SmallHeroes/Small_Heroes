# R1D-PVB-D1A0 — Authoring Hardening and Source Snapshot Decision Gate

**Status:** APPROVED by Guy in the delegated R1D-PVB-D1A0 implementation brief on 2026-07-27
**Immutable base:** `455670c85d0890502736524f692ca1d6e8da9281`
**Implementation branch:** `codex/r1d-pvb-d1a0-source-authority`
**Cost boundary:** zero provider, model, image, Vision, network, storage, database, or Board calls

## 1. Proposed change

Add the zero-cost source-authority and authoring-control layer required before a first real Visual Contract authoring run:

```text
Story Source + page/image-direction/cover authority
  -> immutable exact source snapshot
  -> exact locked authoring request
  -> provider-unreachable deterministic preflight
  -> future bounded Visual Contract candidate authoring
  -> separate Source Prompt/Semantic Reconciliation
  -> separate human review and approval
  -> Blueprint-authoring readiness
```

D1A0 builds the general schemas, request and receipt contracts, immutable writers, readiness evidence, CLI surfaces, fixtures, tests, and the first real offline source snapshot. It does not make the authoring call or fabricate a candidate or reconciliation.

## 2. Why now?

The D0 readiness audit correctly found that the selected 12-page source is not ready: only one current page has structured action authority and Semantic Reconciliation is absent. The current strict draft schema cannot author `actionRequirements`; the compiler model and generic provider routing are not independently locked; transport retries can multiply provider requests; the old compiler driver retains only last-call usage and writes mutable filenames.

Those gaps must be closed before a paid run can be safely authorized.

## 3. Scope

This is a general system change. Shared code accepts a story key and repository-relative paths as data and must work across companion/no-companion, one/multiple locations, varied page counts, ordinary/reveal-gated props, cover authority, and supported/unsupported action semantics.

The selected first story is calibration data only. No shared branch, default, rule, fixture helper, or exception may name or encode that story, its cast, pages, props, locations, or reveal.

## 4. Risk of hardcoding

The main risks are proving only the selected 12-page shape, accepting an unsupported source beat by force-fitting the closed action vocabulary, omitting image-direction or cover changes from source invalidation, or allowing a preflight to touch an injected provider.

The required fixture matrix and exact source-bound digests address those risks. Unsupported action semantics remain an explicit stable blocker and never become free-text authority.

## 5. Files likely affected

- `lib/visual-contract-compiler/` strict draft schema, prompts, assembly, repair, and call options
- `backend/providers/pipeline.ts` additive exact provider/endpoint/retry/timeout/tool/service-tier overrides
- `lib/visual-package/` source snapshot, authoring request/preflight/receipt, readiness, and immutable persistence
- `scripts/production-visual-lifecycle.ts`
- focused compiler/provider/lifecycle fixtures and tests
- `CURRENT.md` and this Decision Gate record

Story Sources, existing reviewed Visual Contracts, reconciliation approvals, Blueprint/Board/package/runtime behavior, database/storage code, deployment configuration, and production flags remain unchanged.

## 6. Expected behavior after change

- A content-addressed source snapshot binds normalized raw source, parsed page prose, historical image directions, authored cover authority, story key/path, and the legacy D0 source identity.
- Any text, page, image-direction, or cover-authority mutation changes the snapshot digest and invalidates every bound downstream artifact.
- The authoring request fixes OpenAI, Responses API, `gpt-5.6-sol`, standard service tier, reasoning `medium`, strict exact JSON Schema, tools disabled, no fallback, zero transport retries, 20-minute timeout, 64,000 input-token ceiling, page-derived output ceiling, at most two semantic repairs/three provider requests, and a $5.00 projected ceiling.
- Preflight proves provider/model/schema/call/input/output/timeout/retry/cost gates before an injected provider is reachable.
- The strict authoring draft supports source-grounded closed `actionRequirements`. Every action cites exact same-page source text. Unsupported semantics fail with a stable general blocker.
- Receipts preserve exact sanitized per-attempt and aggregate prompt/response digests, labels, usage, pricing assumptions, bounded projected/actual cost, validation errors, and stable status without prompts, responses, credentials, headers, environment values, or raw provider exceptions.
- Source snapshots, requests, receipts, candidates, reconciliation draft/review surfaces, and readiness evidence use content-addressed no-overwrite persistence.
- No compiler or model output approves itself. Reconciliation remains a separate exact-digest artifact and grants no Blueprint, Board, package, render, publication, or release authority.

## 7. Validation plan

1. `npx --no-install tsc --noEmit`.
2. Focused action-authority, request/preflight/receipt, pipeline-override, immutable-persistence, and CLI suites.
3. General fixtures covering the approved source shapes and failure matrix.
4. Offline CLI generation of the selected real source snapshot, preflight receipt, and blocked readiness evidence.
5. Literal `npm run check`, distinguishing only independently reproduced pre-existing ignored-output fixture failures.
6. `git diff --check`, forbidden-literal/boundary scans, and final topology reconciliation.

No image or page render is required or authorized.

## 8. Cost impact

Expected spend: **$0**.
Expected provider/model/image generations: **0**.

Only deterministic local TypeScript, Vitest, temporary fixtures, immutable local review artifacts, and Git inspection are permitted.

## 9. Rollback plan

The milestone is isolated in focused local commits on its dedicated branch. Rollback is a normal revert of those commits. The real review artifacts are local, content-addressed, ignored outputs and can be retained as evidence or removed in a separately audited cleanup. There is no remote, database, storage, Board, approval, publication, package, deployment, or production state to unwind.

## 10. Review assignment

Guy has already approved the source-authority architecture, exact future OpenAI request, budgets, action policy, immutable lifecycle, zero-cost boundary, and exclusions.

Claude Code first-pass review is read-only and should try to falsify:

- exact source invalidation for text/page/image-direction/cover mutations;
- provider unreachability before every preflight gate passes;
- provider/model/endpoint/service-tier/schema/tools/retry/timeout/cost lock enforcement;
- unchanged retry defaults for unrelated callers and zero retry leakage for the approved request;
- action source grounding, closed vocabulary, duplicate/malformed rejection, and unsupported-semantic stable failure;
- per-attempt/aggregate accounting and absence of raw prompts/responses/secrets/provider errors;
- content-addressed no-overwrite behavior for every artifact class;
- absence of self-approval, fabricated candidate/reconciliation, or downstream authority;
- generality across every required fixture shape;
- D1A0 having performed no external action.

Claude Cowork review is not required for this zero-cost technical tooling milestone. Guy will review future real semantic artifacts before any approval.

## 11. Do not do

- No credential or environment-file loading.
- No live authoring/model/LLM/provider/fetch/network reachability.
- No image render, Vision, audio, Supabase, storage, database, or Board action.
- No real semantic/source approval, Blueprint authoring, package publication/promotion, production activation, deployment, PR, push, or cleanup.
- No edit to a Story Source or existing reviewed Visual Contract.
- No fabricated live candidate or completed reconciliation.
- No story-, child-, companion-, page-, location-, prop-, or reveal-specific shared implementation.
- No full-book or page render.

## Stop-check record

1. General system fix: **yes**.
2. Cross-story risk: **yes**, controlled by exact snapshots, closed schemas, and multi-shape fixtures.
3. Production behavior affected: future authoring eligibility only; current runtime and production activation remain unchanged.
4. Spend: **none**.
5. Smallest validation: deterministic fixtures, provider-unreachable preflight, immutable local artifacts, TypeScript, focused suites, full repository check.
6. Remaining Guy decision before D1A0: **none**; the delegated brief is explicit approval.
7. Claude Code target: exact invalidation, locked request, retry/cost enforcement, action grounding, artifact immutability, receipt sanitation, and external-boundary reachability.
8. Claude Cowork question: **none for D1A0**.
9. Guy eyeball: the later real Visual Contract/reconciliation review artifacts, not this offline snapshot or synthetic fixtures.
