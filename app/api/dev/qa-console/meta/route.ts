import { NextResponse } from 'next/server';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import { listQaStoryBankEntries } from '@/lib/qa-console-stories';
import {
  estimateQaConsoleCostUsd,
  QA_CONSOLE_MAX_PAGES,
  QA_REPRESENTATIVE_PAGES,
} from '@/lib/qa-console-cost';
import { listQaConsoleVoices } from '@/lib/qa-console-run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDevEnvironment()) return devOnlyJsonError();

  const stories = await listQaStoryBankEntries();
  const voices = listQaConsoleVoices();

  return NextResponse.json({
    stories,
    voices,
    childPresets: [
      { id: 'noam', label: 'נועם (boy, 5)', gender: 'boy', age: 5 },
      { id: 'mia', label: 'מיה (girl, 8)', gender: 'girl', age: 8 },
    ],
    pagePresets: {
      representative10: [...QA_REPRESENTATIVE_PAGES],
    },
    maxPagesPerRun: QA_CONSOLE_MAX_PAGES,
    defaultQuality: 'low',
    allowedQualities: ['low', 'medium'],
    costEstimatePerPageLow: 0.011,
    estimateExample: estimateQaConsoleCostUsd(5, 'low', true),
  });
}
