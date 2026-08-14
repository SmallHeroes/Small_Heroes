# Decision Gate — Story Engine Autonomous Batch Orchestrator

**Milestone:** `STORY-ENGINE-AUTONOMOUS-BATCH-ORCHESTRATOR`

**Approved base:** `ea4404a5b2492099c35c90c6da2a14ee6478144f`

**Product decision:** Guy approved autonomous A/B/C invention and selection,
`gpt-5.6-sol` through the Responses API, and a one-command path that continues
through all remaining story commissions without requiring human selection.

## 1. Proposed change

Replace the interactive `WAITING_FOR_GUY_SELECTION` boundary for future story
commissions with a resumable, content-addressed four-role pipeline:

`Architect → Selector → Writer → Editor → bounded revision → qualification`.

The existing accepted Dini source and all historical Architect v3 artifacts
remain immutable. The new path produces `machine_qualified` staging sources; it
does not write the live story bank or grant Wizard/render authority.

## 2. Why now?

The successful Dini pilot proves that the creative-nucleus/Writer/Editor
separation can produce a materially better story, but the current prompt
explicitly stops for Guy after A/B/C. Repeating that interaction for 17 slots is
slow, non-resumable and inconsistent with the approved autonomous catalog goal.

## 3. Observed behavior and root cause

- `STORY_ARCHITECT_CHARTER_V3.md` says not to recommend a winner.
- `buildStoryArchitectBundle` says not to write until Guy selects and ends with
  `WAITING_FOR_GUY_SELECTION`.
- The current materializer creates prompts only; it has no provider execution,
  Selector contract, state machine, usage accounting or resume boundary.
- The older `story-gen-v3` tournament contains useful infrastructure patterns
  but carries the detailed screenplay-era premise shape Guy rejected. It cannot
  be reused as authoring authority.
- The shared `OpenAIResponsesLLM` defaults to deprecated
  `gpt-5-chat-latest`, has obsolete rough pricing and may include provider text
  in thrown errors. It is not suitable as this milestone's live boundary.

## 4. Nine architectural decisions

1. **One command, separate calls.** “All stories at once” means one resumable
   operator command, never one giant model response.
2. **Context-separated roles.** Architect, Selector, Writer and Editor each run
   in a fresh context. The same model may serve them, but no role sees hidden
   reasoning or the other role's prompt.
3. **Explicit model policy.** Use exact `gpt-5.6-sol` via Responses with
   `store:false`: Architect `high`, Selector `high`, Writer `low`, Editor `high`,
   revision Writer `medium`. No fallback model.
4. **Closed machine contracts.** Architect, Selector and Editor return strict
   JSON; Writer and revision Writer return canonical Hebrew story Markdown.
   Code recomputes Selector totals and refuses a recommended option that is not
   the unique highest qualified score.
5. **Creative isolation.** Writer receives only the winning premise, compact
   companion psychology and page/frontmatter identity. It never receives
   rejected options, Selector scores, the Editor rubric or old screenplay rails.
6. **Bounded recovery.** One Architect reroll is allowed only when no option
   qualifies. A story receives at most two targeted Writer revisions. No
   transport retry or model fallback occurs implicitly.
7. **Durable exact-once state.** Each stage is content-addressed and committed to
   a per-story checkpoint before the next call. Resume verifies model, prompt,
   input digests and output identities and never overwrites a completed artifact.
   A story-level HOLD does not erase other stories; the final wave is partial
   until every slot is qualified.
8. **Credential and cost boundary.** The launcher reads only `OPENAI_API_KEY`
   from the approved local source and injects it only into the live child. Raw
   secrets, authorization headers, provider bodies and stacks are never
   persisted. Before every call the runner reserves a conservative maximum and
   refuses to cross `--max-cost-usd`. The first live proof is one Bunny bedtime
   pilot under a hard `$1.00` ceiling. Full-wave authority requires a new cap
   derived from that measured pilot.
9. **Staging-only cutover and rollback.** `machine_qualified` is not Guy product
   acceptance and cannot enter `story-bank/v3-approved`, Wizard/runtime, Visual
   Contract or render paths. Rollback is reverting the focused commits and
   ignoring/removing unpromoted output roots; prior accepted sources are intact.

## 5. Files likely affected

- new autonomous Architect/Selector/Writer contracts under
  `story-pipeline/03_story_briefs/`;
- a typed/resumable orchestrator under `lib/story-pipeline/`;
- a credential-isolating launcher and live child under `scripts/`;
- focused tests in the existing story commission spec;
- `package.json`, `CURRENT.md` and implementation evidence.

No dependency or lockfile change is planned.

## 6. Expected behavior

One command can process one pilot or the 17-record wave. For every record it
creates A/B/C, selects the unique qualified winner, writes the exact page count,
reviews it, applies up to two diagnosis-bound revisions and persists a final
machine-qualified source only after Editor PASS and deterministic structural
validation. Interrupted work resumes without repeating completed calls.

## 7. Validation plan

1. Provider-sentinel tests for role isolation, score recomputation, exact winner,
   reroll/revision limits, cost guard, safe errors, resume and no-overwrite.
2. Deterministic tests for 8/12/16 pages, frontmatter, gender chips and Editor
   verdict relationships across all six companions and 17 remaining slots.
3. Focused Vitest, script syntax, TypeScript and `git diff --check`.
4. One real Bunny bedtime pilot only, hard-capped at `$1.00`, followed by a
   source/editorial inspection before any full wave.

## 8. Cost impact

Implementation and sentinel validation cost `$0`. The single pilot may spend at
most `$1.00`. The full wave is not yet authorized to spend: its hard cap will be
computed from recorded pilot usage plus the explicit maximum revision envelope.

## 9. Claude Code falsification targets

Claude Code should try to falsify role/context isolation, absence of screenplay
rails, closed schemas, unique-winner enforcement, deterministic story parsing,
exact call/revision counts, no retry/fallback, conservative cost reservations,
credential isolation, safe persistence, resume identity, 17-slot coverage and
the complete absence of live bank/Wizard/render writes.

## 10. Do not do

Do not alter the accepted Dini source, historical prompts, live story bank,
Wizard/runtime, Visual Contract, image directions, Reader, payments, storage,
QA/Production deployment or Production. Do not render images, generate audio,
push, use a fallback model, loosen page/personalization validation or submit the
17-story paid wave before the pilot establishes its explicit full-wave cap.
