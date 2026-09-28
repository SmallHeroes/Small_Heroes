'use client';

import { COMMON, RECORDER, formatDuration } from '@/lib/personal-wizard/copy';
import { LIMITS } from '@/lib/personal-wizard/contract';
import type { MediaStreamLike, RecorderSnapshot, RecordingController } from '@/lib/personal-wizard/recorder';

import { useLevelMeter, useObjectUrl } from './hooks';
import styles from './personal-wizard.module.css';

type Props = {
  snapshot: RecorderSnapshot;
  stream: MediaStreamLike | null;
  controller: () => RecordingController | null;
  playback: { playingId: string | null; play: (id: string, url: string) => void; stop: () => void };
  /** Live processing connected (P2). In P1 the recording never leaves the device. */
  liveIntake: boolean;
  voiceCta: string;
  voiceNote: string;
  transcriptProcessing: boolean;
  onCancelProcessing: () => void;
  onSend: () => void;
};

const RETRYABLE = new Set(['permission_denied', 'no_device', 'device_busy', 'empty', 'failed']);

export function RecorderPanel({
  snapshot,
  stream,
  controller,
  playback,
  liveIntake,
  voiceCta,
  voiceNote,
  transcriptProcessing,
  onCancelProcessing,
  onSend,
}: Props) {
  const level = useLevelMeter(stream);
  const clipUrl = useObjectUrl(snapshot.clip?.blob ?? null);
  const { phase, clip, error } = snapshot;

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
    const base = liveIntake
      ? RECORDER.recordedReady(formatDuration(clip.durationMs))
      : RECORDER.recordedLocal(formatDuration(clip.durationMs));
    status = reason ? `${reason} ${base}` : base;
  } else if (phase === 'error' && error) status = RECORDER.errors[error];
  else if (phase === 'idle' && snapshot.abandonedPermission) status = RECORDER.cancelledPermission;
  if (transcriptProcessing) status = RECORDER.processing;

  const isLive = phase === 'requesting' || phase === 'recording' || phase === 'stopping';
  const liveText = phase === 'recording' ? (snapshot.warned ? RECORDER.warn : RECORDER.recording) : status;

  return (
    <div className={styles.voiceCard} data-phase={phase}>
      {phase === 'idle' || phase === 'error' ? (
        <>
          {phase === 'idle' || (error && RETRYABLE.has(error)) ? (
            <button type="button" className={styles.micButton} onClick={start}>
              <MicIcon />
              <span>{phase === 'error' ? RECORDER.retry : voiceCta}</span>
            </button>
          ) : null}
          <p className={styles.voiceNote}>{voiceNote}</p>
        </>
      ) : null}

      {isLive ? (
        <div className={styles.recRow}>
          <span className={styles.recState}>
            <span className={styles.recDot} data-live={phase === 'recording' || undefined} aria-hidden="true" />
            <span>{phase === 'recording' ? RECORDER.recording : status}</span>
          </span>
          {phase === 'recording' || phase === 'stopping' ? (
            <span className={styles.timer} role="timer" aria-label={RECORDER.timer(snapshot.elapsedMs, LIMITS.recordingMaxMs)}>
              {RECORDER.timer(snapshot.elapsedMs, LIMITS.recordingMaxMs)}
            </span>
          ) : null}
          {phase === 'recording' && level !== null ? (
            <span className={styles.level} title={RECORDER.level}>
              <span className="sr-only">{RECORDER.level}</span>
              <span className={styles.levelFill} style={{ inlineSize: `${Math.round(level * 100)}%` }} aria-hidden="true" />
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Always mounted so state changes are announced; visually hidden while the recording row
          already shows the same state, and when empty. The timer is not a live region. */}
      <p className={isLive || !liveText ? 'sr-only' : styles.voiceStatus} role="status" aria-live="polite">
        {liveText}
      </p>

      {phase === 'recording' && snapshot.warned ? <p className={styles.warn}>{RECORDER.warn}</p> : null}

      {phase === 'requesting' || phase === 'recording' ? (
        <div className={styles.actionsRow}>
          {phase === 'recording' ? (
            <button
              type="button"
              className={styles.btnPrimarySmall}
              onClick={() => (liveIntake ? controller()?.finish() : controller()?.stop('user_stop'))}
            >
              {liveIntake ? RECORDER.finishLive : RECORDER.finishLocal}
            </button>
          ) : null}
          <button type="button" className={styles.btnSecondary} onClick={() => controller()?.cancel()}>
            {COMMON.cancel}
          </button>
        </div>
      ) : null}

      {phase === 'recorded' && clip ? (
        <>
          {liveIntake && !clip.sendable ? <p className={styles.hint}>{RECORDER.notSendable}</p> : null}
          <div className={styles.actionsRow}>
            {liveIntake && clip.sendable && !transcriptProcessing ? (
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
              {RECORDER.newRecording}
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
          <p className={styles.hint}>{RECORDER.deleteNote}</p>
        </>
      ) : null}

      {transcriptProcessing ? (
        <div className={styles.actionsRow}>
          <button type="button" className={styles.btnSecondary} onClick={onCancelProcessing}>
            {COMMON.cancel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MicIcon() {
  return (
    <svg className={styles.micIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
        fill="currentColor"
      />
    </svg>
  );
}
