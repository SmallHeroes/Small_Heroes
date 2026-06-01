import { GOLDEN_SHELF_PAGE_OPTIONS } from '@/lib/power-cards/golden-shelf-catalog';
import {
  estimateQaConsoleCostUsd,
  QA_CONSOLE_MAX_PAGES,
  QA_REPRESENTATIVE_PAGES,
} from '@/lib/qa-console-cost';
import { listQaStoryBankEntries } from '@/lib/qa-console-stories';
import { listQaConsoleVoices } from '@/lib/qa-console-run';
import { WIZARD_ILLUSTRATION_STYLES } from '@/lib/styles';

export async function buildCreatorMetaPayload() {
  const stories = await listQaStoryBankEntries();
  const voices = listQaConsoleVoices();

  return {
    stories,
    voices,
    illustrationStyles: WIZARD_ILLUSTRATION_STYLES.map((s) => ({
      id: s.id,
      label: s.label,
      blurb: s.blurb,
    })),
    childPresets: [
      { id: 'noam', label: 'נועם (boy, 5)', gender: 'boy', age: 5 },
      { id: 'mia', label: 'מיה (girl, 8)', gender: 'girl', age: 8 },
    ],
    pagePresets: {
      representative10: [...QA_REPRESENTATIVE_PAGES],
    },
    maxPagesPerRun: QA_CONSOLE_MAX_PAGES,
    fullBookPageOptions: [...GOLDEN_SHELF_PAGE_OPTIONS, 15, 20],
    defaultQuality: 'low' as const,
    allowedQualities: ['low', 'medium'] as const,
    estimateExample: estimateQaConsoleCostUsd(5, 'low', true),
  };
}
