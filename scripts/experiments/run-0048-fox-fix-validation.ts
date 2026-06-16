/**
 * 0048: fox_uri board quarantine + night wardrobe validation (p1/p5/p6/p8 LOW).
 * Usage:
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/experiments/run-0048-fox-fix-validation.ts
 */
import { readFileSync } from 'fs';
import path from 'path';

import '../shims/register-server-only.cjs';
import { loadSetAppearanceBoardManifest } from '../../lib/set-appearance';
import { runQaConsoleRender } from '../../lib/qa-console-run';

async function main(): Promise<void> {
  // Set true to force board regen; false reuses QA-passed board on disk.
  if (process.env.SET_APPEARANCE_BOARD_FORCE_REGENERATE !== 'false') {
    process.env.SET_APPEARANCE_BOARD_FORCE_REGENERATE = 'true';
  }

  const fox = await runQaConsoleRender({
    storyKey: 'fox_uri_adventure@v3-approved',
    pages: [1, 5, 6, 8],
    child: { name: '×ž×™×”', gender: 'girl', age: 8 },
    quality: 'low',
    generateAudio: false,
    runLabelPrefix: 'qa-console-fox_uri-0048',
    skipLlmPersonalization: true,
    approveSetAppearanceBoardSceneId: 'fixed_interior_bedroom_window_unspecified',
  });

  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), 'outputs', 'style01-auditions', fox.manifestDir, 'manifest.json'), 'utf-8')
  ) as {
    setAppearanceBoardPath?: string | null;
    setAppearanceBoardAttached?: boolean;
    pages?: Array<{ pageNumber: number; setAppearanceBoardAttached?: boolean }>;
  };

  const board = loadSetAppearanceBoardManifest('fixed_interior_bedroom_window_unspecified');
  console.log('\n=== 0048 FOX validation ===');
  console.log(`dir=${fox.manifestDir}`);
  console.log(`rendered=${fox.renderedPageNumbers.join(',')}`);
  console.log(`failed=${fox.failedPages.join(',') || 'none'}`);
  console.log(`board qaPassed=${board?.qaPassed} approved=${board?.approved}`);
  console.log(`board path=${board?.boardPath ?? manifest.setAppearanceBoardPath ?? 'null'}`);
  console.log(`manifest board attached=${manifest.setAppearanceBoardAttached ?? 'n/a'}`);
  for (const p of manifest.pages ?? []) {
    console.log(`p${p.pageNumber} boardAttached=${p.setAppearanceBoardAttached ?? false}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
