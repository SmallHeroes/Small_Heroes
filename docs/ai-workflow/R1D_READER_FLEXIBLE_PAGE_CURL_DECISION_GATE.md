# R1D Reader Flexible Page Curl — Decision Gate

Status: Guy approved the flexible-paper direction in the Lead task. This record captures that explicit product decision and the bounded implementation contract.

## 1. Proposed change

Replace the existing two-plane desktop physical page turn with a multi-strip connected paper curl. The static open-book frame, page content and Reader navigation remain the same.

## 2. Why now?

Guy's direct product review found that the moving page felt like rigid plywood rather than flexible paper. The defect is visible in the real QA Reader and blocks product acceptance of the page-turn experience.

## 3. Scope

General Reader-system change. It is independent of story, child, companion, page content and visual style.

## 4. Risk of hardcoding

No story or asset identity may enter the geometry. Inputs are limited to direction, normalized progress, measured page width and a closed internal slice count.

## 5. Files likely affected

- `lib/book-layout/page-turn.ts`
- `app/book/[id]/read-v2/components/DesktopPhysicalPageTurn.tsx`
- `app/book/[id]/read-v2/reader-v2.module.css`
- `lib/__tests__/reader-page-turn.spec.ts`
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

The page flexes through a smooth curved profile with multiple connected subdivisions, remains visually continuous, and lands exactly flat. Forward and backward are mirrors. The surrounding book never tilts or slides.

## 7. Validation plan

The smallest proof is pure geometry testing plus one tracked QA book in the local production Reader: verify connected edges, varied mid-turn angles, flat endpoints, forward/backward completion, no visible strip seams, no error overlay and no console errors. No render or provider call is required.

## 8. Cost impact

External cost is `$0`. No image, audio or language-model generation is authorized.

## 9. Rollback plan

Revert the focused mesh commit. No persisted book, image, database, authority or output artifact is migrated or rewritten.

## 10. Review assignment

Guy decided the product direction: flexible paper with more subdivisions and a soft wavy fold. Claude Code should attempt to falsify edge continuity, reverse symmetry, content orientation, flat landing, reduced-motion preservation, strip-seam absence and scope isolation. Guy should eyeball the animation in QA after independent technical review and deployment.

## 11. Do not do

Do not change the website, Wizard, generation pipeline, story content, images, narration, payments, Production, mobile navigation or reduced-motion policy. Do not render, deploy or push in this milestone.
