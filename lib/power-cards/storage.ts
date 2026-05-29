import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'book-images';

  if (!url) throw new Error('Missing SUPABASE_URL for Power Card storage.');
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for Power Card storage.');

  return { url, serviceRoleKey, bucket };
}

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const { url, serviceRoleKey } = getSupabaseEnv();
    supabaseClient = createClient(url, serviceRoleKey);
  }
  return supabaseClient;
}

export type PowerCardExportFormat = 'pdf' | 'png';

function cacheKey(orderId: string, format: PowerCardExportFormat): string {
  return `power-cards/${orderId}.${format}`;
}

function contentTypeForFormat(format: PowerCardExportFormat): string {
  return format === 'pdf' ? 'application/pdf' : 'image/png';
}

export async function getCachedPowerCardExport(
  orderId: string,
  format: PowerCardExportFormat
): Promise<Buffer | null> {
  const { bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();
  const key = cacheKey(orderId, format);

  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error || !data) return null;

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.length > 0 ? buffer : null;
}

export async function putCachedPowerCardExport(
  orderId: string,
  format: PowerCardExportFormat,
  buffer: Buffer
): Promise<void> {
  if (!buffer.length) throw new Error('Cannot cache empty Power Card export buffer.');

  const { bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();
  const key = cacheKey(orderId, format);

  const uploadResult = await supabase.storage.from(bucket).upload(key, buffer, {
    contentType: contentTypeForFormat(format),
    upsert: true,
    cacheControl: '31536000',
  });

  if (uploadResult.error) {
    throw new Error(`Power Card cache upload failed: ${uploadResult.error.message}`);
  }
}
