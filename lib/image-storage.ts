import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

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

export interface StoreDataUrlImageInput {
  dataUrl: string;
  orderId?: string;
  assetPath: string;
}

function parseDataUrlImage(dataUrl: string): { contentType: string; buffer: Buffer; ext: string } {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error('Invalid image data URL format');
  }

  const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const ext = extensionFromContentType(contentType);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw new Error('Image data is empty');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Image data exceeds 15MB limit');
  }
  return { contentType, buffer, ext };
}

export async function storeImageFromDataUrl(input: StoreDataUrlImageInput): Promise<string> {
  const { url, bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();
  const parsed = parseDataUrlImage(input.dataUrl);

  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const safeAssetPath = input.assetPath.replace(/[^a-zA-Z0-9/_-]/g, '');
  const key = `${folder}/${safeAssetPath}-${Date.now()}.${parsed.ext}`;

  const uploadResult = await supabase.storage
    .from(bucket)
    .upload(key, parsed.buffer, {
      contentType: parsed.contentType,
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

/** Upload a processed presentation PNG page illustration (reader / future PDF). */
export async function storePresentationBuffer(input: StorePresentationInput): Promise<string> {
  const { url, bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();

  const folder = input.orderId ? `orders/${input.orderId}` : 'orders/unknown';
  const key = `${folder}/pages/page-${String(input.pageNumber).padStart(3, '0')}-present-${Date.now()}.png`;

  const uploadResult = await supabase.storage.from(bucket).upload(key, input.buffer, {
    contentType: 'image/png',
    upsert: true,
    cacheControl: '31536000',
  });

  if (uploadResult.error) {
    throw new Error(`Supabase presentation upload failed: ${uploadResult.error.message}`);
  }

  return buildPublicUrl(url, bucket, key);
}

