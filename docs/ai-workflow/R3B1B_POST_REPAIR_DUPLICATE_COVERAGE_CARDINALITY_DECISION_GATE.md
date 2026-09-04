# R3-B1b Post-Repair Duplicate Coverage Cardinality — Decision Gate

Date: 2026-09-04

Product owner: Guy

Technical owner: Codex

Branch: `codex/r3b1b-accepted-intent-wave-2`

Planning base: `11d4ff0a8b23979267bbbdbee437581e0cd196ac`

Status: **INDEPENDENT QA PASS WITH ONE P2; CLEANUP-ELIGIBILITY CORRECTION
PREPARED; RE-GATE PENDING — NO IMPLEMENTATION, RETRY, PROVIDER CALL OR
DOWNSTREAM AUTHORITY**

## Approval record and boundary

Guy authorized preparation of this zero-cost Decision Gate for the general
post-repair duplicate coverage-cardinality defect. He explicitly withheld
authority to change code, retry P1, call a provider or perform downstream work.

This document therefore records the investigated behavior, proposed general
design, alternatives, risks and proof plan. It does not implement the design
and it does not authorize a new P1-A1 attempt. The prior P1-A1 provider/spend
authority was consumed by the failed-closed execution and has no reusable call
or dollar headroom. Claude Code independently reviewed the first prepared Gate
at `11d4ff0a..3924ad62` and returned PASS with no P0/P1 and one documentation
P2. The valid P2 and its correction are recorded in section 12.

## 1. Proposed change

Introduce a versioned, graph-aware repair-routing policy for Action Semantic
Coverage cardinality failures:

1. derive the complete same-page action/coverage binding graph before granting
   a compact page repair;
2. admit the existing compact `coverage_action_binding_cardinality_invalid`
   target only when the compiler can prove that a legal one-field solution
   exists in a closed domain;
3. require that compact solution to bind the target to the unique currently
   uncovered same-page action beat and reject any patch that creates a duplicate
   beat binding or leaves the graph invalid;
4. when the closed action-binding graph has no legal compact solution — including
   post-repair `coverage_beat_cardinality_invalid` duplicates — route the typed
   failure to the existing bounded `full_draft` repair lane;
5. allow the full-draft lane to re-author the complete descriptive draft from
   the exact Story Source, then run all existing deterministic schema, source,
   action, coverage, identity, continuity and reference validators again; and
6. fail closed for incomplete authority, unrelated mixed issue families,
   unrecognized diagnostics or any result that still violates cardinality.

The `full_draft` route is a normal repair mode already present in the bounded
authoring loop. It is not a transport retry, fallback, cleanup call or new call
class. This change must not increase the seven standard-call maximum, create a
ninth call, repurpose the terminal-reference cleanup call or alter any dollar
ceiling. Because `full_draft` is already one of two globally cleanup-eligible
predecessors, this Gate adds a new route-specific restriction: a full draft
selected by this cardinality escalation may not unlock the cleanup call.

## 2. Why now?

The exact-source P1-A1 Visual Contract execution for
`dragon_dini_adventure` failed closed after its first compact page repair. On
page 10, the repair assigned `beat:p10:child_pushes_cart` to two coverage
records. The compiler correctly emitted:

- one `action_coverage_cardinality_invalid`; and
- two `coverage_beat_cardinality_invalid` diagnostics.

The official zero-provider replay reproduced the exact two-call sequence and
same invalid-draft result. Claude Code independently confirmed both the correct
rejection and the general routing omission.

This blocks P1 before a Visual Contract candidate exists. P1 consequently
remains package-ineligible and the Wizard remains deliberately contained at
17/18. The defect can affect any story whose compact repair is asked to solve
an action/coverage graph for which a one-field mutation is impossible; it is
not specific to Dini, page 10 or the accepted P1 source.

## 3. Observed behavior, expected behavior and root cause

### Observed

The compiler already detects duplicate coverage beats. The compact repair
planner, however, recognizes several action-binding diagnostics but not
`coverage_beat_cardinality_invalid`. Its current coverage-binding target
authorizes changing only the targeted coverage record's `beatId`.

In the captured page-10 draft, both same-page action beats already had one
Action Semantic Coverage record. A third `action_requirement` record pointed
to a non-action beat. There was therefore **zero** uncovered action beat to
which that record could legally move. Every permitted one-field choice among
the existing action beats necessarily created a duplicate.

After the provider made that impossible one-field choice, the mapper returned
no repair plan for the resulting duplicate diagnostics and the lifecycle
correctly stopped with `draft_authority_reference_domain_invalid`.

### Expected

A compact repair should be offered only if the compiler proves that the
targeted field has a legal, closed-domain value that can restore graph
cardinality. When no such value exists, the system should use its existing
bounded full-draft semantic repair, where the model can reconsider the whole
descriptive classification from source while deterministic validators remain
the final authority.

### Root cause

The repair planner reasons from individual diagnostics and field scope, but it
does not perform an admission-time feasibility check over the complete
same-page binding graph. The applier proves target identity and non-target
scope, yet does not make restoration of the final action/coverage graph a
precondition of granting that compact repair.

The missing mapper entry for `coverage_beat_cardinality_invalid` is a symptom,
not a sufficient fix. Adding that code directly to the existing one-field
target would authorize another under-specified mutation and could hide or
discard source semantics.

## 4. Scope and invariants

This is a **general system change** to authoring repair admission, routing,
version authority and replay compatibility.

Required invariants:

- story key, child, companion, page number and beat text are data, never code
  branches;
- every action beat has exactly one `action_requirement` coverage record and
  every such record binds exactly one same-page action beat;
- duplicate coverage beats remain invalid;
- no coverage record is silently deleted, merged or relabeled by deterministic
  code;
- presentation classification, when semantically required, can be authored
  only inside an already-authorized semantic repair and must still use the
  closed presentation classes and exact same-page authority pointers;
- source evidence, cast identity, wardrobe, world, sets, props, prohibitions and
  transition authority remain governed by their existing validators;
- no fallback or transport retry is introduced, and cardinality-escalation
  provenance explicitly excludes the resulting `full_draft` from terminal
  cleanup eligibility while ordinary existing `full_draft` behavior remains
  unchanged;
- the per-page resemblance threshold remains **0.70**; and
- P1 remains 17/18-contained until a separately approved exact-source package
  is qualified and promoted.

This milestone must not create a P1 candidate, hand-edit captured evidence or
special-case `dragon_dini_adventure`.

## 5. Recommended design

### A. Closed graph analysis

Create one pure helper that derives, per affected page:

- the canonical action beat IDs;
- the `action_requirement` coverage records and their current beat IDs;
- action beats with zero, one or multiple coverage records;
- coverage records that bind no same-page action beat; and
- the exact typed diagnostics explained by that graph.

The helper must reject stale locators, incomplete issue populations and issue
sets that do not agree with the draft it inspected.

### B. Compact-repair admission

Retain the current narrow page repair only when there is one provably legal
assignment for the targeted coverage record: the unique uncovered same-page
action beat. Include that exact permitted value in compiler-owned target
authority and make the applier reject every other value.

After applying the patch to a clone, recompute the page graph before accepting
the result. Target-only scope is necessary but not sufficient: the result must
also have valid action/coverage cardinality.

If there is no uncovered action beat, more than one unresolved assignment, a
duplicate graph, stale diagnostics or incomplete authority, do not grant the
compact target.

### C. Bounded full-draft escalation

For a complete, pure action/coverage-binding diagnostic family that has no
legal compact solution, select the existing `full_draft` repair mode. The
rejected draft stays absent from that prompt; the model authors a new complete
descriptive draft from the exact Story Source plus compact typed failures.

The returned draft receives the same deterministic compile and validation
pipeline. Failure remains failure. If the standard call budget is exhausted,
stop with the existing exhaustion behavior.

The current cleanup policy has two independent gates: its predecessor must be
`book_surface_patch` or `full_draft`, and its residual diagnostic population
must be the exact closed reference-only family. Moving this defect from
`page_contract_patch` to `full_draft` therefore changes the predecessor surface
even though cardinality diagnostics themselves do not pass the second gate.
The first Gate incorrectly described cleanup eligibility as unchanged.

This corrected Gate intentionally requires a **new narrowing**: carry typed
cardinality-escalation provenance through the repair attempt and make terminal
cleanup ineligible after that escalated `full_draft`, even if a later residual
population would otherwise be reference-only. Ordinary full-draft and
book-surface cleanup eligibility remains byte-for-byte behaviorally unchanged.
Widening this new route to the cleanup call would require a later, explicit
Decision Gate rather than being inherited implicitly from the repair-mode name.

This gate does not broaden unrelated mixed-family routing. Existing safe routes
remain unchanged; new incomplete or ambiguous combinations fail closed unless
an independently justified general authority already handles them.

### D. Versioned cutover and historical replay

Routing changes alter the expected repair sequence even when prompt text stays
the same. They therefore require explicit version authority, not an invisible
behavior change.

Implementation must:

1. bind the new routing policy to newly materialized authoring requests and
   increment every current request/receipt/readiness or prompt-policy envelope
   whose canonical truth changes;
2. keep the reviewed v55 request / v58 receipt / v55 readiness evidence and
   replay-evidence v2 immutable;
3. preserve an offline-only legacy route sufficient for the official captured
   replay to reproduce the exact two-call `invalid_draft` outcome with zero
   provider calls; and
4. prevent a new production request from selecting legacy routing or a legacy
   evidence object from being reinterpreted under the new policy.

Exact successor version numbers and the smallest canonical cascade must be
confirmed during implementation investigation. Versioning may not be omitted
merely because no prompt prose changed.

## 6. Alternatives rejected

- **Add `coverage_beat_cardinality_invalid` to the current mapper.** Rejected:
  the live graph has no legal one-field replacement, so this repeats the defect.
- **Delete or merge one duplicate coverage record deterministically.** Rejected:
  that can erase a source-authored visual beat or change its semantic class.
- **Relabel the orphan record as a presentation requirement in code.** Rejected:
  deterministic plumbing does not own that creative/source-semantic decision.
- **Use the presentation-requirement patch without eligibility.** Rejected: the
  current live lane intentionally has no reviewed eligibility bound to this
  source snapshot; inventing it would weaken authority.
- **Retry P1 or spend the unused budget now.** Rejected: the previous authority
  is consumed, and another call would reproduce an unfixed systemic risk.
- **Increase attempts, enable fallback or lower validation.** Rejected: none
  fixes feasibility, and each weakens the fail-closed contract.
- **Inherit ordinary `full_draft` cleanup eligibility for this escalation.**
  Rejected for this milestone: it would make a previously page-patch-only
  cardinality route satisfy the cleanup predecessor gate and could expose an
  eighth call that was not reachable on the old route. Preserve ordinary
  full-draft cleanup elsewhere, but require a separate owner gate before this
  new escalation may use it.
- **Patch only Dini/page 10 or hand-author a candidate.** Rejected: it would not
  fix the general production path or produce trustworthy lifecycle evidence.

## 7. Files likely affected

Core implementation is expected in:

- `lib/visual-contract-compiler/pageContractRepair.ts`;
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`;
- `lib/__tests__/page-contract-repair.spec.ts`;
- `lib/__tests__/draft-reference-domain-hardening.spec.ts`; and
- `lib/__tests__/visual-contract-repair-loop.spec.ts`.

Version/replay compatibility may also require focused changes in:

- `lib/visual-package/visualContractAuthoringLifecycle.ts`;
- `lib/visual-package/visualContractAuthoringReplayEvidence.ts`;
- `lib/visual-package/visualContractAuthoringReplayRunner.ts`;
- current request materialization, pre-live or Supervisor version consumers;
- their focused lifecycle/replay tests; and
- `CURRENT.md`, `ROADMAP.md` and milestone evidence.

This is a likely-file forecast, not permission to modify all listed modules.
Implementation must first trace the exact canonical-version dependency graph
and keep the diff to the smallest complete set.

## 8. Expected behavior and acceptance criteria

The implementation milestone is acceptable only if all of the following hold:

1. the captured page-10 graph is recognized as having no legal compact
   `beatId` mutation;
2. under the new policy it selects `full_draft`, not another impossible page
   patch, without increasing call or spend ceilings;
3. a truly compact graph with one unique uncovered action beat retains the
   narrow page repair and rejects every non-permitted value;
4. duplicate, stale, incomplete and unrecognized graphs remain fail-closed;
5. a valid stubbed full-draft response can produce a fully validated candidate
   without duplicate coverage or source/identity drift;
6. an invalid stubbed full-draft response remains terminal and grants no
   candidate/output authority;
7. the official old v55/v58 captured-response replay remains byte-identity
   congruent, uses zero provider calls and reproduces its exact historical
   invalid result;
8. new requests bind the new routing authority and cannot downgrade to legacy
   behavior;
9. cardinality-escalation provenance prevents its `full_draft` from satisfying
   terminal cleanup eligibility, while ordinary existing `full_draft` and
   `book_surface_patch` cleanup behavior is unchanged;
10. no story-specific branch, fallback, transport retry, extra call, cleanup
   reallocation, threshold change or downstream authority is introduced; and
11. documentation and receipts state observed results without self-awarding
    independent technical PASS.

## 9. Validation plan

All implementation validation remains local and provider-free:

1. unit-test graph derivation and compact feasibility for zero, one and multiple
   uncovered actions, duplicate records, stale locators and incomplete issue
   populations;
2. prove atomic patch rejection on duplicate creation, wrong permitted value,
   non-target drift and residual invalid cardinality;
3. replay the exact captured historical evidence through the legacy version and
   require zero provider/network calls plus exact prior outcome/call sequence;
4. feed the same structured initial-draft shape to the new policy with a stubbed
   caller and assert the next mode is `full_draft`;
5. cover both a valid full-draft recovery and adversarial invalid responses;
6. prove unchanged standard/cleanup ceiling integers, no fallback and no
   transport retry; separately prove the new route-provenance exclusion and
   unchanged ordinary full-draft/book-surface cleanup eligibility;
7. test cross-version substitution, new-request legacy downgrade and receipt /
   readiness mismatch rejection;
8. run the focused compiler, lifecycle, replay, pre-live and Supervisor tests
   selected by the final diff;
9. run `npx tsc --noEmit`, `git diff --check` and `npm run check`, disclosing any
   inherited environment failures rather than counting them as PASS; and
10. obtain Claude Code's read-only adversarial review on an immutable range.

No image, audio, provider call, full-book render or P1 retry is part of this
proof. There is no candidate for Guy to eyeball during implementation. Guy
reviews a future Visual Contract only after a separately authorized live run.

## 10. Cost impact and rollback

Decision Gate preparation, implementation and validation are **USD 0**. They
must use stubs and captured-response replay only.

In a future separately authorized authoring run, full-draft escalation can
consume one of the already-budgeted seven standard calls. It cannot consume the
terminal cleanup call under this Gate, add another call or raise the
projected/hard ceilings. The exact future P1-A1 call and spend authority must be
issued anew after implementation QA.

Rollback is a focused revert of the implementation commit and its version
cutover. There is no data migration, provider artifact or package state to
undo. Historical evidence stays immutable and replayable before, during and
after rollback. If version migration cannot meet that condition, implementation
must stop rather than rewrite evidence.

## 11. Review assignment and owner decision

### Guy decision required before implementation

Approve or reject the following package as one technical milestone:

- graph-aware compact admission;
- full-draft escalation only for a complete pure action/coverage binding family
  with no legal compact solution;
- strict fail-closed behavior for incomplete/unrecognized scope;
- versioned cutover with exact historical replay preservation;
- unchanged global seven-standard-plus-closed-cleanup ceilings plus a new
  route-specific rule that cardinality-escalated `full_draft` cannot unlock
  cleanup, with no provider validation; and
- a mandatory stop after local green commit and Claude Code handoff.

Recommended approval wording:

> מאשר את Decision Gate לתיקון הכללי של post-repair duplicate coverage
> cardinality: graph-aware compact admission, bounded full-draft escalation,
> versioned cutover ושימור replay היסטורי. מאשר implementation ללא עלות בלבד,
> ללא terminal cleanup למסלול ההסלמה הזה, retry, ספק או downstream, ולעצור אחרי
> commit ו-handoff ל-Claude Code.

If approved, implementation should run in a dedicated milestone-scoped
execution task/worktree. This Lead task remains the decision and re-gate hub.

### Claude Code falsification targets

Claude Code should try to prove that:

1. a compact repair is still admitted when no legal assignment exists;
2. the proposed graph helper trusts issue text instead of recomputing draft
   truth;
3. duplicate deletion/reclassification or non-target drift can pass;
4. unrelated issue families are accidentally widened into full-draft repair;
5. cardinality-escalated `full_draft` can unlock terminal cleanup, or the new
   exclusion changes ordinary full-draft/book-surface cleanup behavior;
6. v55/v58 historical replay changes sequence, outcome or canonical identity;
7. a new request can select legacy routing or cross-bind old/new evidence;
8. the fix contains a P1, Dini or page-10 special case;
9. candidate/output authority can survive invalid final cardinality; or
10. docs overstate test, QA, cost or downstream status.

Claude Cowork is not required: this gate contains no new story prose, visual
direction, product UX or creative choice. If implementation reveals that a new
creative disposition policy is required rather than using existing full-draft
semantics, stop and return that product question to Guy before coding it.

## 12. Independent QA finding and correction

Claude Code reviewed exact range `11d4ff0a..3924ad62` read-only and returned
**PASS with no P0/P1 and one P2**. It independently confirmed the captured graph,
forced duplicate, mapper omission, existing `full_draft` mode, likely files,
version/replay obligations, documentation-only scope, zero effects and both
reported validation results.

Its P2 correctly found that the first Gate promised unchanged cleanup
eligibility. Current policy lists `full_draft` as a cleanup-eligible predecessor
while `page_contract_patch` is not. The residual-diagnostic gate separately
limits cleanup to a closed reference-only population, but that does not make the
predecessor surface unchanged.

This correction does not hide the change behind the residual gate. It records
the predecessor flip and makes the intended behavior explicit as a new
route-specific restriction: cardinality-escalated full drafts cannot unlock
terminal cleanup; ordinary eligible predecessors remain unchanged. The focused
correction requires independent re-gate before Guy approves implementation.

## 13. Do not do

Under this prepared gate, do not:

- edit production or test code;
- make a provider/network call or use a real credential;
- retry P1 or reuse prior call/budget headroom;
- create or accept a Visual Contract candidate;
- author a Blueprint, image, Board, prop, package or locator;
- render, narrate, publish, deploy, order or charge anything;
- enable fallback, transport retries or an extra repair call;
- let cardinality-escalated `full_draft` inherit terminal cleanup eligibility;
- weaken cardinality, source, identity, package or readiness validation;
- alter the 0.70 resemblance threshold;
- rewrite content-addressed historical evidence; or
- proceed to implementation without Guy's separate explicit GO.

## Stop-check

1. **General solution?** Yes. Routing derives from typed graph state, never a
   story/page key.
2. **Cross-story risk?** Medium-high because authoring routing is shared; bounded
   by version authority, pure helpers, closed admission and replay tests.
3. **Production behavior?** Only after a future implementation and new request
   version; this planning commit changes none.
4. **Spend?** USD 0 now. Future provider use requires a separate GO and cannot
   increase existing ceilings.
5. **Smallest safe proof?** Captured-response replay plus stubbed compiler /
   lifecycle tests; no live call or render.
6. **Guy decision?** The complete implementation package in section 11.
7. **Claude target?** Graph feasibility, authority closure, the new cleanup
   provenance exclusion, unchanged ordinary cleanup behavior, budget invariants
   and old/new replay isolation.
8. **Cowork?** No, absent a newly discovered creative-policy decision.
9. **Guy eyeball?** This Gate now; a future candidate only after separate spend
   authority.

**Gate disposition:** the zero-cost investigation and Decision Gate correction
are prepared; independent correction re-gate is pending. STOP. No code change,
retry, provider call or downstream work is authorized until the correction
passes and Guy explicitly approves the implementation package above.
