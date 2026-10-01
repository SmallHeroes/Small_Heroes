# Personal planner HOLD implementation for independent QA

Codex to Claude Code. Guy requested continued work on excellent personal stories.
This milestone fixes loss of a valid rejected outline, not literary quality itself.
First pass is read-only against the exact frozen range supplied at closeout. Do not
edit, push, deploy, start a paid trial, read secrets, render images or synthesize audio.

## Review identity and concurrent work

Branch `codex/personal-book-storyboard-bridge`, sole implementer Codex in
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
HOLD implementation base `4de61548735528c26cd8cd86d1b0110fe39872fc`; this includes
the preceding separate test-only P3-D correction, which still needs its own gate
for `719dcb7f..4de61548`. Received independent PASS remains EXACTLY
`9adf6555..719dcb7f`, not either successor.

Use a frozen review checkout, not Claude's active UI worktree. At the final source
inspection, reviewer `C:/GNart/Work/sh-qa-book-10f54930` is detached/clean at
`719dcb7f`. `sh-claude-wizard-wow` is at the same base with separate dirty UI work;
`sh-personal-story-redesign` remains `86ca47e8`, ahead 2, with dirty CSS. Codex did
not modify them. Protected `d53b` at `768ccb2f` and accepted-intent `63ccb484` are
clean/parity. The implementation branch has no upstream; no push was authorized.

## Requirement and root cause

At base, all structural/request/fact validation could pass and one outline check
could say `needs_work`. Writer threw `story_outline_held` without its parsed plan;
runner mapped it to `book_story_invalid`; the client only admitted manuscript
partials. A real planning decision looked like an upstream technical error and
neither parent nor evaluator could inspect its two ideas and reason.

Decision Gate `PERSONAL_PLANNER_HOLD_DECISION_20261001.md` limits the remedy to the
existing default-off authenticated loopback pilot. Success schemas and runner
return type stay manuscript-bearing. A valid HOLD stays a rejection, with a
distinct 422 diagnostic envelope. No new authoring or repair pipeline.

## Implementation claims

`story-contract.ts` defines strict plan-only evidence: version/status, request
identity, plan/digest, display count, fixture indicator, required planning receipt
and false runtime eligibility. It checks coverage/numbering, receipt relationship,
resilience evidence positions, selected fact references, final payoff evidence and
at least one `needs_work`. This browser-safe schema does not authenticate pixels,
facts, a model's reasoning or a plan's canonical digest.

`story-writer.ts` builds this evidence only after all existing writer guards.
`assertStoryPlanningHoldBinding` additionally checks the actual prepared request,
length, fixture status, resilience mode, approved facts, real canonical SHA and
the full existing adventure-selection guard. A typed provider-thrown lookalike is
not the writer's validated observation. A terminal observer cancellation removes
HOLD evidence before delivery and retains accounting. Typed errors clone payloads.

`book-runner.ts` rechecks typed evidence and current approved request, and requires
exactly one actual plan dispatch. Cancellation/source mutation take precedence,
including plan-finished and terminal-held observer races. Outer book accounting
remains authoritative; missing usage stays unknown, known usage stays measured.
The ledger consumes the job/reservation and releases the user lock. Telemetry
contains only existing stage/code/accounting data, not plan or child text.

The two existing routes return separate plan-only 422 envelopes. Auth, loopback,
operator/feature flags, input/reservation-before-key, no-store/noindex and all
other error/success paths are retained. A bare code or malformed plan is not HOLD.

`book-preview.ts` has a separate strict reader requiring one attempt and matching
request identity. It rejects downstream fields and cannot pass HOLD as complete
or partial manuscript. It also refuses manufactured partials for cancellation,
source-change or outline-HOLD errors. This is display validation, not authority.

`StoryPreview.tsx` has separate request-bound HOLD state and renders both proposals,
the chosen one/reason, observations and proposed beats. Copy says planning only,
not readable manuscript or independent literary acceptance. Cost is visible for
HOLD too; missing usage is not zero. Epoch/abort and render guards prevent stale
delivery after change/cancel/unmount. No automatic POST; another click starts a
new potentially paid job. Received evidence clears on edit/cancel.

## Validation measured before code freeze

Final command:

```powershell
npx vitest run lib/personal-wizard/__tests__ lib/__tests__/vitest-workload-classifier.spec.ts
npx tsc --noEmit
```

714/714 in 25 specs, native 0; standalone tsc native 0; diff check clean.
First narrow run was 246/246 in five specs before the final attempt-binding test.
An intermediate command included a non-existent classifier path and therefore
ran only 24 real personal specs, 707/707; the final command above corrects that
scope explicitly and proves all seven classifier tests too.

Deliberate controls, each restored byte-identically:

- Remove actual-attempt guard: 1 failed/96 skipped in runner; no-call fabricated
  HOLD incorrectly becomes `book_outline_held` instead of technical failure.
- Remove strict envelope: 5 failed/13 passed/19 skipped; inserted writerResult,
  manuscript, storyboard, review and frame packets incorrectly display as HOLD.
- Disable late writer cancellation: 1 failed/59 skipped; HOLD leaks after abort.

Browser harness imports the actual React component and existing synthetic fixture.
Transport is mocked; server has global fetch disabled, binds only 127.0.0.1:3477,
and starts no Next/auth/database/provider adapters. 38/38 assertions, no runtime
errors; HOLD/cost/retry, late identity/stale/cancel/unmount suppression, malformed
status/envelope and existing success/partial display. Container widths 390/1024
and separately real viewports 390x844/1024x900 show no horizontal overflow. Not a
live SDK, Next hydration, full product flow or independent literary assessment.
Agent-browser is absent; Codex in-app browser was used as documented fallback.

First full check: native 1; ordinary 381 files, 11 failed/5517 passed/73 skipped;
resource 20 files, 635/635 assertions and three `onTaskUpdate` RPC errors, native
1. Ten ordinary failure names equal the prior log; extra terminal-resume EEXIST
passes in isolation (1 passed/30 skipped). Its source and autonomous writer blob
are unchanged. This is not root-cause proof or stability closure. A final full
rerun on restored source is running and will be added in closeout before handoff.

## Local evidence and preservation

New ignored, unbacked root `outputs/personal-planner-hold-validation-20261001/`:
browser-server.ts, browser-client.tsx, focused.log, focused-final.log,
mutation-attempt.log, mutation-downstream.log, mutation-cancel.log,
isolated-eexist.log, full-check.log and full-check-final.log. A final offline
summary/preservation receipt will list hashes before handoff. No backup claimed.
The historical paid root `outputs/personal-story-editor-trial-20261001/` is not
reopened, rewritten or reclassified. Six artifacts must match the previous hashes.

## Falsification targets

1. Produce each of three outline HOLD checks, either choice and all lengths through
   the real writer/runner. One attempt, no manuscript/editor/visual dispatch or
   packets, known/unknown usage preserved, reservation/job retained, lock released.
2. Invalid structure, facts, outline refs, request, canonical digest, fixture status
   or resilience must not qualify. Bare error code, provider lookalike and valid
   forged subordinate HOLD without a dispatch must not qualify either.
3. Cancel/change source on plan-finished or terminal-held callbacks. No stale
   planningResult/manuscript/packets; costs remain. No late retry or unhandled error.
4. Real local HTTP 422 distinction and unchanged auth/key/budget/caching boundaries.
   No plan text in telemetry. Duplicate job returns 409 without a second key read.
5. Browser HOLD cannot masquerade as manuscript/render authority, cannot mix in
   downstream fields, and is guarded by request identity/epoch/abort. Cost and
   no-retry semantics remain visible; existing successful/partial paths work.
6. Six historical paid artifacts, protected worktrees, prompts/models/caps/budgets,
   customer routes, schemas for successful results and resemblance 0.70 unchanged.

## Limits and next dependency

No self-awarded independent PASS, product/literary acceptance, stable full gate,
image continuity/anatomy proof, completed book or readiness for launch. No provider,
secret value, paid reset, retry, render, audio, push, deployment or public activation.
Code does not establish that quotation presence means semantic support or that
two differently worded ideas are creatively different. Earlier bridge
`45b9e754..07d3c8d3` remains independently unreviewed.

Historical paid-trial and manuscript CLIs are not rewritten/executed here. A future
separately qualified trial must save plan-only evidence immutably under a new root,
never in a manuscript slot. After independent re-gate, next step toward the actual
product promise is a bounded diverse-profile comparison of first drafts and
separately edits, with retained candidate choices and human literary evaluation.
