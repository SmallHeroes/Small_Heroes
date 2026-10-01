# Personal story literary editor — approved implementation decision

## 1. Proposed change and authority
Guy requested completion of a genuinely strong personal-story engine on
2026-10-01, after approving the proposed planning -> draft -> literary edit ->
final manuscript -> storyboard sequence. Same chat, sole Codex writer in
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`, branch
`codex/personal-book-storyboard-bridge`, base `2da203c2`, no upstream.

## 2. Observed problem / root cause
The writer already requests humour/causality, but its outline emphasises actions,
consequences and movement. Personal stakes, felt child experience, understandable
fantasy rules and situation-based comedy are underspecified. Its draft is passed
straight to visual planning. A later combined semantic review diagnoses; it never
edits. This is a verified workflow gap, not proof of the cause of every sentence.
Guy's forwarded external review is creative feedback, not an independent code
PASS. The full manuscript is not available in current browser tabs.

The actual pilot logged three completed calls (plan, manuscript, storyboard),
then `book_storyboard_invalid`, before semantic review. Raw prose/draft is not in
the accounting-only log, so that compiler failure has no proven detailed cause.
It stays open, separate from literary quality.

Live creative evidence added during implementation: 2/2 new raw drafts stopped
mid-plot despite correct item counts. Their text covers early beats in multiple
items. That is consistent with spread/display-half confusion, but no paid
counterfactual proves it. Editor restored both endings. The successor adds an
explicit positional map and required final resolution, and strengthens
recognisable opening/adventure guidance. This successor has no live replay.

## 3. Scope / rejected alternatives
General personal engine only: richer narrative planning/writing guidance and ONE
separately instructed editor call that returns a complete revised plan/manuscript
and explicit observations. Preserve original draft, compute revision identities in
code, revalidate count/facts/exclusions, then plan visuals from revised prose.
Any editor `needs_work` holds before visual calls. Its `ready_for_reading` is a
model opinion, not product acceptance or independent QA. No endless rewrite loop.
Rejected: one Bar/Uri patch, mandatory fear/joke in every spread, fixed four-place
template, numeric self-awarded quality scores, blind model upgrade, schema tests
as literary-quality proof. Existing standalone two-call draft API stays diagnostic
and compatible; the active book flow requires the editor.

## 4. Files / migration / risks
New editor contracts, compiler and priced SDK adapter; writer instructions;
book runner, reservation and browser envelope; storyboard source validation;
focused fixtures/tests; bounded synthetic text experiment; CURRENT/ROADMAP and QA
handoff. Full book envelope becomes diagnostic-v2; old unedited v1 envelopes are
not silently called edited. Original story drafts remain readable as partial data.
No accepted catalogue source, website design, recording extraction or image state
changes. Main risks: model rubber-stamping, invented biography, length drift,
stale hashes/plans, additional latency/cost and finite input headroom.

## 5. Expected behaviour / tests
Meaningful child motive and emotional choices; humour arising from personality
and action; comprehensible fantasy cause/effect; purposeful movement and an earned
ending. Exact offered length/child/address/companion permissions remain. Unit and
real SDK-seam tests attack source bindings, editor holds, changed source/cancel,
budget-before-key, caps/timeouts, input limits, accounting and no retry. Existing
legacy writer and visual continuity tests remain. Full check, tsc and diff check;
known RED repository gate is not excused or self-closed.

## 6. Cost and smallest creative evidence
Existing key reuse was explicitly authorised by Guy. No new key/secret file.
Guy also authorised GPT-6.1 if not materially more expensive; official model
pages verified 2026-10-01 give GPT-6.1 Sol the same base input/output rates as
GPT-6 Sol ($2/$10 per million tokens). The separate experiment uses exact
`gpt-6.1-sol`, Medium, never an implicit alias/fallback. Cached input discounts
are not deducted from conservative reservations or usage estimates.
First offline checks, then at most three wholly synthetic text-only samples at
8/12/16 spreads. Separate experiment ceiling $3, pre-reserve every intended call;
never reset/restart the older $3/one-job pilot. Compare original and edited text
with concrete observations and a separately instructed comparison, not a claimed
independent technical PASS. Save every attempted call's accounting and originals.
Fixed one-shot output root, no alternative-root flag, no retries. Total maximum
reservation $2.838 for 9 writing/editing calls and 1 comparison call. Any earlier
provider failure or editor hold stops the experiment; unknown usage stays unknown.
No images, narration, public rollout or actual child's audio/profile dispatch.

## 7. Rollback / review / stop-check
Revert this focused milestone, not user changes; no database migration. Claude
Code receives immutable base/head and attempts to falsify generality, source and
length binding, held-before-visual, reservation completeness and preserved draft.
Guy judges the resulting stories; model comparison is preliminary creative
evidence, not a guarantee. Broader creative consultation remains optional.

Stop-check: general fix=yes; regression possible=yes (tests and diagnostic-only
scope); production cutover=no; spend=bounded text only; smallest proof=offline
then synthetic text; owner intent=approved; independent QA=not self-awarded;
Guy eyeballs=final stories plus before/after; excluded=render/push/deploy/budget
reset and unlimited retries. No unresolved scope choice before this implementation.
