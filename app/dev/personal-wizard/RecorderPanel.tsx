'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

import { COMMON, RECORDER, formatDuration } from '@/lib/personal-wizard/copy';
import { LIMITS } from '@/lib/personal-wizard/contract';
import type { MediaStreamLike, RecorderSnapshot, RecordingController } from '@/lib/personal-wizard/recorder';

import { CueTags } from './CueTags';
import { useLevelMeter, useObjectUrl } from './hooks';
import styles from './personal-wizard.module.css';

/**
 * stage = the start and recording screens as one composition: the microphone under an arc of the
 * five things worth telling. Pressing it does not leave the screen; the same stage starts listening,
 * and its halos follow the measured input level (never a decorative fake). card = a compact "add by
 * voice" under the details card.
 */
export type RecorderView = 'stage' | 'card';

type Props = {
  view: RecorderView;
  snapshot: RecorderSnapshot;
  stream: MediaStreamLike | null;
  controller: () => RecordingController | null;
  playback: { playingId: string | null; play: (id: string, url: string) => void; stop: () => void };
  /** Live processing connected (P2). In P1 the recording never leaves the device. */
  liveIntake: boolean;
  voiceCta: string;
  cuesTitle: string;
  cues: readonly string[];
  recordMoreLabel: string;
  /** The current clip was already sent once; sending again needs a new recording. */
  clipSent: boolean;
  onSend: () => void;
};

const RETRYABLE = new Set(['permission_denied', 'no_device', 'device_busy', 'empty', 'failed']);

export function RecorderPanel({
  view,
  snapshot,
  stream,
  controller,
  playback,
  liveIntake,
  voiceCta,
  cuesTitle,
  cues,
  recordMoreLabel,
  clipSent,
  onSend,
}: Props) {
  const level = useLevelMeter(stream);
  const clipUrl = useObjectUrl(snapshot.clip?.blob ?? null);
  const { phase, clip, error } = snapshot;
  const finishRef = useRef<HTMLButtonElement | null>(null);

  // Pressing the microphone replaces it with the live orb. Keyboard focus would fall to the page;
  // it moves to "finish" instead, unless the parent has already put it somewhere.
  useEffect(() => {
    if (view !== 'stage' || phase !== 'recording') return;
    const active = document.activeElement;
    if (!active || active === document.body) finishRef.current?.focus({ preventScroll: true });
  }, [view, phase]);

  const start = () => {
    playback.stop();
    void controller()?.start();
  };

  let status = '';
  if (phase === 'requesting') status = RECORDER.requesting;
  else if (phase === 'recording') status = snapshot.warned ? `${RECORDER.recording}. ${RECORDER.warn}` : RECORDER.recording;
  else if (phase === 'stopping') status = RECORDER.stopping;
  else if (phase === 'recorded' && clip) {
    const reason = RECORDER.stopReason[clip.reason];
    const base = !liveIntake
      ? RECORDER.recordedLocal(formatDuration(clip.durationMs))
      : clipSent
        ? RECORDER.sent
        : RECORDER.recordedReady(formatDuration(clip.durationMs));
    status = reason ? `${reason} ${base}` : base;
  } else if (phase === 'error' && error) status = RECORDER.errors[error];
  else if (phase === 'idle' && snapshot.abandonedPermission) status = RECORDER.cancelledPermission;

  const isLive = phase === 'requesting' || phase === 'recording' || phase === 'stopping';
  // Under the card a sent clip needs no status: what came of it is the card itself.
  const shown = view === 'card' && phase === 'recorded' && clipSent ? '' : status;
  const liveText = phase === 'recording' ? (snapshot.warned ? RECORDER.warn : RECORDER.recording) : shown;
  // Always mounted so state changes are announced; visually hidden while the stage already shows the
  // same state, and when empty. The timer is not a live region.
  const statusRegion = (
    <p className={isLive || !liveText ? 'sr-only' : styles.voiceStatus} role="status" aria-live="polite">
      {liveText}
    </p>
  );

  const clipControls =
    phase === 'recorded' && clip ? (
      <>
        {liveIntake && !clip.sendable ? <p className={styles.hint}>{RECORDER.notSendable}</p> : null}
        <div className={styles.actionsRow}>
          {liveIntake && clip.sendable && !clipSent ? (
            <button type="button" className={styles.btnPrimarySmall} onClick={onSend}>
              {RECORDER.send}
            </button>
          ) : null}
          {clipUrl ? (
            <button
              type="button"
              className={styles.btnSecondary}
              aria-pressed={playback.playingId === 'clip'}
              onClick={() => (playback.playingId === 'clip' ? playback.stop() : playback.play('clip', clipUrl))}
            >
              {playback.playingId === 'clip' ? RECORDER.stopListen : RECORDER.listen}
            </button>
          ) : null}
          <button type="button" className={styles.btnSecondary} onClick={start}>
            {view === 'card' ? recordMoreLabel : RECORDER.newRecording}
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              playback.stop();
              controller()?.discardClip();
            }}
          >
            {RECORDER.deleteRecording}
          </button>
        </div>
        {/* Only the card holds details a parent could think the deletion removes. */}
        {view === 'card' ? <p className={styles.hint}>{RECORDER.deleteNote}</p> : null}
      </>
    ) : null;

  if (view === 'card') {
    return (
      <div className={styles.cardRecorder}>
        {statusRegion}
        {clipControls ?? (
          <button type="button" className={styles.btnSecondary} onClick={start}>
            <MicIcon small />
            {recordMoreLabel}
          </button>
        )}
      </div>
    );
  }

  const canStart = phase === 'idle' || (phase === 'error' && error !== null && RETRYABLE.has(error));
  const listening = phase === 'recording';
  // The measured level, 0..1, drives the halos while listening. No stream, no movement.
  const stageStyle = listening && level !== null ? ({ '--level': level.toFixed(3) } as CSSProperties) : undefined;

  return (
    <div className={styles.stage} data-phase={phase} style={stageStyle}>
      <div className={styles.orbit}>
        <span className={styles.arc} aria-hidden="true" />
        <span className={styles.halo} data-halo="1" aria-hidden="true" />
        <span className={styles.halo} data-halo="2" aria-hidden="true" />
        <CueTags cues={cues} label={cuesTitle} layout="arc" />
        {canStart ? (
          <button type="button" className={styles.recordButton} onClick={start}>
            <span className={styles.recordCircle} aria-hidden="true">
              <MicIcon />
              <Spark />
            </span>
            <span className={styles.recordLabel}>{phase === 'error' ? RECORDER.retry : voiceCta}</span>
          </button>
        ) : (
          <div className={styles.orbLive}>
            <span className={styles.recordCircle} data-state={phase === 'recorded' ? 'done' : 'live'} aria-hidden="true">
              {phase === 'recorded' ? <CheckIcon /> : <MicIcon />}
              <Spark />
            </span>
            {phase === 'recording' || phase === 'stopping' ? (
              <span className={styles.clock} role="timer" aria-label={RECORDER.timer(snapshot.elapsedMs, LIMITS.recordingMaxMs)}>
                <span className={styles.recDot} data-live={listening || undefined} aria-hidden="true" />
                <span className={styles.clockNow}>{formatDuration(snapshot.elapsedMs)}</span>
                <span className={styles.clockMax}>{RECORDER.timerMax(LIMITS.recordingMaxMs)}</span>
              </span>
            ) : phase === 'requesting' ? (
              <span className={styles.orbNote}>{RECORDER.requesting}</span>
            ) : null}
          </div>
        )}
      </div>
      {statusRegion}
      {listening && snapshot.warned ? <p className={styles.warn}>{RECORDER.warn}</p> : null}
      {phase === 'requesting' || listening ? (
        <div className={styles.recordingActions}>
          {listening ? (
            <button
              ref={finishRef}
              type="button"
              className={styles.btnPrimary}
              onClick={() => (liveIntake ? controller()?.finish() : controller()?.stop('user_stop'))}
            >
              {liveIntake ? RECORDER.finishLive : RECORDER.finishLocal}
            </button>
          ) : null}
          <button type="button" className={styles.linkButton} onClick={() => controller()?.cancel()}>
            {COMMON.cancel}
          </button>
        </div>
      ) : null}
      {clipControls}
    </div>
  );
}

function MicIcon({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? styles.micIconSmall : styles.micIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className={styles.micIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The one yellow accent on the screen: a small spark on the microphone. */
function Spark() {
  return (
    <svg className={styles.spark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5Z" fill="currentColor" />
    </svg>
  );
}
