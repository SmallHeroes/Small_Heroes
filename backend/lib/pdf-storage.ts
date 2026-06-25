import { uploadToSupabaseWithRetry } from '../../lib/image-storage';

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

function buildPublicUrl(url: string, bucket: string, key: string): string {
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${key}`;
}

export async function uploadPrintReadyArtifacts(
  orderId: string,
  pdfBuffer: Buffer,
  metadata: Record<string, unknown>
): Promise<{ pdfUrl: string; metadataUrl: string }> {
  if (!orderId) throw new Error('orderId is required for print-ready artifacts.');
  if (!pdfBuffer || pdfBuffer.length === 0) throw new Error('pdfBuffer is empty.');

  const { url, bucket } = getSupabaseEnv();
  const baseKey = `orders/${orderId}/pdf`;

  const metaBody = `${JSON.stringify(metadata, null, 2)}\n`;
  const metaBuffer = Buffer.from(metaBody, 'utf8');

  // Hardened direct-REST path (retry + drain + HEAD-net) instead of raw supabase-js .upload.
  await uploadToSupabaseWithRetry({
    bucket,
    key: `${baseKey}/print-ready.pdf`,
    body: pdfBuffer,
    contentType: 'application/pdf',
    errorPrefix: 'Supabase print-ready PDF upload failed',
  });
  await uploadToSupabaseWithRetry({
    bucket,
    key: `${baseKey}/print-ready-metadata.json`,
    body: metaBuffer,
    contentType: 'application/json',
    errorPrefix: 'Supabase print metadata upload failed',
  });

  return {
    pdfUrl: buildPublicUrl(url, bucket, `${baseKey}/print-ready.pdf`),
    metadataUrl: buildPublicUrl(url, bucket, `${baseKey}/print-ready-metadata.json`),
  };
}

/** Screen / legacy PDF naming (timestamped filename). */
export async function uploadPdfToStorage(orderId: string, pdfBuffer: Buffer): Promise<string> {
  if (!orderId) throw new Error('orderId is required for PDF upload.');
  if (!pdfBuffer || pdfBuffer.length === 0) throw new Error('pdfBuffer is empty.');

  const { url, bucket } = getSupabaseEnv();
  const key = `orders/${orderId}/pdf/book-${Date.now()}.pdf`;

  await uploadToSupabaseWithRetry({
    bucket,
    key,
    body: pdfBuffer,
    contentType: 'application/pdf',
    errorPrefix: 'Supabase PDF upload failed',
  });

  return buildPublicUrl(url, bucket, key);
}
    