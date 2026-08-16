# R1D Book-Surface Input-Ceiling Routing and Observability — Implementation Evidence

**Date:** 2026-08-16
**Branch:** `codex/r1d-book-surface-input-ceiling-compaction`
**Worktree:** `C:\Users\guyna\.codex\worktrees\booksurfaceinput1\Small_Heroes`
**Base:** `bd528a609b4c6d664ba7807a3a47ca201c2cf775`
**Code commit:** `a0f0e1185f1e224e4faac22d3df6f896166597b2`
**Independent QA:** pending

## Boundary and diagnosis

The consumed live authority is historical evidence only. This milestone made
no credential, pricing, provider, Fresh Readiness, preflight, live-authoring,
candidate, render, storage, database or deployment call.

Claude Code first performed a broad read-only diagnosis and returned
`HOLD_FOR_ARCHITECTURAL_DECISION`. Its central finding was correct: the
compiler selected `book_surface_patch` from semantic eligibility without first
checking the exact request against the immutable 64K input boundary. The
partial v3 input compaction saved only about 2.3KB because the existing compact
encoder already dictionary-deduplicated repeated strings. The original
12-page proof was non-discriminating and would have passed at base.

The accepted correction therefore combines scoped compaction with exact route
admission. It does not create another repair call and does not weaken the
ceiling.

## Implemented behavior

1. `bookSurfaceRepairAuthority` partitions every aligned structural issue into
   exactly one closed scope: cover, recurring-prop lifecycle or page. Any
   unclassified or cross-scoped issue rejects authority.
2. Cover and recurring-prop hints are stored once in their own scoped arrays;
   page hints remain inside their exact page bundle with repair targets,
   permitted values and the complete page contract.
3. Hint sanitization is deterministic codepoint ordering, whitespace cleanup,
   secret screening and deduplication. One aggregate cap of 128 applies to the
   serialized scoped hints.
4. Before committing to `book_surface_patch`, the compiler builds the exact
   system prompt, user prompt and JSON schema and applies the same conservative
   byte-accounting authority with an additional 4,096-unit route margin.
5. An oversized mixed Book Surface repair falls through before dispatch to the
   existing `full_draft` route on the same logical call. `page_contract` is not
   used for this fallback because it cannot carry cover and recurring-prop
   repair scope.
6. Every attempt receipt records only numeric `systemBytes`, `userBytes`,
   `schemaBytes`, `separatorBytes`, `protocolAllowance`, `estimatedBytes` and
   `ceiling`. Readiness reconstruction verifies exact arithmetic, applicable
   ceiling and status/dispatch consistency. Raw prompts, responses, provider
   messages, source prose, stacks and secrets are absent.

## Authority migration

| Authority | Prior | Current |
|---|---:|---:|
| Authoring policy | v9 | v10 |
| Authoring request | v26 | v27 |
| Authoring receipt | v29 | v30 |
| Authoring readiness | v27 | v28 |
| Book Surface system/user prompt | v2/v2 | v3/v3 |
| Book Surface output schema | v2 | v2 unchanged |
| Live materialization input/result/verification | v15/v24/v24 | v16/v25/v25 |
| Execution materialization input/result | v14/v18 | v15/v19 |
| Supervisor request/readiness/result | v23/v23/v15 | v24/v24/v16 |
| Canonical pre-live readiness | v23 | v24 |

Immediate predecessors are classified as legacy immutable. Historical
artifacts were not rewritten or recalculated and cannot authorize a new run.

## Unchanged policy

- model `gpt-5.6-sol`, Responses API and service tier;
- reasoning, tools and Structured Outputs contract;
- 64K input ceiling and output budget;
- three standard logical calls and two standard repairs;
- the closed terminal reference-cleanup allowance;
- 20-minute timeout, zero transport retries and no provider fallback;
- nominal/conservative pricing assumptions and hard `$5.00` ceiling;
- output patch schema/application guards, candidate semantics and downstream
  behavior.

## Tests and exact results

Focused proof:

- `book-surface-repair.spec.ts` + `visual-contract-repair-loop.spec.ts`:
  2 files / 52 tests PASS during the first bounded run.
- Final routing/accounting set (`book-surface-repair`, repair loop,
  `source-authority-lifecycle`): 3 files / 123 tests PASS.
- Canonical materialization/readiness boundary: 4 files / 222 tests PASS.
- Live request verification, Supervisor and provider diagnostics: 3 files /
  122 tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS before stage, staged range and final code range.

The tests directly prove production-builder 12-page sizing, 4K-margin route
rejection, same-call `full_draft` selection, complete issue partition,
codepoint determinism, one aggregate cap, receipt/readiness accounting,
tamper rejection, prompt/version propagation and unchanged output guards.

Repository gate:

- Literal `npm run check` invoked once; no retry.
- TypeScript and `story:autonomous-typecheck`: PASS.
- Canonical inventory: 300 files = 281 ordinary + 19 resource-intensive.
- Ordinary: 261 files passed, 16 skipped, 4 failed; 3,192 tests passed,
  65 skipped, 5 failed. All five failures are missing ignored artifacts in
  unchanged `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`,
  `page-entity-qa.spec.ts` and the two
  `story-read-back-validation.spec.ts` assertions.
- Resource-intensive: 19/19 files and 577/577 tests PASS; diagnostic protocol
  valid; no timeout, RPC/IPC, reporter, launch, signal, termination or teardown
  class.
- The sixth member of the historically documented baseline,
  `set-appearance-ref-budget.spec.ts`, did not fail in this worktree. This run
  neither repairs nor waives that historical release HOLD.
- Two exact scratch Markdown files created by the failing read-back spec were
  removed after the run. No source fixture was copied, generated or fabricated.

## Risks, rollback and next gate

The full-draft fallback intentionally carries broader draft reconstruction than
the compact Book Surface patch, but it is the existing current authority and
does not add a call. Non-target drift continues to be rejected by compilation
and validation. The fourth terminal reference-cleanup call remains eligible
only for its existing closed predecessor families and is not a general escape
hatch.

Rollback is the exact code commit revert plus the documentation closeout. No
data migration or artifact rewrite is required.

Independent Claude Code QA must falsify the route admission calculation,
same-call fallback, issue partition, aggregate cap, deterministic ordering,
numeric-only evidence, tamper rejection, all authority bindings, unchanged
budgets/schema/candidate semantics and repository-gate disclosure. Until that
review passes, there is no Fresh Readiness or paid-attempt authority. Even a
technical PASS grants no candidate, Blueprint, Wizard, render, QA deployment,
Production or release acceptance.

## Exclusions and cost

No credential file was opened or checked. No pricing lookup, provider/model or
network call, B0/Fresh Readiness, canonical preflight, live authoring, candidate
approval, Reconciliation, Blueprint, Wizard execution, image/Vision/render,
storage/database/Supabase, Board, publication, promotion, deployment or push
occurred. External cost: `$0`.
