/**
 * POST /api/upload-photo — wizard extra-character reference (multipart file → public URL).
 */
import { NextRequest, NextResponse } from 'next/server';
import { storeWizardCharacterPhotoUpload } from '../../../lib/image-storage';
import { enforceRateLimit, enforceSameOrigin } from '../../../lib/request-security';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const sameOriginError = enforceSameOrigin(req);
    if (sameOriginError) return sameOriginError;

    const rateLimitError = enforceRateLimit(req, {
      namespace: 'api-upload-photo-post',
      limit: 30,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const typeRaw = file.type.split(';')[0].trim().toLowerCase();
    const normalizedType = typeRaw === 'image/jpg' ? 'image/jpeg' : typeRaw;
    if (!ALLOWED_TYPES.has(normalizedType)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await storeWizardCharacterPhotoUpload({
      buffer,
      contentType: normalizedType,
    });
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
