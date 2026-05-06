import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeStyleId } from '@/lib/styles';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const expectedSecret = process.env.GENERATION_SECRET;
  const providedSecret = req.headers.get('x-generation-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { orderId } = await params;
  const pageFilter = Number(req.nextUrl.searchParams.get('page'));
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      illustrationStyle: true,
      book: {
        select: {
          pages: {
            orderBy: { pageNumber: 'asc' },
            select: {
              pageNumber: true,
              imageAsset: { select: { prompt: true, url: true, rawUrl: true, presentationUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!order || !order.book) {
    return NextResponse.json({ error: 'Order or book not found' }, { status: 404 });
  }
  const pages = order.book.pages
    .filter((p) => !Number.isFinite(pageFilter) || p.pageNumber === pageFilter)
    .map((p) => ({
      pageNumber: p.pageNumber,
      prompt: p.imageAsset?.prompt ?? null,
      promptLength: p.imageAsset?.prompt?.length ?? 0,
      rawUrl: p.imageAsset?.rawUrl ?? p.imageAsset?.url ?? null,
      presentationUrl: p.imageAsset?.presentationUrl ?? null,
      isPostProcessed: Boolean(p.imageAsset?.presentationUrl),
    }));
  return NextResponse.json({
    orderId: order.id,
    styleId: normalizeStyleId(order.illustrationStyle),
    pages,
  });
}
