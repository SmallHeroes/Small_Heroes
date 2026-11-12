import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { engineHttpGuard, readEngineJson } from '@/lib/engine-site/order-http';
import { confirmEngineQaFakePayment } from '@/lib/engine-site/qa-fake-payment';
import { engineQaScope } from '@/lib/engine-site/qa-order-policy';
import { engineSiteCheckoutEnabled } from '@/lib/engine-site/offer';
import { triggerGeneration } from '../../../../generate/trigger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** QA-only simulated payment for one fictional QA order. 404 everywhere else. */
export async function POST(req: NextRequest) {
  const qa = engineQaScope();
  if (!qa || qa.payment !== 'fake' || req.nextUrl.origin !== qa.origin || !engineSiteCheckoutEnabled())
    return NextResponse.json({ error: 'unavailable' }, { status: 404 });
  const denied = engineHttpGuard(req, 'engine-site-qa-fake-payment'); if (denied) return denied;
  const parent = (await resolveUserFromRequest(req))?.user ?? null;
  if (!parent) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  const parsed = z.object({ orderId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/) }).strict().safeParse(await readEngineJson(req).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 422 });
  try {
    const result = await confirmEngineQaFakePayment(prisma, parsed.data.orderId, parent.id);
    if (result.status === 'paid') await triggerGeneration(result.orderId, 'engine_qa_fake_payment');
    return NextResponse.json({ ...result, next: `/personal/orders/${encodeURIComponent(result.orderId)}` }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status = code === 'engine_qa_parent_required' ? 403 : code === 'engine_order_missing' ? 404 : 409;
    return NextResponse.json({ error: /^engine_[a-z_]+$/.test(code) ? code : 'engine_qa_fake_payment_failed' }, { status });
  }
}
