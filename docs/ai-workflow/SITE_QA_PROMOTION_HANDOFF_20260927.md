# Stable QA design promotion — read-only handoff

## Requirement and result

Guy explicitly requested Claude's latest design on qa.smallheroes.co.il, correctly
integrated. Completed on the existing release runtime and QA environment, not on
Claude's older backend and not Production. No new production code this milestone.

- Source worktree: C:/GNart/Work/sh-site-release-ui-integration.
- Implementation branch: codex/site-release-ui-integration-20260926.
- QA worktree: C:/GNart/Work/sh-release-reader-final.
- Published branch: codex/r1d-release-reader-voice-final.
- Published head: a0835b72216d792f38da6b557364147f184773ab.
- Independent code re-gate remains 4a293f66..82a91b36, as supplied by Guy.
- Read-only publication range: f223a54af36b075fe21660959e5a591743b351d4..a0835b72216d792f38da6b557364147f184773ab.
- New predeploy documentation range: 1f6fe51930783c2e20773ee9c36c08b128f2cbda..a0835b72216d792f38da6b557364147f184773ab (two Markdown files).
- This postdeploy closeout is a local documentation-only successor, not part of
  the deployed SHA or a newly independently approved implementation.

The earlier implementation sequence remains 992493f5 (hero captions), 9b68338a
(release/site integration), 4a293f66 (identity handoff), 82a91b36 (held navigation),
1f6fe519 (independent PASS record), a0835b72 (promotion scope/validation record).

## Exact live identity

Vercel project prj_4MpzfIz0Nw8zEdBZVzaDUOcZKquX, team
team_2bLUDGyHayGB1UHIvcCBgyWh; deployment dpl_B6iLmc3JkghRXnEF5hd9CTihXgjs,
READY, Git source a0835b72 on the existing release branch. Stable alias API:
qa.smallheroes.co.il -> this deployment. Preview URL:
https://small-heroes-7qjf2xln2-smallheroes-projects.vercel.app/.

Old QA deployment for rollback: dpl_B919bcgPteP7xWxtMyR5YmPBTiov,
small-heroes-ayzpo93hr-smallheroes-projects.vercel.app (f223a54a).
No rollback was needed or executed. No force-push, env mutation, protection
change, direct Production deployment or alias substitution occurred.
Production smallheroes.co.il still maps to dpl_2X7E6d1acZ5vKJVhLSuKFGP5Q4HN;
origin/main still ed1da86cc114a767dc1086b71a30a4ef4595c097.

## Validation and explicit limitations

- Both typechecks pass. Fresh local build exit 0, 39/39 static pages. Vercel build
  also completed; the existing local skipped-env-validation warning is retained.
- Product/config release-check exit 0, 18/18 sellable. DB check skipped because
  DATABASE_URL absent locally. Strict render qualification remains 1/18.
- Full check run 1: ordinary 4761 passed / 73 skipped, resource 624 passed /
  11 failed plus three unhandled errors, native 1.
- Full check run 2: ordinary 4761 passed / 73 skipped, resource 635 passed /
  zero failed, but three onTaskUpdate RPC errors, native 1. Full gate remains RED.
- Restored 15 missing ignored inputs by byte-identical copy from existing local
  worktrees, without overwrites; not a fresh-clone portability solution. No test,
  timeout, skip, worker configuration or exit-code relaxation. Overlapping workers
  from another project were observed; causality was not proven.
- Real browser stable QA: 1440x1000 desktop and 390x844 mobile. Hero personalization,
  two captions, Suez heading, six loaded gallery images and no Style 02 selector;
  name/gender handoff to first Wizard step; existing audio ends at 2.64 s and
  resets, no audio error. No horizontal overflow at measured landing sizes or
  mobile Wizard. Both missing-order generating wrappers return home.
- No new live held/ready order, payment, photo upload, provider generation or
  production book. Claude's earlier held/ready browser evidence is not relabeled
  as fresh. Existing draft/photo data retained, only our synthetic name/gender
  cleared. Existing contact/copy LOW observations remain open.
- API/backend/generation/package/story/Next configuration and test infrastructure
  compare unchanged to f223a54a. app/lib/public/scripts compare unchanged to82a91b36.
- No application console errors observed; separate Vercel-login FedCM errors
  were present. No runtime-log-wide or all-route error-free assertion.
- Engine branch 5f4e938f and protected 768ccb2f / 63ccb484 were not changed.
- $0 model spend. Hosting build costs not separately metered.

## Local evidence retention

Ignored outputs/site-qa-promotion-20260927 is local-only, with no verified
off-machine backup. Push does not preserve it. SHA-256:

| File | SHA-256 |
| --- | --- |
| fixture-copy-receipts.json | be369c33d9641abb09ab69046a79216971907a3243db3ae0acc7dc68f927b432 |
| full-check.log | b039ef7c66c8bc7e2bb0803358582625c91d2e0a48102fcc8da55847bee8e38e |
| full-check-retry.log | b929c8c704ab3224ae3512348ed6402dcf0c1bc287bf836499f5e5b0a8b74005 |
| build.log | 6945efee4d5192c7c44782693c662215ba6e29ba920af1129c8893d0ea1649ac |
| release-check.log | 5c8c9c38a63a13281a8b37a84f13c45095dca66991889a437933f6fa72079100 |

Browser observations are direct tool-session evidence summarized here; no
durable browser screenshot capture is claimed. No credentials/access tokens
are included in this record.

## Independent falsification targets

Read-only; reconcile immutable published SHA before reviewing. Do not rerender,
redeploy, change aliases/env/protection, create an order or edit the repository.

1. Does stable QA actually resolve to the deployment of a0835b72, not70d4f245?
2. Are deployed code bytes still identical to82a91b36, and release runtime/API/
   package authority unchanged from f223a54a?
3. Does homepage-to-Wizard preserve name/gender with the reviewed storage rules,
   and do both generating wrappers retain safe return navigation?
4. Is the RED full check recorded honestly, separately from the successful build,
   product/config gate and 1/18 strict qualification?
5. Are Production alias/main, protected worktrees and engine branch unchanged?

Product acceptance remains Guy's; this handoff awards no independent PASS.

## PowerShell inspection / already-pushed state

No staging/commit/push is required to see the design: the following push is the
already-completed branch-specific command and should be a no-op at this snapshot.
Inspect before rerunning it; do not push a subsequently changed HEAD blindly.

```powershell
Set-Location 'C:\GNart\Work\sh-release-reader-final'
git status --short --branch
git log -1 --oneline
git ls-remote origin refs/heads/codex/r1d-release-reader-voice-final refs/heads/main
# Expected QA HEAD/server: a0835b72216d792f38da6b557364147f184773ab
# Already performed:
# git push origin HEAD:refs/heads/codex/r1d-release-reader-voice-final
```
