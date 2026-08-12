'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  DESKTOP_PAGE_CURL_SLICE_COUNT,
  DESKTOP_PAGE_TURN_PERSPECTIVE_PX,
  MASK_ON_BOOK_ASSET,
  OPEN_BOOK_PAGE_BOXES,
  desktopPageCurlSlicePoses,
  desktopPageTurnVerticalCompensation,
  fullFrameProjectionIntoPage,
  splitIntoSentences,
  type DesktopSpread,
} from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import {
  DESKTOP_PHYSICAL_PAGE_TURN_MS,
  type DesktopPhysicalPageTurn as DesktopPhysicalPageTurnState,
} from './useDesktopPhysicalPageTurn';

type PaperSide = 'illustration' | 'prose';

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function PaperPage({ spread, side }: { spread: DesktopSpread; side: PaperSide }) {
  const pageBox = side === 'illustration'
    ? OPEN_BOOK_PAGE_BOXES.leftPage
    : OPEN_BOOK_PAGE_BOXES.rightPage;
  const frameProjection = fullFrameProjectionIntoPage(pageBox);
  const frameStyle = {
    left: `${frameProjection.x * 100}%`,
    top: `${frameProjection.y * 100}%`,
    width: `${frameProjection.w * 100}%`,
    height: `${frameProjection.h * 100}%`,
  } as CSSProperties;

  return (
    <div
      className={`${styles.physicalPaperPage} ${
        side === 'illustration'
          ? styles.physicalPaperPageIllustration
          : styles.physicalPaperPageProse
      }`}
    >
      {side === 'illustration' ? (
        spread.illustrationUrl ? (
          <img
            className={styles.physicalPaperIllustration}
            src={spread.illustrationUrl}
            alt=""
            draggable={false}
          />
        ) : (
          <div className={styles.physicalPaperBlank} />
        )
      ) : spread.showText ? (
        <div className={styles.physicalPaperProse} dir="rtl">
          {splitIntoSentences(spread.text).map((sentence, index) => (
            <p key={index} className={styles.physicalPaperLine}>
              {sentence}
            </p>
          ))}
        </div>
      ) : (
        <div className={styles.physicalPaperBlank} />
      )}
      <img
        className={styles.physicalPaperFrame}
        src={MASK_ON_BOOK_ASSET.src}
        width={MASK_ON_BOOK_ASSET.width}
        height={MASK_ON_BOOK_ASSET.height}
        style={frameStyle}
        alt=""
        aria-hidden
        draggable={false}
      />
      <span className={styles.physicalPaperEdge} aria-hidden />
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
  const frontWindowStyle = {
    '--physical-turn-texture-index': sourceIndex,
  } as CSSProperties;
  const backWindowStyle = {
    '--physical-turn-texture-index': backSourceIndex,
  } as CSSProperties;

  return (
    <div
      className={styles.physicalTurnSlice}
      data-physical-turn-slice={sourceIndex}
      style={sliceStyle}
    >
      <div className={`${styles.physicalTurnFace} ${styles.physicalTurnFaceFront}`}>
        <div className={styles.physicalSliceWindow} style={frontWindowStyle}>
          <PaperPage spread={outgoing} side={frontSide} />
        </div>
        <span className={styles.physicalTurnSheetShade} aria-hidden />
      </div>
      <div className={`${styles.physicalTurnFace} ${styles.physicalTurnFaceBack}`}>
        <div className={styles.physicalSliceWindow} style={backWindowStyle}>
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
  const targetOffsetY = targetRect.top - sourceRect.top;
  const scaleY = sourceRect.height > 0
    ? 1 + (targetRect.height / sourceRect.height - 1) * clamped
    : 1;
  overlay.style.setProperty('--physical-turn-progress', arc.toFixed(6));
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
    let frame = 0;
    let settleFrame = 0;
    const startedAt = performance.now();
    setSheetPose(overlay, sheet, slices, turn.direction, sourceRect, targetRect, 0);

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
        // Let the exact landing geometry paint once before replacing the overlay
        // with the identical static destination spread. Completing in this same
        // frame can drop the final pose and expose the penultimate curled frame.
        settleFrame = window.requestAnimationFrame(() => onComplete(turn.id));
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(settleFrame);
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
