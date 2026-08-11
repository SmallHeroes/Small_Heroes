'use client';

import { useLayoutEffect, useRef } from 'react';
import { splitIntoSentences, type DesktopSpread } from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import {
  DESKTOP_PHYSICAL_PAGE_TURN_MS,
  type DesktopPhysicalPageTurn as DesktopPhysicalPageTurnState,
} from './useDesktopPhysicalPageTurn';

const MAX_BEND_DEG = 14;
const MAX_SAG_DEG = 2.4;
const MAX_LIFT_PX = 30;

type PaperSide = 'illustration' | 'prose';

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
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

function SheetSlices({
  outgoing,
  incoming,
  frontSide,
  backSide,
  segment,
}: {
  outgoing: DesktopSpread;
  incoming: DesktopSpread;
  frontSide: PaperSide;
  backSide: PaperSide;
  segment: 'spine' | 'outer';
}) {
  const sliceClass = segment === 'spine' ? styles.physicalSliceSpine : styles.physicalSliceOuter;
  return (
    <>
      <div className={`${styles.physicalTurnFace} ${styles.physicalTurnFaceFront} ${sliceClass}`}>
        <div className={styles.physicalSliceWindow}>
          <PaperPage spread={outgoing} side={frontSide} />
        </div>
        <span className={styles.physicalTurnSheetShade} aria-hidden />
      </div>
      <div className={`${styles.physicalTurnFace} ${styles.physicalTurnFaceBack} ${sliceClass}`}>
        <div className={styles.physicalSliceWindow}>
          <PaperPage spread={incoming} side={backSide} />
        </div>
        <span className={styles.physicalTurnSheetShade} aria-hidden />
      </div>
    </>
  );
}

function setSheetPose(
  sheet: HTMLDivElement,
  direction: DesktopPhysicalPageTurnState['direction'],
  progress: number,
) {
  const sign = direction === 'forward' ? 1 : -1;
  const clamped = Math.min(1, Math.max(0, progress));
  const arc = Math.sin(clamped * Math.PI);
  sheet.style.setProperty('--physical-turn-deg', `${(sign * clamped * 180).toFixed(2)}deg`);
  sheet.style.setProperty('--physical-turn-bend', `${(-sign * arc * MAX_BEND_DEG).toFixed(2)}deg`);
  sheet.style.setProperty('--physical-turn-sag', `${(-arc * MAX_SAG_DEG).toFixed(2)}deg`);
  sheet.style.setProperty('--physical-turn-lift', `${(arc * MAX_LIFT_PX).toFixed(1)}px`);
  sheet.style.setProperty('--physical-turn-progress', arc.toFixed(3));
}

/**
 * The photographed book stays fixed. Only a paper sheet (front + back) moves,
 * using the two-segment bend proven in the original Reader experiment.
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
    let frame = 0;
    const startedAt = performance.now();
    setSheetPose(sheet, turn.direction, 0);

    const animate = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / DESKTOP_PHYSICAL_PAGE_TURN_MS);
      setSheetPose(sheet, turn.direction, easeInOutCubic(elapsed));
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
      >
        <div className={styles.physicalTurnSegmentSpine}>
          <SheetSlices
            outgoing={turn.outgoing}
            incoming={turn.incoming}
            frontSide={frontSide}
            backSide={backSide}
            segment="spine"
          />
        </div>
        <div className={styles.physicalTurnSegmentOuter}>
          <SheetSlices
            outgoing={turn.outgoing}
            incoming={turn.incoming}
            frontSide={frontSide}
            backSide={backSide}
            segment="outer"
          />
          <span className={styles.physicalTurnCrease} aria-hidden />
        </div>
      </div>
    </div>
  );
}
