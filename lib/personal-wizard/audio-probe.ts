import 'server-only';

import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { execFile } from 'child_process';
import { randomBytes } from 'crypto';
import { rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Server-side audio checks that do not trust the browser: the container is identified from the
 * bytes (not the declared MIME type), and the duration is measured from the stream's packets
 * (MediaRecorder WebM often carries no duration header, so a declared or header duration is not
 * evidence).
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

const FFPROBE_BIN = ffprobeInstaller.path;

function run(bin: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
      if (error) reject(error);
      else resolve(String(stdout));
    });
  });
}

/**
 * Measured duration in milliseconds (end of the last audio packet), or null when the stream
 * cannot be read. The bytes are written to a private temporary file only for the probe and the
 * file is removed in `finally`, on success and on every failure.
 */
export async function probeAudioDurationMs(
  bytes: Buffer,
  container: ProviderAudioContainer,
  options: { timeoutMs?: number; ffprobePath?: string } = {},
): Promise<number | null> {
  const extension = container === 'audio/mp4' ? 'mp4' : 'webm';
  const file = join(tmpdir(), `pw-intake-${randomBytes(12).toString('hex')}.${extension}`);
  try {
    await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
    const stdout = await run(
      options.ffprobePath ?? FFPROBE_BIN,
      ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'packet=pts_time,duration_time', '-of', 'csv=p=0', file],
      options.timeoutMs ?? 10_000,
    );
    let endSeconds = 0;
    let packets = 0;
    for (const line of stdout.split(/\r?\n/)) {
      const [ptsText, durationText] = line.split(',');
      const pts = Number(ptsText);
      if (!Number.isFinite(pts)) continue;
      const duration = Number(durationText);
      endSeconds = Math.max(endSeconds, pts + (Number.isFinite(duration) ? duration : 0));
      packets += 1;
    }
    return packets > 0 ? Math.round(endSeconds * 1000) : null;
  } catch {
    return null;
  } finally {
    await rm(file, { force: true }).catch(() => undefined);
  }
}
