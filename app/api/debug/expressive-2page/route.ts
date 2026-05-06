import { NextRequest, NextResponse } from 'next/server';
import { generateStory, type StoryInput } from '../../../../backend/providers/story';
import { generateAllPageImages } from '../../../../backend/providers/image';
import { resolveReplicateImageModel } from '../../../../lib/replicate';
import { STYLE_IDS } from '../../../../lib/styles';

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

  if (process.env.IMAGE_MODEL_OVERRIDE?.trim() !== 'flux_pro') {
    return NextResponse.json(
      { error: 'IMAGE_MODEL_OVERRIDE must be flux_pro for this test' },
      { status: 409 }
    );
  }

  const selectedModel = resolveReplicateImageModel();
  const forcedStyle = STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK;

  const storyInput: StoryInput = {
    childName: 'נועה',
    childAge: 6,
    childGender: 'girl',
    childTraits: ['יצירתית', 'סקרנית'],
    topic: 'night_fear',
    topicLabel: 'פחד לילה',
    challengeItems: ['רעשים לא צפויים בבית בלילה'],
    outcomeItems: ['תחושת שליטה ורוגע'],
    helperItems: ['נשימה עמוקה', 'דמיון מודרך'],
    avoidItems: ['אלמנטים מפחידים מדי'],
    storyLength: 'short',
    debugPageCount: 2,
    illustrationStyle: forcedStyle,
  };

  const story = await generateStory(storyInput);
  const twoPages = story.pages.slice(0, 2).map((page, index) => ({
    ...page,
    pageNumber: index + 1,
  }));

  const compositionByPage = new Map(
    (story.pageCompositionPlan ?? []).map((composition) => [composition.pageNumber, composition])
  );

  const pagesForGeneration = [
    {
      pageNumber: 1,
      imagePrompt: twoPages[0]?.imagePrompt ?? 'Indoor calm interaction scene in child bedroom at night.',
      bookPageText:
        twoPages[0]?.text ??
        'Indoor scene: calm interaction in the child bedroom, with cozy objects and soft storybook depth.',
      imageSubject: twoPages[0]?.imageSubject ?? 'interaction',
      pageIntent: compositionByPage.get(twoPages[0]?.pageNumber ?? 1)?.pageIntent,
      compositionRules:
        'INDOOR medium shot; calm interaction; protagonist front/three-quarter and clearly readable; asymmetric cinematic framing.',
      environmentContinuity:
        'Indoor room context with depth and objects; this page is intimate and calm, not static portrait.',
      expectedCharacterIds: ['child'],
    },
    {
      pageNumber: 2,
      imagePrompt:
        twoPages[1]?.imagePrompt ??
        'Outdoor dynamic wider-shot scene with movement, environment depth, and stronger action energy.',
      bookPageText:
        twoPages[1]?.text ??
        'Outdoor (or clearly different) environment with a wider dynamic composition and visible protagonist action.',
      imageSubject: twoPages[1]?.imageSubject ?? 'action',
      pageIntent: compositionByPage.get(twoPages[1]?.pageNumber ?? 2)?.pageIntent,
      compositionRules:
        'OUTDOOR or different environment; wider shot; dynamic composition; avoid repeating page-1 pose/framing.',
      environmentContinuity:
        'Different environment from page 1 with foreground/midground/background depth and stronger movement cues.',
      expectedCharacterIds: ['child'],
    },
  ];

  const imageOutcome = await generateAllPageImages(pagesForGeneration, {
    illustrationStyle: forcedStyle,
    childName: storyInput.childName,
    childDescription: 'child age 6, short dark curly hair, warm expression, yellow-purple clothing accents',
    orderId: `expressive-2page-${Date.now()}`,
    characterSheet: story.characterSheet,
    concept: story.concept,
    heroVisualLock: story.heroVisualLock,
    styleLock: story.styleLock,
    entityVisualLock: story.entityVisualLock,
  });

  const generatedImages = [...imageOutcome.results.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, image]) => ({
      pageNumber,
      model: image.provider,
      rawUrl: image.rawUrl ?? null,
      url: image.url,
      prompt: image.prompt,
    }));

  return NextResponse.json({
    ok: true,
    storyPageCount: twoPages.length,
    generatedImageCount: imageOutcome.results.size,
    failedPages: imageOutcome.failedPages,
    styleUsed: forcedStyle,
    modelUsed: selectedModel,
    generatedImages,
  });
}
