import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateImage } from '../../../../backend/providers/image';
import { resolveImageModelMode, resolveReplicateImageModel } from '../../../../lib/replicate';

const prisma = new PrismaClient();

interface DebugImageRequest {
  orderId: string;
  pageNumber?: number;
  pagePrompt?: string;
  referenceImages?: string[];
  modelOverride?: string;
  persistToPage?: boolean;
  secret?: string;
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'debug endpoint disabled in production' }, { status: 403 });
  }
  try {
    const body = (await req.json()) as DebugImageRequest;

    if (process.env.GENERATION_SECRET && body.secret !== process.env.GENERATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!body.orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: {
        book: {
          include: {
            pages: {
              orderBy: { pageNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!order || !order.book) {
      return NextResponse.json({ error: 'Order or generated book not found' }, { status: 404 });
    }

    const requestedPageNumber = body.pageNumber ?? 1;
    const targetPage = order.book.pages.find((page) => page.pageNumber === requestedPageNumber);

    if (!targetPage) {
      return NextResponse.json({ error: `Page ${requestedPageNumber} not found for this order` }, { status: 404 });
    }

    const promptFromPageText = `Illustrate this children's book page scene: ${targetPage.text}`;
    const pagePrompt = body.pagePrompt?.trim() || promptFromPageText;
    const childDescription = `A ${order.childGender === 'girl' ? 'girl' : 'boy'} named ${order.childName}, approximately ${order.childAge ?? 5} years old, warm and friendly appearance`;
    const referenceImages = body.referenceImages ?? (order.childImageUrl ? [order.childImageUrl] : undefined);

    console.log(
      `[DebugImage] order=${order.id} page=${requestedPageNumber} mode=${resolveImageModelMode()} model=${body.modelOverride ?? resolveReplicateImageModel()} promptLen=${pagePrompt.length}`
    );

    const generated = await generateImage({
      pagePrompt,
      illustrationStyle: order.illustrationStyle,
      childDescription,
      referenceImages,
      modelOverride: body.modelOverride,
      orderId: order.id,
      pageNumber: requestedPageNumber,
      totalPages: order.book.pages.length,
    });

    let storedAssetId: string | null = null;
    if (body.persistToPage) {
      const saved = await prisma.imageAsset.upsert({
        where: { pageId: targetPage.id },
        update: {
          provider: generated.provider,
          prompt: generated.prompt,
          url: generated.url,
          rawUrl: generated.rawUrl ?? null,
          width: generated.width,
          height: generated.height,
          style: order.illustrationStyle,
        },
        create: {
          pageId: targetPage.id,
          provider: generated.provider,
          prompt: generated.prompt,
          url: generated.url,
          rawUrl: generated.rawUrl ?? null,
          width: generated.width,
          height: generated.height,
          style: order.illustrationStyle,
        },
      });
      storedAssetId = saved.id;
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      pageNumber: requestedPageNumber,
      imageUrl: generated.url,
      model: generated.provider,
      finalPrompt: generated.prompt,
      persisted: Boolean(body.persistToPage),
      imageAssetId: storedAssetId,
    });
  } catch (error) {
    console.error('[DebugImage] Failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
