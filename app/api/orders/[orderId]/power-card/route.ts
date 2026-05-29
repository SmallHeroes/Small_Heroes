import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { renderPowerCard } from '@/lib/power-cards/render';
import { resolvePowerCardRenderInputForOrder } from '@/lib/power-cards/resolve-from-order';
import {
  getCachedPowerCardExport,
  putCachedPowerCardExport,
  type PowerCardExportFormat,
} from '@/lib/power-cards/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const logger = createLogger({ subsystem: 'power-cards', route: '/api/orders/[orderId]/power-card' });

function parseFormat(raw: string | null): PowerCardExportFormat | null {
  if (raw === 'pdf' || raw === 'png') return raw;
  return null;
}

async function verifyOrderAccess(orderId: string, accessKey: string | null) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      childName: true,
      childGender: true,
      storyDirection: true,
      characterAnchors: true,
      paymentId: true,
      paymeTransactionId: true,
      stripeSessionId: true,
      status: true,
      book: { select: { title: true } },
    },
  });

  if (!order) return null;

  const expectedAccessKey = order.paymentId || order.paymeTransactionId || order.stripeSessionId;
  if (!expectedAccessKey || !accessKey || accessKey !== expectedAccessKey) {
    logger.warn('Power Card access denied', { orderId, reason: 'invalid_access_key' });
    return null;
  }

  if (!['ready', 'partial'].includes(order.status)) {
    return { order, notReady: true as const };
  }

  return { order, notReady: false as const };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const accessKey = req.nextUrl.searchParams.get('accessKey');
    const format = parseFormat(req.nextUrl.searchParams.get('format'));

    if (!format) {
      return NextResponse.json({ error: 'format must be pdf or png' }, { status: 400 });
    }

    const verified = await verifyOrderAccess(orderId, accessKey);
    if (!verified) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (verified.notReady) {
      return NextResponse.json({ error: 'Order not ready' }, { status: 409 });
    }

    const cached = await getCachedPowerCardExport(orderId, format);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        status: 200,
        headers: {
          'Content-Type': format === 'pdf' ? 'application/pdf' : 'image/png',
          'Content-Disposition': `inline; filename="power-card-${orderId}.${format}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Power-Card-Cache': 'hit',
        },
      });
    }

    const renderInput = await resolvePowerCardRenderInputForOrder(verified.order);
    if (!renderInput) {
      return NextResponse.json({ error: 'Power Card not available for this order' }, { status: 404 });
    }

    const { pngBuffer, pdfBuffer } = await renderPowerCard(renderInput);
    const buffer = format === 'pdf' ? pdfBuffer : pngBuffer;

    await Promise.all([
      putCachedPowerCardExport(orderId, 'pdf', pdfBuffer),
      putCachedPowerCardExport(orderId, 'png', pngBuffer),
    ]);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': format === 'pdf' ? 'application/pdf' : 'image/png',
        'Content-Disposition': `inline; filename="power-card-${orderId}.${format}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Power-Card-Cache': 'miss',
      },
    });
  } catch (error) {
    logger.error('Power Card export failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
