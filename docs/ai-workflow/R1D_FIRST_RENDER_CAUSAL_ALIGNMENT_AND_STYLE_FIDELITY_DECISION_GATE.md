# R1D-FIRST-RENDER-CAUSAL-ALIGNMENT-AND-STYLE-FIDELITY — Decision Gate

**Status:** approved by Guy on 2026-08-11; implementation authorized
**Base:** `c58525f31c767b69a6295aa24eb77aef8ecc5597`
**Branch:** `codex/r1d-first-render-causal-alignment-style-fidelity`
**Worktree:** `C:\Users\guyna\.codex\worktrees\renderfidelity1\Small_Heroes`

## 1. Proposed change

Strengthen the existing Wizard-connected Style 01 render path in two general ways:

1. Project typed action spatial effects and their Blueprint origin, destination, and target regions into a deterministic human-readable geometry block for the image provider. A relation such as `into` must state that the visible trajectory terminates inside the exact target placement.
2. Tighten Style 01 human rendering toward naturalistic children's-book anatomy while retaining watercolor illustration. Remove wording that encourages oversized, rounded cartoon anatomy and explicitly reject chibi, bobble-head, anime/Disney-like eye scaling, and toy-like hands.

The approved Fox page-11 LOW image is the baseline measurement. Its water trajectory misses the bucket and its child is materially more cartoon-like than the accepted Style 01 direction.

## 2. Why now?

The first visible image proved provider connectivity and Wizard qualification but failed the two most immediate product-quality checks. The system has not yet proved that structured scene authority produces causally coherent geometry or the intended human realism. These defects block a meaningful multi-page LOW measurement.

## 3. Scope

- General system change: typed Blueprint action geometry projection and Style 01 human anatomy guidance.
- Story-specific data used only for the bounded QA measurement: an additive local migration overlay that represents the already approved page-11 story fact that the falling droplet enters the bucket. No story literal is added to production code.
- Local/QA render tooling for one corrected page followed, only on visible PASS, by pages 10–12.

## 4. Risk of hardcoding

Production behavior must operate only on typed action subjects, predicates, spatial effects, placements, and target regions. It must not parse source prose or recognize Fox, a bucket, water, a child name, or a page number. The page-11 overlay is isolated in the QA runner and is not reusable runtime authority.

## 5. Files likely affected

- `lib/generation-pipeline/runtime-blueprint-projection.ts`
- `lib/style01-prompt-assembly.ts`
- `lib/style01-gptimage.ts`
- focused prompt/projection tests under `lib/**tests__` and `lib/generation-pipeline/__tests__`
- one local/QA LOW sample runner and durable implementation evidence
- `CURRENT.md`

## 6. Expected behavior after change

- A typed `relation: into` action produces an unambiguous render instruction whose destination is geometrically contained by the target placement and whose visible trajectory terminates inside the target.
- Equivalent typed relations receive deterministic relation-specific instructions without story prose parsing.
- Human children retain age-appropriate, natural picture-book proportions: ordinary eye scale, credible head-to-body ratio, articulated hands, subtle facial structure, and no doll/chibi exaggeration.
- Watercolor texture, warmth, softness, and non-photographic illustration remain unchanged.
- Wizard and Blueprint remain the sole composition authority.

## 7. Validation plan

1. Direct unit tests for typed spatial geometry projection, including `into`, missing destination, and non-spatial actions.
2. Prompt regression tests for the PVB path and Style 01 anatomy wording.
3. TypeScript and focused runtime/Wizard tests, then one repository check.
4. One page-11 `gpt-image-2` LOW correction render and visual inspection against the baseline.
5. If the correction fails, one final bounded page-11 correction attempt. Two failed correction images stop the run and return to Guy.
6. If page 11 passes, render pages 10, 11, and 12 sequentially through the same local Wizard-qualified package, LOW only, then inspect continuity, geometry, and human style.

## 8. Cost impact

- At most two page-11 correction images.
- Only after a visible page-11 PASS, three consecutive LOW images (pages 10–12).
- Maximum authorized image calls in this milestone: five; no image retries, fallback, or Vision calls.
- Local artifacts and QA evidence only. Production remains blocked.

## 9. Rollback plan

Revert the focused branch commits. The existing baseline image and evidence remain immutable. No database, production storage, deployment, or approved historical authority is mutated.

## 10. Review assignment

- Guy has already decided the visual acceptance criteria: the drip must enter the bucket so the causal sound reads, and the child must be less cartoon-like and more faithful to Style 01.
- Claude Code must falsify typed-authority provenance, key-order/digest stability, absence of prose parsing/story literals, unchanged Wizard authority, focused validation, cost/count claims, and production-blocked boundaries.
- Guy will eyeball the corrected page 11 and the pages 10–12 sequence for causal geometry, child realism, continuity, and overall improvement.

## 11. Do not do

- No production deployment, publication, promotion, activation, database or remote storage writes.
- No full-book render, HIGH image, Vision call, automatic retry, provider fallback, or hidden extra image.
- No weakening of Blueprint validation, render qualification, resemblance threshold, release HOLD, or production block.
- No prompt-prose parsing or story/page/prop-specific literals in production code.

## Stop-check answers

1. General system fix; the measurement overlay is isolated QA data.
2. The change could affect Style 01 children and typed spatial actions, so direct compatibility tests and a small multi-page sample are required.
3. It changes the qualified Style 01 prompt but does not authorize production.
4. It can spend up to five LOW image calls; Guy explicitly authorized continuous work through the measurement.
5. Smallest proof: corrected page 11; only then pages 10–12.
6. No unresolved product decision remains. Guy supplied the target and stop-after-two-failures rule.
7. Claude Code should attack authority provenance, generality, prompt stability, and evidence fidelity.
8. No separate Claude Cowork review is required before the bounded technical/visual measurement.
9. Guy must inspect the corrected causal alignment and child anatomy before any broader render.
