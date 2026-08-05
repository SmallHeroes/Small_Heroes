# R1D-PVB-D1A1B1 Recurring-Prop Consumer and Lifecycle Domain Hardening - Implementation Evidence

Date: `2026-08-05`

Status: **implementation complete; independent Claude Code QA pending; repository gate HOLD**

Decision Gate: `docs/ai-workflow/R1D_PVB_D1A1B1_RECURRING_PROP_CONSUMER_AND_LIFECYCLE_DOMAIN_HARDENING_DECISION_GATE.md`

Branch: `codex/r1d-pvb-d1a1b1-recurring-prop-consumer-lifecycle-hardening`

Worktree: `C:\Users\guyna\.codex\worktrees\2371\Small_Heroes`

Exact base: `5a24001f516e431d0341c9bd94a11b3d1674e17d`

Committed milestones before this evidence commit:

1. `8d9e60e0` - draft schema/contract, compiler, prompts, and exact diagnostics;
2. `ff0a37ae` - lifecycle migration and B0/readiness/execution authority bindings.

Commit 3 is the commit containing final-v4 compatibility, Blueprint/Wizard qualification, exhaustive regressions, the cover-fidelity input converter, `CURRENT.md`, and this evidence. The QA handoff records its exact hash and immutable `base..HEAD` range.

External cost: `$0`.

## 1. Outcome

The recurring-prop spatial domain has exactly two closed consumer scopes:

- `stable_set`: persistent Set Board binding for a uniquely declared, ungated, never-forbidden, genuinely stable prop;
- `page_frame`: page-scoped Blueprint placement at or after reveal only when the page explicitly requires the prop and valid placement support/anchor semantics pass.

The provider-facing draft field is nullable `spatialNodes.stablePropId` in `vc-draft-schema/v13`. The compiler rejects the removed draft field `spatialNodes.propId`, duplicate bindings, lifecycle-gated bindings, and consumer-forbidden bindings fail-closed. A valid stable binding normalizes into the unchanged final `BookVisualContractTemplate` / Set Board `propId`, `fixedObjects`, and zone `bindsTo` representation.

The terminal identities remain exactly `recurring_prop_lifecycle_gated` and `recurring_prop_consumer_forbidden`; their closed field role is now `spatialNodes.stablePropId`. Duplicate new-v13 binding uses the existing typed `recurring_prop_reference_cardinality_invalid` authority.

Reveal-gated or portable props never become fixed Set Board architecture. A required reveal-page prop can become a Blueprint placement consumer with compatible support and exact anchor semantics. A merely permitted prop creates no mandatory consumer. Neutral pre-reveal support geometry remains spoiler-neutral and unbound.

## 2. Final-v4 compatibility interpretation

The Decision Gate phrase “one stable placement” is enforced as one draft-authoring `stablePropId` binding for new v13 output. It is not a new exact-one validation rule for historical final v4.

Final `vc-schema/v4` retains its pre-milestone compatibility invariant: every declared fixed object must have at least one valid stable area/node placement, and all lifecycle, consumer-safety, projection, and authority checks must pass. Multiple stable nodes or areas may legitimately describe one persistent installation. Direct regression coverage proves both sides:

1. a legacy/final-v4 fixed prop with multiple stable area nodes remains valid;
2. a new v13 draft using the same `stablePropId` twice rejects with `recurring_prop_reference_cardinality_invalid`;
3. one new binding compiles into the unchanged final-v4 representation;
4. lifecycle-gated and consumer-forbidden bindings retain their exact terminal identities.

No final-v4 contract, historical authority, receipt, readiness, execution artifact, or legacy byte was migrated, rewritten, redigested, or promoted.

## 3. Version cutover and unchanged contracts

The approved current authorities are:

- `vc-draft-schema/v13`;
- initial system/user prompts `vc-template-prompt/v10` and `vc-template-user-prompt/v10`;
- repair system/user prompts `vc-repair-prompt/v9` and `vc-repair-user-prompt/v10`;
- Visual Contract request/receipt/readiness/candidate `v10/v11/v9/v7`;
- live-request materialization input `v6`, manifest and verification `v8/v8`;
- pre-live readiness evidence `v7`;
- Execution Request/readiness/result `v7/v7/v5`.

Superseded authorities reject fail-closed before any credential/provider reachability. Canonical materialization input v1, OpenAI evidence v3, provider-failure evidence v2, final VC v4, Blueprint v4/draft v5, Visual Package v5, runtime v6, model/tier, 64K ceiling, budgets, timeout, retries `0`, no fallback, `$4.884/$5.00` ceilings, candidate semantics, resemblance threshold `0.70`, renderer, and downstream policy are unchanged.

## 4. Implementation boundaries

### Commit 1 - draft/compiler contract

- `lib/visual-contract-compiler/templateDraftSchema.ts`;
- `lib/visual-contract-compiler/types.ts`;
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`;
- `lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics.ts`;
- `lib/visual-contract-compiler/setBoardStableAuthority.ts`;
- provider-facing initial/repair prompt coverage, Structured Outputs coverage, and compiler diagnostics tests.

### Commit 2 - lifecycle authorities

- `lib/visual-package/visualContractAuthoringLifecycle.ts`;
- `lib/visual-package/liveRequestMaterialization.ts`;
- `lib/visual-package/canonicalPreLiveReadiness.ts`;
- `lib/visual-package/liveExecutionSupervisor.ts`;
- direct authoring, materialization, readiness, execution, and legacy-authority tests.

### Commit 3 - compatibility and qualification

- exhaustive stable/gated/page-frame compiler coverage;
- final-v4 multi-node stable-footprint compatibility;
- Blueprint reveal/forbidden/required/permitted/support/anchor and neutral-geometry coverage;
- zero-cost Wizard qualification with the gated portable prop outside Set Board authority;
- current/legacy lifecycle regression coverage;
- provider-draft schema shape coverage;
- cover-source-fidelity input-only conversion from a historical final-v4 clone to a valid new v13 test draft;
- `CURRENT.md` and this implementation evidence.

The cover converter keeps a deterministic per-draft `seenStablePropIds` set. It maps only the first non-empty historical final node `propId` to `stablePropId`; later nodes carrying the same final prop ID receive `stablePropId: null`. It then removes only the legacy field from the in-memory clone. The checked-in historical final-v4 artifact, expected compatibility, production code, assertions, and authority bytes are not changed by this converter.

## 5. Acceptance proof

Coverage proves:

- one stable ungated prop compiles to unchanged final fixed-object and zone binding;
- duplicate new-v13 stable binding rejects with `recurring_prop_reference_cardinality_invalid`;
- lifecycle-gated binding rejects with `recurring_prop_lifecycle_gated`;
- any forbidden stable consumer rejects with `recurring_prop_consumer_forbidden`;
- gated portable page constraints compile without Set Board projection;
- pre-reveal and forbidden Blueprint placements reject;
- post-reveal required placement with compatible support and exact anchor accepts;
- merely permitted creates no required consumer;
- neutral support geometry stays unbound and spoiler-neutral;
- legacy draft `propId` and superseded authorities reject fail-closed;
- the provider schema exposes only nullable `stablePropId` and remains Structured Outputs compatible;
- Wizard qualification reaches neither image/provider nor credential/storage/database/Board/publication/deployment sentinels;
- no calibration-story literal or exception was added to production logic.

## 6. Validation record

All validation was repository-local with no provider, network, render, storage, or database action.

### Focused implementation proof

- ordinary compiler, schema, Blueprint, and Wizard phase: **11 files / 309 tests PASS**;
- resource-intensive phase: **274/275 tests completed**, then the idempotence case in `live-execution-request-materialization.spec.ts` hit the unchanged 5-second test timeout and Vitest reported an `onTaskUpdate` RPC timeout;
- Guy authorized one isolated, one-worker replacement of that exact file with diagnostics and no timeout/config/retry/skip change: **1 file / 20 tests PASS**, exit `0`, signal `null`, launch error `null`, valid one-record diagnostic protocol, no diagnostic classes;
- the already-completed 274 resource tests plus the clean exact-file replacement are the bounded focused resource proof; the later full-gate recurrence remains an explicit infrastructure HOLD.

### Final-v4 compatibility correction

- direct v13 compiler plus final-v4 validator regressions: **2 files / 57 tests PASS**;
- visual-package lifecycle regression: **1 file / 31 tests PASS**;
- the expanded ordinary focused phase remained **11 files / 309 tests PASS**.

### Cover-fidelity fixture correction

The replacement full gate revealed four failures in `visual-contract-cover-source-fidelity.spec.ts`. All four passed the same historical final-v4 clone through the new v13 compiler. A first mechanical all-node field rename correctly continued to fail because the legacy final contract has multiple stable nodes for one persistent prop while new v13 permits one authoring binding. Work stopped fail-closed.

Guy accepted that a historical final-v4 authority is not itself a valid provider draft v13 and authorized the deterministic input-only converter described above. Final authorized validation then passed:

- cover-source fidelity, one worker, unchanged timeout: **1 file / 6 tests PASS**, exit `0`, valid diagnostic protocol, no diagnostic classes;
- direct v13 duplicate-binding and final-v4 multi-node regression files, one worker: **2 files / 57 tests PASS**, exit `0`, valid diagnostic protocol, no diagnostic classes;
- `npx tsc --noEmit`: PASS;
- `git diff --check`: PASS.

No further focused assertion or infrastructure failure occurred.

## 7. Literal repository-gate history and HOLD

Exactly two literal `npm run check` invocations occurred. No third run occurred.

1. The first gate exposed a compatibility contradiction: a newly added final-v4 exact-one placement validator rejected a historical fixed installation represented by multiple stable nodes/areas. The resource phase also hit the 5-second Execution Request test timeout and `onTaskUpdate` RPC timeout. The final-v4 validator was restored to its historical at-least-one invariant; the new-v13 compiler retained exact-one authority.
2. After the exact resource spec passed **20/20** alone with clean diagnostics, the one authorized replacement full gate ran. Its ordinary phase exposed four stale provider-draft fixtures plus only the six established missing ignored-fixture failures. Its resource phase reproduced the same 5-second test timeout and `onTaskUpdate` RPC failure. The four stale test inputs were corrected and directly revalidated 6/6; the full gate was not run a third time.

Therefore the implementation is ready for independent code review, but the literal repository gate is not green and Codex does not claim it is. Release remains on HOLD for:

- the six established missing ignored-output fixture assertions (`child-lexicon-ages-5-8`, `momentum-gate-koko`, `page-entity-qa`, `set-appearance-ref-budget`, and two `story-read-back-validation` cases);
- the independently scoped recurrence of the resource-phase Execution Request 5-second timeout / `onTaskUpdate` RPC failure.

No timeout, worker policy, global serialization, dependency, lockfile, retry, skip, assertion, reporter, or production behavior was weakened to hide either HOLD.

## 8. Preserved exclusions and rollback

No credential was checked, read, or loaded. No pricing/network/provider/model call, real B0/Fresh Readiness, Execution Request materialization, preflight, live authoring, candidate, Semantic Reconciliation, Blueprint publication, render/image/Vision, storage/database/Supabase, Board action, approval, publication, promotion, activation, deployment, firewall change, PR, or push occurred. External cost is `$0`.

Before any new authority is consumed, rollback is the three focused commits in reverse order. If a later current-version artifact exists, it must remain immutable historical evidence and the path must stop on HOLD for a reviewed forward correction; it must never be rewritten into current authority.

## 9. Independent QA assignment

Claude Code must review the final immutable `base..HEAD` range read-only and try to falsify:

1. that any third recurring-prop consumer scope or implicit stable/page inference exists;
2. that legacy draft `propId` can bypass v13 or that `stablePropId` can duplicate, bind a gated prop, or bind a prop forbidden on any Set Board consumer page;
3. that the exact terminal identities or closed locator field role drifted;
4. that final-v4 historical multi-node compatibility was weakened, or that the fixture converter mutates the checked-in final artifact;
5. that reveal-gated/portable props enter Set Board fixed authority or pre-reveal/forbidden frames;
6. that merely permitted props create consumers, neutral support geometry becomes bound/spoiling, or exact anchor support is bypassed;
7. that any approved version binding is incomplete or an old authority can be redigested/promoted;
8. that final VC, Blueprint, Visual Package, runtime, model, budget, timeout, retry/fallback, pricing, candidate, resemblance, renderer, or downstream policy changed outside the gate;
9. that a calibration-story literal entered production;
10. that provider, credential, image/render, storage/database, Board, publication, deployment, or external reachability became possible in qualification;
11. that this evidence overstates the focused results, hides either full-gate failure, implies a third check, or misclassifies the release HOLD.

Claude Code must distinguish implementation correctness from the explicit repository-infrastructure/release HOLD. Codex does not self-award independent technical PASS.
