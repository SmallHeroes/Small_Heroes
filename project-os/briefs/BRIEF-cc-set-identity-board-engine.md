# BRIEF (CC) - SET-CONSISTENCY step 2: Contract-bound Set Identity Board

## 1. ROUTING + GATE
- **Executor:** Claude Code (CC). **Target:** `feat/chunked-generation` in the `sh-wt-style01` worktree.
- **FIRST:** record `git branch --show-current`, `git rev-parse HEAD`, and `git status --short`. The branch must be `feat/chunked-generation`; use one CC session only.
- **Prerequisite:** the fox contract correction is already present: balcony + window + railing, **no balcony door**, and no remaining `window/door` ambiguity.
- **Gate:** **[CODEX-GATE]**. This changes the frozen-contract boundary, chunk resume semantics, and paid image-reference assembly. CC may commit the three green milestones below, but must STOP after static verification. No board mint, 5-page render, production enablement, or 12-page render before Codex re-gates and Guy approves the spend.
- **Rollout:** hard-OFF in Vercel production. Staging/preview only behind a new explicit flag plus the existing visual-contract gates. Flag OFF must be byte/behavior-identical to the current render path.

## 2. ARCHITECTURAL DECISION
The primitive is:

1. **Contract-v2 topology = semantic authority** (what exists, opening kinds, geometry and relations).
2. **Set Identity Board = visual authority** (the recurring set's design, materials, palette and geometry).
3. **Isolated prop refs remain authoritative for state-critical props.** Do not weaken the bucket/prop locks that already work.

The Set Identity Board is a character-free reference artifact containing one empty canonical establishing view plus 1-2 neutral alternate views/details of the **same** set. It is not a page background, not a previous-page image, not plate compositing, and not a chain from page N to page N+1.

### Two distinct durability layers
- **Global approved registry:** one reusable board per approved set/style definition. The image is in durable object storage; an approved sidecar/registry entry is shared across orders.
- **Per-order binding:** after the per-order contract is frozen, bind that exact contract to the already-approved board and persist the binding atomically in `pipelineCache`. Never mutate the frozen contract.

### Critical cache-key rule
Do **not** key reusable boards by the full `contractHash`. The frozen Resolved contract includes per-order family appearance, so that would remint the same balcony for every child.

Add a pure `computeSetDefinitionHash(...)` over only set-relevant canonical data:
- schema/board version, `storyKey`, `styleId`, `setIdentityId`;
- grouped location descriptions, lighting, anchors/topology;
- the grouped zones' typed spatial nodes/relations and their deterministic geometry projections;
- fixed set facts that the board must depict.

Explicitly exclude child/family/human appearance, cast identity, page camera/action, transient prop state and order data. The global key is `(storyKey, setIdentityId, styleId, setDefinitionHash, boardVersion)`. The per-order binding additionally records the full frozen `contractHash`.

## 3. SOFT-LAUNCH SCOPE
- **Bank stories only.** They already have approved templates and frozen contracts. Non-bank/dynamic stories remain on the current legacy path; do not add a live LLM or per-order board mint to the customer pipeline.
- Boards are minted **offline**, vision-checked, then explicitly approved by a human. The paid render worker only resolves, verifies and binds an approved artifact. It never generates a board and never waits for human review.
- Missing board data is a no-op only for a story/location that did not opt in. Once a frozen contract opts into a required board, missing/unapproved/stale/hash-mismatched storage is a pre-render hard failure, never a text-only fallback.

## 4. DATA CONTRACT
### Contract fields
- Add optional `setIdentityId` to `VisualLocation`. Locations that are parts of one physical set may share it; otherwise default authoring is one identity per location. No paid-runtime heuristic may guess grouping.
- Keep and clarify the existing `setReference` rather than replacing it:
  - absent / `status:'none'`: legacy, board not required;
  - `status:'pending'`: an approved board is required from the registry before render;
  - `status:'ready'`: still must pass registry/hash/approval validation.
- The compiler/validator must carry and validate `setIdentityId`. Locations sharing an identity must not carry contradictory reference policies. The optional additive field must not require a contract schema bump unless existing version rules force one.

### Global registry entry
Use an approved story-bank sidecar or an existing shared registry pattern; do not use per-order cache as the global source. Minimum fields:
`registryVersion, boardVersion, storyKey, setIdentityId, styleId, setDefinitionHash, storageKey, assetSha256, promptHash, model, quality, qaStatus, qaCheckedAt, approvedBy, approvedAt`.

Prefer `storageKey` over an environment-specific permanent URL. Resolve the usable URL through the existing storage layer. `qaStatus` must be `passed` and human approval must be explicit; code must never auto-approve.

### Per-order binding
Persist a versioned context such as:
`mode, frozenContractHash, bindings[setIdentityId] = { setDefinitionHash, styleId, storageKey, resolvedUrl, assetSha256, boardVersion, approvedAt }`.

Snapshot `mode:'required-v1'` atomically when a **new** contract is frozen under the staging flag. A pre-existing/in-flight order with no snapshot stays legacy even if the environment flag later turns on. Conversely, an order already snapshotted as required must not silently drop the board on a later chunk. This prevents half-legacy/half-board books.

## 5. IMPLEMENTATION MILESTONES
Commit each milestone separately after focused tests pass.

### A. Pure schema + offline board engine (no live-path wiring)
- `lib/visual-contract-compiler/types.ts`, template/resolved validators/materializer/compiler: carry and validate `setIdentityId` and reference-policy coherence.
- Create a **new subsystem**, e.g. `lib/set-identity-board/`. Do not repurpose `lib/set-appearance/*`: that existing dev/QA object-grid board intentionally has different semantics and must remain unchanged.
- Implement pure set-definition projection/hash, board prompt builder, registry schema/loader/validator, board QA, and an offline mint/review command.
- Derive board content entirely from the approved contract. No fox/balcony/bedroom literals in reusable code. Do not reuse the story-specific `STYLE01_ZONE_SET_DERIVED_OBJECT_PREFIX` text in `lib/generate-image.ts`.
- Use the same illustration-style authority/model resolver/style refs as page generation; do not hardcode watercolor or a style unrelated to the order's `styleId`.
- Board prompt: zero people/characters/animals, zero action/pose, zero labels/text, no page composition, and no opening kind absent from the structured contract. The multi-view artifact must not contain panel borders/captions that could leak into pages.

### B. Additive tagged reference transport (still flag-OFF)
- Add an additive typed form such as `ReferenceAsset { kind: 'child'|'companion'|'other_character'|'set'|'prop'|'style'; url; assetSha256?; identityId? }`.
- Preserve existing `referenceImages: string[]` callers byte-identically. Do not perform a repo-wide breaking replacement.
- Convert tagged refs to the provider's ordered image array and prepend an explicit `Image N -> role` map. The `set` instruction must say: copy set identity/geometry/materials/lighting only; never copy camera, page layout, pose or composition.
- Carry role/order/hash into `style01Meta.referenceBreakdown` for proof and recovery observability.
- Required priority: child and present-character identity -> state/action-critical prop -> required set -> style. Style is evicted first. Never silently drop a required identity, prop or set ref; if the provider cap cannot contain all required refs, fail before spending the image call.
- Wire the existing `protectedSetSheetPaths` seam in `backend/providers/image.ts`, but select the board by the page/cover contract's `locationId -> setIdentityId`. Never pass another location's board.
- Cover parity is required when the cover resolves to an opted-in location. Pages and cover use the same tagged transport.

### C. Staging-only resolver/binder + chunk lifecycle
- Add `set_refs` to the chunk-stage constants and implement an idempotent resolver between DNA/freeze and cover. The paid path does **lookup/verify/bind only**, never mint.
- Fresh order: `text -> dna -> freeze contract + snapshot board mode -> set_refs -> cover -> page_images`.
- Update `deriveStartingStage`, normal transitions, and resume/crash paths. A worker resuming directly at `cover` or `page_images` must run a pre-image assertion that every required set identity is bound and hash-valid.
- Persist only the dedicated cache key with an atomic `jsonb_set`/established mutation fence. Do not write an old whole-cache snapshot and clobber concurrent fields.
- Binding is idempotent across retries. A crash after lookup or persistence must reuse the same approved artifact and never mint/choose another board.
- If an order already has any generated cover/page and lacks the persisted board-mode snapshot, keep that order legacy. Never introduce a board halfway through a book.
- Implement `isSetIdentityBoardEnabled()` with an explicit staging/preview flag and a hard production false. Add the environment matrix tests.

## 6. FAIL-CLOSED RULES
When `mode:'required-v1'`, block **before** cover/page provider calls on any of:
- missing identity mapping or registry entry;
- board not vision-passed or not human-approved;
- style, board-version or `setDefinitionHash` mismatch;
- missing/unreadable durable object or asset SHA mismatch;
- per-order binding's full contract hash not equal to the active frozen contract hash;
- required reference omitted by the reference budget/provider cap.

No branch may downgrade these to `setReference:none`, topology-only generation, a different board, or a soft QA note.

## 7. QA BOUNDARY
This brief may add a **staging/report-only set-consistency evaluator** comparing a rendered page with its board. It must not modify the Stage-1 safety/delivery hard-hold machinery in this step.

Clarify the two gates:
- **Pre-render machine gate:** missing/unapproved/hash-mismatched board = hard block.
- **Post-render visual proof:** door invention, railing/window/wall/floor redesign or composition drag = failed staging evidence/contact-sheet review. Do not claim these are production delivery holds unless a separate reviewed QA-enforcement brief wires them into `QualityEvidence` and readiness.

## 8. REQUIRED TESTS
### Pure/unit
- `setDefinitionHash` is identical for two family profiles/orders of the same set and changes when topology, opening kind, style, set identity or board version changes.
- Shared `setIdentityId` maps connected locations to one board; distinct identities never cross-wire.
- Ambiguous/contradictory set identity/reference data is rejected.
- Registry round-trip; unapproved, stale version, wrong style/hash and changed bytes all reject.
- Board prompt is contract-derived, character-free and contains no story-specific literals.

### Reference path
- Legacy string refs and flag-OFF output remain byte-identical.
- Tagged role ordering and Image-N role prompt are deterministic.
- Required prop and set refs survive style eviction; impossible required-ref budgets fail before provider call.
- Matching set ref reaches cover and every applicable page; close-up/state pages retain their isolated prop ref.
- Reference breakdown persists `setIdentityId`, role and asset SHA.

### Chunk/resume
- Stage order is freeze -> set_refs -> cover.
- Fresh, retry, crash-after-bind, direct-cover resume and direct-page resume all verify the same binding.
- Existing in-flight order without activation snapshot remains entirely legacy.
- Required mode cannot render with a missing/stale binding; frozen contract is never mutated.
- Production env is always OFF; preview/staging requires all flags.

Run focused Vitest specs, `npx tsc --noEmit`, then `npm run check`. Use the real local toolchain; report any environment-only skip honestly.

## 9. STAGING PROOF - ONLY AFTER CODEX + GUY APPROVAL
1. Offline-mint exactly one LOW/MEDIUM board for the corrected fox set; run board QA; Guy explicitly approves it; publish the approved registry entry.
2. Render a 5-page sample spanning threshold, wide balcony, railing action, bucket close-up and final wide. Selection is operator/test data, never production story-specific code.
3. Persist proof that every applicable call used the same board SHA and correct `setIdentityId`; topology block remains present.
4. Contact-sheet FAIL on any door, railing/window-frame redesign, wall/floor/layout drift, collage leakage, or repeated pose/framing caused by the board.
5. PASS requires the same set geometry/material/design with visibly different shots, poses and compositions. Pixel identity is not required.
6. STOP. A 12-page render needs a separate Guy approval after the 5-page PASS.

## 10. OUT OF SCOPE / DO NOT TOUCH
- No previous-page reference, chained crop, seed-only lock, fixed background compositing or plate renderer.
- No live LLM or per-order set-board generation on the paid path.
- No dynamic/non-bank rollout in this step.
- Do not alter `lib/set-appearance/*` behavior, Stage-1 safety, delivery/readiness holds, payment/money, reader UI, text, TTS or gender logic.
- Do not add fox-specific branches/prompts. Contract/story data may describe the fox; reusable code may not.
- No production enablement and no full-book image spend.

## 11. GIT HYGIENE + HANDOFF
- Explicit pathspecs only; NEVER `git add -A`. Preserve unrelated worktree changes. Guy pushes; never force-push.
- Final report per milestone: commit SHA, file diff, tests, feature-gate matrix, hash proof, resume proof, exact pre-render failure behavior, and confirmation of zero edits to excluded tracks.
- Then STOP for Codex re-gate.
