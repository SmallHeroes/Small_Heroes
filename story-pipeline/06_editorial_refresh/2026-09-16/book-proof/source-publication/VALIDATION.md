# Publication validation record

## Later independent review and fresh replay observation

Claude's supplied review of87282474..949a360d reports67/67 changed-spec tests,
tsc0 and full6364pass/73skip, exit0:ordinary5693,resource671. This is the reviewer's
observation, not a new Codex full run or permanent stability closure. Contrary to
the report's interim resource attribution, the four earlier Codex failures below
were ordinary-phase; resource passed. The matrix assertion was already corrected
when the reviewer ran, so those full runs are not identical test snapshots.

Fresh source and enrichment --write true replays both exited0 with created:false.
Separate replay receipts exactly equal creating receipts except that field.
replay-preservation.json records observation times and before/after12-file
SHA256,size,mtime equality. No lock remained. This is fresh evidence, not recovery
of prior console output. The source publisher acquires/removes its ordinary lock.
Existing creating receipts and all accepted/pending artifact bytes are untouched.
Both replay JSONs and preservation evidence are committed, not only local logs.

## Offline evidence

- Five copied publication/preparation inputs compared byte-for-byte before use.
- Actual source CLI dry run created no revisions directory; write created7 files.
- Shared accepted-source reload and publication replay succeeded, created:false.
- Actual visual enrichment dry/write/reload/replay succeeded; replay created:false.
- Read-only verify.cjs recomputes7 source files,5 candidate files,18 original source
  inspection records, exact prose preservation,12 directions and the runtime hold.
- prepare-intake.cjs --check returns18 stories/216 pages, providerCalls0/writes0.
- Focused creative-replacement49 +enrichment8 +story-candidate-review16 =73/73.
- Initial readiness pair after explicit inventory correction:23/23, exit0.

## Failures are not relabeled as inherited

The new accepted text intentionally suppresses stale V3 fallback. Before test
updates the readiness pair gave21passed/2failed on old inventory expectations.
The first full check finished exit1: both typechecks passed; ordinary388 files
failed (161505ms); resource22 files passed671/671 (226127ms). Its console output
was truncated by the tool; no complete retained raw log is claimed. Observed
failures include old sellability assumptions in audit CLI and Wizard matrix API.
Package lifecycle had the same verified premise. Four test files now express
the explicit held slot; production behavior is unchanged.

A later four-spec focused run gave54passed/4failed (58 cases), three files passed.
All four failures were5000ms timeouts in the readiness spec: current-surface
allow-list rejection, historical lineage replay, digest determinism and disabled
bank alignment. No assertion mismatch was reported in those four failures.
This does not establish that the timeouts are inherited or resolve stability.
The first earlier focused session lost its tool handle; no outcome is claimed
for it. No matching Vitest process remained before the recorded rerun started.

Captured full check: native exit1, both typechecks passed. Ordinary5689pass/4fail/
73skip across388 files (190923ms); resource671/671 across22 (219946ms).
Total6360pass/4fail/73skip across410 specs. full-check-summary.json is the exact
supervisor JSON, not a full console log. Failures:

1. mvp-story-matrix.spec.ts:148 expected every slot sellable. Same data premise;
   corrected AFTER this run, with exact held-key assertion and no production edits.
2. semantic-correction-approval-bridge.spec.ts:132,5000ms timeout.
3. wizard-all-story-render-readiness.spec.ts:64,5000ms timeout.
4. wizard-all-story-render-readiness.spec.ts:405,5000ms timeout.

No full rerun after the last matrix-spec correction is claimed. Focused serial
validation uses --maxWorkers1 only as an invocation-level diagnostic; it does NOT
change checked-in runner configuration or establish full-load stability.
Fresh npx tsc --noEmit after the fifth spec correction:exit0.

Final serial focused run:6 files,74/74, exit0 (36.27s). Breakdown:readiness16,
readiness CLI7, audit CLI3, package lifecycle34, matrix API5, matrix helpers9.
Thus both full-run readiness timeouts and the other focused timeout cases pass
with a single worker and unchanged5000ms limit. A separately isolated targeted
bridge run passed1/1 (130 intentionally filtered out), test2040ms, total4.10s.
This supports load sensitivity, not a proven root cause or an inherited label.
No third full run was launched merely to seek a green result.

Raw focused-inventory.log and full-check-final.log live only under ignored
outputs/panda-approved-source-20260917/. They are not preserved by a push.
Full raw log SHA256:d9bce2bcdc2d2e6692608e7ea26db723b8e19884b80d5d90908232467d69508f.
Focused raw log SHA256:a25fb81012014668f8506643f80ae72e540b439d946bbd4c27e48ea7d2da39d1.
Serial log focused-final-serial.log SHA256:379b4219a41320f5e83aaecae118452b52bee8ce845874a25cef9fa9a3ae0dc1.
The targeted bridge log is isolated-bridge-timeout.log in that same local root.
No timeout/exclusion or runner-policy adjustment was made in this milestone.

## Reproduction

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
npx vitest run lib/__tests__/story-source-creative-replacement-lifecycle.spec.ts lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts lib/__tests__/story-candidate-review.spec.ts
npx vitest run lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts lib/visual-package/__tests__/wizard-all-story-readiness-cli.spec.ts
npx vitest run lib/visual-package/__tests__/render-qualification-audit-cli.spec.ts lib/__tests__/wizard-mvp-matrix-api.spec.ts lib/visual-package/__tests__/visual-package-lifecycle.spec.ts lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts
npx vitest run lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts lib/visual-package/__tests__/wizard-all-story-readiness-cli.spec.ts lib/visual-package/__tests__/render-qualification-audit-cli.spec.ts lib/__tests__/wizard-mvp-matrix-api.spec.ts lib/visual-package/__tests__/visual-package-lifecycle.spec.ts lib/__tests__/mvp-story-matrix.spec.ts --maxWorkers 1
npx vitest run lib/visual-package/__tests__/semantic-correction-approval-bridge.spec.ts -t 'advances the unchanged approved context through the strict current production loader' --maxWorkers 1
npm run check
```

No full-book, image, audio, visual-quality or release inference follows from any
of these runs. This milestone used no credentials/provider calls and cost$0.
