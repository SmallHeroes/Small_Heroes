import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { composeVisualDirectorPrompt } from '@/lib/visualDirector';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId');
  const pageNumberRaw = req.nextUrl.searchParams.get('pageNumber');
  const pageNumber = Math.max(1, Number(pageNumberRaw || '2') || 2);

  if (!orderId) {
    return NextResponse.json({ error: 'orderId query param is required' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      childName: true,
      illustrationStyle: true,
      characterAnchors: true,
      book: {
        select: {
          pages: {
            orderBy: { pageNumber: 'asc' },
            select: {
              pageNumber: true,
              text: true,
              imageAsset: {
                select: {
                  prompt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order || !order.book) {
    return NextResponse.json({ error: 'Order/book not found' }, { status: 404 });
  }

  const pages = order.book.pages;
  const page = pages.find((p) => p.pageNumber === pageNumber);
  if (!page) {
    return NextResponse.json(
      { error: `Page ${pageNumber} not found for order`, availablePages: pages.map((p) => p.pageNumber) },
      { status: 404 }
    );
  }

  const anchors = (order.characterAnchors ?? {}) as Record<string, unknown>;
  const expectedCharacters = Array.isArray(anchors.expectedCharacters)
    ? anchors.expectedCharacters.filter((v): v is string => typeof v === 'string')
    : undefined;
  const pageIntent = anchors.pageIntentsByPage && typeof anchors.pageIntentsByPage === 'object'
    ? (anchors.pageIntentsByPage as Record<string, unknown>)[String(page.pageNumber)]
    : undefined;
  const composition = anchors.compositionByPage && typeof anchors.compositionByPage === 'object'
    ? (anchors.compositionByPage as Record<string, unknown>)[String(page.pageNumber)]
    : undefined;
  const stage4Prompt = anchors.stage4PromptByPage && typeof anchors.stage4PromptByPage === 'object'
    ? String((anchors.stage4PromptByPage as Record<string, unknown>)[String(page.pageNumber)] ?? '')
    : '';

  const visualDirectorInput = {
    selectedStyle: order.illustrationStyle,
    pageNumber: page.pageNumber,
    totalPages: pages.length,
    pageText: page.text,
    stage4Prompt,
    pageIntent,
    composition,
    visualBible: anchors.visualBible,
    expectedCharacters,
    childName: order.childName ?? undefined,
    companionName: typeof anchors.companionName === 'string' ? anchors.companionName : undefined,
    companionDescription:
      typeof anchors.companionDescription === 'string' ? anchors.companionDescription : undefined,
    directionArchetype: typeof anchors.directionArchetype === 'string' ? anchors.directionArchetype : undefined,
    photoQuality:
      anchors.photoQuality && typeof anchors.photoQuality === 'object'
        ? JSON.stringify(anchors.photoQuality)
        : undefined,
  };

  const output = composeVisualDirectorPrompt(visualDirectorInput);

  return NextResponse.json({
    orderId: order.id,
    pageNumber: page.pageNumber,
    totalPages: pages.length,
    pageMetadataUsed: {
      selectedStyle: order.illustrationStyle,
      childName: order.childName,
      hasStage4Prompt: Boolean(stage4Prompt),
      hasPageIntent: Boolean(pageIntent),
      hasComposition: Boolean(composition),
      expectedCharacters: expectedCharacters ?? [],
      companionName: visualDirectorInput.companionName ?? null,
      directionArchetype: visualDirectorInput.directionArchetype ?? null,
    },
    visualDirector: output,
    oldPrompt: page.imageAsset?.prompt ?? null,
  });
}

