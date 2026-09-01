import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';
import {
  ReleaseV1RecoveryError,
  ReleaseV1RecoveryInputError,
  executeReleaseV1Recovery,
} from '@/lib/generation-pipeline/release-v1-recovery';
import { ReleaseV1ContinuityError } from '@/lib/generation-pipeline/release-v1-continuity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isExactPreviewRecoveryRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === 'preview' &&
    process.env.ALLOW_STAGING_QA === 'true'
  );
}

function bearerSecret(req: NextRequest): string | null {
  const match = /^Bearer\s+(.+)$/iu.exec(
    req.headers.get('authorization') ?? '',
  );
  return match?.[1]?.trim() || null;
}

function secretsEqual(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualDigest = createHash('sha256').update(actual, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export async function POST(req: NextRequest) {
  // Deliberately hide the route outside an explicitly enabled Vercel Preview.
  // This gate runs before reading auth or body so Production cannot probe it.
  if (!isExactPreviewRecoveryRuntime()) {
    return new NextResponse(null, { status: 404 });
  }

  const expectedSecret = process.env.GENERATION_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'GENERATION_SECRET not configured' },
      { status: 503 },
    );
  }
  if (!secretsEqual(bearerSecret(req), expectedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    assertEnvSeparation();
    const body = await req.json().catch(() => null);
    const result = await executeReleaseV1Recovery(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ReleaseV1RecoveryInputError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 },
      );
    }
    if (
      error instanceof ReleaseV1RecoveryError ||
      error instanceof ReleaseV1ContinuityError
    ) {
      return NextResponse.json(
        { error: error.code, reasons: error.reasons },
        { status: 409 },
      );
    }
    console.error('[POST /api/release/v1/generate/resume]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
