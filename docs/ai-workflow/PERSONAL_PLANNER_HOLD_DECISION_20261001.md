# Decision Gate: retain valid planning HOLD before prose

## 1. Proposed change

Add a strict plan-only diagnostic for a valid model `needs_work` result, propagate
it through typed writer/book errors to authenticated local routes, and display it
in the existing wizard as planning, not a manuscript. Same chat/sole Codex writer,
`codex/personal-book-storyboard-bridge`, implementation worktree
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`, base
`4de61548735528c26cd8cd86d1b0110fe39872fc`.

## 2. Why now / verified root cause

Guy authorized continued personal-story engine work, with independent Claude QA.
Claude carried P3-1 across reviews; valid planner HOLD currently becomes generic
`book_story_invalid` and loses parsed plan/selection evidence. At `719dcb7f`, writer
throws before planDigest/receipt creation, runner remaps the code, and client
partial validation accepts only manuscript-bearing output. It blocks honest
diagnostics and evaluation of held outlines. No claim it improves literary quality.

## 3. Scope

General additive diagnostics in the existing local-only pilot; not production
generation or a new authoring pipeline. Preserve successful writer/book contracts.
Use a separate typed error/schema, not a nullable manuscript or a fake story.
Malformed plans/selection still fail technical validation without retained evidence.
Only `story_outline_held` after all current structure/source/fact guards qualifies.
Routes return distinct 422 diagnostic HOLD, rather than upstream-style 502.
This preserves the existing runner rejection API and explicit no-retry behavior;
the client parses the dedicated envelope before showing generic failure copy.

## 4. Risk of hardcoding

None of the logic may name a particular child, story, companion or page. All three
lengths, either A/B choice and each outline check must work. Model observations
remain proposals, not proof the model's criticism is correct or product acceptance.

## 5. Likely files / order

1. story-contract: strict plan-only schema; writer: typed hold and bound evidence.
2. book-runner: validate typed hold/current source, preserve outer accounting,
   distinct terminal held telemetry, release lock with consumed reservation.
3. Existing story/book routes: bounded HOLD envelopes, auth/gates/cache unchanged.
4. book-preview: separate browser reader, reject downstream fields/stale identity
   and cancellation/source-change partial artifacts. Browser validates display
   consistency, not server authority or cryptographic authenticity.
5. StoryPreview: separate state, reset/render/abort/epoch guards; honest plan-only
   copy/observations and explicit click-only new-paid-job language after attempts.
6. Existing relevant tests, offline mocked runtime/browser evidence, CURRENT,
   ROADMAP and independent QA handoff. Do not consolidate unrelated modules.

## 6. Expected behavior

One valid HOLD: one attempt and recorded known/unknown usage, both proposals,
selected plan/reason and failed-check observations retained. Zero manuscript,
editor, storyboard, semantic-review or image/audio calls; zero frame packets or
runtime authority. Same job remains consumed; user lock releases. Provider errors,
timeouts, malformed/stale/cancelled input never masquerade as a valid plan HOLD.
Changing details or cancelling suppresses stale evidence and late UI completion.
Existing successful five-stage book and editorial/semantic HOLD paths unchanged.

## 7. Validation / acceptance

Writer/runner/real routes for each length and each check; invalid+held and forged
code controls; request mutation/abort at plan-finished callback; duplicate/budget
and accounting/telemetry privacy. Browser-reader invalid identity/digest relation/
authority/downstream fields. Mocked UI proves plan-only copy, cost, no auto POST,
stale/cancel/unmount suppression, mobile/desktop wrapping and existing outcomes.
Deliberate representative breakage must fail. Focused suite, tsc and full check;
full gate remains RED unless measured otherwise. Six historical artifacts preserved.

## 8. Cost impact

This implementation/validation is offline, $0; existing reuse-key choice is not
a paid-allowance reset. No secret values, providers, image/audio or real child input.
Models/prompts/caps/reservation/attempt budgets and QA thresholds unchanged.

## 9. Compatibility / rollback

Existing completed schemas remain manuscript-only. New error subclass/422 envelope
is additive in default-off authenticated loopback pilot. No DB/schema migration,
storage or historical artifact rewrite. Revert focused commit to remove diagnostic;
keep previous QA receipts. Durable tab-independent recovery remains out of scope.
The two historical text CLIs can see the typed exception but are not executed or
rewritten here; separately authorized future trials must persist it immutably,
never place it into a manuscript slot or reopen a claimed paid root.

## 10. Review assignment / stop-check

No new unresolved product choice: narrow reversible diagnostic behavior under
Guy's already approved local pilot. Guy can eyeball plan-only copy after validation.
Claude first pass read-only against exact base/head: attack malformed/forged HOLD,
current-source/cancel races, any later-stage call/packet, accounting/telemetry and
existing successful contracts. Read-only agents advise at frozen `719dcb7f` only;
they do not implement or independently PASS. Root remains sole writer.
Protected `d53b` at `768ccb2f`, accepted-intent `63ccb484`, site `86ca47e8` unchanged;
reviewer detached `719dcb7f`. No task/worktree cleanup or conflict.

## 11. Do not do

No automatic retry/repair/replan, full book render, narration, prompt/model/budget
change, production activation, push/deploy, independent self-PASS, real child
profile, fabricated manuscript, historical accounting edit or stability closure.
