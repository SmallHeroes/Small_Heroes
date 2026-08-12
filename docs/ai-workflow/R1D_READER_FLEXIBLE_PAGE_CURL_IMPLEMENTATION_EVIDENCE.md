# R1D Reader Flexible Page Curl — Implementation Evidence

Status: implementation complete and locally verified; independent Claude Code QA and Guy product acceptance pending.

## Authority and topology

- Parent: `640476ddfaf831ede8eca6e62f7529eb0c4f2107`
- Endpoint-correction parent: `e933984bc651d2d8e3a63f9309f53958736bc0ee`
- Branch: `codex/r1d-reader-premium-site-qa-integration`
- Worktree: `C:\Users\guyna\.codex\worktrees\qaexperience1\Small_Heroes`
- External cost: `$0`
- Production: unchanged and blocked

## Observed defect and root cause

The prior renderer rotated one parent sheet through 180 degrees and added a single 14-degree bend to an outer 38.2% segment. Its comment claimed the two planes prevented a rigid-card appearance, but direct product review and source inspection falsified that claim. A global plane plus one hinge cannot express distributed paper curvature.

The first mesh browser pass also exposed a secondary presentation defect: the old inset shadow was repeated independently on every strip, making the page look corrugated. The final implementation removes per-strip box shadows and keeps only low-opacity curvature shading plus the existing whole-sheet cast shadow.

Guy's later screen recording exposed a distinct geometric break at the completion boundary. Repository geometry proves that the left and right page rectangles are not equal: they have different widths, offsets and a spine gap. The mesh used only the source width and an equal-size default destination, so its last animated rectangle could not coincide with the static destination. In addition, `onComplete` ran in the same animation frame that wrote the exact landing pose, allowing React to remove the overlay before that pose painted, and the cast shadow retained constant opacity until removal.

## Implemented contract

1. `DESKTOP_PAGE_CURL_SLICE_COUNT` is a closed internal value of 12.
2. `desktopPageCurlSlicePoses` is pure and accepts only direction, progress, page width and an internal/test slice count.
3. Strips are integrated from the spine outward. Each desired centre is derived from the preceding outer edge, so adjacent inner/outer edges coincide through the entire turn.
4. A bounded cosine/sine profile varies local Y rotation across the sheet. Progress 0 and 1 force zero curl amplitude and exactly coplanar strips.
5. Front texture windows retain source order. Back windows use the exact reversed source index so the incoming page is upright after the 180-degree face flip.
6. A 0.75px overlap hides subpixel cracks without changing geometry. Curvature shading remains below 0.07 opacity and the face itself has no per-strip box shadow.
7. The animation easing changes from `easeInOutCubic` to `easeInOutSine`, giving the connected mesh a gentler acceleration and deceleration while preserving the 560ms duration.
8. The former standalone crease element and its directional gradients are removed. Curvature is now expressed by the connected strip geometry and bounded whole-strip shade profile rather than a second hinge highlight.
9. The existing 560ms duration, navigation guard, fallback timer, static book frame, mobile skip and `prefers-reduced-motion` behavior are unchanged.
10. The component measures the source sheet and destination guard rectangles once per turn. The pure mesh receives a typed destination offset/width authority and interpolates its page width and spine anchor into that exact rectangle. Vertical offset and height are interpolated in the component from the same measured pair.
11. The cast shadow is driven by the bounded turn arc, so it is zero at both static handoff endpoints and peaks only during the curl.
12. Completion is deferred by one additional `requestAnimationFrame` after the exact final pose is written. The overlay therefore paints the destination geometry before the identical static spread replaces it.

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

Result: **6 files / 40 tests PASS** after the endpoint correction added direct unequal-destination landing coverage in both directions.

Direct geometry regressions prove:

- every neighboring edge remains connected at progress `0`, `0.2`, `0.5`, `0.8` and `1`, forward and backward;
- all 12 strips are flat at rest and landing;
- unequal source/destination page rectangles land on the exact typed destination edges in both directions;
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

### Browser proof

The local `/dev/reader` loaded the repository-owned eight-page Bunny/Bar fixture through the real `ReaderV2` controller. No credential file was opened; the local verification server used build-phase validation mode and made no provider or remote data call.

- Page loaded with meaningful content, no Next error overlay and zero console errors.
- A forward turn exposed exactly 12 live strip nodes with 12 distinct 3D transforms and completed with the overlay removed.
- A backward turn completed as the mirror and returned the correct page pair.
- Endpoint sampling against the measured DOM rectangles found the last painted forward and backward mesh within `0.8px` of the destination bounds, attributable only to the intentional `0.75px` strip overlap. The endpoint cast-shadow opacity was `0`, the overlay survived for that final paint, and the browser console contained no warning or error.
- The first visual pass showed banding from the inherited per-face inset shadow. After correction, computed face shadow was `none`; live strip shade opacity ranged approximately `0.008–0.018` in the captured frame.
- The static open-book frame did not translate or tilt.

## Exclusions and rollback

No website/Wizard, book content, provider, credential, image/audio generation, storage/database, payment, Production deployment or push action occurred. Rollback is a focused commit revert; no data or generated artifact requires migration.

## Independent QA request

Claude Code must review the exact committed endpoint-correction parent-to-head range read-only and return PASS or HOLD. It should specifically try to falsify unequal source/destination landing geometry, the one-painted-frame handoff, endpoint shadow removal, connected geometry, forward/backward mirroring, texture order, flat endpoints, unchanged reduced-motion/mobile behavior, and the claimed four-file production/test scope plus two durable record updates.
