# R1D-PVB-D1A1B1 Action-Coverage Cardinality Page-Repair Routing - Implementation Evidence

## Status

Implementation is locally green and awaits independent Claude Code QA.

- Branch: `codex/r1d-pvb-d1a1b1-streaming-authoring-transport`
- Implementation base: `ba41de558f6fad4570266ea5111b63353c811eff`
- External implementation cost: `$0`
- Production: blocked

## Triggering live evidence

Fresh Readiness v15 `39f3a4eff6880d78e4d10c759a00ef54024c06c787dfe0d4b14c3a3387541698`, Execution Request `f5a126ad0b4cd2e64aedd2f025ad1f22aee62e7ef68ac014e8ed3919319a4b4f`, canonical preflight and Supervisor verify all passed on pushed head `ba41de558f6fad4570266ea5111b63353c811eff`.

The one live invocation completed one provider response and persisted receipt v21 `899cd79ea2211f400d170367bc77f2e125bb0340d9d15eed296c0daecab8b55c` and readiness v19 `7f160828da76e85ef24bfa56a6ba2a60a8053cf606bc3ec6e34de59cf8153d0b`.

- Calls / repairs / transport retries / fallback: `1 / 0 / 0 / false`.
- Usage: input `17,402`; cache-write `0`; cached input `17,399`; output `24,125`; reasoning `1,639`; total `41,527`.
- Nominal / conservative accounting: `$0.732465 / $0.915764`.
- Terminal class: `authority_reference_domain_failure` in `draft_authority_reference_domain`.
- Typed issue: `action_coverage_cardinality_invalid`, page 2, action index 3, `page_action / action_coverage / actionRequirements.actionSemanticCoverage`.
- Candidate, Reconciliation, Blueprint, Wizard and render authority: absent.

No raw prompt, response, provider message, stack or credential is reproduced here.

## Root cause and general correction

The compiler already required every action beat to bind exactly one same-page `actionSemanticCoverage` record whose disposition is `action_requirement`. It also already had a strict complete-page repair path. However, `DraftAuthorityReferenceDomainError` handling admitted only the stable-prop and page-spatial families; the exact action-coverage cardinality identity therefore fell through as terminal before the existing page repair could be selected.

The correction adds one closed planner:

1. every issue must pass the existing typed issue validator;
2. every issue must have code `action_coverage_cardinality_invalid` and the exact page-action locator identity;
3. page and action indices must resolve uniquely in the same draft;
4. duplicate target identities reject the entire plan;
5. the planner emits complete affected pages, closed repair targets and a deterministic validation hint; and
6. the existing parser, exact-set apply, immutable clone and full validation remain the only output/application path.

The surrounding repair classifier now preserves a precomputed closed page plan rather than overwriting it with generic structural classification. Unsupported, mixed, malformed, stale and unlocatable authority sets still throw the original terminal error.

Prompt authority advances from v6 to v7 solely to state this closed invariant. The page repair response schema stays unchanged.

## Validation

- Direct page repair, repair loop, lifecycle and live boundary: **4 files / 285 tests PASS**.
- Canonical Writer/materialization/verifier/Supervisor/Fresh Readiness chain: **7 files / 170 tests PASS**.
- Reference-domain matrix including the new route: **1 file / 36 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Repository gate replacement: all 19 resource-intensive files PASS with valid diagnostic protocol; ordinary phase contains exactly the established six missing ignored-output fixture failures and no seventh failure. Repository/release remains HOLD on those fixtures.

The first repository check after implementation found one stale test that asserted the new eligible issue remained terminal. The test was updated to prove exact typed emission plus complete-page routing. A later wrapper-owned replacement lost its output channel, and a sandboxed replacement could not read `vitest.config.ts`; neither reached a repository result. The final authorized outside-sandbox replacement produced the exact result above. No timeout, RPC/IPC, reporter, launch, signal, teardown or diagnostic-protocol failure occurred in that completed run.

## Unchanged boundaries and rollback

No model, schema, prompt budget, 64K ceiling, call/repair budget, timeout, transport retry, fallback, candidate, cost, credential, image, storage or production policy changed. Historical artifacts remain immutable and are not authority for a new attempt.

Rollback is the focused implementation commit. It would restore terminal fallthrough for this identity and prompt authority v6; it would not mutate any historical artifact.

Next after independent QA: push the exact head, materialize a new Fresh Readiness, execute one bounded live attempt, and on candidate success continue through Semantic Reconciliation, Blueprint/Wizard qualification and one local `gpt-image-2` LOW portrait-page render. Production remains blocked.
