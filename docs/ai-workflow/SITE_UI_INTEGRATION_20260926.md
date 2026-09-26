# Site UI integration: local checkpoint

## Decision Gate before merge

Guy requested the approved Claude website plus the two-endpoint hero caption
change on QA. He then limited today's scope to local integration so he can shut
down the computer. No deployment, long validation run or background work today.

1. Change: merge website 992493f5 (70d4f245 plus caption correction) into an
   isolated branch from served release f223a54a.
2. Why: the website preview carries an older backend; replacing QA with that
   deployment would regress the release runtime.
3. Scope: general website integration; no engine branch or new story authority.
4. No story/child-specific runtime rule. Preserve generation, payments, API,
   authority data and release configuration exactly.
5. Likely conflicts: landing page/styles, spotlight, legal pages/shell,
   next.config.js and font license. Keep release legal text and configuration;
   retain website visuals and merge only required release caller behavior.
6. Expected: approved site visuals and two hero captions with current backend.
   Name handoff, browser verification and privacy review remain follow-up work.
7. Validation today: conflict and backend preservation checks; tsc before any
   commit. Full/focused suites, build, release-check and browser proof tomorrow.
8. Cost: no model, image, audio, order, checkout or storage calls.
9. Rollback: isolated branch only; shared release and Claude branches untouched.
   No alias or QA-bound-branch push until validation and independent review.
10. Codex sole writer in C:/GNart/Work/sh-site-release-ui-integration on
    codex/site-release-ui-integration-20260926. Claude reviews frozen successor;
    Guy retains product/launch authority. This is not a self-awarded PASS.
11. Do not: deploy, change legal promises, source/package selection, payment or
    quality thresholds, delete another worktree, import the engine branch.

Stop-check: layout/customer entry flow changes are owner requested. Today's
local-only scope is reversible, provider-free and not product/release accepted.
Protected d53b/768ccb2f and accepted-intent-wave-2/63ccb484 remain read-only.

## Local resolution checkpoint

The merge exposed eleven conflicts, not ten, because the caption successor also
changed CURRENT. Retain the release history there and add a new checkpoint.
Release Spotlight differs only by tested helper seams/fallback; preserve them.
The legal conflicts are contact-address substitutions only; preserve release
legal pages until the explicit contact reconciliation. Other website content
keeps its newer address for now; this is not deployment-ready consistency.
Landing conflicts concern the requested name/audio/Style02 withdrawal and
captions; retain the approved website version. CSS adds the corresponding rules.
Keep release next.config (broader tracing exclusions) and whitespace-clean OFL.

No unresolved Git conflicts remain. The staged diff against f223a54a has no
app/api, backend, lib/generation-pipeline, lib/visual-package, visual-packages,
story-pipeline, story-bank or next.config changes. Automated and runtime tests
other than the pre-commit typecheck are deferred at Guy's explicit request.
No claim that auto-merged Wizard/ready behavior has been fully verified yet.

`npx tsc --noEmit` initially found duplicated Spotlight state/callback inserted
by the auto-merge. After removing only the duplicate block, tsc exits 0.
`git diff --check` is clean. Shared release branch remains f223a54a and clean.

Resume locally:

```powershell
Set-Location 'C:\GNart\Work\sh-site-release-ui-integration'
git status --short --branch
git show --stat --oneline HEAD
git diff --stat f223a54a HEAD
```

No push command is scheduled or executed in this paused local-only checkpoint.
