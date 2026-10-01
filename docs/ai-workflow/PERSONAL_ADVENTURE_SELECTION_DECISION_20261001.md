# Personal adventure selection — bounded implementation decision

## 1. Proposed change / owner intent

Guy forwarded and adopted the small-scope planner improvement and four refinements:
two genuinely different adventures, retained selection evidence, deterministic
length measurement separate from literary opinion, and separate first-draft vs
editing comparisons. Continue in this chat, sole Codex writer, branch
`codex/personal-book-storyboard-bridge`, worktree
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`, base `6de84b4f`.

## 2. Observed / expected / root cause

Current writer already plans the WHOLE book then writes its complete manuscript.
It has child/companion wants, humour, approved fact IDs and continuity. It commits
to one model premise immediately. There is no retained alternative to evaluate.
Current editor revises and rates its own revision; measured Bar output had seven
of eight spreads above the age-five target despite all model observations ready.
This is evidence of a self-rating/measurement gap, not proof of every quality cause.
Expected: two concise alternatives before the chosen outline, honest observable
selection, and measurements/review material not dependent on the editor's assertion.

## 3. Scope / structured responsibilities

- Add required selection evidence to CURRENT planner provider output and writer
  validation (custom providers cannot bypass it), without adding a model stage.
- Keep archived plan/prose schemas compatible. Add an optional, hash-bound receipt
  to result envelopes, preserved verbatim through editing. It records the ORIGINAL
  plan, not an assertion that the edited plot still follows the selected premise.
- Candidate differences may concern child want, complication, discovery or child
  contribution, never merely scenery. Code rejects literal duplicates, verifies
  approved fact references and early outline references; paraphrases and quality
  remain semantic judgments. Model `needs_work` holds before manuscript, no retry.
- Measure actual text using documented lexical word counting and age targets.
  Targets are advisory, not a new automatic literary/runtime PASS or length veto.
- Prepare an OFFLINE comparison package from matched existing artifacts: planning
  old/new FIRST drafts separately from draft/edited, plus blind text-only review
  input excluding author rationalisations/editor checks. No new paid runner.

## 4. Generality / rejected alternatives

No named story/child/companion recipe or location quota. Reject ten new agents,
per-criterion provider calls, unbounded replan/edit loops, and interpreting JSON
or model justification as literary acceptance. Do not introduce a baseline fallback
into production; later baseline artifacts must come from the frozen predecessor.

## 5. Likely files / order / migration

New selection contract/validator -> planner SDK/writer -> result/editor/source
binding -> text metrics and offline comparison -> adversarial fixtures/tests ->
canonical docs and Claude handoff. Existing offline archives without evidence
remain diagnostic/runtime-ineligible, not upgraded. Generated current outputs
require the evidence even though archive input schemas accept its absence.

## 6. Validation / acceptance

Real writer entry, strict SDK schemas at 8/12/16, removed fact and clone/scenery
probes, held outline before second call, receipt corruption/preservation and
source hashes. Metrics count real prose and expose ready/overlength disagreement.
Comparison rejects mismatched reviewed profiles, ages/counts, edited-as-draft and
reused labels; review views exclude hidden version keys/checks. Focused tests,
tsc, deliberate negative controls, full repository check. All preserved paid
artifacts remain unchanged. These checks do NOT demonstrate improved stories.

## 7. Cost / caps

Zero live calls, images/audio, real secret-value reads or pilot budget resets in
this implementation. Safely detected an existing key; Guy's prior reuse choice
continues. Planner gets 4,000 extra reasoning-inclusive output tokens for the
bounded alternatives/checks; manuscript/editor/visual caps unchanged. Reservation
formula automatically prices this at $0.044 extra per Sol job (not a charge),
with unchanged hard budget and five-call ceiling. Caps remain policy, not measured
adequacy. Historical one-shot trial root stays claimed; no successor paid allowance.

## 8. Risks / rollback

Self-justification, paraphrased duplicate concepts, input size and long-book
adequacy, editor losing strong inventions, sparse facts and evaluation bias remain
risks. Two options are not intrinsically better. Revert this focused milestone
before any rollout; never rewrite preserved paid evidence or approved prose.
Earlier independent P3 corrective re-gate remains pending; no expanded PASS.

## 9. Stop-check / topology / exclusions

General system? yes. Other stories? schemas/callers tested, no plot-specific data.
Production? default-off local diagnostic writer only; customer flow unchanged.
Spend? none. Smallest proof? offline production-boundary tests; later paired TEXT
experiment needs its own bounded execution allowance, not another output-root flag.
Unresolved owner decisions? none for this code-only scope. Claude should falsify
claims listed above; Guy should judge blinded premises and texts before illustrations.
Protected d53b `768ccb2f` and accepted-intent `63ccb484` clean; Claude site `86ca47e8`
clean/ahead two, detached QA `2da203c2` clean and NOT this review endpoint. No writers
delegated; parallel agents may advise read-only at frozen base. No push/deploy,
site/wizard/UI, orders, story bank, renderer, narration or release changes.
