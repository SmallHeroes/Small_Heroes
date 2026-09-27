# Approved website QA promotion — 2026-09-27

## Decision Gate before execution

1. Guy explicitly requests the latest Claude design on the website, correctly
   integrated. Target in this conversation is qa.smallheroes.co.il, NOT Production.
2. Observed cause: QA follows codex/r1d-release-reader-voice-final at f223a54a;
   Claude's 70d4f245 preview is a different branch with an older runtime. Integrated
   UI is local at 1f6fe519. Independent navigation re-gate ends at 82a91b36.
3. Scope: promote the reviewed UI on the preserved release runtime. Sole writer:
   current Codex task in sh-site-release-ui-integration. No new task or engine merge.
4. General website change. No story/child patch, new package or render authority.
5. Expected edits: this gate/CURRENT and local verification evidence. Restore only
   missing ignored test inputs from their existing source worktrees, byte-identical;
   do not edit assertions, skip tests, change timeouts or invent replacement inputs.
6. Expected result: stable QA serves the integrated design, identity handoff and
   held navigation, while API/backend/release policy remain identical to f223a54a.
7. Verify full check, tsc, build and product/config release check; preserve the
   known 1/18 strict render qualification result (not a UI publication gate waiver
   or permission to offer the other stories). Verify deployed SHA, desktop/mobile
   landing and pre-order Wizard navigation, media and held/error paths where safe.
8. No image/TTS/provider/payment/order calls. Hosting build only; $0 model spend.
9. Use the existing QA branch/environment rather than substitute the old UI
   preview. Record its domain binding and old deployment before push. Git update
   must be fast-forward, never force. Rollback by restoring the known old QA alias
   and, if needed, a forward revert of the UI range on the same QA branch; do not
   rewrite/delete branches or change Production aliases.
10. Owner approved this promotion explicitly. Claude independently passed the
    implemented correction, including both wrappers desktop/mobile and mutations.
    New production code, if required, needs its own independent gate. Existing LOW
    observations/contact discrepancy remain disclosed; preserve all current contact
    and legal bytes rather than make an unapproved product/legal choice here.
11. Do not deploy to main/Production, weaken gates, change environment values or
    deployment protection, enable renders, create test orders or spend providers.

Stop-check: preview website promotion is explicit; code/runtime scope is frozen.
The production site is ed1da86c/dpl_2X7E6d1acZ5vKJVhLSuKFGP5Q4HN. QA before this
task is f223a54a/dpl_B919bcgPteP7xWxtMyR5YmPBTiov, READY. Domain API confirms QA
gitBranch codex/r1d-release-reader-voice-final. Branch-specific Preview settings
exist and must remain attached to that branch. No secrets or settings are changed.

## Validation record

- Frozen implementation: 1f6fe51930783c2e20773ee9c36c08b128f2cbda, with production
  code byte-identical to Claude's independently reviewed 82a91b36. API, backend,
  generation pipeline, packages, story sources and Next configuration are unchanged
  from the QA release base f223a54a. Test infrastructure is also unchanged.
- Fifteen missing ignored fixture files were copied from existing local worktrees,
  refusing overwrites and verifying SHA-256 equality. Originals were not changed.
  This repairs this checkout's inputs, NOT fresh-clone portability.
- Two literal full checks were run after restoration. Both typechecks passed and
  both ordinary phases passed: 338 passed / 17 skipped files, 4761 passed / 73
  skipped tests. First resource phase: 624 passed / 11 failed tests, 3 unhandled
  errors, exit 1. Second resource phase: all 20 files / 635 tests passed, but 3
  onTaskUpdate RPC timeouts and native exit 1. Full check remains RED.
- Another project's Vitest workers overlapped the first run. This is an observed
  contention factor, not proof of causality. No assertion, timeout, skip, worker
  policy or exit status was changed; no third identical retry is used as a gate.
- Fresh build: exit 0, 39/39 static pages; existing skipped-environment-validation
  warning retained. Product/config release-check: exit 0, 18/18 sellable; DB schema
  not verified because DATABASE_URL is absent. Strict render qualification stays
  1/18 and is not waived. No order/payment/provider flow was exercised.
- Guy's explicit request is protected QA website promotion, not customer launch.
  Proceed with this already independently reviewed UI, preserving the RED full
  gate as an open limitation; do not claim release readiness or stability closure.
  This is a scoped QA deployment decision, not a change to any quality gate.
- Evidence: outputs/site-qa-promotion-20260927/{fixture-copy-receipts.json,
  full-check.log,full-check-retry.log,release-check.log,build.log}. These ignored
  files are local only; no verified off-machine backup. Fixture receipt SHA-256:
  be369c33d9641abb09ab69046a79216971907a3243db3ae0acc7dc68f927b432.
- Before promotion, release branch and server still equal f223a54a and are clean;
  Production/main remains ed1da86c. Protected and engine worktrees are untouched.

Deployment and fresh browser checks are still pending at this commit's creation.

## Completion observation (after a0835b72 was deployed)

The pending sentence above describes the pre-push checkpoint, not current state.
Normal fast-forward push completed f223a54a -> a0835b72. Deployment
dpl_B6iLmc3JkghRXnEF5hd9CTihXgjs became READY at 2026-09-27T17:29:55Z;
its Git metadata names a0835b72216d792f38da6b557364147f184773ab and the existing
release branch. Stable QA alias API names the same deployment. Production alias
remains dpl_2X7E6d1acZ5vKJVhLSuKFGP5Q4HN; main remains ed1da86c.

Desktop/mobile browser checks confirmed the updated design, name/gender handoff,
six loaded gallery images, two endpoint captions, Suez font, absent Style 02
selector, existing voice-sample completion, and missing-order return navigation
on both generating wrappers. No horizontal overflow in the measured landing or
mobile Wizard viewport. No application console errors observed; Vercel login
FedCM errors are separated. QA protection required renewed authenticated preview
access after deployment; protection was not disabled and no access token is
persisted in these documents. No new order or held/ready order was fabricated.

Full check stays RED despite all assertions passing on its second run. No
stability closure or general release readiness is implied by successful QA UI
deployment. This completion documentation is local after the deployed commit;
it does not describe another deployment or extend Claude's independent code PASS.
