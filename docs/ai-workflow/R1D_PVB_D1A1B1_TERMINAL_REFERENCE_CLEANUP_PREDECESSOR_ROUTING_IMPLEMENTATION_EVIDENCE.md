# R1D-PVB-D1A1B1 Terminal Reference Cleanup Predecessor Routing — Implementation Evidence

## Status

Implemented locally. Claude Code independently returned technical PASS for the
exact implementation-and-documentation range. Codex does not self-award that
result.

- Branch: `codex/r1d-terminal-reference-cleanup-predecessor-routing`
- Worktree: `C:\Users\guyna\.codex\worktrees\cleanupbudget1\Small_Heroes`
- Exact base: `f76b161f030738ce6b19e5734864be55667fe144`
- Code commit: `ecf7034abd90f8777e3b4fe79b58ec08944a9ccb`
- Implementation/validation cost: `$0`
- Push/deployment: none

## Consumed attempt evidence

The immutable second attempt remains failed and is evidence only:

- output root:
  `outputs/r1d-terminal-reference-cleanup-attempt-2b-fresh-readiness-f76b161f-20260815T195006676Z`;
- Fresh Readiness v17 digest:
  `0cdf1ecf42bcfde813b6ee23410913d2a535c540c795c1a42a47e053c2ec0032`;
- Execution Request digest:
  `b5c2f57ece8e56aecaa46701adacb9b66fee02f8b01b70c69919908c2f2a3e23`;
- authoring receipt v23 digest:
  `41389f20a0b9672dc5108489d4b43bf6689c34195b9dc4aa7ac38b4e2f740e36`;
- readiness v21 digest:
  `86b2eeb50d3aa287394b2878e0b4cfbeb0d9b263f6b5b28aa4de6fd067e5c53d`;
- logical calls/repairs/transport retries/fallback: `3/2/0/false`;
- usage input/cache-write/cached/output/reasoning/total:
  `31,785/30,991/0/29,418/3,991/61,203`;
- nominal/conservative accounting: `$1.080204/$1.189317`.

Attempt 1 had two unique page-action out-of-scope references. The compact
page-spatial repair resolved them. Attempt 2 then exposed nineteen current
issues: six action-semantic capability gaps, one cover final-structure issue
and twelve page final-structure issues. Attempt 3 used `book_surface_patch`,
resolved those nineteen and introduced exactly two new, non-empty
`draft_contract/out_of_scope_reference` page-action issues:

- page 7, item 0, `fieldRole: reference`;
- page 1, item 1, `fieldRole: reference`.

The receipt ended `draft_validation_repair_exhausted` because policy v3 allowed
terminal cleanup only when the preceding repair mode was `full_draft`. No
candidate, Semantic Reconciliation, Blueprint, Wizard or render authority was
created. No historical artifact was edited, recomputed or reclassified.

## Root cause

The predecessor rule encoded one repair implementation rather than the actual
mutation boundary. `book_surface_patch` replaces the complete cover and the
complete affected page-contract set. It can therefore introduce the same
strictly reference-only page-action residual as `full_draft`. The compiler's
current-residual detector and the compact patch schema were already sufficient;
only predecessor recognition and its persisted authority bindings were
incomplete.

This is general. Production routing does not inspect a story, companion, page
number, prose phrase, authored identifier or provider message.

## Implemented contract

The exact eligible predecessor catalog is now:

```text
book_surface_patch
full_draft
```

It is canonical, ordered, duplicate-free and closed. Both compiler routing and
receipt/readiness sequence validation use the same policy predicate. Terminal
cleanup still additionally requires:

- attempt 3 has completed and used an eligible predecessor;
- the current issue set is non-empty;
- every current issue is the existing compiler-typed page-action
  `draft_contract/out_of_scope_reference` class;
- exact compiler-owned permitted spatial IDs exist for every target;
- the fourth call uses the existing strict
  `page_spatial_reference_patch` schema and `terminal_reference_cleanup`
  budget class.

All other predecessors, empty/mixed/non-reference residuals, missing authority,
malformed patches, duplicates, unexpected targets, non-target mutation and any
fifth call remain fail-closed.

## Budget and unchanged behavior

No budget or provider policy changed:

- standard calls/repairs: `3/2`;
- optional terminal cleanup calls/repairs: `1/1`;
- standard input ceiling: `64,000` tokens;
- terminal cleanup input/output ceilings: `6,000/2,000` tokens;
- projected conservative maximum/hard ceiling: `$4.99125/$5.00`;
- model, Responses endpoint, service tier, reasoning and timeout unchanged;
- transport retries `0`; fallback disabled.

Prompt text, provider output schemas, repair selection for all other issue
families, candidate semantics, Semantic Reconciliation, Blueprint, Wizard,
Reader, renderer, resemblance gate, payment, storage/database and Production
behavior are unchanged.

## Authority and migration

Current versions:

- authoring policy: `visual-contract-authoring-policy/v4`;
- authoring request/receipt/readiness: `v21/v24/v22`;
- live materialization input/manifest/verification: `v10/v19/v19`;
- execution materialization input/result: `v9/v13`;
- Supervisor request/readiness/result: `v18/v18/v10`;
- canonical Fresh Readiness evidence: `v18`.

Candidate artifact v9, draft schema v14, OpenAI evidence v5 and Blueprint v4
remain unchanged. Immediate predecessor authorities are recognized only as
historical immutable evidence and cannot authorize a new attempt. Canonical
request parsing and verification require the exact two-item catalog and reject
reordering, duplication, additions, missing values, wrong keys and digest
drift.

## Files changed

Production:

- `lib/visual-contract-compiler/authoringPolicy.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- `lib/visual-package/canonicalLiveVisualContractAuthoring.ts`
- `lib/visual-package/liveRequestMaterialization.ts`
- `lib/visual-package/liveExecutionRequestMaterialization.ts`
- `lib/visual-package/liveExecutionSupervisor.ts`
- `lib/visual-package/canonicalPreLiveReadiness.ts`

Tests:

- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts`
- `lib/visual-package/__tests__/canonical-pre-live-readiness.spec.ts`
- `lib/visual-package/__tests__/live-execution-request-materialization.spec.ts`
- `lib/visual-package/__tests__/live-request-materialization.spec.ts`
- `lib/visual-package/__tests__/live-request-verification.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`

Documentation:

- `CURRENT.md`
- this evidence
- the approved Decision Gate

## Regression coverage

- end-to-end compiler success:
  `page_contract_patch -> book_surface_patch ->
  terminal_reference_cleanup -> candidate`;
- existing `full_draft -> terminal_reference_cleanup` success remains valid;
- direct catalog proof accepts only `book_surface_patch` and `full_draft` and
  rejects every other known repair mode plus null/unknown values;
- request/canonical parser/verifier tamper coverage rejects reordered,
  duplicate and additional predecessor values;
- lifecycle sequence validation accepts both eligible predecessors and rejects
  a non-eligible predecessor;
- strict residual, compact-patch, nonmutation, no-fifth-call, token and cost
  guards remain covered by the prior milestone and the unchanged call path;
- immediate predecessor versions are legacy immutable and new current versions
  roundtrip through materialization, Supervisor and Fresh Readiness tests.

## Validation evidence

Policy-correct focused validation used sequential phases with diagnostics:

- ordinary: 3 files / 144 tests PASS, 4 workers;
- resource-intensive: 6 files / 306 tests PASS, 2 workers;
- no assertion, timeout, RPC/IPC, reporter, launch, signal, teardown or
  diagnostic-protocol failure;
- after adding the exhaustive closed-catalog assertion, the complete direct
  repair-loop file passed 31/31;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

The single literal `npm run check` was run once:

- both TypeScript contracts: PASS;
- ordinary: 281 files, 3,165 tests passed, 65 skipped, exactly six failed;
- the six failures are the established ignored-output fixtures:
  `set-appearance-ref-budget` (1), `story-read-back-validation` (2),
  `page-entity-qa` (1), `child-lexicon-ages-5-8` (1) and
  `momentum-gate-koko` (1);
- resource-intensive: 19/19 files and 577/577 tests PASS;
- both diagnostic protocols were valid and no infrastructure failure occurred.

The six fixtures remain a separate release HOLD. They are not findings in this
implementation and are not waived for release.

## Exclusions and rollback

No credential, pricing/network/provider call, B0/Fresh Readiness execution,
canonical preflight, live authoring, candidate approval, image/Vision, render,
storage/database, Board, publication, QA deployment, Production activation or
push occurred.

Rollback before any new authority is consumed is the focused implementation
and documentation range. After v21/v24/v22 authority exists, retain it as
historical immutable evidence and place authoring on HOLD; never rewrite it as
predecessor authority.

## Independent QA falsification targets

Claude Code should return PASS or HOLD after trying to falsify:

1. The compiler reaches one terminal cleanup after an exact
   `book_surface_patch` predecessor and exclusively eligible residual.
2. `full_draft` remains eligible, while every other predecessor remains
   ineligible.
3. Empty, mixed, malformed or unrelated residuals cannot consume call four.
4. The cleanup still uses the strict existing compact schema, exact permitted
   IDs, masked non-target equality and input nonmutation.
5. No fifth call, transport retry or fallback is reachable.
6. Token/cost ceilings and normal three-call behavior are unchanged.
7. Request, receipt, readiness, materialization, Supervisor and Fresh Readiness
   reject catalog/key/order/version/digest tampering.
8. Immediate predecessors remain historical immutable and no old artifact was
   rewritten.
9. No story-specific literal, raw prompt/response/provider message/stack/secret
   or new external capability was introduced.
10. The validation record and separate six-fixture release HOLD are faithful.

## Independent QA result

Claude Code independently reviewed exact immutable range
`f76b161f030738ce6b19e5734864be55667fe144..41aa152c1052c261702c737f93e99d59fb8bff24`
read-only and returned **PASS**:

- BLOCKER: `0`;
- MAJOR: `0`;
- all ten falsification claims survived review;
- no new repository file was modified, staged or committed by the reviewer.

Claude traced the shared closed predecessor predicate through compiler dispatch
and both lifecycle validators, confirmed strict residual/no-fifth-call guards,
verified exact canonical catalog tamper rejection and the complete version
cutover, and found no budget, pricing, model, prompt, timeout, retry/fallback,
story-specific or downstream drift.

One advisory note is retained without correction: the canonical verifiers
repeat the exact ordered catalog inline rather than importing the compiler
constant. This is the existing defensive cross-package pattern, byte-equivalent
to the policy and protected by reorder/duplicate/extra/missing tamper tests.
Claude did not re-execute the recorded tests in its read-only pass.

This PASS grants technical acceptance only. It grants no Fresh Readiness, live,
candidate, render, deployment, Production or push authority by itself. The six
ignored-output fixtures remain a separate release HOLD.
