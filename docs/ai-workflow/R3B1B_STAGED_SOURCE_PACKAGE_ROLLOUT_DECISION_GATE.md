# R3-B1b Staged Source / Package Rollout — Decision Gate

Date: 2026-09-04

Product owner: Guy

Technical owner: Codex

Status: **RECEIPT QA PASS; P1 PREREQUISITE AUDIT QA PASS; P1-A1 LIVE
AUTHORING HOLD — NO CANDIDATE; STOP BEFORE RETRY OR DOWNSTREAM WORK**

Branch: `codex/r3b1b-accepted-intent-wave-2`

Planning base: `8d05973054c9ddda54241a2b51b75800f2fdea24`

## Approval record

Guy confirmed the six exact future revision digests for P2-P5/P7/P8 and
authorized their product-acceptance receipts. He also approved the sequencing
intent: restore P1 to 18/18 with an exact-source package first, then advance the
six stories one at a time without starting the next story before the published
source has a matching approved package. Guy explicitly withheld canonical
publication, rendering, narration, deployment, paid work and package
implementation in the current milestone.

Guy later granted the exact P1-A1-only Visual Contract authority: accepted
revision `64dcd0e...`, `gpt-5.6-sol`, at most seven standard calls plus one
cleanup, no fallback, zero transport retries and hard USD 10. The canonical
live process failed closed after two calls at conservative USD 0.668218 with no
candidate. That authority is consumed; it does not authorize a retry or any
downstream stage. Exact execution evidence is in
`docs/ai-workflow/R3B1B_P1_A1_VISUAL_CONTRACT_AUTHORING_EXECUTION_EVIDENCE.md`.

## 1. Proposed change

Use one fail-closed staged rollout rather than bulk source publication:

1. independently QA the six receipt-only artifacts created under the current
   approval;
2. open a separate P1 package milestone bound to accepted revision
   `64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc`;
3. qualify and approve the exact P1 package before changing any other source;
4. re-establish and prove 18/18 Wizard sellability;
5. then advance P2, P3, P4, P5, P7 and P8 one story at a time;
6. for each story, keep source publication and its matching package inside one
   bounded milestone and do not begin the next story until the final readiness
   audit proves the current story sellable and package-qualified.

This document prepares that route. It does not execute it.

## 2. Why now?

P1's corrected Story Source / Visual Direction authority is already published,
but its prior package cannot qualify against the new source identity. The
current deterministic blocker is
`package_bound_visual_contract_template_unavailable`, and Wizard sellability
is therefore 17/18.

The other six accepted-intent sources now have exact Guy confirmations but are
not published. Publishing all six before matching packages exist is expected
to reduce sellability to 11/18. The staged route restores the existing deficit
first and bounds future temporary exposure to one story under active work.

## 3. Observed behavior and root cause

The separation is deliberate lifecycle safety:

- a product-acceptance receipt confirms source and Visual Direction bytes but
  does not create accepted source authority;
- canonical source publication creates accepted authoring authority but still
  does not grant render qualification;
- a qualified package must bind the exact source snapshot, approved Blueprint,
  authoring provenance, planning approval, style authority, Visual Contract,
  reconciliation, cover authority where applicable, Boards, prop references,
  package review and Guy package approval;
- the current package locator may select only an approved, exact-source package.

P1 is unavailable because its new source exists without that matching package,
not because a feature flag or fallback is missing. Reusing a legacy package or
weakening source matching would hide stale visual authority and is forbidden.

## 4. Scope

Current receipt milestone:

- six correction product-acceptance v2 receipts only;
- one rollout Decision Gate, evidence and canonical state updates;
- provider-free validation and independent QA handoff.

Proposed later rollout milestones:

- P1 exact-source package recovery;
- then P2, P3, P4, P5, P7 and P8 as six separate source/package milestones.

P6, all HOLD/D records, narration human-ear acceptance, image generation,
Reader changes, payments, orders, deployment and release are outside this gate.

## 5. Risk of hardcoding and rejected alternatives

Story keys define the approved rollout inventory and order; they must not become
runtime conditionals. Every story uses the same correction acceptance,
publication, package-v5 qualification and current-locator contracts.

Rejected:

- bulk-publishing six sources, because it knowingly creates a projected 11/18
  catalog before packages exist;
- advancing the next story while the current story is unavailable, because it
  compounds product exposure and weakens diagnosis;
- copying or repointing an old package, because source, Blueprint, template,
  reconciliation, Board and prop identities must all match current bytes;
- enabling a fallback or waiver, because render qualification intentionally
  fails closed;
- treating package approval as render approval, because paid image work and
  visual output review are separate gates;
- preparing all live packages concurrently, because provider budgets, artifact
  dependencies and human review remain per-story decisions.

## 6. Milestone design

### Stage A — P1 exact-source package recovery

1. Perform a zero-cost prerequisite inventory for the exact P1 source: page
   count, world mode, style authority, Blueprint state, Visual Contract,
   reconciliation, required sets/Boards, props and cover authority.
2. Return a concrete authoring plan, missing-artifact list, provider/image-call
   budget and rollback boundary to Guy.
3. Only after a new explicit GO, create the package candidate through the
   general v5 lifecycle. No legacy-source substitution is allowed.
4. Obtain Claude Code technical PASS, Guy's exact Blueprint/package approvals,
   promote the immutable package and current locator, and prove 18/18.
5. Do not render a page or book merely to create package authority. Any Board,
   prop or LOW visual audition requiring image generation receives a separate
   quantity and cost gate.

### Stage B — six one-story source/package milestones

For P2, P3, P4, P5, P7 and P8 in that order unless a later deterministic
preflight proves an earlier record blocked:

1. inspect the exact receipt/revision/review identities;
2. run a zero-cost source/package prerequisite preflight and obtain the exact
   package budget/approval;
3. stage the source publication bundle under ignored outputs and prove replay;
4. publish only the one authorized source and build its exact-source package
   within the same bounded branch milestone;
5. do not push or advance while the story is source-published but lacks a
   qualified approved package;
6. independently QA the combined source/package range;
7. prove the catalog remains 18/18 at the milestone head before starting the
   next story.

If a package cannot be completed, stop on that story. Do not publish the next
source and do not enable fallback behavior.

## 7. Expected behavior and acceptance criteria

- P1 becomes package-qualified against revision `64dcd0e...` and the catalog
  returns to 18/18 before P2 begins.
- At every later pushed milestone head, all previously advanced stories have an
  exact accepted source and an approved current package bound to it.
- No reviewed head intentionally leaves more than the currently active story
  unavailable because of this rollout.
- Source/package identities, page coverage, world mode, Boards, props,
  reconciliation, Blueprint and package approvals are digest-bound and current.
- Render qualification remains a prerequisite, not permission to call an image
  provider.
- The resemblance threshold remains 0.70.

## 8. Validation plan

Current receipt milestone:

1. recompute all six receipt digests and canonical bytes;
2. require filename/digest and one-to-one revision/review identity;
3. run two publication-candidate dry-runs per record with no write and compare
   manifest digests;
4. prove no accepted revision or output root was created;
5. run the two focused correction lifecycle specs, both TypeScript checks,
   readiness audit and Git hygiene.

Each future source/package milestone:

1. inspect the pre-state and package prerequisites;
2. test wrong/stale/cross-story source and artifact substitutions;
3. prove candidate replay, offline qualification and immutable promotion;
4. prove complete cover/page, Board and prop coverage;
5. prove source publication plus package changes only the intended story;
6. run the relevant package-v5, loader, matrix, readiness and release-adjacent
   tests plus `npx tsc --noEmit` and `npm run check` with truthful disclosure;
7. obtain independent Claude Code PASS on an immutable exact range;
8. obtain Guy's required product/visual approvals before promotion.

No full-book render is part of these validation steps.

## 9. Cost impact

Current receipt and planning milestone: provider/network/image/audio/PDF calls
0; database/storage/order/payment/deployment writes 0; maximum spend USD 0.

The zero-cost prerequisite audit now establishes two independently enforced
text-authoring budgets:

- P1-A1 Visual Contract: OpenAI Responses / `gpt-5.6-sol`, at most seven
  standard calls plus one bounded cleanup, projected maximum USD 7.656, hard
  ceiling USD 10;
- P1-A2 Blueprint, only after Guy accepts the Visual Contract: the same
  provider/model, at most three generation calls plus two count probes,
  projected maximum USD 4.928, hard ceiling USD 5.

Their projected maxima sum to USD 12.584 and their independent hard ceilings
sum to USD 15, but no combined uninterrupted authority is proposed. P1-A1 must
stop for Claude Code and Guy review before P1-A2.

The exact Board/prop image count is structurally unavailable until the accepted
Visual Contract and Blueprint classify the six source setting families and
recurring cake/cart objects. The current exact-source reusable inventory is
zero Boards and zero prop references. The repository also has no configured
contractual `gpt-image-2` price ceiling. A separate zero-cost post-Blueprint
census must therefore return the exact image-call count and current price
authority before any LOW image is authorized. HIGH and full-book work remain
separately gated.

## 10. Rollback and interruption safety

- Current receipts can be reverted before publication; they do not affect
  runtime selection.
- A package candidate remains non-authoritative until exact approval and
  promotion.
- Never mutate or delete an accepted revision to disguise a failed package
  attempt.
- If a one-story milestone fails after local source publication, keep the branch
  unpushed, preserve evidence, and either finish the matching package or revert
  the unpublished focused commit after a containment audit.
- After a canonical revision has been shared or referenced, recovery is
  additive; never rewrite its bytes.

## 11. Review assignment and unresolved decisions

Claude Code reviewed exact receipt range `8d059730..1aa1b687` read-only and
returned PASS with no P0/P1/P2. It falsified no receipt identity, canonical
digest, exclusion, dry-run result, zero-effect claim or publication boundary.

The completed audit is recorded in
`docs/ai-workflow/R3B1B_P1_EXACT_SOURCE_PACKAGE_PREREQUISITE_AUDIT.md`.
It proved that the canonical authoring path is the accepted revision's
`integrated.md`, produced source snapshot digest `8de91442...`, and passed the
provider-unreachable preflight with zero attempts, writes or provider calls.
Claude Code independently reviewed exact range `4d7348f2..1fa48fb2` and
returned PASS with no P0/P1/P2. It reproduced the source/loader facts, both
budget calculations, absent authority inventory, setting/anchor counts,
resemblance authority, real 17/18 readiness, test results and documentation-only
scope. Guy later supplied P1-A1 approval; the bounded execution failed closed
without a candidate and now requires independent QA.

The execution receipt is `e60f689f...`, readiness is `45d79882...` and the
captured-response replay is `c8e6fee7...`. Claude Code must verify exact source
identity, two calls/two dispatches/zero retries, conservative USD 0.668218,
the three page-10 cardinality diagnostics, no candidate/output authority and
the claimed general recovery-path gap. It must not infer authority for a code
fix or another provider attempt.

Before P1 package implementation Guy must separately approve:

- the exact prerequisite/authoring plan;
- any provider and image-call counts plus maximum cost;
- the proposed Blueprint/Visual Contract and required Board/prop strategy;
- package approval and locator promotion after technical review.

Claude Cowork remains required only for P6 or a later material creative-text
decision. Guy should eyeball each Blueprint/Visual Contract review packet and
any separately approved LOW sample before wider visual work.

## 12. Do not do

Do not publish any of P2-P5/P7/P8, create or promote a package, update a package
locator, make another provider call, render, narrate, deploy, change Wizard
flags, enable a fallback, alter the 0.70 threshold, or spend more money under
this gate.

## Stop-check

1. General solution? Existing generic correction and package-v5 lifecycles;
   story keys are inputs, not runtime branches.
2. Cross-story risk? High if publication is bulk; bounded to one story and one
   exact source/package identity per milestone.
3. Production behavior? None; P1 remains contained at 17/18 and no package or
   locator authority changed.
4. Spend? P1-A1 consumed conservative USD 0.668218 of its bounded execution;
   further spend requires a new explicit GO.
5. Smallest safe proof? Preserve and replay the exact failed responses, then
   gate a general zero-cost recovery correction; no image or full book.
6. Guy decisions? The original P1-A1 GO is resolved and consumed. A general
   recovery implementation and any new live attempt remain open.
7. Claude targets? Exact live identities/cost/calls, replay congruence, the
   recovery-path claim, no candidate and no downstream authority.
8. Cowork? P6 only, unless material new creative prose is proposed.
9. Guy eyeball? There is no P1 candidate to review. Guy reviews a future
   Visual Contract only after a separately approved successful attempt.

**Gate disposition:** receipt-only work is independently passed and pushed.
The staged route records Guy's sequencing intent and the zero-cost P1
prerequisite audit is complete. Guy granted P1-A1, but the bounded execution
failed closed after two calls and produced no candidate. The next proposed
authority is a zero-cost general recovery-path correction Decision Gate. STOP
before implementation or any new provider attempt. Blueprint, images, package
work and publication remain unauthorized.
