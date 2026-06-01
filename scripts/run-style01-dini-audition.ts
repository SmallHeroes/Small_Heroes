/**
 * Style 01 Dini boundary-egg LOW selective audition (CLI wrapper).
 *
 * Env: STYLE01_QA_IMAGE_QUALITY=low, STYLE_01_GPT_MODEL=gpt-image-2,
 *      PHASE2_STYLE01_BOOK_PIPELINE=true, IMAGE_PROVIDER=gpt-image
 *
 * Optional: CHILD_PHOTO_PATH, CHILD_NAME, CHILD_GENDER, CHILD_AGE,
 *   PERSONALIZATION_GIRL_TEST=true, ONLY_PAGES=1,2,...
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-style01-dini-audition.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import { existsSync } from 'fs';
import { runQaConsoleRender } from '../lib/qa-console-run';

const MAX_STORY_PAGES = 20;
const GIRL_TEST_PAGES = [1, 2, 3, 4, 5, 8, 13, 15, 16, 20] as const;
const DEFAULT_RENDER_PAGES = [15, 20];

function isPersonalizationGirlTest(): boolean {
  return process.env.PERSONALIZATION_GIRL_TEST?.trim().toLowerCase() === 'true';
}

function parseOnlyPages(): number[] {
  const raw = process.env.ONLY_PAGES?.trim();
  if (!raw) {
    if (isPersonalizationGirlTest()) return [...GIRL_TEST_PAGES];
    return [...DEFAULT_RENDER_PAGES];
  }
  return raw
    .split(/[,\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= MAX_STORY_PAGES);
}

async function main(): Promise<void> {
  const onlyPages = parseOnlyPages();
  const promptAuditOnly = process.env.PROMPT_AUDIT_ONLY?.trim().toLowerCase() === 'true';
  const childPhotoPath = process.env.CHILD_PHOTO_PATH?.trim();

  const child = childPhotoPath
    ? {
        name: process.env.CHILD_NAME?.trim() || (isPersonalizationGirlTest() ? 'מיה' : 'נועם'),
        gender: (process.env.CHILD_GENDER?.trim() || (isPersonalizationGirlTest() ? 'girl' : 'boy')) as
          | 'boy'
          | 'girl',
        age: Number.parseInt(process.env.CHILD_AGE?.trim() ?? (isPersonalizationGirlTest() ? '8' : '5'), 10) || 5,
        photoPath: existsSync(childPhotoPath) || childPhotoPath.startsWith('http') ? childPhotoPath : undefined,
      }
    : isPersonalizationGirlTest()
      ? { preset: 'mia' as const }
      : { preset: 'noam' as const };

  const result = await runQaConsoleRender({
    storyKey: 'dragon_dini_fantasy',
    pages: onlyPages,
    child,
    quality: 'low',
    promptAuditOnly,
    runLabelPrefix: isPersonalizationGirlTest() ? 'dini-girl-test-low' : 'dini-boundary-egg-low',
  });

  console.log('\n=== Done ===');
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Failed pages: ${result.failedPages.length ? result.failedPages.join(', ') : 'none'}`);
  console.log(`Quality: ${result.quality} | Model: ${result.model}`);
  console.log(`Est. cost: $${result.estimatedCostUsd.toFixed(3)}`);
  console.log(`Preview: http://localhost:3000/dev/style01-book-preview?dir=${encodeURIComponent(result.manifestDir)}&root=outputs`);

  if (result.failedPages.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
