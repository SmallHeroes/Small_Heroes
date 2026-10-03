# Causal planning and editing experiment

This implements Guy's approved milestone B in a diagnostic-only path. It does
not migrate the wizard, current GPT writer/editor or consumed native trial. The
purpose is to test better preparation of an adventure and preservation of its
meaning during editing. No story-quality improvement is claimed from free tests.

## Scope and execution order

Codex is the sole implementation task on codex/personal-book-storyboard-bridge,
C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes. Base for B is
71375d320f6e19cb6051f2b0ffe8d2f00e33b229, the separate current-admission milestone.
Claude Code receives a frozen successor range for a read-only first pass. The
protected d53b and accepted-intent worktrees and the QA-site branch are not written.

The new coordinator accepts reviewed requests and rebuilds their briefs from
existing fact and companion authorities. It reserves every potential logical
slot before planning. Each profile proposes two different concepts; a valid
both-rejected response alone may use one pre-reserved replan. A second rejection
or outline HOLD is terminal before prose. Transport, malformed schema, unknown
fact, stale binding, cost, timeout and cancellation do not replan.

Selected proposals retain a continuous synopsis, both concepts and backward
dependency claims with actual beat-field quotations: changed state, child
discovery, enabling setup, companion contribution and earned payoff. These are
questions, not a fixed story formula or location quota. Literal distinctness and
exact citations do not prove original ideas, causal entailment or child appeal.

The shared legacy guidance mandated a failed attempt in every book. The new
instruction profile removes ONLY that mandatory clause, preserving all other
approved constraints, and makes a failed attempt optional in planner, author and
editor stages. It permits negotiation, a boundary, helping another character,
changed goals or creative compromise without requiring all of them. The legacy
runtime instruction string is unchanged. Exact source-fragment/prefix guards
fail closed if upstream instructions drift rather than silently retain a conflict.

ALL cohort plans settle before explicit synopsis review. The returned review
bundle binds the whole manifest and every attempt. The host supplies one write
or hold decision with a reason per case; weak or repetitive proposals can be held.
This is an enforced processing barrier, not proof that a human actually read or
correctly evaluated the proposals. Returned snapshots are detached copies.

An approved case gets original authorship from its own brief, selected synopsis,
dependencies and full plan, with no other child's data, previous book or selection
self-rating. The editor gets its own fresh conversation key, complete original,
brief, metrics and character authority, not the author conversation or Astra
verdict. It returns diagnosis and 0..3 source-backed strengths plus a complete
revision in ONE response. This does not attest the model's internal thinking order.
Strengths describe functions, not immutable wording. Coherent intentional rule or
scene changes remain possible; all revised plan/prose bindings must agree.

Three separately keyed Astra-role calls follow: original-only reading, final-only
reading, then comparison. The first two carry the same allowlisted approved brief
and only their own prose, never outline choices, strengths, checks/audit or the
other version. Both valid readings are frozen before comparison dispatch. The
comparison distinguishes improvements, remaining problems, new regressions and
preferences and cites both versions. Packet digests cover actual instructions,
version and text; source digests retain the existing content identity semantics.
Neither model observations nor this coordinator grant product/visual acceptance.

## Minimal migration

New core modules: lib/personal-wizard/story-causal-experiment.ts and
story-causal-experiment-runner.ts. A new fictional cohort lives in
scripts/personal-causal-cohort.ts. Existing story-planning-contract.ts extracts
the candidate-pair guard for both selected and both-rejected states without
changing current selection behavior. story-text-review.ts adds an original-only
sibling using the existing strict source validator and allowlist. Shared persisted
plan/manuscript/editor receipt schemas, provider factories and runtime book runner
are unchanged by B. The test census increases407/387/20 to408/388/20 for one spec.

The new envelope has its own version and binds approved request/brief, plan,
original, revision, diagnosis, strengths and critic packets. It contains NO
fabricated GPT model/token/two-or-three-call accounting for native Opus work.
Archives remain readable; this diagnostic envelope is not current editor receipt
or visual admission authority and cannot be sent directly to the public book flow.
No fallback, manuscript rewrite loop or resume across process loss is added.

## Providers and cost boundary

There is no default CLI, SDK client, key lookup, network call or live command.
The injected host has reserve, claim and generate ports. Requested roles are
Opus for planning/author/editor and Astra for the three literary reviews. Different
conversationKey values are enforced at this coordinator; actual Opus5.5/Astra use,
fresh native contexts and provider billing are NOT attested by those labels.
A real authenticated adapter and a new costed family require a later milestone
and explicit spending approval. The old twelve-slot family is not reused/reset.

All caps are explicit positive safe-integer micro-USD values, with a whole-family
reservation sufficient for every potential slot. A claimed slot cannot be called
again locally. The host must provide durable family/slot exclusion across roots,
restarts and processes; the coordinator is not a durable journal. No real durable
adapter is supplied or certified here. Tests simulate a host refusing replay.

There are at most24 Opus-role logical invocations for six cases (plan, optional
replan, author, editor), plus18 Astra-role invocations. Normal six-case execution
without rejections uses18+18=36. These are NOT measured native internal provider
call counts. Each attempted stage retains its reservation, including failure;
unknown, invalid or over-cap reported cost stops downstream work. Late settlement
after abort cannot mutate the recorded output/cost. Reported estimates are not
invoices, and subscription usage is separate. The host adapter must price/enforce
actual outgoing payloads and provider-internal limits before a paid launch; these
free tests do not establish output-token adequacy or live schema compatibility.

## Validation

50 new adversarial tests cover the isolated instruction profile, cohort ordering/review barrier, one-time idea
reattempt, terminal outline/transport/schema/binding holds, malformed original,
reservation/replay/concurrency/cost guards, cancellation and ignored late replies,
timeout, all three lengths, exact dependencies, source/character binding,
0..3 strengths/diagnosis, isolated review leakage and comparison source binding.
The fictional matrix retains six companions and two of each8/12/16 length,
no chosen difficulty, one sparse but sufficient profile with one interest and
required child basics, and two children with the same hobby but distinct supplied
habits. It never enriches a sparse biography or alters the consumed cohort.

Expanded focused command (the prior13 specs plus story-causal-experiment.spec.ts)
passes582/582 across14 files. Standalone tsc exits0. Seven isolated in-memory
mutations are caught: dependency reference, cohort digest, cost cap, replan
trigger, strength identity, critic packet binding and the editor instruction
profile. Sources stay unchanged by
the mutation harness. This is implementation evidence, not independent PASS.

The first B native-stage capture before the final instruction profile exits1:
ordinary388 files,10 missing-artifact failures/5813passed/73skipped; resource20
files,8timeouts/627passed of635 plus4 onTaskUpdate errors. Both type checks exit0.
The final-profile capture also exits 1: both type checks exit 0; ordinary 388
files has 10 missing-artifact failures / 5814 passed / 73 skipped; resource 20
files has one 5000ms test timeout / 634 passed of 635 plus three onTaskUpdate RPC
errors. The timed-out test is live-execution-supervisor.spec.ts, "rejects
symlink/junction and hard-link escape authority where the host supports it".
Final-prefixed logs and final-full-check.json retain this separate run under the
ignored root outputs/personal-causal-experiment-20261003. This executes the same
native stages as npm run check, not the npm wrapper itself. No full baseline
reproduction or causal attribution of resource timeouts is claimed. A's full
check also remains RED; do not claim repository stability or release readiness.
The new root is local with no verified backup; outputs and consumed claim files
must be independently preserved/recomputed, not silently rewritten.

Exact historical preservation was recomputed: 272 / 272 SHA, size and .NET
mtime ticks match the saved baseline. The eleven A evidence files also have a
current hash/size/mtime inventory, not a reconstructed prior baseline.

Focused command (582 tests; no provider calls):

```powershell
npx vitest run lib/personal-wizard/__tests__/story-semantic-audit.spec.ts lib/personal-wizard/__tests__/story-editor.spec.ts lib/personal-wizard/__tests__/story-editor-openai.spec.ts lib/personal-wizard/__tests__/story-planning.spec.ts lib/personal-wizard/__tests__/story-comparison.spec.ts lib/personal-wizard/__tests__/storyboard.spec.ts lib/personal-wizard/__tests__/book-runner.spec.ts lib/personal-wizard/__tests__/book-preview.spec.ts lib/personal-wizard/__tests__/story-writer.spec.ts lib/personal-wizard/__tests__/opus-semantic-cohort.spec.ts lib/personal-wizard/__tests__/book-companion-trial.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts lib/__tests__/anthropic-model-authority.spec.ts lib/personal-wizard/__tests__/story-causal-experiment.spec.ts
npx tsc --noEmit
```

## Claude Code handoff

Review B against the frozen successor of71375d32, not uncommitted future files.
Read-only, no provider/key/paid/render/push/deploy work. Reconcile branch, parent,
HEAD, worktrees and dirty state before accepting any claim. A's separate handoff
is PERSONAL_CURRENT_EDIT_ADMISSION_20261003.md; its PASS cannot be assumed here.

Try to write before the last plan settles or before whole-cohort review; submit
a correctly shaped review for another manifest. Make both rejections persist;
confirm no third plan or prose. Try malformed/foreign/unknown-fact evidence and
HOLD without replan. Mutate returned snapshots and approval inputs. Deny claims,
race calls, cancel before/during stages, return unknown/NaN/overrun costs, or settle
late. Do not mistake a process-local guard for durable cross-process exclusion.

Attack diagnosis/strength quotes and stale manuscripts; preserve coherent changed
functions and0 strengths while rejecting4/duplicates. Put sentinel data in all
outline/editor fields and counterpart prose; neither isolated critic may see it.
Reject either isolated reading and verify comparison never dispatches. Recompute
whole critic packet bindings, not only a source-content hash. Show a misleading
claim with a real quote can still pass: semantic interpretation remains open.

Run the14-spec command and tsc. Inspect each mutation independently, current
runtime/provider byte preservation, the test census and full RED logs. Keep prior
paid outputs/claims and A evidence unchanged. No literary or release PASS follows
from passing these structural tests. Product quality, controlled old/new comparison,
read-aloud evaluation, paid adapter/accounting, live model provenance, archive
backup, public rollout, visual planning/render and full stability remain open.

Rollback after preserving new evidence is a focused revert of B; never reset old
trial claims or rewrite historical receipts/manuscripts. Push is Guy's separate
decision and would publish earlier branch commits too, not only these milestones.
