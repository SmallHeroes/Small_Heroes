import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';
import { canUseFakePayments } from '@/lib/env';
import { ROUTES } from '@/lib/routes';
import { triggerGeneration } from '../../../generate/route';

const logger = createLogger({ subsystem: 'fake-payment', route: '/api/dev/fake-payment/confirm' });

export async function POST(req: NextRequest) {
  if (!canUseFakePayments()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sameOriginError = enforceSameOrigin(req);
  if (sameOriginError) return sameOriginError;
  const rateLimitError = enforceRateLimit(req, {
    namespace: 'api-dev-fake-payment-confirm',
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  const paymentId = typeof body?.paymentId === 'string' ? body.paymentId.trim() : '';
  const result = body?.result === 'failed' ? 'failed' : body?.result === 'success' ? 'success' : null;
  if (!orderId || !paymentId || !result) {
    return NextResponse.json({ error: 'orderId, paymentId and result are required' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentProvider: true, paymentId: true, totalPrice: true },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.paymentProvider !== 'fake') return NextResponse.json({ error: 'Order is not in fake payment mode' }, { status: 409 });
  if (order.paymentId !== paymentId) return NextResponse.json({ error: 'Payment id mismatch' }, { status: 409 });

  if (result === 'failed') {
    if (!['draft', 'pending_payment', 'failed'].includes(order.status)) {
      return NextResponse.json({ error: 'Order cannot be failed at this stage' }, { status: 409 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      await tx.paymentRecord.upsert({
        where: { orderId: order.id },
        update: {
          provider: 'fake',
          paid: false,
          paidAt: null,
          amount: order.totalPrice,
          currency: 'ils',
          raw: { mode: 'fake', result: 'failed', paymentId },
        },
        create: {
          orderId: order.id,
          provider: 'fake',
          amount: order.totalPrice,
          currency: 'ils',
          paid: false,
          raw: { mode: 'fake', result: 'failed', paymentId },
        },
      });
    });
    return NextResponse.json({
      ok: true,
      result: 'failed',
      redirectUrl: `${ROUTES.wizard}?orderId=${encodeURIComponent(order.id)}&payment=failed`,
    });
  }

  const shouldTriggerGeneration = await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({
      where: { id: order.id },
      select: { id: true, status: true, totalPrice: true },
    });
    if (!fresh) return false;
    if (['generating', 'ready', 'partial'].includes(fresh.status)) return false;

    await tx.order.update({
      where: { id: fresh.id },
      data: {
        status: 'paid',
        paymentProvider: 'fake',
        paymentId,
        stripePaid: false,
      },
    });
    await tx.paymentRecord.upsert({
      where: { orderId: fresh.id },
      update: {
        provider: 'fake',
        paid: true,
        paidAt: new Date(),
        amount: fresh.totalPrice,
        currency: 'ils',
        raw: { mode: 'fake', result: 'success', paymentId },
      },
      create: {
        orderId: fresh.id,
        provider: 'fake',
        amount: fresh.totalPrice,
        currency: 'ils',
        paid: true,
        paidAt: new Date(),
        raw: { mode: 'fake', result: 'success', paymentId },
      },
    });
    return fresh.status !== 'paid';
  });

  if (shouldTriggerGeneration) {
    triggerGeneration(order.id, 'fake_payment_confirm_success').catch((error) => {
      logger.error('Fake payment generation trigger failed', error, { orderId: order.id, paymentId });
    });
  }

  return NextResponse.json({
    ok: true,
    result: 'success',
    redirectUrl: `${ROUTES.generating}?orderId=${encodeURIComponent(order.id)}&accessKey=${encodeURIComponent(paymentId)}`,
  });
}

