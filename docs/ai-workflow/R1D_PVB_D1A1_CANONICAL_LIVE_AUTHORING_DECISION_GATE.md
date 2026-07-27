# R1D-PVB-D1A1 — Canonical Live Authoring Decision Gate

**Status:** APPROVED scope; initial implementation `031bcb6a..e069f19e` received Claude Code **HOLD** (2 MAJOR, 4 MINOR). Corrective code commit `e8a01182` is locally green and awaits READ-ONLY re-gate; no PASS is claimed.
**Immutable base:** `031bcb6aa08d4a9ee7cf527bb051970efc3e96d1`
**Implementation branch:** `codex/r1d-pvb-d1a1a-live-authoring-boundary`
**D1A1A cost boundary:** exactly zero provider, model, LLM, image, Vision, network, storage, database, or Board calls
**D1A1A external-call boundary:** none
**D1A1B status:** not authorized; future one-invocation live authoring milestone only after separate official price verification and Guy spend approval
**D1A1C status:** not authorized; future local semantic review/approval milestone only after a successful D1A1B artifact and Guy inspection

## 1. Proposed change

Add the canonical executable and provider-evidence boundary needed before the first real D1A Visual Contract authoring call:

```text
exact Story Source request
  -> rebuilt immutable source snapshot
  -> supplied exact content-addressed snapshot comparison
  -> separately authored mode=live request
  -> deterministic policy/topology/schema/price/spend gates
  -> delayed existing-process credential read
  -> one exact OpenAI Responses adapter
  -> bounded initial call plus at most two semantic repairs
  -> sanitized immutable receipt/readiness evidence
  -> candidate only after complete compilation and action authority
  -> separate future Semantic Reconciliation and human approval
```

D1A1 is deliberately split:

- **D1A1A — Canonical Live Authoring Boundary:** zero-cost launcher, private-entry closure, exact adapter, import preflight, artifact orchestration, fixtures, tests, and documentation.
- **D1A1B — One Real Authoring Invocation:** a future separately authorized live invocation after read-only official price verification and an explicit spend decision.
- **D1A1C — Local Review and Approval:** a future separate review of the D1A1B candidate, Semantic Reconciliation, and exact human approval. It cannot be combined with the provider call.

## 1A. R1D-PVB-D1A1A-QA-FIX disposition

Claude Code's first-pass review of `031bcb6aa08d4a9ee7cf527bb051970efc3e96d1..e069f19e8c9a071cffb22ff5b66d27ea2643e82b` returned HOLD. Guy authorized the correction in the same task, worktree, and branch without expanding the zero-cost D1A1A boundary.

Both MAJOR findings and all four MINOR findings are accepted:

- **MAJOR — credential-bearing destination was not pinned:** the installed OpenAI SDK could consume routing/identity environment defaults. Correction pins `https://api.openai.com/v1`, guards the final exact HTTPS `/v1/responses` POST, rejects redirect following and unauthorized identity headers, explicitly nulls organization/project/webhook authority, filters non-authorized SDK environment names from the child, preserves only `OPENAI_API_KEY` as future credential authority, keeps retries at zero, and sends `store:false`.
- **MAJOR — provider reachability preceded durable output authority:** correction realpath/containment-checks, creates, and writable-probes every output category first; persists the exact source snapshot and approved live request before the credential/provider boundary; and writes the sanitized receipt first after a handled provider result, followed by readiness and then candidate.
- **MINOR — incomplete rejected-request reasons:** durable rejected evidence now contains a non-empty, bounded, deduplicated, sorted set of stable reason codes, including `request_mode_must_be_live`, and no full request or raw untrusted value.
- **MINOR — sentinel arming was inferred:** the exact private-entry test hook now requires a same-path credential/write arming marker; canonical subprocess output positively confirms that marker, while independent positive controls and restoration remain.
- **MINOR — byte equality was not canonical:** D1A1 evidence uses a scoped human-readable stable serializer that sorts keys and NFC-normalizes strings/keys before immutable equality checks.
- **MINOR — the temporary page ceiling was implicit:** under the current `$5` / three-call policy, up to 12 pages qualify; 13 or more fail before credential/provider reachability with `page_budget_partition_decision_required` and require a separate budget or partition Decision Gate.

Additional accepted pre-spend hardening makes the exact Responses evidence brand mandatory on the canonical live path, versions the authoring request as `visual-contract-authoring-request/v3`, binds initial system/user prompt digests and versions, binds the repair system digest plus compiler-owned repair user-builder version, and verifies that authority before every provider call. D1A0 retains its explicit optional injected-provider seam.

Advisory disposition: live adapter/runner barrel exports are removed; rejected evidence retains only bounded labels/digests/reason codes; exact model equality remains fail-closed. Provider alias behavior cannot be proven without a live call, so first-contact exact-label risk remains documented rather than broadened speculatively. The input ceiling remains a conservative UTF-8 byte upper bound plus protocol allowance because no already-approved zero-cost tokenizer authority is introduced.

## 2. Why now?

D1A0 has independent technical PASS for its injected-provider lifecycle, immutable source snapshot, exact request, conservative `$5.00` fence, sanitized receipt/candidate functions, and fail-closed validation. It intentionally has no canonical live provider adapter or public live command.

The generic pipeline currently does not expose all receipt authority required for D1A1. Its Responses result omits exact response ID, input-token and cached-input-token detail, and exact returned provider/model evidence from the D1A receipt path. Incomplete output is raised before that complete evidence can be recorded. A paid authoring call before the executable and evidence boundary exists is forbidden.

## 3. Scope

This is a general system change. Shared code accepts repository root, Story Source authority request path, source-snapshot path, live-request path, and immutable artifact output path as data. It must not name or branch on any current story, cast member, child, companion, page, prop, location, reveal, or calibration case.

D1A1A may add:

- one Windows-safe/POSIX-safe canonical `node` launcher;
- a capability-guarded private TypeScript entrypoint and direct-core refusal;
- a strict exclusive import-preflight mode and strict live command shape;
- one D1A-only OpenAI Responses adapter using the exact installed local dependency;
- additive receipt evidence required by the canonical adapter;
- one immutable local live-orchestration boundary;
- synthetic fixtures, throwing sentinels, focused tests, and tracked governance/state documentation.

D1A1A may not perform a live invocation or create a real candidate/reconciliation/approval.

## 4. Approved architectural decisions

1. **Generality:** shared implementation is path/data driven. Calibration evidence never becomes a shared-code exception.
2. **One public launcher and private-entry closure:** one canonical `node` command owns future preflight/live execution. It resolves the exact local `tsx` dependency, preloads the repository `server-only` shim in the child before TypeScript evaluation, uses a one-time capability, rejects direct private/core execution, parses strictly, propagates all child outcomes deterministically, and removes unauthorized OpenAI SDK routing/identity environment names from the child without printing their values.
3. **Exclusive zero-cost import preflight:** preflight accepts no source, output, credential, model, price, or write authority. It imports and checks the exact future live graph under throwing network, credential, and write sentinels without invoking any external or write boundary. The private entry and credential/write sentinel complete an explicit arming handshake; output states only direct checks.
4. **One exact D1A adapter:** the live lifecycle receives one explicitly injected OpenAI Responses adapter. The adapter honors OpenAI / Responses / exact `gpt-5.6-sol` / default service tier / reasoning `medium` / strict `vc-draft-schema/v6` / tools disabled / `store:false` / no fallback / zero transport retries / 20-minute timeout / 64K conservative input ceiling / page-derived output ceiling. Its credential-bearing transport is pinned to the exact HTTPS Responses endpoint and refuses alternate destinations or redirects.
5. **Delayed credential boundary:** no env file is loaded. Only `OPENAI_API_KEY` from the existing process environment may be read, and only after deterministic source, snapshot, request, topology, price, schema, retry, timeout, token, spend, output containment, category creation/writable probe, and durable source/request authority gates pass. Credential values are never printed, persisted, copied, hashed, or included in errors.
6. **Exact live request and cost fence:** live consumes a separately authored `mode=live` v3 request and never mutates a D1A0 preflight artifact into live authority. Price version/digest, provider/model/schema, initial/repair prompt authority, call/repair budget, timeout/retry, source bindings, `$5.00` hard ceiling, maximum reserved exposure `$4.884`, and current 12-page maximum remain exact. Thirteen or more pages require a separate budget/partition Decision Gate. D1A1A neither verifies public prices nor spends.
7. **Sanitized immutable artifacts and honest failure semantics:** one handled invocation persists content-addressed source/request authority before provider reachability, then receipt first, readiness second, and candidate last only on full compile/action success. Raw prompt, raw response, credential/header/env value, raw provider exception, invalid draft, and full stack are excluded. D1A1 writes are canonically serialized, no-overwrite, identical-byte idempotent, and different-byte collision rejecting. Forced termination or disk failure can still interrupt the post-call in-memory interval before a receipt is durable; no automatic rerun/resume authority exists.
8. **Approval/downstream separation:** a produced artifact remains candidate only. No automatic Semantic Reconciliation, human approval, Blueprint readiness, Board/package/render/publication/production authority, or deployment follows.
9. **QA, rollback, and milestone separation:** D1A1A is independently reviewed before D1A1B. Rollback is focused commit revert; D1A1A creates no external state. D1A1B and D1A1C each require their own explicit authorization and immutable review range.

## 5. Files likely affected

- new canonical launcher, launcher runner, guarded entrypoint, and CLI core under `scripts/`;
- new D1A-only OpenAI Responses adapter and live orchestrator under `lib/visual-package/`;
- additive D1A receipt evidence in `lib/visual-package/visualContractAuthoringLifecycle.ts`;
- focused subprocess sentinels and launcher/adapter/lifecycle tests;
- `package.json` only if a canonical convenience alias can point to the same `node` launcher without creating another executable path;
- this Decision Gate and `CURRENT.md`.

The generic story pipeline, D0/D1A0 public CLI commands, Story Sources, reviewed Visual Contracts, reconciliation approvals, Blueprint/Board/package/runtime behavior, production flags, database/storage code, and deployment configuration remain unchanged.

## 6. Expected behavior after D1A1A

- The sole public command is copyable on Windows and POSIX shells and never depends on `npx`, a global `tsx`, an alternate shim, or caller cwd for dependency resolution.
- `preflight` imports the exact live adapter/orchestrator graph and nothing else. Any extra flag or positional token fails closed before that graph loads.
- `live` requires exact explicit path inputs, rebuilds current source authority, validates the supplied content-addressed snapshot, requires a separate `mode=live` request, and stops every stale or mutated authority before credential/provider reachability.
- The adapter constructs only the locked Responses request, configures SDK and request transport retries to zero, and exposes response ID, exact provider/model labels, input tokens, cached input tokens, output tokens, reasoning tokens, total tokens, and completion status.
- The adapter pins the exact official Responses destination, disables provider storage, and cannot inherit base URL, organization, project, webhook, or logging authority from the canonical child environment.
- Missing, malformed, inconsistent, overflowing, incomplete, failed, or substituted provider evidence fails closed and is sanitized.
- Before any future call, the canonical path proves writable contained output authority and durably records exact run intent. Successful and handled-failure paths persist receipt before readiness/candidate. Candidate persistence is conditional on complete compiler/action success and remains `candidate`.
- D1A0 provider-unreachable commands and unrelated pipeline retry defaults remain behaviorally compatible.

## 7. Validation plan

1. Direct private entry and direct CLI core subprocesses fail before CLI/provider work; the canonical launcher succeeds.
2. Launcher runner tests prove exact local `tsx` and shim ordering plus child error/signal/nonstandard-status propagation.
3. Parser tests reject unknown, positional, duplicate, equals-form, incompatible-mode, and help-mixture inputs; only exclusive preflight and exact live shapes pass.
4. Real subprocess preflight imports the exact live graph under throwing network, credential, and write sentinels. Every sentinel has a positive control; in-process fetch restoration is checked on success/failure/overlap.
5. Stale/invalid source, snapshot, request, schema, pricing digest, cost, retries, timeout, provider/model/tier/tools/fallback, and token budgets stop before credential/provider access.
6. Adapter tests cover exact request body/options, complete Responses evidence, missing/malformed/overflow usage, missing response ID, incomplete/truncated/failed status, provider/model mismatch, and provider-failure sanitization.
7. Lifecycle tests cover success, zero/one/two repairs, repair exhaustion, exact call count, `$4.884` reservation, `$5.00` fence, and zero transport retries.
8. Artifact tests cover request/receipt/readiness/candidate idempotence, collision refusal, secret/raw-prompt/raw-response/raw-error absence, and no downstream authority.
9. Existing D1A0 lifecycle/compiler/preflight and generic pipeline retry suites remain green.
10. Run `npx --no-install tsc --noEmit`, literal `npm run check`, committed-range `git diff --check`, shared calibration-literal scan, boundary scan, and final topology reconciliation.
11. Adversarial correction tests cover SDK environment-default bypass, exact guarded destination and redirect refusal, `store:false`, output traversal/symlink/unwritable refusal, exact write ordering, rejected reason codes, sentinel arming, canonical serialization, 12/13-page behavior, evidence-brand enforcement, and prompt digest/version enforcement.

No image, page, book, audio, Vision, provider, storage, database, or Board action is required or authorized.

## 8. Cost impact

- D1A1A expected spend: **$0.00**.
- D1A1A expected provider/model/LLM calls: **0**.
- D1A1A expected image/audio/Vision calls: **0**.
- Future D1A1B maximum application calls: **3** (one initial plus at most two semantic repairs).
- Future D1A1B transport retries: **0**.
- Approved point-in-time maximum reserved exposure: **$4.884**.
- Hard ceiling: **$5.00**.
- Current maximum qualifying book length under this exact fence: **12 pages**. A 13-page request projects beyond the approved fence and stops before credential/provider reachability; partitioning or a changed budget requires a new Decision Gate.

Before D1A1B, the Lead must obtain separate authority for read-only official price verification. Any mismatch stops the live milestone and requires new authority.

## 9. Rollback plan

D1A1A is isolated in focused local commits on its dedicated branch. Rollback is a normal revert of those commits. It applies no migration and creates no remote, provider, database, storage, Board, approval, publication, package, production, or deployment state.

The QA correction has no external state. Focused rollback is a normal revert of the correction commits after `e069f19e`; it does not authorize reuse or replay of any future provider request.

Temporary synthetic test artifacts are local and scoped to test-owned directories. Cleanup of unrelated artifacts, worktrees, or branches is not authorized.

## 10. Review assignment

Guy has approved the nine architectural decisions and the D1A1A/B/C separation. No additional product decision is required before D1A1A implementation.

Claude Code first-pass review is read-only and should try to falsify:

- every executable/private/core bypass;
- exact dependency and shim ordering on Windows/path-with-spaces and POSIX-shaped inputs;
- strict parser exclusivity;
- exact import-graph preflight and every network/credential/write sentinel;
- credential access before all deterministic gates;
- any env-file load or alternate credential name;
- exact Responses request/provider/model/tier/reasoning/schema/tools/fallback/retry/timeout/token policy;
- complete response ID/labels/usage/completion evidence and all malformed/incomplete cases;
- call/repair/reservation/cost accounting and unrelated pipeline retry compatibility;
- immutable idempotence/collision behavior and receipt secret/raw-content leakage;
- candidate-only status and absence of reconciliation/approval/Blueprint/Board/package/render/publication authority;
- story/calibration literals in shared production code;
- D1A1A having performed no external or paid action.

Claude Cowork review is not required for this technical zero-cost boundary. Guy will inspect the future D1A1B semantic artifact before D1A1C.

## 11. Do not do

- No pricing lookup, documentation lookup, internet, fetch, or network access.
- No credential source or env-file loading; no real credential value.
- No provider/model/LLM call or live authoring.
- No image, audio, render, Vision, Supabase, storage, database, or Board action.
- No real Semantic Reconciliation, Story Source approval, Blueprint authoring/approval, package assembly/publication/promotion, production activation, deployment, PR, or push.
- No Story Source or reviewed Visual Contract edit.
- No fabricated real candidate, reconciliation, approval, or readiness.
- No story-, child-, companion-, page-, prop-, location-, reveal-, or calibration-specific shared implementation.
- No unrelated artifact, branch, or worktree cleanup.
- No D1A1B or D1A1C execution.

## Stop-check record

1. General system fix: **yes**.
2. Cross-story risk: **yes**, controlled by path/data inputs, exact content addresses, and general fixtures.
3. Production behavior affected: **future offline authoring execution only**; runtime rendering and production activation remain unchanged.
4. Spend: **none in D1A1A**.
5. Smallest validation: strict unit tests plus real sentineled import subprocesses and synthetic temporary artifacts.
6. Remaining Guy decision before D1A1A: **none**.
7. Claude Code target: bypasses, early credential/provider reachability, complete evidence, bounded cost/calls, secret safety, immutable artifacts, and downstream separation.
8. Claude Cowork question: **none for D1A1A**.
9. Guy eyeball: **the future real D1A1B candidate and its separate reconciliation/review surfaces, not D1A1A synthetic fixtures**.
