# R1D — Canonical Child Style Anchor and QA Reader Page Turn — Decision Gate

Status: approved by Guy for implementation on 2026-08-11. Production remains blocked.

## Observed behavior and root cause

The corrected Dini/Bar LOW proof now derives page-specific expressions, but pages 3 and 4 still render the child with a more cartoon-like anatomy and face treatment than pages 1, 2, and 5. The local Wizard measurement runner passes the raw uploaded child photo as reference 0 on every page. It therefore asks the image model to translate the same real photograph into Style 01 independently for every page. The amount of translation varies with child scale, composition, and the other references in that call.

The production pipeline already has the stronger boundary: an approved per-order canonical child portrait is required before paid page generation. The local measurement runner bypassed that boundary. In addition, the current Stage-0 sanitizer removes toddler wording but does not remove transient expression phrases from the supplied identity text, so a photographed smile or mouth pose can still contaminate the supposedly neutral anchor prompt.

The QA Reader uses the real book-layout components, but `sceneTransition` currently only remounts the next scene. It has no directional page-turn animation.

## Nine architectural decisions

1. **One style-normalized identity authority.** Every Style 01 multi-page measurement must use one canonical styled child anchor for all pages. A raw photo may be used to create that anchor, but may not be used as the per-page continuity reference once a multi-page measurement begins.
2. **Identity, style, and expression remain separate.** Stable face/hair/skin/age anatomy and the approved Style 01 realism level belong to the canonical anchor. Page expression, gaze, mouth pose, action, blocking, and camera remain page/Blueprint authority.
3. **Neutral anchor expression.** Stage 0 sanitizes transient expression language from both locked identity text and photo-derived identity cues, and explicitly requests a relaxed closed-mouth neutral expression. This must not weaken stable morphology, wardrobe, age, resemblance, or anchor QA gates.
4. **Explicit reference kind.** Style 01 prompt assembly receives an explicit typed child-reference kind (`raw_photo` or `canonical_anchor`) rather than depending only on URL/path spelling. Existing canonical `character-anchors/` detection remains a compatibility fallback for older callers.
5. **Fail closed in the measurement path.** The local multi-page runner may consume a supplied canonical anchor or create one through the repository-owned Stage-0 prompt/reference builder. It must not silently fall back to the raw photo as the page reference.
6. **No story-specific production rules.** No production prompt, validator, or routing branch may name Bar, Dini, page 3, page 4, or any story phrase. The proof data may identify the audition, but the system change is child/style/story/page agnostic.
7. **Shared Reader transition.** The QA viewer and real Reader use the same directional page-turn class contract. Forward and backward navigation set explicit direction; keyboard, buttons, swipe, and automatic advance retain their current navigation authority.
8. **Accessible motion.** Page-turn motion is CSS-only, does not delay navigation or data loading, preserves adjacent-image preloading, and is disabled under `prefers-reduced-motion: reduce`.
9. **Bounded proof and rollback.** Validation is tests, TypeScript, repository gate, one LOW canonical anchor, and at most two LOW page rerenders (pages selected only as the smallest visual proof). If that second visual attempt remains inconsistent, stop. Rollback is reverting the focused commits and continuing to use the prior local audition artifacts; no production artifact is modified.

## Expected behavior

- Stable facial structure, proportions, line treatment, and watercolor realism persist across wide and close page compositions.
- Expressions and poses remain visibly page-specific rather than copied from the photo or anchor.
- QA Reader shows a perceptible directional page turn using the same book-layout rendering surfaces as the real Reader.
- Existing production anchor approval, resemblance threshold `0.70`, provider model, image quality policy, budgets, storage, publication, and deployment behavior remain unchanged.

## Smallest acceptance proof

1. Unit/regression tests prove transient expression removal, explicit canonical reference typing, legacy fallback, and raw-photo/canonical prompt separation.
2. Reader tests/source assertions prove forward/backward direction and reduced-motion coverage.
3. Focused tests, deterministic TypeScript, `git diff --check`, and the repository stability gate run before paid proof.
4. One local LOW canonical anchor is generated from a child photo using the shared Stage-0 prompt/reference builder.
5. Exactly two previously drifting pages are rerendered through the qualified local Wizard measurement path using that single anchor.
6. Browser verification proves the five-page QA Reader loads, assets return 200, navigation changes pages, a page-turn animation is active, no framework overlay/console error appears, and production remains untouched.

## Explicit exclusions

No full-book rerender, HIGH render, Vision call, remote database/storage write, Board action, approval, publication, promotion, deployment, production activation, or push. No lowering of the resemblance threshold, no model or budget change, and no story-specific exception.

## Stop-check result

- General system fix: yes.
- Cross-story/child risk: bounded by explicit reference typing and existing compatibility fallback.
- Production behavior affected: Stage-0 prompt sanitation and shared Reader animation only; paid generation still requires the existing approved anchor gate.
- Spend: at most three `gpt-image-2` LOW calls (one anchor and two pages).
- Smallest validation: one anchor plus two page images and one local QA Reader.
- Product decision: Guy explicitly requires uniformity and authorized the higher-realism Style 01 direction and continuous execution.
- Independent QA target: Claude Code must try to falsify generality, expression separation, canonical anchor routing, backwards compatibility, animation accessibility, test evidence, and scope/cost boundaries.
- Guy eyeball target: facial realism/identity consistency across all five Reader pages, while expressions and camera compositions remain distinct.
