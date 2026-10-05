# Early draft critique to editor QA handoff

## Requirement and decision

Guy approves a general engine fix, independent Claude Code review and one fresh
fictional text-only book under the existing12USD ceiling. Trial08 found an
ungrounded roof guess in both original/final, while the editor received neither
finding. This is evidence for feedback routing, not a request to patch Uri/Neta.
The approved decision is PERSONAL_DRAFT_CRITIQUE_DECISION_20261005.md.

## Immutable scope and authority

Codex root is the sole implementation writer on
codex/personal-book-storyboard-bridge in
C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes.
Base3f4b929d73ebab6cf714e74dce2b667b4b00bc5d; exact committed successor is provided
with the invocation. First Claude pass is read-only against that complete range.
Managed automatic reviewer: personal-trial06-auto-qa, initially detached3f4b929d;
root moves only this clean owned checkout to the supplied head before review.

Protected d53b768ccb2f, accepted-intent63ccb484, human QA ccf5f706, site QA5fe73b3f,
Claude site87b0d196 and main90364542 remain untouched. No network Git refresh,
dependency install, key, live generation, push or deployment during this build.

## Production implementation

Five production paths:

- lib/personal-wizard/story-causal-experiment.ts: original packet extraction with
  identical reader instructions; material finding projection and revalidation;
  optional causal editor wrapper with complete unique source-bound responses.
- lib/personal-wizard/story-causal-experiment-runner.ts: true-only benchmark
  policy capture; original review moved once; bounded projection/record before
  claim; failures terminal; retained original/final/comparison order in result.
- scripts/personal-causal-trial-host.ts: exact inert full-wire fit against the
  existing slot; full reading/forwarded JSON/wire-digest journal before claim;
  preflight-versus-dispatch binding; critical feedback record integrity checks.
- scripts/personal-causal-trial-journal.ts: optional targeted recorded-file
  verification; no-argument full audit unchanged and still used at completion.
- scripts/personal-single-book-calibration.ts: policy admission/propagation and
  opt-in escaped evidence display; default viewer/output classifier unchanged.

No new stage, slot, provider, model, output cap, price, shared public schema,
wizard path, soft-word gate or automatic prose retry. Flag absent preserves the
default prompts, schemas, calls, digests and viewer. False/nonbenchmark flags
fail before reservation/probe as appropriate. Reader instructions do not reveal
that notes go to an editor. Neither isolated final nor comparison gets feedback,
response reasons or editor ratings.

Projection includes only kind issue plus blocking/meaningful severity, blocking
first then stable original order. IDs are original indices. At most6 whole
findings and12288 canonical projection UTF8 bytes; no quote/explanation is sliced.
The forwarded representation adds its digest (86 bytes, ceiling12374); the full
wire check includes this overhead. Neither representation cap is the wire cap.
These limits alone are NOT budget proof: existing prepareCausalWire checks the
entire actual serialized editor prompt/schema/input/paths against the old slot.
Only wire_limit/wire_budget are fitting failures. Empty baseline must fit; whole
low-priority tail cards are then omitted with counts. If issues exist but no card
fits, stop before editor claim. Truly empty is valid and labelled inconclusive.

Source quotes and reading/context hashes are recompiled against the original.
The exact forwarded JSON is saved before editor claim; the actual later wire
must match that prepared digest after awaits. Editor treats notes as fallible,
may decline, keeps its own diagnosis and must respond once per forwarded ID.
Responses demonstrate acknowledgement, not actual repair or literary quality.

When feedback is active without synopsisRepair, original receipts/transfers are
checked before subsequent actions; all journal records are audited on completion.
The first implementation rescanned growing history and a new six-case test took
about44s. Targeted checks reduce it to about9s. Only this new36-dispatch durable
case uses15s; no previous test/global/runtime timeout changed or test removed.

## Tests and measurements

Three changed specs: core150 (127+23), host100 (89+11), calibration97 (92+5).
Focused command returned509/509 across six files (150+99+97+80+42+41).
The first command misspelled the comparison spec and Vitest silently ignored that
path; root noticed and separately ran the correct story-comparison.spec.ts48/48.
That intermediate557/557 total was TWO commands. After adding a dedicated early
original-receipt tamper case, the correct full seven-file sequential command
passes558/558 (150+100+97+80+42+41+48,80.9s). Final precommit tsc is run separately
to completion and supplied at invocation.

First host run had93pass/5fail and an RPC error. Tests incorrectly assumed a
synthetic maximum must omit six cards and expected raw host error causes despite
the unchanged coordinator sanitizer. Synthetic worst-case wire and exact-bound
expectations were corrected, and the slow new cohort test was handled above.
No passing rerun is presented as a permanent stability or causality proof.

Nine Vite in-memory mutations run the actual23 new core tests. Positive23 pass;
flag/filter/priority/byte-bound/no-fit/response-coverage/context-binding/
record-before-claim/source-quote removals fail1/1/2/1/1/2/1/2/1 intended tests.
No disk source replacement, import error, unhandled error, provider or key.
This measures test sensitivity, not the truth of the literary criticism.

Frozen Git base modules are loaded into memory. Ten complete coordinator
fixture paths cover normal/benchmark, one/six cases, selected/self-replan and
single-case synopsisRepair first-WRITE paths; four inert calibration preflights
cover modes/repair switch. Calls, results, snapshots, actual serialized SDK wires,
schemas and default viewer match. This does NOT test every maximum legal input
or an actual external repaired-plan branch. Existing repair tests still pass.

Maximum feedback tests include full Hebrew/escaped criterion/explanation/quotes,
real request preparation, dynamic omission, no-fit, zero/issues-versus-style,
tampered receipt/transfer/wire, exact response IDs/digest and reader isolation.
The early receipt case corrupts its recorded bytes immediately after settlement
and requires no transfer file and no editor claim, not just eventual rejection.
Cancellation is covered in the opt-in core; an opt-in late-reader timeout was
not separately added. Existing native deadline tests pass. Coverage is bounded.

Old172 evidence files/32 roots remain byte/size/inventory-identical; old approval
families are sealed and never reused. Ignored evidence still lacks verified
off-machine backup. No new paid trial was run at this implementation boundary.

Actual full npm run check exits1. Ordinary392 files:6214 pass,10 missing-artifact
failures,73 skipped. Resource20 files:634 pass,one failure in the unchanged
live-execution-supervisor exit-zero/provider-failure case and three onTaskUpdate
RPC timeouts. Both lane gates fail. RED is retained; neither baseline causation
nor release/whole-repo stability is asserted. The full run precedes the final
test-only receipt case; no production change followed it and no full rerun is
claimed after that added test.

## Reproduction and evidence

Use local installed packages only, with heavy checks sequentially:

    node node_modules/typescript/bin/tsc --noEmit
    node node_modules/vitest/vitest.mjs run lib/personal-wizard/__tests__/story-causal-experiment.spec.ts lib/__tests__/personal-causal-trial-host.spec.ts lib/__tests__/personal-causal-trial-native.spec.ts lib/__tests__/personal-single-book-calibration.spec.ts lib/personal-wizard/__tests__/story-editor.spec.ts lib/personal-wizard/__tests__/story-semantic-audit.spec.ts lib/personal-wizard/__tests__/story-comparison.spec.ts --maxWorkers=1 --minWorkers=1

Evidence directory under known visualization root:
draft-critique-editor-20261005. Read full-check.log/json; NEVER rerun the write-once
full-check-run.cjs collector. Read-only mutations.cjs and frozen-default-parity.cjs
may be rerun; saved result files remain unchanged. Preservation verifier:
single-book-calibration-20261005-approved-08/verify-closeout.cjs.

## Falsification targets

Attack real flag admission and captured policy, cross-case/source/digest/quote
substitution, complete response coverage, whole-card capacity and maximum full
wire, tampering between recording/claim/dispatch, receipt/transfer integrity,
reader cancellation/failure with no fallback, original slot replay and one/six
case ordering, default serialized parity and all old seals/artifacts. Check that
targeted journal verification does not claim a full active-history audit.

Try to leak reader notes/editor responses into isolated final/comparison input;
try to consume editor reservation on a fitting/recording failure; distinguish
host attempt receipt from the coordinator's existing generic safe failure code.
Check viewer empty/omission wording is not an approval/no-problems claim.

## Next experiment and exclusions

After actual Claude code PASS, run ONE new fictional8-spread book with fresh
one-use approval/family, draftCritique:true, existing pinned Opus author and
fresh-process editor, isolated Astra reviews, optional single reserved plan
repair and fresh whole-plan review. Recheck current official prices before
execution. Existing conservative allowance11.588803USD stays below12USD; actual
cost/list estimates are disclosed separately, not invoices.

No finding means repair efficacy untested, not permission for another trial.
Compare original/forwarded notes/editor responses/final for improvement and loss.
Astra judging its own notes is not independent literary proof. Guy owns product
quality. No six-book run, visual work, public flow activation, push, deployment,
release acceptance or independent technical PASS is awarded by this document.
