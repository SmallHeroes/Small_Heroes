'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  DESKTOP_PAGE_CURL_SLICE_COUNT,
  DESKTOP_PAGE_TURN_PERSPECTIVE_PX,
  LEFT_PAGE_MASK_WINDOW,
  OPEN_BOOK_ASSET,
  OPEN_BOOK_PAGE_BOXES,
  desktopPageCurlSlicePoses,
  desktopPageTurnVerticalCompensation,
  fullFrameProjectionIntoPage,
  type DesktopSpread,
} from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import {
  DesktopBookPageSideSurface,
  type DesktopBookPageSide,
} from './DesktopBookPageSurface';
import {
  createDesktopPhysicalPageTurnSettler,
  createDesktopPhysicalPageTurnUnmountGuard,
  DESKTOP_PHYSICAL_PAGE_TURN_MS,
  scheduleDesktopPhysicalPageTurnHandoff,
  type DesktopPhysicalPageTurn as DesktopPhysicalPageTurnState,
} from './useDesktopPhysicalPageTurn';

type PaperSide = DesktopBookPageSide;

const PHYSICAL_TURN_FACE_BLEED_PX = 0.5;
const PHYSICAL_TURN_HANDOFF_START = 0.88;

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function PaperPage({ spread, side }: { spread: DesktopSpread; side: PaperSide }) {
  const pageBox = side === 'illustration'
    ? LEFT_PAGE_MASK_WINDOW
    : OPEN_BOOK_PAGE_BOXES.rightPage;
  const contentProjection = fullFrameProjectionIntoPage(pageBox);
  const pageProjectionStyle = {
    left: `${contentProjection.x * 100}%`,
    top: `${contentProjection.y * 100}%`,
    width: `${contentProjection.w * 100}%`,
    height: `${contentProjection.h * 100}%`,
  } as CSSProperties;

  return (
    <div
      className={styles.physicalPaperPage}
      data-physical-paper-side={side}
    >
      <img
        src={OPEN_BOOK_ASSET.src}
        width={OPEN_BOOK_ASSET.width}
        height={OPEN_BOOK_ASSET.height}
        alt=""
        aria-hidden
        draggable={false}
        data-physical-book-substrate
        className={styles.physicalBookSubstrateProjection}
        style={pageProjectionStyle}
      />
      <div className={styles.physicalBookContentProjection} style={pageProjectionStyle}>
        <DesktopBookPageSideSurface
          spread={spread}
          isCurrent
          side={side}
          textureOnly
        />
      </div>
    </div>
  );
}

function SheetSlice({
  outgoing,
  incoming,
  frontSide,
  backSide,
  sourceIndex,
}: {
  outgoing: DesktopSpread;
  incoming: DesktopSpread;
  frontSide: PaperSide;
  backSide: PaperSide;
  sourceIndex: number;
}) {
  const backSourceIndex = DESKTOP_PAGE_CURL_SLICE_COUNT - 1 - sourceIndex;
  const sliceStyle = {
    '--physical-turn-source-index': sourceIndex,
  } as CSSProperties;
  return (
    <div
      className={styles.physicalTurnSlice}
      data-physical-turn-slice={sourceIndex}
      style={sliceStyle}
    >
      <div className={`${styles.physicalTurnFace} ${styles.physicalTurnFaceFront}`}>
        <div
          className={styles.physicalSliceWindow}
          data-physical-turn-texture-index={sourceIndex}
        >
          <PaperPage spread={outgoing} side={frontSide} />
        </div>
        <span className={styles.physicalTurnSheetShade} aria-hidden />
      </div>
      <div className={`${styles.physicalTurnFace} ${styles.physicalTurnFaceBack}`}>
        <div
          className={styles.physicalSliceWindow}
          data-physical-turn-texture-index={backSourceIndex}
        >
          <PaperPage spread={incoming} side={backSide} />
        </div>
        <span className={styles.physicalTurnSheetShade} aria-hidden />
      </div>
    </div>
  );
}

function setSheetPose(
  overlay: HTMLDivElement,
  sheet: HTMLDivElement,
  slices: readonly HTMLDivElement[],
  direction: DesktopPhysicalPageTurnState['direction'],
  sourceRect: DOMRect,
  targetRect: DOMRect,
  progress: number,
) {
  const clamped = Math.min(1, Math.max(0, progress));
  const arc = Math.sin(clamped * Math.PI);
  const handoffOpacity = clamped <= PHYSICAL_TURN_HANDOFF_START
    ? 1
    : 1 - (clamped - PHYSICAL_TURN_HANDOFF_START) /
      (1 - PHYSICAL_TURN_HANDOFF_START);
  const targetOffsetY = targetRect.top - sourceRect.top;
  const scaleY = sourceRect.height > 0
    ? 1 + (targetRect.height / sourceRect.height - 1) * clamped
    : 1;
  overlay.style.setProperty('--physical-turn-progress', arc.toFixed(6));
  overlay.style.opacity = Math.max(0, handoffOpacity).toFixed(6);
  sheet.style.setProperty(
    '--physical-turn-y',
    `${(targetOffsetY * clamped - arc * 1.5).toFixed(3)}px`,
  );
  const poses = desktopPageCurlSlicePoses(
    direction,
    clamped,
    sourceRect.width,
    DESKTOP_PAGE_CURL_SLICE_COUNT,
    {
      targetOffsetXPx: targetRect.left - sourceRect.left,
      targetPageWidth: targetRect.width,
    },
  );

  for (const pose of poses) {
    const slice = slices[pose.sourceIndex];
    if (!slice) continue;
    slice.style.setProperty('--physical-turn-x', `${pose.translateXPx.toFixed(3)}px`);
    slice.style.setProperty('--physical-turn-z', `${pose.translateZPx.toFixed(3)}px`);
    slice.style.setProperty('--physical-turn-rotate-y', `${pose.rotationYDeg.toFixed(3)}deg`);
    slice.style.setProperty('--physical-turn-shade', pose.shadeOpacity.toFixed(3));
    slice.style.setProperty('--physical-turn-scale-x', pose.scaleX.toFixed(6));
    slice.style.setProperty(
      '--physical-turn-scale-y',
      (scaleY * desktopPageTurnVerticalCompensation(pose.translateZPx)).toFixed(6),
    );
  }
}

/**
 * The photographed book stays fixed. Only a paper sheet (front + back) moves,
 * using a connected strip mesh whose curvature changes along the sheet.
 */
export function DesktopPhysicalPageTurn({
  turn,
  onComplete,
}: {
  turn: DesktopPhysicalPageTurnState;
  onComplete: (id: number) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLDivElement>(null);
  const unmountGuardRef = useRef<ReturnType<
    typeof createDesktopPhysicalPageTurnUnmountGuard
  > | null>(null);
  if (!unmountGuardRef.current) {
    unmountGuardRef.current = createDesktopPhysicalPageTurnUnmountGuard(queueMicrotask);
  }

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const sheet = sheetRef.current;
    const landing = landingRef.current;
    if (!overlay || !sheet || !landing) return;
    const slices = Array.from(
      sheet.querySelectorAll<HTMLDivElement>('[data-physical-turn-slice]'),
    );
    const sourceRect = sheet.getBoundingClientRect();
    const targetRect = landing.getBoundingClientRect();
    const nominalSliceWidth = sourceRect.width / DESKTOP_PAGE_CURL_SLICE_COUNT;
    const mountGeneration = unmountGuardRef.current?.mount();
    for (const [sourceIndex, slice] of slices.entries()) {
      slice.style.left = `${(sourceIndex * nominalSliceWidth).toFixed(4)}px`;
      slice.style.width = `${nominalSliceWidth.toFixed(4)}px`;
    }
    for (const windowElement of sheet.querySelectorAll<HTMLDivElement>(
      '[data-physical-turn-texture-index]',
    )) {
      const textureIndex = Number(windowElement.dataset.physicalTurnTextureIndex);
      windowElement.style.width = `${sourceRect.width.toFixed(4)}px`;
      windowElement.style.left = `${(
        -textureIndex * nominalSliceWidth + PHYSICAL_TURN_FACE_BLEED_PX
      ).toFixed(4)}px`;
    }
    let frame = 0;
    let watchdogTimer = 0;
    const startedAt = performance.now();
    setSheetPose(overlay, sheet, slices, turn.direction, sourceRect, targetRect, 0);

    // The watchdog and normal animation completion race through one idempotent
    // controller, so neither path can unmount a partially painted sheet.
    const settler = createDesktopPhysicalPageTurnSettler(
      () => window.cancelAnimationFrame(frame),
      () => window.clearTimeout(watchdogTimer),
      () => scheduleDesktopPhysicalPageTurnHandoff(
        window.requestAnimationFrame.bind(window),
        window.cancelAnimationFrame.bind(window),
        () => {
          setSheetPose(overlay, sheet, slices, turn.direction, sourceRect, targetRect, 1);
          overlay.style.visibility = 'hidden';
        },
        () => onComplete(turn.id),
      ),
    );

    watchdogTimer = window.setTimeout(
      settler.settle,
      DESKTOP_PHYSICAL_PAGE_TURN_MS + 180,
    );

    const animate = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / DESKTOP_PHYSICAL_PAGE_TURN_MS);
      setSheetPose(
        overlay,
        sheet,
        slices,
        turn.direction,
        sourceRect,
        targetRect,
        easeInOutSine(elapsed),
      );
      if (elapsed < 1) {
        frame = window.requestAnimationFrame(animate);
      } else {
        // The incoming static spread has been mounted below the sheet since the
        // turn started. The shared settle path hides that exact canonical DOM
        // for a painted frame before unmounting the overlay.
        settler.settle();
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(watchdogTimer);
      settler.cancel();
      if (mountGeneration != null) {
        unmountGuardRef.current?.abortIfStillUnmounted(
          mountGeneration,
          () => onComplete(turn.id),
        );
      }
    };
  }, [onComplete, turn.direction, turn.id]);

  const isForward = turn.direction === 'forward';
  const guardSide: PaperSide = isForward ? 'prose' : 'illustration';
  const frontSide: PaperSide = isForward ? 'illustration' : 'prose';
  const backSide: PaperSide = isForward ? 'prose' : 'illustration';

  return (
    <div
      ref={overlayRef}
      className={styles.physicalTurnOverlay}
      data-physical-page-turn={turn.direction}
      style={{
        '--physical-turn-perspective': `${DESKTOP_PAGE_TURN_PERSPECTIVE_PX}px`,
      } as CSSProperties}
      aria-hidden
    >
      <div
        ref={landingRef}
        data-physical-turn-landing
        className={`${styles.physicalTurnGuard} ${
          isForward ? styles.physicalTurnGuardRight : styles.physicalTurnGuardLeft
        }`}
      >
        <PaperPage spread={turn.outgoing} side={guardSide} />
      </div>
      <div
        data-physical-turn-shadow
        className={`${styles.physicalTurnCastShadow} ${
          isForward ? styles.physicalTurnCastForward : styles.physicalTurnCastBackward
        }`}
      />
      <div
        ref={sheetRef}
        data-physical-turn-sheet
        className={`${styles.physicalTurnSheet} ${
          isForward ? styles.physicalTurnSheetForward : styles.physicalTurnSheetBackward
        }`}
        style={{
          '--physical-turn-slice-count': DESKTOP_PAGE_CURL_SLICE_COUNT,
        } as CSSProperties}
      >
        {Array.from({ length: DESKTOP_PAGE_CURL_SLICE_COUNT }, (_, sourceIndex) => (
          <SheetSlice
            key={sourceIndex}
            outgoing={turn.outgoing}
            incoming={turn.incoming}
            frontSide={frontSide}
            backSide={backSide}
            sourceIndex={sourceIndex}
          />
        ))}
      </div>
    </div>
  );
}
