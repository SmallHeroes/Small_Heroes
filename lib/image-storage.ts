import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { withRetry } from '@/lib/retry';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'book-images';

  if (!url) {
    throw new Error('Missing SUPABASE_URL for image storage.');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for image storage.');
  }

  return { url, serviceRoleKey, bucket };
}

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const { url, serviceRoleKey } = getSupabaseEnv();
    supabaseClient = createClient(url, serviceRoleKey);
  }
  return supabaseClient;
}

function buildPublicUrl(url: string, bucket: string, key: string): string {
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${key}`;
}

/** HEAD the public object URL — returns true if the object is actually stored. */
async function supabaseObjectExists(url: string, bucket: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(buildPublicUrl(url, bucket, key), {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Upload a buffer to Supabase Storage, hardened for the Vercel serverless runtime.
 *
 * ROOT CAUSE (2026-06-23, pinned from Supabase storage logs): the supabase-js `.upload()`
 * POST reaches Supabase and returns 200 + ObjectCreated on EVERY attempt — the object IS
 * stored — but inside the serverless function the client hangs handling the response for
 * the larger anchor PNG, hits the per-attempt timeout, retries (each re-uploading, 200
 * server-side, then ObjectAdminDelete from the next upsert), and the function never
 * observes success → the job fails although the asset exists. Smaller uploads (child
 * photo/refs) don't hang, so the run proceeds until the bigger anchor PNG. Plain
 * retry/backoff cannot help — every attempt "succeeds" remotely.
 *
 * Fix:
 *  (a) Bypass supabase-js with a direct REST POST. The body is a Node Buffer, so undici
 *      sends a real Content-Length (not chunked/streamed), and we FULLY drain the response
 *      body (`res.text()`) so the socket is released instead of left half-read.
 *  (b) Quick unblock / safety net: on ANY attempt error or timeout, HEAD-check the object —
 *      if it is present, treat the upload as successful rather than failing a render whose
 *      asset is actually stored. `x-upsert:true` keeps every retry idempotent.
 */
async function uploadToSupabaseWithRetry(params: {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
  /** Preserved error-message prefix per call site (kept stable for logs/tests). */
  errorPrefix: string;
}): Promise<void> {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const attempts = Math.max(1, Number.parseInt(process.env.SUPABASE_UPLOAD_MAX_ATTEMPTS ?? '4', 10) || 4);
  const timeoutMs = Math.max(1000, Number.parseInt(process.env.SUPABASE_UPLOAD_TIMEOUT_MS ?? '30000', 10) || 30000);
  const region = process.env.VERCEL_REGION || 'local'; // Supabase storage is us-east-1; note cross-region.
  const objectEndpoint = `${url.replace(/\/$/, '')}/storage/v1/object/${params.bucket}/${params.key}`;

  // A fixed-size Blob (not a stream) makes undici send a real Content-Length, not chunked.
  // Uint8Array.from yields a fresh ArrayBuffer-backed array (valid BlobPart; avoids the
  // Buffer/SharedArrayBuffer generic mismatch).
  const bodyBytes = Uint8Array.from(params.body);
  const bodyBlob = new Blob([bodyBytes], { type: params.contentType });

  const uploadOnceOrDetectStored = async (): Promise<void> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
      const res = await fetch(objectEndpoint, {
        method: 'POST',
        headers: {
          // Supabase's storage gateway needs BOTH the apikey AND the Authorization bearer —
          // both must be the service-role JWT (the same one getSupabaseClient/createClient uses).
          // Omitting `apikey` makes the gateway reject every write with 403 "Invalid Compact JWS".
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': params.contentType,
          'Content-Length': String(bodyBytes.byteLength),
          'cache-control': 'max-age=31536000',
          'x-upsert': 'true',
        },
        body: bodyBlob,
        signal: controller.signal,
      });
      // ALWAYS drain the response body so undici releases the socket (an un-drained body
      // on a pooled keep-alive connection is a prime serverless-hang source).
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`HTTP ${res.status}${text ? ` ${text.slice(0, 200)}` : ''}`);
      console.log(
        `[supabase-upload] ok key=${params.key} bytes=${params.body.length} status=${res.status} ` +
          `clen=${res.headers.get('content-length') ?? '?'} ms=${Date.now() - startedAt} region=${region}`
      );
    } catch (err) {
      // The POST may have stored the object before the client errored/timed out (the exact
      // serverless hang seen on 2026-06-23). If it's present, treat as success.
      if (await supabaseObjectExists(url, params.bucket, params.key)) {
        console.warn(
          `[supabase-upload] attempt errored (${(err as Error)?.message ?? 'unknown'}) after ` +
            `${Date.now() - startedAt}ms but object EXISTS — treating as success key=${params.key} bytes=${params.body.length}`
        );
        return;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    await withRetry(() => uploadOnceOrDetectStored(), {
      attempts,
      baseDelayMs: 500,
      factor: 3,
      label: 'supabase-upload',
    });
  } catch (err) {
    // Last safety net before failing the render: the object may have landed on a late retry.
    if (await supabaseObjectExists(url, params.bucket, params.key)) return;
    throw new Error(`${params.errorPrefix}: ${(err as Error)?.message ?? 'unknown'}`);
  }
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

/** Max size for a decoded data-URL image (aligned with wizard client limit). */
const MAX_DATA_URL_IMAGE_BYTES = 15 * 1024 * 1024;

const DATA_URL_IMAGE_RE =
  /^data:(image\/(?:jpeg|jpg|png|webp));base64,([\s\S]+)$/i;

export interface StoreDataUrlInput {
  dataUrl: string;
  orderId: string;
  /**
   * Path segment under `orders/{orderId}/` (e.g. `references/main-child`).
   * Sanitized; no leading slash.
   */
  assetPath: string;
}

/**
 * Sanitize a storage path/subpath. Allows `.` so file extensions survive (0096 M5c — previously `.png`
 * was mangled to `-png`, leaving objects with no real extension), while collapsing `..` so a built
 * subpath can never traverse out of its order folder. Exported for unit testing.
 */
export function sanitizeAssetPathSegment(assetPath: string): string {
  return String(assetPath)
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_.-]+/g, '-') // allow '.' so extensions are preserved
    .replace(/\.{2,}/g, '.'); // no parent-dir traversal ("..")
}

/**
 * Persists a browser `data:image/...;base64,...` to Supabase storage and
 * returns a stable public object URL. Used at order creation for wizard
 * reference photos; generation should consume these URLs, not raw data URLs.
 */
export async function storeImageFromDataUrl(input: StoreDataUrlInput): Promise<string> {
  const m = String(input.dataUrl).match(DATA_URL_IMAGE_RE);
  if (!m) {
    throw new Error('Invalid or unsupported image data URL (use JPEG, PNG, or WebP).');
  }
  const rawMime = m[1].toLowerCase();
  const contentType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  const b64 = m[2].replace(/\s/g, '');
  const fileBuffer = Buffer.from(b64, 'base64');
  if (fileBuffer.length === 0) {
    throw new Error('Empty image data in data URL.');
  }
  if (fileBuffer.length > MAX_DATA_URL_IMAGE_BYTES) {
    throw new Error('Image in data URL exceeds size limit.');
  }

  const { url, bucket } = getSupabaseEnv();
  const ext = extensionFromContentType(contentType);
  const safePath = sanitizeAssetPathSegment(input.assetPath);
  const orderFolder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key = `${orderFolder}/${safePath}-${Date.now()}.${ext}`;

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: fileBuffer,
    contentType,
    errorPrefix: 'Supabase upload failed',
  });

  return buildPublicUrl(url, bucket, key);
}

export interface StoreImageInput {
  providerUrl: string;
  orderId?: string;
  pageNumber: number;
  assetType?: 'page' | 'cover';
}

export async function storeImageFromProviderUrl(input: StoreImageInput): Promise<string> {
  const { url, bucket } = getSupabaseEnv();

  const downloadRes = await fetch(input.providerUrl);
  if (!downloadRes.ok) {
    throw new Error(`Failed downloading provider image: ${downloadRes.status}`);
  }

  const contentType = downloadRes.headers.get('content-type') || 'image/jpeg';
  const ext = extensionFromContentType(contentType);
  const bytes = await downloadRes.arrayBuffer();
  const fileBuffer = Buffer.from(bytes);

  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key =
    input.assetType === 'cover'
      ? `${folder}/cover/cover-${Date.now()}.${ext}`
      : `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-${Date.now()}.${ext}`;

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: fileBuffer,
    contentType,
    errorPrefix: 'Supabase upload failed',
  });

  return buildPublicUrl(url, bucket, key);
}

export interface StorePresentationInput {
  buffer: Buffer;
  orderId?: string;
  pageNumber: number;
}

export interface StoreBufferInput {
  buffer: Buffer;
  orderId?: string;
  pageNumber: number;
  assetType?: 'page' | 'cover';
  /** default: image/png */
  contentType?: string;
}

/** Persist a PNG (or other) buffer from providers that return base64 (e.g. GPT Image). */
export async function storeImageFromBuffer(input: StoreBufferInput): Promise<string> {
  const { url, bucket } = getSupabaseEnv();

  const contentType = input.contentType || 'image/png';
  const ext = extensionFromContentType(contentType);
  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key =
    input.assetType === 'cover'
      ? `${folder}/cover/cover-${Date.now()}.${ext}`
      : `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-${Date.now()}.${ext}`;

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: input.buffer,
    contentType,
    errorPrefix: 'Supabase buffer upload failed',
  });

  return buildPublicUrl(url, bucket, key);
}

/** Upload a processed WebP page illustration (reader / future PDF). */
/**
 * Upload any binary under `orders/{orderId}/...` — used for print upscale assets, manifests, etc.
 */
export async function uploadOrderSubpathAsset(input: {
  orderId: string;
  /** Path under the order folder, e.g. `print-upscale/page-007.png`. Sanitized internally. */
  subpath: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  if (!input.orderId) throw new Error('uploadOrderSubpathAsset: orderId is required.');
  const { url, bucket } = getSupabaseEnv();
  const safeSub = sanitizeAssetPathSegment(input.subpath);
  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key = `${folder}/${safeSub}`;

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: input.buffer,
    contentType: input.contentType,
    errorPrefix: `Supabase upload failed (${key})`,
  });

  return buildPublicUrl(url, bucket, key);
}

export interface UploadOrderArtifactInput {
  orderId: string;
  /** Logical artifact bucket under the order folder, e.g. `set-appearance-boards` or `debug`. */
  kind: string;
  /** File name (may contain subpath segments), e.g. `scene_bedroom/board.png`. Sanitized internally. */
  filename: string;
  buffer: Buffer;
  contentType: string;
}

/**
 * Low-level durable-artifact upload that returns BOTH the public URL and the storage key.
 * Used by RuntimeArtifactStore so callers can persist a descriptor `{url, storageKey}` in
 * pipelineCache. Stores under `orders/{orderId}/{kind}/{filename}`.
 */
export async function uploadOrderArtifact(
  input: UploadOrderArtifactInput
): Promise<{ url: string; storageKey: string }> {
  if (!input.orderId) throw new Error('uploadOrderArtifact: orderId is required.');
  const { url, bucket } = getSupabaseEnv();
  const key = orderArtifactStorageKey(input.orderId, input.kind, input.filename);

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: input.buffer,
    contentType: input.contentType,
    errorPrefix: `Supabase artifact upload failed (${key})`,
  });

  return { url: buildPublicUrl(url, bucket, key), storageKey: key };
}

/** Deterministic storage key for an order artifact: `orders/{orderId}/{kind}/{filename}`. */
export function orderArtifactStorageKey(orderId: string, kind: string, filename: string): string {
  return `orders/${orderId}/${sanitizeAssetPathSegment(kind)}/${sanitizeAssetPathSegment(filename)}`;
}

/**
 * Download + parse a durable JSON artifact previously written via `uploadOrderArtifact`/`persistJson`
 * (same `{orderId, kind, filename}` key). Returns null if absent or unparseable. Used by the dev
 * QA flow to read state that must survive across serverless invocations (0096 M5a).
 */
export async function downloadOrderArtifactJson<T = unknown>(input: {
  orderId: string;
  kind: string;
  filename: string;
}): Promise<T | null> {
  const { bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();
  const key = orderArtifactStorageKey(input.orderId, input.kind, input.filename);
  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

/**
 * List the immediate children (files + sub-folders) of a storage prefix. Used by the dev QA viewer to
 * enumerate cloud-persisted auditions (0096 M5b). Returns `{ name, updatedAt }`; folders have no updatedAt.
 */
export async function listStorageFolder(
  prefix: string
): Promise<{ name: string; updatedAt?: string }[]> {
  const { bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  return data.map((o) => ({
    name: o.name,
    updatedAt: (o as { updated_at?: string }).updated_at,
  }));
}

export async function storePresentationBuffer(input: StorePresentationInput): Promise<string> {
  const { url, bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();

  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key = `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-present-${Date.now()}.webp`;

  const uploadResult = await supabase.storage.from(bucket).upload(key, input.buffer, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '31536000',
  });

  if (uploadResult.error) {
    throw new Error(`Supabase presentation upload failed: ${uploadResult.error.message}`);
  }

  return buildPublicUrl(url, bucket, key);
}

const MAX_WIZARD_CHARACTER_UPLOAD_BYTES = 15 * 1024 * 1024;
const WIZARD_CHARACTER_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Immediate wizard upload for reference photos (URLs fit in sessionStorage). */
export async function storeWizardCharacterPhotoUpload(params: {
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const mime = params.contentType.split(';')[0].trim().toLowerCase();
  const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime;
  if (!WIZARD_CHARACTER_UPLOAD_TYPES.has(normalized)) {
    throw new Error('Unsupported image type.');
  }
  if (params.buffer.length > MAX_WIZARD_CHARACTER_UPLOAD_BYTES) {
    throw new Error('Image exceeds size limit.');
  }
  const { url, bucket } = getSupabaseEnv();
  const ext = extensionFromContentType(normalized);
  const key = `wizard/char-photos/${Date.now()}-${randomUUID().slice(0, 10)}.${ext}`;
  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: params.buffer,
    contentType: normalized,
    errorPrefix: 'Supabase upload failed',
  });
  return buildPublicUrl(url, bucket, key);
}

