import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { ROUTES } from '@/lib/routes';

export async function GET(req: NextRequest) {
  const resolved = await resolveUserFromRequest(req);
  if (!resolved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: resolved.user.id,
      status: { in: ['ready', 'partial', 'generating', 'paid'] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      childName: true,
      createdAt: true,
      paymentId: true,
      paymeTransactionId: true,
      stripeSessionId: true,
      book: {
        select: {
          title: true,
          coverImageUrl: true,
          pdfUrl: true,
        },
      },
    },
  });

  return NextResponse.json({
    user: resolved.user,
    books: orders.map((order) => {
      const accessKey = order.paymentId || order.paymeTransactionId || order.stripeSessionId || null;
      const readyUrl = `${ROUTES.ready}?orderId=${encodeURIComponent(order.id)}${accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : ''}`;
      return {
        orderId: order.id,
        status: order.status,
        childName: order.childName,
        title: order.book?.title || null,
        coverImageUrl: order.book?.coverImageUrl || null,
        pdfUrl: order.book?.pdfUrl || null,
        readyUrl,
        accessKey,
        createdAt: order.createdAt,
      };
    }),
  });
}
