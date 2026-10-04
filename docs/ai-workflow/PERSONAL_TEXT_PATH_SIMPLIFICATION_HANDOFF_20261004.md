# Claude Code handoff: approved free text-path simplification A/B

## Frozen scope and authority

Guy approved the two free milestones in
PERSONAL_TEXT_PATH_SIMPLIFICATION_DECISION_20261004.md on 2026-10-04. Requirement:
get to a good personal story without unnecessary machinery, preserving meaningful
independent QA; stop repeated paid failures and fix their measured cause first.

Worktree: C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes.
Branch: codex/personal-book-storyboard-bridge. Root Codex is sole writer.
A: b9995108..471890ad, cumulative-usage correction (separate A handoff).
B: 471890ad..the commit containing this handoff. Freeze its exact SHA before
review, not a later moving HEAD. First pass read-only: no providers, key reads,
spend, paid reruns, push, deployment or independent implementation changes.
Engineering subagent reviews are not independent Claude technical PASS.

## Implementation claims to attack

1. The normal diagnostic has five model dispatches when the first plan is selected:
   plan, fresh Opus author, fresh Opus editor, isolated final Astra, then fresh
   original/final comparison Astra. Optional replan retains a reserved sixth slot.
   Benchmark mode explicitly adds original_review: six ordinary dispatches and
   seven reserved slots. The identity probe is calibration-only, not a per-customer
   requirement; including it, normal maximum logical attempts is seven, benchmark
   eight. Logical dispatch counts do not attest internal CLI request counts.
2. causalStages owns active-stage reservation, actual review dispatch and preview
   counts. Captured mode cannot be mutated after construction. Mode enters policy
   and coordinator digests, but NOT the one-use family identity: mode/root changes
   cannot resurrect spent consent. Missing/extra reservations and unknown modes
   reject before ports; legacy policies reject before transport/artifacts.
3. Removed only backwardDependencies and its duplicated author input, plus the
   causal editor wrapper's diagnosis/strengths. Continuous synopsis, two genuinely
   different candidate requirements, outline HOLD, full ordered beats and all
   approved request/fact/interest/companion/count bindings remain. Causal planning
   and diagnosis-before-revision questions remain instructions. No claim that
   matching quotes ever proved logical entailment or that guidance proves thinking.
4. Shared editor v3 remains intact: revised plan/manuscript, six checks and five
   semantic edit categories with literal evidence and HOLD behaviour. No ordinary
   story_only, editor, storyboard, public wizard or provider-factory cutover.
5. Final Astra input has approved brief and final prose, not original, plan,
   editor scores/audit or author conversation. Comparison follows admitted final
   reading and receives both texts. Conversation identities remain distinct.
6. Reading stage is engine-derived, never model-authored. Final/comparison are
   selected by name, not array position; exactly one of each is required.
   Blocking final issue, remaining_problem or new_regression holds even when final
   is first. Repaired original defects, improvement and preferences are not
   automatic final failures. Missing/duplicate/unknown current readings hold.
7. Explicit diagnostic, host and calibration v2 contracts reject old inputs,
   including a v1 selected plan with a recomputed consistent fingerprint. Legacy
   diagnostic-v1 display alone can map its three stage-less historical records
   in memory; no archive write, upgrade, resume or runtime authority is created.
   Viewer escapes story/finding content and shows retained checks/audit/readings.
8. Caps/rates are unchanged. Using the same captured rate assumptions, normal
   eight-spread book reservation is 9,248,802 microUSD; benchmark 11,338,803.
   The removed slot is 2,090,001 microUSD. Actual host maximum/approved book
   allowance now equals that recipe's reservation; savings cannot fund retries.
   Probe reservation is 225,281, probe allowance 250,000; combined allowance is
   9,498,802 normal / 11,588,803 benchmark. These are defensive reservations,
   NOT expected cost, newly verified prices or invoice guarantees. Known/unknown
   usage, monetary, cancellation, source, timeout and durable no-replay guards stay.

## Files

Runtime B: lib/personal-wizard/story-causal-experiment.ts,
story-causal-experiment-runner.ts; scripts/personal-causal-trial-host.ts,
personal-single-book-calibration.ts. Four causal/host/native/calibration specs;
CURRENT, ROADMAP, decision update and this handoff. No app, shared editor runtime,
provider adapter B change, assets, site worktree or paid output edits.

## Validation, not independent acceptance

```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
npx tsc --noEmit
npx vitest run lib/personal-wizard/__tests__/story-causal-experiment.spec.ts lib/__tests__/personal-causal-trial-host.spec.ts lib/__tests__/personal-causal-trial-native.spec.ts lib/__tests__/personal-single-book-calibration.spec.ts lib/personal-wizard/__tests__/story-editor.spec.ts lib/personal-wizard/__tests__/story-semantic-audit.spec.ts lib/personal-wizard/__tests__/story-comparison.spec.ts
git diff --check
npm run check
```

Focused: 439/439 in seven specs: causal 84, host 80, native 80, calibration 64,
shared editor 42, semantic audit 41, comparison 48. tsc exits 0. Old tests for the
deliberately removed ledger contract were replaced/removed, not claimed unchanged;
the remaining and new tests retain fact/count/source/semantic evidence enforcement.
Two initial fixture errors (old dispatch count; check field observation instead
of note) were repaired before final checks. Full checks did not overlap focused
runs or deliberate mutations.

Negative controls: restore positional readings.slice(1), then the real-admitted
blocking-final test fails (incorrect ready instead of held). Remove the current
plan-version clause, then self-resealed v1-plan admission test fails. Both restored
before validation. A's four aggregate-usage positive controls likewise fail under
the old cap comparison. No claim of exhaustive mutation coverage.

Full B check: native 1, both type-check phases pass. Ordinary 392 files, exit 1;
resource 20 files / 635 tests pass but two onTaskUpdate RPC unhandled errors make
resource exit 1 (diagnostic on_task_update_rpc_timeout). Still RED, not stability
or release readiness. Full-run ordinary counts were truncated in the tool output;
do not invent them from another run. A separately captured ordinary replay at
unchanged B source returns 10 failed / 6096 passed / 73 skipped, six failed files,
369 passed files, seventeen skipped files (392 total); native 1, no EEXIST.
It uses the same repository supervisor/classification and four-worker policy;
only stdout/stderr capture is redirected to an in-memory summary. No new runtime
or test-gate change. This is a separate observation, not replacement of full RED.

The ten replay failures are the previously recorded artifact-dependent tests:
child-lexicon-ages-5-8 (one); momentum-gate-koko (one); page-entity-qa (one);
story-read-back-validation (two); story-source-visual-direction-acceptance-lifecycle
(four); set-identity-board/reserved-page-placement-authority (one). No historical
artifact is regenerated to make them pass, and no pristine-base full replay is
claimed in this milestone.

A's preceding full check had ordinary 11 failed / 6089 passed / 73 skipped:
ten previously recorded missing-artifact failures plus EEXIST in unchanged
story-commission-materializer atomicJsonWrite. Isolated replay of that named test
passed 1 with 30 skipped. Collision/load sensitivity is a hypothesis, not proven
causality or a closed issue. A's ordinary phase preceded B edits; its resource
phase finished during B edits, so do not call that a frozen A full-gate result.

## Preservation, topology and exclusions

Final read-only enumeration/recomputation: 70/70 historical files in twenty roots,
zero missing/additional/changed files; all ten seals and five closeouts unchanged.
Five probes remain probe_completed; book seals remain cli_termination (three),
coordinator_failed, usage. Trial05 is still sealed, not salvaged or restarted.
Both original source-review files and the 8884bd8e envelope report are unchanged.
Point-in-time local preservation is not verified backup or a billing inventory.

Protected clean SHAs: d53b 768ccb2fe20edb1351cb4783796613cbf7a2993c;
accepted-intent 63ccb4846ebe5be9ab392960d389610a1b2b9d42. Site QA, Claude landing
and reviewer worktrees are not implementation targets; recheck their status before
handoff. No configuration/ignore change was made to suppress Git's existing warning.

No new providers, keys, dollars, book, render, narration, carousel, public/QA
deployment or push. Technical/literary/product/release acceptance remains pending.
Smaller output and fewer calls are not measured better stories. The public/dev
story_only path still uses OpenAI and lacks this independent final literary gate.
Do not merge the local diagnostic into that flow merely to claim connectivity.

Next only after independent review and fresh explicit bounded consent: one
fictional short book with both versions readable, human judgement of draft versus
edit, then a diverse cohort. No automatic retry framework or six-book run here.
Rollback is a focused revert of A/B after topology/ownership checks; preserve all
historical outputs, journals and seals. Do not delete worktrees or reset a family.

## Adversarial priorities

Attack cumulative-versus-request accounting and exact USD boundaries (A); mode
admission/snapshot/no-replay and reservation equality (B); final-first HOLD via a
real runner response, not just a hand-shaped viewer record; source isolation and
comparison ordering; current/legacy version boundaries; retained shared editor
semantic evidence; public-runtime byte preservation; and all historical artifacts.
Review only the frozen ranges, not earlier unre-gated work. Any push would publish
all currently ahead commits, not only these two, and is Guy's separate decision.
