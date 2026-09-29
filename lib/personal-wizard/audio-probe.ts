import 'server-only';

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { execFile, spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Server-side audio checks that do not trust the browser or the container's own claims.
 *
 * - The container is identified from the bytes, not from the declared MIME type.
 * - The duration is established twice and must agree:
 *   1. the packet timeline must be well formed (starts near zero allowing only encoder pre-roll,
 *      never steps backwards, has no holes), and its span is measured;
 *   2. the audio is actually decoded (mono, 8 kHz) with a hard output ceiling, and the decoded
 *      samples are counted.
 *   A malformed timeline, a decode error or a disagreement fails closed; the larger of the two
 *   agreeing measurements is used. MediaRecorder WebM often has no duration header, and header or
 *   timestamp values alone are not evidence of how much audio a file holds.
 */
export type ProviderAudioContainer = 'audio/webm' | 'audio/mp4';
export type SniffedContainer = ProviderAudioContainer | 'audio/ogg';

export function sniffAudioContainer(bytes: Uint8Array): SniffedContainer | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'audio/webm';
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp') return 'audio/mp4';
  if (bytes.length >= 4 && ascii(0, 4) === 'OggS') return 'audio/ogg';
  return null;
}

/** Legitimate encoder pre-roll (Opus pre-skip, AAC priming) can start slightly below zero. */
const PREROLL_TOLERANCE_S = 0.5;
/** A recording starts at (about) zero; a later first timestamp is a shifted timeline. */
const START_TOLERANCE_S = 0.5;
/** Rounding between consecutive packet timestamps. */
const BACKSTEP_TOLERANCE_S = 0.005;
/** Recorders emit continuous frames, silence included; a larger hole is a manipulated timeline. */
const GAP_TOLERANCE_S = 1;
/** Timeline and decoded duration must agree within max(0.5 s, 5%). */
const AGREEMENT_FLOOR_S = 0.5;
const AGREEMENT_RATIO = 0.05;
const DECODE_RATE = 8000;
const DECODE_BYTES_PER_SECOND = DECODE_RATE * 2; // mono s16le

export type AudioMeasurement =
  | { ok: true; durationMs: number; decodedMs: number; timelineMs: number }
  | { ok: false; reason: 'unreadable' | 'timeline_invalid' | 'timeline_mismatch' | 'too_long' };

type MeasureOptions = {
  /** Anything that decodes to more than this is refused as soon as the ceiling is crossed. */
  maxDurationMs: number;
  timeoutMs?: number;
  ffprobePath?: string;
  ffmpegPath?: string;
};

function runProbe(bin: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

type TimelineResult = { ok: true; spanS: number } | { ok: false; reason: 'unreadable' | 'timeline_invalid' };

export function validateTimeline(csv: string): TimelineResult {
  const packets: Array<{ pts: number; duration: number }> = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [ptsText, durationText] = line.split(',');
    const pts = Number(ptsText);
    const duration = Number(durationText);
    // Every audio packet must carry a timestamp; a missing one is not something to guess around.
    if (!Number.isFinite(pts)) return { ok: false, reason: 'timeline_invalid' };
    packets.push({ pts, duration: Number.isFinite(duration) && duration >= 0 ? duration : 0 });
  }
  if (packets.length === 0) return { ok: false, reason: 'unreadable' };
  const first = packets[0].pts;
  if (first < -PREROLL_TOLERANCE_S || first > START_TOLERANCE_S) return { ok: false, reason: 'timeline_invalid' };
  let end = first + packets[0].duration;
  for (let index = 1; index < packets.length; index += 1) {
    const previous = packets[index - 1];
    const current = packets[index];
    if (current.pts < previous.pts - BACKSTEP_TOLERANCE_S) return { ok: false, reason: 'timeline_invalid' };
    if (current.pts - (previous.pts + previous.duration) > GAP_TOLERANCE_S) return { ok: false, reason: 'timeline_invalid' };
    end = Math.max(end, current.pts + current.duration);
  }
  return { ok: true, spanS: end - first };
}

type DecodeResult = { ok: true; seconds: number } | { ok: false; reason: 'unreadable' | 'too_long' };

function decodeBounded(ffmpegPath: string, file: string, maxSeconds: number, timeoutMs: number): Promise<DecodeResult> {
  return new Promise((resolve) => {
    const capBytes = Math.ceil(maxSeconds * DECODE_BYTES_PER_SECOND);
    const child = spawn(
      ffmpegPath,
      ['-v', 'error', '-nostdin', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(DECODE_RATE), '-f', 's16le', 'pipe:1'],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let bytes = 0;
    let stderr = '';
    /** Set when we stop the decoder early; the result is delivered only once the process has exited,
     *  so the temporary file is no longer held open when the caller removes it (Windows locks it). */
    let verdict: DecodeResult | null = null;
    let settled = false;
    const settle = (result: DecodeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const stopEarly = (result: DecodeResult) => {
      if (verdict) return;
      verdict = result;
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => stopEarly({ ok: false, reason: 'unreadable' }), timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > capBytes) stopEarly({ ok: false, reason: 'too_long' });
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += String(chunk);
    });
    child.on('error', () => settle(verdict ?? { ok: false, reason: 'unreadable' }));
    child.on('close', (code) => {
      if (verdict) return settle(verdict);
      // Any decoder error (at `-v error`) or a non-zero exit means the audio is not trustworthy.
      if (code !== 0 || stderr.trim().length > 0 || bytes === 0) settle({ ok: false, reason: 'unreadable' });
      else settle({ ok: true, seconds: bytes / DECODE_BYTES_PER_SECOND });
    });
  });
}

/**
 * Measures how much audio `bytes` really hold. The bytes are written to one private temporary file
 * for the two external tools; the file is removed in `finally` on every path.
 */
export async function measureAudioDuration(
  bytes: Buffer,
  container: ProviderAudioContainer,
  options: MeasureOptions,
): Promise<AudioMeasurement> {
  const extension = container === 'audio/mp4' ? 'mp4' : 'webm';
  const file = join(tmpdir(), `pw-intake-${randomBytes(12).toString('hex')}.${extension}`);
  const timeoutMs = options.timeoutMs ?? 20_000;
  try {
    await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
    let probe: { stdout: string; stderr: string };
    try {
      probe = await runProbe(
        options.ffprobePath ?? ffprobeInstaller.path,
        ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'packet=pts_time,duration_time', '-of', 'csv=p=0', file],
        timeoutMs,
      );
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
    if (probe.stderr.trim().length > 0) return { ok: false, reason: 'unreadable' };
    const timeline = validateTimeline(probe.stdout);
    if (!timeline.ok) return timeline;

    const decoded = await decodeBounded(
      options.ffmpegPath ?? ffmpegInstaller.path,
      file,
      options.maxDurationMs / 1000,
      timeoutMs,
    );
    if (!decoded.ok) return decoded;

    const tolerance = Math.max(AGREEMENT_FLOOR_S, AGREEMENT_RATIO * Math.max(timeline.spanS, decoded.seconds));
    if (Math.abs(timeline.spanS - decoded.seconds) > tolerance) return { ok: false, reason: 'timeline_mismatch' };
    const decodedMs = Math.round(decoded.seconds * 1000);
    const timelineMs = Math.round(timeline.spanS * 1000);
    const durationMs = Math.max(decodedMs, timelineMs);
    if (durationMs > options.maxDurationMs) return { ok: false, reason: 'too_long' };
    return { ok: true, durationMs, decodedMs, timelineMs };
  } catch {
    return { ok: false, reason: 'unreadable' };
  } finally {
    await rm(file, { force: true, maxRetries: 5, retryDelay: 50 }).catch(() => undefined);
  }
}
