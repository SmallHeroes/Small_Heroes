import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { probeAudioDurationMs, sniffAudioContainer } from '../audio-probe';

/** Real clips made with the bundled ffmpeg, measured with the bundled ffprobe: no mocks. */
let dir = '';
const clip = (name: string, codecArgs: string[], seconds: number): Buffer => {
  const out = join(dir, name);
  const result = spawnSync(
    ffmpegInstaller.path,
    ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`, ...codecArgs, out],
    { windowsHide: true },
  );
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${String(result.stderr)}`);
  return readFileSync(out);
};
const intakeTempFiles = () => readdirSync(tmpdir()).filter((name) => name.startsWith('pw-intake-')).length;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pw-probe-spec-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('audio checks against real files', () => {
  it('identifies containers from bytes', () => {
    const webm = clip('a.webm', ['-c:a', 'libopus', '-f', 'webm'], 1);
    const mp4 = clip('a.mp4', ['-c:a', 'aac', '-f', 'mp4'], 1);
    const ogg = clip('a.ogg', ['-c:a', 'libopus', '-f', 'ogg'], 1);
    expect(sniffAudioContainer(webm)).toBe('audio/webm');
    expect(sniffAudioContainer(mp4)).toBe('audio/mp4');
    expect(sniffAudioContainer(ogg)).toBe('audio/ogg');
    expect(sniffAudioContainer(Buffer.from('RIFF....WAVEfmt '))).toBeNull();
  });

  it('measures the real duration of webm/opus and mp4/aac, and cleans its temporary file', async () => {
    const before = intakeTempFiles();
    const webm = await probeAudioDurationMs(clip('b.webm', ['-c:a', 'libopus', '-f', 'webm'], 3), 'audio/webm');
    const mp4 = await probeAudioDurationMs(clip('b.mp4', ['-c:a', 'aac', '-f', 'mp4'], 2), 'audio/mp4');
    expect(webm).toBeGreaterThanOrEqual(2900);
    expect(webm).toBeLessThanOrEqual(3100);
    expect(mp4).toBeGreaterThanOrEqual(1900);
    expect(mp4).toBeLessThanOrEqual(2100);
    expect(intakeTempFiles()).toBe(before);
  });

  it('returns null for bytes that only look like a container, and still cleans up', async () => {
    const before = intakeTempFiles();
    const fake = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(4000, 9)]);
    expect(await probeAudioDurationMs(fake, 'audio/webm')).toBeNull();
    expect(intakeTempFiles()).toBe(before);
  });
});
