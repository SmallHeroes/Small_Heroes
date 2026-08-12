# R1D Reader Flexible Page Curl — Implementation Evidence

Status: prior geometry and record fidelity independently PASSed; moving paper-frame follow-up locally PASS and pending independent re-gate; Guy product acceptance pending.

## Authority and topology

- Parent: `640476ddfaf831ede8eca6e62f7529eb0c4f2107`
- Endpoint-correction parent: `e933984bc651d2d8e3a63f9309f53958736bc0ee`
- Spine-tangent-correction parent: `ec098393dc0ea2d632e1c320c6a39248835473d7`
- Branch: `codex/r1d-reader-premium-site-qa-integration`
- Worktree: `C:\Users\guyna\.codex\worktrees\qaexperience1\Small_Heroes`
- External cost: `$0`
- Production: unchanged and blocked

## Observed defect and root cause

The prior renderer rotated one parent sheet through 180 degrees and added a single 14-degree bend to an outer 38.2% segment. Its comment claimed the two planes prevented a rigid-card appearance, but direct product review and source inspection falsified that claim. A global plane plus one hinge cannot express distributed paper curvature.

The first mesh browser pass also exposed a secondary presentation defect: the old inset shadow was repeated independently on every strip, making the page look corrugated. The final implementation removes per-strip box shadows and keeps only low-opacity curvature shading plus the existing whole-sheet cast shadow.

Guy's later screen recording exposed a distinct geometric break at the completion boundary. Repository geometry proves that the left and right page rectangles are not equal: they have different widths, offsets and a spine gap. The mesh used only the source width and an equal-size default destination, so its last animated rectangle could not coincide with the static destination. In addition, `onComplete` ran in the same animation frame that wrote the exact landing pose, allowing React to remove the overlay before that pose painted, and the cast shadow retained constant opacity until removal.

Guy's follow-up recording then isolated a second, independent geometric break at the bound pivot. At half turn the former cosine-heavy curl profile was already near maximum at the first strip centre: the spine-nearest strip deviated approximately `28.2deg` from the physical hinge tangent. The mesh remained edge-connected, but the large immediate angle change formed a visible knee where paper met the book. Timing, content and endpoint geometry were not the cause.

## Implemented contract

1. `DESKTOP_PAGE_CURL_SLICE_COUNT` is a closed internal value of 12.
2. `desktopPageCurlSlicePoses` is pure and accepts only direction, progress, page width and an internal/test slice count.
3. Strips are integrated from the spine outward. Each desired centre is derived from the preceding outer edge, so adjacent inner/outer edges coincide through the entire turn.
4. A bounded smooth S-profile varies local Y rotation across the sheet, approaches zero curvature at the spine and outer sheet boundary, and concentrates the flexible bend in the paper body. Progress 0 and 1 force zero curl amplitude and exactly coplanar strips.
5. Front texture windows retain source order. Back windows use the exact reversed source index so the incoming page is upright after the 180-degree face flip.
6. A 0.75px overlap hides subpixel cracks without changing geometry. Curvature shading remains below 0.07 opacity and the face itself has no per-strip box shadow.
7. The animation easing changes from `easeInOutCubic` to `easeInOutSine`, giving the connected mesh a gentler acceleration and deceleration while preserving the 560ms duration.
8. The former standalone crease element and its directional gradients are removed. Curvature is now expressed by the connected strip geometry and bounded whole-strip shade profile rather than a second hinge highlight.
9. The existing 560ms duration, navigation guard, fallback timer, static book frame, mobile skip and `prefers-reduced-motion` behavior are unchanged.
10. The component measures the source sheet and destination guard rectangles once per turn. The pure mesh receives a typed destination offset/width authority and interpolates its page width and spine anchor into that exact rectangle. Vertical offset and height are interpolated in the component from the same measured pair.
11. The cast shadow is driven by the bounded turn arc, so it is zero at both static handoff endpoints and peaks only during the curl.
12. Completion is deferred by one additional `requestAnimationFrame` after the exact final pose is written. The overlay therefore paints the destination geometry before the identical static spread replaces it.
13. At half turn, the spine-nearest and outermost strip rotations remain within `2deg` of the hinge tangent in both directions while an interior strip exceeds `25deg` of local bend. This prevents a pivot knee without flattening the page back into a rigid plane.

## Changed paths

- `lib/book-layout/page-turn.ts`
- `app/book/[id]/read-v2/components/DesktopPhysicalPageTurn.tsx`
- `app/book/[id]/read-v2/reader-v2.module.css`
- `lib/__tests__/reader-page-turn.spec.ts`
- `CURRENT.md`
- this evidence document
- `R1D_READER_FLEXIBLE_PAGE_CURL_DECISION_GATE.md`

## Validation

### Focused executable proof

```text
npx --no-install vitest run lib/__tests__/reader-page-turn.spec.ts lib/__tests__/reader-nav.spec.ts lib/__tests__/reader-narration-src.spec.ts lib/__tests__/reader-storytime-dwell.spec.ts lib/__tests__/dev-viewer-library-resilient.spec.ts lib/book-layout/__tests__/open-book-layout.spec.ts
```

Result: **6 files / 41 tests PASS** after the spine-tangent correction added direct boundary-tangent and interior-curl coverage in both directions.

Direct geometry regressions prove:

- every neighboring edge remains connected at progress `0`, `0.2`, `0.5`, `0.8` and `1`, forward and backward;
- all 12 strips are flat at rest and landing;
- unequal source/destination page rectangles land on the exact typed destination edges in both directions;
- the bound spine and outer sheet edge approach the hinge tangent while the paper body retains substantial interior curl;
- more than six distinct local angles exist at mid-turn, preventing a rigid-plane regression;
- every strip lifts in Z at mid-turn;
- shading remains below the bounded subtle-opacity ceiling;
- the component/CSS contract no longer references the former spine/outer two-segment implementation.

Additional checks:

- `npx --no-install tsc --noEmit`: PASS
- `git diff --check`: PASS
- Literal `npm run check`: not rerun; the branch's separately recorded repository/release HOLD remains unchanged.

### Independent QA and focused correction

Claude Code independently reviewed `640476ddfaf831ede8eca6e62f7529eb0c4f2107..0c267bb8e224f06a2f97e8dec994576fca075d3e` read-only and returned **technical PASS** with no BLOCKER or MAJOR and two non-blocking MINOR findings. It independently reproduced TypeScript, the direct 11-test curl regression and the declared 6-file / 38-test Reader suite, and analytically measured worst adjacent-edge separation at approximately `2.34e-13px` across 402 sampled forward/backward frames.

- MINOR-1 found that the backward sheet still used the pre-mesh two-stop shade override. The focused correction mirrors the new three-stop shade profile while retaining the correct `to right` direction.
- MINOR-2 found that this contract omitted the user-visible easing change and removal of the standalone crease element. Items 7 and 8 now disclose both changes explicitly.
- Claude's N1-N5 remain advisory: its initial probe thresholds were stricter than the documented project bounds; the temporary strip bleed slightly scales turn-time texture; degenerate inputs fail safe; browser observations were not independently reproduced; and the separate repository/release HOLD remains untouched.

Claude Code independently micro re-gated `0c267bb8e224f06a2f97e8dec994576fca075d3e..0d1490effb3fa2ca2b1f17298cccbcf715ba75af` and returned **PASS**, closing MINOR-1 and MINOR-2 with no BLOCKER or MAJOR. It independently reproduced TypeScript and the 6-file / 39-test focused suite. Its new non-blocking MINOR-3 identified that the two durable records still displayed the pre-correction `38`-test count; the count is corrected here. This document records Claude Code's verdict and does not self-award independent closure or Guy's product acceptance.

Claude Code independently micro re-gated the spine-tangent correction range `ec098393dc0ea2d632e1c320c6a39248835473d7..3c17ea5a0a7a58e2e27d571ee5c212b17e8e3d48` and returned **PASS** with zero new BLOCKER, MAJOR or MINOR. It reproduced the 6-file / 41-test suite, TypeScript and `git diff --check`; measured `1.263deg` boundary deviation, `28.660deg` interior curl and `2.278e-13px` worst adjacent-edge separation; and confirmed exact landing, texture ordering, shadow bounds, settle completion and the unchanged `560ms` production duration. That same review carried forward **MAJOR-1** from the preceding deployment-record review because these records still negated the observed push and omitted the QA Preview/alias. Its N1-N4 remain advisory. This is Claude Code's technical verdict and does not grant Guy product or visual acceptance.

Documentation correction `04b53ad3b16565b088acf2c08ebb66bcf2470a31` recorded the push, `0/0` parity, Ready Preview and QA alias and removed the inaccurate unscoped exclusion. Claude Code subsequently micro re-gated `3c17ea5a0a7a58e2e27d571ee5c212b17e8e3d48..04b53ad3b16565b088acf2c08ebb66bcf2470a31`, returned **PASS**, and independently closed carried MAJOR-1. It reported zero BLOCKER, zero MAJOR and one new non-blocking documentation MINOR-1: the correction did not attribute the carried MAJOR and promoted the status before this closure review. This follow-up records the review sequence and attributes the finding and closure to Claude Code; Codex does not self-award either result.

Claude Code independently micro re-gated the attribution correction range `04b53ad3b16565b088acf2c08ebb66bcf2470a31..3f5532bdf80bdf345f1cab066ad7143480bae86b` and returned **PASS** with zero BLOCKER, zero MAJOR and zero MINOR. It independently closed the attribution MINOR, confirmed the exact five-step chronology and verified every Reader code/test blob remained byte-identical. Its N1-N4 remain advisory only. This is Claude Code's closure; no further technical or record-fidelity round is required absent a factual discrepancy.

### Browser proof

The local `/dev/reader` loaded the repository-owned eight-page Bunny/Bar fixture through the real `ReaderV2` controller. No credential file was opened; the local verification server used build-phase validation mode and made no provider or remote data call.

- Page loaded with meaningful content, no Next error overlay and zero console errors.
- A forward turn exposed exactly 12 live strip nodes with 12 distinct 3D transforms and completed with the overlay removed.
- A backward turn completed as the mirror and returned the correct page pair.
- A temporary 5-second local diagnostic duration exposed the full turn in slow motion. At the pivot, the first strip left the gutter continuously while the interior strips carried the visible wave; the diagnostic duration was restored to the production `560ms` before validation and is absent from the committed diff.
- Endpoint sampling against the measured DOM rectangles found the last painted forward and backward mesh within `0.8px` of the destination bounds, attributable only to the intentional `0.75px` strip overlap. The endpoint cast-shadow opacity was `0`, the overlay survived for that final paint, and the browser console contained no warning or error.
- The first visual pass showed banding from the inherited per-face inset shadow. After correction, computed face shadow was `none`; live strip shade opacity ranged approximately `0.008–0.018` in the captured frame.
- The static open-book frame did not translate or tilt.

### Moving paper-frame follow-up

Guy's subsequent product review correctly isolated the remaining perceptual break as a layer-composition defect rather than mesh geometry. `MaskOnBook.png` is the shared torn white page rim at `z-index: 10`, while the physical-turn overlay is above it at `z-index: 12`. The animated sheet reconstructed illustration/prose and paper but not that top rim, so it visually escaped the stationary frame during lift.

The correction is general across books and page content:

- `fullFrameProjectionIntoPage` deterministically re-bases any full-spread layer into a measured page-local coordinate system.
- `PaperPage` selects the existing typed left/right page box from its illustration/prose side and projects the exact `MASK_ON_BOOK_ASSET` into that surface.
- Because the projected asset lives inside the same texture window as content, every front/back face is sliced and transformed by the same connected 12-strip mesh. The page rim therefore bends with the sheet while the book binding, cover and static frame beneath it remain fixed.
- The implementation does not approximate the rim with a new CSS border, name any story/page, change the 560ms duration, or alter navigation, endpoint landing, curvature, reduced motion or mobile behavior.

Focused validation passes **6 files / 42 tests**, deterministic TypeScript and `git diff --check`. The new projection regression proves the full-frame origin and dimensions map back exactly to both measured page boxes. Local browser verification on the real eight-page tracked QA book observed 12 live slices and 24 carried frame images (front/back for every slice) in forward and backward turns. Temporary local environment material was removed before validation.

Exact implementation head `0a1819a3b6e68dc8912c5be41079678e734ea788` was pushed to the same-name branch at `2026-08-12 10:59:47 +0300`, after which live Git reported HEAD/upstream parity at `0/0`. Vercel Preview `dpl_H26aUYAeb5VNE9J5DotggH79B9Wn` (`https://small-heroes-4w0lp3e6k-smallheroes-projects.vercel.app`) reached **Ready**, and only the QA alias `qa.smallheroes.co.il` was assigned to it. No Production deployment, promotion or Production alias changed. These are operator-recorded deployment facts; the moving-frame implementation still requires independent read-only technical re-gate and Guy visual acceptance.

### Top, bottom and binding-pivot follow-up

Guy's QA screenshot of the deployed moving-frame correction established that carrying the shared frame image was necessary but not sufficient. Three causes were independently visible and traceable to the implementation:

1. The full-frame `MaskOnBook.png` projection is intentionally clipped to `OPEN_BOOK_PAGE_BOXES`. Decorative pixels outside those measured cream-page rectangles cannot supply a dependable top/bottom edge on the animated sheet.
2. The connected mesh can lift hundreds of pixels in Z at mid-turn. With the former `2600px` CSS perspective, a representative `933px` page produces approximately `845px` peak Z and a centre projection scale of about `1.48x`, making a connected sheet visibly escape above and below the photographed book.
3. The physical overlay has to be above the static page frame, but that also placed its bound edge above the photographed central gutter. The mesh tangent could therefore be geometrically coherent while still appearing to float over the binding.

The correction remains general and preserves the existing mesh authority:

- `DESKTOP_PAGE_TURN_PERSPECTIVE_PX` is a single typed `6400px` lens authority shared by component style and compensation math.
- `desktopPageTurnVerticalCompensation` applies the inverse centre projection factor to the vertical axis only. The horizontal strip positions, rotations, integrated Z, neighbouring-edge continuity and landing geometry are unchanged.
- `.physicalPaperEdge` supplies the moving physical top/bottom boundary and only the outer edge appropriate to the left illustration or right prose side. Because it lives inside `PaperPage`, all front/back strip windows bend it with the sheet; it never creates a false spine-side border.
- `openBookSpineClampWindow` derives a narrow full-height window from the measured inner edges of the left/right page boxes plus a bounded bleed. `DesktopBookSpread` renders that crop of the existing shared frame above the moving overlay only while a turn is active, so the sheet appears to emerge from under the photographed gutter.
- The binding, cover, static under-page frame, story content, `560ms` timing, navigation, mobile and reduced-motion behavior remain unchanged.

Focused validation passes **6 files / 44 tests**, deterministic TypeScript and `git diff --check`. New regressions prove the clamp covers the exact measured page gap and remains narrower than 3% of the spread; both forward and backward mid-turn poses multiply the CSS projection scale by their vertical compensation to exactly `1`; and the moving edge, shared lens and spine clamp are present in the Reader source contract. No full repository check was rerun; the separate recorded release HOLD remains unchanged. This follow-up requires independent read-only QA and Guy visual acceptance after QA Preview deployment.

## Exclusions and rollback

No website/Wizard, book content, provider, credential, image/audio generation, storage/database, payment or Production action occurred. The implementation commit `3c17ea5a0a7a58e2e27d571ee5c212b17e8e3d48` was pushed to the same-name remote branch at `2026-08-12 10:20:47 +0300`; live Git then showed HEAD/upstream parity at `0/0`. Vercel Preview `dpl_75u7MBASNj7Q7NQRbwy81WAEwWqP` (`https://small-heroes-5nabqlk20-smallheroes-projects.vercel.app`) reached **Ready**, and only the QA alias `qa.smallheroes.co.il` was assigned to it. No Production deployment, promotion or Production alias changed. The former unscoped no-push statement was inaccurate and is superseded by these facts. Rollback is a focused commit revert plus QA-alias reassignment; no data or generated artifact requires migration.

## Independent QA request

The spine-tangent implementation, deployment-record correction and attribution correction have independent PASS, and all associated BLOCKER/MAJOR/MINOR findings are closed. No further technical or record-fidelity review is required unless a factual discrepancy is identified. Guy product and visual acceptance, the separate repository/release HOLD and Production prohibition remain unchanged.
