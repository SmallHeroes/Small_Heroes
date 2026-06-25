import { createHash, randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { withRetry } from '@/lib/retry';

let supabaseClient: SupabaseClient | null = null;

/**
 * Thrown when image generation SUCCEEDED but persistence (Supabase upload) failed after the full
 * retry budget + HEAD-net. The render loop catches this to AVOID re-running GPT (an upload problem
 * is not fixed by spending another image generation). See backend/providers/image.ts.
 */
export class ImagePersistenceError extends Error {
  readonly isPersistenceError = true as const;
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ImagePersistenceError';
  }
}

export function isImagePersistenceError(e: unknown): e is ImagePersistenceError {
  return e instanceof ImagePersistenceError || (e as { isPersistenceError?: boolean })?.isPersistenceError === true;
}

/** Short, greppable structured log for the storage/persist pipeline. */
function storageEvent(event: string, fields: Record<string, unknown> = {}): void {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  console.log(`[storage] ${event}${parts.length ? ` ${parts.join(' ')}` : ''}`);
}

/** Content-hash (first 16 hex) — deterministic key per buffer → idempotent uploads + HEAD detect. */
function bufferHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

/**
 * Persistence retry budget for render-path image buffers — LONGER than the default upload budget so a
 * transient Supabase abort is absorbed by upload retries instead of bubbling up and triggering an
 * expensive GPT regenerate. Env-overridable.
 *
 * Bounded so the WORST-CASE cumulative persist time (attempts × timeout + backoff) stays well under
 * the 300s Vercel function ceiling — the old 8×45s=360s budget could itself outlive the function and
 * get the render killed mid-persist. The head-recovery exists-check (upload_recovered_by_head) means
 * an exhausted attempt whose object actually stored is still recovered, so fewer attempts is safe.
 */
function persistAttempts(): number {
  return Math.max(1, Number.parseInt(process.env.SUPABASE_PERSIST_MAX_ATTEMPTS ?? '5', 10) || 5);
}
function persistTimeoutMs(): number {
  return Math.max(1000, Number.parseInt(process.env.SUPABASE_PERSIST_TIMEOUT_MS ?? '20000', 10) || 20000);
}

/**
 * Anchor persist budget — the SUPABASE_PERSIST_* contract (not the generic SUPABASE_UPLOAD_* path)
 * with an anchor-specific per-attempt timeout. The Stage-0 child anchor is a single critical upload
 * (the whole render gates on it), so it gets a longer per-attempt window than ordinary uploads.
 * Attempts default to a bounded 5 so the WORST case (attempts × timeout) stays under the 300s
 * function ceiling; the deadline gate in Stage 0 only STARTS an attempt it can finish.
 */
function anchorPersistAttempts(): number {
  const raw = process.env.ANCHOR_PERSIST_MAX_ATTEMPTS ?? process.env.SUPABASE_PERSIST_MAX_ATTEMPTS ?? '5';
  return Math.max(1, Number.parseInt(raw, 10) || 5);
}
function anchorPersistTimeoutMs(): number {
  return Math.max(1000, Number.parseInt(process.env.ANCHOR_PERSIST_TIMEOUT_MS ?? '45000', 10) || 45000);
}

/** Supabase project ref from the storage URL host (`https://<ref>.supabase.co` → `<ref>`). */
export function supabaseProjectRefFromUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl) return 'unknown';
  try {
    const host = new URL(rawUrl).host;
    const ref = host.split('.')[0];
    return ref || 'unknown';
  } catch {
    return 'unknown';
  }
}

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
  // Retry the HEAD a couple of times: a transient timeout/abort on the existence check
  // ITSELF ("This operation was aborted") must not produce a false-negative that fails a
  // render whose object is actually stored. A definitive 404 short-circuits (truly absent).
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(buildPublicUrl(url, bucket, key), {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return true;
      if (res.status === 404) return false;
    } catch {
      // transient (timeout/abort/network) — fall through to one more attempt
    }
  }
  return false;
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
export async function uploadToSupabaseWithRetry(params: {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
  /** Preserved error-message prefix per call site (kept stable for logs/tests). */
  errorPrefix: string;
  /** Override the retry budget (render-path persistence uses a longer one). */
  attempts?: number;
  timeoutMs?: number;
}): Promise<void> {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const attempts =
    params.attempts ?? Math.max(1, Number.parseInt(process.env.SUPABASE_UPLOAD_MAX_ATTEMPTS ?? '4', 10) || 4);
  const timeoutMs =
    params.timeoutMs ?? Math.max(1000, Number.parseInt(process.env.SUPABASE_UPLOAD_TIMEOUT_MS ?? '30000', 10) || 30000);
  const region = process.env.VERCEL_REGION || 'local'; // Supabase storage is us-east-1; note cross-region.
  const objectEndpoint = `${url.replace(/\/$/, '')}/storage/v1/object/${params.bucket}/${params.key}`;

  // A fixed-size Blob (not a stream) makes undici send a real Content-Length, not chunked.
  // Uint8Array.from yields a fresh ArrayBuffer-backed array (valid BlobPart; avoids the
  // Buffer/SharedArrayBuffer generic mismatch).
  const bodyBytes = Uint8Array.from(params.body);
  const bodyBlob = new Blob([bodyBytes], { type: params.contentType });

  let attemptNo = 0;
  const uploadOnceOrDetectStored = async (): Promise<void> => {
    attemptNo += 1;
    storageEvent('upload_attempt', { key: params.key, attempt: attemptNo, of: attempts, bytes: params.body.length });
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
        storageEvent('upload_recovered_by_head', {
          key: params.key,
          attempt: attemptNo,
          afterMs: Date.now() - startedAt,
          err: (err as Error)?.message ?? 'unknown',
        });
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
    // Last safety net before failing: the object may have landed on a late retry.
    if (await supabaseObjectExists(url, params.bucket, params.key)) {
      storageEvent('upload_recovered_by_head', { key: params.key, attempt: attemptNo, finalNet: true });
      return;
    }
    // Persistence genuinely failed after the full budget + HEAD-net. Throw a TAGGED error so the
    // render loop does NOT re-run GPT for an upload problem (see ImagePersistenceError).
    throw new ImagePersistenceError(`${params.errorPrefix}: ${(err as Error)?.message ?? 'unknown'}`, err);
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

  // Image generation succeeded (provider URL downloaded) — from here it's pure persistence.
  storageEvent('gpt_image_success', {
    orderId: input.orderId,
    page: input.assetType === 'cover' ? 'cover' : input.pageNumber,
    bytes: fileBuffer.length,
  });

  // Content-hash key (no Date.now): the SAME image always maps to the SAME key, so the upload
  // HEAD-net detects an already-stored object across retries; a regenerated (different) image
  // gets a different key. Avoids the Date.now-on-retry blindspot.
  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const hash = bufferHash(fileBuffer);
  const key =
    input.assetType === 'cover'
      ? `${folder}/cover/cover-${hash}.${ext}`
      : `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-${hash}.${ext}`;

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: fileBuffer,
    contentType,
    errorPrefix: 'Supabase upload failed',
    attempts: persistAttempts(),
    timeoutMs: persistTimeoutMs(),
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

  // GPT returned a buffer — generation is DONE. Everything below is pure persistence; a failure
  // here must NOT cause a regenerate (uploadToSupabaseWithRetry throws ImagePersistenceError).
  storageEvent('gpt_image_success', {
    orderId: input.orderId,
    page: input.assetType === 'cover' ? 'cover' : input.pageNumber,
    bytes: input.buffer.length,
  });

  // Content-hash key (no Date.now) → deterministic per image → HEAD-net detects an already-stored
  // object across retries; a different (regenerated) image gets a different key.
  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const hash = bufferHash(input.buffer);
  const key =
    input.assetType === 'cover'
      ? `${folder}/cover/cover-${hash}.${ext}`
      : `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-${hash}.${ext}`;

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: input.buffer,
    contentType,
    errorPrefix: 'Supabase buffer upload failed',
    attempts: persistAttempts(),
    timeoutMs: persistTimeoutMs(),
  });

  return buildPublicUrl(url, bucket, key);
}

export interface StoreGeneratedAnchorInput {
  orderId: string;
  /** Attempt suffix, e.g. `a1` — becomes part of the deterministic key. */
  attemptSuffix: string;
  buffer: Buffer;
  /** default: image/png */
  contentType?: string;
}

/**
 * Persist a Stage-0 child-anchor buffer durably. This is the anchor_persist sub-stage, kept SEPARATE
 * from anchor_generate so a persistence failure never re-runs GPT.
 *
 *  - Deterministic CONTENT-HASH key `character-anchors/child-canonical-method-b-{attempt}-{hash}.png`
 *    (no Date.now): the same bytes always map to the same key, so the upload's HEAD-net detects an
 *    object that was actually stored even when the client hung handling the response (the 2026-06
 *    serverless hang) — the headline "stored but never observed → re-GPT loop" failure.
 *  - SUPABASE_PERSIST_* contract with an anchor-specific 45s per-attempt timeout (anchorPersist*()).
 *  - Throws a TAGGED ImagePersistenceError on genuine failure so the Stage-0 loop treats it as a
 *    persistence problem (retry the job / recover) and NEVER spends another GPT image.
 */
export async function storeGeneratedAnchorBuffer(
  input: StoreGeneratedAnchorInput
): Promise<{ url: string; storageKey: string }> {
  if (!input.orderId) throw new Error('storeGeneratedAnchorBuffer: orderId is required.');
  const { url, bucket } = getSupabaseEnv();
  const contentType = input.contentType || 'image/png';
  const ext = extensionFromContentType(contentType);
  const hash = bufferHash(input.buffer);
  const safeAttempt = sanitizeAssetPathSegment(input.attemptSuffix || 'a1');
  const key = `orders/${input.orderId}/character-anchors/child-canonical-method-b-${safeAttempt}-${hash}.${ext}`;

  // anchor_generate already succeeded (we hold the bytes) — everything here is pure persistence.
  storageEvent('anchor_persist_start', {
    orderId: input.orderId,
    attempt: safeAttempt,
    bytes: input.buffer.length,
    key,
  });

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: input.buffer,
    contentType,
    errorPrefix: `Supabase anchor upload failed (${key})`,
    attempts: anchorPersistAttempts(),
    timeoutMs: anchorPersistTimeoutMs(),
  });

  return { url: buildPublicUrl(url, bucket, key), storageKey: key };
}

export interface StorageLatencyProbe {
  ok: boolean;
  bytes: number;
  attempt: number;
  timeoutMs: number;
  durationMs: number;
  vercelRegion: string;
  supabaseProjectRef: string;
  status: number | null;
  headStatus: number | null;
}

/**
 * Synthetic Supabase storage latency probe — a small controlled upload + HEAD, timed and logged,
 * to SEPARATE infra degradation (Supabase/region slow right now) from a too-tight render budget.
 * Best-effort: it NEVER throws and never fails a render; it only emits a `storage_latency_probe`
 * log line and returns the measurement. Uses a fixed per-region key (upsert) so probe objects do
 * not accumulate.
 */
export async function probeSupabaseStorageLatency(params: {
  bytes?: number;
} = {}): Promise<StorageLatencyProbe> {
  const region = process.env.VERCEL_REGION || 'local';
  let supabaseUrl: string | undefined;
  let bucket = 'book-images';
  try {
    const env = getSupabaseEnv();
    supabaseUrl = env.url;
    bucket = env.bucket;
  } catch {
    // Missing creds — emit a no-op probe rather than throwing.
  }
  const projectRef = supabaseProjectRefFromUrl(supabaseUrl);
  const bytes = Math.max(1, params.bytes ?? 32 * 1024);
  const timeoutMs = Math.max(
    1000,
    Number.parseInt(process.env.STORAGE_PROBE_TIMEOUT_MS ?? '10000', 10) || 10000
  );

  const probe: StorageLatencyProbe = {
    ok: false,
    bytes,
    attempt: 1,
    timeoutMs,
    durationMs: 0,
    vercelRegion: region,
    supabaseProjectRef: projectRef,
    status: null,
    headStatus: null,
  };

  if (!supabaseUrl) {
    storageEvent('storage_latency_probe', { synthetic: true, ...probe, skipped: 'no_supabase_env' });
    return probe;
  }

  const { serviceRoleKey } = getSupabaseEnv();
  const key = `orders/_diagnostics/storage-latency-probe-${sanitizeAssetPathSegment(region)}.bin`;
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${key}`;
  const body = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes),
        'x-upsert': 'true',
      },
      body,
      signal: controller.signal,
    });
    await res.text().catch(() => '');
    probe.status = res.status;
    probe.durationMs = Date.now() - startedAt;
    // HEAD the object to capture the read-side status too.
    try {
      const head = await fetch(buildPublicUrl(supabaseUrl, bucket, key), {
        method: 'HEAD',
        signal: AbortSignal.timeout(timeoutMs),
      });
      probe.headStatus = head.status;
    } catch {
      probe.headStatus = null;
    }
    probe.ok = res.ok;
  } catch (err) {
    probe.durationMs = Date.now() - startedAt;
    storageEvent('storage_latency_probe', {
      synthetic: true,
      ...probe,
      error: (err as Error)?.message ?? 'unknown',
    });
    return probe;
  } finally {
    clearTimeout(timer);
  }

  storageEvent('storage_latency_probe', { synthetic: true, ...probe });
  return probe;
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

  // Content-hash key (no Date.now) + longer persist budget so a transient serverless abort on this
  // per-page upload is absorbed by retries and never bubbles into a regenerate (order cmqrsdi8).
  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const hash = bufferHash(input.buffer);
  const key = `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-present-${hash}.webp`;

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: input.buffer,
    contentType: 'image/webp',
    errorPrefix: 'Supabase presentation upload failed',
    attempts: persistAttempts(),
    timeoutMs: persistTimeoutMs(),
  });

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

