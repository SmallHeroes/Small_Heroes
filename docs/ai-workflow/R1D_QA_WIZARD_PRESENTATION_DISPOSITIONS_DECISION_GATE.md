# R1D QA Wizard Presentation Dispositions — Decision Gate

**Date:** 2026-08-20
**Product owner:** Guy
**Technical owner:** Codex
**Independent QA:** Claude Code
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Base:** `6c9127d9f02d7eb79d8e41d6430adb2f25963bee`

## 1. Proposed change

Add a versioned, reviewer-bound disposition block to Source Prompt Reconciliation so an independent human reviewer can:

- rebind a mis-associated Presentation Requirement to exact same-page visual evidence; or
- explicitly supersede a Presentation Requirement whose visual meaning is genuinely absent.

The current compiler-authored Presentation Requirement remains immutable. A disposition is separate review evidence and never rewrites the Candidate or Action Semantic Coverage.

## 2. Why now?

The first new-story Candidate reached the QA Wizard bridge successfully, but semantic inspection found ten Presentation Requirements whose compiler-selected evidence does not preserve their source phrase:

- three have correct alternate `mustShow` evidence;
- two have correct alternate `propState[*].state` evidence;
- five have no honest template evidence.

The current gate requires the original pointer/value and offers no honest reviewer correction. A content-only reconciliation therefore cannot complete without falsely certifying mismatched evidence. A new paid authoring run would not fix the general gate defect and is not justified.

## 3. Scope

General system change limited to the reconciliation, review, and QA Wizard bridge layers.

It is not Chameleon-specific and contains no story, page, beat, phrase, character, companion, or object literal from the observed artifact.

## 4. Risk of hardcoding

The implementation is driven only by existing Presentation Requirement identities and exact bound template evidence. Rebinds are confined to the requirement's page and a closed pointer domain. Supersessions require explicit Guy review. No story-specific mapping is embedded in production code or tests.

## 5. Files likely affected

- `lib/visual-package/types.ts`
- `lib/visual-package/sourcePromptReconciliation.ts`
- `lib/visual-package/reconciliationLifecycle.ts`
- `lib/visual-package/qaWizardCandidateBridge.ts`
- focused reconciliation/bridge tests
- `CURRENT.md`
- implementation evidence for independent QA

No Candidate, authoring, prompt, model, budget, provider, render, reader, payment, or database module is in scope.

## 6. Expected behavior after change

- Existing candidate-authored Presentation Requirements remain byte-bound and immutable.
- A `rebound` disposition matches exactly one requirement by `{pageNumber, beatId, sourceEvidenceId}` and cites a different exact same-page pointer/value.
- Reviewer rebind pointers are limited to `mustShow/{index}` or `propState/{index}/state`; `actionRequirements`, other pages, globals, and arbitrary fields remain forbidden.
- A `superseded` disposition has no rebound evidence and carries a non-empty justification.
- Every disposition review must match the reconciliation's exact review state. Final approval requires `Guy` and one valid ISO timestamp.
- A Presentation Requirement is complete only through its original evidence, an approved cited rebind, or an approved explicit supersession.
- The review JSON and Markdown prominently enumerate every rebind and supersession, including source phrase, original evidence, replacement evidence, justification, and review state.
- Pending artifacts cannot advance. Existing manifests and reconciliation artifacts remain immutable/read-only.

## 7. Validation plan

Smallest proof:

1. unit round-trip for an original mapping, `mustShow` rebind, `propState.state` rebind, and explicit supersession;
2. negative matrix for orphan/duplicate identities, cross-page and forbidden pointers, stale values, identical rebinds, uncited rebinds, malformed/extraneous keys, empty justification, mixed rebound/supersession data, reviewer mismatch, and non-Guy final approval;
3. review JSON/Markdown snapshot assertions proving all decisions are visible;
4. QA Wizard prepare → approve → advance positive path with the current versions;
5. immutable read-only replay for bridge manifest v3/v2/v1 and reconciliation v2;
6. `npx tsc --noEmit`, focused Vitest suites, `npm run check`, and `git diff --check`.

No image generation or full-book render is needed to prove this change.

## 8. Cost impact

Zero provider/image/audio/API spend. No network, database, publication, or production mutation.

After implementation and Claude PASS, the existing Candidate can be re-attested at the new clean pushed consumer HEAD. No new paid authoring is planned.

## 9. Rollback plan

Revert the focused implementation commit. Existing content-addressed Candidate, Supervisor, reconciliation-v2, review-v2, and bridge-manifest-v3 artifacts remain unchanged and replayable read-only. No migration mutates persisted files.

## 10. Review assignment

Guy retains the product decision on whether the five genuinely unsupported moments may be superseded. The implementation does not make that decision and cannot approve it automatically.

Claude Code must try to falsify:

- cross-story/page replay;
- orphan and duplicate dispositions;
- stale or forged pointer/value pairs;
- widened pointer authority beyond same-page `mustShow` and `propState.state`;
- a rebind not cited by preserved story-prose evidence;
- hidden or omitted disposition details in review Markdown;
- a machine-authored or non-Guy approval path;
- legacy artifact mutation or reinterpretation;
- Candidate, authoring, prompt, budget, render, and production drift.

Claude Code has already issued read-only PASS for implementing the bounded design. Claude Cowork is not required for the engineering change; Guy will inspect the story-specific disposition proposal before any approval.

## 11. Do not do

- Do not modify or replace the Candidate.
- Do not mutate existing content-addressed artifacts.
- Do not authorize a rebind outside the same page or closed pointer domain.
- Do not silently omit a Presentation Requirement.
- Do not infer or forge Guy approval.
- Do not run provider, Fresh, live authoring, image generation, render, publication, deployment, or production writes.
- Do not change model, prompts, call count, budgets, policy, or cost ceilings.

## Stop-check result

1. General system fix: **yes**.
2. Cross-story risk: bounded by exact identity, same-page pointer rules, legacy tests, and immutable evidence.
3. Production behavior: only reconciliation approval eligibility; downstream authority remains unchanged and fail-closed.
4. Spend: **none**.
5. Smallest validation: offline unit/integration and immutable artifact replay.
6. Guy decision before final approval: whether to accept each proposed supersession.
7. Claude falsification targets: listed above.
8. Claude Cowork: optional for later creative review, not needed to implement the control.
9. Guy eyeball: regenerated review Markdown listing every rebound and supersession before approval.
