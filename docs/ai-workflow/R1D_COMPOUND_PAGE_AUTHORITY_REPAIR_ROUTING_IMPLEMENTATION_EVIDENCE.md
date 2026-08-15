# R1D Compound Page Authority Repair Routing — Implementation Evidence

## Authority and topology

- Worktree: `C:\Users\guyna\.codex\worktrees\spotlightlion1\Small_Heroes`
- Branch: `codex/r1d-compound-page-authority-repair-routing`
- Exact base: `6f3f44846d6a282f1019175d7f8902d3371209aa`
- Base was clean and at `0/0` parity with its same-name upstream before the new branch was created.
- Production, QA deployment and historical artifacts were not changed by implementation or validation.

## Observed failure and corrected diagnosis

The consumed Leo v11 live attempt used three completed provider calls and ended without a candidate. Attempt two's full-draft response exposed one action-binding cardinality issue at page 7. Attempt three used `page_contract_patch` for page 7, resolved that issue, and then validation surfaced 18 unique `out_of_scope_reference` diagnostics across pages 1, 4, 5, 6, 8, 9, 10, 11 and 12.

Because the third call received only page 7, it could not have rewritten the other pages. The reference failures were latent in the attempt-two full draft. `sourceGroundPageActionSemantics` threw the page-7 cardinality authority before page-spatial validation ran, so the two repairable authority families were serialized across attempts and exceeded the unchanged two-repair budget.

## General implementation

`compileBookVisualContractTemplate.ts` now:

1. Collects page-spatial reference-domain issues and exact zone authority as pure local data instead of throwing immediately.
2. Runs that collection on the canonical page draft independently of action-semantic grounding.
3. Combines the collected spatial issues with any action-binding authority issues before constructing `DraftAuthorityReferenceDomainError`.
4. Preserves the existing compact route for homogeneous page-spatial issues.
5. Preserves the existing complete-page route for homogeneous action-binding cardinality issues.
6. Routes only the exact mixed family through one bounded `full_draft` repair containing both sanitized diagnostic sets.
7. Keeps any unknown or third authority family terminal before repair.

No prompt, JSON schema, model, endpoint, service tier, 64K ceiling, maximum output, call/repair budget, timeout, transport retry, fallback, price ceiling or downstream policy changed.

## Regression coverage

The new direct tests prove:

- a draft with one missing action binding and one out-of-zone page-action reference co-observes both typed identities;
- both identities are encoded into one full-draft repair request;
- exactly one repair call is used and a valid replacement proceeds;
- homogeneous spatial-only and action-binding-only regressions remain on their existing compact routes;
- an authority set containing a third family remains terminal after one initial call.

## Validation

- Direct focused regression: `draft-reference-domain-hardening.spec.ts` — **1 file / 42 tests PASS**.
- Focused aggregate: page-contract repair, reference-domain hardening, repair loop, prompt compaction and source-authority lifecycle — **5 files / 199 tests PASS**.
- `npx --no-install tsc --noEmit` — PASS.
- `git diff --check` — PASS.
- One literal `npm run check` was run:
  - TypeScript contract — PASS.
  - autonomous story typecheck — PASS.
  - resource-intensive phase — **19 files PASS**, two workers, valid diagnostics, no timeout/RPC/IPC/reporter/launch/signal/teardown failure.
  - ordinary phase — **280 files**, failed only the exact six established missing ignored-output fixtures.
  - no seventh assertion and no new infrastructure failure occurred.

## Separate release HOLD

The six known ignored-fixture failures remain release-blocking in their own scope. They are not caused by this range and do not weaken the focused implementation evidence.

## Boundaries and rollback

- External cost: `$0`.
- No credential access, pricing lookup, provider/network call, Fresh Readiness, canonical preflight, live authoring, candidate creation, Reconciliation, Blueprint, Wizard, render, image/Vision, storage/database, deployment or production action occurred.
- Rollback is a focused revert of the implementation commit; no data or artifact migration is required.
- Historical readiness/live artifacts remain immutable and grant no new authority.

## Independent QA targets

Claude Code should falsify:

1. that spatial failures are collected even when action-semantic grounding rejects another page;
2. that the mixed route admits only the exact two closed repairable families;
3. that spatial-only and cardinality-only routing remain unchanged;
4. that the repair count, model, prompt/schema authorities and budgets are unchanged;
5. that diagnostics remain typed/sanitized and no rejected ids or raw provider material are persisted;
6. that the range is limited to compiler routing, direct tests and durable documentation;
7. that the six-fixture repository HOLD remains separate and accurately reported.

Codex does not self-award independent technical PASS. Fresh Readiness and any later live/render authority require a clean pushed HEAD plus independent review.

## Independent review and focused QA correction

Claude Code's read-only review of exact range `6f3f44846d6a282f1019175d7f8902d3371209aa..c034284b0e3a293a7d5d58c5b5e34ace70b50e2e` returned technical **PASS** with zero BLOCKER, zero MAJOR and one MINOR. It independently confirmed the implementation and traced the terminal behavior for unapproved mixed authority sets. Its MINOR correctly observed that the original third-family regression used a malformed Set Board consumer that failed before the compound catch boundary.

The focused correction changes only that negative control. It now adds `action_check_id_forbidden` inside the same page grounding pass as `action_coverage_cardinality_invalid`, while the independent spatial collector contributes `page_spatial_reference_outside_zone`. The test asserts all three exact typed identities on the returned terminal `DraftAuthorityReferenceDomainError`, exactly one initial provider call, and no repair. The corrected direct suite passes **1 file / 42 tests**; TypeScript and `git diff --check` pass.

Claude Code's read-only micro re-gate of exact range `c034284b0e3a293a7d5d58c5b5e34ace70b50e2e..e168671c` returned **PASS**, independently closed MINOR-1 and found no new BLOCKER, MAJOR or MINOR. Claude traced the new test through the real collector, grounding and terminal partition; it also independently reran `git diff --check`. This document records Claude's verdict and does not self-award technical PASS.
