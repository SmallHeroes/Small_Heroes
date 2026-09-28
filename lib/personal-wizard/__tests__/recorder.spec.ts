import { describe, expect, it } from 'vitest';

import {
  RecordingController,
  mapMediaError,
  pickMimeType,
  type MediaRecorderLike,
  type MediaStreamLike,
  type MediaStreamTrackLike,
  type RecorderDeps,
  type RecorderSnapshot,
} from '../recorder';

class FakeTrack implements MediaStreamTrackLike {
  stopped = 0;
  private listeners = new Set<() => void>();
  stop() {
    this.stopped += 1;
  }
  addEventListener(_type: 'ended', listener: () => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'ended', listener: () => void) {
    this.listeners.delete(listener);
  }
  end() {
    for (const listener of [...this.listeners]) listener();
  }
}

class FakeStream implements MediaStreamLike {
  readonly track = new FakeTrack();
  getTracks() {
    return [this.track];
  }
}

class FakeRecorder implements MediaRecorderLike {
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  started = 0;
  stopCalls = 0;
  /** When false, stop() never delivers the final events (to exercise the watchdog). */
  deliverOnStop = true;
  constructor(
    readonly mimeType: string,
    private readonly tail: Blob | null = new Blob(['tail'], { type: 'audio/webm' }),
  ) {}
  start() {
    this.state = 'recording';
    this.started += 1;
  }
  stop() {
    if (this.state === 'inactive') throw Object.assign(new Error('inactive'), { name: 'InvalidStateError' });
    this.stopCalls += 1;
    this.state = 'inactive';
    if (!this.deliverOnStop) return;
    // Real recorders flush the last chunk, then fire `stop`, asynchronously.
    queueMicrotask(() => {
      if (this.tail) this.ondataavailable?.({ data: this.tail });
      this.onstop?.();
    });
  }
  emit(bytes: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)], { type: this.mimeType }) });
  }
  /** Browser-initiated stop (device lost): flush + stop without our stop() call. */
  browserStop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['end'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

type Harness = {
  controller: RecordingController;
  snapshots: RecorderSnapshot[];
  last: () => RecorderSnapshot;
  clock: { now: number };
  tick: () => void;
  fireTimeouts: () => void;
  resolvePermission: (stream?: FakeStream) => FakeStream;
  rejectPermission: (error: unknown) => void;
  recorders: FakeRecorder[];
  requestedMimes: Array<string | undefined>;
  hidden: { value: boolean };
};

function harness(overrides: Partial<RecorderDeps> & { recorderMime?: string; tail?: Blob | null } = {}): Harness {
  const clock = { now: 1_000 };
  const intervals = new Map<number, () => void>();
  const timeouts = new Map<number, () => void>();
  let handles = 0;
  let resolvePermission: (stream: FakeStream) => void = () => undefined;
  let rejectPermission: (error: unknown) => void = () => undefined;
  const recorders: FakeRecorder[] = [];
  const requestedMimes: Array<string | undefined> = [];
  const hidden = { value: false };
  const snapshots: RecorderSnapshot[] = [];
  const deps: RecorderDeps = {
    isSecureContext: true,
    getUserMedia: () =>
      new Promise<MediaStreamLike>((resolve, reject) => {
        resolvePermission = resolve;
        rejectPermission = reject;
      }),
    createRecorder: (_stream, mimeType) => {
      requestedMimes.push(mimeType);
      const recorder = new FakeRecorder(overrides.recorderMime ?? mimeType ?? 'audio/webm', overrides.tail);
      recorders.push(recorder);
      return recorder;
    },
    isTypeSupported: (mime) => mime.startsWith('audio/webm'),
    isHidden: () => hidden.value,
    now: () => clock.now,
    setInterval: (callback) => {
      handles += 1;
      intervals.set(handles, callback);
      return handles;
    },
    clearInterval: (handle) => intervals.delete(handle as number),
    setTimeout: (callback) => {
      handles += 1;
      timeouts.set(handles, callback);
      return handles;
    },
    clearTimeout: (handle) => timeouts.delete(handle as number),
    limits: { maxMs: 90_000, warnMs: 75_000, maxBytes: 3 * 1024 * 1024 },
    ...overrides,
  };
  const controller = new RecordingController(deps, (snapshot) => snapshots.push(snapshot));
  return {
    controller,
    snapshots,
    last: () => controller.getSnapshot(),
    clock,
    tick: () => {
      for (const callback of [...intervals.values()]) callback();
    },
    fireTimeouts: () => {
      for (const [handle, callback] of [...timeouts.entries()]) {
        timeouts.delete(handle);
        callback();
      }
    },
    resolvePermission: (stream = new FakeStream()) => {
      resolvePermission(stream);
      return stream;
    },
    rejectPermission: (error) => rejectPermission(error),
    recorders,
    requestedMimes,
    hidden,
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function startRecording(h: Harness): Promise<FakeStream> {
  const started = h.controller.start();
  const stream = h.resolvePermission();
  await started;
  return stream;
}

describe('RecordingController: permission and capability', () => {
  it('reports an insecure context and missing APIs as fallbacks, without touching the microphone', async () => {
    const insecure = harness({ isSecureContext: false });
    await insecure.controller.start();
    expect(insecure.last()).toMatchObject({ phase: 'error', error: 'insecure_context' });

    const unsupported = harness({ getUserMedia: undefined });
    await unsupported.controller.start();
    expect(unsupported.last()).toMatchObject({ phase: 'error', error: 'unsupported' });
  });

  it('maps permission and device failures to specific, recoverable states', async () => {
    for (const [name, expected] of [
      ['NotAllowedError', 'permission_denied'],
      ['NotFoundError', 'no_device'],
      ['NotReadableError', 'device_busy'],
      ['WeirdError', 'failed'],
    ] as const) {
      const h = harness();
      const started = h.controller.start();
      h.rejectPermission(Object.assign(new Error(name), { name }));
      await started;
      expect(h.last()).toMatchObject({ phase: 'error', error: expected });
      expect(h.recorders).toHaveLength(0);
    }
    expect(mapMediaError({ name: 'SecurityError' })).toBe('permission_denied');
    expect(mapMediaError('nonsense')).toBe('failed');
  });

  it('closes the tracks and never records when permission arrives after a cancel', async () => {
    const h = harness();
    const started = h.controller.start();
    expect(h.last().phase).toBe('requesting');
    h.controller.cancel();
    const stream = h.resolvePermission();
    await started;
    expect(stream.track.stopped).toBe(1);
    expect(h.recorders).toHaveLength(0);
    expect(h.last()).toMatchObject({ phase: 'idle', abandonedPermission: true });
  });

  it('does not start recording when permission resolves while the page is hidden', async () => {
    const h = harness();
    const started = h.controller.start();
    h.hidden.value = true;
    const stream = h.resolvePermission();
    await started;
    expect(stream.track.stopped).toBe(1);
    expect(h.recorders).toHaveLength(0);
    expect(h.last().phase).toBe('idle');
  });

  it('chooses the first supported container and records the actual recorder type', async () => {
    expect(pickMimeType((mime) => mime === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => false)).toBeUndefined();
    expect(pickMimeType(undefined)).toBeUndefined();
    const h = harness({ isTypeSupported: () => false, recorderMime: 'audio/ogg;codecs=opus' });
    await startRecording(h);
    expect(h.requestedMimes).toEqual([undefined]);
    h.clock.now += 2_000;
    h.controller.stop('user_stop');
    await flush();
    expect(h.last().clip?.mimeType).toBe('audio/ogg;codecs=opus');
  });
});

describe('RecordingController: stopping, sending and limits', () => {
  it('builds the clip only after the final stop event, including the last chunk', async () => {
    const h = harness();
    const stream = await startRecording(h);
    h.recorders[0].emit(100);
    h.clock.now += 5_000;
    h.controller.stop('user_stop');
    expect(h.last().phase).toBe('stopping');
    expect(h.last().clip).toBeNull();
    await flush();
    const clip = h.last().clip;
    expect(h.last().phase).toBe('recorded');
    expect(clip?.bytes).toBe(100 + 4); // chunk + flushed tail
    expect(clip?.durationMs).toBe(5_000);
    expect(clip?.sendable).toBe(true);
    expect(stream.track.stopped).toBe(1);
  });

  it('turns a double "done" into exactly one send request', async () => {
    const h = harness();
    await startRecording(h);
    h.recorders[0].emit(10);
    h.clock.now += 3_000;
    h.controller.finish();
    h.controller.finish();
    await flush();
    h.controller.finish();
    expect(h.recorders[0].stopCalls).toBe(1);
    expect(h.controller.takeSendRequest()).not.toBeNull();
    expect(h.controller.takeSendRequest()).toBeNull();
  });

  it('withdraws a pending send when the parent moves on', async () => {
    const h = harness();
    await startRecording(h);
    h.clock.now += 3_000;
    h.controller.finish();
    h.controller.withdrawSendRequest();
    await flush();
    expect(h.last().phase).toBe('recorded');
    expect(h.controller.takeSendRequest()).toBeNull();
  });

  it('measures elapsed time from the clock, warns once, and stops at the ceiling without sending', async () => {
    const h = harness();
    await startRecording(h);
    h.clock.now += 10_000;
    h.tick();
    expect(h.last().elapsedMs).toBe(10_000);
    h.clock.now += 66_000;
    h.tick();
    expect(h.last().warned).toBe(true);
    h.clock.now += 20_000;
    h.tick();
    await flush();
    expect(h.last()).toMatchObject({ phase: 'recorded', sendRequested: false });
    expect(h.last().clip?.reason).toBe('time_limit');
    expect(h.last().clip?.durationMs).toBe(90_000);
    expect(h.controller.takeSendRequest()).toBeNull();
  });

  it('stops at the byte ceiling with headroom and keeps the clip unsent', async () => {
    const h = harness({ limits: { maxMs: 90_000, warnMs: 75_000, maxBytes: 1_000 } });
    await startRecording(h);
    h.clock.now += 2_000;
    h.recorders[0].emit(950);
    await flush();
    expect(h.last().clip?.reason).toBe('size_limit');
    expect(h.last().clip?.sendable).toBe(true);
    expect(h.last().sendRequested).toBe(false);
  });

  it('marks an over-ceiling or unsupported-container clip as not sendable', async () => {
    const big = harness({ limits: { maxMs: 90_000, warnMs: 75_000, maxBytes: 1_000 }, tail: new Blob([new Uint8Array(600)]) });
    await startRecording(big);
    big.clock.now += 2_000;
    big.recorders[0].emit(800);
    expect(big.last().phase).toBe('recording');
    big.controller.stop('user_stop');
    await flush();
    expect(big.last().clip?.bytes).toBe(1_400);
    expect(big.last().clip?.sendable).toBe(false);

    const wav = harness({ recorderMime: 'audio/wav' });
    await startRecording(wav);
    wav.clock.now += 2_000;
    wav.controller.stop('user_stop');
    await flush();
    expect(wav.last().clip?.sendable).toBe(false);
  });

  it('treats an empty or sub-second recording as empty', async () => {
    const empty = harness({ tail: null });
    await startRecording(empty);
    empty.clock.now += 5_000;
    empty.controller.stop('user_stop');
    await flush();
    expect(empty.last()).toMatchObject({ phase: 'error', error: 'empty' });

    const tap = harness();
    await startRecording(tap);
    tap.clock.now += 400;
    tap.controller.stop('user_stop');
    await flush();
    expect(tap.last()).toMatchObject({ phase: 'error', error: 'empty' });
  });
});

describe('RecordingController: interruption, cancel and cleanup', () => {
  it('keeps a partial clip, unsent, when the track ends or the page is hidden', async () => {
    const h = harness();
    const stream = await startRecording(h);
    h.clock.now += 4_000;
    stream.track.end();
    await flush();
    expect(h.last().clip?.reason).toBe('interrupted');
    expect(h.last().sendRequested).toBe(false);
    expect(stream.track.stopped).toBe(1);

    const hiddenPage = harness();
    const hiddenStream = await startRecording(hiddenPage);
    hiddenPage.clock.now += 4_000;
    hiddenPage.controller.interrupt();
    await flush();
    expect(hiddenPage.last().clip?.reason).toBe('interrupted');
    expect(hiddenStream.track.stopped).toBe(1);
  });

  it('keeps the clip when the browser stops the recorder by itself', async () => {
    const h = harness();
    const stream = await startRecording(h);
    h.clock.now += 3_000;
    h.recorders[0].browserStop();
    expect(h.last()).toMatchObject({ phase: 'recorded' });
    expect(h.last().clip?.reason).toBe('interrupted');
    expect(stream.track.stopped).toBe(1);
  });

  it('cancel discards the recording, closes the microphone and ignores late recorder events', async () => {
    const h = harness();
    const stream = await startRecording(h);
    h.recorders[0].emit(500);
    h.controller.cancel();
    await flush();
    expect(h.last()).toMatchObject({ phase: 'idle', clip: null, bytes: 0 });
    expect(stream.track.stopped).toBe(1);
  });

  it('finishes with what was captured if the final stop event never arrives', async () => {
    const h = harness();
    const stream = await startRecording(h);
    h.recorders[0].deliverOnStop = false;
    h.recorders[0].emit(300);
    h.clock.now += 3_000;
    h.controller.stop('user_stop');
    expect(stream.track.stopped).toBe(0);
    h.fireTimeouts();
    expect(h.last()).toMatchObject({ phase: 'recorded' });
    expect(h.last().clip?.bytes).toBe(300);
    expect(stream.track.stopped).toBe(1);
  });

  it('dispose releases the microphone and stops publishing snapshots', async () => {
    const h = harness();
    const stream = await startRecording(h);
    const published = h.snapshots.length;
    h.controller.dispose();
    await flush();
    expect(stream.track.stopped).toBe(1);
    expect(h.snapshots.length).toBe(published);
  });

  it('a new recording replaces the previous local clip', async () => {
    const h = harness();
    await startRecording(h);
    h.clock.now += 2_000;
    h.controller.stop('user_stop');
    await flush();
    expect(h.last().clip).not.toBeNull();
    const again = h.controller.start();
    expect(h.last()).toMatchObject({ phase: 'requesting', clip: null });
    h.resolvePermission();
    await again;
    expect(h.last().phase).toBe('recording');
  });
});
