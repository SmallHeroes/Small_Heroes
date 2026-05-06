import { NextRequest, NextResponse } from 'next/server';
import { previewStoryboardPrompts } from '../../../../backend/providers/image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const pageCountRaw = Number(req.nextUrl.searchParams.get('pages') ?? '5');
  const pageCount = Number.isFinite(pageCountRaw) ? Math.max(3, Math.min(5, Math.floor(pageCountRaw))) : 5;

  const samplePages = [
    {
      pageNumber: 1,
      bookPageText: 'נועה שומעת רעש חזק מחוץ לחלון ומחזיקה חזק את השמיכה.',
      imagePrompt: 'Noa hears a loud noise outside the window and clutches her blanket.',
      expectedCharacterIds: ['child'],
    },
    {
      pageNumber: 2,
      bookPageText: 'היא מדליקה מנורה קטנה ורואה שהחדר עדיין בטוח ומוכר.',
      imagePrompt: 'She turns on a tiny lamp and notices her room is still safe and familiar.',
      expectedCharacterIds: ['child'],
    },
    {
      pageNumber: 3,
      bookPageText: 'החבר המלווה שלה מצביע על העלים שרוקדים ברוח בחוץ.',
      imagePrompt: 'Her companion points at leaves dancing in the wind outside.',
      expectedCharacterIds: ['child', 'companion:sample'],
    },
    {
      pageNumber: 4,
      bookPageText: 'נועה נושמת עמוק ומרגישה אמיצה יותר בכל נשיפה.',
      imagePrompt: 'Noa takes deep breaths and feels braver with each exhale.',
      expectedCharacterIds: ['child'],
    },
    {
      pageNumber: 5,
      bookPageText: 'היא חוזרת למיטה רגועה ומחייכת לפני השינה.',
      imagePrompt: 'She returns to bed calm and smiles before sleep.',
      expectedCharacterIds: ['child'],
    },
  ].slice(0, pageCount);

  const selectedStyle = req.nextUrl.searchParams.get('style') || 'soft_hand_drawn_storybook';

  const prompts = await previewStoryboardPrompts({
    pages: samplePages,
    childName: 'נועה',
    childDescription: 'sensitive brave child, 5 years old, warm expression',
    illustrationStyle: selectedStyle,
    characterRegistry: {
      child: { id: 'child', name: 'Noa', description: 'young child protagonist' },
      'companion:sample': { id: 'companion:sample', name: 'Luma', description: 'gentle owl companion' },
    },
  });

  const repeats = prompts.map((row, idx) => {
    if (idx === 0) return { pageNumber: row.pageNumber, shotRepeat: false, compositionRepeat: false };
    const prev = prompts[idx - 1];
    return {
      pageNumber: row.pageNumber,
      shotRepeat: row.storyboard.shotType === prev.storyboard.shotType,
      compositionRepeat: row.storyboard.compositionMode === prev.storyboard.compositionMode,
    };
  });

  return NextResponse.json({
    ok: true,
    selectedStyle,
    pageCount: prompts.length,
    repeats,
    prompts,
  });
}
