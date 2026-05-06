import { NextRequest, NextResponse } from 'next/server';
import { generateAllPageImages } from '../../../../backend/providers/image';
import { resolveReplicateImageModel } from '../../../../lib/replicate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { secret?: string };
  if (process.env.GENERATION_SECRET && body.secret !== process.env.GENERATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pages = [
    {
      pageNumber: 1,
      imagePrompt:
        'Rich illustrated children book environment with depth and objects: cozy bedroom with layered foreground toys, midground child and companion, background shelves and window light.',
      bookPageText: 'A rich bedroom environment with clear depth and layered objects.',
      expectedCharacterIds: ['child'],
    },
    {
      pageNumber: 2,
      imagePrompt:
        'Rich illustrated environment with depth and objects, not minimal: child walks through a detailed magical garden with stones, plants, fence, and distant trees.',
      bookPageText: 'A detailed garden scene with foreground-midground-background layering.',
      expectedCharacterIds: ['child'],
    },
    {
      pageNumber: 3,
      imagePrompt:
        'Rich illustrated indoor scene with depth and objects: kitchen table in foreground, child and parent in midground, cupboards and doorway in background.',
      bookPageText: 'A detailed indoor family scene with clear spatial depth.',
      expectedCharacterIds: ['child'],
    },
  ];

  const result = await generateAllPageImages(pages, {
    illustrationStyle: 'soft_hand_drawn_storybook',
    childDescription: 'child age 6, short dark hair, warm expression, yellow shirt',
    orderId: `dev-limit-${Date.now()}`,
  });

  const generatedPages = [...result.results.keys()].sort((a, b) => a - b);
  const generatedImages = [...result.results.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, image]) => ({
      pageNumber,
      provider: image.provider,
      rawUrl: image.rawUrl ?? null,
      url: image.url,
    }));

  return NextResponse.json({
    ok: true,
    selectedModel: resolveReplicateImageModel(),
    inputPages: pages.length,
    generatedCount: result.results.size,
    generatedPages,
    failedPages: result.failedPages,
    generatedImages,
  });
}
