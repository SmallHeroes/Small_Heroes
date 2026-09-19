# Claude Code: mandatory whole-book local planning

First pass read-only. No credentials, provider calls, renders, publication or push.
Owner requirement: all18 authored stories need coherent full-story planning before
images, with persistent situations but free camera/composition/expression variation.

## Boundary

Branch codex/r3b1b-semantic-recovery-m1, worktree C:/GNart/Work/sh-r3b1b-semantic-m1.
Base093d37c029e3bfb59049430704a9dc3af0539235. Head is the single local commit containing
this handoff; resolve/freeze it before review, do not widen to a moving HEAD. Base was
clean/ahead9. Current task is sole writer; protected d53b768ccb2f and accepted-intent
63ccb484 remain read-only. Prior sequence-recovery commit093d37c0 has no independent
PASS yet; this handoff does not invent one. Production authority remains unchanged.

## Change and real consumers

- lib/local-book-planning.ts: mandatory joint schema and compact full-book planning
  instruction; initial states + explicit per-page deltas expand to the existing
  validated ledger. Code derives source/plan hashes. No model-provided approval/hash.
- scripts/run-local-story-preview.ts: existing ONE text call now requests both parts.
  Every page validates before prop-board/cover/page generation. Persist complete
  plan/ledger first. New planning identity rejects historical plan-only resumes.
  Current-page context and prior same-scene pixels flow to actual generation and QA;
  repair keeps its own target within existing cap. Cover is not a chronological page.
- lib/local-story-preview.ts: shared selectedDraftQaContext moved unchanged from
  owner script; owner re-exports it. Existing owner identities/context shape preserved.
- lib/__tests__/local-book-planning.spec.ts:30 tests, including actual runner with
  provider/acceptance/calibration test fixtures. No real source acceptance is inferred
  from those stubs. Existing source/calibration validators remain in production code.
- verify.cjs: read-only18-story input coverage, not semantic output acceptance.
- CURRENT/ROADMAP/DESIGN and Decision Gate record scope and remaining migration.

## Attack targets

1. Return a correct opening but missing/invalid final page. The FIRST image (including
   prop board or cover) must remain unreachable. Repeat the run: failed planner result
   is preserved and not repurchased. Try incomplete status and legacy plan-only output.
2. Duplicate initial IDs, unknown transitions, wrong before-state, reset/unsupported
   quote, invented hashes, gaps and hidden-state drift. Initial full state must persist;
   changes must be declared, not silently inferred from camera or absent mentions.
3. Prove source+entire ending reach the actual request and all states persist before
   any image callback. Compare the same packet in generation and QA. Future beat must
   not become an earlier page requirement. (Full prop-board pixels remain a limit.)
4. Verify no camera/shot/expression/gaze/composition field changes during compilation.
   Retain existing variety/wide quota/frame occupancy failures. Exercise8/12/16 pages.
5. Prior image rules: no cover/cross-scene generation ref, changed hash rejects, repair
   uses own candidate instead of appending a fifth reference. Old identity rejects;
   changed saved ledger rejects; upfront budget still blocks before provider dispatch.
6. Ensure no accidental production cutover or new source/acceptance/QA authority.
   Source quotes and schema validity are NOT semantic entailment or pixel accuracy.

## Validation

207/207 focused:30 planning +29 sequence +72 owner +28 quality +16 judge +32 preview.
tsc0. Offline corpus witness0:18 hash-bound intake sources/216 pages, two genders432
personalized page checks. Inventory has six8-page, six12-page and six16-page stories.
This does not call the accepted-revision loader for all18 or generate18 plans.

Preservation witness0:56 historical snapshot files unchanged by SHA/size/mtime,
including9 accepted Panda source files and6 canonical paid artifacts; three current
reader hashes and both page-image hashes unchanged. No original verdict edited.
Final npm run check: native exit0, both typechecks0. Ordinary391 files:5801 passed,
73 skipped, exit0, diagnostic elapsed155572ms. Resource22 files:671 passed, exit0,
diagnostic elapsed245312ms. Total6472 passed/73 skipped/0 failed across413 inventoried
files (396 passed/17 skipped). No concurrent focused suite. This is one observed green
run, not an independent PASS, enduring stability proof or release qualification.

Logs in outputs/whole-book-planning-validation-20260919 (raw byte SHA-256):
- check.stdout.log:196897 bytes,
  eba749da4cd0319d989cd487cfc591544b83c059df5616102e3c99db3355991b.
- check.stderr.log:195975 bytes,
  d20dcaddb6ef4908c57a7586ade1f589860aa4b9b43f6c66d1e8d6dd9b0bd1d7.
stderr contains expected negative-test output and phase diagnostics; nonempty is not
treated as a failure or hidden. The native exit and both phase results are captured.

Development failures were test-fixture errors, not waived gates: first I assumed
every corpus story had12 pages; then an8/16-page synthetic shot cycle underfilled the
existing wide quota. Fixed fixtures/expectations, not the production quota or thresholds.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline 093d37c029e3bfb59049430704a9dc3af0539235..HEAD
git diff --check 093d37c029e3bfb59049430704a9dc3af0539235..HEAD
npx.cmd vitest run lib/__tests__/local-book-planning.spec.ts lib/__tests__/local-book-sequence.spec.ts lib/owner-book-draft.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-story-preview.spec.ts --silent
npx.cmd tsc --noEmit
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/whole-book-planning/verify.cjs
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/verify.cjs
```

## Limits / storage / money

Read DESIGN.md. Automatic LOCAL runner only; production image/chunk-runner/compiler/
Blueprint/package authority not migrated. Owner-draft's sequence remains optional.
The desired production plan cache per approved story revision is a target, not shipped.
Full prop reference board remains; no pixel-level segmentation. False PASS, initial
semantic mistakes, pose/contact/capacity and free-text/typed-state contradictions can
still occur. No new model, output limit, budget reserve or repeated repair call added.
Cannot infer completed books, calibrated QA or release readiness from this change.

New output root: outputs/whole-book-planning-validation-20260919, check.stdout.log and
check.stderr.log, ignored/local only, no verified off-machine backup. The corpus witness
writes nothing. Test-only temporary roots were cleaned. Historic roots stay disclosed
in sequence-recovery and five-page-sample handoffs, unchanged. Cost$0; provider calls0;
no actual credential reads. Old unknown$1 reservation retained. No independent PASS.

## Owner handoff

Committed locally, no staging/commit reconstruction needed. Push is NOT authorized by
this document. It carries all ahead commits, not just this range; freeze/review topology.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline '@{upstream}..HEAD'
git diff --stat 093d37c029e3bfb59049430704a9dc3af0539235..HEAD
# Only after explicit owner instruction to push:
git push origin HEAD:refs/heads/codex/r3b1b-semantic-recovery-m1
```
