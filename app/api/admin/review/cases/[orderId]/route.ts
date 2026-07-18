/**
 * GET /api/admin/review/cases/[orderId] — open-case detail + book pages + evidence (read-only).
 * Auth: GENERATION_SECRET via Bearer / x-generation-secret.
 * Never returns customer access keys.
 */
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminSecret } from '@/lib/admin/assert-generation-secret';
import { DEMO_CASE_DETAIL } from '@/lib/admin/human-qa-review-fixtures';
import { loadReviewCaseDetail } from '@/lib/admin/human-qa-review-loader';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = assertAdminSecret(req);
  if (denied) return denied;

  const { orderId } = await context.params;
  if (!orderId?.trim()) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const demo = new URL(req.url).searchParams.get('demo') === '1';
  if (demo && process.env.NODE_ENV !== 'production') {
    if (orderId === DEMO_CASE_DETAIL.orderId || orderId === 'demo') {
      return NextResponse.json({ case: DEMO_CASE_DETAIL, demo: true });
    }
    return NextResponse.json({ error: 'Demo case not found' }, { status: 404 });
  }

  const detail = await loadReviewCaseDetail(prisma, orderId);
  if (!detail) {
    return NextResponse.json({ error: 'No open review case for this order' }, { status: 404 });
  }
  return NextResponse.json({ case: detail, demo: false });
}
