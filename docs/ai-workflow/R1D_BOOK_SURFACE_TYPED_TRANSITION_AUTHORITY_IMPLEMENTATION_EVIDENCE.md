# R1D BookSurface Typed Transition Authority — Implementation Evidence

**Status:** offline implementation green; independent Claude Code review pending
**Date:** 2026-08-26
**Owner:** Codex
**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Implementation base:** `d88337288db1eeb895cb9355f40ec23385436dee`
**Decision Gate:**
`docs/ai-workflow/R1D_BOOK_SURFACE_TYPED_TRANSITION_AUTHORITY_DECISION_GATE.md`

## 1. Authorization and exclusions

Guy approved the Decision Gate on 2026-08-26 with these binding decisions:

- use closed typed BookSurface transition subcauses;
- expose one effective transition chain derived from compiler truth;
- keep transition `kind` and `cue` under provider authority;
- perform only offline implementation and validation until Claude Code PASS.

This milestone performed no Fresh preparation, credential read, provider or
network call, paid authoring, Candidate publication, Wizard order, payment,
image/audio/Vision operation, render, deployment or push. The two prior paid
failures and their consumed Fresh roots remain immutable and unreused.

## 2. Observed failure and root cause

Consumed receipt
`784f4cd144a38e20522c0bf112197c3df230f1d8ff4c36624e2b5ee524aa29c3`
recorded seven canonical calls, six repairs, no retries or fallback, nominal
cost `$1.359974`, conservative cost `$1.575197`, and normalized issue trail:

```text
21 -> 17 -> 12 -> 9 -> 7 -> 7 -> 7
```

The final frontier contained four intentionally deferred
`represented_elsewhere_pointer_unresolved` identities and three broad
`page_transition_invalid` identities. The last two repair calls returned the
same response digest, so the exact-state stagnation guard correctly stopped.

The validator's transition decision depended on facts that BookSurface did not
carry: the exact transition failure branch, effective compiler-normalized
transition, actual ordered predecessor/successor, established-zone history and
prior threshold edge. The provider therefore could not distinguish states that
had the same page-local authored projection but different sequential validity.
More calls would have repeated an information-deficient request.

## 3. Implemented architecture

### Shared transition analyzer

New pure module `lib/visual-contract-compiler/transitionAnalysis.ts` owns:

- `effectiveTransitionState`;
- `analyzePageTransition`;
- `analyzeTransitionSequence`;
- the effective transition and prior-edge state used by both validator and
  repair-authority construction.

`validateVNextVisualContract.ts` now consumes this analyzer at the same local
and cross-page emission sites. The implementation preserves the prior rule
set, error prose, emission order and state updates. It does not weaken or add a
validation rule.

### Closed typed causes

Draft diagnostics advance from v4 to v5 and retain the broad compatibility
cause `page_transition_invalid`. Every current transition failure additionally
gets exactly one of these thirteen closed subcauses:

1. `page_transition_kind_invalid`
2. `page_transition_steady_destination_declared`
3. `page_transition_from_zone_undeclared`
4. `page_transition_to_zone_undeclared`
5. `page_transition_endpoints_equal`
6. `page_transition_before_already_destination`
7. `page_transition_before_zone_not_origin`
8. `page_transition_after_zone_not_destination`
9. `page_transition_threshold_zone_not_endpoint`
10. `page_transition_opening_departure_without_origin`
11. `page_transition_no_move_zone_changed`
12. `page_transition_origin_not_established`
13. `page_transition_origin_not_previous_zone`

Diagnostic identity remains `family + code + locator`. A subtype change stays
the same persistent issue identity while changing complete-state/stagnation
evidence. Broad-only v4 evidence remains valid only as legacy evidence;
subtype-only current evidence rejects.

### Effective transition authority

BookSurface prompt versions advance from v12 to v13; the response schema stays
v7. For a transition target the authority now contains:

- every ordered page, not merely numeric `pageNumber +/- 1` guesses;
- actual predecessor and successor page numbers;
- compiler-effective current zone and transition state;
- exact sorted declared zones;
- established zones before the page;
- prior threshold edge;
- the target's broad and exact typed transition causes.

Topology must be exact, unique and contiguous. Missing targets, duplicates,
gaps, stale endpoints and inconsistent page state fail closed. Ordering uses a
language-independent lexical comparator; mixed punctuation/case identifiers
such as `zone-1`, `zone:1`, `zone:A`, `zone:a`, `zone_1` are deterministic.

The provider-visible projection omits the private draft digest and transition
`cue` from read-only chain state. `kind` and `cue` are returned only as part of
an explicitly writable transition patch, so the provider continues to own the
narrative decision. Compiler-owned endpoint IDs must be the exact permitted
set and are never silently invented or rewritten.

### Integrity and coherent-rehash defense

The implementation initially proved that checking only a self-contained
authority digest was insufficient: a hostile caller could replace transition
targets with another writable field, remove transition authority and rehash
the entire object coherently. The final design closes that path with two
compiler-private values:

- the exact effective draft from which authority was created;
- the original expected authority digest captured before provider dispatch.

`compileBookVisualContractTemplate.ts` carries both values to prompt
construction and patch application. Each boundary re-derives the authority,
checks the private draft digest and requires equality with the captured
expected digest. Missing private state, stale authority, coherent downgrade,
or any rehashed mutation rejects before a write.

This is the only scope expansion beyond the Decision Gate's expected file
list. It is necessary because the binding must live outside the caller-mutable
authority. `pageContractRepair.ts`, route admission, scheduler behavior and
writable-field policy remain unchanged.

## 4. Compatibility and authority cutover

| Surface | Before | Implemented |
|---|---:|---:|
| Draft attempt diagnostics | v4 | v5 |
| BookSurface response schema | v7 | v7 unchanged |
| BookSurface system/user prompts | v12/v12 | v13/v13 |
| Authoring request/receipt/readiness | v51/v53/v51 | v52/v54/v52 |
| B0 input/manifest/verification | v39/v49/v49 | v40/v50/v50 |
| Execution materialization input/result | v35/v40 | v36/v41 |
| Supervisor request/readiness/result | v45/v45/v37 | v46/v46/v38 |
| Fresh Readiness evidence | v45 | v46 |

The diagnostics and authoring-lifecycle immediate predecessors remain
explicitly classified as immutable legacy evidence. Downstream predecessor
artifacts remain untouched but are no longer current authority. The BookSurface
response schema name and bytes are unchanged. Its canonical digest is still:

```text
a1d16581b25d9af14b33fdaa21806713f739212e51afa53643ba4c030739b20f
```

Unchanged authorities include template draft schema v21, authoring policy v18,
standard output budget v6, model/reasoning, seven-call maximum, six-repair
maximum, zero transport retries, no fallback, `$10` hard ceiling, Candidate v9,
Wizard bridge v4 and all image/audio/render contracts.

## 5. Adversarial proof

The focused regressions prove:

- all thirteen validator branches retain exact message/order/count and receive
  their exact subtype;
- broad compatibility identity and normalized unique counts do not change;
- subtype changes alter cause-aware stagnation evidence without creating a new
  issue identity;
- authored and compiler-effective transitions are distinguished;
- prior-threshold and established-zone counterexamples decode differently;
- out-of-order arrays canonicalize, while duplicates, gaps, missing targets,
  invalid endpoints and ambiguous topology reject;
- prompt and apply both reject missing private draft or expected digest;
- a fully rehashed target downgrade rejects and leaves source bytes unchanged;
- provider input contains no raw validation prose, rejected draft, attempt
  number, credential/provider material or hidden source prose;
- adjacent coupled repair reaches `3 -> 1 -> 0` with the production compiler
  and real validator;
- the historical live-shaped mixed route remains
  `19 -> 6 -> 5 -> 0`, selects BookSurface twice then pure
  represented-elsewhere repair, reaches Candidate and makes zero provider
  calls;
- regression and exact-state stagnation guards retain their counterexamples.

## 6. Input-ceiling evidence

Frozen accounting from the real system prompt, user payload and unchanged v7
schema:

| Case | System | User | Schema | Separators | Protocol | Estimated total |
|---|---:|---:|---:|---:|---:|---:|
| 8-page transition chain | 3,523 | 3,234 | 15,921 | 2 | 4,096 | 26,776 |
| 12 pages + 84 typed prop violations | 3,523 | 7,089 | 15,921 | 2 | 4,096 | 30,631 |

Both cases are route-admissible and leave substantially more than the required
4,096-byte margin beneath the 59,904-byte route ceiling.

## 7. Files changed

Production:

- `lib/visual-contract-compiler/transitionAnalysis.ts` (new)
- `lib/visual-contract-compiler/draftValidationDiagnostics.ts`
- `lib/visual-contract-compiler/validateVNextVisualContract.ts`
- `lib/visual-contract-compiler/bookSurfaceRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- `lib/visual-package/liveRequestMaterialization.ts`
- `lib/visual-package/liveExecutionRequestMaterialization.ts`
- `lib/visual-package/liveExecutionSupervisor.ts`
- `lib/visual-package/canonicalPreLiveReadiness.ts`

Tests:

- `lib/__tests__/draft-validation-diagnostics.spec.ts`
- `lib/__tests__/visual-contract-vnext-ws0.spec.ts`
- `lib/__tests__/book-surface-repair.spec.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/__tests__/offline-repair-harness.spec.ts`
- seven corresponding lifecycle/materialization/Supervisor/Fresh specs under
  `lib/visual-package/__tests__/`

Documentation:

- `CURRENT.md`
- the approved Decision Gate
- this implementation-evidence document

No story, child, companion, page, zone, prompt-content fixture, package,
Candidate, Wizard, render, output or deployment artifact changed.

## 8. Validation record

Final load-bearing validation on the final implementation bytes:

```text
npx --no-install vitest run
  lib/__tests__/offline-repair-harness.spec.ts
  lib/__tests__/book-surface-repair.spec.ts
  lib/__tests__/draft-validation-diagnostics.spec.ts
  lib/__tests__/visual-contract-vnext-ws0.spec.ts
  lib/__tests__/visual-contract-repair-loop.spec.ts
  --pool=forks --poolOptions.forks.singleFork=true

5 files passed; 201/201 tests passed
npx --no-install tsc --noEmit: exit 0
git diff --check: clean
```

Focused lifecycle/version evidence on the final bytes passed every assertion:

- source-authority lifecycle plus canonical authoring boundary: 278/278,
  process exit 0;
- live-request materialization: 35/35;
- live-request verification: 51/51;
- live-execution-request materialization: 21/21;
- Supervisor: 42/42, with one known Vitest `onTaskUpdate` worker-RPC timeout;
- canonical pre-live/Fresh Readiness: 14/14, with one known Vitest
  `onTaskUpdate` worker-RPC timeout.

That is 441/441 changed lifecycle assertions. The five non-Supervisor/Fresh
files total 385/385 with normal exit 0. Supervisor and Fresh each pass every
assertion but their isolated commands exit 1 solely because of the two recorded
worker-RPC anomalies.

One literal `npm run check` was run on the final bytes. Both TypeScript phases
passed. The ordinary phase passed 3,736 assertions and reproduced nine
pre-existing missing ignored-output fixture assertions across five unchanged
files, with 70 skips. The resource phase passed 613/613 assertions but recorded
three known Vitest `onTaskUpdate` RPC timeout events. The command therefore
correctly exited 1 and is not represented as a green full-suite gate. No
changed-code assertion failed. This document does not claim that those baseline
environmental failures were repaired.

## 9. Review state and next gate

Codex's local checks and parallel read-only audits found no remaining
implementation defect, but Codex does not self-award independent technical
acceptance. The next action is:

1. create one focused local commit from the explicit paths above;
2. give Claude Code the immutable base-to-head range, read-only first pass;
3. fix any valid finding in a separate commit and re-gate;
4. only after Claude Code PASS may Guy decide whether to authorize a new Fresh
   and one bounded live attempt.

Until that PASS, no Fresh, provider/live authoring, Candidate, Wizard or render
action is authorized.
