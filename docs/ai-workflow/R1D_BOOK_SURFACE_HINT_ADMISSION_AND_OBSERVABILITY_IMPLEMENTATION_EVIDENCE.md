# R1D Book Surface Hint Admission and Structural Observability — Implementation Evidence

**Date:** 2026-08-18

**Status:** local implementation and validation complete; independent Claude Code QA pending; unpushed; no new Fresh Readiness, provider, candidate, Wizard or render authority

## Topology

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-book-surface-hint-admission-observability`
- Exact pushed and independently passed base: `37983ab41e039fa36b694344f2a399504a6806e0`
- Decision Gate commit: `dfe328ad9bb11403cb8198a5d7ac979c63b760f1`
- Implementation commit: `37e8e783b4cba132d280b575fd7708f59aadb4be`
- Production: untouched
- Implementation/test provider and image cost: `$0`

## Consumed evidence

The immutable consumed attempt is:

`C:\GNart\Work\sh-wt-r1d-output-budget\outputs\r1d-mustshow-freeze-readiness-37983ab4-20260817T195312869Z`

Its receipt v33 is
`799af897555237565283b35237f549bc267237899a5366e2cfe9d8508b0fb6d4`.
All three provider calls completed, two repairs were consumed, transport
retries were zero and fallback was false. Exact nominal/conservative cost was
`$2.147054 / $2.361773`.

The route was:

`initial -> full_draft -> book_surface_patch`

Attempt one emitted 134 diagnostics across 22 unique typed identities: eight
closed-catalog presentation gaps plus cover, all twelve page final-structure
identities and recurring-prop lifecycle. The full-draft repair reduced the
surface to 82 emissions / 18 identities. The final Book Surface v4 repair
completed, applied and reached full revalidation. It resolved all remaining
presentation gaps and cover, did not reproduce the earlier `mustShow` stale
target failure, and left 24 emissions grouped into exactly twelve persistent
page final-structure identities. The standard budget then exhausted without a
candidate. Supervisor v20 correctly recorded child failure and null output
authority. Reconciliation, Blueprint, Wizard and render authority are absent.

All persisted content-addressed artifacts and preservation fences were
validated read-only. This was not a provider, transport, timeout, truncation,
credential, input-ceiling or Supervisor infrastructure failure.

## Root cause

Book Surface v4 sanitized each cover, recurring-prop and page validation-hint
scope independently, then also rejected the whole authority when the sum of
all hints and presentation targets exceeded 128. The consumed initial surface
contained exactly 126 structural messages plus eight presentation targets.
The redundant aggregate check therefore returned no Book Surface authority
before the canonical route-admission function could measure the real request.

Because authority construction returned null, the compiler could select
neither the mixed Book Surface route nor its already-approved
presentation-first fallback. It fell through to destructive `full_draft` and
spent the repair slot required for the remaining pure structural surface.

The persisted diagnostics also exposed only the broad per-page
`final_structural_invariant_invalid` identity. The exact final structural
clauses were intentionally not persisted, so a more precise residual diagnosis
was impossible without adding bounded closed evidence.

## Implementation

The Book Surface authority builder no longer applies the redundant whole-book
128-item sum. Every existing per-scope limit remains: at most 128 sanitized
messages per scope, 1,024 characters per message, normalization/deduplication,
blank/NUL/secret rejection, typed targets and exact reference guards. The
existing canonical route ceiling of `64,000 - 4,096 = 59,904` estimated bytes
continues to decide whether a mixed request is dispatched or uses the safe
split. Calls, repairs, output caps and cost authority are unchanged.

Page-scoped final-structure diagnostics now carry a required closed `causes`
array. Causes are forbidden on all other diagnostic shapes, including an
untrusted page represented by a collection-item locator. The closed values map
only to real base/vNext validator producers. Duplicate diagnostic identities
union and sort their causes deterministically.

Diagnostic identity remains exactly family + code + locator. Cause changes do
not create new identities, inflate counts, alter transition state or change
routing. Raw validation prose, drafts, prompts, provider output, identifiers,
paths, stacks, credentials and secrets are not persisted.

The nested attempt-diagnostics authority advances from v2 to v3. Receipt and
readiness advance from v33/v31 to v34/v32 and register their immediate
predecessors as immutable legacy authority. Authoring request v30, policy v12,
Book Surface v4 prompt/schema, candidate v9, B0/materialization, Supervisor,
Fresh Readiness, child-output authority and QA bridge versions remain
unchanged.

## Regression contract

The focused regressions prove:

- 126 structural messages plus eight presentation targets build one typed
  authority and survive sanitization;
- more than 128 messages inside one page/scope still reject;
- exact byte accounting, not aggregate item count, decides route admission;
- the live-shaped twelve-page route becomes `initial -> book_surface_patch ->
  book_surface_patch -> candidate` in exactly three calls/two repairs with
  `[40000, 32000, 36000]` and no fourth call;
- the second Book Surface patch carries null cover/props, no presentation
  targets and all twelve exact structural pages while preserving action
  coverage;
- every closed structural cause is backed by a validator producer;
- page causes are required, sorted, unique and closed, and forbidden on other
  issue shapes;
- normalization unions causes without changing issue identity, unique counts
  or persistent/new/resolved transitions;
- lifecycle cloning and receipt/readiness persistence preserve the current
  bounded evidence; and
- v33/v31 are legacy immutable while current writers emit only v34/v32.

## Validation

- Final affected set: **11 files / 554 tests PASS**.
- Focused lifecycle: **90/90 PASS**.
- Focused diagnostics after adversarial correction: **20/20 PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Internal read-only adversarial review:
  - first pass: 0 BLOCKER / 0 MAJOR / 1 MINOR for one unreachable closed cause;
  - correction: removed the dead cause and added an exact producer census;
  - version and post-correction reviews: PASS, 0 BLOCKER / 0 MAJOR / 0 MINOR.
- One literal `npm run check`, exactly once and without retry:
  - TypeScript and autonomous-story typecheck: PASS;
  - ordinary files: **262 passed / 16 skipped / 4 failed**;
  - ordinary assertions: **3,242 passed / 65 skipped / 5 failed**;
  - resource-intensive assertions: **20 files / 599 tests PASS**;
  - Vitest then reported one internal `onTaskUpdate` RPC timeout, so the
    resource phase and overall command exited `1`;
  - both diagnostic protocols remained valid.

The five ordinary failures are the established missing ignored-output fixture
HOLD only:

- `child-lexicon-ages-5-8.spec.ts` — one missing story fixture;
- `momentum-gate-koko.spec.ts` — one missing page-beats fixture;
- `page-entity-qa.spec.ts` — one missing PNG fixture; and
- `story-read-back-validation.spec.ts` — two missing story fixtures.

Those files are unchanged. Neither the fixture HOLD nor the Vitest RPC timeout
is waived or presented as a green repository gate.

## Independent QA

Independent Claude Code review of the immutable base-to-head range is pending.
It must falsify aggregate admission, retained per-scope/byte boundaries, closed
cause completeness and privacy, stable identity/count/routing semantics,
version/legacy bindings, the exact three-call candidate regression and all
unchanged budget/provider policies. Codex does not self-award technical PASS.

No push, Fresh Readiness, credential access or provider call may occur before
that review passes and any valid finding is re-gated.

## Boundaries and rollback

After the consumed attempt, implementation and validation used no credential,
provider, network, Fresh Readiness, preflight, live authoring, image, Vision,
render, storage/database, deployment, production or push boundary.

Rollback is a focused revert of the implementation and documentation commits.
Historical artifacts need no migration or rewrite. The consumed live authority
must never be replayed; any later paid boundary requires the pushed,
independently reviewed head and brand-new Fresh Readiness.
