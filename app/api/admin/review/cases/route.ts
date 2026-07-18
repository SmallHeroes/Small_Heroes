/**
 * GET /api/admin/review/cases — list OPEN HumanQaReviewCase rows (read-only).
 * Auth: GENERATION_SECRET via Bearer / x-generation-secret (same gate as other /api/admin/*).
 * Never returns customer access keys.
 */
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminSecret } from '@/lib/admin/assert-generation-secret';
import { DEMO_OPEN_CASES } from '@/lib/admin/human-qa-review-fixtures';
import { loadOpenReviewCases } from '@/lib/admin/human-qa-review-loader';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = assertAdminSecret(req);
  if (denied) return denied;

  const demo = new URL(req.url).searchParams.get('demo') === '1';
  if (demo && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ cases: DEMO_OPEN_CASES, demo: true });
  }

  const cases = await loadOpenReviewCases(prisma);
  return NextResponse.json({ cases, demo: false });
}
