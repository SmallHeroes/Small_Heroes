# R1D Set Board Reserved Page Placement Authority — Decision Gate

**Date:** 2026-09-01

**Owner authorization:** Guy explicitly authorized continuous diagnosis and completion of the
new-story Wizard path, including general corrections, credentials, provider work and paid renders
once the path is stable. This gate narrows that authority to an offline correction followed, only
after independent technical PASS, by one LOW successor Board mint and one Vision QA call.

**Branch/worktree:** `codex/r1d-order-package-authority-binding` /
`C:\GNart\Work\sh-order-package-authority`

## 1. Observed behavior and root cause

The new `set_kindergarten_route` Board was minted once under Set Definition
`6a9b573a9df25f02137714287db99e84cd60de5bb016a8abb961fa5c6311745f`. Vision QA failed it with
`excluded-prop:prop_moon_lantern`. Independent visual inspection confirmed a real defect: a
decorative cage light hangs from the permanent courtyard hook before page 7 installs the story's
paper moon lantern there.

The provider did not bypass an existing rule. Current Board authority blocks recurring-prop
identity but does not represent the physical availability of an authored page-placement anchor.
The ambient-dressing policy therefore permits a fixed practical light to occupy a hook that later
page authority needs. This is a missing structured Board projection, not a legacy resolver,
fallback, Registry, authoring-repair, budget or retry failure.

## 2. Proposed general correction

Add an optional, hash-semantic `set-board-reserved-empty-placements/v1` projection to
`SetDefinition.contentPolicy`. Definitions with qualifying reservations use the additive
`set-board/v7` / `set-board-content/v6` tier; definitions without them keep their exact v6/v5
shape. A reservation is derived only when all of these typed facts agree on one page:

1. a positive `actionRequirement` uses the closed predicate `places`;
2. its typed object is a recurring prop;
3. exactly one `required` `propConstraint` for that exact prop names a nonempty location
   `anchorId`;
4. the page location belongs to the projected physical Set; and
5. the prop is not a declared stable fixed Set object.

Zero exact anchored constraints mean the action has semantic intent but no physical-placement
authority and therefore creates no reservation. More than one exact candidate is ambiguous and
fails closed. The compiler groups exact `(locationId, zoneId, anchorId)` pairs, retains the
contributing prop IDs, sorts them deterministically, and omits the policy entirely when no
reservation exists.

Provider-facing prompt and QA prose use deterministic local `Area N` / `point K` aliases plus the
exact natural-language `LocationAnchor.description`, because the image model needs to know which
physical point stays free. Canonical location, zone, anchor and prop IDs remain internal authority
and are not emitted. The code must not invent a relationship between a `LocationAnchor` and a
similarly named stable `SpatialNode`, because they are separate structured domains.

The Board prompt must preserve the fixed surface/fixture itself while keeping its exact placement
point visibly available. Ambient dressing, including fixed practical lighting, remains allowed
elsewhere. Board QA emits the closed `reserved-placement-occupied:area-N:point-K` category for an
ambient/fixed object that hangs from, mounts on, parks on, is stored on, or blocks that placement.

## 3. Why this scope is the smallest safe one

- It does not infer `installed`, `hung`, or other semantics from `mustShow`, `propState`, anchor IDs,
  names or descriptions.
- It does not reserve every surface touched by every prop. Only the existing closed `places`
  action plus same-page exact required-anchor binding activates the policy.
- It does not name Chameleon, lantern, hook, kindergarten, Bar, page 7 or any story digest in
  production logic.
- It preserves fixed Set objects: a stable fixed object is never reclassified as a vacancy.
- The exact Chameleon Home pages contain no qualifying `places` action, so the Home v6 Definition,
  prompt, content digest, hash, passed Registry and bytes remain identical.
- The route has qualifying typed placements, including the page-7 lantern/hook binding, so it gets
  a new v7 content digest, Definition hash and Registry path.

## 4. Compatibility cutover and replay

The previously approved legacy Chameleon package also contains one qualifying placement in its
Town Set. Reinterpreting every v6 definition under the new rule would silently invalidate that
approved package. Therefore v6 semantics are immutable:

- new/default projection selects v7 only for a Set with at least one qualifying reservation;
- package qualification/promotion replays the exact Board version already frozen in
  `requiredBoards`;
- a package-backed Order loads that immutable package and re-derives its exact Board inventory;
  neither a Registry row nor a cached/existing binding may select or downgrade the version;
- fresh mint, new approval and same-byte recheck remain forward-authority operations. A stale v6
  Registry row that now qualifies for v7 cannot be newly approved or rechecked under the weaker
  prompt. Already-approved v6 bytes remain replayable only through their trusted immutable package;
- time-only successor/rebind lifecycles inherit a supported v6/v7 tier only from their exact
  verified source package;
- an unsupported or mismatching frozen version fails closed.

This is a versioned compatibility tier, not a story/source/positive-authority allowlist. It keeps
both approved legacy v6 package identities reproducible while allowing a fresh package to bind the
route v7 successor.

## 5. Preservation and lifecycle rules

The failed Registry JSON and content-addressed asset SHA
`38cef357e90900428b4a8571b0eb24e4bb9d4a7f8d6477bae6f3a01ec84b7009` are immutable evidence.
No same-byte recheck is permitted because the visual defect is genuine. No file at the old
`6a9b573a...` Registry path may be overwritten or deleted. A legal successor requires a different
Set Definition hash and path before any new mint.

Existing definitions without qualifying reservations omit the new policy and remain byte/hash
compatible. Existing v6 package/binding replays remain v6 even if their historical contracts now
match the new derivation predicate. The approved bridge, effective d963 template, Story Source,
reconciliation and candidate artifacts are inputs only and must remain byte-identical.

## 6. Files likely affected

- `lib/set-identity-board/types.ts`
- `lib/set-identity-board/setDefinition.ts`
- `lib/set-identity-board/positiveAuthoritySpoilerGuard.ts`
- `lib/set-identity-board/boardPrompt.ts`
- `lib/set-identity-board/boardQa.ts`
- `lib/set-identity-board/resolveBoards.ts`, `expectedIdentity.ts`, Registry and admission helpers
- `lib/visual-package/artifacts.ts`, candidate qualification/finalization and exact migration,
  qualification and promotion callers
- Wizard preflight and package-backed Order Set Board stage
- `scripts/mint-set-identity-board.ts`
- focused Set Board specs and mint-tool regression coverage
- `CURRENT.md` and one implementation-evidence document

No Story Source, template, bridge, reconciliation, Visual Package, locator, Order, Wizard UI,
payment, renderer, database or deployment file belongs in this milestone.

## 7. Acceptance criteria

1. Qualifying typed `places + required anchor` pairs project one deterministic reservation per
   exact anchor; duplicates aggregate deterministically.
2. Wrong predicate, negative action, non-prop object, forbidden/unanchored constraint, different
   prop, other Set and stable fixed prop are counterexamples and produce no reservation.
3. Prompt and QA locate reservations through deterministic local `Area N` / `point K` aliases and
   exact natural physical anchor descriptions, without emitting canonical internal IDs or blocked
   prop identities/names.
4. No code guesses an anchor-to-spatial-node mapping from IDs or prose.
5. Fixed practical lights on non-reserved posts/walls remain explicitly allowed; only occupancy of
   the reserved point is forbidden.
6. Exact d963 replay keeps Home v6 at `48bf9d53437746e27026a9b975b5fb6d35954f4a46782bb2f064380147fa0926`
   and changes only the route to v7 Definition/content/prompt identities.
7. Both approved legacy Chameleon v6 packages reproduce their frozen Board identities rather than
   adopting v7. Registry/cache/binding state alone cannot request that replay, and stale mutable
   v6 approval/recheck paths fail closed.
8. The old failed route Registry and asset remain byte-identical and no successor path exists
   during the offline milestone.
9. A real mint refuses to spend when the target Registry path already exists and publishes the
   successor entry create-only, so a same-hash rerender cannot overwrite evidence.
10. Focused Set Board and bridge suites, TypeScript, autonomous typecheck and diff checks pass.
11. Claude Code Opus/max independently falsifies the committed range before any second route image.
12. After PASS, exactly one LOW route successor may be minted with retry/reroll zero. It must get a
    new hash/path and its image plus automated QA evidence must be inspected before human approval.

## 8. Rejected alternatives

- Do not recheck or relabel the known-bad bytes.
- Do not strengthen the prompt with a story-specific `no lantern on hook` sentence.
- Do not parse installation meaning from free prose, IDs or English keywords.
- Do not reserve every anchor used by every visible prop.
- Do not overwrite the failed Registry entry or reuse its Definition hash.
- Do not globally bump Board/Registry identities or invalidate unaffected approved Boards.
- Do not reinterpret a frozen v6 package/order as v7.
- Do not couple v7 eligibility to story identity, Source revision or positive-authority matcher
  version.
- Do not rerender the Home Board when its effective Definition remains unchanged.
- Do not retry/reroll a failed successor automatically.

## 9. Cost and rollback

The implementation and validation milestone is offline and costs $0. After independent PASS, one
LOW image call, one content-addressed upload and one Vision call are authorized for the route
successor. No page, cover, audio or book render is authorized by this gate itself.

Rollback is the focused code/docs commit. Because no provider work occurs before PASS and the new
field is optional, rollback requires no data migration. If the one successor fails, preserve it as
new immutable evidence and stop for diagnosis rather than retrying.

## 10. Stop-check

1. **General system fix?** Yes: typed placement availability for every story/Set.
2. **Cross-story risk?** Optional and activated only by an exact closed-action/constraint join;
   hostile counterexamples and historical hash locks cover it.
3. **Production behavior changed?** Only Board projection/prompt/QA for qualifying placements.
4. **Spend before proof?** None.
5. **Smallest proof?** Pure projection/prompt/QA tests plus exact d963 offline replay.
6. **Unresolved product choice?** None; the product requirement is that a future page-placement
   point must not already be occupied in the reusable base Board.
7. **Independent falsification?** Claude must attack derivation joins, policy omission, prompt
   egress, fixed-light counterexamples, historical identities and failed-evidence preservation.
8. **Guy visual gate?** Still required for the exact clean successor image before Board approval.
