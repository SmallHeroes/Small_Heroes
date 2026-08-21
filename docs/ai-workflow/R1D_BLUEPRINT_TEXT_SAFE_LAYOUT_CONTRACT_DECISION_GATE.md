# Decision Gate — R1D Blueprint Text-Safe Layout Contract Closure

**Status:** APPROVED by Guy on 2026-08-21; implementation completed locally, independent technical QA pending
**Branch/worktree:** `codex/qa-wizard-presentation-dispositions` / `C:\GNart\Work\sh-wt-r1d-output-budget`
**Immutable investigation HEAD:** `bb37be96925b2c4a63a4a9d1e59dea3e91af9a84`
**Cost/render allowance:** `$0`; zero provider, Vision, image, audio, database, storage, deployment, or render calls

## 1. Proposed change

Close the general contract gap that lets a Blueprint validate successfully while carrying text-safe geometry that Visual Package v5 and the runtime cannot represent.

1. Introduce one neutral, shared portrait text-safe policy used by Blueprint authoring/validation, Visual Package layout validation, and the runtime canvas boundary.
2. Make the Blueprint authoring compiler own the canonical policy value: cover `{x:0,y:0,width:1000,height:250}` and body page `{x:0,y:750,width:1000,height:250}`.
3. Remove `textSafeRegion` from provider-authored structured output. The model still receives the exact keep-clear bands in the initial and repair prompts so it must place key evidence outside them.
4. Make Blueprint validation reject any frame outside the shared supported policy and retain the existing collision gate.
5. Make runtime representability use the same shared policy predicate as Visual Package. It may validate the already-approved policy range, but it must never remap or quantize a frame.
6. Regenerate the Chameleon Blueprint offline from the existing local deterministic evidence, persist a new review packet, and stop for Guy's exact-digest Blueprint re-review/reapproval before any package approval or Wizard action.

## 2. Why now?

Both required Chameleon Set Boards v6 are approved. The exact zero-write production assembly now reaches the real Visual Package v5 boundary and fails only because the approved Blueprint has `{x:0,y:0,width:1000,height:240}` on its cover and all eight pages.

The current authoring schema permits any bounded region, the prompt says only “text-safe layout”, and the Blueprint validator checks bounds/collisions but not the downstream fixed band. The package requires a top cover band and bottom body band. The runtime contains a second, narrower hard-coded check. This is a systemic contract gap, not a Chameleon-specific content failure.

## 3. Scope

**General system change**, plus one ignored local Chameleon evidence regeneration after the general fix.

No story prose, Visual Contract, reconciliation, Set Board, prop reference, style authority, reader layout, payment, production activation, or deployment behavior changes.

## 4. Risk of hardcoding

The production correction is keyed only by the closed frame kinds `cover|page` and the shared portrait layout policy. It does not contain a story, child, companion, location, page number, or Chameleon-specific branch.

The existing Chameleon offline authoring evidence is story-specific by design. Its regenerated draft is evidence, not reusable production logic or a runtime fallback.

## 5. Observed behavior, root cause, and evidence

- Approved Blueprint: `e473e9e965b5439b8aabee22cff45bc103348eb7294e962b070ab1628152dabd`.
- Existing planning approval: `f48affee3fdbf9db826c19ccbb99a65047a604b21ba3ad3cce18e9d56449a3ba`.
- Zero-write `assemble-v4` result: nine layout errors, exactly cover plus pages 1–8.
- Every approved frame carries the top region with height `240`.
- Applying only the canonical bands to the approved Blueprint produces 16 `text_safe_collision` issues.
- A read-only/in-memory authoring migration that applies the canonical bands and uniformly scales all Blueprint-authored normalized region geometry vertically by `0.75` produces diagnostic Blueprint digest `7d3fa4d0718de401323b2375ad3818e10e607932de356bcd58a8106dc183f883` with **zero Blueprint validation issues**. This digest is diagnostic only; it is not persisted or approved authority.
- Board resolution has zero issues and selects exactly:
  - Home definition `803dea01a0346579b0e38160cd683acfa09966daecf90d945389da4a3a67d172`, asset SHA `7a782c72b86ceb07ba631def11d40b520b4753d97a63e8430a2fcb32180d7189`;
  - Town definition `5b1917ceec616cd9c8613f8075f2a7b3426c96e9549eaeef40f2381eb550b9dc`, asset SHA `41580dfa9ea11a8dd5c6027ffd5cc5a46f5afe0bfc6eae62c047d00cd05a751e`.
  Older Home v4/v5 entries are not selected.

The independent Claude Code diagnosis returned HOLD on package/Wizard/render and PASS on the systemic diagnosis. It specifically confirmed that package/runtime remapping is forbidden, while deterministic policy overlay before Guy's Blueprint approval is the correct authority boundary.

## 6. Files likely affected

Production, expected:

- `lib/visual-package/preRenderBlueprintLayoutPolicy.ts` (new neutral policy/helper)
- `lib/visual-package/preRenderBlueprintTypes.ts`
- `lib/visual-package/preRenderBlueprintDraftSchema.ts`
- `lib/visual-package/preRenderBlueprintAuthoring.ts`
- `lib/visual-package/preRenderBlueprint.ts`
- `lib/visual-package/visualPackageV4.ts`
- `lib/generation-pipeline/runtime-blueprint-canvas.ts`
- `lib/visual-package/index.ts`

Tests, expected:

- `lib/visual-package/__tests__/pre-render-blueprint-authoring.spec.ts`
- `lib/visual-package/__tests__/pre-render-book-visual-blueprint.spec.ts`
- `lib/visual-package/__tests__/openai-responses-structured-output-schema-compatibility.spec.ts`
- `lib/visual-package/__tests__/production-package-lifecycle.spec.ts`
- `lib/visual-package/__tests__/visual-package-v4.spec.ts`
- `lib/generation-pipeline/__tests__/runtime-world-authority.spec.ts`

Evidence/docs:

- `CURRENT.md`
- a focused implementation-evidence document
- ignored local Chameleon Blueprint draft/lifecycle artifacts under the existing output root

The exact final file list must remain limited to what implementation and tests prove necessary.

## 7. Version and compatibility plan

- Bump the Blueprint authoring authority, draft schema, initial prompt, repair prompt, and authoring provenance versions because their authority/structured-output semantics change.
- Bump the final Blueprint version if implementation would otherwise reinterpret an immutable current Blueprint contract. Claude Code should falsify the chosen boundary during QA.
- Keep Visual Package v5 and its current layout-policy bytes if runtime is widened only to the already-approved package range. If implementation tightens or changes the package policy bytes instead, stop and return for an explicit Visual Package version/cascade decision.
- Existing Chameleon Blueprint and approval remain immutable historical evidence and must not be rewritten. They cannot authorize the regenerated digest.
- No production migration is required because no approved Chameleon Visual Package or Wizard authority exists yet.

## 8. Expected behavior after change

- An authoring-produced zero-issue Blueprint is representable by both Visual Package and runtime layout validation.
- Provider output cannot choose or mutate the text-safe policy.
- Key placements that overlap the compiler-owned band fail during Blueprint authoring/repair, before approval or package assembly.
- Package/runtime continue to reject instead of remapping.
- Re-running the existing Chameleon draft authoring offline creates a new valid Blueprint and review packet with zero provider calls.
- The old Blueprint approval is rejected for the new digest.
- No package or Wizard authority is created until Guy approves the exact regenerated Blueprint review packet.

## 9. Validation plan

Minimum code proof:

1. Canonical cover/page bands pass Blueprint, package, and runtime checks.
2. Old height `240`, a page top band, malformed geometry, and a bottom-band collision fail closed.
3. The authoring overlay ignores/forbids a caller-authored text region and stamps the correct policy by frame kind.
4. Initial and repair prompts state the exact keep-clear authority; structured schema no longer authors the field and remains OpenAI-compatible.
5. Package and runtime accept/reject the same supported policy population; no remapping occurs.
6. The existing production-package fixture stops overwriting Blueprint regions solely to hide the seam.
7. Stale Blueprint/provenance/validation/review/approval combinations are rejected.
8. Exact Home/Town v6 Board identities remain selected with zero Board/prop issues.
9. Focused suites, `npx tsc --noEmit`, one literal `npm run check`, and `git diff --check` pass.

Minimum real-artifact proof, still `$0`:

1. Regenerate the Chameleon Blueprint lifecycle into new content-addressed paths; never overwrite old artifacts.
2. Blueprint validation reports zero issues, including zero text-safe collisions.
3. Zero-write `assemble-v4` returns a candidate and review with the exact two approved Board identities.
4. Zero-write `qualify-v4` without package approval reports valid candidate/review but not publication approval.
5. Guy reviews the new Blueprint packet/contact sheet and gives an exact-digest planning approval.

## 10. Cost impact

Implementation, tests, Blueprint regeneration, package assembly, and qualification preview cost `$0`.

Image/render allowance is zero. If any Blueprint regeneration step unexpectedly needs a provider, stop and return to Guy with the exact reason and proposed spend.

## 11. Rollback plan

- Revert the focused code/docs commit(s).
- Delete only the newly generated ignored Chameleon lifecycle artifacts after proving their exact paths and preserving prior artifacts.
- Existing Blueprint, approval, Set Boards, Visual Contract, reconciliation, and Story Source stay byte-unchanged.
- No production locator/package/runtime state exists to roll back.

## 12. Review assignment

Guy decides:

- approve or reject this implementation gate;
- later, inspect and approve the exact regenerated Blueprint planning packet;
- separately approve any package promotion, Wizard render qualification, or image render.

Claude Code must try to falsify:

- that one shared policy drives authoring, validation, package, and runtime;
- that the schema/prompt/repair path cannot reintroduce free text-safe geometry;
- that no package/runtime remap exists;
- that policy-compatible legacy behavior is preserved or explicitly invalidated;
- that stale approvals cannot bind the new Blueprint;
- that old Home Board entries cannot shadow the approved v6 Board;
- that the real Chameleon zero-write assembly succeeds only after a collision-free regenerated Blueprint.

Claude Cowork is not required for the code change. Guy should inspect the regenerated Blueprint contact sheet because the vertical composition is intentionally compressed into the illustration area above the body text band.

## 13. Do not do

- Do not reuse or rewrite the old Blueprint approval.
- Do not normalize the approved Blueprint inside package/runtime.
- Do not wire the measurement-only storyboard scaler into production runtime.
- Do not change the Story Source, Visual Contract, reconciliation, Boards, style authority, price/model, or reader layout.
- Do not create package approval, Wizard authority, provider calls, images, deployment, release, or production state in this milestone.
- Do not stage the untracked Set Board Registry tree or ignored output artifacts.
