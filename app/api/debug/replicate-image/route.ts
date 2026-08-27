import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { generateImage } from '../../../../backend/providers/image';
import { resolveImageModelMode, resolveReplicateImageModel } from '../../../../lib/replicate';
import { withDeliveryInputMutation, type DeliveryInputMutationResult } from '../../../../lib/generation-pipeline/readiness-manifest';
import {
  OrderVisualPackageAuthorityError,
  requireConsistentProducingIdentity,
  requireProducingSnapshotBinding,
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
        generationJob: { select: { pipelineCache: true } },
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
    // This debug route bypasses all of that, so it proves the FULL producing-snapshot provenance
    // (Codex round-4 MAJOR 6: the Order shape alone is not enough — a legacy-looking Order whose
    // producing pipeline snapshot carries package authority, a contract stamp mismatch, or an
    // ambiguous stamp/contract pair must all refuse) and proceeds only for a genuinely legacy Order:
    // a package-backed Order (even fully bound), a malformed/aliased accepted reference, a legacy
    // Order carrying package authority, and every A→legacy/A→B/missing/ambiguous producing mix are
    // refused BEFORE any provider call and before any persistence.
    try {
      if (
        requireProducingSnapshotBinding({
          order,
          pipelineCache: order.generationJob?.pipelineCache ?? null,
        }) !== null
      ) {
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
        { error: 'Order producing-snapshot provenance is invalid — debug image route refused' },
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
      // (Codex round-5 finding 4) The pre-provider check proved a GENUINE LEGACY order; the provider
      // call takes real time, and a freeze/re-point can land inside that window. Persistence
      // re-proves the SAME identity from a FRESH in-tx read BEFORE any write — a legacy→package
      // (or any other) flip during the provider call aborts the mutation with ZERO ImageAsset/Page
      // writes (the provider image is simply not persisted).
      class DebugPersistenceProvenanceError extends Error {}
      let mutation: DeliveryInputMutationResult<{ id: string }>;
      try {
        mutation = await withDeliveryInputMutation(
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
            const fresh = await tx.order.findUnique({
              where: { id: order.id },
              select: {
                selectionFilename: true,
                storySourceHash: true,
                illustrationStyle: true,
                visualPackageAuthority: true,
                visualContractHash: true,
                generationJob: { select: { pipelineCache: true } },
              },
            });
            if (!fresh) {
              throw new DebugPersistenceProvenanceError('order vanished during the provider call');
            }
            try {
              // The route only proceeds for genuine legacy → the evaluated caller identity is null;
              // the fresh row + producing snapshot must still be exactly that.
              requireConsistentProducingIdentity({
                callerPackageRevisionDigest: null,
                order: fresh,
                pipelineCache: fresh.generationJob?.pipelineCache ?? null,
              });
            } catch (provenanceError) {
              if (!(provenanceError instanceof OrderVisualPackageAuthorityError)) throw provenanceError;
              throw new DebugPersistenceProvenanceError(provenanceError.message);
            }
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
      } catch (persistError) {
        if (persistError instanceof DebugPersistenceProvenanceError) {
          return NextResponse.json(
            {
              error:
                'Order provenance changed during the provider call — generated image NOT persisted',
              detail: persistError.message,
              imageUrl: generated.url,
              persisted: false,
            },
            { status: 409 },
          );
        }
        throw persistError;
      }
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
