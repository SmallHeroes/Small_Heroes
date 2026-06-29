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

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB hard cap
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

/**
 * Download + decode + hash a stored asset. Never throws — failures return ok:false with a reason. The
 * SHA is over the EXACT bytes fetched, so any re-render that changes the asset changes the hash.
 */
export async function inspectAsset(url: string | null | undefined): Promise<AssetInspection> {
  const empty: AssetInspection = { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null };
  if (!isAllowedAssetUrl(url)) return { ...empty, error: 'url_not_allowlisted' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url as string, { redirect: 'error', signal: controller.signal });
    if (!res.ok) return { ...empty, error: `http_${res.status}` };
    const contentLength = Number(res.headers.get('content-length') ?? '0');
    if (contentLength && contentLength > MAX_BYTES) return { ...empty, error: 'too_large' };

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) return { ...empty, error: 'empty_body' };
    if (buf.byteLength > MAX_BYTES) return { ...empty, bytes: buf.byteLength, error: 'too_large' };

    const sha256 = createHash('sha256').update(buf).digest('hex');
    let meta: sharp.Metadata;
    try {
      meta = await sharp(buf, { failOn: 'error' }).metadata();
    } catch {
      return { ok: false, bytes: buf.byteLength, format: null, mime: null, width: null, height: null, sha256, error: 'not_decodable' };
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
