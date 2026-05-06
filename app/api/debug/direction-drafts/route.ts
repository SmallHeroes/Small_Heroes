/**
 * Dev-only: returns buildDirectionDrafts output for QA (same as story-directions POST path).
 * Disabled in production.
 */
import { NextResponse } from 'next/server';
import { buildDirectionDrafts, buildSharedStoryFoundation } from '../../../../backend/providers/story-directions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  if (!category) {
    return NextResponse.json({ error: 'category query required' }, { status: 400 });
  }

  const input = {
    orderId: 'qa-debug-order',
    childName: 'מיה',
    childAge: 5,
    childGender: 'girl' as const,
    childTraits: ['חברותית', 'רגישה'],
    childImageUrl: null as string | null,
    illustrationStyle: 'soft_hand_drawn_storybook',
    familyContext: null,
    topic: 'qa',
    topicLabel: searchParams.get('topicLabel') || 'נושא',
    challengeItems: [] as string[],
    challengeFree: null,
    outcomeItems: [] as string[],
    helperItems: [] as string[],
    companion: null,
    challengeCategory: category,
    categoryAnswers: undefined,
  };

  const foundation = buildSharedStoryFoundation(input);
  const drafts = buildDirectionDrafts(foundation, input);

  return NextResponse.json({
    category,
    drafts: drafts.map((d) => ({
      archetype: d.archetype,
      title: d.title,
      summary: d.summary,
      storyPremise: d.storyPremise,
      openingScenePrompt: d.openingScenePrompt,
    })),
  });
}
