# R1D Book Surface v4 Presentation `mustShow` Freeze — Implementation Evidence

**Date:** 2026-08-17

**Status:** local implementation and focused validation complete; independent Claude Code technical PASS; unpushed; no new Fresh Readiness, provider, candidate, Wizard or render authority

## Topology

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-book-surface-v4-presentation-mustshow-freeze`
- Exact pushed and independently passed base: `c82ffff4218b188ad910c7b95c44cf34a4dc752e`
- Focused implementation commit: `10b10d40443ecfef26ee6163ff2b2a33f40a9c29`
- Production: untouched
- Implementation and test provider cost: `$0`

## Consumed evidence

The immutable consumed attempt is:

`C:\GNart\Work\sh-wt-r1d-output-budget\outputs\r1d-pure-structural-fresh-c82ffff4-20260817T185437313Z`

Its authoring receipt v33 is
`c300381151c48277022990f2d5dc5fa159efe76e83274abcbd9d9ee4e6fb20c4`,
and its readiness v31 is
`8d1b3fdb2f308f6e382956edec1363bf7c09d4179e834c8ebabbc21d7b5821a6`.
All three provider calls completed, two repairs were consumed, transport
retries were zero and fallback was false. Exact nominal/conservative cost was
`$1.460026 / $1.606041`.

The route was:

`initial -> page_spatial_reference_patch -> book_surface_patch`

The first attempt contained nine unique out-of-scope spatial-reference issues.
The compact spatial repair resolved all nine. The next validation exposed
twenty-one unique issues: eight closed-catalog presentation gaps, one cover
projection issue and twelve page final-structure issues. The Book Surface v4
provider response completed, but local atomic application rejected it with
`repair_output_target_identity_invalid` and identity
`presentation_requirement_repair_target_stale`. The receipt retained eighty-six
carried diagnostics plus one repair-output diagnostic. Supervisor v20 correctly
recorded child failure, exit `1` and null output authority. Candidate,
reconciliation, Blueprint, Wizard and render authority are absent.

All persisted content-addressed artifacts and preservation fences were
validated read-only. This was not a provider, transport, timeout, input-ceiling
or infrastructure failure.

## Root cause and diagnosis reconciliation

Book Surface v4 authorizes structural fields and exact presentation choices in
one response. A presentation choice is an exact compiler-owned pointer/value
pair into `pageContracts[*].mustShow`. The structural patch may also return the
complete `mustShow` array on that same page. The prior applier installed the
provider array and only afterward checked the exact presentation pair. A
shortened, reordered or rewritten array therefore made the already-authorized
selection stale after the paid response.

The raw provider response is intentionally not persisted, so the evidence does
not prove which page, pointer or returned text changed. It proves the invariant
class only.

An initial Claude diagnosis correctly located this coupling but proposed using
the post-structural provider string as the disposition value. Repository
reconciliation rejected that proposal because it would widen authority from an
exact compiler-permitted pointer/value pair to an arbitrary provider value. A
focused Claude recheck accepted the narrower correction: preserve the complete
compiler-owned `mustShow` array on each page where structural and presentation
authority overlap. This is enforcement of existing authority, not new creative
authorship.

## Implementation

`maskedSurface` now keeps overlapping target-page `mustShow` visible instead of
masking it as structural authority. Canonical before/after comparison therefore
rejects any accidental change to the frozen array.

`applyBookSurfaceRepairPatch` derives the presentation page set from the typed
compiler authority. When applying structural page patches it skips only
`mustShow` on those pages. The cloned current draft retains its complete array,
including ordering and every selected or unselected value. All other authorized
structural fields still apply. A structural page without a presentation target
still accepts its provider-returned `mustShow`.

Presentation patches then resolve their exact compiler-permitted pointers
against the one frozen array and write their already-authorized class/pointer/
value dispositions. Multiple targets on the same page share that array. Full
assembly and all validators still rerun after application.

The response parser now rejects any page structural patch whose `mustShow`
array contains a non-string item. This prevents malformed provider material
from being silently discarded at the overlap boundary.

No prompt, schema, policy, model, tier, reasoning, persisted authority version,
call/repair budget, output cap, timeout, retry, fallback, candidate semantics or
cost fence changed. Historical artifacts remain immutable and no migration is
required.

## Regression contract

The focused tests prove:

- changed selected and unselected values, shortened arrays, reordered arrays
  and empty arrays are all discarded on presentation-target structural pages;
- the exact original array and presentation disposition survive;
- camera and other authorized structural fields still apply on the same page;
- `mustShow` repair remains available on structural pages without presentation
  targets;
- two presentation targets on one page resolve against one frozen array;
- null and object `mustShow` entries reject during parsing;
- the input draft remains immutable;
- the live-shaped compiler route is exactly `initial ->
  page_spatial_reference_patch -> book_surface_patch -> candidate` in three
  calls/two repairs, with the target-page provider array deliberately shortened;
- the lifecycle candidate path retains `[40000, 32000, 36000]`, and no provider
  sentinel is persisted in the receipt; and
- no fourth call, retry, fallback or issue waiver is introduced.

## Validation

- Focused set: **3 files / 147 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Internal read-only adversarial review:
  - first pass: HOLD on malformed non-string `mustShow` acceptance;
  - correction: parser string-item guard plus null/object regressions;
  - micro re-gate: PASS, 0 BLOCKER / 0 MAJOR / 0 MINOR.
- One literal `npm run check`, exactly once and without retry:
  - TypeScript and autonomous-story typecheck: PASS;
  - ordinary: **262 files passed / 16 skipped / 4 failed**;
  - ordinary assertions: **3,238 passed / 65 skipped / 5 failed**;
  - resource-intensive assertions: **20 files / 599 tests PASS**;
  - after those assertions, Vitest reported two internal
    `onTaskUpdate` RPC timeouts, so the resource phase and overall command exited
    `1`;
  - both diagnostic protocols remained valid.

The five ordinary failures are the established missing ignored-output fixture
HOLD only:

- `child-lexicon-ages-5-8.spec.ts` — one missing story fixture;
- `momentum-gate-koko.spec.ts` — one missing page-beats fixture;
- `page-entity-qa.spec.ts` — one missing PNG fixture; and
- `story-read-back-validation.spec.ts` — two missing story fixtures.

Those files are unchanged. Neither the fixture HOLD nor the two Vitest RPC
timeouts are waived or presented as a green repository gate.

## Independent QA

The earlier Claude diagnosis and focused reconciliation established the safe
authority boundary but preceded the immutable implementation range and were not
treated as PASS.

Claude Code then independently reviewed exact immutable range
`c82ffff4218b188ad910c7b95c44cf34a4dc752e..eca0dc9ad73d733e0073fa03d55d8b075a8b8680`
in plan/read-only mode. It verified the exact two-commit, six-file, clean,
unpushed topology and returned **PASS** with **0 BLOCKER / 0 MAJOR / 0 MINOR**.
It explicitly confirmed:

- the overlap-only complete-array freeze;
- the non-target-mask and apply dual guard;
- continued non-overlap `mustShow` and same-page other-field authority;
- multiple same-page exact pointer/value/class semantics;
- fail-closed non-string parser rejection;
- input immutability and surviving stale/non-target/full-validation guards;
- the three-call lifecycle candidate and output caps;
- unchanged prompts, schemas, policies, versions, models, budgets, retries,
  fallback and cost fence; and
- honest treatment of the five fixture failures and two Vitest RPC timeouts as
  a non-green repository gate.

Claude did not rerun tests, edit, stage, commit, push or access any external
boundary. Its two advisories were nonblocking: one redundant integer guard and
one safe future-shape observation about a presentation-only page.

This technical PASS does not itself authorize product acceptance, production
or a render. Under Guy's standing execution authority, it satisfies the
prerequisite for push, new Fresh Readiness and one new bounded authoring
attempt.

## Boundaries and rollback

After the consumed attempt, no credential, provider, Fresh Readiness,
preflight, live authoring, image, Vision, render, storage/database, deployment,
production or push action occurred during implementation or validation.

Rollback is a focused revert of the implementation commit and documentation
closeout. Historical artifacts need no migration or rewrite. The consumed live
authority must never be replayed; any later provider boundary requires the
pushed independently reviewed head and brand-new Fresh Readiness.
