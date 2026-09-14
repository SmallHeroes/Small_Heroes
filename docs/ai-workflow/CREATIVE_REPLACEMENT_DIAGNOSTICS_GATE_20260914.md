# Creative replacement v4 diagnostics — P2 correction gate

## Intake and decision
Guy approved proceeding with the two bounded technical corrections after Claude's
supplied PASS P0=0/P1=0/P2=3 for ca29d599..419a43b8. Correct findings P2-1/P2-2
together through explicit toolchain/load/execution diagnostics; P2-3 through an
inline accepted-status conjunct. No editorial edits or renders authorized here.

## Observed, cause and expected behavior
The v4 branch wraps tsx loading, TS module loading and actual validation in one
catch that reports predecessor_invalid for all errors. tsx is devDependency;
an omit-dev installation cannot execute this authoring route. Current callers
are the CJS creative lifecycle and CJS visual-direction enrichment, not app/backend
runtime. Keep the dev-tool installation contract; do not silently move dependencies
or install anything. Document that operator prerequisite at the code boundary.

Expected: missing/incompatible tsx => toolchain_unavailable; TS module load failure
=> validator_load_failed; known shared accepted_story_source_* validation errors
=> predecessor_invalid; unexpected validator exceptions => validator_failed.
Preserve original errors as causes for library callers; CLI continues to emit only
the stable outer code, not stack/path/message details. Direct identity mismatch
remains predecessor_invalid. Existing shared-validator I/O normalization is not
redesigned: a failure already classified there remains a validation rejection.
Add inline status guard before the bridge, retaining the shared status check.

## Scope, risk and plan
Same task sole writer, C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1; start419a43b891ac70d499799c0bb50c8d3fb49d64b9,
clean/ahead12. Dependencies d53b768ccb2f and accepted-intent-wave-263ccb484 clean,
read-only. No delegated reviewer currently active for this new range.
Change one production CJS module, existing lifecycle spec, CURRENT/ROADMAP and
this gate. No new schema, API argument, dependency, timeout or validator semantics.
Risk: classification masking or data errors escaping; test real shared validation
and isolated child-process injections at the actual CJS require boundary. Keep
the synchronous interface, legacy behavior, no-write-on-failure and reload path.

## Validation and exclusions
Add tests first and record pre-fix failures. Cover missing/incompatible bridge,
TS load failure, unexpected bug/I/O failure, known validation error, early status
rejection, legacy behavior, actual publication/reload and artifact preservation.
Run focused/adjacent tests, tsc and full npm run check; report actual outcomes,
never relabel timeout failures as inherited. One focused local commit, no push.
Rollback is reverting only the corrective code, with no artifact deletion.

Stop-check: general diagnostic/status hardening only; no changes to other story
content, runtime selection, reader/layout, anchors, prompts, provider, payment,
render or accepted source. Zero spend and no image to eyeball. Guy's decision is
explicit; no new creative judgment required. Claude should falsify classification,
fail-closed ordering, causes/CLI redaction, cwd independence and legacy/reload paths.
No automatic closure of independent QA, stability, cake/cart or launch gates.

## Implementation and verification
One CJS production change; no shared TS validator or package edits. Status checked
inline. tsx API load/export shape, TS validator load/export shape and invocation
are separate guarded boundaries. Known errors require Error/name Error plus the
anchored accepted_story_source_* namespace (optional filename suffix); unexpected
errors remain bounded validator_failed. Causes retained; CLI outer code only.
The contract is developer-tool installation including dev dependencies, not new
production support for omit-dev. No installation performed.

Before fix:7fail/16pass. After:77/77 across7 focused specs;27 lifecycle tests,
14 added. Tests inject faults in isolated child require calls and actual CLI;
do not claim a real omit-dev installation test. Tests cover both publish/reload,
no publication on failure, preserved output bytes, legacy v2/creative-v1 controls,
early status rejection, private cause retention and no CLI message leakage.
Real CLI from neutral Temp cwd previews exact f77f4ca5/created:false. Real accepted
loader/preservation helper passes:28 older source/book files unchanged,13 image
hashes intact and old qualified package4d6e8dee selected. New source files untouched.

Full npm run check exit1: ordinary5338pass/73skip, resource670pass/1fail;
total6008pass/1fail/73skip. Both typechecks pass; zero timeouts in this run.
Failure: lib/__tests__/story-source-visual-direction-correction-acceptance-lifecycle.spec.ts:703,
isolates injected accepted-source facts from canonical package qualification.
Expected narration input/critical readiness17, actual18; soft review items8 vs10,
stories4 vs5. Reproduced the identical assertion with exact isolated -t filter:
1fail/10skip. Initial -t summary matched nothing (11skip), not a pass. Its test,
correction publisher and readiness module were not changed. No proven root cause,
inherited classification, assertion change or automatic stability closure.
This bounded P2 correction is ready for independent re-gate, not full-repo PASS.
Explicit precommit npx tsc --noEmit exit0; correction-range diff --check0.
