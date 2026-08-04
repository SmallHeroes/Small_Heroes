'use client';

/**
 * EXPERIMENT v2 — RTL physical page-turn engine (dev-only prototype).
 *
 * Iteration on Guy's feedback:
 * 1. The turning sheet is PURE PAPER — the photographed book frame
 *    (OpenBook.png) never moves; only the page content (paper + illustration
 *    + prose) lifts. The frame stays on the static base layers.
 * 2. Paper physics — the sheet is two hinged segments (spine-side + outer)
 *    plus per-frame bend/sag/lift shaped by a rAF animator: the bend peaks
 *    mid-flight (sin curve) and the page lands flat. No rigid-plank feel.
 *
 * Hebrew physics: forward lifts the LEFT page and folds it rightward over
 * the centre spine; back face carries the next spread's RIGHT page.
 * Text stays live HTML. Page window = current ±1. Inputs: drag (cancel <50%),
 * edge tap, buttons, ArrowLeft=forward (production convention).
 * Reduced-motion / mobile: crossfade / lightweight slide (no 3D sheet).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './flip-experiment.module.css';
import { SAMPLE_SPREADS, SAMPLE_BOOK_TITLE, type SampleSpread } from './sample-story';

const OPEN_BOOK_SRC = '/Images/OpenBook.png';
const TORN_OVERLAY_SRC = '/Images/MaskOnBook.png';

const TURN_MS = 560;
const CANCEL_MS = 300;
const AUDIO_START_DELAY_MS = 400;
const MAX_BEND_DEG = 14; // outer-segment lag at mid-flight
const MAX_SAG_DEG = 2.4; // page dips toward the table mid-flight
const MAX_LIFT_PX = 30;

type TurnDir = 'forward' | 'backward';
type EngineState =
  | { mode: 'idle' }
  | { mode: 'dragging'; dir: TurnDir; progress: number }
  | { mode: 'animating'; dir: TurnDir; cancelled: boolean };

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

function useFpsMeter(enabled: boolean) {
  const [fps, setFps] = useState(0);
  const [worst, setWorst] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let windowStart = last;
    let worstDelta = 0;
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      frames += 1;
      if (delta > worstDelta) worstDelta = delta;
      if (now - windowStart >= 1000) {
        setFps(Math.round((frames * 1000) / (now - windowStart)));
        setWorst(Math.round(worstDelta));
        frames = 0;
        windowStart = now;
        worstDelta = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
  return { fps, worst };
}

/** Full composite spread (photo frame + content) — used ONLY on static layers. */
function SpreadHalf({
  spread,
  half,
  hidden,
}: {
  spread: SampleSpread | null;
  half: 'left' | 'right';
  hidden?: boolean;
}) {
  if (!spread) return <div className={styles.halfEmpty} aria-hidden />;
  return (
    <div className={`${styles.half} ${half === 'left' ? styles.halfLeft : styles.halfRight}`} aria-hidden={hidden}>
      <div className={styles.spreadInner}>
        <img className={styles.openBookImg} src={OPEN_BOOK_SRC} alt="" draggable={false} />
        <div className={styles.illustrationLayer}>
          <img className={styles.illustrationImg} src={spread.imageUrl} alt="" draggable={false} loading="eager" />
        </div>
        <div className={styles.proseLayer}>
          {spread.text.split('\n').map((line, i) => (
            <p key={i} className={styles.proseLine}>
              {line}
            </p>
          ))}
        </div>
        <img className={styles.tornOverlay} src={TORN_OVERLAY_SRC} alt="" draggable={false} />
      </div>
    </div>
  );
}

/** PAPER-ONLY page content (no photo frame) for the turning sheet faces. */
function PaperPage({ spread, side }: { spread: SampleSpread | null; side: 'illustration' | 'prose' }) {
  if (!spread) return <div className={styles.paperBlank} aria-hidden />;
  if (side === 'illustration') {
    return (
      <div className={styles.paperPage}>
        <img className={styles.paperIllustration} src={spread.imageUrl} alt="" draggable={false} />
      </div>
    );
  }
  return (
    <div className={styles.paperPage}>
      <div className={styles.paperProse}>
        {spread.text.split('\n').map((line, i) => (
          <p key={i} className={styles.proseLine}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/** One bending sheet face-pair slice (front+back) — rendered in segment A and B. */
function SheetSlices({
  front,
  back,
  frontSide,
  backSide,
  seg,
}: {
  front: SampleSpread | null;
  back: SampleSpread | null;
  frontSide: 'illustration' | 'prose';
  backSide: 'illustration' | 'prose';
  seg: 'a' | 'b';
}) {
  return (
    <>
      <div className={`${styles.face} ${styles.faceFront} ${seg === 'a' ? styles.sliceA : styles.sliceB}`}>
        <div className={styles.sliceWindow}>
          <PaperPage spread={front} side={frontSide} />
        </div>
        <span className={styles.sheetShade} aria-hidden />
      </div>
      <div className={`${styles.face} ${styles.faceBack} ${seg === 'a' ? styles.sliceA : styles.sliceB}`}>
        <div className={styles.sliceWindow}>
          <PaperPage spread={back} side={backSide} />
        </div>
        <span className={styles.sheetShade} aria-hidden />
      </div>
    </>
  );
}

export function FlipBook() {
  const [index, setIndex] = useState(0);
  const [engine, setEngine] = useState<EngineState>({ mode: 'idle' });
  const [motionOn, setMotionOn] = useState(true);
  const [audioOn, setAudioOn] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [memNote, setMemNote] = useState('');
  const reducedPref = useReducedMotionPref();
  const isMobile = useIsMobile();
  const physical = motionOn && !reducedPref && !isMobile;
  const slideMode = motionOn && !reducedPref && isMobile;

  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastDirRef = useRef<TurnDir>('forward');
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const indexRef = useRef(index);
  indexRef.current = index;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimerRef = useRef<number | null>(null);
  const flightRef = useRef<number | null>(null);
  const { fps, worst } = useFpsMeter(true);

  const current = SAMPLE_SPREADS[index] ?? null;
  const next = SAMPLE_SPREADS[index + 1] ?? null;
  const prev = SAMPLE_SPREADS[index - 1] ?? null;
  const canForward = index < SAMPLE_SPREADS.length - 1;
  const canBackward = index > 0;

  useEffect(() => {
    [prev, next].forEach((s) => {
      if (!s) return;
      const img = new Image();
      img.src = s.imageUrl;
    });
  }, [prev, next]);

  /* ── Audio demo (mirrors production policy) ── */
  const stopAudio = useCallback(() => {
    if (audioTimerRef.current != null) {
      window.clearTimeout(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, []);

  const startAudioForIndex = useCallback(
    (i: number) => {
      if (!audioOn) return;
      const clip = SAMPLE_SPREADS[i]?.audioUrl;
      if (!clip) return;
      audioTimerRef.current = window.setTimeout(() => {
        const a = audioRef.current;
        if (!a) return;
        a.src = clip;
        void a.play().catch(() => undefined);
      }, AUDIO_START_DELAY_MS);
    },
    [audioOn]
  );

  useEffect(
    () => () => {
      stopAudio();
      if (flightRef.current != null) cancelAnimationFrame(flightRef.current);
    },
    [stopAudio]
  );

  /* ── Per-frame pose: rotation + bend + sag + lift shaped by progress ── */
  const setSheetPose = useCallback((dir: TurnDir, progress: number) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const sign = dir === 'forward' ? 1 : -1;
    const arc = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI); // 0→1→0
    sheet.style.setProperty('--deg', `${(sign * progress * 180).toFixed(2)}deg`);
    // outer segment LAGS behind the spine rotation → opposite sign of --deg
    sheet.style.setProperty('--bend', `${(-sign * arc * MAX_BEND_DEG).toFixed(2)}deg`);
    sheet.style.setProperty('--sag', `${(-arc * MAX_SAG_DEG).toFixed(2)}deg`);
    sheet.style.setProperty('--lift', `${(arc * MAX_LIFT_PX).toFixed(1)}px`);
    sheet.style.setProperty('--turn-progress', arc.toFixed(3));
  }, []);

  const finishTurn = useCallback(
    (dir: TurnDir, cancelled: boolean) => {
      setEngine({ mode: 'idle' });
      if (!cancelled) {
        const nextIndex = indexRef.current + (dir === 'forward' ? 1 : -1);
        setIndex(nextIndex);
        setTurnCount((c) => c + 1);
        startAudioForIndex(nextIndex);
      }
    },
    [startAudioForIndex]
  );

  /** rAF flight from a progress point to 1 (complete) or 0 (cancel). */
  const animateTurn = useCallback(
    (dir: TurnDir, fromProgress: number, cancelled: boolean) => {
      const target = cancelled ? 0 : 1;
      const distance = Math.abs(target - fromProgress);
      const total = Math.max(160, (cancelled ? CANCEL_MS : TURN_MS) * distance);
      setEngine({ mode: 'animating', dir, cancelled });
      if (!cancelled) stopAudio();
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / total);
        const eased = easeInOutCubic(t);
        const progress = fromProgress + (target - fromProgress) * eased;
        setSheetPose(dir, progress);
        if (t < 1) {
          flightRef.current = requestAnimationFrame(step);
        } else {
          flightRef.current = null;
          finishTurn(dir, cancelled);
        }
      };
      flightRef.current = requestAnimationFrame(step);
    },
    [finishTurn, setSheetPose, stopAudio]
  );

  const requestTurn = useCallback(
    (dir: TurnDir) => {
      if (engineRef.current.mode !== 'idle') return; // double-nav guard
      if (dir === 'forward' && !canForward) return;
      if (dir === 'backward' && !canBackward) return;
      lastDirRef.current = dir;
      if (!physical) {
        stopAudio();
        const nextIndex = indexRef.current + (dir === 'forward' ? 1 : -1);
        setIndex(nextIndex);
        setTurnCount((c) => c + 1);
        startAudioForIndex(nextIndex);
        return;
      }
      setEngine({ mode: 'animating', dir, cancelled: false });
      setSheetPose(dir, 0.001);
      requestAnimationFrame(() => animateTurn(dir, 0.001, false));
    },
    [animateTurn, canBackward, canForward, physical, setSheetPose, startAudioForIndex, stopAudio]
  );

  /* ── Drag ── */
  const dragStateRef = useRef<{ dir: TurnDir; startX: number; width: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!physical || engineRef.current.mode !== 'idle') return;
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const EDGE = rect.width * 0.18;
      let dir: TurnDir | null = null;
      if (x <= EDGE && canForward) dir = 'forward';
      else if (x >= rect.width - EDGE && canBackward) dir = 'backward';
      if (!dir) return;
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragStateRef.current = { dir, startX: e.clientX, width: rect.width };
      lastDirRef.current = dir;
      setEngine({ mode: 'dragging', dir, progress: 0 });
      setSheetPose(dir, 0);
    },
    [canBackward, canForward, physical, setSheetPose]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || engineRef.current.mode !== 'dragging') return;
      const travel = e.clientX - drag.startX;
      const raw = drag.dir === 'forward' ? travel / (drag.width * 0.82) : -travel / (drag.width * 0.82);
      const progress = Math.min(1, Math.max(0, raw));
      setEngine({ mode: 'dragging', dir: drag.dir, progress });
      setSheetPose(drag.dir, progress);
    },
    [setSheetPose]
  );

  const onPointerUp = useCallback(() => {
    const drag = dragStateRef.current;
    const st = engineRef.current;
    if (!drag || st.mode !== 'dragging') return;
    dragStateRef.current = null;
    const isTap = st.progress < 0.04; // tap on the edge = full turn
    animateTurn(drag.dir, st.progress, !isTap && st.progress < 0.5);
  }, [animateTurn]);

  /* ── Keyboard (ArrowLeft = forward, per production) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') requestTurn('forward');
      if (e.key === 'ArrowRight') requestTurn('backward');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestTurn]);

  const sampleMemory = useCallback(() => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    setMemNote(
      mem
        ? `heap ≈ ${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB אחרי ${turnCount} דפדופים`
        : 'performance.memory לא זמין בדפדפן זה'
    );
  }, [turnCount]);

  const turnDir: TurnDir | null =
    engine.mode === 'dragging' || engine.mode === 'animating' ? engine.dir : null;

  /* Faces: forward — front = current LEFT page (illustration), back = next RIGHT page (prose).
     backward — front = current RIGHT page (prose), back = prev LEFT page (illustration). */
  const sheetFront = current;
  const sheetBack = turnDir === 'backward' ? prev : next;
  const frontSide: 'illustration' | 'prose' = turnDir === 'backward' ? 'prose' : 'illustration';
  const backSide: 'illustration' | 'prose' = turnDir === 'backward' ? 'illustration' : 'prose';
  const baseLeft = turnDir === 'forward' ? next : current;
  const baseRight = turnDir === 'backward' ? prev : current;

  const pageLabel = `עמוד ${index + 1} מתוך ${SAMPLE_SPREADS.length}`;

  return (
    <div className={styles.root} data-physical={physical ? 'on' : 'off'}>
      <header className={styles.toolbar}>
        <h1 className={styles.title}>{SAMPLE_BOOK_TITLE}</h1>
        <div className={styles.toolbarControls}>
          <button type="button" className={styles.toolBtn} aria-pressed={motionOn} onClick={() => setMotionOn((v) => !v)}>
            דפדוף פיזי: {physical ? 'פעיל' : 'כבוי'}
          </button>
          <button type="button" className={styles.toolBtn} aria-pressed={audioOn} onClick={() => { setAudioOn((v) => !v); stopAudio(); }}>
            קריינות דמו: {audioOn ? 'פעילה' : 'כבויה'}
          </button>
          <button type="button" className={styles.toolBtn} onClick={sampleMemory}>מדידת זיכרון</button>
        </div>
      </header>

      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={styles.book} aria-live="polite" aria-label={pageLabel}>
          {!physical ? (
            <div key={index} className={`${styles.flatSpread} ${slideMode ? styles.flatSlide : ''}`} data-dir={lastDirRef.current}>
              <SpreadHalf spread={current} half="left" />
              <SpreadHalf spread={current} half="right" />
            </div>
          ) : (
            <>
              {/* static base — the photographed frame NEVER moves */}
              <div className={styles.baseLayer}>
                <SpreadHalf spread={baseLeft} half="left" hidden={turnDir === 'forward'} />
                <SpreadHalf spread={baseRight} half="right" hidden={turnDir === 'backward'} />
              </div>

              {turnDir ? (
                <div className={`${styles.castShadow} ${turnDir === 'forward' ? styles.castForward : styles.castBackward}`} />
              ) : null}

              {/* the paper sheet: segment A (spine side) + hinged segment B (outer) */}
              {turnDir ? (
                <div
                  ref={sheetRef}
                  className={`${styles.sheet} ${turnDir === 'forward' ? styles.sheetForward : styles.sheetBackward}`}
                >
                  <div className={styles.segA}>
                    <SheetSlices front={sheetFront} back={sheetBack} frontSide={frontSide} backSide={backSide} seg="a" />
                  </div>
                  <div className={styles.segB}>
                    <SheetSlices front={sheetFront} back={sheetBack} frontSide={frontSide} backSide={backSide} seg="b" />
                    <span className={styles.crease} aria-hidden />
                  </div>
                </div>
              ) : (
                <div className={styles.idleLayer}>
                  <SpreadHalf spread={current} half="left" />
                  <SpreadHalf spread={current} half="right" />
                </div>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          className={`${styles.edgeZone} ${styles.edgeForward}`}
          onClick={() => requestTurn('forward')}
          disabled={!canForward}
          aria-label="לעמוד הבא"
        />
        <button
          type="button"
          className={`${styles.edgeZone} ${styles.edgeBackward}`}
          onClick={() => requestTurn('backward')}
          disabled={!canBackward}
          aria-label="לעמוד הקודם"
        />
      </div>

      <footer className={styles.navBar}>
        <button type="button" className={styles.navBtn} onClick={() => requestTurn('backward')} disabled={!canBackward}>
          → הקודם
        </button>
        <span className={styles.pageIndicator} aria-live="polite">{pageLabel}</span>
        <button type="button" className={`${styles.navBtn} ${styles.navBtnPrimary}`} onClick={() => requestTurn('forward')} disabled={!canForward}>
          הבא ←
        </button>
      </footer>

      <aside className={styles.perfHud} aria-hidden>
        <span>FPS {fps}</span>
        <span>גרוע ביותר {worst}ms</span>
        <span>דפדופים {turnCount}</span>
        {memNote ? <span>{memNote}</span> : null}
      </aside>

      <audio ref={audioRef} preload="none" />
    </div>
  );
}
