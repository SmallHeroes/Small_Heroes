# R3 16-Beat Visual Contract Authoring Policy — Decision Gate

Date: 2026-09-02
Owner decision: Guy approved keeping the six fantasy stories at 16 beats and
authorized Codex to proceed with the full implementation. This gate records
the bounded technical interpretation presented before editing.
Implementation branch: `codex/r3-all-wizard-render-readiness`
Base: `146bb53a435f5ce9b5190cd03522160ec976ac01`

## 1. Proposed change

Replace the current Visual Contract authoring policy v20 with v21 so the
canonical text-only authoring boundary admits books of up to 16 source pages.
The new static policy raises the standard input ceiling from 64,000 to 80,000
units while preserving:

- seven standard calls plus one separately gated terminal-reference cleanup;
- the existing page-derived output schedule and output-budget version;
- the same provider, model, service tier, reasoning effort, retry policy, and
  no-fallback behavior; and
- the existing conservative USD 10 hard ceiling per story.

All downstream current-only materialization, readiness, execution-request,
and execution-result contracts receive fresh versions. Existing v20 evidence
remains immutable historical evidence and is not rewritten.

Any persisted diagnostic whose meaning includes the effective input boundary
also receives a fresh current version. Historical diagnostics retain their
original 59,904 boundary instead of being reinterpreted under v21.

## 2. Why now?

R3-A proves that all six current Wizard fantasy stories have 16 accepted text
pages but are rejected by the current 12-page authoring admission policy.
Measured zero-cost preflight also shows that two of the six exceed the current
64,000 input ceiling: Fox at 66,097 and Panda at 68,318. Raising only the page
count would therefore leave the catalog partially blocked.

The existing compiler, schemas, exact-page validation, render planning, and
output schedule already support 16 pages. The missing capability is policy
authority and its versioned downstream evidence, not a compiler rewrite.

## 3. Scope

This is a general Visual Contract authoring-policy change. It applies to every
fresh 8-, 12-, or 16-page authoring request that uses the current policy. It is
not keyed to a story, child, companion, direction, or page.

The static 80,000 ceiling intentionally also broadens input admission for new
8- and 12-page requests. A worst-case 12-page reservation rises from USD 7.04
to USD 7.656, still inside the unchanged USD 10 hard ceiling. A tiered policy
would preserve the old 64,000 ceiling for shorter books but would require a
larger route-dependent contract and migration surface.

No Story Source text, Visual Direction, Blueprint, Board, package, order,
render, narration, reader, payment, database, storage, or production flag is
changed by this milestone.

## 4. Risk of hardcoding

The policy is expressed only through shared constants and canonical lifecycle
validation. Tests must cover the complete 18-slot Wizard corpus and generic
17-page, over-80K, and repair-route controls. No fantasy list or story-key
branch may be introduced.

## 5. Files likely affected

- `lib/visual-contract-compiler/authoringPolicy.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- `lib/visual-package/liveRequestMaterialization.ts`
- `lib/visual-package/canonicalPreLiveReadiness.ts`
- `lib/visual-package/liveExecutionRequestMaterialization.ts`
- `lib/visual-package/liveExecutionSupervisor.ts`
- `lib/visual-package/wizardAllStoryRenderReadiness.ts`
- `scripts/visual-contract-authoring.ts`
- focused authoring/materialization/readiness tests
- `CURRENT.md`, `ROADMAP.md`, and this gate

## 6. Expected behavior after change

- Source snapshots with 1 through 16 pages may enter current authoring when
  every other preflight passes.
- A 17-page source is rejected before credential loading or transport.
- The standard input ceiling is exactly 80,000; each route retains the 4,096
  safety margin, so an estimated route input above 75,904 is rejected locally.
- The existing 16-page output schedule remains
  `[53334, 42666, 48000, 32000, 32000, 32000, 32000]`.
- The exact conservative 16-page reservation is USD 9.152, below the unchanged
  USD 10 hard ceiling.
- All six fantasy stories lose only their page-policy blocker in the R3
  readiness report; unrelated source/authority blockers remain visible.
- v20/request-v54/receipt-v57/readiness-v54 artifacts become
  `legacy_immutable`; current-only execution requires fresh zero-cost
  materialization under v21.
- Route-admission diagnostics advance to v3; v2 and v1 remain legacy-readable
  only at their original 59,904 effective boundary.

## 7. Validation plan

Use provider-unreachable tests only:

1. Run canonical preflight for all 18 approved/QA source snapshots and prove
   that the six 16-page fantasy sources are admitted by page and input policy.
2. Prove 17 pages, input above 80,000, and every repair route above the 4,096
   safety margin fail before credentials or transport.
3. Assert the exact 16-page output schedule, USD 9.152 reservation, and USD 10
   hard-cap enforcement.
4. Prove exact 16-page compiler coverage with no truncation and keep the
   existing 8/12-page behavior covered.
5. Re-gate materialization, verification, canonical pre-live readiness,
   execution materialization/supervision, replay rejection, and Wizard
   all-story readiness.
6. Run `npx tsc --noEmit`, focused tests, `git diff --check`, and the repository
   `npm run check` contract, recording any known infrastructure limitation
   separately from product assertions.
7. Commit the zero-cost milestone and send the immutable range to Claude Code
   for independent read-only falsification.

No full-book render or provider call is required or authorized.

## 8. Cost impact

This implementation and its validation spend USD 0 and generate zero images,
audio clips, or provider responses.

The policy changes only the maximum reservation for a later explicitly
approved text-authoring call. At 16 pages and 80,000 standard input units, the
conservative reservation is USD 9.152. The unchanged USD 10 ceiling therefore
has only USD 0.848 (8.48%) headroom and is now the binding constraint on any
later page/input/model-price increase. A future increase requires a fresh cost
Decision Gate; it must not be inferred from this page-policy approval. This
gate does not authorize those paid calls; R3-C still requires an exact
per-story preflight and explicit wave budget from Guy.

## 8A. Independent QA outcome

Claude Code reviewed
`146bb53a435f5ce9b5190cd03522160ec976ac01..2b41750f9f9d12a878af3607c0d41a40e14293b9`
read-only and returned PASS with no P0/P1. It independently reproduced the
75,904 inclusive fence, USD 9.152 reservation, frozen legacy diagnostics,
18/18 policy admission, 1/18 strict render qualification, exact audit digest,
and zero-effect claim. Its three P2 notes were documentation/process findings:
record the thin cost headroom, make the focused test selection reproducible,
and preserve the fact that the reviewed commit was one ahead of origin and
unpushed. None changes the approved implementation or authorizes a push.

## 9. Rollback plan

Before paid execution, revert the focused policy commit. Preserve any freshly
materialized v21 artifacts as immutable historical evidence; do not mutate or
redigest them. Rematerialize unchanged accepted sources under whichever policy
is current after rollback.

Existing accepted Visual Contract candidates, packages, locators, orders, and
renders require no migration.

## 10. Review assignment

Guy decided the product requirement: preserve 16 beats and proceed with the
bounded 16-page/80K policy under the existing USD 10 fence.

Claude Code must try to falsify page/input admission boundaries, exact cost
reservation, repair-route margins, compiler coverage, version cutover,
historical immutability, provider unreachability, and the claim that only the
six page-policy blockers disappeared.

Claude Cowork is not required for this technical policy milestone. Story and
visual quality remain separate product-review gates.

## 11. Stop-check answers

1. **General or story-specific?** General shared authoring policy.
2. **Could this break another story/child/companion/style?** It can broaden all
   fresh authoring inputs; complete 18-story and generic boundary coverage is
   required.
3. **Does it affect production behavior?** It changes eligibility for future
   explicitly approved authoring calls, but performs no live call or
   publication now.
4. **Does it spend money?** No. Future paid calls remain separately gated.
5. **Smallest safe validation?** Zero-cost preflight and compiler tests across
   all 18 sources plus generic 17-page/80K/repair controls.
6. **What did Guy decide?** Keep 16 beats and proceed with the presented
   16-page/80K policy while retaining the USD 10 ceiling.
7. **What should Claude Code falsify?** Admission, cost, route margins,
   versioning, immutability, and external-boundary isolation.
8. **Should Claude Cowork review?** Not for this policy-only milestone.
9. **What should Guy eyeball?** The later exact story/visual candidates and
   paid wave budget, not this zero-cost policy plumbing.

## 12. Do not do

Do not call a provider; load credentials; render an image, audio clip, page, or
book; create or modify an order; access database/storage; publish or deploy;
change the model, retry/fallback policy, call count, output-budget schedule,
USD 10 ceiling, or resemblance threshold 0.70; admit 17 pages; expand above
80,000; invent cross-policy replay; mutate historical evidence; or introduce a
story-specific exception.
