# R1D Compiler-Owned Missing Action Binding and Bounded Correction — Decision Gate

**Date:** 2026-08-19

**Status:** approved under Guy's explicit instruction to diagnose with Claude,
implement the smallest general correction, run independent QA, and continue
toward the Wizard/render only after every authority gate passes

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`

**Exact base:** `5d7a818e4ae7bf715bd2c83046a1249569404392`

## 1. Proposed change

Extend the existing compiler-owned action-binding normalization with a second,
strictly mechanical case: one valid same-page `source_phenomenon` action has a
valid page-scoped beat and a canonical same-page Source Evidence ID, but no
coverage record of any disposition uses that beat. The compiler appends the
single fully determined `action_requirement` coverage record before assembly.

Also bound both existing PageContract correction cases. A first atomic scope
rejection may retain the existing closed correction hint, and a first
incomplete patch set may reuse the same closed authority. A second rejection
of either kind is terminal through the existing sanitized
`repair_output_invalid` evidence and cannot consume another logical call.

## 2. Why now?

The consumed canonical eight-page live attempt under
`outputs/r1d-collect-all-eight-page-readiness-5d7a818e-20260818T201855197Z`
completed seven provider calls with no transport retry or fallback and produced
no Candidate. Attempts 1 through 6 each carried the exact same complete,
normalized 27-issue census and the same issue fingerprint. Four pages each had
both `action_coverage_cardinality_invalid` and `action_binding_missing`; the
affected actions are `source_phenomenon` actions whose beat and same-page Source
Evidence identity already exist. The seventh PageContract response was
atomically rejected as
`page_contract_repair_action_binding_scope_invalid`.

The PageContract applier intentionally requires equal coverage cardinality and
therefore cannot insert the missing record. Repeating the same provider route
cannot manufacture additional compiler authority; it only spends another
reserved call against an unchanged draft.

## 3. Scope

This is a general compiler correction, not a story, page, language, child or
companion patch. Expected production files are limited to the existing
action-binding normalizer and the compile loop. Focused tests, this Decision
Gate, implementation evidence and `CURRENT.md` are included.

No prompt, provider schema, Story Source, model, tier, reasoning, token budget,
call budget, retry, fallback, Candidate, Wizard, Reader, image-generation or
render contract changes.

## 4. Exact eligibility and mutation authority

The missing-binding normalization is eligible only when all of these are true:

1. the page number is a unique positive safe integer;
2. `actionRequirements` and `actionSemanticCoverage` are arrays;
3. exactly one action owns the valid `beat:p{page}:...` beat;
4. zero existing coverage records of any disposition use that beat;
5. the action has the exact strict draft-action keys;
6. its subject is exactly `{ kind: "source_phenomenon", sourceEvidenceId }`;
7. the Source Evidence ID resolves canonically on that same page.

The normalizer clones input, changes no action or existing coverage byte, and
appends only:

```json
{
  "beatId": "<existing exact beat>",
  "sourceEvidenceId": "<resolved exact same-page ID>",
  "disposition": { "kind": "action_requirement" }
}
```

Eligible bindings use deterministic page/action order. The postcondition proves
the exact append-only diff, unique 1:1 binding and idempotence. Ambiguous,
duplicate, malformed, non-source, wrong-page, noncanonical or already-covered
cases remain byte-identical for existing fail-closed validation.

## 5. Expected behavior

The four live-shaped missing bindings close locally before the first assembly
and consume no provider call or repair slot. The remaining genuine complete
census is routed by the existing collect-all scheduler, including the proven
BookSurface route where eligible. Full source grounding, action-semantic,
structural, reference, presentation, lifecycle and final Candidate validation
remain mandatory.

The existing one closed PageContract correction hint remains available for an
otherwise repairable first response. A repeated scope violation or incomplete
patch set becomes the existing terminal repair-output failure; no raw response,
prompt, authored ID, exception or secret enters evidence.

## 6. Rejected alternatives

- Do not widen PageContract to insert/remove arbitrary coverage rows.
- Do not add a provider route for a record whose every value is already owned
  by the compiler.
- Do not mislabel an equal census as `draft_validation_repair_regressed`; that
  terminal truthfully means the complete unique count increased.
- Do not add another call, retry, fallback, model, budget or cost allowance.
- Do not hardcode the observed story, page numbers, beats or Source Evidence
  IDs.

## 7. Validation plan

Zero-cost validation must prove:

- pure success for one and four missing bindings, exact append-only diff,
  deterministic order, input non-mutation and idempotence;
- negatives for duplicate action ownership, any existing same-beat coverage,
  malformed/extra action or subject keys, malformed/wrong-page/unknown Source
  Evidence, invalid beat/page and duplicate page authority;
- duplicate-component normalization remains unchanged and composes safely with
  missing-binding normalization;
- compiler and lifecycle close the live-shaped missing bindings before repair,
  preserve exact action/coverage authority and expose the remaining complete
  census to the existing route;
- offline harness reports no positive complete delta for the replay;
- one PageContract scope/incomplete-set correction remains possible, while a
  second rejection of the same class terminates before an additional dispatch;
- relevant tests, `npx tsc --noEmit`, one literal `npm run check`, and
  `git diff --check` pass proportionately before independent Claude Code QA.

## 8. Cost and version impact

Implementation and validation cost `$0`. The change is expected to remove
provider calls rather than add them. The missing-binding evidence uses a new
internal normalization version independent of the existing duplicate-component
generated-ID version. No persisted schema or prompt changes, so no authoring,
materialization, Supervisor, Fresh, Candidate or Wizard version cascade is
expected. Independent QA must falsify that conclusion.

## 9. Rollback

Revert the focused code/test/documentation commits. Historical canonical
artifacts remain immutable. Any Fresh evidence produced from a later head is
inapplicable after rollback. No database, package, lockfile or external-state
rollback is required.

## 10. Review and stop-check

Claude Code must attack eligibility, exact diff, canonical Source Evidence
resolution, composition with duplicate components, order/idempotence, repeated
scope rejection, provider-call count, version scope and absence of prompt/raw
data drift. Guy will eyeball only a later LOW rendered proof after a real
Candidate passes Wizard reconciliation.

Stop-check answers: this is a general production compiler fix; cross-story risk
is bounded by exact structural eligibility and full validation; the milestone
spends no provider/image money; the smallest proof is offline; no creative or
product decision is introduced; no live/render action occurs before independent
technical PASS.

## 11. Do not do

- Do not reuse the consumed execution request or live output root.
- Do not access credentials, provider, Fresh, live, Vision or render during the
  implementation/QA milestone.
- Do not change policy v17, output budget v6, model/tier/reasoning, pricing,
  timeout, transport retry, fallback or the seven-call schedule.
- Do not change Story Source, prompt/schema, BookSurface, Candidate, Wizard,
  Reader, production, storage/database or deployment behavior.
- Do not mint, approve or render without a new current-head canonical Candidate.
