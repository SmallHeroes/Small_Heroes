/**
 * GET /api/wizard/mvp-matrix
 *
 * Public wizard challenge cards + direction sellability per MVP_STORY_MATRIX.
 * Dev mode also returns non-MVP categories (parked) with matrix state labels.
 */

import { NextResponse } from 'next/server';
import { buildMvpMatrixResponse } from '@/lib/web/mvp-matrix-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(buildMvpMatrixResponse());
}
