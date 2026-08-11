'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  DESKTOP_PAGE_CURL_SLICE_COUNT,
  desktopPageCurlSlicePoses,
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
  if (side === 'illustration') {
    return (
      <div className={styles.physicalPaperPage}>
        {spread.illustrationUrl ? (
          <img
            className={styles.physicalPaperIllustration}
            src={spread.illustrationUrl}
            alt=""
            draggable={false}
          />
        ) : (
          <div className={styles.physicalPaperBlank} />
        )}
      </div>
    );
  }

  if (!spread.showText) {
    return <div className={styles.physicalPaperBlank} />;
  }

  return (
    <div className={styles.physicalPaperPage}>
      <div className={styles.physicalPaperProse} dir="rtl">
        {splitIntoSentences(spread.text).map((sentence, index) => (
          <p key={index} className={styles.physicalPaperLine}>
            {sentence}
          </p>
        ))}
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
  sheet: HTMLDivElement,
  slices: readonly HTMLDivElement[],
  direction: DesktopPhysicalPageTurnState['direction'],
  pageWidth: number,
  progress: number,
) {
  const clamped = Math.min(1, Math.max(0, progress));
  const arc = Math.sin(clamped * Math.PI);
  sheet.style.setProperty('--physical-turn-progress', arc.toFixed(3));
  sheet.style.setProperty('--physical-turn-y', `${(-arc * 1.5).toFixed(3)}px`);
  const poses = desktopPageCurlSlicePoses(
    direction,
    clamped,
    pageWidth,
    DESKTOP_PAGE_CURL_SLICE_COUNT,
  );

  for (const pose of poses) {
    const slice = slices[pose.sourceIndex];
    if (!slice) continue;
    slice.style.setProperty('--physical-turn-x', `${pose.translateXPx.toFixed(3)}px`);
    slice.style.setProperty('--physical-turn-z', `${pose.translateZPx.toFixed(3)}px`);
    slice.style.setProperty('--physical-turn-rotate-y', `${pose.rotationYDeg.toFixed(3)}deg`);
    slice.style.setProperty('--physical-turn-shade', pose.shadeOpacity.toFixed(3));
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
  const sheetRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const slices = Array.from(
      sheet.querySelectorAll<HTMLDivElement>('[data-physical-turn-slice]'),
    );
    const pageWidth = sheet.getBoundingClientRect().width || sheet.clientWidth || 1;
    let frame = 0;
    const startedAt = performance.now();
    setSheetPose(sheet, slices, turn.direction, pageWidth, 0);

    const animate = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / DESKTOP_PHYSICAL_PAGE_TURN_MS);
      setSheetPose(sheet, slices, turn.direction, pageWidth, easeInOutSine(elapsed));
      if (elapsed < 1) {
        frame = window.requestAnimationFrame(animate);
      } else {
        onComplete(turn.id);
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [onComplete, turn.direction, turn.id]);

  const isForward = turn.direction === 'forward';
  const guardSide: PaperSide = isForward ? 'prose' : 'illustration';
  const frontSide: PaperSide = isForward ? 'illustration' : 'prose';
  const backSide: PaperSide = isForward ? 'prose' : 'illustration';

  return (
    <div
      className={styles.physicalTurnOverlay}
      data-physical-page-turn={turn.direction}
      aria-hidden
    >
      <div
        className={`${styles.physicalTurnGuard} ${
          isForward ? styles.physicalTurnGuardRight : styles.physicalTurnGuardLeft
        }`}
      >
        <PaperPage spread={turn.outgoing} side={guardSide} />
      </div>
      <div
        className={`${styles.physicalTurnCastShadow} ${
          isForward ? styles.physicalTurnCastForward : styles.physicalTurnCastBackward
        }`}
      />
      <div
        ref={sheetRef}
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
