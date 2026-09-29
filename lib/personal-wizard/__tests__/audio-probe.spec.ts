import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { measureAudioDuration, sniffAudioContainer, validateStreamLayout, validateTimeline } from '../audio-probe';

/**
 * Real media made with the bundled ffmpeg and measured with the bundled ffprobe + ffmpeg: no mocks.
 * Includes the reviewer's positive/negative pair (a normal 120 s tone and the same tone written with
 * a shifted timestamp timeline) as permanent controls.
 */
const MAX_MS = 91_500;
let dir = '';
const make = (name: string, args: string[]): Buffer => {
  const out = join(dir, name);
  const result = spawnSync(ffmpegInstaller.path, ['-y', '-hide_banner', '-loglevel', 'error', ...args, out], { windowsHide: true });
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${name}: ${String(result.stderr)}`);
  return readFileSync(out);
};
const tone = (seconds: number) => ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`];
const intakeTempFiles = () => readdirSync(tmpdir()).filter((name) => name.startsWith('pw-intake-')).length;
const measure = (bytes: Buffer, container: 'audio/webm' | 'audio/mp4' = 'audio/webm') =>
  measureAudioDuration(bytes, container, { maxDurationMs: MAX_MS });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pw-probe-spec-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('container sniffing', () => {
  it('identifies containers from bytes, not from claims', () => {
    expect(sniffAudioContainer(make('s.webm', [...tone(1), '-c:a', 'libopus', '-f', 'webm']))).toBe('audio/webm');
    expect(sniffAudioContainer(make('s.mp4', [...tone(1), '-c:a', 'aac', '-f', 'mp4']))).toBe('audio/mp4');
    expect(sniffAudioContainer(make('s.ogg', [...tone(1), '-c:a', 'libopus', '-f', 'ogg']))).toBe('audio/ogg');
    expect(sniffAudioContainer(Buffer.from('RIFF....WAVEfmt '))).toBeNull();
  });
});

describe('stream layout', () => {
  it('accepts exactly one audio stream and nothing else', () => {
    expect(validateStreamLayout('audio\n')).toEqual({ ok: true });
    expect(validateStreamLayout('audio\r\naudio\r\n')).toEqual({ ok: false, reason: 'unexpected_streams' });
    expect(validateStreamLayout('audio\nvideo\n')).toEqual({ ok: false, reason: 'unexpected_streams' });
    expect(validateStreamLayout('video\n')).toEqual({ ok: false, reason: 'unexpected_streams' });
    expect(validateStreamLayout('audio\ndata\n')).toEqual({ ok: false, reason: 'unexpected_streams' });
    expect(validateStreamLayout('')).toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('timeline validation', () => {
  it('allows encoder pre-roll and ordinary rounding', () => {
    expect(validateTimeline('-0.007000,0.020000\n0.014000,0.020000\n0.034000,0.020000,\n')).toEqual({ ok: true, spanS: expect.closeTo(0.061, 6) });
    expect(validateTimeline('-0.021333,0.021333\n0.000000,0.021333\n')).toMatchObject({ ok: true });
  });

  it('refuses shifted starts, backward steps, holes and missing timestamps', () => {
    expect(validateTimeline('21.058,0.02\n21.079,0.02\n')).toEqual({ ok: false, reason: 'timeline_invalid' });
    expect(validateTimeline('-3.000,0.02\n-2.980,0.02\n')).toEqual({ ok: false, reason: 'timeline_invalid' });
    expect(validateTimeline('0.000,0.02\n0.020,0.02\n0.010,0.02\n')).toEqual({ ok: false, reason: 'timeline_invalid' });
    expect(validateTimeline('0.000,0.02\n0.020,0.02\n5.040,0.02\n')).toEqual({ ok: false, reason: 'timeline_invalid' });
    expect(validateTimeline('0.000,0.02\nN/A,0.02\n')).toEqual({ ok: false, reason: 'timeline_invalid' });
    expect(validateTimeline('')).toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('measured duration from real media', () => {
  it('accepts normal WebM/Opus and MP4/AAC recordings with agreeing measurements', async () => {
    const webm = await measure(make('a.webm', [...tone(3), '-c:a', 'libopus', '-f', 'webm']));
    const mp4 = await measure(make('a.mp4', [...tone(2), '-c:a', 'aac', '-f', 'mp4']), 'audio/mp4');
    expect(webm).toMatchObject({ ok: true });
    expect(mp4).toMatchObject({ ok: true });
    if (!webm.ok || !mp4.ok) return;
    expect(webm.decodedMs).toBe(3000);
    expect(webm.durationMs).toBeGreaterThanOrEqual(3000);
    expect(webm.durationMs).toBeLessThan(3100);
    expect(mp4.durationMs).toBeGreaterThanOrEqual(2000);
    expect(mp4.durationMs).toBeLessThan(2100);
  });

  it('reviewer control pair: a 120 s tone is too long, and hiding it behind shifted timestamps is refused', async () => {
    const normal = await measure(make('n120.webm', [...tone(120), '-c:a', 'libopus', '-b:a', '16k', '-f', 'webm']));
    const offset = await measure(
      make('o120.webm', [...tone(120), '-c:a', 'libopus', '-b:a', '16k', '-output_ts_offset', '-110', '-avoid_negative_ts', 'disabled', '-f', 'webm']),
    );
    expect(normal).toEqual({ ok: false, reason: 'too_long' });
    expect(offset).toEqual({ ok: false, reason: 'timeline_invalid' });
  });

  it('refuses a timeline that disagrees with the decoded audio, even without holes', async () => {
    const stretched = await measure(make('stretch.webm', [...tone(10), '-af', 'asetpts=PTS*1.3', '-c:a', 'libopus', '-f', 'webm']));
    const slightly = await measure(make('stretch2.webm', [...tone(10), '-af', 'asetpts=PTS*1.08', '-c:a', 'libopus', '-f', 'webm']));
    expect(stretched).toEqual({ ok: false, reason: 'timeline_mismatch' });
    expect(slightly).toEqual({ ok: false, reason: 'timeline_mismatch' });
  });

  it('refuses a timeline with a hole and a small shifted start', async () => {
    const gap = await measure(make('gap.webm', [...tone(3), '-af', "asetpts='if(gte(T,1),PTS+5/TB,PTS)'", '-c:a', 'libopus', '-f', 'webm']));
    const shifted = await measure(
      make('shift.webm', [...tone(5), '-c:a', 'libopus', '-output_ts_offset', '-3', '-avoid_negative_ts', 'disabled', '-f', 'webm']),
    );
    expect(gap).toEqual({ ok: false, reason: 'timeline_invalid' });
    expect(shifted).toEqual({ ok: false, reason: 'timeline_invalid' });
  });

  it('refuses a short first audio stream hiding a long second one, and any video, in WebM and MP4', async () => {
    const twoTracks = (name: string, codec: string[], format: string) =>
      make(name, [...tone(3), '-f', 'lavfi', '-i', 'sine=frequency=660:duration=120', '-map', '0:a', '-map', '1:a', ...codec, '-f', format]);
    expect(await measure(twoTracks('two.webm', ['-c:a', 'libopus', '-b:a', '12k'], 'webm'))).toEqual({ ok: false, reason: 'unexpected_streams' });
    expect(await measure(twoTracks('two.mp4', ['-c:a', 'aac', '-b:a', '16k'], 'mp4'), 'audio/mp4')).toEqual({ ok: false, reason: 'unexpected_streams' });
    const withVideo = make('av.webm', [
      ...tone(3),
      '-f', 'lavfi', '-i', 'color=c=black:s=16x16:d=3',
      '-map', '0:a', '-map', '1:v', '-c:a', 'libopus', '-c:v', 'libvpx', '-b:v', '8k', '-f', 'webm',
    ]);
    expect(await measure(withVideo)).toEqual({ ok: false, reason: 'unexpected_streams' });
    // Control: the same short tone as a single stream is accepted.
    expect(await measure(make('one.webm', [...tone(3), '-c:a', 'libopus', '-b:a', '12k', '-f', 'webm']))).toMatchObject({ ok: true });
  });

  it('keeps a long-but-allowed recording and refuses truncated or corrupt input', async () => {
    const long = await measure(make('l89.webm', [...tone(89), '-c:a', 'libopus', '-b:a', '16k', '-f', 'webm']));
    expect(long).toMatchObject({ ok: true });
    const full = make('t.webm', [...tone(3), '-c:a', 'libopus', '-f', 'webm']);
    expect(await measure(full.subarray(0, Math.floor(full.length * 0.6)))).toEqual({ ok: false, reason: 'unreadable' });
    const corrupt = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(6000, 9)]);
    expect(await measure(corrupt)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('removes its temporary file on every path, including an early decoder stop', async () => {
    const before = intakeTempFiles();
    await measure(make('c1.webm', [...tone(120), '-c:a', 'libopus', '-b:a', '16k', '-f', 'webm']));
    await measure(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(4000, 1)]));
    await measure(make('c2.webm', [...tone(2), '-c:a', 'libopus', '-f', 'webm']));
    expect(intakeTempFiles()).toBe(before);
  });
});
