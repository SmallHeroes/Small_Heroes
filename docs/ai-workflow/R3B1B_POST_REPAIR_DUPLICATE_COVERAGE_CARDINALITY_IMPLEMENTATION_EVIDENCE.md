# R3-B1b Post-Repair Duplicate Coverage Cardinality — Implementation Evidence

Date: 2026-09-04

Product owner: Guy

Technical owner: Codex

Branch: `codex/r3b1b-post-repair-duplicate-cardinality`

Exact base: `63ccb4846ebe5be9ab392960d389610a1b2b9d42`

Implementation commit: `c42f3ce678166cda910b4263e26681e2c72c30e4`

Reviewed range: `63ccb4846ebe5be9ab392960d389610a1b2b9d42..c42f3ce678166cda910b4263e26681e2c72c30e4`

Handoff correction commit: `fb993a01bda0103772c1272f1a4acfc8376efc14`

Correction re-gate range: `c42f3ce678166cda910b4263e26681e2c72c30e4..fb993a01bda0103772c1272f1a4acfc8376efc14`

Status: **CLAUDE CODE IMPLEMENTATION PASS; P2 HANDOFF CORRECTION INDEPENDENTLY RE-GATED PASS AND CLOSED**

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

Implementation-time final focused command:

```powershell
npx vitest run lib/__tests__/page-contract-repair.spec.ts lib/__tests__/draft-action-authority.spec.ts lib/__tests__/draft-reference-domain-hardening.spec.ts lib/__tests__/visual-contract-repair-loop.spec.ts lib/__tests__/offline-repair-harness.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts lib/visual-package/__tests__/canonical-live-authoring-launcher.spec.ts lib/visual-package/__tests__/visual-contract-authoring-replay-evidence.spec.ts --pool=threads --maxWorkers=1 --no-file-parallelism
```

Result: **9/9 files and 555/555 tests passed**, exit 0.

During implementation, the broader changed version/materialization cascade also
passed **503/503** focused assertions across lifecycle, canonical live
boundary/launcher, replay, live request materialization/verification, execution
materialization, Supervisor and pre-live readiness.

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

## Independent Claude Code QA

Claude Code reviewed the exact implementation range read-only and returned
**PASS with no P0/P1 and one P2**. It verified the clean branch, exact HEAD and
base-to-head range, found no story-specific patch, and statically confirmed the
complete graph admission, bound escalation provenance, double cleanup
prohibition, version cascade and unchanged call ceilings, transport retries,
fallback policy and 0.70 resemblance threshold.

Claude ran 347/347 assertions available through an external dependency tree.
Its sole P2 is a reviewability/environment finding rather than a production-code
defect: the handed-off worktree itself contained only a `.vite` cache under
`node_modules`, so Claude could not independently run the reported 555/555,
503/503, both TypeScript checks or the official replay from the exact root.

## P2 handoff correction and exact-worktree reproduction

Codex accepted the P2 and prepared a zero-cost, ignored environment correction;
no production code, test code or package manifest changed and no dependency was
installed. During re-gate, this worktree's `node_modules` was temporarily a
junction to the clean exact-base worktree dependency tree at
`C:\GNart\Work\sh-r3b1b-accepted-intent-wave-2\node_modules`. The current and
donor `package.json` SHA-256 is
`935217B035428B183EF8FC0A50215D30D0EBCF2C46868B7069D96E7E02794447`; their
`package-lock.json` SHA-256 is
`785E90A70B0D8F041B107483A204332BB85FFFEE42506DBE6CBAEE4A0FA75AFA`.
The original `.vite`-only directory was preserved outside the repository at
`C:\Users\guyna\.codex\worktrees\d53b\Small_Heroes-node_modules-vite-cache-pre-qa-regate`
through the review. Neither the junction nor the backup path was part of the
Git correction range.

From the exact handed-off worktree root, ordinary commands then produced:

- the nine-file focused command: **555/555**, exit 0;
- the remaining five changed-cascade files: **168/168**, exit 0;
- the four package files already present in the 555-test command account for
  335 assertions, so their union with the remaining 168 reproduces **503/503**;
- `npx tsc --noEmit`: exit 0;
- `npx tsc -p tsconfig.story-autonomous.json`: exit 0; and
- the official immutable replay: exit 0, zero provider calls, exact captured
  call sequence and all receipt-congruence booleans true.

The first five-file 168-test invocation produced 167 passes plus one 15-second
test timeout. The affected 14-test file immediately passed 14/14 in
isolation, and the unchanged five-file command then passed 168/168 on a clean
rerun. Both outcomes are retained here for truthful reproduction history.

These are Codex measurements after correcting the handoff environment; the
first review's independent execution scope remains 347/347.

## Independent P2 correction re-gate

Claude Code independently re-gated exact correction range
`c42f3ce678166cda910b4263e26681e2c72c30e4..fb993a01bda0103772c1272f1a4acfc8376efc14`
read-only and returned **PASS, closing the sole P2**. It verified one commit,
zero merges, exactly the three declared documentation files, clean diff
hygiene, the ignored junction, exact donor and manifest hashes, preserved cache
and absence of the temporary replay copy.

From the exact handed-off root with plain `npx`/`npm`, Claude independently
reproduced:

- `npx tsc --noEmit`: exit 0;
- `npx tsc -p tsconfig.story-autonomous.json`: exit 0;
- the nine-file focused suite: **9/9 files and 555/555 tests**, exit 0;
- the nine-file version/materialization cascade: **9/9 files and 503/503
  tests**, exit 0 with no timeout in its run; and
- the official immutable replay: exit 0, routing policy v1, zero provider
  calls, exact captured sequence, `invalid_draft`, all six receipt-congruence
  booleans true and null route provenance on both legacy attempts.

Claude used no install, `npm ci`, stub, credential or provider call. It did not
run `npm run check`; the previously disclosed non-green repository baseline
remains Codex evidence and no repository-wide green result is inferred.

After the PASS, Codex verified the exact junction target and preserved cache,
removed only the junction without recursion, and moved the original directory
containing only the `.vite` cache back to `node_modules`. The restored path is
an ordinary non-reparse directory containing only the original four-entry
cache tree; its 968-byte result file retains SHA-256
`11B3A0FC8284DA7ACB273038D057C5703845C9C35E4DC7FED7EC18881B8E9E49`.
The external backup path is now absent, the donor remains intact and clean, and
the temporary replay copy remains absent.

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
read-only spot review found no remaining P0/P1/P2; it did not substitute for
independent review. Claude Code has now passed both exact ranges and closed the
sole P2.

## Rollback and next gate

Rollback is a focused revert of the implementation commit. There is no data
migration, provider artifact or downstream state to undo. Historical evidence
remains immutable.

Claude Code independently passed implementation range
`63ccb4846ebe5be9ab392960d389610a1b2b9d42..c42f3ce678166cda910b4263e26681e2c72c30e4`
and correction range
`c42f3ce678166cda910b4263e26681e2c72c30e4..fb993a01bda0103772c1272f1a4acfc8376efc14`.
The sole P2 is closed and the temporary dependency handoff is restored. No
additional QA gate is required for this faithful closeout transcription unless
it introduces a factual discrepancy. No retry or downstream action follows
from either PASS; any new P1-A1 attempt still requires fresh explicit authority
from Guy.
