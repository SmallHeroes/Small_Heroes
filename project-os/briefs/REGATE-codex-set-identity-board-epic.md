# CODEX RE-GATE — Set Identity Board epic (Milestones A + B + C)

## 1. ROUTING + TARGET
- **Reviewer:** Codex (forensic gate). **Mode:** read-only static audit + concurrency/resume reasoning; cite `files:lines`.
- **Commits on `feat/chunked-generation`:** A `b99e0587` (schema + offline engine), B `766919f4` (tagged reference transport, flag-OFF), C `028b3514` (staging resolver/binder + `set_refs` lifecycle). **Diff range `885f2a22..028b3514`.**
- **Gate type:** **[CODEX-GATE]** — touches the frozen-contract boundary, chunk resume, and the paid image-reference array. This verdict decides whether the offline mint + 5-page render proof may begin. No mint/render has happened.

## 2. ORIGIN / CONTEXT
Your set-consistency ruling → this epic implements Contract-v2 topology (semantic) + a Contract-bound Set Identity Board (visual). Built per your rewritten brief: `setDefinitionHash` (set-only, excludes per-child appearance), offline-mint vs paid-resolve split, new `lib/set-identity-board/` subsystem, staging-only + prod hard-OFF, resume-safe. Cowork pre-verified: A's hash excludes cast/family/appearance/camera/propState + includes topology/style/identity/version; the only excluded-track touch is a single benign additive union member `set_identity_board_bound` in `readiness-manifest.ts` (a `DeliveryInputMutationReason` label mirroring `visual_contract_frozen`, inert for the safety/readiness decision).

## 3. VERIFY (prove each; cite files:lines)
1. **BYTE-IDENTITY WHEN OFF (the production-safety invariant).** `isSetIdentityBoardEnabled()` is hard-false on `isVercelProductionRuntime()` (call-time). With no per-order snapshot: `deriveStartingStage` yields the identical `dna → cover` sequence (never `set_refs`); no refs are added → provider array, prompt, and `style01Meta` are byte-identical to today. Confirm the OFF path is PROVABLY inert (the 1766 pre-existing tests all still pass is the claimed proof).
2. **`setDefinitionHash` foundation.** Invariant to child/family/appearance/camera/action/propState; sensitive to spatialNode/relation/opening-kind/styleId/setIdentityId/boardVersion. Global key `(storyKey, setIdentityId, styleId, setDefinitionHash, boardVersion)`; per-order binding additionally records the full `frozenContractHash`.
3. **Atomic binding (C).** The board binding uses `withDeliveryInputMutation` + content-addressed `operationKey` + single-key `jsonb_set` with NO read-window, and never `saveCache` (no clobber of concurrent writers). Confirm no lost-update.
4. **Resume / crash / half-legacy fence (BOTH directions).** In-flight order with no snapshot stays legacy forever; a snapshotted order never drops the board on a later chunk — all gated on the SNAPSHOT, not the env flag. fresh / retry / crash-after-bind / direct-cover / direct-page all resolve the SAME binding (idempotent, never a different board). The pre-loop assert is skipped ONLY at `set_refs` (the stage that creates the bindings — asserting there would deadlock), and the post-bind assert still precedes the first paid image.
5. **Fail-closed before render.** For a required-but-unavailable/unapproved/stale/hash-mismatched board, `SetIdentityBoardUnavailableError` is thrown BEFORE any provider call → order → `failed`. Confirm there is NO downgrade branch anywhere (no `setReference:'none'` fallback, no topology-only render, no alternate board, no soft QA note).
6. **B reference array + map + budget.** The `Image N → role` map is derived from the ACTUALLY-assembled provider array (`child → companion → … → set`), NOT the tagged subset (the confidently-wrong-map bug CC caught + locked by test). Cap = 4, `style` evicted first, and a required identity/prop/set is NEVER silently dropped — if required refs exceed the cap it FAILS before spending.
7. **The `readiness-manifest.ts` union touch** is inert for the safety/readiness decision (confirm it's only the `DeliveryInputMutationReason` label).

## 4. JUDGMENT CALLS (accept / reject — CC's deviations)
1. role/hash proof carried in a NEW optional sibling `referenceAssets`, NOT inside `referenceBreakdown` (which is `Record<string,string[]>` and is snapshotted → extending it would break byte-identity).
2. **Re-freeze:** a snapshot on a DIFFERENT `contractHash` with NO paid image yet is REPLACED (not failed-forever) — CC's argument: nothing was paid on the old set. Safe?
3. `assertBoardsBoundForRender` takes `styleId` (else a wrong-style binding would self-validate).
4. `activeFrozenContractHash` computed from cache (precedent `chunk-runner.ts:971`).
5. `interface → type` in A's `types.ts` (so `PipelineCache` stays structurally assignable to `Prisma.InputJsonValue`) — zero runtime change.

## 5. MIGRATION / DATA
No schema migration claimed: `currentStage` is a plain String column, `set_refs` added to `CHUNK_STAGES`, bindings live in `pipelineCache` (jsonb). Confirm no migration is required and no existing enum/column constraint is violated.

## 6. NO-REGRESSION (must hold)
1766 pre-existing tests green (the OFF-inertness proof). Zero edits to safety LOGIC, delivery/readiness DECISION, money/coupon, reader/text/TTS/gender, and `set-appearance/*` (only the benign readiness union member + the expected `image.ts`/`chunk-runner.ts` seams). Paid path byte-identical when OFF.

## 7. PROOF BOUNDARY (what static review can't prove)
The LIVE path is NOT tested end-to-end: no registry entry exists yet and mint is forbidden pre-gate, so nothing ran against real DB/Supabase; staging-with-flag-on currently fails closed at "no approved board" (the correct pre-mint behavior). So this re-gate is STATIC. The RUNTIME proof comes only AFTER a GO + Guy approves spend: mint one fox board → 5-page staging render (threshold/wide/railing/bucket-closeup/final) → QA must FAIL on a door / railing-design change / window-frame change / wall-floor drift / missing reference hash, and shots/poses must DIFFER across pages → only then 12 pages. Confirm the pre-mint fail-closed behavior is correct.

## 8. OUTPUT
Verdict **GO / NO-GO to proceed to the offline mint + 5-page proof**, with any P0/P1/P2 findings as `files:lines`, and explicit rulings on the five §4 deviations. Focus scrutiny on §3.1 (byte-identity OFF), §3.4 (resume/half-legacy), and §3.5 (fail-closed) — the parts that can silently hurt production.
