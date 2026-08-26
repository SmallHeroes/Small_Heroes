# R1D Page-Contract Source-Evidence Identity Fence — Implementation Evidence

## Status

Offline implementation complete on branch
`codex/r1d-qa-wizard-downstream-lifecycle`, based on reviewed and pushed commit
`64c0b5dfbb0233162ee86e07021b49ebef998549`. The focused correction is not yet
independently accepted and authorizes no provider call, Candidate, Wizard
operation, render, deployment, or package publication.

Decision Gate:
`docs/ai-workflow/R1D_PAGE_CONTRACT_SOURCE_EVIDENCE_IDENTITY_FENCE_DECISION_GATE.md`.

## Observed failure and root cause

The one authorized paid attempt completed two provider calls, zero retries and
no fallback, then stopped fail-closed with
`page_contract_repair_presentation_target_invalid`. Conservative recorded cost
was `$0.770925`; no Candidate was minted.

Immutable evidence:

- receipt:
  `outputs/r1d-chameleon-v3-post-census-fresh-readiness-20260826T090432770Z/b0/authoring-receipts/945315dd1e16c7abdd198572f12fa0dc58032d67447cb708a4762f031b115833.json`
- replay:
  `outputs/r1d-chameleon-v3-post-census-fresh-readiness-20260826T090432770Z/b0/structured-draft-replay-evidence/7db562c9527b74225d08ef90921ef06ac96bb13b21377afb3917fb991b2a71a8.json`
- source snapshot:
  `35fe04ab5601031735bd7bdd283bab7a8d897bc399427d592e39fe56aa1f6a6c`
- historical request:
  `457c27333482912ff607f85665ad7002ca7629085c6863020afcc05aaea19190`

All nine returned presentation classes and pointer/value pairs were exact
members of compiler-owned allowlists. All nine target beat IDs were unchanged.
The response nevertheless changed `sourceEvidenceId` on every presentation
target and on 26 of 50 coverage records across all six returned pages. The
complete-page repair schema required the provider to echo opaque evidence IDs
even though no target granted it write authority over those identities. The
existing target guard correctly rejected that drift, but the transport shape
made a valid semantic repair depend on unreliable identity echoing.

## General correction

`applyPageContractRepairs` now treats every coverage `sourceEvidenceId` as
compiler-owned application state:

1. It clones the provider page and requires exact compiler-authorized coverage
   cardinality.
2. Every pre-existing ordinal receives its source ID from the original draft.
3. Records appended by an existing atomic action-binding-component target
   receive that target's compiler-owned source ID.
4. Every existing target-specific applier runs against the normalized page and
   remains the sole authority for allowed beat changes or appends.
5. The normalized provider coverage beat/source topology and ordered
   `actionRequirements[].beatId` topology must equal the resulting
   compiler-authorized topology before a structural complete-page replacement
   may enter the draft.

This deliberately rejects malformed IDs, insertion/removal, reorder, duplicate
or unique untyped beat drift. It preserves exact presentation class and
pointer/value allowlists, spatial authority, atomic action-binding semantics,
location/zone and continuity preservation, and input immutability. It contains
no story, child, companion, page number, source digest, or response literal.

## Semantic cutover

The provider wire bytes are unchanged, but identical bytes now have different
application semantics. Following the established page-repair application
precedent, the current authority chain advances exactly once:

| Authority | Previous | Current |
|---|---:|---:|
| authoring policy | v18 | v19 |
| authoring request | v52 | v53 |
| authoring receipt | v55 | v56 |
| authoring readiness | v52 | v53 |
| live materialization input | v40 | v41 |
| live manifest / verification | v50 | v51 |
| execution request / readiness | v47 | v48 |
| execution result | v40 | v41 |
| execution materialization input / result | v37 / v42 | v38 / v43 |
| Fresh evidence | v47 | v48 |

Request v52, receipt v55 and readiness v52 are explicitly admitted only as
`legacy_immutable`. Historical manifests, execution requests and Fresh roots
are not rewritten or promoted; a future paid attempt requires complete fresh
materialization from the reviewed current HEAD.

Unchanged identities:

- Page Contract repair schema `v3`, digest
  `1c7049591737ec2ecd68fb585a993ae1d87752f1aa3b41103ee5bc6c010b10d3`
- system prompt `v12`
- user prompt `v13`
- compact input encoding `v3`
- model, reasoning, seven-call/six-repair limits, retry/fallback policy,
  budgets, Candidate v9 and every downstream Wizard/render contract

## Exact zero-provider replay proof

The immutable snapshot and the two captured structured responses were injected
directly into the current offline harness. A synthetic invalid third response
stopped execution only after the next route was observed. Result:

```yaml
executionMode: offline_stub
providerCalls: 0
calls:
  - initial
  - page_contract_patch
  - book_surface_patch
stages:
  - completeIssueCount: 12
    nextRepairMode: page_contract_patch
  - completeIssueCount: 5
    completeDelta: -7
    classification: improved
    nextRepairMode: book_surface_patch
completeCensusCoverage: complete
monotonicCompleteIssueDelta: true
maxPositiveCompleteIssueDelta: 0
```

The canonical historical capture CLI now rejects the v52/v18 request before
compilation with `request_version_mismatch` and
`authoring_policy_version_mismatch`. That is the intended cutover, not a replay
regression. No historical artifact was edited or redigested.

## Tests and falsification coverage

- Repair/compiler/harness matrix: 3 files, 147/147 assertions pass.
- Live/Fresh/version matrix: 8 files, 481/481 assertions pass. Two known
  Vitest worker `onTaskUpdate` RPC timeout events were emitted after all test
  assertions passed and are not relabeled as a clean process result.
- `npx --no-install tsc --noEmit`: pass.
- `git diff --check`: pass.
- Literal final-byte `npm run check`: both TypeScript phases pass. Ordinary
  ran 314 files: 292 passed, 17 skipped and the same five unchanged
  fixture-reading files failed on nine absent ignored-output assertions;
  3,790 assertions passed and 70 skipped. Resource ran 20/20 files and all
  623 assertions passed. Three known Vitest worker `onTaskUpdate` RPC timeout
  events keep the Vitest/repository process at exit 1; it is not described as
  a clean repository PASS. No changed production assertion failed.
- Isolated `live-execution-supervisor.spec.ts`: 46/46 assertions pass; the
  process reproduced one post-assertion `onTaskUpdate` RPC timeout and exit 1,
  consistent with the same runner-infrastructure classification.

Focused counterexamples cover page-wide target and non-target ID drift,
structural coverage and action-beat reorder, duplicate and unique beat drift,
insertion, removal, malformed ID, mixed structural/presentation authority,
invalid presentation pointer/value, action-binding component appends, exact
compiler IDs, and nonmutation. The literal repository gate is complete at its
documented fixture/runner baseline. Independent Claude Code review remains
pending.

## Independent QA targets

Claude Code should try to falsify:

1. A structural page importing an unrelated provider beat or source identity.
2. A single action target authorizing changes at another coverage index.
3. Reorder/cardinality drift hidden by ordinal rebinding.
4. Component append order or source identity differing from typed targets.
5. A wrong presentation class or non-allowlisted pointer/value becoming
   accepted because source IDs are normalized first.
6. Mutation of caller-owned draft or response objects on success or rejection.
7. Any incomplete version cutover, old-current artifact accepted as current,
   or unintended prompt/schema/profile/Candidate version change.
8. Any policy, budget, retry, fallback, provider, Wizard, package or render
   drift outside this milestone.
