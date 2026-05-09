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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path.replace(/\\/g, '/'));
ffmpeg.setFfprobePath(ffprobeInstaller.path.replace(/\\/g, '/'));

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

  const escapedLines = wrapOverlayText(text, 38).map(escapeXml);
  const lineHeight = 44;
  const textBlockHeight = escapedLines.length * lineHeight + 56;
  const gradientHeight = textBlockHeight + 88;
  const yStart = VIDEO_HEIGHT - gradientHeight;

  const svgLines = escapedLines
    .map((line, i) => {
      const y = VIDEO_HEIGHT - textBlockHeight + 36 + i * lineHeight + lineHeight * 0.85;
      return `<text xml:space="preserve" x="${VIDEO_WIDTH - 36}" y="${y}" text-anchor="end" font-family="Heebo, Arial Hebrew, Arial, sans-serif" font-size="34" font-weight="600" fill="#2e2a22" direction="rtl">${line}</text>`;
    })
    .join('\n');

  const svgOverlay = `
<svg width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(253,249,244)" stop-opacity="0"/>
      <stop offset="38%" stop-color="rgb(253,249,244)" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="rgb(253,249,244)" stop-opacity="0.94"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${yStart}" width="${VIDEO_WIDTH}" height="${gradientHeight}" fill="url(#fade)"/>
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
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('anullsrc=channel_layout=mono:sample_rate=44100')
      .inputOptions(['-f', 'lavfi', '-t', String(durationSec)])
      .audioFrequency(AUDIO_SR)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run();
  });
}

async function normalizePaddedMp3(mp3Path: string, padAfterSec: number, workDir: string, base: string): Promise<string> {
  const outPath = join(workDir, `${base}.wav`);
  return new Promise((resolve, reject) => {
    ffmpeg(mp3Path)
      .audioFilters(`apad=pad_dur=${padAfterSec}`)
      .audioFrequency(AUDIO_SR)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run();
  });
}

async function concatWavs(wavs: string[], workDir: string): Promise<string> {
  const outPath = join(workDir, 'full-audio.wav');
  const listPath = join(workDir, 'audio-concat.txt');
  const lines = wavs.map((p) => {
    const posix = p.replace(/\\/g, '/');
    return `file '${posix.replace(/'/g, `'\\''`)}'`;
  });
  await writeFile(listPath, lines.join('\n'), 'utf-8');

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SR)
      .audioChannels(1)
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run();
  });
}

/** Convert a single PNG into a silent MP4 clip of the given duration. */
function createSlideSegment(
  imagePath: string,
  durationSec: number,
  outputPath: string
): Promise<void> {
  const FPS = 25;
  // The `loop` VIDEO FILTER repeats frames (not the `-loop` input option which is GIF-only).
  // loop=<loops>:<size>:<start> — loops = number of extra frame copies, size = 1 frame, start = 0
  const totalFrames = Math.max(1, Math.ceil(FPS * durationSec));
  return new Promise((resolve, reject) => {
    ffmpeg(imagePath)
      .videoFilter([
        `loop=${totalFrames - 1}:1:0`,
        `fps=${FPS}`,
        `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
        'setsar=1',
        'format=yuv420p',
      ])
      .outputOptions([
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-an',
        '-t', String(durationSec),
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
}

/** Concatenate per-slide MP4 segments + full audio WAV into final output. */
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
  const segmentPaths: string[] = [];

  // Step 1: Create individual video segments
  for (let i = 0; i < slidePngPaths.length; i++) {
    const segPath = join(workDir, `segment-${i}.mp4`);
    await createSlideSegment(slidePngPaths[i], durationsSec[i], segPath);
    segmentPaths.push(segPath);
  }

  // Step 2: Concatenate all video segments using concat demuxer
  const silentVideoPath = join(workDir, 'silent-video.mp4');
  const concatListPath = join(workDir, 'video-concat.txt');
  const concatLines = segmentPaths.map((p) => {
    const posix = p.replace(/\\/g, '/');
    return `file '${posix.replace(/'/g, `'\\''`)}'`;
  });
  await writeFile(concatListPath, concatLines.join('\n'), 'utf-8');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(silentVideoPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });

  // Step 3: Mux concatenated video + full audio
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(silentVideoPath)
      .input(audioWavPath)
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ac', '1',
        '-shortest',
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
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
