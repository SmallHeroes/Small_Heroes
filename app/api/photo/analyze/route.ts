import { NextRequest, NextResponse } from 'next/server';
import { analyzePhotoDataUrl } from '../../../../lib/resemblance-core';
import { hebrewPhotoMessage } from '../../../../lib/photo-quality-messages';
import { enforceRateLimit, enforceSameOrigin } from '../../../../lib/request-security';

export async function POST(req: NextRequest) {
  try {
    const sameOriginError = enforceSameOrigin(req);
    if (sameOriginError) return sameOriginError;
    const rateLimitError = enforceRateLimit(req, {
      namespace: 'api-photo-analyze-post',
      limit: 25,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => ({}));
    const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
    if (!dataUrl) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    const result = await analyzePhotoDataUrl(dataUrl);
    console.debug('PHOTO_ANALYSIS', {
      source: 'server',
      faceRatio: result.dominantFaceRatio,
      faceCount: result.faceCount,
      decision: result.status,
      reasonCodes: result.reasonCodes,
    });
    return NextResponse.json({
      ...result,
      messageHe: hebrewPhotoMessage(result.reasonCodes, { faceCount: result.faceCount }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Photo analysis failed',
        reason:
          error instanceof Error ? error.message : 'unknown_error',
      },
      { status: 500 }
    );
  }
}
