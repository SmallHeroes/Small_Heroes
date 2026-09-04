# R3-B1b Post-Repair Duplicate Coverage Cardinality — Implementation Evidence

Date: 2026-09-04

Product owner: Guy

Technical owner: Codex

Branch: `codex/r3b1b-post-repair-duplicate-cardinality`

Exact base: `63ccb4846ebe5be9ab392960d389610a1b2b9d42`

Status: **PROVIDER-FREE IMPLEMENTATION COMPLETE LOCALLY; CLAUDE CODE QA PENDING**

## Authority and exclusions

Guy approved only the implementation package in the independently passed
Decision Gate. This milestone used local code, stubs and immutable captured
responses. It did not authorize or perform a P1 retry, provider/network call,
credential read, candidate creation, Blueprint, image, Board/prop, package,
locator, render, narration, publication, deployment or spend.

The global seven-standard-call ceiling, separately gated single cleanup call,
zero transport retries, no fallback and 0.70 resemblance threshold are
unchanged.

## Implemented behavior

The compiler now derives the complete per-page action/coverage graph and checks
that the normalized issue population agrees with the graph before routing.
Compact repair is admitted only for a closed solution whose exact page, action,
coverage index, operation and permitted beat are compiler-owned. Supported
closed forms are:

- one unique same-page orphan retarget;
- one exact recognized non-action coverage disposition converted to
  `action_requirement` without changing its beat;
- independent instances of that conversion on distinct pages; and
- the existing safe orthogonal page-spatial compound repair.

The applier rejects a wrong beat, wrong index, no-op, disposition widening,
coverage topology drift, incompatible same-page component overlap and all
non-target changes. It recomputes the complete graph after applying the patch;
residual cardinality or foreign-page coverage identity rejects the response.

A complete pure action/coverage-cardinality family with no legal compact
solution selects the existing bounded `full_draft` mode. The route carries
`cardinality_escalation` provenance through compiler summary, prompt authority,
attempt receipt and replay. Missing, forged, removed, unrelated or
cross-substituted provenance fails receipt validation. The provenance also
makes only that escalated full draft ineligible for terminal cleanup. Ordinary
`full_draft` and `book_surface_patch` cleanup scheduling remains unchanged.

Incomplete, stale, ambiguous, mixed-family and unrecognized populations remain
terminal. No coverage record is silently deleted, merged or creatively
reclassified.

## Version cutover

| Authority | Current | Preserved legacy/offline authority |
| --- | --- | --- |
| Authoring policy | v22 | v21 |
| Routing policy | v2 | v1 |
| Page repair prompt | system v13 / user v14 | system v12 / user v13 |
| Authoring request | v56 | exact v55 |
| Authoring receipt | v59 | exact v58 |
| Authoring readiness | v56 | classified v55 |
| Offline harness result | v4 | legacy routing represented inside v4 |
| Replay result | v2 | exact legacy tuple reported by v2 |
| Replay evidence | unchanged v2 | exact historical bytes |

The current outer boundary is live-request materialization input v44 and
manifest/verification v54; execution materialization input/result v41/v46;
Supervisor request/readiness/result v51/v51/v44; and canonical pre-live
readiness v51. Production validators accept only current authority. The replay
runner admits legacy routing only for the exact v55 request + v58 receipt +
replay-evidence-v2 tuple.

## Validation evidence

Final focused command:

```powershell
npx vitest run lib/__tests__/page-contract-repair.spec.ts lib/__tests__/draft-action-authority.spec.ts lib/__tests__/draft-reference-domain-hardening.spec.ts lib/__tests__/visual-contract-repair-loop.spec.ts lib/__tests__/offline-repair-harness.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts lib/visual-package/__tests__/canonical-live-authoring-launcher.spec.ts lib/visual-package/__tests__/visual-contract-authoring-replay-evidence.spec.ts --pool=threads --maxWorkers=1 --no-file-parallelism
```

Result: **9/9 files and 555/555 tests passed**, exit 0.

The broader changed version/materialization cascade also passed **503/503**
focused assertions across lifecycle, canonical live boundary/launcher, replay,
live request materialization/verification, execution materialization,
Supervisor and pre-live readiness.

```powershell
npx tsc --noEmit
git diff --check
```

Both exit 0. `npm run check` also proves that `tsc --noEmit` and
`tsc -p tsconfig.story-autonomous.json` pass on the final tree.

The full repository check remains red on unrelated current-worktree evidence:

- ordinary phase: 337 passing / 8 failing / 17 skipped files; 4,800 passing /
  19 failing / 73 skipped tests;
- the 19 failures are missing ignored historical outputs plus the existing
  Story Source / Visual Direction review/correction corpus binding and digest
  mismatch; and
- resource-intensive phase: 20 passing / 1 failing files, 642 passing / 11
  skipped tests, plus three `onTaskUpdate` RPC timeouts. The failed suite stops
  on the same unrelated corpus binding before its tests execute.

No modified task-focused suite fails. The former cross-page compact regression
found by the first full check is corrected and covered in the final 555-test
run.

## Immutable historical replay

Seven files under the preserved Dragon Dini `b0` evidence root were copied to
the current worktree only for the official CLI's repository-containment fence.
SHA-256 and length equality were proven before and after replay. The temporary
copy was then removed; the source evidence remained unchanged.

The official command exited 0 and reported:

- replay result v2 and harness result v4;
- routing policy v1;
- `providerCalls: 0`;
- `exactCapturedCallSequence: true`;
- `receiptExpectedHarnessOutcome: invalid_draft`;
- all six candidate/failure/count/digest/terminal/outcome congruence booleans
  true;
- call 1: initial, prompt v22 / user v17; and
- call 2: `page_contract_patch`, legacy page prompt v12 / user v13.

The terminal remains `draft_authority_reference_domain_invalid` with identity
digest `40e4be2fe0a185198fa4c2769e94d80a42921c01de0d0b58ee694a8a8f4dba0c`.
No current request, receipt, readiness or candidate was created.

## Local adversarial findings closed

Local adversarial review found and the implementation corrected:

1. receipt provenance originally did not recognize the paired duplicate-beat
   diagnostic emitted by the compiler;
2. one safe same-beat disposition conversion and its independent distinct-page
   form were initially omitted;
3. a same-page component + scalar plan was admitted even though its applier
   could not accept a correct atomic result;
4. the first disjointness correction was too broad and briefly blocked safe
   scalar + page-spatial compounds; and
5. the repository-wide check exposed a unique foreign-page coverage retarget
   compatibility case missing from the focused set.

Each has a direct positive and adversarial regression. The final local
read-only spot review found no remaining P0/P1/P2, but it is not a substitute
for the required independent Claude Code gate.

## Rollback and next gate

Rollback is a focused revert of the implementation commit. There is no data
migration, provider artifact or downstream state to undo. Historical evidence
remains immutable.

Next: Claude Code reviews the immutable base-to-head range read-only, attempts
the Decision Gate falsification targets, verifies the disclosed full-check
baseline and issues PASS/HOLD. Codex validates and fixes any real findings in a
separate milestone before re-gate. No retry or downstream action follows from
this implementation commit.
