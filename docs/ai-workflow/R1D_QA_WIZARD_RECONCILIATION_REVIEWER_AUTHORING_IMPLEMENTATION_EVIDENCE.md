# R1D QA Wizard Reconciliation Reviewer Authoring — Implementation Evidence

**Date:** 2026-08-26
**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Base:** `d9eb74223f97232e5d78300a7e85c70d4437b5ee`
**Decision Gate:** `docs/ai-workflow/R1D_QA_WIZARD_RECONCILIATION_REVIEWER_AUTHORING_DECISION_GATE.md`
**External cost:** `$0`

## Outcome

The repository now has a general, immutable, provider-free operator for the
previously missing step between an empty `reconciliation_pending` QA Wizard
bridge and an exact reconciliation approval. It authors and exposes the review
content without granting approval, then separately records an exact later Guy
decision only after replaying every bound authority.

This milestone does not approve the current Chameleon Candidate and does not
make the Wizard render-ready by itself. A separate semantic audit proved that
the current Candidate has four meaningful defects hidden behind structurally
valid bytes. The reviewer-authoring infrastructure is complete; using it to
approve those bytes would be unsafe.

## Root cause addressed

The existing bridge could:

1. derive an empty pending reconciliation from a receipt-bound Candidate;
2. validate an externally supplied already-approved packet; and
3. advance a correctly attested approval downstream.

It could not author the 17 source-requirement decisions and 21 Presentation
Requirement dispositions, show all content to Guy, prove complete prospective
closure, or persist that content without conflating review preparation with
approval. Hand-editing approved JSON would have left an unaudited authority
gap.

## Implementation

### New general lifecycle

`lib/visual-package/reconciliationAuthoringLifecycle.ts` adds versioned types
and two public boundaries:

- `prepareQaWizardReviewedReconciliation`
- `recordQaWizardReviewedReconciliationApproval`

Preparation reloads and re-derives the exact pending bridge, Story Source
snapshot, Candidate, projected template and Candidate Action Semantic Coverage.
It accepts only exact reviewer decision keys and decision fields. Frame,
requirement, source text, page, pointer/value authority and review state remain
derived. It then emits content-addressed:

- reviewer plan;
- pending reconciliation;
- canonical reconciliation review JSON and Markdown;
- full content-review JSON and injection-safe Markdown; and
- one authoring manifest binding every digest and path.

The prepared reconciliation remains `pending`. A reserved timestamp is used
only on a transient in-memory copy to prove that the proposed content reaches a
complete zero-issue approved form. That prospective value is not persisted as
approval authority.

Approval requires exact `approvedBy: "Guy"` and a canonical UTC timestamp,
reloads the authoring manifest and all bound artifacts, rebuilds the exact
approved reconciliation/review/Markdown, revalidates the complete census, and
then uses the existing approval attestation format. Replay is byte-idempotent.

### Existing bridge hardening

`lib/visual-package/qaWizardCandidateBridge.ts` now:

- exposes the existing secure contained-artifact resolver for reuse rather
  than duplicating a weaker loader;
- centralizes exact reconciliation approval-attestation construction;
- validates approval review content against Candidate coverage rather than an
  embedded, self-declared coverage array;
- keeps attestation persistence private; and
- defines one shared prospective-validation timestamp that every validation,
  construction and recording route rejects as real approval time.

The shared timestamp rule includes the legacy public recorder and CLI. The
cross-route regression constructs a fully self-consistent approved packet at
the reserved timestamp and proves `write:true` cannot add an approval file.

### Filesystem and partial-write guarantees

All persisted reads use the secure resolver and reject traversal, moved
content-addressed artifacts, symlink/junction aliases and multi-link files.
Before any write, the lifecycle prepares every relevant output category and
checks immutable-byte compatibility. Hostile tests cover late collisions,
manifest/plan/content/Markdown tamper, hardlinks, writer junctions and approval
directory junctions. Rejection leaves both pending and approved inventories
unchanged.

### Reviewer visibility

The content review exposes each exact source requirement, visual beat, aspect,
contract citation, exact rebound value, disposition, justification and issue.
It separately enumerates every Candidate `non_visual` decision with page, beat
ID, source-evidence ID, exact source phrase, rationale and `reviewState`; a
count alone is not treated as review visibility. The list is derived from the
exact Candidate coverage in canonical order and is bound into both the content
digest and authoring manifest.
Markdown fences expand beyond the longest run of backticks in untrusted source,
description, ID, pointer, value, justification and diagnostic text, preventing
review structure injection.

### CLI

`scripts/qa-wizard-candidate-bridge.ts` adds strict commands:

- `prepare-reviewed-reconciliation`
- `approve-reviewed-reconciliation`

Both preserve the existing exact-key request parser. Preview and write results
state the local immutable-write intent and return explicit zero counters for
credential, provider, image, network, database and production boundaries.

## Changed code and tests

- `lib/visual-package/reconciliationAuthoringLifecycle.ts` — new general
  lifecycle.
- `lib/visual-package/qaWizardCandidateBridge.ts` — shared secure/approval
  primitives and Candidate-coverage authority.
- `lib/visual-package/index.ts` — public offline lifecycle export.
- `scripts/qa-wizard-candidate-bridge.ts` — strict CLI commands.
- `lib/visual-package/__tests__/qa-wizard-candidate-bridge.spec.ts` — positive,
  replay, CLI, malformed, stale, cross-frame, substitution, injection,
  collision, hardlink, junction, partial-write, `non_visual` visibility/tamper
  and cross-route regressions.
- `CURRENT.md` and this evidence document.

No Story Source, Candidate, Template, Action Semantic Coverage, prompt, model,
budget, policy, Board, Registry, Blueprint, Visual Package, locator, Wizard,
payment, renderer, provider or deployment code/data changed.

## Validation

Final code bytes:

- `npx --no-install vitest run lib/visual-package/__tests__/qa-wizard-candidate-bridge.spec.ts --pool=threads` — **13/13 PASS**.
- focused legacy reserved-timestamp cross-route — **1/1 PASS**.
- `npx --no-install vitest run lib/visual-package/__tests__/source-prompt-reconciliation.spec.ts --pool=threads` — **7/7 PASS**.
- `npx --no-install tsc --noEmit` — exit 0.
- `git diff --check` — exit 0.

Literal `npm run check`:

- both TypeScript phases pass;
- ordinary: 315 files, 293 pass, 17 skip, five unchanged fixture-reading files
  fail on nine absent gitignored-output assertions; 3,809 assertions pass and
  70 skip;
- resource-intensive: all 20 files and all 627 assertions pass;
- the resource process then reports the three known Vitest worker
  `onTaskUpdate` RPC timeouts;
- literal command exit is 1 and is not represented as a clean PASS.

Two internal read-only adversarial audit tracks were used during implementation.
The first found one MAJOR: the reserved prospective timestamp was still
reachable through the legacy approval recorder. The shared cross-route
correction above closed it. The final audit then found one MAJOR: the packet
showed only an aggregate `non_visual` count and hid each underlying unreviewed
classification. The per-record Candidate-bound JSON/Markdown list closed that
gap; a self-consistent redigested phrase tamper now fails before approval/write.
Both focused re-gates returned **0 BLOCKER / 0 MAJOR / 0 MINOR**. These are
internal audits, not Claude Code's independent technical PASS.

### Independent Claude Code QA

Claude Code 2.1.195 reviewed immutable range `d9eb7422..1e216bb5` in
read-only plan mode and returned **PASS — 0 BLOCKER / 0 MAJOR** for this
zero-spend operator. It independently traced all ten implementation claims and
re-falsified both corrected findings. It did not rerun TypeScript/Vitest because
plan mode withheld execution approval; the executed results above remain
Codex's evidence, while Claude's verdict is the required independent static and
adversarial review.

Claude recorded three non-blocking observations:

1. boundary counters are declarative, acceptable here because the module's
   import graph contains no provider/network/database capability;
2. the literal repository check remains honestly exit 1 at the documented
   fixture/RPC baseline; and
3. a hypothetically fully re-forged upstream Candidate-to-bridge chain could
   re-digest a changed coverage `sourcePhrase`, because the pre-existing
   Candidate boundary authenticates coverage by digest rather than re-deriving
   each phrase from Story Source text at this downstream stage.

Observation 3 is outside this operator's approval authority and does not change
the PASS. It is carried forward as a required hostile target for the separate
Candidate semantic-correction lifecycle: corrected coverage phrases must be
re-anchored to exact source-evidence authority.

## Current semantic HOLD

The immutable paid Candidate `be2d3202ef92b7d0d0e2d9647871bc590cb8ec9bf55465e450c9c8141e7bcbc9`
must not be approved or rendered yet. Offline evidence established:

1. cover visibility and lifecycle-derived no-spoiler clauses contradict each
   other for the lantern, cart and route labels;
2. p5 projection discards distinct spatial descriptions and emits generic
   same-kind labels;
3. the source-authoritative kindergarten guard is omitted from p7 because the
   closed human-role extraction domain lacks that reviewed role; and
4. p8 eye closing is falsely closed by an unrelated companion-satchel
   `mustShow`, because the repair boundary proves pointer identity but not typed
   semantic eligibility.

These facts require no new provider call. The next milestone is a general,
immutable `visual-contract-candidate-semantic-correction/v1` lifecycle bound to
the old Candidate, snapshot, request, receipt and replay. It must allow only
typed path-bounded corrections, fully rebuild and validate template/coverage,
reject unrelated drift/no-op/stale/cross-Candidate replay, reset reconciliation
to pending, and require exact Guy approval before bridge acceptance.

## Boundaries and next gate

No credential was read. No provider, image, audio, Vision, network consumer,
database, storage, Registry, Board mint, Wizard order/payment, render,
deployment or Production action occurred. No real reconciliation approval was
created. No current Chameleon authority artifact was mutated.

Binding order:

1. commit this focused zero-spend milestone;
2. independent Claude Code adversarial review of the immutable range;
3. implement and independently gate the separate offline Candidate semantic
   correction;
4. prepare the corrected content packet and obtain Guy's exact approval;
5. advance Boards, Blueprint, package and Preview qualification; and
6. only then run the already authorized one fake-paid LOW full Wizard book for
   Bar age 5 with mom narration.
