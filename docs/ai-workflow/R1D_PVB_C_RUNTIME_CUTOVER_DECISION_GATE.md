# Decision Gate — R1D-PVB-C Runtime Consumption and Single Authority Cutover

**Status:** APPROVED by Guy through the dedicated implementation-task delegation
**Immutable base:** `09cfb2f7429979a1e6576873db19b5471b7836e3`
**Implementation branch:** `codex/r1d-pvb-c-runtime-cutover`

## Decision and product intent

Cut the Style01-enforced sellable runtime over to the approved
`pre-render-book-visual-blueprint/v2`. The Blueprint is the sole authority for world,
location/zone, lifecycle/reveal, camera, composition, placements, spatial feasibility,
continuity, portrait framing, and text-safe planning. The resolved Visual Contract is a
verified projection/binding and owns exact per-order appearance plus verified world facts;
it is not a second composition authority.

## Binding decisions

1. Introduce immutable content-addressed `visual-package/v4` revisions. Each revision binds
   the exact Story Source snapshot, Blueprint and digest, authoring provenance, validation
   evidence, review packet, exact Guy planning approval, style authority and content,
   Visual Contract template and reconciliation, Boards, and prop references.
2. A mutable current locator is only a selector. Each order freezes an exact package revision
   and all source/Blueprint/approval/style identities. Later revisions cannot alter it.
3. Build a pure deterministic book/page projection from the frozen package, Blueprint frame,
   and resolved per-order appearance. Reuse the same frame and digest for cover, chunk, resume,
   retry, QA retry, single-page regeneration, and direct provider entry.
4. Under Style01 enforcement, bypass Storyboard, Director, inferred composition, shot plans,
   story locks, page intent, scene memory, story-location plans, raw image direction, and
   equivalent parallel authorities. Missing authority fails before planner or provider calls.
5. Blueprint owns framing, placement, action, and world composition. The resolved contract
   owns concrete per-order humans and wardrobe; Boards own appearance/geometry only; style
   authority owns rendering style. Free/operator text and structured QA corrections cannot
   replan composition.
6. Preserve the current versioned 2:3 policy exactly: cover text-safe top band and body-page
   text-safe bottom band. Reject unrepresentable frames without remapping or quantization.
7. Runtime evidence records exact package revision, Story Source snapshot, Blueprint, frame,
   planning approval, and style identities.
8. `visual-package/v3` stays historical and enforcement-off compatible, but cannot qualify for
   the enforced PVB path. PVB is coupled to the existing Style01 enforcement switch; no second
   flag and no production activation are introduced.
9. Rollback is explicit enforcement-off development compatibility. Sellable work must never
   silently fall back to v3, Storyboard, or Director.

## Observed system and root cause

PVB-A and PVB-B establish Blueprint schema, validator, authoring, immutable lifecycle,
review, and approval. No runtime consumer loads the Blueprint. The current qualification
path selects `visual-package/v3`, reloads mutable current Story Source/template artifacts,
and freezes only a resolved-contract hash. Rendering still invokes Storyboard and Director,
then sanitizes their result at the direct provider seam. Runtime evidence consequently lacks
exact package revision, Blueprint/frame, source snapshot, approval, and style identities.

The root cause is the intentional authoring/runtime boundary between PVB-B and this milestone:
no successor package, frozen order binding, or pure Blueprint projection existed yet.

## Scope and implementation sequence

- **PVB-C1:** immutable v4 package, selector/revision loader, strict promotion/qualification,
  frozen-order binding, and exact layout compatibility validation.
- **PVB-C2:** pure book/page projection, prompt/reference precedence, cover/page consumer
  cutover, and enforced-path removal of parallel planners/inference.
- **PVB-C3:** single-page/retry/resume/direct-route hardening, exact-frame observability,
  general regression coverage, and `CURRENT.md` handoff.

## Acceptance criteria

- Five general synthetic Story Source shapes use the same public path.
- Source changes create new immutable authorities and cannot mutate frozen orders.
- v3, stale/mismatched/missing package/Blueprint/approval inputs, and unrepresentable layout
  fail before provider reachability.
- Every render/retry/resume/regeneration route carries the identical package/Blueprint/frame
  identities.
- Enforcement never invokes Storyboard/Director or derives composition/text zones from
  legacy, story, Board, QA, or free-text inputs.
- Legacy enforcement-off development behavior remains available without activating
  production.
- Three separately green commits, final `npm run check`, clean unpushed branch, and
  independent read-only Claude Code QA handoff.

## Stop-before-major-actions result

- Goal, approval authority, immutable base, and write ownership are explicit.
- Repository call sites, fallbacks, overrides, tests, generated evidence, and worktree topology
  were inspected before edits.
- The minimal proving surface is code and local fixtures only. Cost allowance is $0 and the
  render allowance is zero images.
- No live authoring/model/provider/Vision/network call, credential use, database/storage write,
  Board mint, real promotion, production activation, deployment, push, PR, cleanup, story
  rewrite, or reader-layout redesign is authorized.
- Rollback is the focused local commits plus explicit enforcement-off development behavior;
  no sellable fallback is permitted.
