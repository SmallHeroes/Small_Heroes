'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PersonalBookDraft } from '@/lib/personal-wizard/contract';
import { createDraft, randomId } from '@/lib/personal-wizard/draft';
import {
  RecordingController,
  type MediaRecorderLike,
  type MediaStreamLike,
  type RecorderDeps,
  type RecorderSnapshot,
} from '@/lib/personal-wizard/recorder';

/**
 * Draft store: memory only (no sessionStorage/localStorage/IndexedDB). The ref is updated
 * synchronously so async intake callbacks always merge into the latest draft.
 */
export function useDraftStore() {
  const ref = useRef<PersonalBookDraft | null>(null);
  if (ref.current === null) ref.current = createDraft(randomId('d'));
  const [draft, setDraft] = useState<PersonalBookDraft>(ref.current);
  const update = useCallback((change: (current: PersonalBookDraft) => PersonalBookDraft) => {
    const current = ref.current as PersonalBookDraft;
    const nextDraft = change(current);
    if (nextDraft !== current) {
      ref.current = nextDraft;
      setDraft(nextDraft);
    }
    return nextDraft;
  }, []);
  const read = useCallback(() => ref.current as PersonalBookDraft, []);
  return { draft, update, read };
}

function browserRecorderDeps(onStream: (stream: MediaStreamLike | null) => void): RecorderDeps {
  const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  const Recorder = typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined;
  return {
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
    getUserMedia:
      mediaDevices && typeof mediaDevices.getUserMedia === 'function'
        ? (constraints) => mediaDevices.getUserMedia(constraints)
        : undefined,
    createRecorder: Recorder
      ? (stream, mimeType) =>
          new Recorder(stream as unknown as MediaStream, mimeType ? { mimeType } : undefined) as unknown as MediaRecorderLike
      : undefined,
    isTypeSupported:
      Recorder && typeof Recorder.isTypeSupported === 'function' ? (mime) => Recorder.isTypeSupported(mime) : undefined,
    isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    now: () => performance.now(),
    setInterval: (callback, ms) => window.setInterval(callback, ms),
    clearInterval: (handle) => window.clearInterval(handle as number),
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
    onStream,
  };
}

const IDLE_SNAPSHOT: RecorderSnapshot = {
  phase: 'idle',
  elapsedMs: 0,
  warned: false,
  bytes: 0,
  error: null,
  clip: null,
  sendRequested: false,
  abandonedPermission: false,
};

/** One recorder per page. Hidden page / pagehide interrupts; unmount releases the microphone. */
export function useRecorder() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>(IDLE_SNAPSHOT);
  const [stream, setStream] = useState<MediaStreamLike | null>(null);
  const controllerRef = useRef<RecordingController | null>(null);

  useEffect(() => {
    const controller = new RecordingController(browserRecorderDeps(setStream), setSnapshot);
    controllerRef.current = controller;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') controller.interrupt();
    };
    const onPageHide = () => controller.interrupt();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const controller = useCallback(() => controllerRef.current, []);
  return { snapshot, stream, controller };
}

/**
 * Measured input level (RMS of the live microphone signal). Nothing is drawn unless a real
 * stream is present; there is no decorative fake waveform.
 */
export function useLevelMeter(stream: MediaStreamLike | null): number | null {
  const [level, setLevel] = useState<number | null>(null);
  useEffect(() => {
    if (!stream || typeof window === 'undefined') {
      setLevel(null);
      return;
    }
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    let context: AudioContext | null = null;
    let frame = 0;
    let lastPaint = 0;
    try {
      context = new AudioContextCtor();
      const source = context.createMediaStreamSource(stream as unknown as MediaStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const loop = (time: number) => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length);
        if (time - lastPaint > 80) {
          lastPaint = time;
          // Square root = roughly perceptual loudness, so ordinary speech moves the bar visibly.
          setLevel(Math.min(1, Math.sqrt(rms) * 1.8));
        }
        frame = window.requestAnimationFrame(loop);
      };
      frame = window.requestAnimationFrame(loop);
    } catch {
      setLevel(null);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      void context?.close().catch(() => undefined);
      setLevel(null);
    };
  }, [stream]);
  return level;
}

/** Exactly one playback at a time (narrator samples and the local recording share it). */
export function usePlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioRef.current = null;
    setPlayingId(null);
  }, []);

  const play = useCallback(
    (id: string, url: string) => {
      stop();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener('ended', () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingId(null);
        }
      });
      setPlayingId(id);
      audio.play().catch(() => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingId(null);
        }
      });
    },
    [stop],
  );

  useEffect(() => stop, [stop]);
  return { playingId, play, stop };
}

/**
 * True while a text field is focused AND the visual viewport is clearly shorter than the layout
 * viewport (an on-screen keyboard). Desktop and hardware keyboards never trigger it.
 */
export function useSoftKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const check = () => {
      const active = document.activeElement;
      const typing =
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement && !['radio', 'checkbox', 'file', 'button', 'submit'].includes(active.type));
      setOpen(typing && window.innerHeight - viewport.height > 150);
    };
    const deferred = () => window.setTimeout(check, 60);
    viewport.addEventListener('resize', check);
    document.addEventListener('focusin', deferred);
    document.addEventListener('focusout', deferred);
    return () => {
      viewport.removeEventListener('resize', check);
      document.removeEventListener('focusin', deferred);
      document.removeEventListener('focusout', deferred);
    };
  }, []);
  return open;
}

/** Object URL for a Blob, revoked whenever the Blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const created = URL.createObjectURL(blob);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [blob]);
  return url;
}
