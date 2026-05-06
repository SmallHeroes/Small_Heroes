import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';
import { ROUTES } from '@/lib/routes';
import { triggerGeneration } from '../../generate/route';
import { verifyPaymePayment } from '@/lib/payme';

const logger = createLogger({ subsystem: 'payme-return', route: '/api/payme/return' });

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')?.trim() || '';
  const paymentIdFromQuery =
    req.nextUrl.searchParams.get('paymentId')?.trim() ||
    req.nextUrl.searchParams.get('transactionId')?.trim() ||
    '';
  const transactionIdFromQuery = req.nextUrl.searchParams.get('transactionId')?.trim() || '';
  const statusRaw = (req.nextUrl.searchParams.get('status') || req.nextUrl.searchParams.get('paymentStatus') || '').trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';
  const allowUnsafeRedirectTrust = env.PAYME_REDIRECT_TRUST_MODE && !isProduction;

  if (!orderId || env.PAYMENT_PROVIDER !== 'payme') {
    return NextResponse.redirect(new URL(ROUTES.wizard, req.nextUrl.origin));
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, paymentProvider: true, paymentId: true, totalPrice: true },
    });
    if (!order || (order.paymentProvider && order.paymentProvider !== 'payme')) {
      const redirectUrl = new URL(`${ROUTES.generating}?orderId=${encodeURIComponent(orderId)}`, req.nextUrl.origin);
      const accessKey = paymentIdFromQuery || transactionIdFromQuery;
      if (accessKey) redirectUrl.searchParams.set('accessKey', accessKey);
      redirectUrl.searchParams.set('payment', 'checking');
      return NextResponse.redirect(redirectUrl);
    }

    if (order.status === 'paid' || order.status === 'generating' || order.status === 'ready' || order.status === 'partial') {
      if (order.status === 'paid') {
        triggerGeneration(order.id, 'payme_redirect_seen_paid_state').catch((error) => {
          logger.error('Generation trigger failed for paid order on redirect', error, { orderId: order.id });
        });
      }
      const redirectUrl = new URL(`${ROUTES.generating}?orderId=${encodeURIComponent(order.id)}`, req.nextUrl.origin);
      const accessKey = order.paymentId || paymentIdFromQuery || transactionIdFromQuery;
      if (accessKey) redirectUrl.searchParams.set('accessKey', accessKey);
      return NextResponse.redirect(redirectUrl);
    }

    const hasIdentifiers = Boolean(paymentIdFromQuery || transactionIdFromQuery || order.paymentId);
    let verification: Awaited<ReturnType<typeof verifyPaymePayment>> = { verified: false, status: 'unknown', raw: null };
    if (hasIdentifiers) {
      verification = await verifyPaymePayment({
        orderId: order.id,
        paymentId: paymentIdFromQuery || order.paymentId || undefined,
        transactionId: transactionIdFromQuery || undefined,
      });
      logger.info('PayMe redirect verification attempted', {
        orderId: order.id,
        verified: verification.verified,
        status: verification.status,
      });
    }

    const allowUnsafePaidMark =
      allowUnsafeRedirectTrust &&
      !verification.verified &&
      ['paid', 'success', 'succeeded', 'completed', 'approved'].includes(statusRaw);

    if (verification.verified && verification.status === 'paid') {
      const resolvedPaymentId = transactionIdFromQuery || paymentIdFromQuery || order.paymentId || `payme_verified_${order.id}`;
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'paid',
            paymentProvider: 'payme',
            paymentId: resolvedPaymentId,
            paymeTransactionId: resolvedPaymentId,
            paymeMetadata: verification.raw as object,
            stripePaid: false,
          },
        });
        await tx.paymentRecord.upsert({
          where: { orderId: order.id },
          update: {
            provider: 'payme',
            paid: true,
            paidAt: new Date(),
            amount: order.totalPrice,
            currency: 'ils',
            raw: verification.raw as object,
          },
          create: {
            orderId: order.id,
            provider: 'payme',
            amount: order.totalPrice,
            currency: 'ils',
            paid: true,
            paidAt: new Date(),
            raw: verification.raw as object,
          },
        });
      });
      triggerGeneration(order.id, 'payme_redirect_verified_paid').catch((error) => {
        logger.error('Generation trigger failed after verified redirect', error, { orderId: order.id });
      });
    } else if (allowUnsafePaidMark) {
      logger.warn('UNSAFE redirect trust mode accepted paid state (dev only)', {
        orderId: order.id,
        paymentIdFromQuery,
        transactionIdFromQuery,
      });
      const fallbackPaymentId = transactionIdFromQuery || paymentIdFromQuery || order.paymentId || `payme_unsafe_${order.id}`;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paymentProvider: 'payme',
          paymentId: fallbackPaymentId,
          paymeTransactionId: fallbackPaymentId,
          paymeMetadata: {
            source: 'unsafe_redirect_trust_mode',
            query: Object.fromEntries(req.nextUrl.searchParams.entries()),
          },
          stripePaid: false,
        },
      });
      triggerGeneration(order.id, 'payme_redirect_unverified_trust_mode').catch((error) => {
        logger.error('Generation trigger failed after unsafe redirect trust', error, { orderId: order.id });
      });
    }
  } catch (error) {
    logger.error('PayMe redirect processing failed', error, { orderId });
  }

  const redirectUrl = new URL(`${ROUTES.generating}?orderId=${encodeURIComponent(orderId)}`, req.nextUrl.origin);
  const accessKey = paymentIdFromQuery || transactionIdFromQuery;
  if (accessKey) redirectUrl.searchParams.set('accessKey', accessKey);
  redirectUrl.searchParams.set('payment', 'checking');
  return NextResponse.redirect(redirectUrl);
}

