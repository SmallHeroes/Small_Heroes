import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { generateImage } from '../../../../backend/providers/image';
import { resolveImageModelMode, resolveReplicateImageModel } from '../../../../lib/replicate';
import { withDeliveryInputMutation } from '../../../../lib/generation-pipeline/readiness-manifest';
import {
  OrderVisualPackageAuthorityError,
  requireOrderVisualPackageAuthority,
} from '../../../../lib/generation-pipeline/order-visual-package-authority';

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

    // A package-backed Order's pages may only be produced through the qualified provider seam
    // (chunk runner / single-page regen), which binds the Order-frozen package, contract and Boards.
    // This debug route bypasses all of that, so it runs the FULL authority validation and proceeds
    // only for a genuine legacy Order: a package-backed Order, a malformed/aliased accepted
    // reference, AND a legacy Order carrying package authority (origin mix) are all refused.
    try {
      if (requireOrderVisualPackageAuthority(order) !== null) {
        return NextResponse.json(
          { error: 'package-backed Order pages cannot be mutated through the debug image route' },
          { status: 409 },
        );
      }
    } catch (authorityError) {
      if (!(authorityError instanceof OrderVisualPackageAuthorityError)) {
        throw authorityError;
      }
      return NextResponse.json(
        { error: 'Order Visual Package authority is invalid — debug image route refused' },
        { status: 409 },
      );
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
      const mutation = await withDeliveryInputMutation(
        prisma,
        {
          orderId: order.id,
          reason: 'debug_page_asset_changed',
          operationKey: `delivery_input:${order.id}:page:${requestedPageNumber}:${generated.url}`,
          mutationPayload: {
            prompt: generated.prompt, url: generated.url, rawUrl: generated.rawUrl ?? null,
            width: generated.width, height: generated.height,
            provider: generated.provider, style: order.illustrationStyle,
          },
        },
        async (tx) => {
          // Return a JSON-safe projection (P2 #4) — the receipt stores/replays this, so never a Prisma record.
          const asset = await tx.imageAsset.upsert({
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
          return { id: asset.id };
        },
      );
      storedAssetId = mutation.value.id;
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
