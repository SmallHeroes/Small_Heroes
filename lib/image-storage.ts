import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

function sanitizeAssetPathSegment(assetPath: string): string {
  return String(assetPath)
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-');
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
  const supabase = getSupabaseClient();
  const ext = extensionFromContentType(contentType);
  const safePath = sanitizeAssetPathSegment(input.assetPath);
  const orderFolder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key = `${orderFolder}/${safePath}-${Date.now()}.${ext}`;

  const uploadResult = await supabase.storage.from(bucket).upload(key, fileBuffer, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  });

  if (uploadResult.error) {
    throw new Error(`Supabase upload failed: ${uploadResult.error.message}`);
  }

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
  const supabase = getSupabaseClient();

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

  const uploadResult = await supabase.storage
    .from(bucket)
    .upload(key, fileBuffer, {
      contentType,
      upsert: true,
      cacheControl: '31536000',
    });

  if (uploadResult.error) {
    throw new Error(`Supabase upload failed: ${uploadResult.error.message}`);
  }

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
  const supabase = getSupabaseClient();

  const contentType = input.contentType || 'image/png';
  const ext = extensionFromContentType(contentType);
  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key =
    input.assetType === 'cover'
      ? `${folder}/cover/cover-${Date.now()}.${ext}`
      : `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-${Date.now()}.${ext}`;

  const uploadResult = await supabase.storage.from(bucket).upload(key, input.buffer, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  });

  if (uploadResult.error) {
    throw new Error(`Supabase buffer upload failed: ${uploadResult.error.message}`);
  }

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
  const supabase = getSupabaseClient();
  const safeSub = sanitizeAssetPathSegment(input.subpath);
  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key = `${folder}/${safeSub}`;

  const uploadResult = await supabase.storage.from(bucket).upload(key, input.buffer, {
    contentType: input.contentType,
    upsert: true,
    cacheControl: '31536000',
  });

  if (uploadResult.error) {
    throw new Error(`Supabase upload failed (${key}): ${uploadResult.error.message}`);
  }

  return buildPublicUrl(url, bucket, key);
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
  const supabase = getSupabaseClient();
  const ext = extensionFromContentType(normalized);
  const key = `wizard/char-photos/${Date.now()}-${randomUUID().slice(0, 10)}.${ext}`;
  const uploadResult = await supabase.storage.from(bucket).upload(key, params.buffer, {
    contentType: normalized,
    upsert: true,
    cacheControl: '31536000',
  });
  if (uploadResult.error) {
    throw new Error(`Supabase upload failed: ${uploadResult.error.message}`);
  }
  return buildPublicUrl(url, bucket, key);
}

