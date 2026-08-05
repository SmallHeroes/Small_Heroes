# R1D-PVB-D1A1B1 per-attempt typed draft-validation diagnostics hardening — implementation evidence

**Status:** Local implementation complete; independent Claude Code technical review pending; repository/release HOLD remains

**Date:** 2026-08-05

**Immutable base:** `84bea6b6017026935ac588f4e98a7e3ca7d42791`

**Branch:** `codex/r1d-pvb-d1a1b1-per-attempt-typed-draft-validation-diagnostics`

**Worktree:** `C:\Users\guyna\.codex\worktrees\0246\Small_Heroes`

**Authoritative Decision Gate:** `docs/ai-workflow/R1D_PVB_D1A1B1_PER_ATTEMPT_TYPED_DRAFT_VALIDATION_DIAGNOSTICS_HARDENING_DECISION_GATE.md`

**Cost/render allowance used:** `$0`; zero provider/model calls and zero renders

## 1. Outcome

The Visual Contract compiler now owns a closed typed diagnostic identity for every failure eligible to enter its repair loop. Exact rejected drafts and existing error prose remain available only inside the in-memory bounded repair loop for the unchanged repair prompts. Successful compiler results, exhaustion errors, unusable-repair errors, receipts, readiness, and persistence carry only closed typed summaries and structural locators.

Receipt authority is cut over from v11 to v12. Readiness authority is cut over from v9 to v10. Every receipt attempt carries either `draft-validation-attempt-diagnostics/v1` or `null`; readiness deep-copies the exact chronological receipt trail and its closed status without recomputation or prose interpretation.

This implementation does not recover the identities of the already-consumed historical `15 -> 2 -> 2` run. Its v11 receipt, v9 readiness, and associated evidence remain immutable historical records.

## 2. Root cause and implemented correction

Before this milestone, validators knew the failing invariant and structural context but exposed only strings. The compiler preserved those strings and rejected drafts for repair, then the lifecycle reduced them with regexes to broad count/code summaries before discarding raw material. Stable issue identity was therefore lost before persistence.

The correction introduces a parallel typed channel:

- four closed families: `draft_schema`, `draft_contract`, `action_semantic`, and bridge-only `source_evidence_id`;
- an exhaustive string-literal issue catalog with no generic `unknown`, `other`, dynamic, or prose code;
- exact family/code/locator validation;
- a discriminated locator union containing only closed enums, positive page numbers where applicable, and bounded non-negative structural indices;
- canonical identity by family + code + canonical locator;
- deterministic normalization, deduplication, ordering, transition calculation, and typed-family broad summaries;
- per-attempt emitted/current/new/persistent/resolved counts, transition items, `finalAttempt`, and `truncated`;
- a 128-item persisted transition cap with complete pre-cap counts.

`InvalidTemplateContractError`, the base Visual Contract validator, and vNext assertions now require non-empty typed issues. A string-only repairable construction fails the diagnostic invariant. The mechanical producer census is frozen by test and TypeScript checks every constructor call.

## 3. Producer and routing coverage

Typed emissions cover:

- base Visual Contract shape/reference/consumer validation through a source-owned typed error collector;
- vNext coverage, page/cast/transition/continuity, human-cast, environment, and base-validator delegation;
- Template schema, binding, topology, coverage, cast, fact, lifecycle, consumer, and final structural validation;
- compiler topology resolution, cover/source projection, world type, fact/cast authority, source phrase validation, and final assembly checks;
- Action Semantic page grounding and final coverage validation;
- the existing Source-Evidence-ID affected-record bridge with exact existing failure codes and page/coverage indices.

The existing route predicate is unchanged:

- Source-Evidence-ID-only failure selects the compact patch repair;
- any mixed repairable failure selects the full-draft repair;
- authority/reference-domain failures remain `DraftAuthorityReferenceDomainError`, separate and non-repairable;
- Action Semantic capability gaps remain `ActionSemanticCapabilityGapError`, separate and non-repairable;
- initial decode failure and unusable repair output retain their existing terminal classifications.

Typed identities never select repair input, eligibility, mode, call count, or budget. The exact previous draft and exact existing error strings still feed only the existing repair prompt while the repair loop is active.

## 4. Persistence and transition semantics

Visual Contract receipt v12 adds:

- `draftValidationDiagnostics` on every attempt, containing the exact typed object or `null` when that attempt never entered draft validation;
- `draftValidationStatus` with `not_evaluated`, `completed`, `interrupted`, or `repair_exhausted`.

Visual Contract readiness v10 adds `draftValidation`, containing the exact receipt status and an exact deep copy of the ordered attempt array. Current persistence validates:

- exact nested keys and closed values;
- attempt diagnostic validity and chronological null-tail semantics;
- exactly one final validated attempt when a trail exists;
- completed zero-current final state;
- exhausted non-zero final state and exact terminal binding;
- typed-family broad summary codes and complete capped count;
- receipt and readiness digests;
- readiness receipt digest binding and exact trail/status equality.

Historical receipt v11 and readiness v9 are explicit `legacy_immutable` versions and cannot validate as current evidence through copying or redigesting.

## 5. Focused commits

1. `3c7f4ee8e97190a98b8fcac605983552b877b594` — `feat(visual-contract): add typed draft validation diagnostics`
   - closed contract, normalization, validators, producer emissions, typed base/vNext/Template assertions, Source-Evidence-ID bridge, and compiler-only sanitized summaries.
2. `7f59e9afcd14f49ed522362d5d9768533ba15cb1` — `feat(visual-contract): persist typed validation trails`
   - receipt v12/readiness v10, attempt/status projection, exact persistence/binding validation, legacy cutover, and raw exhaustion/output-invalid disposal.
3. Branch `HEAD` — `test(visual-contract): prove typed diagnostic lifecycle`
   - exhaustive catalog/locator/census/transition/cap/privacy tests, lifecycle scenarios, workload count-only correction, `CURRENT.md`, and this evidence.

The immutable QA range is the base above through the final branch `HEAD`; the copy-ready handoff supplies the resolved full head hash after this evidence commit is finalized.

## 6. Files and scope

Primary production changes:

- `lib/visual-contract-compiler/draftValidationDiagnostics.ts`
- `lib/visual-contract-compiler/validateBookVisualContract.ts`
- `lib/visual-contract-compiler/validateVNextVisualContract.ts`
- `lib/visual-contract-compiler/validateTemplateContract.ts`
- `lib/visual-contract-compiler/actionSemanticCoverage.ts`
- `lib/visual-contract-compiler/validateSourceEvidence.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- narrow typed-constructor propagation through compiler artifact/migration/render guards and exports
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- narrow readiness persistence wiring in `scripts/production-visual-lifecycle.ts`

Test/state changes include the new exhaustive `lib/__tests__/draft-validation-diagnostics.spec.ts`, lifecycle/repair/topology regression updates, the exact workload inventory count correction, `CURRENT.md`, and this file.

No shared Blueprint or non-Visual-Contract terminal implementation was edited.

## 7. Validation evidence

All ordinary and resource-intensive focused phases used the repository workload policy and its canonical worker bounds.

### Focused deterministic PASS

- Compiler/lifecycle/census: **11 files / 251 tests passed** at ordinary maximum four workers.
- Shared terminal/Blueprint preservation: **3 files / 41 tests passed** at ordinary maximum four workers.
- Canonical live-boundary resource suite: **1 file / 132 tests passed** at resource maximum two workers.
- After the repository gate exposed four stale raw-prose expectations, the exact corrected `visual-contract-s2b.spec.ts` passed **1 file / 8 tests** at ordinary maximum four workers.
- Repository-local `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

The new exhaustive spec proves:

- exact family and code catalogs;
- enum/integer-only locators and illegal-combination/extra-key rejection;
- canonical ordering and deduplication under emission and object-key reordering;
- initial, persistent, newly introduced, resolved, and zero-current successful final transitions;
- 129 complete issues produce 129 truthful counts, 128 persisted items, and `truncated: true`;
- exact-key, count, item-order, status, and trail tampering fails;
- the mechanical `InvalidTemplateContractError` producer map is exhaustive;
- string-only repair error construction fails closed;
- base, Template, and vNext invalid values emit one valid typed sibling per error;
- lifecycle no longer reads raw exhaustion error arrays or invokes the prose classifier for draft validation;
- hostile authored/provider/path/key/stack/secret-shaped strings do not serialize in typed evidence.

### Repository gate — truthful HOLD

The first literal `npm run check` launch was terminated by the command wrapper at five seconds, before TypeScript or either Vitest phase returned a repository result. The same literal command was immediately relaunched with a sufficient outer timeout, completed in approximately 157 seconds, and was not run again.

Completed result:

- TypeScript: PASS.
- Ordinary phase: four workers, 267 files, valid diagnostic protocol, exit `1`.
- Resource-intensive phase: two workers, **19/19 files passed**, 119.039 seconds, valid diagnostic protocol, no RPC/IPC/timeout recurrence, exit `0`.
- Summary: 286 canonical files / 267 ordinary / 19 resource-intensive; overall exit `1`.

The ordinary failures were:

- the established six missing ignored-output fixture failures in `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two `story-read-back-validation.spec.ts` cases;
- four stale `visual-contract-s2b.spec.ts` assertions that expected raw validation prose on the now-sanitized terminal exhaustion error.

The four stale assertions were a test-contract consequence of the approved privacy boundary. They were changed only to assert exact typed codes/trails and non-persistence, then the exact spec passed 8/8 with TypeScript and diff-check. The full repository gate was not rerun. Therefore the completed gate remains HOLD and the six known fixture failures remain separate unresolved repository/release blockers. No new production assertion remains unexplained.

## 8. Immutable and unchanged evidence

The following Git blob identities are byte-identical between base and the completed worktree:

- historical exhausted-attempt execution evidence: `83901e047d9a6754a301a1b80bb9f249277e526b`;
- shared `authoringTerminalDiagnostics.ts`: `ab746046203bd23d83b299600bd6c4cf501149e7` (raw SHA-256 `B532E305F5BBE5E33D9A5D208A346D9A85824AC3430590974F41FA68BE150B68`);
- `preRenderBlueprintAuthoring.ts`: `9aaee3e00b13addf6a99798cd6d82f3c9cb7dba8` (raw SHA-256 `640A0B152F473653981D7391BC91317CB4C03B66C80614A27944D2693CBC079B`);
- production Blueprint receipt owner `productionAuthoringRunner.ts`: `cb510a14f0b100e9aa9a20eff1ceca72fbd715c4` (raw SHA-256 `65708C0EBDEBE9CADDC8900D0ED3AB8830207149A40425A2BABBE967C100AF4F`);
- `package-lock.json`: `dfa99c4778cf411ba7be5908ed27d9f8cb3ec62f`;
- `test-infrastructure/vitest-workload-policy.json`: `544bfb134ee153978801b7e3e7ef0c1336abe915`.

The new spec increases only the workload inventory assertion from 285 to 286 and the ordinary assertion from 266 to 267. Resource-intensive remains 19; worker policy, timeouts, retry behavior, skips, dependencies, and lockfile are unchanged.

## 9. Preserved product/provider policy

Unchanged authority includes:

- request v10;
- candidate v7;
- OpenAI evidence v3;
- provider-failure v2;
- production Blueprint receipt v4;
- B0 materialization input v6 and manifest/verification v8/v8;
- pre-live readiness v7;
- Execution Request/readiness/result v7/v7/v5;
- all prompt and structured-output schema versions and bytes;
- model `gpt-5.6-sol`, Responses API, default service tier, and reasoning policy;
- 64K input ceiling and existing output budget;
- one initial plus two repair calls, timeout, transport retries `0`, and no fallback;
- compact Source-Evidence-ID versus mixed/full-draft routing;
- candidate semantics;
- `$4.884` reserved maximum and `$5.00` hard ceiling;
- resemblance threshold and every downstream authority boundary.

## 10. Forbidden/external boundaries

No credential was accessed, checked, loaded, or exposed. No pricing lookup, network/provider/model call, B0/Fresh Readiness, Execution Request materialization, preflight, Supervisor verify/live, live authoring, render/image/Vision, storage/database/Supabase, Board, real Semantic Reconciliation, Blueprint/Wizard execution, package publication, approval, promotion, production activation, deployment, firewall change, or push occurred.

All provider behavior in tests used local injected fakes/sentinels. External cost was `$0`.

## 11. Limitations and next action

- The six established ignored-output fixture failures remain repository/release blockers.
- The known resource RPC/timeout did not recur in the completed gate; this single pass does not erase its historical status.
- The full repository gate was not rerun after the four test-only typed-assertion corrections, so no whole-repository green claim is made.
- This implementation does not identify historical final-attempt issues retroactively.
- Codex does not self-award independent technical PASS.

Next action is immutable read-only Claude Code adversarial review of the exact base-to-head range. No Fresh Readiness, provider call, render, publication, release, deployment, or push is authorized by this evidence.

## 12. Claude Code falsification targets

Claude Code should try to falsify:

1. every repairable producer has a non-empty closed typed sibling and no string-only/default/prose-parsed path remains;
2. family/code/locator combinations and exact keys reject arbitrary authored/provider material;
3. normalization identity, ordering, deduplication, transition counts, 128 cap, and truncation remain truthful;
4. successful final, exhaustion, compact repair, unusable repair, and interrupted/null semantics are correct;
5. Source-Evidence-ID-only and mixed-failure repair routing are unchanged;
6. authority/reference-domain and capability-gap failures remain separate and non-repairable;
7. receipt v12 and readiness v10 reload, digest-bind, and preserve exact trail/status equality;
8. receipt v11/readiness v9 remain immutable legacy and cannot validate as current;
9. raw drafts, errors, prompts, responses, names, IDs, paths, hashes, phrases, provider messages, stacks, credentials, and secrets cannot persist in the typed evidence;
10. shared terminal and Blueprint v4 behavior/bytes remain unchanged;
11. request/candidate/provider/B0/pre-live/Execution Request versions, prompt/schema/model/budget/timeout/retry/fallback/cost/candidate policy remain unchanged;
12. no forbidden external boundary was reached and the repository-gate HOLD is reported without overclaim.
