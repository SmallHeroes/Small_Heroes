# SmallHeroes — Roadmap

**Last verified:** 2026-09-03
**Product priority owner:** Guy
**Technical sequencing owner:** Codex

This roadmap records technical milestone state. Guy can change product priority at any time; Codex then updates the technical sequence, dependencies, and risks.

## Active

### R0 — Establish one engineering operating model

- **Goal:** make Codex the technical owner and primary implementer, Claude Code the independent technical QA, Claude Cowork the product/creative consultant, and Guy the product owner.
- **State:** adopted by Guy, Codex, Claude Code, and Claude Cowork. Canonical documentation is on `main`; it still must be preserved when the feature branch is integrated.
- **Done when:** Claude Code independently confirms that active instructions agree and Guy accepts the authority/source hierarchy.

### R1A — Correct and independently gate render-loop Phase 1

- **Observed repository state:** local `feat/chunked-generation` ends at `ef543312` and contains four implementation commits not in `main`. `npm run check` passes, but caller-level review found a release-blocking gap: persistent malformed/unverified QA can still reserve regeneration and render new bytes. The QA fetch also lacks its own timeout/AbortSignal. Candidate persistence has no shipped-caller regression test.
- **State:** NO-GO; no merge and no measurement render.
- **Done when:** evidence/transport failures recheck the same candidate and then hold without regeneration; only verified visual failure can reserve a new image; QA is bounded; candidate persistence order is tested on the shipped Style01 path; `npm run check` passes; Claude Code re-gates the whole slice.

### R1B — Add visual-package promotion and render qualification

- **Observed repository state:** the offline compiler, validators/materializer, frozen hash path, steering, world QA, and Set Identity Board engine already exist. Two visual-contract templates, one legacy contract, and one tracked Fox Set Board exist. There is no approved promotion operation or release gate that binds these artifacts to the current story source.
- **Catalog truth:** with `ENABLE_V3_APPROVED_BANK=true`, the current release check reports 18/18 product-sellable slots, not the historical 8/18. Only 2/18 have visual-contract templates, so nominal product sellability cannot authorize render.
- **Done when:** compile → review → Guy approval → promote is explicit; source identity and approval provenance are checked; `worldMode`, cover/page coverage, and required boards are mandatory; all nominally sellable slots receive a dry render-qualification report; missing/stale artifacts fail before cost.

### R1C — Make the frozen page plan the sole runtime world authority

- Add an explicit author/reviewer-owned `worldMode` for new render-qualified packages without inferring it from `adventure`, `bedtime`, or `fantasy`.
- Permit the Director to choose only camera, staging, and blocking within the page contract. World, set, cast, props, prohibitions, and transitions remain deterministic.
- Remove sellable-path dependence on the literal `home-night` cover fallback and generic derived locations.
- Keep Set Board registry keys story-scoped for now. Shared world kits are deferred until real reviewed reuse exists.
- Do not add a sequential runtime LLM memory layer; the complete frozen cover/page plan is the continuity state.

### R3 — Expand the render-qualified catalog

- **Current owner decision:** make all 18 stories currently offered by the Wizard render-ready; do not reduce this to a smaller launch subset.
- **R3-B owner decisions:** Guy selected the QA corpus as the review starting point for the 17 unresolved keys and chose to preserve all six fantasy stories at 16 beats.
- **State:** R3-A zero-cost, all-slot control plane, its exact-18 runtime correction, and its ambient-feature-flag test isolation all received independent Claude Code PASS with no open P0/P1/P2; the reviewed branch is pushed. R3-B0a, the bounded 16-page/80K Visual Contract policy with a universal 75,904 effective standard-route ceiling, received independent Claude Code PASS for `146bb53a..2b41750f`; its three P2 documentation/process notes were corrected in `2b41750f..9b944f4d` and that exact documentation-only range independently re-gated PASS with no P0/P1/P2. Guy pushed its closeout through `68795de8`, so R3-B0a is technically closed and published. R3-B0b's deterministic exact-17 QA Story Source/Visual Direction review batch at `8b0818fe` is pushed and independently QA-passed: digest `7a8434c76f90bc96776909430e93fecb97f2c8a08800085d0ba3e55d7f97a143`, 5/6/6 directions, 208 pages, all six fantasy stories at 16 pages, and zero external effects. Its valid P2 provider-capable static-import closure finding was corrected in pushed commit `018e1533` with a dependency-free companion-view contract plus eager/static-graph regression gates. Claude Code independently re-gated exact range `8b0818fe..018e1533` and returned PASS with no P0/P1/P2; its independent closure measurement found 84 local modules plus only `next`, `react` and `server-only`, 211 import-statement edges, 80 `require` edges, zero dynamic-import edges, and no forbidden package or local module. The repository fixture/RPC baseline remains honestly disclosed, and the unchanged readiness spec independently passed 11/11 in isolation. R3-B0b technical preparation is therefore closed. R3-B1a then produced exact, neutral, digest-bound correction candidates for the same 17 records: 388 Story Source replacements, 52 Visual Direction replacements, eight pending exact-review records, nine HOLD records, 13 unresolved creative/continuity issues, seven critical narration items, and 24 soft narration items. Claude Code independently passed implementation range `462aaf4c..85ef104c`; it then passed final documentation range `e7c7bf4a..e1df111f` with no P0/P1/P2. Candidate digest `96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b` remains review-only and 0/17 strict-ready. R3-B1a technical preparation is closed, while human acceptance remains pending and the catalog audit remains only 1/18 strict render-qualified.
- **Next zero-cost step:** Guy reviews the compact digest-bound R3-B1a decision packet: P1-P5/P7/P8 capture exact acceptance intent, P6 authorizes Cowork review before Guy's later exact decision, and D1-D13 cover every HOLD direction. After that first decision set, Codex may implement the separately gated R3-B1b correction acceptance/publication lifecycle; it must not bypass the current fail-closed lifecycle fences. In parallel, complete the separately gated narration correction, including exact `ספר` and `שם` contexts, without treating automated preflight as an ear-test PASS.
- After source and visual-direction review/acceptance, complete Visual Contract, Blueprint, Board/prop and Visual Package authority in bounded waves with explicit spend ceilings.
- A slot remains unavailable for rendering until story/product approval and its complete visual package both pass.

## Next

### R1D — Prove the corrected path with one LOW page

- Preconditions: R1A Claude Code PASS, R1B preflight PASS, R1C bounded authority, and Guy's explicit one-image approval.
- Use one page from `fox_uri_adventure`, whose tracked template and Set Board make it the smallest relevant proof.
- Inspect persisted candidate, same-byte QA, contract/board binding, world continuity, cost, latency, and final hold/release state.
- No Lion and no full-book render.

### R2 — Add durable resumable render state

- After the one-page measurement, implement the minimum state machine required for crash-safe resume: queued → rendering → candidate persisted → QA pending → accepted, regeneration queued, or hold.
- Prefer one paid render per invocation, stable idempotency, candidate SHA binding, and recovery from the uploaded candidate.
- Validate on a real database/runtime boundary before claiming reliability.

### R4 — Close the human-QA operator loop end to end

- Verify the current release/park/re-render surfaces against actual mainline code and runtime evidence.
- Confirm every hold can be discovered, acted on idempotently, audited, and either safely released, re-rendered, cancelled/refunded, or parked.
- Exercise the relevant staging paths. Payment and delivery-authority claims require concurrency/runtime evidence, not unit tests alone.

### R5 — Prove one full sellable book on the approved golden path

- First use the smallest approved calibration sample.
- Run a full fox book only with Guy's explicit cost/product approval and after the relevant technical gate.
- Judge both system behavior and product outcome: story agency, humor, ending, child/wardrobe likeness, companion identity, set continuity, text legibility, holds, and fulfillment authority.
- Fix systemic defects generally; do not patch only the fox story.

### R6 — Launch-readiness closure

- Revalidate the sellable matrix and every launch-eligible slot.
- Prove PayMe webhook verification and order/refund behavior using the approved environment and credentials; never invent a webhook secret or allowlist.
- Revalidate staging/production separation, storage, migrations, release flags, deployment protection, and `npm run release-check`.
- Guy gives the launch go/no-go after technical and product gates.

## Completed or landed on main

- Pipeline/consolidation work through `main` commit `b4813c04`.
- Read-only human-QA review console merged to main (`e5dbe700`).
- Human-QA operator-action foundation, park, and release work landed through the July 20–21 commit series ending at `8614094e`.
- Reader left-page masking correction landed at `b4813c04`.

These entries mean “present in Git,” not automatic runtime or product acceptance. `CURRENT.md` records the active verification state.

## Blocked or externally gated

- Real PayMe webhook configuration depends on approved PayMe account information. Do not guess secrets, signatures, or IPs.
- A full production-quality render spends money and needs Guy's explicit approval.
- Final technical PASS on Codex changes depends on independent Claude Code review.
- Final product PASS and launch readiness depend on Guy.

## Deferred

- Style02 customer availability
- Physical/printed fulfillment and Power Card productization
- International/Stripe rollout and non-Hebrew languages
- Fully automated product/visual acceptance
- Marketing scale beyond the supervised pilot
- Broad refactors that are not required by a verified root cause

## Out of scope for roadmap changes by Codex alone

Codex does not choose story quality, business priority, customer promise, pricing, launch timing, visual direction, or whether a feature is worth building. These require Guy's decision; Codex supplies feasibility, risk, sequencing, and implementation options.
