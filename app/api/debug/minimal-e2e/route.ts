import { NextRequest, NextResponse } from 'next/server';
import { generateStory, type StoryInput } from '../../../../backend/providers/story';
import { generateAllPageImages } from '../../../../backend/providers/image';
import { resolveReplicateImageModel } from '../../../../lib/replicate';
import { STYLE_IDS } from '../../../../lib/styles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function compositionRulesForPage(pageNumber: number): string {
  if (pageNumber === 1) {
    return 'camera=medium/eye-level; type=single_focus; topTextAreaPlan=gentle; mainIllustrationZone=upper-middle';
  }
  return 'camera=medium-wide/three-quarter; type=duo_interaction; topTextAreaPlan=calm; mainIllustrationZone=center';
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { secret?: string };
  if (process.env.GENERATION_SECRET && body.secret !== process.env.GENERATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.IMAGE_MODEL_OVERRIDE?.trim()) {
    return NextResponse.json(
      { error: 'IMAGE_MODEL_OVERRIDE must be empty for this minimal dev-default run' },
      { status: 409 }
    );
  }

  const selectedModel = resolveReplicateImageModel();
  const forcedStyle = STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;

  const storyInput: StoryInput = {
    childName: 'נועה',
    childAge: 6,
    childGender: 'girl',
    childTraits: ['רגישה', 'אמיצה'],
    topic: 'night_fear',
    topicLabel: 'פחד לילה',
    challengeItems: ['חוששת מרעשים בלילה'],
    challengeFree: 'היא רוצה להרגיש בטוחה גם כשיש רעשים מבחוץ.',
    outcomeItems: ['מרגישה בטוחה', 'נרדמת ברוגע'],
    outcomeFree: 'בסוף היא רגועה ויודעת איך להתמודד.',
    helperItems: ['נשימות', 'מנורת לילה'],
    helperFree: 'היא משתמשת בדמיון ובנשימה עמוקה.',
    avoidItems: ['תוכן מפחיד מדי'],
    avoidFree: 'לשמור על טון בטוח, חם ועדין.',
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

  const imageOutcome = await generateAllPageImages(
    twoPages.map((p) => {
      const comp = compositionByPage.get(p.pageNumber);
      return {
        pageNumber: p.pageNumber,
        imagePrompt: p.imagePrompt,
        bookPageText: p.text,
        imageSubject: p.imageSubject,
        pageIntent: comp?.pageIntent,
        composition: comp
          ? {
              cameraDistance: comp.cameraDistance,
              cameraAngle: comp.cameraAngle,
              compositionType: comp.compositionType,
              heroPlacement: comp.heroPlacement,
              entityPlacement: comp.entityPlacement,
              topTextAreaPlan: comp.topTextAreaPlan,
              mainIllustrationZone: comp.mainIllustrationZone,
            }
          : undefined,
        compositionRules: compositionRulesForPage(p.pageNumber),
        environmentContinuity: 'Maintain coherent bedtime-world continuity between pages.',
        expectedCharacterIds: ['child'],
      };
    }),
    {
      illustrationStyle: forcedStyle,
      childName: storyInput.childName,
      childDescription: 'child age 6, short dark hair, warm expression, yellow pajamas',
      orderId: `minimal-e2e-${Date.now()}`,
      characterSheet: story.characterSheet,
      concept: story.concept,
      heroVisualLock: story.heroVisualLock,
      styleLock: story.styleLock,
      entityVisualLock: story.entityVisualLock,
    }
  );

  console.log('[test_run]', {
    pages: 2,
    style: forcedStyle,
    model: selectedModel,
  });

  return NextResponse.json({
    ok: true,
    storyPageCount: twoPages.length,
    generatedImageCount: imageOutcome.results.size,
    styleUsed: forcedStyle,
    modelUsed: selectedModel,
    generatedPages: [...imageOutcome.results.keys()].sort((a, b) => a - b),
    failedPages: imageOutcome.failedPages,
  });
}
