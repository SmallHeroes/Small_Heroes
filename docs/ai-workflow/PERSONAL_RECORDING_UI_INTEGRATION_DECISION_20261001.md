# Local recording UI integration decision 2026 10 01

## Requirement and authority

Guy reports that the live local 3443 wizard is not Claude's updated recording
screen. Integrate that requested UI into the current text-reading engine in this
chat, not an older QA branch. Codex is sole integration writer; advisory agents
are read-only. No public rollout or push is authorized by this milestone.

## Observed versus expected; root cause

The server runs the engine worktree at `961fcd20`; Claude's isolated UI is at
`2194e9a8` (parent `719dcb7f`). The UI has not been imported. This is branch
composition, not a microphone, provider or browser-cache diagnosis. Expected:
Claude's unified voice stage, cue arc, microphone orb, concise subsequent screens,
existing decoding/card, and the current explicit three-stage story-only action.

## Scope and plan

1. Import exactly `719dcb7f..2194e9a8` without automatically committing.
2. Correct the draft-loss disclosure: unsent text is component-local and does not
   increment draft revision; keep an explicit refresh/close notice in the write
   view and for a retained local clip while preserving clean voice and processing
   screens. Restore the concise non-live disclosure when neither live processing
   nor the sign-in-required variant is available.
3. Run focused wizard tests, standalone typecheck, full stability check and real
   browser checks on 3443, without sending audio/text to providers or writing a
   story. Record honestly any unverified microphone/operator variants.
4. Commit explicit paths, update CURRENT/ROADMAP and prepare immutable QA handoff.

UI/copy/CSS/reduced-motion tests plus the existing view selector/tests are in
scope. Server API, request/draft contracts, recorder controller/hooks, writer,
models, scope, budgets, ledger/claims, StoryPreview, homepage and middleware are
out of scope. No character/story-specific behavior or migration is needed.

## Topology

- Writer: `personal-story-product/Small_Heroes`,
  `codex/personal-book-storyboard-bridge`, base `961fcd20`, clean, no upstream.
- UI source: `C:/GNart/Work/sh-claude-wizard-wow`,
  `claude/personal-wizard-wow-20261001`, `2194e9a8`, clean, no upstream; read-only.
- Landing source: `sh-personal-story-redesign`, `87b0d196`, read-only; excluded.
- Cached QA: `codex/r1d-release-reader-voice-final`, `41359878`; excluded.
- Protected worktrees: d53b `768ccb2f` and accepted-intent-wave-2 `63ccb484`;
  excluded and unchanged. Reconcile these again before handoff.

## Risks, alternatives and stop-check

General prototype UI integration, not a story patch. No production cutover,
payment, prompt, image, narration, anchor, QA threshold or fallback change. A
wholesale merge onto old QA would combine unrelated/unreviewed engine history and
lose the isolated review scope; rejected. Starting a second live server would
risk resetting in-memory allowances; rejected. Use the existing server's hot
reload without restarting or deleting/refilling its common-Git claim.

There are no unresolved product choices within the requested local screen.
Rollback is a focused later revert of this integration, not reset/checkout of
user work. The original UI and engine commits remain recoverable.

## Cost and acceptance

No provider dispatch, generation, image or narration for validation. Existing
one-intake/one-story pilot limits stay unchanged. Guy should see the updated voice
screen at the same link. Static cues must not pretend to be extracted facts.
Write-view loss notice must be visible; processing stays uncluttered; finish and
cancel remain reachable. Story-only behavior and operator enforcement remain.
Focused/typecheck evidence is not independent QA or literary/release acceptance;
the repository's previously RED full gate remains open unless actually rerun.

## Independent review targets

Attack the imported range, microphone lifecycle/focus, reduced motion and mobile
layout, local/live disclosures, unsent-text loss warning, edit/remove continuity,
and unchanged story-only/provider/budget boundaries. Claude's own UI tests are
reported evidence, not an independent PASS. Guy retains product acceptance.
