# Claude Code re gate for simplification test coverage

Guy's approved free A/B correction loop preserves useful story QA while reducing
unnecessary paperwork. This successor pins four valid P3 coverage gaps from
Claude Code's independent B report. All were correct at HEAD; none requires a
new runtime guard, prompt, model, abstraction, migration or paid experiment.

## Scope and topology

Worktree: C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes.
Branch: codex/personal-book-storyboard-bridge. Base 223499b3232e5a0ec569131a1d1dab713ab7c764;
head is the focused local commit containing this file. Freeze that SHA, then
review only base..head, not a later moving branch. Root is sole writer in this
existing task. Reviewer worktree sh-qa-book-10f54930 is detached at 223499b3 and
clean; it must move explicitly to the frozen successor before re-gating.
First pass read-only: no edits/providers/credentials/spend/push/deploy.

Prior independent verdicts are recorded without extension:
A b9995108..471890ad PASS, P0/P1/P2/P3 zero; B 471890ad..223499b3 PASS,
P0/P1/P2 zero, P3 four. Original reports are not rewritten:

- qa-simp/CLAUDE-QA-A-471890ad.md, 4973 B, SHA256
  2c97760017985ff46bc59d3e90e91ef9b6d3f9dee7975ede63a5ad0243c67aea.
- qa-simp/CLAUDE-QA-B-223499b3.md, 7903 B, SHA256
  7b975c6ec7587527e1d5b3e9044b126349c79f2bc4b32ddcf332e37c52ca4d15.

Both are beneath C:/Users/guyna/AppData/Local/Temp/claude/C--GNart-Work-Small-Heroes/
af9211ff-30ea-426d-9794-43cad9ee3788/scratchpad. Their full gates independently
report ten inherited artifact failures (A 6090 pass, B 6096 pass, both 73 skip),
resource 635/635 plus two RPC errors, native 1. No EEXIST reproduced there.
This does not prove a permanent collision fix or release stability.

## Implementation and discriminating controls

Only two spec files changed, plus CURRENT, ROADMAP and this handoff:
lib/personal-wizard/__tests__/story-causal-experiment.spec.ts and
lib/__tests__/personal-single-book-calibration.spec.ts. All existing tests stay.

P3-1: four cases start with a real injected completed benchmark result, named
original/final/comparison and zero findings. Append duplicate final, comparison,
original or an unknown stage; leave every required reading present and clean.
Clean result is ready for human review; each altered copy holds. No unrelated
blocking finding or missing-stage check can hide the targeted clause.

P3-2: real completed clean benchmark readings have their stages removed. The
same data is ready under explicit legacy-v1 display and held under current-v2.
All findings are empty, so a wrongly mapped blocking final cannot mask fallback.
The presentation checks leave the input JSON unchanged.

P3-3: actual bookRoot/manifest.json after injected driver.plan(), not just preview,
has policy.maximumMicroUsd equal to 9248802 normal / 11338803 benchmark, spec's
reservation, manifest reservation and active slot sum. Only probe+plan dispatches
occur; finally stop the synthetic driver. Existing key callback is never invoked.

P3-4: compile a valid selectedFixture first, then independently inject a schema-
valid absent original/revised setup_payoff quote. compileCausalEdit must throw
exactly causal_experiment_semantic_evidence, not a prior schema/source failure.
The valid original fixture still produces exactly the same output afterwards.
This pins the causal caller, not only the shared semantic-audit function. Quote
binding proves provenance, not the model's logical or literary interpretation.

## Validation

```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
npx tsc --noEmit
npx vitest run lib/personal-wizard/__tests__/story-causal-experiment.spec.ts lib/__tests__/personal-causal-trial-host.spec.ts lib/__tests__/personal-causal-trial-native.spec.ts lib/__tests__/personal-single-book-calibration.spec.ts lib/personal-wizard/__tests__/story-editor.spec.ts lib/personal-wizard/__tests__/story-semantic-audit.spec.ts lib/personal-wizard/__tests__/story-comparison.spec.ts
git diff --check
npm run check
```

Type check 0; two changed specs 157/157 (86+71), seven-spec focused set 448/448
(86+80+80+71+42+41+48). Nine new tests, no removed tests. Diff check clean.
Direct full successor gate observed native exit 1. Ordinary: 10 failures,
6105 pass/73 skip (6188 tests), 6 failed/369 passed/17 skipped files (392),
phase exit 1. The ten failure names match the inherited artifact failures:
child-lexicon-ages-5-8 (1), momentum-gate-koko (1), page-entity-qa (1),
story-read-back-validation (2), story-source-visual-direction-acceptance-lifecycle
(4), reserved-page-placement-authority (1). No new failed test or EEXIST observed.
Resource: 20 files/635 tests pass, but two onTaskUpdate RPC errors make phase
exit 1 (on_task_update_rpc_timeout and signal_or_exit_failure). Full remains RED,
not ready for release; this observation does not close the stability risks.
One earlier shell summary-capture invocation returned 1 without phase output;
do not confuse it with the subsequent direct full check or infer a product failure.

Six negative controls used an external Vite pre-transform against the real
production imports. It changes code in memory only, with unique-anchor checks
and an applied marker; no production file on disk was changed. Each run selects
the nine new cases and catches only its intended failures:

| Weakened clause | Intended failures |
| --- | --- |
| final/comparison exact count becomes at least one | 2 duplicate cases |
| optional original count limit removed | 1 original duplicate |
| known-stage allowlist removed | 1 unknown record |
| positional mapping accepts any version | 1 clean current stage-less case |
| host ceiling restored to BOOK_ALLOWANCE | 2 actual mode ceilings |
| causal assertSemanticEditEvidence call removed | 2 false quote sides |

All six broken versions exit 1 with exactly those failures; the coordinator exits
0 for caught controls. Subsequent normal validation uses the normal config, not
the mutation plugin. No exhaustive mutation claim; the unreachable backup guard
B4 is unchanged, not declared newly covered. No focused/mutation run overlaps
the full gate. External audit helper is outside the engine tree, not runtime.

## Preservation and boundaries

Read-only engineering recomputation: 70/70 historical files, twenty roots, all
five closeouts and ten seals unchanged, zero missing/additional/changed files.
Earlier review files and the 8884bd8e envelope report are unchanged. Protected
d53b 768ccb2f and accepted-intent 63ccb484 remain clean/pinned. SiteQA 5fe73b3f
and Claude site 87b0d196 are untouched. Existing Git-ignore warning remains;
no global config workaround. This is local preservation, not backup or billing.

Codex-invoked Claude CLI source-only opinions for 5b9628ec/275c1834 did not run
tests and are not this independent reviewer's tested A/B gate. The independent
reviewer has explicitly not reviewed those older prompt-contract commits.
This successor clarifies that provenance without rewriting the saved opinions.
Before any push, inspect every ahead commit and its exact gate records.

No paid book, retry, provider, new key, render, narration, site/wizard connection,
deployment or push. Full stability, story quality, product/release acceptance
remain open. Do not broaden A/B PASS to this successor until re-gated. Rollback
is a focused revert of tests/docs only, never a journal reset or artifact deletion.

## Falsification targets

Confirm production bytes equal 223499b3; then rerun the focused set and weaken
each clause independently. Require its exact new case to fail, not a neighbouring
guard. Test clean positive controls and legacy JSON immutability. Verify actual
host manifest versus preview, precise semantic_evidence failure, original report
fingerprints and the paid evidence inventory. Issue the successor verdict only
for this immutable range; no paid-run or branch-wide approval is requested.
