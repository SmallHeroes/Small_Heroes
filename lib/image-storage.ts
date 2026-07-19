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
  /**
   * (Set Identity Board, P0-4a) Send `x-upsert:false` so the storage gateway REFUSES to replace an existing
   * object at this key (409 Duplicate) instead of silently swapping its bytes. ADDITIVE + opt-in: omitted /
   * false → `x-upsert:true` exactly as before, so every pre-existing caller is byte-identical.
   *
   * Safe to combine with the HEAD-recovery net below ONLY for CONTENT-ADDRESSED keys: there, "the object is
   * already present at this key" means "the same bytes are already stored", so recovering a hung-but-stored
   * POST is still correct. Do NOT set this on a mutable key.
   */
  noOverwrite?: boolean;
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
          // Default 'true' (unchanged for every legacy caller); board uploads opt into no-overwrite.
          'x-upsert': params.noOverwrite ? 'false' : 'true',
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
 * (Set Identity Board, Milestone C) The public url for an ARBITRARY durable storage key — i.e. for an object this
 * process did not upload and therefore has no `{url, storageKey}` descriptor for. Purely additive read helper:
 * it wraps the same private `buildPublicUrl` every uploader already returns, so a resolved board url can never
 * drift from an uploaded one. Throws only when the storage env is missing (the caller fails closed on that).
 */
export function resolveStoragePublicUrl(storageKey: string): string {
  const { url, bucket } = getSupabaseEnv();
  return buildPublicUrl(url, bucket, storageKey);
}

/**
 * (Set Identity Board, Milestone C) Download the raw bytes at a durable storage key, or null when the object is
 * absent/unreadable. Additive counterpart to `downloadOrderArtifactJson` for non-JSON, non-order-scoped objects
 * (an approved board is GLOBAL — shared across orders — so it has no orderId to key on).
 */
export async function downloadStorageObjectBytes(storageKey: string): Promise<Buffer | null> {
  const { bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).download(storageKey);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * (Set Identity Board, P0-4a) The ONLY sanctioned way to persist board bytes: a CONTENT-ADDRESSED key uploaded
 * with NO-OVERWRITE semantics.
 *
 * WHY THIS EXISTS (the P0-4a hole): every other uploader here sends `x-upsert:true`, so an object can be REPLACED
 * under a URL that an approved registry entry already points at — swapping the bytes behind a human approval
 * without changing anything the binder checks. Two properties close that:
 *   (a) the key EMBEDS the asset sha256 (asserted below), so different bytes are physically a different object at
 *       a different key — a swap cannot be addressed by the approved key at all; and
 *   (b) the write is `x-upsert:false`, so even a same-key write cannot clobber.
 *
 * Idempotent on purpose: a re-run of the mint tool with the SAME bytes finds the object already present, verifies
 * its sha, and returns `alreadyPresent:true` rather than failing. A key that exists with DIFFERENT bytes is a
 * sha256 collision or a corrupted object — it throws rather than proceed.
 *
 * ADDITIVE: no existing caller of this module is touched; nothing here changes upsert behaviour for page/cover/
 * reference uploads.
 */
export async function uploadContentAddressedObjectNoOverwrite(input: {
  /** Must already embed `expectedSha256` — build it with `setIdentityBoardStorageKey`, never by hand. */
  key: string;
  buffer: Buffer;
  contentType: string;
  /** sha256 (hex) of `buffer` as computed by the caller — re-derived and cross-checked here. */
  expectedSha256: string;
}): Promise<{ url: string; storageKey: string; alreadyPresent: boolean }> {
  const { url, bucket } = getSupabaseEnv();

  const actualSha256 = createHash('sha256').update(input.buffer).digest('hex');
  if (actualSha256 !== input.expectedSha256) {
    throw new Error(
      `uploadContentAddressedObjectNoOverwrite: buffer sha256 "${actualSha256}" does not match ` +
        `expectedSha256 "${input.expectedSha256}"`
    );
  }
  // The content-addressing invariant, enforced rather than trusted: if the sha is not in the key, the key is
  // mutable and every guarantee above evaporates.
  if (!input.key.includes(input.expectedSha256)) {
    throw new Error(
      `uploadContentAddressedObjectNoOverwrite: key "${input.key}" is not content-addressed ` +
        `(it does not embed sha256 "${input.expectedSha256}")`
    );
  }

  const existing = await downloadStorageObjectBytes(input.key);
  if (existing) {
    const existingSha256 = createHash('sha256').update(existing).digest('hex');
    if (existingSha256 !== input.expectedSha256) {
      throw new Error(
        `uploadContentAddressedObjectNoOverwrite: refusing to overwrite "${input.key}" — it already holds ` +
          `different bytes (stored sha256 "${existingSha256}", incoming "${input.expectedSha256}")`
      );
    }
    storageEvent('content_addressed_upload_noop', { key: input.key, reason: 'identical_bytes_present' });
    return { url: buildPublicUrl(url, bucket, input.key), storageKey: input.key, alreadyPresent: true };
  }

  await uploadToSupabaseWithRetry({
    bucket,
    key: input.key,
    body: input.buffer,
    contentType: input.contentType,
    errorPrefix: `Supabase content-addressed upload failed (${input.key})`,
    noOverwrite: true,
  });

  return { url: buildPublicUrl(url, bucket, input.key), storageKey: input.key, alreadyPresent: false };
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

// ── (Track-4 Unit 1) Private child-photo storage + signed-URL-at-use-time infrastructure ────────────────────────────
// The child SOURCE photo is categorically more sensitive than a rendered page; it belongs in a PRIVATE bucket, is
// persisted as a KEY (never a durable public URL), and is resolved to a SHORT-LIVED signed URL only at use time. These
// primitives are the foundation for that cutover (the write/read migration is staged — see BRIDGE/Unit-1 report).

/** The private bucket that holds child SOURCE photos. MUST be created with public=false + service-role-only access. */
export function getPrivateChildPhotoBucket(): string {
  return process.env.SUPABASE_PRIVATE_STORAGE_BUCKET?.trim() || 'child-photos-private';
}

/** A bare storage key (private-bucket reference) vs. a legacy public URL / an inline data: URL. Pure. */
export function isBareStorageKey(ref: string | null | undefined): boolean {
  const r = (ref ?? '').trim();
  if (!r) return false;
  return !r.startsWith('data:') && !/^https?:\/\//i.test(r);
}

/** Upload a child SOURCE photo to the PRIVATE bucket and return its storage KEY (never a public URL). */
export async function storeChildPhotoToPrivateBucket(params: {
  buffer: Buffer;
  contentType: string;
  /** Optional explicit key; defaults to the wizard/char-photos prefix so the existing deletion/audit patterns match. */
  key?: string;
}): Promise<string> {
  const mime = params.contentType.split(';')[0].trim().toLowerCase();
  const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime;
  if (!WIZARD_CHARACTER_UPLOAD_TYPES.has(normalized)) throw new Error('Unsupported image type.');
  if (params.buffer.length > MAX_WIZARD_CHARACTER_UPLOAD_BYTES) throw new Error('Image exceeds size limit.');
  const key = params.key ?? `wizard/char-photos/${Date.now()}-${randomUUID().slice(0, 10)}.${extensionFromContentType(normalized)}`;
  await uploadToSupabaseWithRetry({
    bucket: getPrivateChildPhotoBucket(),
    key,
    body: params.buffer,
    contentType: normalized,
    errorPrefix: 'Supabase private child-photo upload failed',
  });
  return key; // a KEY, not a URL — a URL in the DB is a durable public handle; a key is not.
}

/** Default use-time signed-URL TTL: short, yet comfortably outlives a single render (~50s) + provider round-trips. */
export const CHILD_PHOTO_SIGNED_URL_TTL_SECONDS = 600;

/** Sign a private child-photo storage KEY into a short-lived fetchable URL. Generated at use time, never persisted. */
export async function createSignedChildPhotoUrl(key: string, expiresInSeconds = CHILD_PHOTO_SIGNED_URL_TTL_SECONDS): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(getPrivateChildPhotoBucket()).createSignedUrl(key, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error(`Failed to sign child-photo key "${key}": ${error?.message ?? 'no signedUrl'}`);
  return data.signedUrl;
}

/**
 * Resolve a persisted child-photo reference to a FETCHABLE url at use time. Backward compatible so the cutover is safe:
 *   - a data: URL            → returned as-is (already inline);
 *   - a legacy public http(s) URL → returned as-is (old orders keep working);
 *   - a bare private-bucket KEY   → a fresh short-lived SIGNED URL (never persisted).
 */
export async function toFetchableChildPhotoReference(
  ref: string | null | undefined,
  expiresInSeconds = CHILD_PHOTO_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const r = (ref ?? '').trim();
  if (!r) return null;
  if (!isBareStorageKey(r)) return r; // data: or legacy public URL
  return createSignedChildPhotoUrl(r, expiresInSeconds);
}

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

