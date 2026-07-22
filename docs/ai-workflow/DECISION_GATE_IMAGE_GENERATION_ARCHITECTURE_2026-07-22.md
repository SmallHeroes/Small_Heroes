# Decision Gate — Reliable Book Image Generation

**Date:** 2026-07-22
**Technical owner:** Codex
**Product owner:** Guy
**Status:** architecture accepted by Guy; R1A/R1B closed after independent QA; R1C zero-cost runtime-authority implementation explicitly authorized on 2026-07-22. No image render, production cutover, deploy, or push is authorized.

## 1. Proposed change

Establish one fail-closed path from an approved story to a reviewable book image:

1. Correct and independently re-gate render-loop Phase 1.
2. Separate product/story sellability from render qualification.
3. Require an approved, source-bound visual package before any paid image on a sellable path.
4. Make the frozen page contracts the authority for world, set, cast, props, transitions, and prohibitions.
5. Restrict the runtime Director to bounded composition choices; it may not invent the world or move the story to another set.
6. Persist each uploaded candidate before QA, QA the same bytes, and distinguish verified visual failure from missing QA evidence.
7. Add durable, resumable render state only after the corrected one-page path is measured.

The approved visual package will contain the current story-source identity, an approved visual-contract template, complete cover/page contracts, an explicit `worldMode`, and every required approved Set Identity Board binding. Promotion will be an explicit reviewed operation; runtime will never live-compile a missing bank contract.

## 2. Why now?

`lion_shaket_adventure` exposed a system failure: disabling enforcement allowed a nominally sellable story onto a legacy path with no approved world contract. The bank story remained grounded in a playground, while later prompt/direction layers were free to introduce fantasy drift.

The repository already contains an offline compiler, template validation/materialization, frozen-contract hashing, contract steering, world QA, and a Set Identity Board engine. The missing productization layer is compile → review → approve/promote → preflight/release gate. Building a second compiler or adding more prompt prose would duplicate authority rather than close the gap.

The current matrix also demonstrates why two gates are needed: with `ENABLE_V3_APPROVED_BANK=true`, `npm run release-check` reports 18/18 story slots sellable, but only two visual-contract templates exist. Story availability is therefore not proof of render readiness.

## 3. Scope

- General system change.
- Applies to every story, child, companion, direction, cover, page, retry, and environment on the sellable Style01 path.
- Includes artifact authoring/promotion, release/preflight checks, bounded prompt assembly, candidate/QA disposition, and resumability.
- Does not change story content, visual taste, price, launch scope, or the 0.70 resemblance threshold.

## 4. Risk of hardcoding

High if the fix is expressed as Lion/playground prompt text, an `adventure` exception, a cover special case, or a Fox-only board rule.

Mitigation:

- contracts and boards are structured artifacts;
- `worldMode` is author/reviewer-owned, not inferred from the direction label;
- promotion and preflight use general validators;
- the same eligibility rule covers all matrix slots;
- story-scoped board keys remain in place until real cross-story reuse is proven.

## 5. Files likely affected

Exact pathspecs will be fixed after the approved implementation brief. Expected surfaces are:

- `backend/providers/image.ts`
- `backend/providers/story-bank-loader.ts`
- `lib/generation-pipeline/page-visual-qa.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- `lib/visual-contract-compiler/`
- `lib/visual-contract-vnext/`
- `lib/set-identity-board/`
- `backend/config/mvp-story-matrix.ts` or a new render-qualification registry beside it
- `scripts/release-check.ts`
- visual-contract extraction/compile/promotion scripts
- Prisma schema/migrations only for the later durable render-state milestone
- focused integration and release-gate tests

## 6. Expected behavior after change

- “Sellable story” and “render-qualified story” are separate facts.
- A sellable order cannot spend an image call until its source-bound visual package validates completely.
- Missing/stale contract, page coverage, `worldMode`, or required board produces a clean pre-render hold/failure.
- `bedtime`, `adventure`, and `fantasy` may influence pacing/composition, but cannot silently choose the physical world.
- Cover and pages receive explicit authoritative locations; the sellable path has no `home-night` or generic-world fallback.
- Runtime Director output is constrained to camera, staging, and blocking inside the page contract.
- Malformed, timed-out, skipped, or transport-failed QA rechecks the same candidate within a bounded policy and then holds; it never spends a new image.
- Only a verified visual defect on the persisted candidate can reserve a regeneration.
- A crash after upload can resume from the persisted candidate rather than paying for another render.

## 7. Validation plan

### Milestone A — render-loop correction

- Zero image calls.
- Add caller-level tests proving persistent malformed/error/timeout QA does not reserve regeneration.
- Add a fresh timeout/AbortSignal per QA attempt.
- Add a shipped Style01 integration test proving candidate persistence occurs after upload and before QA.
- Cover both `images.generate` and `images.edit` cancellation options.
- Run focused tests and `npm run check`; send to Claude Code for adversarial re-gate.

### Milestone B — promotion and preflight

- Zero image calls.
- Show the preflight failing on a deliberately missing/stale contract, missing cover/page, missing `worldMode`, and unresolved required board.
- Show it passing only on a complete approved fixture.
- Audit every nominally sellable slot and report product-sellable versus render-qualified separately.

### Milestone C — smallest runtime proof

- After Claude Code PASS and Guy's explicit cost approval, run one LOW-cost page only on `fox_uri_adventure`, because it has a tracked approved template and Set Identity Board.
- Inspect candidate persistence, same-byte QA, contract/board binding, world continuity, and final hold/release state.
- No Lion render and no full-book render.

## 8. Cost impact

- Planning, implementation, tests, compiler runs, and preflight audit: zero image generations.
- First runtime proof: one LOW image, only after a separate explicit approval.
- Full-book or HIGH render: not authorized.

## 9. Rollback plan

- Keep each milestone in an isolated green commit.
- Render qualification is additive and fail-closed; rollback can remove the new gate while leaving approved artifacts intact, but production enforcement must not be disabled merely to make an unqualified story render.
- A later Prisma change will be additive and forward-compatible; applied migrations will not be edited.
- Preserve the existing legacy path only for explicitly non-sellable development during migration, with clear telemetry and no production eligibility.

## 10. Review assignment

Guy decides:

- whether to approve this implementation sequence;
- when to authorize the one-LOW-page runtime proof;
- whether `lion_shaket_adventure` is product/content-approved after Claude Cowork review;
- final visual/product acceptance and any full-book cost.

Claude Code must try to falsify:

- that no paid image is reachable before complete preflight;
- that QA evidence failures cannot consume regeneration budget;
- that tests exercise the shipped Style01 caller rather than a helper only;
- that stale source/template/board artifacts fail closed;
- that cover, retry, resume, legacy, preview, staging, and production paths cannot bypass the gate;
- that the proposed state is durable and idempotent at real runtime boundaries.

Claude Cowork should review:

- the Lion story's product readiness, grounding, point of view, gender/Hebrew, emotional arc, and whether the proposed visual contract faithfully expresses the story;
- whether the visual-package review artifact is understandable enough for Guy to approve without reading code.

## 11. Do not do

- Do not render `lion_shaket_adventure` yet.
- Do not render any nominally sellable story that is not render-qualified.
- Do not disable enforcement to bypass a missing contract.
- Do not live-compile contracts in the customer runtime.
- Do not add Lion-, playground-, Fox-, direction-, or page-specific prompt patches.
- Do not let the Director choose world, set, cast, required props, or forbidden content.
- Do not introduce a sequential runtime LLM memory layer while the frozen page plan can be the single authority.
- Do not generalize Set Boards across stories until at least two reviewed stories intentionally share the same canonical set.
- Do not run a full book or HIGH image without Guy's explicit approval.

## Stop-check

1. **General or story-specific?** General system. Lion is the exposing case, not the implementation target.
2. **Could it break another story/style?** Yes. Roll out behind a preflight audit, migrate artifacts explicitly, and test every nominally sellable slot. Style02 remains out of scope.
3. **Production behavior?** Yes. Production cutover is a later explicit milestone; current visual-contract flags are hard-off in Vercel production.
4. **Spend money?** No through Milestones A–B. One LOW page in Milestone C requires separate approval.
5. **Smallest validation?** Caller-level zero-cost tests, all-slot preflight dry audit, then one LOW Fox page.
6. **Guy decision?** Approve sequence, later approve the one-page cost, and separately accept story/visual product quality.
7. **Claude Code challenge?** Bypass, evidence classification, real caller coverage, idempotency, resume, and production/legacy paths.
8. **Claude Cowork review?** Lion story and the human-facing contract review artifact.
9. **Guy eyeball?** The promoted world package before render, then the single generated page and QA record before any wider sample.

### R1C execution reconciliation (2026-07-22)

1. **General or story-specific?** General Style01 runtime boundary for every eligible book; no story, companion, direction, cover, or page exception.
2. **Could it break another story/style?** Style01 enforced non-production paths are intentionally fail-closed; enforcement-off and Vercel-production hard-off behavior remain the compatibility boundary. Style02 is unchanged.
3. **Production behavior?** No cutover. The existing production hard-off is preserved and tested.
4. **Spend money?** No. R1C uses fixtures/mocks only and forbids image/audio/provider/LLM calls.
5. **Smallest validation?** Caller-level cover, page, verified-QA retry, chunk-wrapper, and single-page-regeneration tests plus compiler/package/board regressions and TypeScript.
6. **Guy decision?** Already supplied: R1C is authorized after R1B PASS. The later one-LOW-page proof remains a separate decision and is excluded here.
7. **Claude Code challenge?** Falsify bypasses, inference, legacy fallback leakage, authority ordering, exact board binding, retry/regeneration coverage, production hard-off, and live seams.
8. **Claude Cowork review?** Not required for this technical zero-cost boundary milestone; no product/creative content changes are in scope.
9. **Guy eyeball?** Code/test handoff only. No generated visual exists in R1C; the later one-page proof remains the first visual-eyeball gate.
