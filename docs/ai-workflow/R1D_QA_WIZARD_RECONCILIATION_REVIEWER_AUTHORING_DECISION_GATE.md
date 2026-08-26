# R1D QA Wizard Reconciliation Reviewer Authoring — Decision Gate

**Date:** 2026-08-26
**Owner:** Codex (technical), Guy (exact content approval)
**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Cost allowance:** `$0`; no provider, image, audio, Board, render, deployment, database, Registry, or storage call

## 1. Proposed change

Add a general, provider-free QA Wizard reconciliation reviewer-authoring boundary. It will:

1. load and fully replay one exact `reconciliation_pending` QA Wizard bridge manifest;
2. accept a versioned reviewer decision plan bound to that bridge, source snapshot, Candidate, template, Action Semantic Coverage, and canonical empty reconciliation;
3. allow only exact `visualBeats` and Presentation Requirement disposition content to be supplied while every identity, source text, frame, template, coverage, and review-state field remains compiler-owned;
4. validate the completed pending artifact against the Candidate's exact coverage;
5. apply a non-persisted prospective Guy approval in memory and require a zero-issue complete census;
6. persist immutable pending reconciliation/review artifacts plus a full content-review packet that exposes every beat, aspect, citation, and disposition;
7. after Guy approves the exact digests, replay the authoring manifest, apply the real `Guy` approval timestamp, require zero issues again, and emit the existing bridge approval authority without changing downstream `advance` semantics.

## 2. Why now?

The revised Chameleon paid authoring run already produced valid Candidate `be2d3202…bcbc9`, and the Set Board admission blocker is closed. The current bridge is stopped because its canonical draft is intentionally empty:

- 9 frames;
- 17 exact source requirements;
- 21 Presentation Requirements;
- 0 visual beats;
- 0 dispositions;
- 39 complete-validation blockers (17 source requirements + 21 Presentation Requirements + overall review).

The bridge currently jumps from “create an empty pending draft” to “verify already-approved external JSON.” It has no safe operator for authoring, displaying, binding, or approving the missing review content. That is the actual deterministic blocker before Blueprint and Wizard readiness.

## 3. Scope

- **General system change:** yes; no story key, child, companion, page number, Set, or prop constant.
- **Story-specific data:** one separate reviewer decision plan for the current Chameleon Candidate, created only after the general operator is green.
- **One-off debug/test:** no.

## 4. Risk of hardcoding

The operator is keyed only by exact bridge/source/Candidate identities and generic frame/requirement identities. It rejects missing, duplicate, orphan, cross-page, stale, or extra decisions. The Chameleon plan is data and never enters production code.

## 5. Files likely affected

- `lib/visual-package/reconciliationAuthoringLifecycle.ts` (new)
- `lib/visual-package/index.ts`
- `scripts/qa-wizard-candidate-bridge.ts`
- `lib/visual-package/qaWizardCandidateBridge.ts` only for the existing Candidate-coverage approval gap if the new boundary cannot wholly contain it
- `lib/visual-package/__tests__/reconciliation-authoring-lifecycle.spec.ts` (new)
- ordinary test workload classifier/count if required by the new spec
- `CURRENT.md`
- focused implementation evidence under `docs/ai-workflow/`

No validator rule, Candidate byte, story source, prompt, authoring policy, budget, model, Board, Blueprint, package, locator, Wizard UI, payment, render, or deployment file changes in this milestone.

## 6. Expected behavior after change

A reviewer can prepare a complete pending reconciliation without hand-editing an approved artifact. The system proves that the proposed content is complete under a hypothetical exact approval, but persists no approval. Guy receives a full, human-readable packet and exact digests. Only Guy's later exact approval can create approved reconciliation authority. Any source/Candidate/template/coverage drift, hidden content, or partial decision fails before a write.

For the current Candidate, the plan must preserve supported source meaning and expose real omissions explicitly. It must not silently classify all 21 Presentation Requirements as preserved. At minimum, the unsupported repeated-hedge ringing and eye-closing moments require explicit reviewer dispositions; unsupported historical-direction clauses remain explicit decisions rather than validator exploits.

## 7. Validation plan

Smallest proof, all offline:

1. pure positive lifecycle test on a materially different synthetic story;
2. hostile exact-key, identity, source/frame topology, Candidate/template/coverage replay, pointer/value, cross-page, direction-authority, disposition, embedded-coverage substitution, approval-state, immutable replay, and partial-write tests;
3. CLI preview/write/replay tests proving zero provider/credential/image/network/database/production authority;
4. current real Candidate preview producing `contentReadyForGuyReview=true` only when prospective complete validation returns zero issues;
5. focused suites, `npx tsc --noEmit`, `git diff --check`, and literal `npm run check` with honest classification of known repository baseline failures;
6. independent Claude Code adversarial review before any exact Guy approval or downstream action.

No image or book render is needed to prove this milestone.

## 8. Cost impact

`$0`. No provider/model call, no image/audio generation, no Vision, no network consumer, no database/storage/Registry write, and no render. Only content-addressed local artifacts under the approved QA output root may be written.

## 9. Rollback plan

Revert the focused code/doc commit. Generated review artifacts are immutable and non-authoritative; without Guy approval and an approval attestation they cannot advance. Existing bridge manifests, Candidate, source snapshot, Boards, packages, locators, and runtime behavior remain unchanged.

## 10. Review assignment

- **Guy before implementation:** standing authorization already grants offline general corrections needed to make the Wizard operational; no new product choice is required for the operator itself.
- **Guy after artifact preparation:** review and approve or reject the exact current-story reconciliation and full content-review packet digests, including each explicit omission/supersession.
- **Claude Code:** falsify authority isolation, exact binding, reviewer visibility, coverage substitution, partial writes, replay/idempotence, and whether prospective validation can be confused with approval.
- **Claude Cowork:** optional for story/creative judgement only; not needed for this technical boundary.

## 11. Stop-check answers

1. **General or story-specific?** General operator; current story plan remains separate data.
2. **Could it break another story/child/companion/style?** Only if shared bridge validation or approval semantics drift; hostile generic fixtures and unchanged downstream advance tests cover this.
3. **Production behavior?** No runtime/render behavior changes. It adds an offline authority-preparation route used before Blueprint promotion.
4. **Spend money?** No.
5. **Smallest safe validation?** Synthetic lifecycle + hostile tests + one real Candidate offline preview.
6. **What must Guy decide now?** Nothing further for implementation; exact content approval remains withheld.
7. **What should Claude Code falsify?** Bindings, visibility, approval separation, replay, no partial writes, no hidden coverage substitution.
8. **Claude Cowork?** Not for the operator; may advise on the resulting story review if Guy requests.
9. **What should Guy eyeball?** The full current-story content-review packet, every supersession, then later the already-authorized LOW rendered book.

## 12. Rejected alternatives

- **Auto-mark every source as preserved:** rejected; it would exploit citation-shape validation and erase independent semantic review.
- **Reuse the old approved Chameleon reconciliation:** rejected; it describes the obsolete walking-bus-stop story and different template/coverage identities.
- **Reuse time/source migration lifecycles:** rejected; they require an already-complete reviewed reconciliation and invariant topology/evidence maps that do not exist across this creative replacement.
- **Hand-edit approved JSON then call the current recorder:** rejected; it leaves an unaudited content-authoring gap and the current recorder validates embedded rather than Candidate coverage.
- **Change the Candidate or rerun paid authoring:** rejected; the discovered omissions are bounded review decisions, not a reason for another provider call.

## 13. Acceptance criteria

- one writer and clean focused diff;
- exact pending bridge replay before decisions are accepted;
- exact decision-plan key set and immutable compiler-owned fields;
- complete full-fidelity review packet;
- Candidate coverage, never self-declared embedded coverage, is validation authority;
- prospective approved form validates with zero issues while persisted form remains exact pending;
- no approval artifact before Guy's exact decision;
- approval replay is exact, idempotent, and zero-issue;
- existing downstream advance API and all unrelated authority remain unchanged;
- focused tests/TypeScript green and independent Claude Code PASS before use on the real downstream lifecycle.

## 14. Explicitly forbidden in this milestone

No provider/live authoring, credential read, image/audio/Vision, Board mint, Registry/storage/database access, Blueprint/package publication, locator update, Wizard order/payment, render, deployment, Production action, Candidate mutation, source mutation, budget/model/policy change, automatic content approval, or Git push.
