import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DESKTOP_PAGE_CURL_SLICE_COUNT,
  DESKTOP_PAGE_TURN_PERSPECTIVE_PX,
  desktopPageCurlSlicePoses,
  desktopPageTurnVerticalCompensation,
  pageTurnDirectionForIndexChange,
  readerRestartTransition,
} from '../book-layout/page-turn';
import {
  MOBILE_OVERLAY_LIMITS,
  mobileTextPresentationFor,
} from '../book-layout/adapters/mobile-page';
import {
  readerSourceAccessKey,
  readerSourceBookId,
  readerSourceExitHref,
  type ReaderBookSource,
} from '../reader-book-source';

describe('shared Reader page-turn contract', () => {
  it('derives deterministic forward/backward direction from scene order', () => {
    expect(pageTurnDirectionForIndexChange(1, 2)).toBe('forward');
    expect(pageTurnDirectionForIndexChange(2, 1)).toBe('backward');
    expect(pageTurnDirectionForIndexChange(2, 2)).toBe('initial');
  });

  it('resets restart state without exposing a stale turn direction', () => {
    expect(readerRestartTransition()).toEqual({
      sceneIndex: 0,
      pageTurnDirection: 'initial',
    });
  });

  it('keeps QA and production readers on the same directional data contract', () => {
    const qa = fs.readFileSync(
      path.join(process.cwd(), 'app', 'dev', 'viewer', 'DevBookViewer.tsx'),
      'utf8',
    );
    const reader = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.tsx'),
      'utf8',
    );
    for (const source of [qa, reader]) {
      expect(source).toContain('data-page-turn-direction={pageTurnDirection}');
      expect(source).toContain("data-page-turn-mode={physicalPageTurn ? 'physical-sheet' : 'instant'}");
      expect(source).toContain('<DesktopPhysicalPageTurn');
      expect(source).not.toContain('styles.sceneTurnForward');
      expect(source).not.toContain('styles.sceneTurnBackward');
    }
    expect(reader).toContain('setPageTurnDirection(restart.pageTurnDirection)');
  });

  it('keeps the old whole-book tilt/fade animation removed', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );
    expect(css).not.toContain('@keyframes readerPageTurnForward');
    expect(css).not.toContain('@keyframes readerPageTurnBackward');
    expect(css).not.toContain('@keyframes readerPageTurnShadow');
    expect(css).not.toContain('.sceneTurnForward');
    expect(css).not.toContain('.sceneTurnBackward');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('turns a connected paper mesh through 180 degrees while the book frame stays static', () => {
    const engine = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'DesktopPhysicalPageTurn.tsx',
      ),
      'utf8',
    );
    const spread = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'DesktopBookSpread.tsx',
      ),
      'utf8',
    );
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );

    expect(engine).toContain('DESKTOP_PAGE_CURL_SLICE_COUNT');
    expect(engine).toContain('desktopPageCurlSlicePoses');
    expect(engine).toContain('styles.physicalTurnSlice');
    expect(engine).not.toContain('styles.physicalTurnSegmentSpine');
    expect(engine).not.toContain('styles.physicalTurnSegmentOuter');
    expect(engine).toContain('styles.physicalTurnFaceBack');
    expect(engine).toContain('fullFrameProjectionIntoPage(pageBox)');
    expect(engine).toContain('src={MASK_ON_BOOK_ASSET.src}');
    expect(engine).toContain('className={styles.physicalPaperFrame}');
    expect(engine).toContain('className={styles.physicalPaperEdge}');
    expect(spread).toContain('data-physical-turn-spine-clamp');
    expect(spread).toContain('{pageTurnOverlay}');
    expect(css).toContain('backface-visibility: hidden');
    expect(css).toContain('rotateY(var(--physical-turn-rotate-y');
    expect(css).toContain('var(--physical-turn-scale-x, 1)');
    expect(css).toContain('opacity: calc(var(--physical-turn-progress, 0) * 0.38)');
    expect(css).toContain('var(--physical-turn-slice-count)');
    expect(css).toContain('.physicalPaperFrame');
    expect(css).toContain('.physicalPaperEdge');
    expect(css).toContain('.physicalTurnSpineClamp');
    expect(css).toContain('var(--physical-turn-perspective, 6400px)');
    expect(css).toContain('max-width: none');
    expect(engine).toContain('targetRect.left - sourceRect.left');
    expect(engine).toContain('targetPageWidth: targetRect.width');
    expect(engine).toContain('settleFrame = window.requestAnimationFrame');
  });

  it('neutralizes perspective growth on the vertical paper edges without flattening depth', () => {
    for (const direction of ['forward', 'backward'] as const) {
      for (const pose of desktopPageCurlSlicePoses(direction, 0.5, 900)) {
        const projectedScale = DESKTOP_PAGE_TURN_PERSPECTIVE_PX /
          (DESKTOP_PAGE_TURN_PERSPECTIVE_PX - pose.translateZPx);
        expect(
          projectedScale * desktopPageTurnVerticalCompensation(pose.translateZPx),
        ).toBeCloseTo(1, 10);
      }
    }
  });

  it('keeps every paper-mesh edge connected throughout the curl', () => {
    const pageWidth = 480;
    const sourceSliceWidth = pageWidth / DESKTOP_PAGE_CURL_SLICE_COUNT;

    for (const direction of ['forward', 'backward'] as const) {
      for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
        const poses = [...desktopPageCurlSlicePoses(direction, progress, pageWidth)]
          .sort((left, right) => left.outwardIndex - right.outwardIndex);
        let previousOuterEdge: { x: number; z: number } | null = null;

        for (const pose of poses) {
          const radians = Math.abs(pose.rotationYDeg) * Math.PI / 180;
          const outwardSign = direction === 'forward' ? -1 : 1;
          const sliceWidth = sourceSliceWidth * pose.scaleX;
          const segment = {
            x: outwardSign * sliceWidth * Math.cos(radians),
            z: sliceWidth * Math.sin(radians),
          };
          const center = {
            x: (pose.sourceIndex + 0.5) * sourceSliceWidth + pose.translateXPx,
            z: pose.translateZPx,
          };
          const innerEdge = {
            x: center.x - segment.x / 2,
            z: center.z - segment.z / 2,
          };
          const outerEdge = {
            x: center.x + segment.x / 2,
            z: center.z + segment.z / 2,
          };

          if (previousOuterEdge) {
            expect(innerEdge.x).toBeCloseTo(previousOuterEdge.x, 8);
            expect(innerEdge.z).toBeCloseTo(previousOuterEdge.z, 8);
          }
          previousOuterEdge = outerEdge;
        }
      }
    }
  });

  it('lands exactly on unequal destination page rectangles in both directions', () => {
    const leftPage = { x: 40.864, width: 453.354 };
    const rightPage = { x: 501.928, width: 468.774 };

    for (const scenario of [
      { direction: 'forward' as const, source: leftPage, target: rightPage },
      { direction: 'backward' as const, source: rightPage, target: leftPage },
    ]) {
      const targetOffset = scenario.target.x - scenario.source.x;
      const poses = [...desktopPageCurlSlicePoses(
        scenario.direction,
        1,
        scenario.source.width,
        DESKTOP_PAGE_CURL_SLICE_COUNT,
        {
          targetOffsetXPx: targetOffset,
          targetPageWidth: scenario.target.width,
        },
      )].sort((left, right) => left.outwardIndex - right.outwardIndex);
      const sourceSliceWidth = scenario.source.width / DESKTOP_PAGE_CURL_SLICE_COUNT;
      const landedSliceWidth = scenario.target.width / DESKTOP_PAGE_CURL_SLICE_COUNT;
      const outwardSign = scenario.direction === 'forward' ? -1 : 1;
      let firstInnerEdge: number | null = null;
      let lastOuterEdge: number | null = null;

      for (const pose of poses) {
        const radians = Math.abs(pose.rotationYDeg) * Math.PI / 180;
        const segmentX = outwardSign * landedSliceWidth * Math.cos(radians);
        const centerX =
          (pose.sourceIndex + 0.5) * sourceSliceWidth + pose.translateXPx;
        const innerEdge = centerX - segmentX / 2;
        const outerEdge = centerX + segmentX / 2;
        firstInnerEdge ??= innerEdge;
        lastOuterEdge = outerEdge;
        expect(pose.scaleX).toBeCloseTo(
          scenario.target.width / scenario.source.width,
          10,
        );
      }

      if (scenario.direction === 'forward') {
        expect(firstInnerEdge).toBeCloseTo(targetOffset, 8);
        expect(lastOuterEdge).toBeCloseTo(targetOffset + scenario.target.width, 8);
      } else {
        expect(firstInnerEdge).toBeCloseTo(targetOffset + scenario.target.width, 8);
        expect(lastOuterEdge).toBeCloseTo(targetOffset, 8);
      }
    }
  });

  it('is flat at rest and landing but visibly non-rigid mid-turn', () => {
    for (const direction of ['forward', 'backward'] as const) {
      const start = desktopPageCurlSlicePoses(direction, 0, 480);
      const middle = desktopPageCurlSlicePoses(direction, 0.5, 480);
      const end = desktopPageCurlSlicePoses(direction, 1, 480);

      expect(start).toHaveLength(DESKTOP_PAGE_CURL_SLICE_COUNT);
      expect(start.every(
        (pose) => pose.backSourceIndex === DESKTOP_PAGE_CURL_SLICE_COUNT - 1 - pose.sourceIndex,
      )).toBe(true);
      expect(start.every((pose) => pose.rotationYDeg === 0)).toBe(true);
      expect(start.every((pose) => Math.abs(pose.translateZPx) < 1e-10)).toBe(true);
      expect(new Set(middle.map((pose) => pose.rotationYDeg.toFixed(3))).size).toBeGreaterThan(6);
      expect(middle.every((pose) => pose.translateZPx > 0)).toBe(true);
      expect(Math.max(...middle.map((pose) => pose.shadeOpacity))).toBeLessThan(0.07);
      expect(end.every((pose) => Math.abs(Math.abs(pose.rotationYDeg) - 180) < 1e-10)).toBe(true);
      expect(end.every((pose) => Math.abs(pose.translateZPx) < 1e-10)).toBe(true);
    }
  });

  it('keeps the spine tangent coherent while concentrating curl in the paper body', () => {
    for (const direction of ['forward', 'backward'] as const) {
      const poses = desktopPageCurlSlicePoses(direction, 0.5, 480);
      const rotationSign = direction === 'forward' ? 1 : -1;
      const hingeRotation = rotationSign * 90;
      const spinePose = poses.find((pose) => pose.outwardIndex === 0);
      const outerPose = poses.find(
        (pose) => pose.outwardIndex === DESKTOP_PAGE_CURL_SLICE_COUNT - 1,
      );
      const interiorOffsets = poses
        .filter((pose) => pose.outwardIndex > 0 && pose.outwardIndex < DESKTOP_PAGE_CURL_SLICE_COUNT - 1)
        .map((pose) => Math.abs(pose.rotationYDeg - hingeRotation));

      expect(spinePose).toBeDefined();
      expect(outerPose).toBeDefined();
      expect(Math.abs(spinePose!.rotationYDeg - hingeRotation)).toBeLessThan(2);
      expect(Math.abs(outerPose!.rotationYDeg - hingeRotation)).toBeLessThan(2);
      expect(Math.max(...interiorOffsets)).toBeGreaterThan(25);
    }
  });

  it('mirrors the same bounded three-stop curvature shade in both directions', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    ).replace(/\s+/g, ' ');
    const shadeStops = [
      'rgba(30, 20, 10, 0.2)',
      'rgba(255, 251, 242, 0.05) 48%',
      'rgba(30, 20, 10, 0.08)',
    ].join(', ');

    expect(css).toContain(`background: linear-gradient( to left, ${shadeStops} );`);
    expect(css).toContain(
      `.physicalTurnSheetBackward .physicalTurnSheetShade { background: linear-gradient( to right, ${shadeStops} ); }`,
    );
    expect(css).not.toContain('rgba(30, 20, 10, 0.24)');
  });

  it('keeps short mobile prose over the illustration and moves dense prose to paper', () => {
    expect(mobileTextPresentationFor('A short line for the page.', 'overlay')).toBe('overlay');

    const denseCopy = Array.from(
      { length: MOBILE_OVERLAY_LIMITS.words + 1 },
      (_, index) => `word${index}`,
    ).join(' ');
    expect(mobileTextPresentationFor(denseCopy, 'overlay')).toBe('paper_panel');
  });

  it('keeps captionless mobile scenes captionless even when source text exists', () => {
    expect(mobileTextPresentationFor('Hidden narration.', 'captionless')).toBe('captionless');
    expect(mobileTextPresentationFor('Hidden narration.', 'standard', false)).toBe('captionless');
  });

  it('uses a closed Reader source contract for orders and tracked QA fixtures', () => {
    const order: ReaderBookSource = {
      kind: 'order',
      bookId: 'book/1',
      accessKey: 'key from props',
    };
    const qaFixture: ReaderBookSource = {
      kind: 'qa_fixture',
      payload: {
        id: 'qa-book',
        status: 'QA_FIXTURE_READY',
        book: null,
      },
      exitHref: '/dev/viewer?dir=fixture',
      exitLabel: 'Back to QA library',
    };

    expect(readerSourceBookId(order)).toBe('book/1');
    expect(readerSourceBookId(qaFixture)).toBe('qa-book');
    expect(readerSourceAccessKey(order, 'browser key')).toBe('key from props');
    expect(readerSourceAccessKey({ ...order, accessKey: '' }, 'browser key')).toBe('browser key');
    expect(readerSourceAccessKey(qaFixture, 'ambient key')).toBe('');
    expect(readerSourceExitHref(order, 'resolved key')).toBe(
      '/ready?orderId=book%2F1&accessKey=resolved%20key',
    );
    expect(readerSourceExitHref(qaFixture, 'ignored')).toBe('/dev/viewer?dir=fixture');
  });

  it('routes tracked QA books through the same ReaderV2 controller as production orders', () => {
    const qaRoute = fs.readFileSync(
      path.join(process.cwd(), 'app', 'dev', 'reader', 'page.tsx'),
      'utf8',
    );
    const productionRoute = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'page.tsx'),
      'utf8',
    );
    const mobilePage = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'MobileBookPage.tsx',
      ),
      'utf8',
    );
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );

    expect(qaRoute).toContain('trackedQaReaderFixtureForDir');
    expect(qaRoute).toContain("kind: 'qa_fixture'");
    expect(qaRoute).toContain('<ReaderV2');
    expect(productionRoute).toContain("kind: 'order'");
    const reader = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.tsx'),
      'utf8',
    );
    expect(reader).toContain('const EMPTY_DEV_LAYOUT_FLAGS: DevLayoutQueryFlags = {}');
    expect(reader).toContain('devLayoutFlags = EMPTY_DEV_LAYOUT_FLAGS');
    expect(reader).not.toContain('devLayoutFlags = {}');
    expect(mobilePage).toContain("page.textPresentation === 'paper_panel'");
    expect(css).toContain('.mobilePaperPanel');
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 44px');
  });
});
