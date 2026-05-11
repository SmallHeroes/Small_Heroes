/**
 * Server-side book → MP4 export (slideshow + per-page narration + text overlay).
 * Requires FFmpeg (+ ffprobe) at runtime (@ffmpeg-installer/* on serverless).
 */
import 'server-only';

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import sharp from 'sharp';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { basename } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const FFMPEG_BIN = ffmpegInstaller.path.replace(/\\/g, '/');
const FFPROBE_BIN = ffprobeInstaller.path.replace(/\\/g, '/');
ffmpeg.setFfmpegPath(FFMPEG_BIN);
ffmpeg.setFfprobePath(FFPROBE_BIN);

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1440;
const PAGE_PADDING_SEC = 1.5;
const COVER_DURATION_SEC = 4;
const END_SCREEN_SEC = 3;
const NO_AUDIO_PAGE_SEC = 5;
const AUDIO_SR = 44100;

export interface VideoPageInput {
  pageNumber: number;
  text: string;
  imageUrl: string;
  audioUrl: string | null;
  isCover?: boolean;
}

export interface VideoInput {
  orderId: string;
  title: string;
  pages: VideoPageInput[];
}

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for video storage');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/** Public URL after upload — same convention as audio. */
export async function storeVideo(buffer: Buffer, filename: string): Promise<string> {
  const supabase = getSupabase();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'book-images';
  const key = `video/${filename}`;

  const { error } = await supabase.storage.from(bucket).upload(key, buffer, {
    contentType: 'video/mp4',
    upsert: true,
    cacheControl: '31536000',
  });

  if (error) throw new Error(`Video upload failed: ${error.message}`);

  const url = process.env.SUPABASE_URL!;
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${key}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap display text — Hebrew often has no spaces; break on whitespace when present else by length. */
function wrapOverlayText(raw: string, maxCharsPerLine: number): string[] {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (maxCharsPerLine < 8) return [t];

  const lines: string[] = [];
  let rest = t;

  while (rest.length > 0) {
    let breakPos = rest.length <= maxCharsPerLine ? rest.length : -1;
    if (breakPos < 0) {
      const slice = rest.slice(0, maxCharsPerLine);
      const lastSpace = slice.lastIndexOf(' ');
      breakPos =
        lastSpace > maxCharsPerLine * 0.35 ? lastSpace + 1 : maxCharsPerLine;
    }
    lines.push(rest.slice(0, breakPos).trim());
    rest = rest.slice(breakPos).trim();
    if (!rest && lines.length && lines[lines.length - 1] === '') break;
  }

  return lines.filter(Boolean);
}

async function renderPageFrame(imageBuffer: Buffer, text: string, omitText: boolean): Promise<Buffer> {
  const base = await sharp(imageBuffer)
    .resize(VIDEO_WIDTH, VIDEO_HEIGHT, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  if (!text?.trim().length || omitText) return base;

  // ── Text layout — centered block at top, RTL right-aligned text (like book reader) ──
  const MARGIN_X = 120;  // symmetric margins → block is centered on page
  const MARGIN_TOP = 48;
  const TEXT_FONT_SIZE = 32;
  const LINE_HEIGHT = 46;
  const MAX_CHARS = 36;
  const TEXT_RIGHT_EDGE = VIDEO_WIDTH - MARGIN_X;  // right edge of centered block

  const escapedLines = wrapOverlayText(text, MAX_CHARS).map(escapeXml);
  const textStartY = MARGIN_TOP + TEXT_FONT_SIZE;

  const svgLines = escapedLines
    .map((line, i) => {
      const y = textStartY + i * LINE_HEIGHT;
      return `<text xml:space="preserve" x="${TEXT_RIGHT_EDGE}" y="${y}" text-anchor="end" font-family="Heebo, Arial Hebrew, Arial, sans-serif" font-size="${TEXT_FONT_SIZE}" font-weight="700" fill="#2e2a22" direction="rtl" stroke="#fdf9f4" stroke-width="4" paint-order="stroke">${line}</text>`;
    })
    .join('\n');

  const svgOverlay = `
<svg width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${svgLines}
</svg>`.trim();

  return sharp(base)
    .composite([{ input: Buffer.from(svgOverlay, 'utf-8'), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function renderEndScreen(title: string): Promise<Buffer> {
  const safeTitle = escapeXml(title.trim() || 'הספר שלכם');
  const svg = `
<svg width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#fdf9f4"/>
  <text x="${VIDEO_WIDTH / 2}" y="${VIDEO_HEIGHT / 2 - 48}" text-anchor="middle" font-family="Heebo, sans-serif" font-size="72" fill="#5c5348">✦</text>
  <text x="${VIDEO_WIDTH / 2}" y="${VIDEO_HEIGHT / 2 + 36}" text-anchor="middle" font-family="Heebo, sans-serif" font-size="48" font-weight="700" fill="#5c5348" direction="rtl">סוף</text>
  <text x="${VIDEO_WIDTH / 2}" y="${VIDEO_HEIGHT / 2 + 100}" text-anchor="middle" font-family="Heebo, sans-serif" font-size="22" fill="#b8a990" direction="rtl">${safeTitle}</text>
</svg>`.trim();

  return sharp(Buffer.from(svg, 'utf-8')).resize(VIDEO_WIDTH, VIDEO_HEIGHT).png().toBuffer();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function getAudioDurationSec(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const d = data.format?.duration;
      if (typeof d === 'number' && Number.isFinite(d) && d > 0.1) return resolve(d);
      resolve(NO_AUDIO_PAGE_SEC);
    });
  });
}

function writeSilenceWav(workDir: string, name: string, durationSec: number): Promise<string> {
  const outPath = join(workDir, `${name}.wav`);
  const outPosix = outPath.replace(/\\/g, '/');
  const args = [
    '-y',
    '-f', 'lavfi', '-t', String(durationSec),
    '-i', 'anullsrc=channel_layout=mono:sample_rate=44100',
    '-ar', String(AUDIO_SR),
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    outPosix,
  ];
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_BIN, args, { maxBuffer: 5 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`Silence gen failed: ${err.message}\n${stderr}`));
      resolve(outPath);
    });
  });
}

async function normalizePaddedMp3(mp3Path: string, padAfterSec: number, workDir: string, base: string): Promise<string> {
  // Step 1: Convert MP3 → WAV (no filters)
  const rawWavPath = join(workDir, `${base}-raw.wav`);
  const rawWavPosix = rawWavPath.replace(/\\/g, '/');
  const mp3Posix = mp3Path.replace(/\\/g, '/');
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG_BIN, [
      '-y', '-i', mp3Posix,
      '-ar', String(AUDIO_SR), '-ac', '1', '-c:a', 'pcm_s16le',
      rawWavPosix,
    ], { maxBuffer: 5 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`MP3→WAV failed: ${err.message}\n${stderr}`));
      resolve();
    });
  });

  // Step 2: Generate silence padding WAV
  const silPath = await writeSilenceWav(workDir, `${base}-pad`, padAfterSec);

  // Step 3: Concat speech + silence via concat demuxer (no filters)
  // Use basename only — concat demuxer resolves relative to the list file's directory
  const outPath = join(workDir, `${base}.wav`);
  const outPosix = outPath.replace(/\\/g, '/');
  const listPath = join(workDir, `${base}-concat.txt`);
  const listContent = [
    `file '${basename(rawWavPath)}'`,
    `file '${basename(silPath)}'`,
  ].join('\n');
  await writeFile(listPath, listContent, 'utf-8');

  const listPosix = listPath.replace(/\\/g, '/');
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG_BIN, [
      '-y', '-f', 'concat', '-safe', '0', '-i', listPosix,
      '-c:a', 'pcm_s16le', '-ar', String(AUDIO_SR), '-ac', '1',
      outPosix,
    ], { maxBuffer: 5 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`Padded concat failed: ${err.message}\n${stderr}`));
      resolve();
    });
  });

  return outPath;
}

async function concatWavs(wavs: string[], workDir: string): Promise<string> {
  const outPath = join(workDir, 'full-audio.wav');
  const listPath = join(workDir, 'audio-concat.txt');
  // Use basename only — all wavs are in workDir, concat resolves relative to list file
  const lines = wavs.map((p) => `file '${basename(p)}'`);
  await writeFile(listPath, lines.join('\n'), 'utf-8');

  const listPosix = listPath.replace(/\\/g, '/');
  const outPosix = outPath.replace(/\\/g, '/');
  const args = [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', listPosix,
    '-c:a', 'pcm_s16le',
    '-ar', String(AUDIO_SR),
    '-ac', '1',
    outPosix,
  ];
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_BIN, args, { maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`WAV concat failed: ${err.message}\n${stderr}`));
      resolve(outPath);
    });
  });
}

/**
 * Encode slides + audio into final MP4.
 * Calls FFmpeg binary directly via child_process.execFile — NO fluent-ffmpeg
 * for the encode step, because fluent-ffmpeg silently injects filter-graph
 * options when combining inputs, which fails on the minimal @ffmpeg-installer build.
 *
 * Uses concat demuxer with `duration` directives on image files.
 */
async function encodeSlidesWithAudio(
  slidePngPaths: string[],
  durationsSec: number[],
  audioWavPath: string,
  outputPath: string
): Promise<void> {
  if (slidePngPaths.length !== durationsSec.length) {
    throw new Error('Slides/duration mismatch');
  }

  const workDir = join(outputPath, '..');

  // Build concat demuxer list with duration per image
  // Use basename only — concat demuxer resolves relative to the list file's directory
  const concatListPath = join(workDir, 'slides-concat.txt');
  const lines: string[] = [];
  for (let i = 0; i < slidePngPaths.length; i++) {
    lines.push(`file '${basename(slidePngPaths[i])}'`);
    lines.push(`duration ${durationsSec[i]}`);
  }
  // Concat demuxer quirk: last file must be listed again without duration
  if (slidePngPaths.length > 0) {
    lines.push(`file '${basename(slidePngPaths[slidePngPaths.length - 1])}'`);
  }
  await writeFile(concatListPath, lines.join('\n'), 'utf-8');

  const concatPosix = concatListPath.replace(/\\/g, '/');
  const audioPosix = audioWavPath.replace(/\\/g, '/');
  const outPosix = outputPath.replace(/\\/g, '/');

  // Direct FFmpeg call — full control, no hidden options
  const args = [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPosix,
    '-i', audioPosix,
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'medium',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '1',
    '-shortest',
    '-avoid_negative_ts', 'make_zero',
    '-movflags', '+faststart',
    outPosix,
  ];

  console.log('[video] FFmpeg encode command:', FFMPEG_BIN, args.join(' '));

  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG_BIN, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error('[video] FFmpeg stderr:', stderr);
        return reject(new Error(`FFmpeg encode failed: ${err.message}\n${stderr}`));
      }
      resolve();
    });
  });
}

/** Full MP4 pipeline — returns video bytes. */
export async function generateBookVideo(input: VideoInput): Promise<Buffer> {
  if (!input.pages.length) throw new Error('No pages supplied for video export');

  const workDir = join(tmpdir(), `book-video-${input.orderId}-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const slidePaths: string[] = [];
  const durations: number[] = [];
  const audioPieces: string[] = [];

  try {
    let idx = 0;
    for (const page of input.pages) {
      const imgBuf = await fetchBuffer(page.imageUrl);
      const isCover = page.isCover === true || page.pageNumber === 0;
      const frame = await renderPageFrame(imgBuf, page.text ?? '', isCover);

      const framePath = join(workDir, `slide-${idx}.png`);
      await writeFile(framePath, frame);
      slidePaths.push(framePath);

      let durationSec: number;
      if (isCover) {
        durationSec = COVER_DURATION_SEC;
        audioPieces.push(await writeSilenceWav(workDir, `sil-cover-${idx}`, COVER_DURATION_SEC));
      } else if (page.audioUrl) {
        const mp3Path = join(workDir, `raw-${idx}.mp3`);
        const audioBuf = await fetchBuffer(page.audioUrl);
        await writeFile(mp3Path, audioBuf);

        const rawDur = await getAudioDurationSec(mp3Path);
        durationSec = rawDur + PAGE_PADDING_SEC;
        audioPieces.push(await normalizePaddedMp3(mp3Path, PAGE_PADDING_SEC, workDir, `seg-${idx}`));
      } else {
        durationSec = NO_AUDIO_PAGE_SEC;
        audioPieces.push(await writeSilenceWav(workDir, `sil-page-${idx}`, NO_AUDIO_PAGE_SEC));
      }

      durations.push(durationSec);
      idx++;
    }

    const endBuf = await renderEndScreen(input.title);
    const endPath = join(workDir, `slide-end.png`);
    await writeFile(endPath, endBuf);
    slidePaths.push(endPath);
    durations.push(END_SCREEN_SEC);
    audioPieces.push(await writeSilenceWav(workDir, `sil-end`, END_SCREEN_SEC));

    const fullAudioPath = await concatWavs(audioPieces, workDir);
    const outMp4 = join(workDir, 'book.mp4');
    await encodeSlidesWithAudio(slidePaths, durations, fullAudioPath, outMp4);

    return readFile(outMp4);
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

