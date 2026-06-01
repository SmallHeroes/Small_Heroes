import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

/** User-facing error when a parent photo cannot be processed. */
export class ChildPhotoUploadError extends Error {
  constructor(
    message = 'Please upload another photo — we could not read this image. Try JPG or PNG.'
  ) {
    super(message);
    this.name = 'ChildPhotoUploadError';
  }
}

const MAX_EDGE_PX = 1536;
const JPEG_QUALITY = 85;

function isHeicFormat(format: string | undefined): boolean {
  if (!format) return false;
  const f = format.toLowerCase();
  return f === 'heif' || f === 'heic' || f === 'heif-sequence';
}

/**
 * Normalize phone uploads: EXIF orient, downscale, JPEG q85. JPEG/PNG/WebP only.
 * HEIC is not supported in this PR (no extra native dep).
 */
export async function normalizeChildPhotoBuffer(input: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  try {
    const meta = await sharp(input).metadata();
    if (isHeicFormat(meta.format)) {
      throw new ChildPhotoUploadError(
        'This photo format (HEIC) is not supported yet. Please save as JPG or PNG and try again.'
      );
    }
    return await sharp(input)
      .rotate()
      .resize(MAX_EDGE_PX, MAX_EDGE_PX, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    if (err instanceof ChildPhotoUploadError) throw err;
    throw new ChildPhotoUploadError();
  }
}

export function childPhotoBufferToDataUrl(buffer: Buffer): string {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

export async function readAndNormalizeChildPhotoFile(filePath: string): Promise<string> {
  const trimmed = filePath.trim();
  if (!existsSync(trimmed)) {
    throw new ChildPhotoUploadError('Photo file not found. Please upload another image.');
  }
  const raw = await readFile(trimmed);
  const normalized = await normalizeChildPhotoBuffer(raw);
  return childPhotoBufferToDataUrl(normalized);
}

async function normalizeDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:image\/[\w+.-]+;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw new ChildPhotoUploadError();
  const raw = Buffer.from(match[1], 'base64');
  const normalized = await normalizeChildPhotoBuffer(raw);
  return childPhotoBufferToDataUrl(normalized);
}

async function normalizeHttpPhotoUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ChildPhotoUploadError(
      'We could not load your photo. Please upload another image (JPG or PNG).'
    );
  }
  const raw = Buffer.from(await res.arrayBuffer());
  const normalized = await normalizeChildPhotoBuffer(raw);
  return childPhotoBufferToDataUrl(normalized);
}

/**
 * Returns a normalized data URL suitable for Vision APIs and gpt-image refs.
 */
export async function normalizePhotoUrlForVision(photoUrl: string): Promise<string> {
  const trimmed = photoUrl.trim();
  if (!trimmed) throw new ChildPhotoUploadError();

  if (trimmed.startsWith('data:image/')) {
    return normalizeDataUrl(trimmed);
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return normalizeHttpPhotoUrl(trimmed);
  }

  if (existsSync(trimmed)) {
    return readAndNormalizeChildPhotoFile(trimmed);
  }

  const publicAbs = path.join(process.cwd(), 'public', trimmed.replace(/^\//, ''));
  if (existsSync(publicAbs)) {
    return readAndNormalizeChildPhotoFile(publicAbs);
  }

  throw new ChildPhotoUploadError();
}

/** Normalize any reference image buffer before OpenAI images.edit (silent). */
export async function normalizeReferenceImageBuffer(
  buffer: Buffer,
  indexHint?: number
): Promise<{ buffer: Buffer; ext: 'jpg'; mime: 'image/jpeg' }> {
  try {
    const out = await normalizeChildPhotoBuffer(buffer);
    if (indexHint != null && out.length < buffer.length) {
      console.info(
        `[GPTImage] Normalized reference #${indexHint}: ${Math.round(buffer.length / 1024)}KB → ${Math.round(out.length / 1024)}KB`
      );
    }
    return { buffer: out, ext: 'jpg', mime: 'image/jpeg' };
  } catch (err) {
    if (err instanceof ChildPhotoUploadError) throw err;
    throw new ChildPhotoUploadError();
  }
}
