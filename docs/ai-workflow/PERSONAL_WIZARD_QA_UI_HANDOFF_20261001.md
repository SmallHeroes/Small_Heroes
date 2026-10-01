# Recording wizard QA UI review

## Requirement and frozen review target

Guy asked Codex to put Claude's updated recording screen on QA, including the
subsequent decoding screen. Codex owns this implementation; Claude Code's first
review must be read-only. Worktree:
`C:/Users/guyna/.codex/worktrees/personal-site-qa/Small_Heroes`, branch
`codex/personal-site-qa-integration-20260930`, base
`86f1bb585b1cbda87e06a4373d84b6484cd50d25`. Frozen code head is
`50eb17e5fdce5c2ae35d2a1d6aca4a4deae23bab`: one commit, 20 files,
994 insertions / 439 deletions. Review exactly `86f1bb58..50eb17e5`;
the later documentation-only closeout does not change that code target.

UI source is `719dcb7f..2194e9a8` in Claude's clean isolated wizard checkout.
Destination is only QA's `codex/r1d-release-reader-voice-final`, initially
`41359878`; one docs-only predecessor separates it from this integration base.
The engine branch at `2ec333a3`, Claude landing branch and both protected
worktrees are excluded. No whole engine or landing history is being merged.

## Implementation claims and exceptions

The microphone stage, static cue arc, quieter card/companion/length UI and copy
come from Claude. Static prompts do not claim live extracted facts. Existing
DecodingView is unchanged: its animation describes processing, not measured
progress. Cancellation and request orchestration retain the older QA parent.

The source cherry-pick conflicted in StepTell. The optional `signInRequired`
prop is retained for type compatibility but is not supplied by QA's older parent;
paid-off QA shows its local-only disclosure, not a claim that login enables it.
No newer availability polling or StoryPreview/engine dependencies were copied.

The general draft-loss notice also covers unsent text and retained local clips.
Recording/processing stay visually quiet. Ten new cases test notice visibility.
Two old copy assertions were adjusted to the new lead and exact narration note;
90-second hard stop, privacy and landing assertions remain. Reduced-motion
coverage from the UI source remains.

APIs, schema, middleware, homepage/start, draft/request contracts, ledger,
recorder/hooks, writer/config, DecodingView, StoryPreview and dependency manifests
are unchanged. Six companions and the existing length/voice decisions remain.

## Validation and preserved failures

Final focused command, run from the named checkout:

```powershell
npx vitest run lib/personal-wizard lib/__tests__/personal-site-qa-home.spec.ts lib/__tests__/hero-child-handoff.spec.ts lib/__tests__/voice-stage-lifecycle.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts
npx tsc --noEmit --incremental false
```

Results: **347/347 in 17 files**, standalone tsc exit 0. No independent PASS.
Final full check is RED: ordinary 5066 passed / 10 failed / 73 skipped in 370
files; resource 635/635 in 20 files, three onTaskUpdate RPC errors and native
exit 1. The ten ordinary names match the recorded QA baseline; this milestone
did not rerun the full base. The materializer EEXIST did not recur in this final
run; causality remains unproved. Final log is `final-full-check.log`.

Config-only `ENABLE_V3_APPROVED_BANK=true npm run release-check` exits 0:
18/18 product-sellable, 1/18 render-qualified, database check skipped because
DATABASE_URL is absent here. This certifies neither DB schema nor render readiness.
`npm run build` failed at shared Prisma Windows DLL rename with EPERM. The shared
generated schema has only whitespace/comment formatting differences from this
branch; no data/API change. The existing local pilot was not stopped. A separate
`npx next build` exits 0, not an equivalent full-build assertion. A temporary
production-mode loopback preview failed its service environment validation;
it was stopped. No fake credentials or relaxed environment guard were added.

Fresh browser QA could not be completed: Chrome control timed out and the IAB
QA page reached Vercel login, not the app. The temporary local target was blocked
by the browser. These are not passing browser checks; keep the layout/interaction
review open. Do not disable deployment protection to replace this evidence.

Initial full run retained in `outputs/personal-wizard-qa-ui-20261001/full-check.log`:
ordinary 5064 passed, 12 failed, 73 skipped. Ten match recorded fixture failures;
one copy assertion was since fixed, and an unchanged materializer hit EEXIST.
That spec passed 31/31 in isolation. This does not establish the EEXIST cause or
baseline reproduction. Resource tests 635/635 with three onTaskUpdate RPC errors,
native exit 1. A second full run uses the final unchanged code/test surface;
do not combine results or erase the initial failure.

These ignored logs are local and have no verified backup. Imported Claude report
numbers describe his source milestone, not this integration's measurement.

## Deployment and runtime boundary

The requested non-forced QA branch fast-forward/push was completed after
remote and clean-worktree reconciliation: remote `41359878` advanced to
`50eb17e5`, two commits including the earlier docs-only `86f1bb58`.
Git ls-remote confirms the exact new tip. Existing UI preview switches stay ON and
intake/writer OFF. Book runner is not on this QA branch. No production alias,
environment, deployment protection, database, provider key or pilot claim change.
Provider spend is $0. Prior QA READY deployment for rollback:
`dpl_CAfr6uM8Uog7eVkKEDKa2eqpuXd3`. Production baseline:
`dpl_2X7E6d1acZ5vKJVhLSuKFGP5Q4HN`.

Vercel's exact Git-commit metadata filter found preview deployment
`dpl_8nhVmZT5hasBEmCzWL5iTbrGJrqc`,
`https://small-heroes-r2jnyo6b3-smallheroes-projects.vercel.app`.
Its build log reports Build Completed and inspection now confirms READY.
Independent inspection of `https://qa.smallheroes.co.il` returns that same
deployment ID, rather than inferring alias promotion from push. Production's
inspection still returns the recorded baseline ID. No manual alias override,
environment change or protection change occurred.

Authenticated CLI measurements after READY: QA root and wizard HTTP 200.
Wizard HTML contains the new voiceStage/cueArc, one-minute lead, explicit local
non-decoding note, labelled test panel and noindex. Root retains a wizard link
and noindex. These are HTTP/source facts, not browser layout/animation evidence.
Intake status HTTP 200 returns `{live:false,reason:"live_flag_off"}`; writer GET
HTTP 404 returns `{error:"not_found"}`; absent book GET HTTP 404. A probe during
BUILDING returned 403; it was superseded by these explicitly later measurements.
Saved HTML/body files join the ignored local evidence root without verified backup.

The implementation-owner agent found no blocker in this frozen port and verified
the exclusion paths and quiet processing branch. It did not inspect runtime or
run tests and is not independent Claude PASS. Browser acceptance remains open.

Browser evidence must distinguish real QA from local preview, protected login
from loaded app, and labelled fixture animation from live decoding. The local
3443 story-only pilot is unchanged and remains the separate live reading path.

## Independent falsification targets

1. Attack the older-QA UI merge: imports resolve, no newer engine dependency,
   homepage/middleware unchanged, no silent schema/draft-model change.
2. Test start/write/retained-clip disclosure and disabled-service wording. Sign-in
   must not be advertised as enabling paid-off QA; examples must stay labelled.
3. Exercise example processing, Cancel and later card; footer/progress/notice
   hidden while decoding. Verify editing/removal and companion/length/summary.
4. Check 360/390 desktop/mobile layout, keyboard labels, reduced motion, and that
   existing playback/timers/media cleanup/cancellation are not weakened.
5. Verify real QA alias and paid surfaces OFF, exact-host isolation and unchanged
   production identity. No provider dispatch is necessary or requested.
6. Reproduce checks and preserve red outcomes. No stability, literary, visual,
   launch or product acceptance follows from a UI build or green focused suite.

Do not render, read credentials, call providers, edit branches or push during
the first review. Return exact range, findings and evidence limits.

## PowerShell inspection and push handoff

The requested code is already pushed. Do not stage anything or merge the engine.
The optional final push below is a no-op only while the release checkout still
equals the recorded deployed code; its guard refuses a moved tip.

```powershell
$qaRelease = 'C:/GNart/Work/sh-release-reader-final'
git -C $qaRelease status --short --branch
git -C $qaRelease log --oneline 41359878..50eb17e5
git -C $qaRelease ls-remote origin refs/heads/codex/r1d-release-reader-voice-final
vercel inspect https://qa.smallheroes.co.il --format=json
if ((git -C $qaRelease rev-parse HEAD) -ne '50eb17e5fdce5c2ae35d2a1d6aca4a4deae23bab') { throw 'QA release tip moved; reconcile first' }
git -C $qaRelease push origin codex/r1d-release-reader-voice-final
```
