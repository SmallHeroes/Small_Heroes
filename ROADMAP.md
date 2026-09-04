# SmallHeroes — Roadmap

**Last verified:** 2026-09-04
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
- **R3-B1b implementation state:** Claude Code independently reviewed exact planning range `ad54e3c1..19f110f4` read-only and returned PASS with no P0/P1/P2. Guy then approved that exact packet and batch: acceptance intent for P1-P5/P7/P8, P6 referral to Cowork without acceptance, D1-D5, D6A and D7-D13, plus the R3-B1b implementation gate. Codex implemented the provider-free correction-v4 lifecycle, strict 12-file loader and temporary P1 proof in `1227495e..4c4cb91e`. Claude Code's first implementation review returned HOLD with one P1 and two P2. Corrective commit `2e0b8096` closed all three with truthful QA provenance/closeout, a nonblocking-P2-capable review schema, three direct identity-substitution tests and pre-enumeration accepted-root validation. Claude Code independently re-gated combined range `1227495e..2e0b8096` and returned **PASS with no P0/P1**; its sole new P2 corrects Codex's handoff topology wording, not code. The reviewed implementation head is pushed at exact 0/0 origin parity. Proposed P1 revision digest remains `64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc`; corrected product-decision digest is `9b625e71318cf3a26117bc89744a1e39c04d13f6d74f632cddab4aaa639113e8`. Neither is accepted or published. Corrected focused validation is 10/10 files and 90/90 tests; TypeScript passes. The repository check remains honestly red only on inherited missing ignored fixtures and post-assertion Vitest RPC timeouts described in `CURRENT.md`. No canonical authority, render eligibility, external effect or spend changed.
- **R3-B1b P1 publication (supersedes the pre-publication state above):** Guy confirmed final digest `64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc` on 2026-09-03 and authorized Story Source / Visual Direction only. The exact 12-file canonical revision is published locally; manifest digest `8103e741ce9e7402264f5edac24204bce2b72e4df523fd88031d43ef5d44416d`, first publication `created:true`, replay `created:false`. Actual accepted-source/gender/automated-TTS readiness is 2/18, while render qualification remains 1/18 and P1 remains false. Product sellability is now 17 because P1 requires its missing qualified package; no fallback is enabled. A bounded historical-replay correction preserves the original review/correction batch digests without changing production selection APIs. Claude Code independently passed exact publication range `e87b5c5b..e4060787` with no P0/P1 and two P2. Guy explicitly accepted temporary 17/18 availability until a new exact-source package is approved. The proof-scope P2 was corrected test/documentation-only by separating injected accepted-source facts from canonical package and sellability facts. Claude Code independently re-gated `e4060787..0ba453b9` and returned PASS with no P0/P1/P2, reproducing 11/11 and 101/101 tests, both typechecks and clean hygiene. Guy reported that he pushed the branch through documentation closeout `417d0807`; Git then verified branch/origin parity at 0/0. No rendering, audio, package, deployment, provider or paid action occurred.
- **R3-B1b accepted-intent wave 2 preparation:** after the P1 branch reached pushed 0/0 parity at `417d0807`, the six eligible accepted-intent records P2-P5/P7/P8 were reproduced and materialized together on `codex/r3b1b-accepted-intent-wave-2` using the unchanged general correction-v4 lifecycle. Each has an exact future revision digest, zero unresolved creative-source issues, zero protected-authority issues, zero critical TTS items, six immutable pending files, `created:true` then replay `created:false`, false runtime/production eligibility and ten zero external counters. Four records retain 10 soft narration-review items, all for `שם`: P4 has 2 on page 8, P5 has 2 on page 3, P7 has 4 on pages 2 and 9, and P8 has 2 on page 5; P2/P3 have none. Focused validation is 2/2 files and 20/20 tests plus both typechecks. Only ignored outputs and documentation changed; no accepted authority, package, render, publication or spend occurred. Claude Code's read-only review of `417d0807..0f1af28c` returned HOLD with no P0, one documentation-truthfulness P1 and one actor-attribution P2; it otherwise verified the technical preparation, identities, tests, zero effects and the 11/18 projection. Claude Code then independently re-gated correction range `0f1af28c..d47fe4e9` and returned PASS with no P0/P1/P2, reproducing the 10-of-24 soft-item evidence, corrected attribution, exact five-document scope, TypeScript PASS and zero effects. Both findings are closed; wave-2 preparation is technically passed.
- **R3-B1b accepted-intent wave 2 technical-review envelopes:** six correction technical-review v2 envelopes are prepared together under ignored `outputs/`, each uniquely binding the common batch/product decision, its own record-decision/revision digest and Claude Code's exact final PASS range `0f1af28c..d47fe4e9` with P0/P1/P2 `0/0/0`. The earlier HOLD and later unreviewed documentation closeout remain truthfully separate. All six canonical-byte/identity recomputations pass, all files are regular and single-link, focused validation is 2/2 files and 20/20 tests, and both typechecks pass. No product acceptance, accepted authority, code, package, render, publication, effect or spend changed. Claude Code independently reviewed `f5fc5fb3..d2e7392d` and returned PASS with no P0/P1 and one P2, reproducing every envelope claim and finding only a repeated push-attribution wording error in CURRENT. The wording is corrected by separating Guy's report from Git's parity proof; envelope bytes are unchanged. The wave's 10 soft `שם` items are clarified as spanning four wave stories, distinct from the current readiness count of 10 across five stories. Claude Code then independently re-gated exact correction range `d2e7392d..eee1356e` and returned PASS with no P0/P1/P2. The prior P2 is closed, the envelopes remain byte-identical, and the milestone is technically passed on everything tested.
- **R3-B1b accepted-intent wave 2 product acceptance:** Guy explicitly confirmed all six exact future revision digests for P2-P5/P7/P8 and authorized six tracked correction product-acceptance v2 receipts. All 6/6 receipt digests, filenames and canonical bytes recompute exactly; each binds its own passed technical review, record decision, revision and world mode. Two `prepare --write false` previews per story return stable manifest digests, `created:false`, no output root and ten zero external counters. Focused validation is 2/2 files and 20/20 tests. No accepted revision, package, locator, render, publication, effect or spend changed, so sellability remains 17/18. The staged rollout Decision Gate records Guy's sequence intent: exact P1 package and verified 18/18 first, then P2, P3, P4, P5, P7 and P8 one story at a time. Claude Code independently reviewed exact range `8d059730..1aa1b687` and returned PASS with no P0/P1/P2, reproducing every receipt byte, all 12 no-write previews, unchanged readiness and zero effects. Guy pushed before review; Git and Claude verified exact upstream parity at 0/0. The receipt milestone is technically closed and grants no downstream authority.
- **R3-B1b P1 exact-source package prerequisite audit:** the provider-unreachable preflight passed the exact accepted 12-page `integrated.md` source at snapshot digest `8de91442...`, zero attempts/writes/calls. No exact-source Visual Contract, Blueprint, package, locator, Board or prop reference existed; the QA-only candidate points at old source bytes. Style01 and Dini's six passed views are reusable, with minimum resemblance `0.9802317213552091` above the unchanged 0.70 threshold. The exact source exposes six setting families plus recurring cart/cake objects, but Board/prop count remains intentionally undetermined until an accepted Visual Contract and Blueprint classify them. P1-A1 Visual Contract authoring was budgeted at projected USD 7.656 / hard USD 10, at most 7 standard calls plus one cleanup. A later accepted-contract Blueprint remains budgeted at projected USD 4.928 / hard USD 5, at most 3 generations plus 2 count probes. Claude Code independently reviewed exact range `4d7348f2..1fa48fb2` and returned PASS with no P0/P1/P2, reproducing all nine claims, 124/124 tests, TypeScript PASS, zero effects and pushed 0/0 parity.
- **R3-B1b P1-A1 live execution:** Guy granted the exact bounded Visual Contract-only GO. Canonical pre-live preparation/verification passed at pushed base `efa9495b`. The single live process used two provider calls (initial plus one page-contract repair), two dispatches, zero transport retries, no fallback and conservative USD 0.668218. It failed closed with `draft_authority_reference_domain_invalid`: the page-10 repair duplicated `beat:p10:child_pushes_cart` across two coverage records, yielding one action-coverage and two coverage-beat cardinality diagnostics. Receipt `e60f689f...` and readiness `45d79882...` contain no candidate or output authority; zero-provider replay reproduced the exact sequence and same invalid-draft outcome with all congruence checks true. Claude Code independently reviewed exact range `efa9495b..b34cbe83` and returned PASS with no P0/P1/P2, reproducing identities, costs, calls, diagnostics, replay, absence, 17/18 containment and the general mapper omission. Its 5-file rerun had 114/114 passed assertions but a post-summary Vitest exit 1 that it did not count as PASS; Codex's separate run exited 0. No Blueprint, image, Board/prop, package, locator, render, narration, publication or deployment occurred.
- **R3-B1b duplicate coverage-cardinality recovery Decision Gate:** Guy authorized zero-cost Gate preparation only. Investigation found that the compact page-repair admission can offer a one-field action-binding target when the complete page graph has no legal uncovered action beat; the captured P1 graph therefore made duplication inevitable. The prepared general design adds graph-aware closed admission, atomic post-patch cardinality proof, bounded escalation of complete pure action/coverage-binding failures to the existing `full_draft` lane, and a versioned cutover that preserves the reviewed v55/v58/v55 replay exactly. No code, provider call, retry or downstream work is authorized by this planning milestone.
- **Next gate:** obtain Guy's explicit implementation GO or rejection for the prepared recovery Decision Gate. If approved, implement provider-free in a dedicated milestone task/worktree, commit locally and hand an immutable range to Claude Code. Any new P1-A1 provider attempt still requires fresh explicit spend authority; unused call/budget headroom is not retry authority. Blueprint, Board/prop LOW images, package work, promotion, rendering, narration and deployment remain unauthorized. P6 Cowork, HOLD/D materialization and the soft narration items remain separate gates.
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
