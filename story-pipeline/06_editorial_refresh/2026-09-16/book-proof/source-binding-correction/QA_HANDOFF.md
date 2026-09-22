# Parser-bound sequence evidence — 2026-09-22

## Request, topology and prior verdict

Guy's standing direction: Codex implements general story-engine fixes, Claude
reviews afterward. Continue this task in C:/GNart/Work/sh-r3b1b-semantic-m1 on
codex/r3b1b-semantic-recovery-m1. Start was clean, ahead13/behind0 at
9d0bbe1da469bf58d300b807510b59c698eb9398. Sole writer: this Codex task.
Protected d53b/accepted-intent-wave-2 remain read-only at768ccb2f/63ccb484.
No new task, push, credentials, provider calls, render or charge. Cost$0.

Claude supplied PASS0/0/2 for4ee9afc1..093d37c0,093d37c0..5e990881 and
a2d30f89..9d0bbe1d. This closes the former outstanding sequence/planning review,
NOT product/semantic acceptance. It excludes Claude-authoredf6bdf5f7..a2d30f89;
Codex's counter-check is evidence on that fix, not independent Claude approval.
No PASS for the current correction is claimed; return it for adversarial re-gate.

## P2 source binding: reproduced and corrected

The old validator accepted changed `texts` alongside the old source digest. Its
existing callers verified source bytes correctly, so this was a helper API gap,
not evidence that a paid run used mismatched prose. The new read-only witness loads
9d0bbe1d's actual validator directly from Git into memory and reproduces the bypass
against the real saved Panda source, plan and sequence. No baseline file is written.

`previewStory` now registers its output in a private WeakMap. The record contains
the unchanged serialized parsed story, original source digest and personalized
texts. `previewStoryEvidence` requires that exact unmodified object and returns
copies of the private digest/text evidence. A type-only brand prevents ordinary
structural construction; it adds NO symbol or field to serialized artifacts.
Runtime provenance does not rely on that type assertion. Modified and reconstructed
objects are rejected, even when they retain the old sourceSha.

`validateBookSequence` takes `{story, plan, planSha}`, derives source/text evidence
itself, and rejects detached legacy `texts`/`sourceSha` properties. Both runtime
callers and the offline preparation caller migrated. Automatic planning validates
provenance before emitting model input; compilation checks it again. Existing
raw-byte source/plan checks in the owner loader remain in place.

No paid artifact, story prose, JSON schema, output version, prompt or QA threshold
changed. Valid parser output still serializes to title/pages/sourceSha. A saved
story object is NOT provenance: resume must reparse the original source, which both
real callers already do. There is no process-to-process provenance transfer, and
multiple independently loaded copies of the parser do not share the registry.

This proves parse/source integrity, NOT accepted-source/editorial authority or
semantic entailment. Exact quote presence is still not proof that a transition is
logically justified. Plan raw-byte identity is still checked by the callers; this
milestone does not claim a new intrinsic plan/text/source authority system or a
defense against arbitrary hostile code executing inside the same Node process.

## Verification

Fourteen new regressions: preview32->42, sequence29->32, planning50->51. Owner72,
quality28 and judge16 unchanged; total241. Boy/girl personalization, copy isolation,
changed text/title/hash/order/coverage, extra data, clone/JSON reconstruction and
detached API rejection covered. The former test that edited parsed prose now reparses
a deliberately changed source. Its supported-transition assertions are unchanged.
The `@ts-expect-error` makes the old detached API a compile-time regression as well.

First focused run:240 passed/1 failed. The real owner conflict CLI test at:117 failed
with `Test timed out in 5000ms`, measured6493ms, NOT its inner15000ms spawn timeout.
This run was observed in tool output only; no raw log is reconstructed for it.
Second focused run:241/241, native0, captured stdout/stderr. The same case1498ms;
other conflict cases1333/1387ms. This is a rerun observation, NOT stable-green proof.
Standalone `npx tsc --noEmit` passed before the first focused run.

The source witness exits0: original bypass reproduced, legacy and mutated/cloned
stories rejected, genuine saved sequence unchanged, defensive copy preserved.
Source/plan/sequence SHA, size and mtime preserved. It also loads the actual baseline
parser from Git in memory and compares its serialized output with the new parser.
It writes nothing and forbids fetch; no fabricated visual result is persisted.

Final source, sequence-preservation, corpus and repair witnesses all exit0 after
the full check:56 historical files SHA/size/mtime unchanged,3 reader file hashes and
2 image hashes unchanged, paid output root absent. Corpus18/216/432 remains input
coverage only. Repair witness still82 effective attributes,13/13 full locks for
short corrections, schema-maximum6 full/6 anatomy/1 none. No repair/pixel acceptance.
Standalone tsc rerun0 after these witnesses. Both protected dependency worktrees
remain clean at their original hashes; no other writer or HEAD movement observed.

### Fresh full check: RED, native1

Captured Node/npm process ExitCode after WaitForExit; stdout/stderr stored separately
via hidden Start-Process. No overlapping test suites or startup probes. Both
typechecks passed before the test supervisor ran. All241 focused cases pass inside
this full run as well, but the repository gate fails:

| Phase | Files | Passed | Failed | Skipped | Supervisor elapsed ms | Exit |
|---|---:|---:|---:|---:|---:|---:|
| ordinary |391|5826|9|73|290580|1|
| resource_intensive |22|664|7|0|388813|1|
| total |413|6490|16|73|679393|1|

Total elapsed is the sum of phase durations, NOT total command wall time.
All16 failures are test timeouts (fifteen5s, one15s); no assertion failure reported.
They are broader than the prior three-resource-failure run. These spec files are
unchanged by this milestone, but no untouched-base counterfactual was run and no
claim that all failures are inherited or share one root cause follows.

Ordinary failures under lib/visual-package/__tests__/:

- render-qualification-audit-cli.spec.ts:48 (one).
- story-source-revision-blueprint-migration.spec.ts:439 (one).
- wizard-all-story-readiness-cli.spec.ts:46,84 (three, including both V3 variants).
- wizard-all-story-render-readiness.spec.ts:66,415,426,461 (four).

Resource failures under the same directory:

- canonical-materialization-input.spec.ts:278,340 (two).
- canonical-pre-live-readiness.spec.ts:499 (one).
- live-execution-supervisor.spec.ts:1565,1763 (two).
- live-request-verification.spec.ts:1602 (one).
- qa-wizard-candidate-bridge.spec.ts:1575 (one,15000ms).

No additional retry was used to reclassify these16 failures. Startup-only probes
below are not evidence about all these paths, including the in-process ones.

Raw logs: outputs/sequence-source-binding-validation-20260922/ (ignored/local;
no verified off-machine backup). SHA256 of bytes, not a canonical JSON digest:

- focused.stdout.log:67488 bytes,
  4bcca7b47e4516ef86ce605b95c34e0860bfdc0a7650464f4714e059e511de98.
- focused.stderr.log:0 bytes,
  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
- check.stdout.log:261729 bytes,
  9ec22f443419d8ad2783f175c2c0723ef31e6f5a6ce592ccc222cbba9422fbc8.
- check.stderr.log:207886 bytes,
  8b45e3c788cf22bcdbd0e7b36e46ceb65682a6a417c0a7427305da0bb36ceceb.

## P2 test instability: open, measured without weakening the gate

Claude first observed226/227 then227/227 twice; the error text of his first failure
was not retained, so our fresh timeout is not a reconstruction of his error.
His selected resource rerun failed3/3, versus our earlier2/3 failure and4956ms pass.
Both observations stand. The old44ms margin is not evidence of reliability.

`diagnose-cli-startup.cjs` runs fifteen serial startup controls with a minimal
credential-free environment and TSX_DISABLE_CACHE=1. No tests/fixtures overlap it.
All expected exits match. Measured milliseconds, tool-output transcription:

| Control | Attempt1 | Attempt2 | Attempt3 |
|---|---:|---:|---:|
| node only |111|94|156|
| tsx registration only |173|162|163|
| owner conflicting modes |1573|1608|1521|
| writer invalid mode |1749|1780|1831|
| lifecycle help |3852|2323|2429|

Owner stderr matched exactly `draft_conflicting_modes` on all three runs. The
resource tests each execute multiple subprocesses; the writer launcher itself
spawns a TSX child. Existing imported module graphs load before command execution.
These controls show startup cost, NOT the duration of the fixture tests, a cold/warm
causal experiment, the cost of this source patch, or machine-level root cause.
No timeout, cache policy, concurrency, quarantine or assertion changed. Any runtime
startup optimization needs a separate measured scope; test stability remains OPEN.

Claude also confirms that his prior full check really ran and he saw exit0/two green
phases, but retained only the tail. His old CURRENT denial was stale. Preserve that
reported observation without turning it into independently captured full evidence.

## Reviewer instructions and falsification targets

READ-ONLY first pass. No edits, paid calls, key access, source promotion or push.
Freeze the single correction commit whose parent is9d0bbe1d. Do not review a moving
branch or expand the prior verdicts. Key attacks:

1. Reproduce old detached-text acceptance against the actual Git baseline, then
   attempt it through the new API (including plain JS bypassing the type checker).
2. Mutate a genuine parsed object, retain the old hash, clone/deserialize it, or
   alter a returned evidence copy. Verify source binding does not become vacuous.
3. Parse valid personalized stories afresh; verify the real owner and automatic
   planning paths accept them without new artifact fields or byte migration.
4. Check all call sites, replay/reparse behavior, unchanged saved artifacts, full
   source/page coverage, compiler output and source/plan approval boundaries.
5. Treat the timing failures honestly: do not count a retry as stability closure,
   or these startup controls as proof of root cause. No claim pixel quality improved.

## Copy-ready PowerShell

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$reviewBase = '9d0bbe1da469bf58d300b807510b59c698eb9398'
# First descendant is the immutable correction; STOP if topology does not match.
$reviewHead = git rev-list --reverse "$reviewBase..codex/r3b1b-semantic-recovery-m1" | Select-Object -First 1
if (-not $reviewHead -or (git rev-parse "$reviewHead^1") -ne $reviewBase) { throw 'review_range_mismatch' }
if ((git rev-parse HEAD) -ne $reviewHead) { throw 'checkout_not_frozen_review_head' }
git status --short --branch
git show --stat $reviewHead
git diff --check "$reviewBase..$reviewHead"
npx.cmd tsc --noEmit
npx.cmd vitest run lib/__tests__/local-book-planning.spec.ts lib/__tests__/local-book-sequence.spec.ts lib/owner-book-draft.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-story-preview.spec.ts --silent
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/source-binding-correction/verify.cjs
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/source-binding-correction/diagnose-cli-startup.cjs
# Separate propagation only if Guy explicitly asks; this carries ALL ahead commits:
# git push origin codex/r3b1b-semantic-recovery-m1
```

No staging/commit commands are required after Codex's focused local commit.
Logs and saved inputs under outputs/ are ignored/local, with no verified off-machine
backup; pushing code does not preserve them. Original held images stay held. No
production qualification, five-page completion, narration, release or product PASS.
