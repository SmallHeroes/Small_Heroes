# Decision Gate - R1D-PVB-D1A1B1 Terminal Validation Classification and Repair Observability Hardening

Status: **APPROVED by Guy - implementation authorized**

Date: `2026-08-04`

Approved base: `f66a5dd6877aedaa5174b6b4f51a679c049f0883`

Implementation branch: `codex/r1d-pvb-d1a1b1-terminal-validation-observability`

Implementation worktree: `C:\Users\guyna\.codex\worktrees\112a\Small_Heroes`

Cost allowance: `$0`

## 1. Proposed change

Harden the general Visual Contract and production Blueprint authoring boundaries so every terminal failure has a positively established, closed, sanitized classification. Replace the residual `validation_exhausted` fallthrough with explicit provider-output decode, true validation/repair exhaustion, unusable repair output, draft authority/reference-domain, Action Semantic capability, post-compile authority, and unexpected local-processing outcomes. Add observed canonical-adapter execution evidence at the guarded transport boundary and bind the same classification and execution attestation into the Visual Contract receipt and readiness artifact.

## 2. Why now?

A completed canonical provider response with one logical call and zero repairs was persisted as `validation_exhausted`. The receipt carried no actionable diagnostic and could not prove the adapter's observed dispatch/retry/fallback/route facts. Claude Code rated the classification/evidence defect MAJOR-1 while confirming that artifact integrity itself passed. Incorrect exhaustion evidence can misdirect repair decisions and is not acceptable current authority.

## 3. Observed behavior, expected behavior, and root cause

### Observed

- `runVisualContractAuthoring` maps any uncategorized compiler exception to `validation_exhausted`.
- The initial provider output is decoded before the validation-repair loop, so a one-call JSON decode failure reaches that residual catch with no repair attempt.
- `DraftAuthorityReferenceDomainError` and unexpected local exceptions reach the same residual catch.
- A completed but unusable repair response is wrapped as `TemplateRepairExhaustedError` even when the full two-repair budget was not consumed.
- Exact validator strings are copied into persisted attempt receipts. Action Semantic capability evidence also includes the exact source phrase.
- OpenAI authoring evidence v2 proves provider response identity/usage but does not attest guarded transport dispatch count, transport retries, fallback use, or canonical route/model confirmation.
- `productionAuthoringRunner` defaults every non-budget/non-provider exception to `validation_exhausted`.

### Expected

- Validation/repair exhaustion is emitted only when the complete three-call/two-repair trail is proven.
- All other known terminal families retain distinct closed classifications; unknown errors fail closed as `local_processing_failed`.
- Exact validator detail may drive the in-memory repair prompt but only fixed, bounded diagnostic codes cross the persistence boundary.
- Canonical success and failure paths carry post-hoc observed execution evidence collected at the guarded transport boundary.
- Visual Contract receipt and readiness carry byte-equivalent classification and execution-attestation values; readiness does not recompute counters.

### Root cause

The lifecycle conflates exception capture with semantic classification. A nullable terminal override covers provider/policy/cost cases, while the catch block treats every remaining exception as repair exhaustion. The compiler also uses one exhaustion class for both completed-budget invalid drafts and an unusable repair response. Evidence schemas expose counters and selected provider facts without a shared terminal or execution-observation contract.

## 4. Scope and hardcoding risk

This is a story-neutral authoring/evidence change. Production code will contain no story, page, character, companion, phrase, or live-attempt literal. The common module owns only closed terminal metadata, sanitized diagnostic projection, and execution-attestation aggregation. Compiler routing, repair selection, and budgets remain unchanged.

Likely implementation surfaces:

- `lib/visual-package/authoringTerminalDiagnostics.ts` (new neutral foundation);
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`;
- `lib/visual-package/visualContractAuthoringLifecycle.ts`;
- `lib/visual-package/openaiResponsesVisualContractAuthoringAdapter.ts`;
- `lib/visual-package/providerFailureDiagnostics.ts`;
- `lib/visual-package/productionAuthoringRunner.ts`;
- canonical import preflight and focused lifecycle/adapter/provider/Blueprint tests.

## 5. Approved architectural decisions

1. `validation_exhausted` is never a default and is permitted only for proven full validation/repair-budget exhaustion. Current authority uses the more explicit `draft_validation_repair_exhausted` code.
2. The closed story-neutral taxonomy includes `provider_output_decode_failed`, `draft_validation_repair_exhausted`, `repair_output_invalid`, `draft_authority_reference_domain_invalid`, `action_semantic_capability_gap`, `post_compile_authority_incomplete`, and `local_processing_failed`, while preserving existing provider, policy, usage, cost, request, and budget families.
3. True Template repair exhaustion is distinct from an unusable completed repair response. Repair routing and budgets do not change.
4. Every terminal failure carries a closed sanitized phase, error class, repair eligibility, repair reason code, and bounded diagnostic count/codes.
5. Exact validator errors may continue to drive in-memory repair prompts. Persistent evidence contains only a sanitized projection and no raw draft, prompt, response, provider message, exception message, stack, or secret.
6. The canonical OpenAI adapter emits post-hoc observed logical-call, transport-dispatch, transport-retry, fallback-use, and canonical route/model facts. `maxRetries: 0`, the guarded single endpoint, and no fallback remain unchanged.
7. Receipt and readiness carry the same terminal classification and execution attestation. Readiness copies rather than reinterprets execution counters.
8. Current authority cuts over fail-closed: Visual Contract receipt v8 to v9, Visual Contract readiness v6 to v7, OpenAI authoring evidence v2 to v3, provider-call-failure evidence v1 to v2 where the shape changes, and production Blueprint receipt v3 to v4. Prior versions remain immutable historical evidence. Request, prompt/schema authority, and candidate versions remain unchanged.
9. The same no-fallthrough classification foundation applies to `productionAuthoringRunner`. Blueprint authoring, feasibility, Wizard behavior, call policy, and output semantics do not change.

## 6. Validation and acceptance criteria

The smallest proof is deterministic repository-local tests with provider, credential, network, storage, render, and downstream sentinels kept unreachable.

Acceptance requires:

- a valid initial response still produces a candidate;
- initial provider-output decode failure is one call/zero repairs, repair-ineligible, distinct, and sanitized;
- true exhaustion proves exactly three logical calls/two repairs and carries bounded diagnostic codes;
- an unusable completed repair response is `repair_output_invalid`, not exhaustion;
- draft authority/reference-domain, Action Semantic capability, and post-compile authority failures remain distinct and non-repairable;
- unexpected local exceptions fail closed as `local_processing_failed` without raw error material;
- receipt/readiness classification and execution attestation match exactly;
- canonical successful and failed adapter paths attest guarded dispatch/retry/fallback/route/model facts;
- v8/v6/v2/v1/v3 predecessors remain legacy and cannot become current authority;
- the production Blueprint runner has no residual exhaustion catch default;
- sanitization scans exclude secrets, raw prompts/responses/provider bodies, exception messages, and stacks;
- focused suites, deterministic TypeScript, and `git diff --check` pass;
- after focused green and TypeScript, one literal `npm run check` runs once with no retry. Only the established six ignored-fixture failures in the five documented files may remain; any other assertion or execution-protocol failure stops fail-closed.

## 7. Commit boundaries

1. Shared sanitized terminal types/classifier, compiler terminal distinction, and canonical adapter observed execution evidence.
2. Receipt/readiness/provider/Blueprint version cutover, lifecycle bindings, and regression suites.
3. `CURRENT.md`, this Decision Gate, and implementation evidence.

Each code commit requires focused tests, `npx tsc --noEmit`, and explicit-path staging. No `git add -A`.

## 8. Cost, migration, and rollback

Implementation and validation cost `$0`. No credential read/check/load, canonical preflight, pricing lookup, network/provider/model call, B0/Fresh Readiness, live authoring, render/image/Vision, persistence/database/Board action, publication, deployment, PR, or push is authorized.

Migration is a fail-closed authority cutover, not mutation. Historical artifacts and version labels remain byte-immutable and readable only as legacy evidence where supported. No old artifact is promoted or rewritten. Rollback is commit-level: revert the new current-authority code and keep live authoring on HOLD; never reactivate an old readiness artifact as current authority.

## 9. Risks and rejected alternatives

Risks:

- an execution counter derived from request policy instead of the guarded transport could create false evidence;
- persisting validator prose could leak source/draft/provider material;
- treating a partial repair trail as exhaustion could preserve the original defect under a new name;
- independently rebuilding readiness counters could drift from its receipt.

Rejected:

- retaining `validation_exhausted` as a residual fallback;
- matching exception message prose to select persisted codes;
- persisting raw validator errors, provider bodies, response text, or stacks;
- changing the prompt, schema, model, endpoint, retry/fallback, timeout, budgets, pricing, or hard ceiling;
- a Visual Contract-only patch that leaves the Blueprint runner's fallthrough intact;
- modifying or migrating historical live-attempt bytes.

## 10. Review assignment and stop-check

Guy approved all nine decisions and this implementation scope. No unresolved product, UX, story, visual, or creative decision remains, so Claude Cowork review is unnecessary.

Claude Code should attempt to falsify the positive exhaustion proof, decode/repair/domain/capability/post-compile separation, unknown-error fallback, sanitization boundary, observed dispatch accounting, receipt/readiness equality, legacy rejection, Blueprint parity, and every forbidden external boundary.

Stop-check result: general system fix; production evidence behavior changes but provider/output semantics do not; no money is spent; deterministic focused tests are the smallest safe proof; no image or visual checkpoint is applicable.

## 11. Do not do

Do not change model, provider, endpoint, service tier, prompt, JSON schema, 64K input ceiling, max output, call/repair budget, timeout, retry, fallback, pricing, `$4.884` reservation, `$5.00` ceiling, Blueprint/Wizard behavior, render behavior, or candidate semantics. Do not read `C:\GNart\Work\Small_Heroes\.env.local`. Do not run real readiness/preflight/provider/render/downstream operations. Do not touch unrelated worktrees, user changes, live-attempt artifacts, historical evidence, dependencies, lockfile versions, PRs, remotes, or deployment.
