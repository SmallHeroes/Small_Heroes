import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'book-images';

  if (!url) {
    throw new Error('Missing SUPABASE_URL for PDF storage.');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for PDF storage.');
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

export async function uploadPdfToStorage(orderId: string, pdfBuffer: Buffer): Promise<string> {
  if (!orderId) throw new Error('orderId is required for PDF upload.');
  if (!pdfBuffer || pdfBuffer.length === 0) throw new Error('pdfBuffer is empty.');

  const { url, bucket } = getSupabaseEnv();
  const supabase = getSupabaseClient();
  const key = `orders/${orderId}/pdf/book-${Date.now()}.pdf`;

  const uploadResult = await supabase.storage.from(bucket).upload(key, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
    cacheControl: '31536000',
  });

  if (uploadResult.error) {
    throw new Error(`Supabase PDF upload failed: ${uploadResult.error.message}`);
  }

  return buildPublicUrl(url, bucket, key);
}
