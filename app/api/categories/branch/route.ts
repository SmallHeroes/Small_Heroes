import { NextResponse } from 'next/server';
import {
  CATEGORY_BRANCHING,
  getCategoryBranching,
  getWizardFollowupQuestions,
} from '../../../../lib/categoryBranching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const currentAnswersRaw = searchParams.get('currentAnswers');
  let currentAnswers: Array<{ questionId?: string; selectedQuickAnswers?: string[] }> | undefined = undefined;
  if (currentAnswersRaw) {
    try {
      const parsed = JSON.parse(currentAnswersRaw);
      if (Array.isArray(parsed)) {
        currentAnswers = parsed
          .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
          .map((row) => ({
            ...(typeof row.questionId === 'string' ? { questionId: row.questionId } : {}),
            ...(Array.isArray(row.selectedQuickAnswers)
              ? { selectedQuickAnswers: row.selectedQuickAnswers.filter((v): v is string => typeof v === 'string') }
              : {}),
          }));
      }
    } catch {
      currentAnswers = undefined;
    }
  }

  if (category) {
    const b = getCategoryBranching(category);
    if (!b) {
      return NextResponse.json({ error: 'Unknown category' }, { status: 404 });
    }
    return NextResponse.json({
      category: b.category,
      hebrewLabel: b.hebrewLabel,
      emotionalDomain: b.emotionalDomain,
      typicalParentIntent: b.typicalParentIntent,
      followUpQuestions: getWizardFollowupQuestions(b.category, currentAnswers),
      treatmentStrategy: b.treatmentStrategy,
      storyDirectionSummaries: b.storyDirections.map((d) => ({
        id: d.id,
        flavor: d.flavor,
        title: d.title,
        summary: d.summary,
        realWorldAnchor: d.realWorldAnchor,
      })),
    });
  }

  return NextResponse.json(
    Object.values(CATEGORY_BRANCHING).map((b) => ({
      category: b.category,
      hebrewLabel: b.hebrewLabel,
      emotionalDomain: b.emotionalDomain,
    })),
  );
}
