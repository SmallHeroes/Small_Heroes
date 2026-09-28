/**
 * Recording controller for the parent's acquaintance recording (profile intake, NOT narration and
 * NOT voice cloning). Framework-agnostic; the browser APIs are injected so every edge case can be
 * exercised without a browser.
 *
 * Guarantees (brief 2026-09-28 §6):
 * - the microphone opens only after an explicit start; a permission granted after a cancel closes
 *   the tracks immediately and never starts a surprise recording;
 * - the Blob is built only after the recorder's final `stop` event (never from a partial chunk);
 * - a double "done" press yields exactly one send request (`takeSendRequest`);
 * - elapsed time comes from the clock, not from ticks or chunk counts;
 * - reaching the time or size ceiling stops the microphone but never sends by itself;
 * - interruption (track ended, page hidden) keeps the partial clip in memory, unsent;
 * - every exit path stops all tracks.
 */
import { LIMITS } from './contract';

/** Preferred container/codec order. The actual `recorder.mimeType` is what gets recorded. */
export const RECORDING_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

/** Base types the intake path accepts. A clip in any other container stays local-only. */
export const ACCEPTED_AUDIO_BASE_TYPES: readonly string[] = ['audio/webm', 'audio/mp4', 'audio/ogg'];

/** Clips shorter than this are treated as empty (an accidental tap), not sent. */
export const MIN_CLIP_MS = 1000;

export function baseMimeType(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase();
}

export type RecorderPhase = 'idle' | 'requesting' | 'recording' | 'stopping' | 'recorded' | 'error';
export type StopReason = 'user_done' | 'user_stop' | 'time_limit' | 'size_limit' | 'interrupted' | 'left_step';
export type RecorderErrorKind =
  | 'insecure_context'
  | 'unsupported'
  | 'permission_denied'
  | 'no_device'
  | 'device_busy'
  | 'empty'
  | 'failed';

export type RecordedClip = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  bytes: number;
  reason: StopReason;
  /** False when the container is not accepted for processing or the clip exceeds the byte ceiling. */
  sendable: boolean;
};

export type RecorderSnapshot = {
  phase: RecorderPhase;
  elapsedMs: number;
  warned: boolean;
  bytes: number;
  error: RecorderErrorKind | null;
  clip: RecordedClip | null;
  sendRequested: boolean;
  /** Set when the last attempt ended because the parent cancelled or left while permission was pending. */
  abandonedPermission: boolean;
};

export type MediaStreamTrackLike = {
  stop(): void;
  addEventListener(type: 'ended', listener: () => void): void;
  removeEventListener(type: 'ended', listener: () => void): void;
};

export type MediaStreamLike = { getTracks(): MediaStreamTrackLike[] };

export type MediaRecorderLike = {
  readonly state: string;
  readonly mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
};

export type RecorderDeps = {
  isSecureContext: boolean;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStreamLike>;
  createRecorder?: (stream: MediaStreamLike, mimeType: string | undefined) => MediaRecorderLike;
  isTypeSupported?: (mime: string) => boolean;
  isHidden: () => boolean;
  now: () => number;
  setInterval: (callback: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  limits?: { maxMs: number; warnMs: number; maxBytes: number };
  timesliceMs?: number;
  /** Receives the live stream (for a measured level meter) and null when it is released. */
  onStream?: (stream: MediaStreamLike | null) => void;
};

const INITIAL: RecorderSnapshot = {
  phase: 'idle',
  elapsedMs: 0,
  warned: false,
  bytes: 0,
  error: null,
  clip: null,
  sendRequested: false,
  abandonedPermission: false,
};

export function pickMimeType(isTypeSupported?: (mime: string) => boolean): string | undefined {
  if (!isTypeSupported) return undefined;
  for (const candidate of RECORDING_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      // A throwing probe is treated as unsupported.
    }
  }
  return undefined;
}

export function mapMediaError(error: unknown): RecorderErrorKind {
  const name =
    typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permission_denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no_device';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'device_busy';
    case 'TypeError':
      return 'unsupported';
    default:
      return 'failed';
  }
}

export class RecordingController {
  private snapshot: RecorderSnapshot = INITIAL;
  private attempt = 0;
  private stream: MediaStreamLike | null = null;
  private recorder: MediaRecorderLike | null = null;
  private requestedMime: string | undefined;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private stoppedAt: number | null = null;
  private stopReason: StopReason = 'user_stop';
  private discardOnStop = false;
  private tick: unknown = null;
  private watchdog: unknown = null;
  private endedListener: (() => void) | null = null;
  private disposed = false;

  constructor(
    private readonly deps: RecorderDeps,
    private readonly onChange: (snapshot: RecorderSnapshot) => void,
  ) {}

  private get limits() {
    return this.deps.limits ?? {
      maxMs: LIMITS.recordingMaxMs,
      warnMs: LIMITS.recordingWarnMs,
      maxBytes: LIMITS.recordingMaxBytes,
    };
  }

  getSnapshot(): RecorderSnapshot {
    return this.snapshot;
  }

  private set(patch: Partial<RecorderSnapshot>): void {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.onChange(this.snapshot);
  }

  private fail(error: RecorderErrorKind): void {
    this.set({ ...INITIAL, phase: 'error', error });
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    const { phase } = this.snapshot;
    if (phase === 'requesting' || phase === 'recording' || phase === 'stopping') return;
    const { deps } = this;
    if (!deps.isSecureContext) return this.fail('insecure_context');
    if (!deps.getUserMedia || !deps.createRecorder) return this.fail('unsupported');

    const attempt = ++this.attempt;
    // A new recording replaces the previous local clip.
    this.set({ ...INITIAL, phase: 'requesting' });
    let stream: MediaStreamLike;
    try {
      stream = await deps.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      if (attempt !== this.attempt || this.disposed) return;
      return this.fail(mapMediaError(error));
    }
    if (attempt !== this.attempt || this.disposed || this.snapshot.phase !== 'requesting') {
      stopTracks(stream);
      return;
    }
    if (deps.isHidden()) {
      // Permission resolved while the page was hidden: do not record in the background.
      stopTracks(stream);
      this.set({ ...INITIAL, abandonedPermission: true });
      return;
    }

    this.requestedMime = pickMimeType(deps.isTypeSupported);
    let recorder: MediaRecorderLike;
    try {
      recorder = deps.createRecorder(stream, this.requestedMime);
    } catch {
      stopTracks(stream);
      return this.fail('unsupported');
    }
    this.stream = stream;
    this.recorder = recorder;
    this.chunks = [];
    this.discardOnStop = false;
    this.stoppedAt = null;
    recorder.ondataavailable = (event) => this.onData(attempt, event.data);
    recorder.onstop = () => this.onRecorderStop(attempt);
    recorder.onerror = () => this.onRecorderError(attempt);
    const onEnded = () => {
      if (attempt === this.attempt) this.stop('interrupted');
    };
    this.endedListener = onEnded;
    for (const track of stream.getTracks()) track.addEventListener('ended', onEnded);
    try {
      recorder.start(deps.timesliceMs ?? 1000);
    } catch {
      this.releaseStream();
      return this.fail('failed');
    }
    this.startedAt = deps.now();
    deps.onStream?.(stream);
    this.set({ phase: 'recording', elapsedMs: 0 });
    this.tick = deps.setInterval(() => this.onTick(attempt), 250);
  }

  /** "Done, organize the details": stops (if needed) and requests exactly one submission. */
  finish(): void {
    const { phase, clip } = this.snapshot;
    if (phase === 'recording') {
      this.set({ sendRequested: true });
      this.stop('user_done');
    } else if (phase === 'stopping') {
      this.set({ sendRequested: true });
    } else if (phase === 'recorded' && clip) {
      this.set({ sendRequested: true });
    }
  }

  /** The parent moved on instead of waiting: a pending "done" no longer submits anything. */
  withdrawSendRequest(): void {
    if (this.snapshot.sendRequested) this.set({ sendRequested: false });
  }

  /** Hands out the clip once per request; later calls return null until the next `finish`. */
  takeSendRequest(): RecordedClip | null {
    const { phase, clip, sendRequested } = this.snapshot;
    if (!sendRequested || phase !== 'recorded' || !clip) return null;
    this.set({ sendRequested: false });
    return clip;
  }

  stop(reason: StopReason): void {
    if (this.snapshot.phase === 'requesting') {
      this.cancel();
      return;
    }
    if (this.snapshot.phase !== 'recording') return;
    const attempt = this.attempt;
    this.clearTick();
    this.stopReason = reason;
    this.stoppedAt = this.deps.now();
    this.set({
      phase: 'stopping',
      elapsedMs: Math.min(this.limits.maxMs, Math.max(0, this.stoppedAt - this.startedAt)),
    });
    try {
      this.recorder?.stop();
    } catch {
      this.onRecorderStop(attempt);
      return;
    }
    // If the final `stop` event never arrives, finish with what was captured and free the microphone.
    this.watchdog = this.deps.setTimeout(() => {
      if (attempt === this.attempt && this.snapshot.phase === 'stopping') this.onRecorderStop(attempt);
    }, 4000);
  }

  /** Page hidden, screen locked, call, device removed: stop and keep the partial clip unsent. */
  interrupt(): void {
    if (this.snapshot.phase === 'recording') this.stop('interrupted');
    else if (this.snapshot.phase === 'requesting') this.cancel(true);
  }

  /** Discards everything: pending permission, live recording and the local clip. Never sends. */
  cancel(abandonedPermission = false): void {
    const wasRequesting = this.snapshot.phase === 'requesting';
    this.teardown();
    this.set({ ...INITIAL, abandonedPermission: abandonedPermission || wasRequesting });
  }

  discardClip(): void {
    if (this.snapshot.phase === 'recorded' || this.snapshot.phase === 'error') this.set({ ...INITIAL });
  }

  dispose(): void {
    this.teardown();
    this.disposed = true;
  }

  private teardown(): void {
    this.attempt += 1;
    this.clearTick();
    this.clearWatchdog();
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.discardOnStop = true;
      try {
        this.recorder.stop();
      } catch {
        // The stream is released below either way.
      }
    }
    this.releaseStream();
    this.chunks = [];
  }

  private onTick(attempt: number): void {
    if (attempt !== this.attempt || this.snapshot.phase !== 'recording') return;
    const elapsedMs = Math.max(0, this.deps.now() - this.startedAt);
    if (elapsedMs >= this.limits.maxMs) {
      this.stop('time_limit');
      return;
    }
    this.set({ elapsedMs, warned: this.snapshot.warned || elapsedMs >= this.limits.warnMs });
  }

  private onData(attempt: number, data: Blob): void {
    if (attempt !== this.attempt || this.discardOnStop || !data || data.size === 0) return;
    this.chunks.push(data);
    const bytes = this.snapshot.bytes + data.size;
    this.set({ bytes });
    // Stop with headroom so the chunk flushed by `stop()` still fits under the ceiling.
    if (this.snapshot.phase === 'recording' && bytes >= this.limits.maxBytes * 0.9) this.stop('size_limit');
  }

  private onRecorderError(attempt: number): void {
    if (attempt !== this.attempt) return;
    this.teardown();
    this.fail('failed');
  }

  private onRecorderStop(attempt: number): void {
    if (attempt !== this.attempt) return;
    this.clearWatchdog();
    this.clearTick();
    if (this.snapshot.phase === 'recording') {
      // The browser stopped the recorder itself (device lost, track ended): keep the partial clip.
      this.stopReason = 'interrupted';
      this.stoppedAt = this.deps.now();
    }
    const mimeType = (this.recorder?.mimeType || this.requestedMime || '').trim();
    const phase = this.snapshot.phase;
    this.releaseStream();
    if (this.discardOnStop || (phase !== 'stopping' && phase !== 'recording')) {
      this.chunks = [];
      return;
    }
    const blob = new Blob(this.chunks, mimeType ? { type: mimeType } : undefined);
    this.chunks = [];
    const durationMs = Math.min(
      this.limits.maxMs,
      Math.max(0, (this.stoppedAt ?? this.deps.now()) - this.startedAt),
    );
    if (blob.size === 0 || durationMs < MIN_CLIP_MS) {
      this.set({ ...INITIAL, phase: 'error', error: 'empty' });
      return;
    }
    const sendable =
      ACCEPTED_AUDIO_BASE_TYPES.includes(baseMimeType(mimeType)) && blob.size <= this.limits.maxBytes;
    this.set({
      phase: 'recorded',
      elapsedMs: durationMs,
      bytes: blob.size,
      clip: { blob, mimeType, durationMs, bytes: blob.size, reason: this.stopReason, sendable },
    });
  }

  private releaseStream(): void {
    const stream = this.stream;
    if (stream) {
      if (this.endedListener) {
        for (const track of stream.getTracks()) track.removeEventListener('ended', this.endedListener);
      }
      stopTracks(stream);
      this.deps.onStream?.(null);
    }
    this.stream = null;
    this.recorder = null;
    this.endedListener = null;
  }

  private clearTick(): void {
    if (this.tick !== null) this.deps.clearInterval(this.tick);
    this.tick = null;
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) this.deps.clearTimeout(this.watchdog);
    this.watchdog = null;
  }
}

function stopTracks(stream: MediaStreamLike): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Already stopped.
    }
  }
}
