# Decision Gate — Blueprint Affordance Consumer Choice Authority

Date: 2026-09-01
Branch: `codex/r1d-order-package-authority-binding`
Decision: proceed offline under Guy's standing authorization to restore the clean Wizard path.

## 1. Proposed change

Replace provider-authored non-frame Blueprint consumer identities with bounded, compiler-owned
choices. The provider will return `{ kind, choiceIndex }`; the compiler will resolve that index
against a deterministic catalog built from the canonical Visual Contract and materialize the exact
`action`, `placement`, `transition`, or `safety` consumer identity.

The provider schema will permit only consumer kinds compatible with each affordance kind:

- `action_space` → `action`
- `placement_support` → `placement`
- `traversal` / `opening_clearance` → `transition`
- `safe_boundary` → `transition` or `safety`
- `camera_access` → no provider consumer; the existing compiler-owned camera reverse link remains
  unchanged

## 2. Why now?

The latest bounded paid run used the exact current program and completed all three provider calls.
It converged from 33 distinct validation issues to two, both
`affordance_incompatible` consumers on one affordance. The current v7 schema permits every
non-frame consumer kind on every non-camera affordance and asks the provider to copy canonical
page/check/prop/safety identities. The final validator then enforces a narrower kind mapping and
exact canonical targets. This duplicates authority and admits outputs that must fail after the paid
call.

Repository, request, receipt, execution-program, flag, fallback, and call-site audits found no
active legacy or duplicate route. Another paid retry would repeat an underconstrained contract.

## 3. Scope

General system change to Blueprint consumer choice authority, provider/repair wire projection,
draft schema, prompts, execution-program cutover, replay compatibility, diagnostics, tests, and
technical state. It names no story, child, companion, page, or concrete consumer ID.

## 4. Risk of hardcoding

Low if implemented through catalogs derived from canonical page contracts. The compiler may not
special-case Chameleon, Bar, Kim, page 8, affordance index 20, or either terminal diagnostic digest.
Choice bounds are checked at runtime because story-specific maxima do not belong in the static
Responses schema.

## 5. Files likely affected

- a narrow `preRenderBlueprintAffordanceConsumerChoices.ts` authority module
- `lib/visual-package/preRenderBlueprintDraftSchema.ts`
- `lib/visual-package/preRenderBlueprintAuthoring.ts`
- `lib/visual-package/preRenderBlueprintAuthoringContract.ts`
- `lib/visual-package/preRenderBlueprintProviderWire.ts`
- `lib/visual-package/blueprintAuthoringExecutionProgram.ts`
- focused Blueprint authoring/schema/program/replay tests
- `CURRENT.md` and milestone evidence

## 6. Expected behavior after change

The provider can choose semantic associations but cannot invent, copy, or drift canonical
`pageNumber`, `checkId`, `propId`, transition, or safety target identities. Wrong consumer kinds are
schema-inexpressible; invalid, duplicate, or out-of-range indices fail closed with complete
structural diagnostics. A normalized Candidate can be inverse-projected into the same choice space
for repair without changing diagnostic indices.

The final Blueprint type, validation rules, camera authority, model, budget, retries, fallback,
call count, and downstream Wizard/render contracts remain unchanged.

`frame.affordanceIds` remains visibility/membership authority rather than a source of reverse frame
consumers. Only `frame.camera.affordanceId` continues to mint the existing canonical camera reverse
consumer. Empty semantic affordances remain rejected by the existing schema/final validator; this
milestone does not silently delete them or invent a new global topology-orphan invariant.

## 7. Validation plan

Before any provider call:

1. prove deterministic, unique catalogs for action, placement, non-steady transition, and safety;
2. prove exact binding and no input mutation;
3. reject negative, fractional, string, duplicate, wrong-kind, and out-of-range choices with a
   collect-all structural census;
4. prove Candidate → normalized inverse projection → repair wire → reassembly round-trips exactly;
5. prove assembly-failure choice drafts remain repairable and unknown canonical consumers cannot be
   dropped;
6. prove camera frame consumers remain byte-equivalent and compiler-owned;
7. run a production-scale cover + eight-page stub harness through invalid choice → repair → valid
   Candidate within the existing three-call/two-repair policy;
8. freeze v6/v7 schema, provider wire v1, repair wires v2/v3, prompts, and program
   `1bd60e8c...` as replay-only; reject mixed current/legacy programs;
9. replay immutable paid evidence without credentials or mutation;
10. run focused suites, `npx tsc --noEmit`, `git diff --check`, and the repository check
    proportionately.

## 8. Cost impact

This milestone costs $0: no provider, input-token endpoint, image, audio, live authoring, or render.
After independent QA PASS, one new Fresh Readiness may authorize one ordinary live attempt under the
unchanged three-call/two-repair/$5/retry-zero/no-fallback policy. Guy has separately authorized a
full render only after the route is stable and a valid Candidate reaches the Wizard path.

## 9. Rollback plan

Revert the focused commit. Frozen execution programs, legacy schemas/wires, and immutable paid
artifacts remain byte-preserved and replayable. No database or artifact migration is required.

## 10. Review assignment

No unresolved product decision remains. Guy already authorized a general, long-term technical fix,
Claude consultation, one bounded live attempt after PASS, and a full render after route stability.

Claude Code must independently try to falsify catalog completeness, choice/index stability,
kind-specific schema closure, normalized repair projection, assembly-failure recovery, diagnostic
sanitization, camera non-regression, legacy byte preservation, mixed-program rejection, and the
cover + eight-page offline proof.

Claude Cowork is not required: this milestone changes technical identity authority, not story,
visual, UX, or creative direction. Guy should eyeball the first resulting rendered book after the
technical path succeeds.

## 11. Do not do

Do not weaken final validation, derive frame consumers from general frame membership, silently drop
or delete incompatible consumers, add a story/page-specific patch, add calls/retries/fallback,
change model or budget, mutate immutable evidence, call a provider, or render before offline green
and independent Claude PASS.
