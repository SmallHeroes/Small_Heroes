# Updated recording wizard on QA: decision and execution scope

## Requirement, authority and topology

Guy asked why the latest recording UI was not on QA, explicitly reminded Codex
about the subsequent loading screen, then instructed Codex to handle the move.
Implement the QA-only UI promotion in this chat; no production or paid remote
activation. Codex is sole writer of the attached clean `personal-site-qa` worktree
on `codex/personal-site-qa-integration-20260930`, base `86f1bb58`. The release branch
`codex/r1d-release-reader-voice-final` is clean at `41359878`, verified against
origin; it is the destination for a non-forced fast-forward under this QA request.
Only one docs-only predecessor separates these tips. Protected d53b `768ccb2f`,
accepted-intent-wave-2 `63ccb484`, local engine `2ec333a3` and Claude UI `2194e9a8`
are excluded/read-only. Keep the existing 3443 local pilot running unchanged.

## Observed, expected and root cause

QA alias is READY at `dpl_CAfr6uM8Uog7eVkKEDKa2eqpuXd3`; it follows the named
release branch. It has the old wizard. New UI is on Claude's isolated branch and
was integrated locally onto the newer engine; neither change is deployed to QA.
Expected: latest microphone stage/static cue arc and the original animated
decoding screen, editable card, six companions and length selection on QA.
Examples remain labelled examples, not proof of live transcription or writing.

The new engine is deliberately loopback-only. Intake/writer/book budgets are
process-memory Maps, not cloud-wide ceilings. A hostname bypass or copying local
allowances would multiply/reset spend across instances. This is not fixed by a
UI deployment. Remote live writing requires a separate durable atomic budget,
idempotency and recoverable job boundary plus independent QA before activation.

## Smallest solution, dependencies and rejected alternatives

1. Import only Claude's UI commit `719dcb7f..2194e9a8`; do not merge engine history.
2. Reapply the local integration's write/retained-clip loss disclosure and non-live
   note. Resolve any older-QA component differences without importing newer
   availability polling or StoryPreview/engine APIs. Existing disabled behavior
   and server guards remain. Typed optional sign-in prop may be retained, but QA
   must not imply sign-in enables a disabled paid service.
3. Verify current homepage and middleware are unchanged. Test focused wizard,
   disclosure, reduced-motion and middleware paths, typecheck, full check, build
   and config-only release gate. Preserve exact red outcomes and scope limits.
4. Commit explicit paths, prepare immutable independent handoff, verify remote
   has not moved, fast-forward/push only the named QA branch, then verify READY
   deployment, stable QA wizard and disabled provider surfaces. Do not force push.
5. Record the remote-live follow-up design separately; no DB writes/migration or
   cloud credentials/paid flags are introduced in this milestone.

Rejected: whole engine merge (unreviewed unrelated history and local-only pilot),
relaxing loopback or treating per-process budget as cloud authority, starting a
new local server/resetting claims, replacing QA middleware with engine middleware
(would lose exact-host homepage routing), or publishing to production.

## Files, compatibility and acceptance

Nine wizard components plus module CSS, copy, existing tell-view and two existing
tests; imported source report and CURRENT/ROADMAP/this decision/handoff. No new
runtime dependency, package, inventory file, request contract or schema migration.
DecodingView/recorder/hooks/draft/API/payment/writer/thresholds remain unchanged.
No child/story-specific fix. Draft notice is a disclosure, not persistence or new
unload protection. Static cues must never impersonate extracted facts.

Browser QA must show updated start, marked-example processing with Cancel and
no extra UI, editable card and onward flow; small/mobile viewport no horizontal
overflow. Inspect rendered root/CTA and noindex; inspect HTTP status of paid
surfaces without dispatch. No microphone/provider action is needed to validate
the port. Do not infer literary quality or a ready remote story engine.

## Cost, stop-check, review and rollback

QA preview deployment only, not release/launch. Provider cost $0, no images/audio
or actual story generation. Existing QA preview live-intake/story writer OFF
overrides remain; book runner is absent/off. No secret value is read or copied.
Production alias/environment/protection and homepage source remain untouched.
Full stability gate may retain the ten recorded fixture failures/RPC errors;
report actual results, do not weaken tests or claim a green release.

Guy's request resolves the narrow QA UI decision and he retains product acceptance.
Independent Claude review must attack older-QA integration, missing dependency,
loading/cancel/edit/remove continuity, accessibility/reduced-motion/disclosures,
exact-host isolation and paid paths OFF. Root's parallel agents advise read-only,
not independent PASS. Remote live activation remains outside this scope.

Rollback: repoint only QA to the prior recorded READY deployment; retain Git
history and use a focused revert for code if required. Never reset user work,
force push, remove a pilot claim or change production alias. Stop/reconcile if
the named QA remote moves or another writer dirties a relevant checkout.
