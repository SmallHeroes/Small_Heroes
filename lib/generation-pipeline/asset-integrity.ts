/**
 * Phase-1 base_book_integrity — safe asset inspection. Downloads a stored image (SSRF-safe: HTTPS +
 * Supabase host/bucket allowlist, no redirects, timeout, byte cap), decodes it (real raster image via
 * sharp → format + dimensions), and hashes it (SHA-256). Used by the integrity gate, which records the
 * result in the IMMUTABLE Manifest evidence (ImageAsset rows are mutable and must not be trusted).
 */
import { createHash } from 'crypto';
import sharp from 'sharp';

export interface AssetInspection {
  ok: boolean;
  bytes: number;
  format: string | null; // sharp format, e.g. 'png' | 'jpeg' | 'webp'
  mime: string | null; // e.g. 'image/png'
  width: number | null;
  height: number | null;
  sha256: string | null;
  error?: string;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB hard cap (enforced WHILE streaming, not after)
const MAX_PIXELS = 30 * 1024 * 1024; // ~30 MP decompression-bomb guard (book pages are ~1.5 MP)
const TIMEOUT_MS = 15_000;
const RASTER_FORMATS = new Set(['png', 'jpeg', 'jpg', 'webp', 'avif', 'gif', 'tiff']);

function supabaseHostAndBucket(): { host: string; bucketPrefix: string } | null {
  const raw = process.env.SUPABASE_URL?.trim();
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(raw).host;
  } catch {
    return null;
  }
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'book-images';
  return { host, bucketPrefix: `/storage/v1/object/public/${bucket}/` };
}

/** Allow ONLY https URLs on the configured Supabase host under the public bucket path. */
export function isAllowedAssetUrl(url: string | null | undefined): boolean {
  const u = (url ?? '').trim();
  if (!u) return false;
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const allow = supabaseHostAndBucket();
  if (!allow) return false;
  return parsed.host === allow.host && parsed.pathname.startsWith(allow.bucketPrefix);
}

function mimeForFormat(format: string | null | undefined): string | null {
  if (!format) return null;
  const f = format === 'jpg' ? 'jpeg' : format;
  return RASTER_FORMATS.has(format) ? `image/${f}` : null;
}

/** Read a fetch body stream, aborting as soon as it exceeds the byte cap (never buffer-all-then-check). */
async function readCapped(res: Response, controller: AbortController, maxBytes: number): Promise<Buffer | 'too_large'> {
  if (!res.body) return Buffer.from(await res.arrayBuffer()); // fallback for runtimes without a stream body
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      controller.abort();
      try { await reader.cancel(); } catch { /* ignore */ }
      return 'too_large';
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)), total);
}

/**
 * Download + FULLY DECODE + hash a stored asset. Never throws — failures return ok:false with a reason.
 * Hardened (B7): the byte cap is enforced WHILE streaming (mid-transfer abort), the image is fully decoded
 * (sharp().stats() touches every pixel — a header-valid-but-corrupt file fails), and a pixel cap guards
 * against decompression bombs. The SHA is over the EXACT bytes, so any re-render changes the hash.
 */
export async function inspectAsset(
  url: string | null | undefined,
  opts: { maxBytes?: number; maxPixels?: number } = {},
): Promise<AssetInspection> {
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  const maxPixels = opts.maxPixels ?? MAX_PIXELS;
  const empty: AssetInspection = { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null };
  if (!isAllowedAssetUrl(url)) return { ...empty, error: 'url_not_allowlisted' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url as string, { redirect: 'error', signal: controller.signal });
    if (!res.ok) return { ...empty, error: `http_${res.status}` };
    const contentLength = Number(res.headers.get('content-length') ?? '0');
    if (contentLength && contentLength > maxBytes) return { ...empty, error: 'too_large' };

    const read = await readCapped(res, controller, maxBytes);
    if (read === 'too_large') return { ...empty, error: 'too_large' };
    const buf = read;
    if (buf.byteLength === 0) return { ...empty, error: 'empty_body' };

    const sha256 = createHash('sha256').update(buf).digest('hex');
    let meta: sharp.Metadata;
    try {
      meta = await sharp(buf, { limitInputPixels: maxPixels, failOn: 'error' }).metadata();
      // FULL decode proof: stats() reads every pixel, so corrupt pixel data fails even when the header parsed.
      await sharp(buf, { limitInputPixels: maxPixels, failOn: 'error' }).stats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const error = /limitInputPixels|pixel|exceeds/i.test(msg) ? 'pixel_limit' : 'not_decodable';
      return { ok: false, bytes: buf.byteLength, format: null, mime: null, width: null, height: null, sha256, error };
    }
    const mime = mimeForFormat(meta.format);
    const ok = !!mime && (meta.width ?? 0) > 0 && (meta.height ?? 0) > 0;
    return {
      ok,
      bytes: buf.byteLength,
      format: meta.format ?? null,
      mime,
      width: meta.width ?? null,
      height: meta.height ?? null,
      sha256,
      error: ok ? undefined : 'not_an_image',
    };
  } catch (e) {
    const error = e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'fetch_failed';
    return { ...empty, error };
  } finally {
    clearTimeout(timer);
  }
}
