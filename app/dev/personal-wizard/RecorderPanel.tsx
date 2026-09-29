'use client';

import { COMMON, RECORDER, formatDuration } from '@/lib/personal-wizard/copy';
import { LIMITS } from '@/lib/personal-wizard/contract';
import type { MediaStreamLike, RecorderSnapshot, RecordingController } from '@/lib/personal-wizard/recorder';

import { useLevelMeter, useObjectUrl } from './hooks';
import styles from './personal-wizard.module.css';

/**
 * start = the one big button (and a finished clip's controls); recording = the focused recording
 * screen with the must-have cues; card = a compact "add by voice" under the details card.
 */
export type RecorderView = 'start' | 'recording' | 'card';

type Props = {
  view: RecorderView;
  snapshot: RecorderSnapshot;
  stream: MediaStreamLike | null;
  controller: () => RecordingController | null;
  playback: { playingId: string | null; play: (id: string, url: string) => void; stop: () => void };
  /** Live processing connected (P2). In P1 the recording never leaves the device. */
  liveIntake: boolean;
  voiceCta: string;
  /** Shown when nothing is decoded (live processing off). */
  banner: string | null;
  /** A suggested length, not a required minimum. */
  hint: string;
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
  banner,
  hint,
  cuesTitle,
  cues,
  recordMoreLabel,
  clipSent,
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
  // Always mounted so state changes are announced; visually hidden while the recording screen
  // already shows the same state, and when empty. The timer is not a live region.
  const statusRegion = (
    <p className={isLive || !liveText ? 'sr-only' : styles.voiceStatus} role="status" aria-live="polite">
      {liveText}
    </p>
  );

  if (view === 'recording') {
    return (
      <div className={styles.recordingPanel} data-phase={phase}>
        <span className={styles.recordPulse} data-live={phase === 'recording' || undefined} aria-hidden="true">
          <MicIcon />
        </span>
        <p className={styles.recState}>{phase === 'recording' ? RECORDER.recording : status}</p>
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
        {statusRegion}
        {phase === 'recording' && snapshot.warned ? <p className={styles.warn}>{RECORDER.warn}</p> : null}
        <div className={styles.cues}>
          <p className={styles.cuesTitle}>{cuesTitle}</p>
          <ul className={styles.cueList}>
            {cues.map((cue) => (
              <li key={cue} className={styles.cue}>
                {cue}
              </li>
            ))}
          </ul>
        </div>
        {phase === 'requesting' || phase === 'recording' ? (
          <div className={styles.recordingActions}>
            {phase === 'recording' ? (
              <button
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
      </div>
    );
  }

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
        <p className={styles.hint}>{RECORDER.deleteNote}</p>
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

  return (
    <div className={styles.startRecorder} data-phase={phase}>
      {banner ? <p className={styles.localBanner}>{banner}</p> : null}
      {phase === 'idle' || (phase === 'error' && error && RETRYABLE.has(error)) ? (
        <button type="button" className={styles.recordButton} onClick={start}>
          <span className={styles.recordCircle} aria-hidden="true">
            <MicIcon />
          </span>
          <span className={styles.recordLabel}>{phase === 'error' ? RECORDER.retry : voiceCta}</span>
        </button>
      ) : null}
      {statusRegion}
      {phase === 'idle' ? <p className={styles.hint}>{hint}</p> : null}
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
