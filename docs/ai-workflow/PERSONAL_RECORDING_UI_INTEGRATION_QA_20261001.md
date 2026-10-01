# Latest recording UI on the text engine: independent QA handoff

2026-10-01. Implementation is complete locally; independent QA is requested,
not self-awarded. No push, deployment, microphone capture or provider call.

## Requirement and frozen range

Guy reported that `http://127.0.0.1:3443/dev/personal-wizard` still showed the
previous recording screen, not Claude's updated design. Integrate the requested
UI while retaining the new engine's complete edited-text path without rendering.

- Writer: Codex, this chat, sole implementation writer.
- Worktree: `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
- Branch: `codex/personal-book-storyboard-bridge`, no upstream.
- Base: `961fcd20c8c670f041d402641d41a3214ac3b63a`.
- Code head: `4eacbb9684a9d53b0578d0d94cc4a5d1bd349a95`.
- Review exactly `961fcd20..4eacbb96`: one commit, 18 files, +855/-445.
- This document and its CURRENT/ROADMAP pointers form a subsequent docs-only
  closeout; they do not extend the code review range.
- Source UI: `719dcb7ffca5ccff38e6d8fd844b5a381d621acf..2194e9a80681396649534fb6b0c5a37f59f611c3`
  on `claude/personal-wizard-wow-20261001` at
  `C:/GNart/Work/sh-claude-wizard-wow`. Imported using cherry-pick without commit;
  no conflict. Claude source is unchanged/clean. His implementation is not an
  independent technical PASS of itself.

## Investigation and implementation claims

Root cause: separate branches, not a diagnosed browser cache or microphone fault.
The live server ran the engine tree before Claude's UI range was imported.

Imported unified start/recording stage, static five-cue arc, microphone orb,
existing measured-RMS halos, shorter labels, shared CSS and reduced-motion test
coverage. Cues are prompts, not live extracted facts. Existing decoding/card
logic and explicit `story_only` action remain in place.

One correction beyond the import: the clean-screen policy hid the memory-only
notice in the write view and when retaining a local clip. Unsent text is local
component state and does not increment draft revision. `showDraftNotice` in the
existing tell-view module now selects disclosure for write/card/retained-clip
start and subsequent steps, while leaving recording/processing uncluttered.
Copy says details disappear on refresh/close. This is not new persistence or a
new unload guard. Restored a concise non-live note when neither live intake nor
the sign-in-required variant is available. First tsc caught the missing
`localNote` key in this correction; fixed before the final checks.

### Files

- UI: `app/dev/personal-wizard/{ChildBasics,CueTags,MustHaves,PersonalWizard,RecorderPanel,StepBook,StepCompanion,StepSummary,StepTell}.tsx`
  and `personal-wizard.module.css`.
- Policy/copy/tests: `lib/personal-wizard/{copy,tell-view}.ts`,
  `__tests__/{draft,reduced-motion}.spec.ts`.
- Docs: CURRENT, ROADMAP, original source `PERSONAL_WIZARD_WOW_20261001.md`
  (Claude's attributed report, not independently adopted measurements), and
  `PERSONAL_RECORDING_UI_INTEGRATION_DECISION_20261001.md`.

The diff is empty for `app/api/dev/personal-wizard`, StoryPreview, book runner,
book config, story provider, request contract, draft model, recorder/controller,
hooks, homepage and middleware. No model, prompt, price, auth/operator gate,
request acceptance, claim or budget/ledger change. No new migration or package.

## Codex verification

- `npx tsc --noEmit --incremental false`: native 0 before code commit.
- `npx vitest run lib/personal-wizard`: native 0, **773/773 in 25 files**, final
  corrected source. Includes ten new disclosure-policy cases in draft.spec.
- Reduced-motion suite is part of that run. No browser preference emulation.
- `git diff --check` and staged equivalent: clean before commit.
- `npm run check`: **native 1, RED** on corrected source. Ordinary: 382 files,
  359 passed / 6 failed / 17 skipped; 5585 passed / 10 failed / 73 skipped
  assertions. Resource: 20 files / 635 assertions pass, but three unhandled
  `onTaskUpdate` RPC timeouts make that phase exit 1. These are not green phases.
- Failure names match the previously recorded set: child lexicon (1), koko
  momentum (1), page entity QA (1), story read-back (2), visual-direction
  acceptance lifecycle (4), reserved-page placement authority (1). No fresh
  baseline checkout/run; no causal or stability closure claimed.
- Preserved initial type/full failure (missing localNote, native 2) separately.
  Final focused rerun overlapped the full check's resource phase; both native
  outcomes are reported, not a claim about resource contention causality.
- A proposed temporary live-code mutation removing the disclosure was rejected
  by safety review before execution. No mutation or negative-control run took
  place. Do not interpret the ten positive policy tests as mutation evidence.

### Real browser observations, no injected transport

Actual Next wizard on 3443 in Chrome: new empty voice start, write view with loss
notice after typing synthetic unsent text, clearly labelled local example
decoding with only Cancel visible, editable card, six companions, three lengths
and summary. Removed bonus absent from summary. Immediately cancelled a second
local example; original facts and removal survived after its completion delay.
Inspected Chrome error log was empty. No send/process/generate paid action used.

Viewport overrides 390x844 and 360x740: no horizontal overflow on start; 360 also
checked processing, card, companion, options and summary. Reset override after
testing. The user's existing IAB tab also showed the new stage. Fresh regular
Chrome tab left open with the updated empty start, not the synthetic QA draft.
Inspected tabs were signed out and show the sign-in-required notice truthfully.

These observations do not prove real microphone permission/focus, real-voice
halos, live recognition quality, authenticated operator variants, actual book
writing, browser reduced motion, Safari/Android or literary quality. No claim
that localhost's IAB supports recording; regular Chrome is the user test surface.

## Runtime, cost and preserved boundaries

Existing 3443 listener remains PID 145892, bound to 127.0.0.1. Hot reload only;
no restart, new server or deletion/refill of the pilot claim. Existing manual
one-intake ($0.10 maximum) plus one story ($1 maximum) allowance is unchanged.
Book remains GPT-6.1 Sol medium, three-stage `story_only`; no storyboard, images
or narration. This milestone adds no automatic dispatch or retry.

Validation cost **$0**, provider calls 0, no key content read. The older consumed
comparison event file's SHA is still
`E9901A4E59AA6B3508A3FB698D4C843935163F3EACCC9D53ED1A70F8D9AFDC51`.
Ignored local logs and the manually written browser-observation receipt are in
`outputs/personal-recording-ui-integration-20261001/`; no verified backup. The
receipt records observations, not an automated browser-test claim.

Protected d53b `768ccb2fe20edb1351cb4783796613cbf7a2993c` and accepted-intent-wave-2
`63ccb4846ebe5be9ab392960d389610a1b2b9d42` remain clean and unchanged. Claude's
landing `87b0d196` and cached QA branch `41359878` are excluded and not modified.

## Falsification targets for Claude Code

First pass read-only against the exact frozen range. Stop/reconcile on a different
branch/head. Do not use credentials, change server allowances or spend to review.

1. Prove imported UI corresponds to Claude's range without replacing the newer
   engine's request handling or StoryPreview; attack untouched API/auth/budgets.
2. Attack disclosure for unsent text/retained clips and disabled/nonoperator/live
   variants. Verify the warning is truthful, not a persistence/unload claim.
3. Attack recorder lifecycle, measured versus invented motion, mounted stage,
   keyboard finish/cancel focus and reduced-motion cascade. Distinguish source
   checks from actual microphone observations.
4. Attack edit/delete/conflict/tombstone behavior across mode switches, examples,
   cancellation and summary. Static cues must never be mistaken for extracted
   data. Test actual entry points, not only view selector tests.
5. Attack mobile overflow, accessibility labels and clean processing screen;
   verify no shortened copy now falsely promises processing or therapeutic result.
6. Audit evidence, RED full gate and limitations. No scope expansion to an
   independent PASS of the writer/earlier bridge, paid accuracy or release.

Guy retains product acceptance. Public/QA rollout, push, real-voice trial, images,
narration, literary assessment and whole-repo stability are outside this change.

## PowerShell inspection and optional future push

Already committed; no staging/commit command is needed from Guy. Inspect first:

```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
git status --short --branch
git log --oneline 961fcd20..HEAD
git diff --stat 961fcd20 4eacbb96
git diff --check 961fcd20 4eacbb96
```

Only after Guy separately authorizes pushing this whole branch:

```powershell
git push --set-upstream origin codex/personal-book-storyboard-bridge
```

This publishes all branch history, not just this milestone, and is not performed
or authorized by the current local-screen request. A push is not deployment or
independent QA. Rollback would be a focused revert, not reset of user work.
