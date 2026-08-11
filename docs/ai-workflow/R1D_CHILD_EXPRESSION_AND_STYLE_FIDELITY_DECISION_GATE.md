# R1D Child Expression and Style Fidelity — Decision Gate

Date: 2026-08-11

Base: `ced2f4e19dcaf843f772ba88b09adf2fc5509604`

Branch: `codex/r1d-child-expression-style-fidelity`

Owner decision: Guy explicitly authorized diagnosis, correction, and the smallest LOW visual proof without another approval pause.

## 1. Proposed change

Separate child identity from photographed expression at the final Style 01 prompt boundary, derive a closed page-expression instruction from authoritative page inputs, and add a small-in-frame human-fidelity guard for approved wide/tracking Blueprint frames. The five-page Dini/Bar measurement runner will stop authoring a smile as identity and will pass the already-frozen Story Source page text/direction into the same general resolver.

## 2. Why now?

The first five-page visual measurement exposed two product-visible defects:

- every prompt copied `broad open smile` from the Bar photo into the immutable child identity, so page 1 contradicted its quiet/crowded-out beat and expression barely varied;
- pages where the approved Blueprint made Bar small in frame simplified the human toward the adjacent mascot/companion rendering language.

These are prompt-boundary defects, not evidence that the approved camera plan or Story Source should be rewritten.

## 3. Scope

General system change plus a correction to the local measurement harness. It applies to every child, Story Source, and companion using the Style 01 Blueprint path. No child-, page-, or story-specific production override is added.

## 4. Root cause and hardcoding risk

The authoritative Blueprint branch bypassed both `buildPageExpressionLock` and the child-DNA sanitization used by the legacy branch. The source photo expression therefore became identity. The same branch had no explicit instruction that a small human must retain the photo's morphology without inheriting companion proportions.

The rejected alternatives are a Bar/page-number lookup, a Dini-only expression table, a changed camera plan, and replacing the child reference image. All would hide rather than fix the shared boundary.

## 5. Architectural decisions

1. The child photo is identity authority only; photographed mouth pose, smile, gaze, and transient emotion are never identity authority.
2. Expression-like phrases are removed deterministically from child face/signature text immediately before prompt assembly; stable facial morphology remains intact.
3. Page expression uses a closed typed catalog and deterministic classification of the immutable Blueprint narrative plus supplied Story Source page text/direction. Raw prose is not copied into the expression lock.
4. Explicit emotional evidence outranks the neutral fallback; ambiguous pages use attentive closed-mouth neutrality, never the photo expression.
5. The authoritative Blueprint prompt branch receives the same expression boundary as other Style 01 pages without changing camera, placement, cast, action, props, or layout.
6. Small-in-frame human fidelity is derived from typed Blueprint placement geometry and camera class. It may improve detail within the approved region but may not move, enlarge beyond, crop, or replan the region.
7. Child-reference role wording makes the real child the primary human-identity anchor and forbids companion/style references from changing human anatomy or facial rendering.
8. The Dini/Bar runner supplies exact frozen Story Source page inputs and removes its authored `broad open smile`; this is measurement wiring, not a story-specific production rule.
9. Acceptance requires prompt-level regressions first, then at most three new gpt-image-2 LOW renders (pages 1, 3, and 4) and a local Reader comparison. A second unsuccessful visual attempt stops for Guy review.

## 6. Expected behavior

- Page 1 renders Bar subdued/quiet with a relaxed closed mouth rather than broadly happy.
- Pages 3 and 4 have distinct beat-appropriate expressions.
- Bar remains recognizably the same real child and the same semi-naturalistic watercolor human at wide and medium scale.
- Dini remains illustrated in her established companion style; the approved Blueprint geometry and Story Source remain unchanged.

## 7. Validation plan

1. Direct tests for expression sanitization, closed expression classification, source-photo non-authority wording, and small-frame fidelity classification.
2. Blueprint-path prompt tests proving identity text has no smile, page expression is present, the small-frame guard is geometry-derived, and camera/placements remain byte-identical.
3. Focused Vitest, deterministic TypeScript, `git diff --check`, then one repository check after focused PASS.
4. LOW pages 1, 3, and 4 only. Put corrected pages beside retained pages 2 and 5 in a new local Reader manifest for Guy's visual decision.

## 8. Cost impact

Zero provider cost through code validation. Visual proof is capped at three gpt-image-2 LOW page calls in the first attempt. No Vision call, fallback, automatic retry, or full-book render.

## 9. Rollback

Revert the focused implementation commit. Previous images and Reader manifest remain immutable local evidence. No production data or published artifact is migrated.

## 10. Review assignment

Claude Code should attempt to falsify the generality of the sanitizer/classifier, ensure Blueprint geometry is unchanged, verify no story-specific production literals, and inspect prompt evidence. Guy judges whether Bar's likeness, expression variation, and human rendering are visibly improved.

## 11. Explicit exclusions

No production enablement, deployment, publication, storage/database write, Board action, approval, full-book render, Vision QA, model/budget change, or fallback. Reader page-turn animation is a separate UX gap and does not block this character-fidelity proof.
