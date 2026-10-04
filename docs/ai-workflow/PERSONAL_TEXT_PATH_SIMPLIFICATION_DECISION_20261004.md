# Approved decision: simplify the text path, preserve meaningful QA

Status: Guy approved the two free implementation milestones on 2026-10-04
("כן מאשר"). Root Codex is the sole writer in the existing engine worktree,
codex/personal-book-storyboard-bridge, starting from b9995108. Approval is not
independent QA, paid-run consent, product acceptance or public-flow migration.
Paid trial 05 remains terminated; do not launch a sixth trial during this work.

Execution update: A is local 471890ad; B is the successor containing
PERSONAL_TEXT_PATH_SIMPLIFICATION_HANDOFF_20261004.md. Focused checks pass, full
repository gate remains RED and independent Claude Code review is pending. The
implementation does not expand the approval to live execution or public rollout.

## 1. Proposed change

Two separate milestones, not a new pipeline framework:

A. Correct the Opus adapter's per-request versus CLI-cumulative usage contract.
Keep the configured request cap and existing USD allowance. Admit a completed
schema-valid aggregate only with known valid usage/cost and the unchanged host
slot-cost check. Preserve all model, termination, cancellation and size guards.
Astra is a single Responses request; its output-cap check remains intact.

B. Trim the existing causal text coordinator's research-only obligations:

1. Keep approved brief, selected continuous synopsis and structured ordered beats.
2. Remove the five backwardDependencies self-cited ledgers and their duplicated
   author input. Keep the causal planning QUESTIONS in the creative instructions.
3. Remove the causal editor wrapper's additional diagnosis and strengths records.
   Keep diagnosis-before-revision as guidance, and initially retain the shared
   revised plan/manuscript, six checks and five-category semantic edit audit.
4. Move original-only Astra scoring to explicit calibration/benchmark runs.
   KEEP isolated final Astra, followed by original-to-final regression Astra.
5. Reuse current transport, coordinator, source bindings and one-use journal.
   No new agent framework, rule engine, memory service or automatic retry layer.

Normal logical model sequence becomes:

```text
Short plan → fresh Opus author → fresh Opus editor
           → isolated final Astra → edit-regression Astra
```

Four responsibilities, five model calls. A separately reserved creative replan
is exceptional, not a mandatory sixth call. Original-only scoring and cohort
comparison remain research tools. A calibration identity probe is not a proposed
per-customer task; actual model identity checks at each dispatch still remain.

## 2. Why now: observed versus expected

Expected: get a coherent readable story, edit it well and review it independently.
Observed: trial05 supplies a current-schema valid plan but the transport rejects
aggregate 22,785 outputs against configured 18,000 per request. This is a measured
contract error, not a demonstrated weakness of the story or insufficient prose
capacity. Increasing the cap again would conceal the scope problem.

The causal planner also writes two ideas, contrast, selection rationale, three
outline checks, synopsis, full beats and five quoted causal ledgers. The editor
duplicates a full revised plan plus audit/checks and adds diagnoses/strengths.
These burdens are verifiable in the code. Whether they divert attention from
good prose is a plausible hypothesis, NOT a measured literary result.

The existing test explicitly accepts a wrong causal interpretation with matching
quotes. backwardDependencies validate provenance, not logical entailment. Moving
their questions into the planning guidance and their substantive assessment into
independent prose QA removes paperwork, not a proven causal-quality guarantee.

## 3. Scope and actual call-site map

| Existing path | Actual behaviour | Boundary |
| --- | --- | --- |
| Customer story bank | Reviewed sources/personalisation | Separate production architecture |
| Personal dev story_only | OpenAI plan, manuscript, editor | No independent final Astra literary review |
| Personal dev storyboard | Above plus storyboard and semantic review | Visual diagnostic, not this task |
| Causal research | Opus plan/optional replan, author/editor, three Astra readings | Local script/host experiment |
| Single-book calibration | Synthetic probe, causal research, local text viewer | One-use diagnostic, not public wizard |

Do not tell Guy the existing wizard already uses Opus/Opus/Astra. The ordinary
provider factory routes through OpenAI. Do not bypass the missing independent QA
by switching back to story_only merely because it has fewer stages.

This first proposal changes only the diagnostic route. Public integration comes
after measured text quality and independent technical review, as a separate gate.

## 4. Quality and authority that must remain

Code owns approved-request/companion identity and hash binding; known fact IDs;
exact chosen spread count and array order; output structure; measured word targets
(distinct from hard bounds); literal marker/exclusion checks; budget, cancellation,
known/unknown usage, timeout and no-replay enforcement. Remove metadata from model
authorship only where the engine already knows and can bind it deterministically.

Astra assesses ACTUAL prose: invented biography or semantic exclusions, age/read-
aloud language, humour, consequential child choices, useful distinctive companion,
emotional credibility, magical conditions, clues, transitions and earned payoff.
An isolated final reading must not receive the editor's scores or original text.
Then a fresh comparison receives original and final prose to detect lost setup,
tone escalation, shifted agency or weakened character. This per-book regression
check stays: making it calibration-only would lose evidence, not be a free gain.

The shared editor-v3 audit currently affects admission and downstream storyboard
binding; do not strip it globally. Keep original and final text for human reading.
Model support is advisory, not an automatic product/release PASS.

## 5. Risks, alternatives and unchanged behaviour

- Do not patch a specific story, child, companion, phrase or paid response.
- Do not raise token/dollar caps, subtract thinking tokens, or multiply turns to
  invent per-request enforcement. Individual internal requests remain unverified.
- CLI list-price estimates are not guaranteed provider invoices. The scope fix
  cannot honestly promise zero unexpected upstream failures or exact billing.
- A direct Anthropic API adapter may offer clearer request-level control later;
  it requires separate credentials/routing scope and is not this first fix.
- Combining author and editor loses source isolation; combining final and
  comparison exposes the final judge to the old version. Neither is recommended.
- Removing the full beat plan loses continuity/storyboard groundwork; defer that.
- Reducing candidate variety or all shared semantic audits is a larger creative/
  compatibility decision. Do not do it in the first simplification milestone.
- Dropping original_review changes reservation and viewer semantics. Replace
  positional readings.slice(1) admission with named final/comparison selection;
  otherwise a blocking final finding could be skipped after stage removal.

Existing approved briefs, ordinary story/editor/runtime contracts, legacy archive
readability, public UI, story bank, images, resemblance threshold and paid evidence
remain untouched. Smaller schemas require an explicit diagnostic version boundary;
do not reinterpret historical accepted packets or restore sealed trial05.

## 6. Likely files, sequence and commit boundaries

A: scripts/personal-causal-trial-adapters.ts; native/host/Astra specs; decision,
CURRENT and handoff. Capture both valid aggregate and failure receipts. Keep the
host's existing USD validation, and test its equality/cap+1 boundary explicitly.

B: lib/personal-wizard/story-causal-experiment.ts and its runner;
scripts/personal-causal-trial-host.ts and personal-single-book-calibration.ts;
causal/host/native/single-book specs and viewer tests. Reuse existing abstractions.
Recalculate DOWNWARD the removed stage's reservation, never silently repurpose it.
Preserve the experimental calibration mode's original reading when requested.

Use two focused free commits/reviews. Root Codex is the sole writer in the current
engine task/worktree, not a new overlapping execution chat. No site-tree writes.

## 7. Acceptance and smallest validation

A offline proof: above-request aggregate under unchanged USD cap accepted; invalid
usage/model/schema/termination still rejected; slot equality accepted, cap+1 stops
before the next stage; Astra over-cap still rejected; receipts/cancellation and
no-replay unchanged. Tests against the current source must reproduce the error.

B offline proof: all request/fact/companion/count guards intact; fresh author and
editor contexts; final packet includes no original/plan/editor rating; final runs
before comparison; blocking final or regression findings still hold the book;
no original-review claim in normal mode; calibration original review retained;
reservations/stage counts/viewer adjusted; old records readable but not reusable.
Run tsc, relevant suite and full gate; inherited RED does not become release PASS.

Only AFTER independent technical re-gate and fresh bounded execution consent:
one fictional short book, original and final saved, both human-readable. Evaluate
the draft separately from the edit. Fewer fields/calls must not be advertised as
better literature until Guy reads the result. Six-profile testing follows quality
evidence, not before another end-to-end book exists.

## 8. Cost and rollback

Proposed implementation/tests are free; zero new image/audio/provider generations.
New model calls are NOT authorised by this document. Trial05 remains sealed.
Any future trial has a new reference/family and current-price admission. Revert
focused commits to roll back; preserve every historical output, seal and receipt.

## 9. Review assignments and required owner decision

Guy owns the simplification/quality tradeoff and approved these diagnostic
obligations and accounting scope. Codex investigates/builds.
Claude Code's first pass is adversarial/read-only against an immutable range:
attack scope-aware usage, retained USD authority, stage/order/source isolation,
named reading admission, archive compatibility and preservation. Codex cannot
self-award independent PASS. Creative consultancy can check whether the remaining
short plan preserves intent, but more consultation is not a prerequisite to
correcting a measured accounting bug. Guy eyeballs the eventual story.

## 10. Stop-check and explicit exclusions

This touches diagnostic prompts/QA/admission, so it is an approved Decision Gate.
General system change; no special-case book; ordinary/public production unchanged;
implementation free; offline smallest proof; the scope/quality decisions above
are approved for these two local milestones only. No sixth paid attempt,
reset/resume, key creation, image/storyboard/
narration, companion assets/carousel, six-book run, site QA switch, push, release
or promise of a perfect failure-free model engine.
