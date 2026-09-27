# Held-screen navigation: bounded corrective milestone

## Decision Gate before implementation

1. Requirement: complete Guy's approved website integration and fix valid QA
   regressions. Claude's forwarded review changes the verdict on 4a293f66 to
   HOLD (one medium finding). This is not an additional product redesign.
2. Observed cause: generating/page.tsx removed the compact header because the
   BookOnTheWay scene owns a home link. The shared GeneratingClient renders a
   separate heldReview branch without that scene or a home link. The error
   branch already has one. This is a semantic merge defect.
3. Scope: add the same native home link/style to the held branch for every book.
   Both ordinary and release/v1 pages use the shared client. No child/story rule.
4. Files: generating-client.tsx, existing presentation spec, CURRENT and this
   brief. No new dependency, abstraction, endpoint, state or migration.
5. Acceptance: held HTML contains an accessible home anchor to ROUTES.home and
   no release/generate action. Error navigation remains. Preserve ready/held
   conditions, polling, status authority, keys and fullscreen scene unchanged.
6. Rejected: restoring the global header changes the approved full-screen scene;
   a history-back button is unreliable on direct links. Reuse the existing error
   button's native anchor and 44px-min-height style instead.
7. Validation: first make the rendered held-branch regression fail on 4a293f66,
   then pass after the fix. Run adjacent UI/status tests and tsc; build if useful.
   Do not claim a browser or configured order/payment/audio test from an HTML test.
8. Cost $0. No render/provider/database/credential calls, deploy or push.
9. Rollback: revert this focused successor. No other worktree or history change.
10. Sole writer: current Codex task, C:/GNart/Work/sh-site-release-ui-integration,
    codex/site-release-ui-integration-20260926, clean base 4a293f66. No new task.
    Claude reviews the frozen successor read-only and rechecks desktop/mobile.
11. Excluded: contact choice, boy default, restored Wizard step bug, pre-existing
    gendered ready headline/repeated held copy, and full-gate infrastructure.

Stop-check: general navigation-only correction, no lifecycle/fallback behavior
change, no money or new owner choice. Product direction and review roles remain.

## Review attribution

Claude reports real-browser checks of identity handoff, storage boundaries,
two captions, Spotlight/video/category link, ready cover/keyed reader, held
redirect and other generating states. These are independent reviewer observations,
not fresh Codex browser measurements. His HOLD supersedes his earlier PASS at
the same 4a293f66. The current report supplies medium/low grades, not P0/P1 counts.

Three low observations retained: cosmetic email/payment-description copy through
content/index.ts; boy default unless another chip is selected; pre-existing
Wizard restored-step remapping. Contact remains unresolved. The historical full
check has both missing fixture failures AND RPC errors, not fixture failures only.
No configured order, payment or actual playback proof follows from this review.

## Results and re-gate

Pre-fix: the expanded existing presentation spec ran 8 cases, 7 passed and only
the heldReview navigation case failed. Its rendered output showed the heart,
heading and paragraph with no anchor. The error branch positive control passed.
After the fix, focused UI/status suite: 15 files / 132 tests, exit 0. The existing
presentation spec grows 6 -> 8; no new spec or inventory-count change.

The tests parse the real GeneratingClient with TypeScript, extract the return
JSX for exactly `heldReview && !ready` and `error`, transpile it and render with
React DOM server. They use real ROUTES, fixture class names/error text, no effect
or network execution. Each output has one home anchor, no form/button, and no
reader/access-key/API action. This proves HTML output, not browser layout or
status transitions. Existing ready.js and status-route mocks cover those seams
separately; no configured order, payment, playback or provider was exercised.

tsc exits 0. ENABLE_V3_APPROVED_BANK=true npm run build exits 0 with 39/39 static
pages. Existing Prisma configuration deprecation/skip-env-validation warnings
remain; no upgrade performed. The build's skip-type-check setting is unchanged,
so the separate successful tsc is required. No new server/env attempt made.
No full check or release-check repeated for the three-line navigation patch;
their historical RED/limited status is unchanged, not silently promoted.

Only production diff against 4a293f66: the three-line anchor in the held branch.
No CSS or other component changed. The release/v1 wrapper still uses this shared
client and retains its own header; the normal wrapper keeps its fullscreen scene.
The existing anchor style has a 44px minimum height and no viewport hiding rule.
All relevant worktrees rechecked: release f223a54a and qaexperience1 70d4f245
clean; wowredesign2 51ce55fc retains its 11 untracked reviewer files; protected
d53b 768ccb2f and accepted-intent-wave-2 63ccb484 clean, no writes there.

### Reviewer scope and falsification

Worktree/branch above; base 4a293f66a4e22042649add5477b39455658e1b8f to the
focused successor supplied in the final handoff. First pass read-only. Reconcile
HEAD before reviewing. Confirm:

1. The real under-review screen now has a visible keyboard-usable home link on
   desktop and mobile; it goes home without exposing the book key or releasing it.
2. Fullscreen generating, ready and error paths remain unchanged; the same child
   client works under ordinary and release/v1 wrappers.
3. The production diff is only the three-line anchor, not a lifecycle/gate edit.
4. The regression targets the actual held branch and fails when its link is
   removed, while the existing error branch remains a positive control.
5. Prior LOW notes, contact choice, old copy, and full-gate/environment limits are
   retained. This correction is not their closure or general release acceptance.

Focused command: the 14-spec command in SITE_UI_VERIFICATION_20260927.md plus
lib/__tests__/generate-status-route.spec.ts. Counts are 112 + 2 + 18 = 132.
No independent PASS is claimed. Request Claude's narrow re-gate, then reconcile
the remaining promotion prerequisites. Guy still owns product/launch acceptance.
